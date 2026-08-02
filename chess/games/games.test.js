'use strict';
const T = require('../core/_test.js');
const C = require('../core/chess-core.js');
const G = require('./games.js');

const RESULTS = ['1-0', '0-1', '1/2-1/2'];

T.eq(G.LEARNING_ROUTE.length, 11, '学习路线 11 站（规格 §6.3）');

const seen = {};
for (const g of G.GAMES) {
  const at = g.id + ': ';

  // ---- 标识与分类 ----
  T.ok(/^[a-z0-9-]+$/.test(g.id), at + 'id 是小写连字符');
  T.ok(!seen[g.id], at + 'id 不重复');
  seen[g.id] = 1;
  // 挡住拼错的 id 和悄悄溜进来的第 31 局——这是硬门，与「集齐了几局」无关。
  T.ok(G.EXPECTED_IDS.indexOf(g.id) >= 0, at + '在预期清单里');
  T.ok(G.GROUP_ORDER.indexOf(g.group) >= 0, at + 'group 是已知分组');
  T.ok(Array.isArray(g.tags) && g.tags.length > 0, at + '至少一个 tag');
  T.ok(g.tags.every(x => G.TAGS.indexOf(x) >= 0), at + 'tag 都在词表里：' + g.tags.join(','));
  T.ok([1, 2, 3].indexOf(g.difficulty) >= 0, at + 'difficulty ∈ {1,2,3}');

  // ---- 来源：只标注出处，不做版本核对（本工具不做记谱考古）----
  T.ok(/^https?:\/\//.test(g.source), at + 'source 是一个 URL');

  // ---- 双语完整 ----
  for (const k of ['story', 'why']) {
    T.ok(g[k] && g[k].en && g[k].en.trim().length > 0, at + k + ' 有英文');
    T.ok(g[k] && g[k].zh && g[k].zh.trim().length > 0, at + k + ' 有中文');
  }
  /* why 是列表卡片上唯一显示的那行字，长度是它唯一能机器化的约束。
     不要改成「数句号」——'St. Louis'、'G. Kasparov' 这类写法会让它误判。 */
  T.ok(g.why.en.length <= 160, at + 'why 的英文不超过 160 字符（卡片放得下一行）');
  T.ok(g.why.zh.length <= 70, at + 'why 的中文不超过 70 字');

  /* ---- 唯一真正的门：这份 PGN 能不能逐步重放 ----
     抄错的一步会当场走不通。这不是「核实史实」，是「这份数据能不能渲染」——
     走不通的棋谱在工具里就是一块白屏。 */
  let parsed = null;
  try { parsed = C.parsePGN(g.pgn); }
  catch (e) { T.ok(false, at + 'PGN 逐步重放失败 —— ' + e.message); continue; }
  T.ok(parsed.moves.length > 0, at + 'PGN 里有走法');
  T.ok(RESULTS.indexOf(parsed.result) >= 0, at + '结果是三种之一（从 PGN 读，不另抄字段）');

  // 标签对：列表卡片要靠它显示，缺了就是一张空卡
  const H = G.headersOf(g);
  for (const tag of ['White', 'Black', 'Result']) {
    T.ok(H[tag] && H[tag].trim() && H[tag] !== '?', at + 'PGN 有 ' + tag + ' 标签对');
  }
  T.eq(H.Result, parsed.result, at + 'Result 标签对与走法末尾的结果一致');

  // ---- keyMoves ----
  T.ok(g.keyMoves.length >= 3 && g.keyMoves.length <= 6, at + 'keyMoves 有 3–6 条');
  let last = 0;
  for (const k of g.keyMoves) {
    T.ok(Number.isInteger(k.ply) && k.ply >= 1 && k.ply <= parsed.moves.length,
         at + 'keyMove 的 ply ' + k.ply + ' 落在 [1, ' + parsed.moves.length + ']');
    T.ok(k.ply > last, at + 'keyMove 的 ply 严格递增');
    last = k.ply;
    T.ok(k.note && k.note.en && k.note.en.trim(), at + 'keyMove@' + k.ply + ' 有英文说明');
    T.ok(k.note && k.note.zh && k.note.zh.trim(), at + 'keyMove@' + k.ply + ' 有中文说明');
    /* 锚在走法上，不只锚在序号上。换一份记谱时 ply 会整体平移，而平移后的
       ply 多半仍在合法区间里 —— 只查范围的话，说明会悄悄指向另一步棋而
       校验门全绿。这是全套里唯一保留的一致性检查。 */
    T.eq(C.moveToSAN(parsed.positions[k.ply - 1], parsed.moves[k.ply - 1]), k.san,
         at + 'keyMove@' + k.ply + ' 指向的仍然是它当初标注的那一步');
  }
}

// ---- 学习路线 ----
// 静态一致性：路线只引用清单里的 id，与填了几局无关（硬门）。
// 「真的加载出来了」这件事由下面的 missing 打印覆盖，不在这里当失败判据，
// 否则学习路线里排在后面、还没填的棋局会跟「填了几局」这件事混在一起。
for (const id of G.LEARNING_ROUTE) {
  T.ok(G.EXPECTED_IDS.indexOf(id) >= 0, '学习路线里的 ' + id + ' 在预期清单里');
}
T.eq(G.LEARNING_ROUTE[0], 'fools-mate', '路线从最短的将死开始');
// 判空不是形式主义：这一行如果直接解引用，恰好是路线第一站的 id 被拼错时
// 会抛未捕获 TypeError，在 T.report() 之前崩掉 —— 于是本轮所有已缓冲的
// FAIL（包括那几条精确指出「id 不在清单里」的）一条都印不出来，只剩堆栈。
// 门照样是红的，但它不再说明哪里红 —— 而说明哪里红正是它存在的理由。
const first = G.byId[G.LEARNING_ROUTE[0]];
T.ok(first, '学习路线第一站 ' + G.LEARNING_ROUTE[0] + ' 已载入');
if (first) T.eq(first.difficulty, 1, '第一站必须是 difficulty 1');

// ---- 分组与总表一致 ----
let sum = 0;
for (const k of G.GROUP_ORDER) {
  T.ok(Array.isArray(G.GROUPS[k]), k + ' 是一个数组');
  T.ok(G.GROUP_LABEL[k] && G.GROUP_LABEL[k].en && G.GROUP_LABEL[k].zh, k + ' 有双语标签');
  T.ok(G.GROUPS[k].every(g => g.group === k), k + ' 里每一局的 group 字段都对得上');
  sum += G.GROUPS[k].length;
}
T.eq(sum, G.GAMES.length, '分组之和等于总表');

// ---- 集齐了没有：里程碑，不是正确性判据 ----
// 建设期这里必然还没集齐，而让它拖红整个 check.py 会把 chess/ 下所有无关
// 提交一起拦住，于是这道门就会被绕过、被忽略——一道必然红的门等于没有门。
// 所以：不集齐不算失败，但每次都把还缺什么大声打印出来，不让它被悄悄忘掉。
const missing = G.EXPECTED_IDS.filter(id => !G.byId[id]);
if (missing.length) {
  console.log('\n⚠ 棋谱 ' + G.GAMES.length + '/' + G.EXPECTED_IDS.length +
              ' —— 还缺 ' + missing.length + ' 局：' + missing.join(' '));
} else {
  console.log('\n✓ 棋谱已集齐 ' + G.GAMES.length + '/' + G.EXPECTED_IDS.length);
}

T.report();
