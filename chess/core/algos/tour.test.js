'use strict';
const T = require('../_test.js');
const I = require('../interp.js');
const E = require('../exercise.js');
const D = require('./tour-dfs.js');
const W = require('./tour-warnsdorff.js');

// ---- 两份源码必须在子集里合法 ----
for (const [name, M] of [['dfs', D], ['warnsdorff', W]]) {
  let err = null;
  try { I.parse(M.source({ W: 3, H: 4, start: 0, lang: 'zh' })); } catch (e) { err = e; }
  T.ok(err === null, name + ' 的源码在子集里合法' + (err ? '：' + err.message : ''));
}

/* 巡游合法性：不能只看返回 true。一个「返回 true 但路径是错的」实现
   会骗过所有只看返回值的断言，而这正是学习者要照着学的东西。
   所以从 boardOps 里把路径重建出来，独立验证它真是一条巡游。

   重建的办法跟棋盘自己做的一模一样：**回放 place / clear，维护一张占位表**。
   place 把这一格压进当前路线，clear 把它撤下来 —— 被回溯放弃的分支于是自己
   消失，留在表上的就是真正走通的那条路线，顺序就是落子顺序。占位数第一次
   达到 W*H 的那一刻就是巡游完成的那一刻，拿那一刻的路线去验。

   （早先的版本只是把所有 place 事件按顺序收起来，那样就逼着算法「找到答案
   之后才落子」—— 一整局搜索里棋盘空着、马一步都不走，而这个工具的主题正是
   马在走。判分方式不该反过来规定算法长什么样。） */
function tourPath(src, W_, H_) {
  const stack = [];
  let snapshot = null, doublePlace = 0, strayClear = 0;
  I.run(src, { host: {
    mark: function () {},
    place: function (sq) {
      if (stack.indexOf(sq) >= 0) { doublePlace++; }
      stack.push(sq);
      if (stack.length === W_ * H_ && snapshot === null) { snapshot = stack.slice(); }
    },
    clear: function (sq) {
      const at = stack.lastIndexOf(sq);
      if (at < 0) { strayClear++; return; }
      stack.splice(at, 1);
    },
  } });
  return { path: snapshot || [], live: stack, doublePlace: doublePlace, strayClear: strayClear };
}
function isLegalTour(seq, W_, H_) {
  if (seq.length !== W_ * H_) { return 'length ' + seq.length + ' != ' + (W_ * H_); }
  const seen = {};
  for (const sq of seq) {
    if (seen[sq]) { return 'square ' + sq + ' visited twice'; }
    seen[sq] = 1;
  }
  for (let i = 1; i < seq.length; i++) {
    const ax = seq[i - 1] % W_, ay = (seq[i - 1] - ax) / W_;
    const bx = seq[i] % W_, by = (seq[i] - bx) / W_;
    const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
    if (!((dx === 1 && dy === 2) || (dx === 2 && dy === 1))) {
      return 'step ' + i + ' is not a knight move';
    }
  }
  return null;
}

// ---- 3×4 角起：两边都跑得完，且都给出合法巡游 ----
let legalChecked = 0;
for (const [name, M] of [['dfs', D], ['warnsdorff', W]]) {
  const src = M.source({ W: 3, H: 4, start: 0, lang: 'zh' });
  const r = I.run(src, { host: {} });
  T.ok(!r.trace.truncated, '3x4 ' + name + ' 未截断');
  T.eq(r.result, true, '3x4 ' + name + ' 找到巡游');
  const rebuilt = tourPath(src, 3, 4);
  const why = isLegalTour(rebuilt.path, 3, 4);
  T.ok(why === null, '3x4 ' + name + ' 的路径是一条合法巡游' + (why ? '：' + why : ''));
  T.eq(rebuilt.doublePlace, 0, '3x4 ' + name + ' 没有把马摆到一个已经有马的格子上');
  T.eq(rebuilt.strayClear, 0, '3x4 ' + name + ' 没有 clear 过一个本来就没有马的格子');
  T.eq(rebuilt.live.length, 12,
       '3x4 ' + name + ' 跑完之后 12 匹马留在盘上 —— 那一盘马就是答案本身');
  legalChecked++;
}
T.eq(legalChecked, 2, '两份实现都验过合法性');

/* ---- 马必须**边搜边走**，不许攒到最后一次性摆出来 ----

   这是上面 tourPath 那段注释的另一半，而且必须是一条独立的断言：只验
   「路线合法」的话，一个「搜索全程盘上空着、找到之后才把 12 匹马一次摆完」
   的实现照样全绿 —— 而它把这个工具的主题（马在走）整个删掉了。
   所以直接量落子在轨迹上的分布：第一次落子要发生在开头，最后一次要离第一次
   很远。攒到最后的实现会把两者挤在轨迹尾巴上，这两条同时红。 */
function placeTiming(M, W_, H_) {
  const tr = I.run(M.source({ W: W_, H: H_, start: 0, lang: 'zh' }), { host: {} }).trace;
  let first = -1, last = -1, places = 0, clears = 0;
  for (let i = 0; i < tr.length; i++) {
    for (const op of tr[i].boardOps) {
      if (op.kind === 'place') { places++; if (first < 0) { first = i; } last = i; }
      else if (op.kind === 'clear') { clears++; }
    }
  }
  return { n: tr.length, first: first, last: last, places: places, clears: clears };
}
for (const [name, M] of [['dfs', D], ['warnsdorff', W]]) {
  const p = placeTiming(M, 3, 4);
  T.ok(p.first >= 0 && p.first < p.n / 10,
       '3x4 ' + name + ' 第一步就落子（第 ' + p.first + ' / ' + p.n + ' 步）');
  T.ok(p.last - p.first > p.n / 2,
       '3x4 ' + name + ' 落子铺满整段搜索，不是攒在最后（跨 ' +
       (p.last - p.first) + ' / ' + p.n + ' 步）');
}

// ---- 四段弧线：这是这一题的全部内容 ----
function steps(M, W_, H_) {
  return I.run(M.source({ W: W_, H: H_, start: 0, lang: 'zh' }), { host: {} }).trace;
}
// 第一段 3×4：朴素的反而更便宜 —— 启发式的代价在小盘上收不回来
const d34 = steps(D, 3, 4), w34 = steps(W, 3, 4);
T.ok(d34.length < w34.length,
     '3x4：朴素 DFS 比 Warnsdorff 便宜（' + d34.length + ' < ' + w34.length + '）');

// 第二段 4×5：朴素的撞墙，启发式从容
const d45 = steps(D, 4, 5), w45 = steps(W, 4, 5);
T.eq(d45.truncated, true, '4x5：朴素 DFS 撞上 STEP_LIMIT');
T.ok(!w45.truncated, '4x5：Warnsdorff 跑得完（' + w45.length + ' 步）');

// 第三段 3×7：连启发式也失败 —— 它不是保证
const w37 = steps(W, 3, 7);
T.eq(w37.truncated, true, '3x7：Warnsdorff 也撞墙 —— 启发式不保证');

/* 第四段 3×5：这块盘上**根本没有巡游**，而两边都能诚实地把这件事查完。
   3×4 上两份算法一次都不回溯（实测 back = 0），4×5 / 3×7 上撞墙的那一份
   永远跑不到结论 —— 于是「回溯撤销」这个状态和「查遍了，确实没有」这个
   结局，只有 3×5 演得出来。它是第四个滑杆位置存在的全部理由。 */
const d35 = steps(D, 3, 5), w35 = steps(W, 3, 5);
T.ok(!d35.truncated && !w35.truncated,
     '3x5：两边都跑得完（' + d35.length + ' / ' + w35.length + ' 步）');
for (const [name, M] of [['dfs', D], ['warnsdorff', W]]) {
  const r = I.run(M.source({ W: 3, H: 5, start: 0, lang: 'zh' }), { host: {} });
  T.eq(r.result, false, '3x5 ' + name + '：查遍了，这块盘上没有巡游');
  const rebuilt = tourPath(M.source({ W: 3, H: 5, start: 0, lang: 'zh' }), 3, 5);
  T.eq(rebuilt.live.length, 0, '3x5 ' + name + '：跑完盘上一匹马都不剩，全退回去了');
  T.eq(rebuilt.strayClear, 0, '3x5 ' + name + '：没有 clear 过一个本来就没有马的格子');
  const p = placeTiming(M, 3, 5);
  T.ok(p.places > 0 && p.clears > 0,
       '3x5 ' + name + '：马真的走了也真的退了（place ' + p.places +
       ' / clear ' + p.clears + '）—— 这一条是「回溯撤销」那个状态的唯一见证');
  T.eq(p.places, p.clears, '3x5 ' + name + '：每一次落子最后都被收了回去');
}

/* ---- 3×5：两边的**棋盘事件逐 kind 相同**，只有步数不同 ----

   这是整个阶段最干净的一份教学素材，而在这条断言写下来之前没有任何测试钉住它：
   同一块盘、同一个起点，Warnsdorff 与朴素 DFS 落在棋盘上的事件**一件不多一件不少**
   —— try / ok / cut / back 四种标记逐项相等，place 与 clear 也逐项相等 ——
   唯一的差别是解释器步数（实测 34,988 vs 120,650）。也就是说：这一档上启发式
   一寸便宜都没占到，多出来的八万多步**全部**是它自己那套 degree() + 排序的开销。
   「启发式的代价」在这里被单独隔离出来，其它一切变量都被摁住了。

   这件事是**涌现**出来的，不是哪一份源码写死的：3×5 上根本没有巡游，两边都得把
   整棵树查遍，只是查的顺序不同。任何一次改动只要让某一边的剪枝变强/变弱，这条
   就会红——它正是要在那时候红。

   ⚠ 但要说清这条断言**称的是什么**：`T.eq(t35w.ops, t35d.ops)` 比的是
   `boardTally` 攒出来的**逐 kind 聚合计数**（try / ok / cut / back / place / clear
   各几次），**不是逐格事件的多重集**。也就是说「同样是 1,019 次 try，但两边 try
   的格子不完全一样」今天会照常通过。上面那句「事件逐项相同」讲的是 kind 这一项。
   强化成逐格多重集是下一阶段的事，别把这条断言读成它已经做到了。

   写成逐项比较而不是写死 1,019 / 395 / 624 / 395：**要钉的是「两边相等」这件事**，
   数字本身是它的后果。写死了反而会在无关的实现调整上误报。步数那一条只断言
   「不相等」，同理——它多出来多少不是重点，重点是它确实多花了钱。 */
function boardTally(M, W_, H_) {
  const r = I.run(M.source({ W: W_, H: H_, start: 0, lang: 'zh' }), { host: {} });
  const o = { try: 0, ok: 0, cut: 0, back: 0, place: 0, clear: 0 };
  for (let i = 0; i < r.trace.length; i++) {
    for (const op of r.trace[i].boardOps) {
      if (op.kind === 'mark') { o[op.to] = (o[op.to] || 0) + 1; }
      else { o[op.kind] = (o[op.kind] || 0) + 1; }
    }
  }
  return { ops: o, steps: r.trace.length, truncated: !!r.trace.truncated };
}
const t35d = boardTally(D, 3, 5), t35w = boardTally(W, 3, 5);
T.ok(!t35d.truncated && !t35w.truncated,
     '3x5：这条对比只有在两边都跑完时才成立（截断的轨迹比的是「谁先撞墙」）');
T.ok(t35d.ops.try > 0 && t35d.ops.back > 0,
     '3x5：棋盘事件计数没有空转（try ' + t35d.ops.try + ' / back ' + t35d.ops.back + '）');
T.eq(t35w.ops, t35d.ops,
     '3x5：两边落在棋盘上的事件逐 kind 相同 —— 启发式一寸便宜都没占到（' +
     JSON.stringify(t35d.ops) + '）');
T.ok(t35w.steps > t35d.steps,
     '3x5：唯一的差别是步数，而且贵的是启发式那一边（' +
     t35d.steps + ' → ' + t35w.steps + '）—— 那个差价就是 degree() + 排序的全部开销');

/* ======== 以下三段是简报之外补的，不改上面任何一条 ======== */

/* ---- 缺参数当场抛（阶段 5 约束 6：省略参数已经是本仓库抓到过三次的缺陷类）----

   ⚠ **这一组故意一个 `lang` 都不传，而且每条都带第三参 pattern。** 两件事
   缺一不可，合起来这一组才同时是**校验顺序**那道门：`source()` 自身那三个
   参数的校验在最前、`lang` 由 render() 在最后校验 —— 所以一个只给了
   H / start 的调用撞上的必须仍旧是「少了 W」。

   补上 `lang: 'zh'` 这一组就对 lang 的位置**完全失明**：'zh' 是合法值，
   lang 校验排在前排在后都照样落到参数那一条、抛同一句话、pattern 照样匹上
   （Task 4 在 knight-path 上实测过同一件事）。留着 pattern 为 undefined 也
   一样：那退化成「抛了就算过」，抛的是哪一条根本没人问。

   pattern 之间不许共享前缀（阶段 7 栽过：三条消息同前缀，一个正则匹到每一条，
   等于没钉是哪一条）。这里六条分成四个互斥的形状：少了 W / 少了 H /
   少了 start / X 必须是，实测把任一条的 pattern 换到邻居身上都会红。 */
for (const [name, M] of [['dfs', D], ['warnsdorff', W]]) {
  T.throws(function () { M.source({ H: 4, start: 0 }); }, name + '：缺 W 当场抛', /少了 W/);
  T.throws(function () { M.source({ W: 3, start: 0 }); }, name + '：缺 H 当场抛', /少了 H/);
  T.throws(function () { M.source({ W: 3, H: 4 }); }, name + '：缺 start 当场抛', /少了 start/);
  T.throws(function () { M.source(); }, name + '：连 opts 都没有也当场抛', /少了 W/);
  T.throws(function () { M.source({ W: 3, H: 4, start: 12 }); }, name + '：start 越界当场抛', /start 必须是/);
  T.throws(function () { M.source({ W: 3.5, H: 4, start: 0 }); }, name + '：W 不是整数当场抛', /W 必须是/);
  // 但**不**校验「跑不跑得完」：撞墙那两格正是要生成出来跑给她看的。
  let err = null;
  try { M.source({ W: 3, H: 7, start: 0, lang: 'zh' }); } catch (e) { err = e; }
  T.ok(err === null, name + '：明知会撞墙的 3x7 照常吐源码');
}

/* ---- 两份源码除了「选下一步」之外逐字相同 ----

   §4⑤ 的落点是「两份可以逐行对比的源码」并排显示。这件事今天只靠两个
   文件头里的一句叮嘱守着，是人肉门 —— 而人肉门在这个仓库里已经漏过。
   这里把它变成机器门：剥掉注释与空行之后，**朴素那份的每一行代码都必须
   按原顺序出现在 Warnsdorff 那份里**（后者只是多了 degree() 与排序）。
   比子序列而不是比行数，是为了不让改一句注释、加一行说明就误报。

   ⚠ **两种语言各跑一次**（阶段 8）。这道门守的是「多出来的那一段就是
   Warnsdorff」这件事本身，而这个工具**默认英文界面** —— 英文读者看到的
   那两份源码之间要是没有这个对照关系，这一题就没有了。断言消息里带上
   lang，否则红了看不出是哪一侧。 */
function codeLines(src) {
  const out = [];
  let inBlock = false;
  for (const raw of src.split('\n')) {
    let s = raw;
    if (inBlock) {
      const end = s.indexOf('*/');
      if (end < 0) { continue; }
      s = s.slice(end + 2); inBlock = false;
    }
    const open = s.indexOf('/*');
    if (open >= 0 && s.indexOf('*/', open) < 0) { inBlock = true; s = s.slice(0, open); }
    s = s.trim();
    if (s === '' || s.slice(0, 2) === '//') { continue; }
    out.push(raw);
  }
  return out;
}
function subsequenceGate(lang) {
  const tag = '[' + lang + '] ';
  const dCode = codeLines(D.source({ W: 3, H: 4, start: 0, lang: lang }));
  const wCode = codeLines(W.source({ W: 3, H: 4, start: 0, lang: lang }));
  T.ok(dCode.length > 40,
       tag + '剥注释之后还剩得下代码（' + dCode.length + ' 行），这道门没有空转');
  let cursor = 0, missing = null;
  for (const lineText of dCode) {
    let j = cursor;
    while (j < wCode.length && wCode[j] !== lineText) { j++; }
    if (j >= wCode.length) { missing = lineText; break; }
    cursor = j + 1;
  }
  T.ok(missing === null,
       tag + '朴素那份的每一行代码都逐字出现在 Warnsdorff 那份里' +
       (missing === null ? '' : '，最先对不上的是：' + missing));
  T.ok(wCode.length > dCode.length,
       tag + 'Warnsdorff 确实多出了代码（' + dCode.length + ' → ' + wCode.length + ' 行）');
}
['zh', 'en'].forEach(subsequenceGate);

/* ---- 双语三道门 × 两份（规格 §7.5）----

   守的是「可执行代码没有偷偷分岔」，**不是**「英文翻得对不对」——后者机器
   判不了，是人工审查项。 */
const TOUR_SRC = { dfs: D, warnsdorff: W };
for (const key of Object.keys(TOUR_SRC)) {
  const mod = TOUR_SRC[key];
  const zh = mod.source({ W: 5, H: 5, start: 0, lang: 'zh' });
  const en = mod.source({ W: 5, H: 5, start: 0, lang: 'en' });
  T.eq(en.split('\n').length, zh.split('\n').length, key + '：两种语言行数相同');
  T.eq(T.normalizeSource(en), T.normalizeSource(zh),
       key + '：抽掉注释与字符串之后，两种语言逐字节相同');
  T.eq(I.run(en, { host: {} }).trace.length, I.run(zh, { host: {} }).trace.length,
       key + '：两种语言的解释器步数相同');

  /* 反向：英文必须真的是英文。上面三道门在「en 原样返回中文」时全绿 ——
     把 lang 接进来却没接上，长得跟接上了一模一样。

     ⚠ 判「有没有中文」的字符类要连中文标点一起管：只写 /[一-鿿]/ 的话
     `「」。，？、《》；：` 全是 false，一句 "Start the tour here。" 会大摇
     大摆过门。

     ⚠ 「英文里没有汉字」断言的是**送进编辑器的那一份**（parse().clean）：
     BLANK 指令行不翻译（它本来就同时带着 hint 与 hintEn），那句中文 hint
     必然把汉字留在英文变体的原文里，而那一行根本不是读者读的东西。
     tour-dfs 一个挖空都没有，两份仍旧都走 clean —— 同一件事只留一种写法。

     ⚠ 剥指令行**只许问 parse()，不许自己写一个**：queens.test.js 里原先那个
     本地 readerFacing() 实测就已经跟 parse() 分岔了，修复轮删掉了。 */
  T.ok(zh !== en, key + '：两种语言的源码不是同一份');
  T.ok(/[一-鿿㐀-䶿　-〿＀-￯]/.test(zh), key + '：中文那一份里有汉字');
  T.ok(!/[一-鿿㐀-䶿　-〿＀-￯]/.test(E.parse(en, 'en').clean),
       key + '：英文那一份送到编辑器的文本里一个汉字都没有');

  /* ⚠ 第三个参数才是 pattern：`T.throws(fn, label, pattern)`（见 _test.js）。
     写在第二个位置上 pattern 就是 undefined，退化成「抛了就算过」——
     这两条要钉的恰恰是**抛的是哪一条**（少了 lang vs 只认两个值）。 */
  T.throws(function () { mod.source({ W: 5, H: 5, start: 0 }); },
           key + '：缺 lang 必须抛', /少了 lang/);
  T.throws(function () { mod.source({ W: 5, H: 5, start: 0, lang: 'fr' }); },
           key + '：lang=fr 必须抛', /只认/);
  T.throws(function () { mod.source({ W: 5, H: 5, start: 0, lang: '' }); },
           key + '：lang 是空串必须抛（空串不当默认值用）', /只认/);
}

/* ---- hintEn 真的是英文 ----

   tour-warnsdorff 的那一个挖空（degree-fn）的 hintEn 是她在提示面板第 1 级
   读到的原文，而这个工具**默认英文界面**。上面所有门对 hintEn 的内容一句话
   都没说：把 hintEn 整段换成中文，那些门全绿放行 —— 指令行在两语间逐字节
   相同、normalizeSource 把整行当注释抽掉、parse().clean 又把整行剥掉。
   拿 parse().blanks 的结构去断言，不自己解析指令行（同上一段的理由）。 */
const twBlanksEn = E.parse(W.source({ W: 3, H: 4, start: 0, lang: 'en' }), 'en').blanks;
T.eq(twBlanksEn.length, 1, 'parse() 在 Warnsdorff 的英文变体里认出一个挖空');
let hintEnChecked = 0;
for (const b of twBlanksEn) {
  T.ok(!/[一-鿿㐀-䶿　-〿＀-￯]/.test(b.hint.en), b.id + ' 的 hintEn 里一个汉字都没有');
  T.ok(/[一-鿿㐀-䶿　-〿＀-￯]/.test(b.hint.zh), b.id + ' 的 hint（中文那一支）里有汉字');
  hintEnChecked++;
}
T.eq(hintEnChecked, 1, 'degree-fn 的 hintEn 真的查过（这条防上面那个循环空转）');

/* 下面这两行是**挑出**指令行，不是剥掉 —— parse() 没有对应 API（它只吐
   blanks / clean / placeholder，不吐原始指令行），所以本地选择器保留。
   别照着这两行再写一个「剥」的：剥要用 parse().clean，理由见上面。 */
const twZh34 = W.source({ W: 3, H: 4, start: 0, lang: 'zh' });
const twEn34 = W.source({ W: 3, H: 4, start: 0, lang: 'en' });
const pick = function (src) {
  return src.split('\n').filter(function (l) { return l.trim().indexOf('// >>> BLANK') === 0; });
};
T.eq(pick(twEn34).length, 1, '英文变体里有一条 BLANK 指令（degree-fn）');
T.eq(pick(twEn34), pick(twZh34), 'BLANK 指令行在两种语言下逐字节相同 —— parse() 一点不用改');

T.report();
