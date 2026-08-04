'use strict';
const T = require('../_test.js');
const I = require('../interp.js');
const D = require('./tour-dfs.js');
const W = require('./tour-warnsdorff.js');

// ---- 两份源码必须在子集里合法 ----
for (const [name, M] of [['dfs', D], ['warnsdorff', W]]) {
  let err = null;
  try { I.parse(M.source({ W: 3, H: 4, start: 0 })); } catch (e) { err = e; }
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
  const src = M.source({ W: 3, H: 4, start: 0 });
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
  const tr = I.run(M.source({ W: W_, H: H_, start: 0 }), { host: {} }).trace;
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
  return I.run(M.source({ W: W_, H: H_, start: 0 }), { host: {} }).trace;
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
  const r = I.run(M.source({ W: 3, H: 5, start: 0 }), { host: {} });
  T.eq(r.result, false, '3x5 ' + name + '：查遍了，这块盘上没有巡游');
  const rebuilt = tourPath(M.source({ W: 3, H: 5, start: 0 }), 3, 5);
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
  const r = I.run(M.source({ W: W_, H: H_, start: 0 }), { host: {} });
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

// ---- 缺参数当场抛（阶段 5 约束 6：省略参数已经是本仓库抓到过三次的缺陷类）----
for (const [name, M] of [['dfs', D], ['warnsdorff', W]]) {
  T.throws(function () { M.source({ H: 4, start: 0 }); }, name + '：缺 W 当场抛');
  T.throws(function () { M.source({ W: 3, start: 0 }); }, name + '：缺 H 当场抛');
  T.throws(function () { M.source({ W: 3, H: 4 }); }, name + '：缺 start 当场抛');
  T.throws(function () { M.source(); }, name + '：连 opts 都没有也当场抛');
  T.throws(function () { M.source({ W: 3, H: 4, start: 12 }); }, name + '：start 越界当场抛');
  T.throws(function () { M.source({ W: 3.5, H: 4, start: 0 }); }, name + '：W 不是整数当场抛');
  // 但**不**校验「跑不跑得完」：撞墙那两格正是要生成出来跑给她看的。
  let err = null;
  try { M.source({ W: 3, H: 7, start: 0 }); } catch (e) { err = e; }
  T.ok(err === null, name + '：明知会撞墙的 3x7 照常吐源码');
}

/* ---- 两份源码除了「选下一步」之外逐字相同 ----

   §4⑤ 的落点是「两份可以逐行对比的源码」并排显示。这件事今天只靠两个
   文件头里的一句叮嘱守着，是人肉门 —— 而人肉门在这个仓库里已经漏过。
   这里把它变成机器门：剥掉注释与空行之后，**朴素那份的每一行代码都必须
   按原顺序出现在 Warnsdorff 那份里**（后者只是多了 degree() 与排序）。
   比子序列而不是比行数，是为了不让改一句注释、加一行说明就误报。 */
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
const dCode = codeLines(D.source({ W: 3, H: 4, start: 0 }));
const wCode = codeLines(W.source({ W: 3, H: 4, start: 0 }));
T.ok(dCode.length > 40, '剥注释之后还剩得下代码（' + dCode.length + ' 行），这道门没有空转');
let cursor = 0, missing = null;
for (const lineText of dCode) {
  let j = cursor;
  while (j < wCode.length && wCode[j] !== lineText) { j++; }
  if (j >= wCode.length) { missing = lineText; break; }
  cursor = j + 1;
}
T.ok(missing === null,
     '朴素那份的每一行代码都逐字出现在 Warnsdorff 那份里' +
     (missing === null ? '' : '，最先对不上的是：' + missing));
T.ok(wCode.length > dCode.length,
     'Warnsdorff 确实多出了代码（' + dCode.length + ' → ' + wCode.length + ' 行）');

T.report();
