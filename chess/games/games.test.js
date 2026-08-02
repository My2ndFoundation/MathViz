'use strict';
const T = require('../core/_test.js');
const C = require('../core/chess-core.js');
const G = require('./games.js');

const RESULTS = ['1-0', '0-1', '1/2-1/2'];

/* 这个数字是一道刻意的绊索：以后加一局棋会让它失败，逼你回来把它改成 31。
   加棋谱是要过脑子的事（新的一局要有故事、要有来源、要进不进学习路线），
   不该悄悄溜进清单。 */
const EXPECTED_GAME_COUNT = 30;
T.eq(G.GAMES.length, EXPECTED_GAME_COUNT, '一共 30 局（规格 §6.2）');
T.eq(G.LEARNING_ROUTE.length, 11, '学习路线 11 站（规格 §6.3）');

const seen = {};
for (const g of G.GAMES) {
  const at = g.id + ': ';

  // ---- 标识与分类 ----
  T.ok(/^[a-z0-9-]+$/.test(g.id), at + 'id 是小写连字符');
  T.ok(!seen[g.id], at + 'id 不重复');
  seen[g.id] = 1;
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
for (const id of G.LEARNING_ROUTE) T.ok(!!G.byId[id], '学习路线里的 ' + id + ' 是存在的棋局');
T.eq(G.LEARNING_ROUTE[0], 'fools-mate', '路线从最短的将死开始');
T.eq(G.byId[G.LEARNING_ROUTE[0]].difficulty, 1, '第一站必须是 difficulty 1');

// ---- 分组与总表一致 ----
let sum = 0;
for (const k of G.GROUP_ORDER) {
  T.ok(Array.isArray(G.GROUPS[k]), k + ' 是一个数组');
  T.ok(G.GROUP_LABEL[k] && G.GROUP_LABEL[k].en && G.GROUP_LABEL[k].zh, k + ' 有双语标签');
  T.ok(G.GROUPS[k].every(g => g.group === k), k + ' 里每一局的 group 字段都对得上');
  sum += G.GROUPS[k].length;
}
T.eq(sum, G.GAMES.length, '分组之和等于总表');

T.report();
