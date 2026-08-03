'use strict';
const T = require('./_test.js');
const I = require('./interp.js');
const D = require('./debugger.js');
const TM = require('./tree-model.js');
const ALGO = require('./algos/minimax.js');

/* 用真实解释器轨迹做 fixture。手搓假 trace 会悄悄偏离真实形状，
   而这个模块的全部正确性都建立在「真实轨迹长什么样」上——3b 的
   词法器审查正是靠「拿原生 JS 当参照」抓出 5 条 Critical 的。 */
const SRC = ALGO.source({ mode: 'plain', depth: 2 });
const trace = I.run(SRC, { host: {} }).trace;
T.ok(!trace.truncated, '前提：depth 2 的纯 minimax 不会截断');

const tree = TM.build(trace, 'search');

// ---- 根 ----
T.ok(tree.rootId >= 0, '有根节点');
const root = TM.nodeAt(tree, tree.rootId);
T.eq(root.parentId, -1, '根没有父节点');
T.eq(root.depth, 0, '根的搜索深度是 0');

// ---- 节点 id 就是 push 步下标（约束 1）----
for (const id of tree.order) {
  T.eq(trace[id].frameOp, 'push', 'id ' + id + ' 指向一个 push 步');
  T.eq(trace[id].frameName, 'search', 'id ' + id + ' 指向的是 search 帧');
}
T.ok(tree.order.length > 3, '树里不止一个节点（否则下面的断言都是空转）');

// ---- 父子关系与调用栈一致 ----
/* 对每个节点，用调试器把游标移到它的 push 步，读 callStack/frameIds，
   验证树里的父链与运行时栈里的 search 帧序列**逐项相同**。
   这是拿一个独立参照对拍，而不是自己跟自己对。 */
const cur = D.create(trace);
let checked = 0;
for (const id of tree.order) {
  D.goto(cur, id);
  const stack = D.callStack(cur);
  const ids = D.frameIds(cur);
  const runtimeSearchIds = [];
  for (let k = 0; k < stack.length; k++) {
    if (stack[k].name === 'search') { runtimeSearchIds.push(ids[k]); }
  }
  const modelChain = [];
  let n = TM.nodeAt(tree, id);
  while (n) { modelChain.unshift(n.id); n = n.parentId < 0 ? null : TM.nodeAt(tree, n.parentId); }
  T.eq(modelChain, runtimeSearchIds, '节点 ' + id + ' 的父链与运行时调用栈一致');
  checked++;
}
T.ok(checked >= 4, '父链对拍至少跑了 4 个节点，不是空转');

// ---- 搜索深度逐层加一 ----
for (const id of tree.order) {
  const n = TM.nodeAt(tree, id);
  if (n.parentId < 0) { continue; }
  T.eq(n.depth, TM.nodeAt(tree, n.parentId).depth + 1, '子节点深度 = 父 + 1');
}

// ---- childIds 与 parentId 互为反向 ----
for (const id of tree.order) {
  for (const c of TM.nodeAt(tree, id).childIds) {
    T.eq(TM.nodeAt(tree, c).parentId, id, 'childIds 与 parentId 互相对得上');
  }
}

// ---- 越界 / 空输入不抛 ----
T.ok(TM.nodeAt(tree, 999999) === null, '不存在的 id 返回 null');
const empty = TM.build(I.run('', { host: {} }).trace, 'search');
T.eq(empty.order, [], '空轨迹建出空树');
T.eq(empty.rootId, -1, '空树没有根');

/* ==================== 以下是 brief 之外补充的断言 ====================
   brief 的测试把**结构**（id、父链、深度、childIds）钉得很死，但 Node 上
   另外五个字段（pushStep / popStep / mvCount / value / alpha / beta / white）
   一条都没测到——而任务 3、4 的整棵可视化正是画它们。没有断言的字段等于
   没有的字段，所以这里补上，全部拿**独立参照**对拍，不写手算期望值。 */

// ---- 规则 2 的反证：树深比 Step.depth 浅，谁拿 Step.depth 当树深谁当场错 ----
/* 这不是凑数的断言，是这个模块存在的理由本身：genMoves / onBoard / evaluate
   的帧也压在同一个栈上，把 Step.depth 顶得比树深高。 */
let maxTreeDepth = 0;
for (const id of tree.order) { maxTreeDepth = Math.max(maxTreeDepth, TM.nodeAt(tree, id).depth); }
let maxStepDepth = 0;
for (const s of trace) { maxStepDepth = Math.max(maxStepDepth, s.depth); }
T.ok(maxStepDepth > maxTreeDepth,
  '树深(' + maxTreeDepth + ') 严格小于 Step.depth 的最大值(' + maxStepDepth + ')');

// ---- 每个节点恰好被自己的父亲认领一次；order 是 id 升序 ----
let childTotal = 0;
for (const id of tree.order) { childTotal += TM.nodeAt(tree, id).childIds.length; }
T.eq(childTotal, tree.order.length - 1, '除根之外每个节点恰好是某个父亲的一个孩子');
for (let k = 1; k < tree.order.length; k++) {
  T.ok(tree.order[k] > tree.order[k - 1], 'order 按 id 升序（= 入帧的时间顺序）');
}

// ---- pushStep / popStep ----
for (const id of tree.order) {
  const n = TM.nodeAt(tree, id);
  T.eq(n.pushStep, n.id, 'pushStep 就是 id');
  T.ok(n.popStep === -1 || n.popStep > n.pushStep, '出帧步在入帧步之后（或 -1 表示没关闭）');
  if (n.popStep >= 0) {
    T.eq(trace[n.popStep].frameOp, 'pop', 'popStep 指向一个 pop 步');
    T.eq(trace[n.popStep].frameName, 'search', 'popStep 指向的是 search 帧');
  }
}

// ---- white 逐层取反 ----
for (const id of tree.order) {
  const n = TM.nodeAt(tree, id);
  if (n.parentId < 0) { continue; }
  T.eq(n.white, !TM.nodeAt(tree, n.parentId).white, '轮到谁走逐层取反');
}

/* ---- value：拿两个独立参照对拍 ----
   ① 根的 value 必须等于**解释器自己**跑出来的返回值（run().result）——
      这是完全独立于本模块的一条参照。
   ② 每个有孩子的节点，value 必须等于它孩子们 value 的极大/极小 ——
      也就是拿这棵树**重算一遍 minimax**。value 读错一个、或者父子挂错一处，
      这条都会当场炸。 */
const RESULT = I.run(SRC, { host: {} }).result;
T.eq(TM.nodeAt(tree, tree.rootId).value, RESULT, '根的 value = 解释器跑出来的返回值');
/* checkMinimax 必须**自己**先把 null 挡掉，不能只靠外面那一遍 value 扫描：
   `Math.max.apply(null, [null, -100])` 是 0（null 被强制成 0），一个读不到的
   叶子会被悄悄当成"0 分"，极值算出来照样是个像样的数字。所以这条 null 断言
   写在这里、跟着每一棵树跑，而不是只在 plain 那棵树上扫一遍。 */
function checkMinimax(tr, label) {
  for (const id of tr.order) {
    const n = TM.nodeAt(tr, id);
    T.ok(n.value !== null, label + '：节点 ' + id + ' 有 value（含当场返回的叶子）');
    if (!n.childIds.length) { continue; }
    const vs = n.childIds.map(function (c) { return TM.nodeAt(tr, c).value; });
    const want = n.white ? Math.max.apply(null, vs) : Math.min.apply(null, vs);
    T.eq(n.value, want, label + '：节点 ' + id + ' 的 value = 孩子们的' + (n.white ? '极大' : '极小'));
  }
}
checkMinimax(tree, 'plain');

/* ---- mvCount：纯 minimax 不剪枝，所以「有几个走法」就该「有几个孩子」 ----
   **只对读得到 mvCount 的节点成立。** `depth === 0` 那种当场
   `return evaluate(bd)` 的叶子根本没走到 `let ms`，mvCount 是 null ——
   那个局面**有**合法走法，只是搜索没去枚举，把它当 0 是假话。
   守卫之后必须数一下真的查了几个，否则这条断言可以靠"一个都没查"通过。 */
let mvChecked = 0;
for (const id of tree.order) {
  const n = TM.nodeAt(tree, id);
  T.eq(n.alpha, -99999, 'plain 从不收窄 alpha');
  T.eq(n.beta, 99999, 'plain 从不收窄 beta');
  if (n.popStep < 0 || n.mvCount === null) { continue; }
  T.eq(n.childIds.length, n.mvCount, 'plain 不剪枝：孩子数 = 走法数');
  mvChecked++;
}
T.ok(mvChecked > 0, 'mvCount 对拍不是空转（真的有节点读得到走法数）');
/* 反过来也要钉：读不到的那些必须**真的**是没走到 `let ms` 的叶子 ——
   没有孩子。若哪天一个有孩子的节点也读不到 mvCount，那是回归，不是叶子。 */
for (const id of tree.order) {
  const n = TM.nodeAt(tree, id);
  if (n.mvCount !== null) { continue; }
  T.eq(n.childIds.length, 0, '读不到 mvCount 的节点必然是没枚举过走法的叶子');
}

/* null 与数值的分界线，拿轨迹本身当独立参照：
   一个 search 帧要么走到 `let ms = genMoves(...)`（于是 mvCount 读得到），
   要么当场 `return evaluate(bd)`（于是读不到）——**二者必居其一**。
   所以「mvCount 读得到的节点数」必须恰好等于 genMoves 的入帧次数，
   「读不到的节点数」必须恰好等于 evaluate 的入帧次数。这条断言不依赖
   本模块的任何内部约定，只数轨迹里的帧。 */
const frameCalls = {};
for (const s of trace) {
  if (s.frameOp === 'push') { frameCalls[s.frameName] = (frameCalls[s.frameName] || 0) + 1; }
}
let mvKnown = 0, mvUnknown = 0;
for (const id of tree.order) {
  if (TM.nodeAt(tree, id).mvCount === null) { mvUnknown++; } else { mvKnown++; }
}
T.eq(mvKnown, frameCalls.genMoves, 'mvCount 读得到的节点数 = genMoves 的调用次数');
T.eq(mvUnknown, frameCalls.evaluate, 'mvCount 读不到的节点数 = evaluate 的调用次数');
T.eq(mvKnown + mvUnknown, tree.order.length, '每个节点非此即彼，没有第三种');

/* ---- 剪枝模式：mvCount 与 childIds 从此分家 ----
   这是任务 3「剪掉的分支」那一课的数据来源：mvCount 是本来要看的走法数，
   childIds 是**真的看了**的。两者之差就是被 `if (beta <= alpha) break;`
   砍掉的分支。plain 的 fixture 永远撞不到这条路径，所以必须另开一份。 */
for (const mode of ['ab', 'ordered']) {
  const t2 = TM.build(I.run(ALGO.source({ mode: mode, depth: 2 }), { host: {} }).trace, 'search');
  const r2 = TM.nodeAt(t2, t2.rootId);
  T.eq(r2.value, RESULT, mode + '：剪枝不改变答案（根的 value 与 plain 相同）');
  T.ok(t2.order.length < tree.order.length, mode + '：剪枝之后树上的节点比 plain 少');
  let cut = 0, cmp = 0;
  for (const id of t2.order) {
    const n = TM.nodeAt(t2, id);
    // 同样只比读得到的那些：`0 <= null` 在 JS 里是 true，不守卫就是在跟 0 比。
    if (n.mvCount === null) { continue; }
    T.ok(n.childIds.length <= n.mvCount, mode + '：真的看了的孩子不会多于走法数');
    cmp++;
    if (n.childIds.length < n.mvCount) { cut++; }
  }
  T.ok(cmp > 0, mode + '：走法数对拍不是空转');
  T.ok(cut > 0, mode + '：至少有一个节点真的被剪掉了分支（否则上一条是空转）');
  checkMinimax(t2, mode);
}

/* ---- 截断轨迹：帧永远不关闭，popStep 只能是 -1 ----
   depth 4 的纯 minimax 撞 STEP_LIMIT 是规格 §4④ 明写的那一课（「不是慢一点，
   是做不到」），所以这条路径一定会被真的走到，不是理论边角。 */
const cut4 = I.run(ALGO.source({ mode: 'plain', depth: 4 }), { host: {} }).trace;
T.ok(!!cut4.truncated, '前提：depth 4 的纯 minimax 会撞上步数上限');
const tCut = TM.build(cut4, 'search');
T.ok(tCut.order.length > 0, '截断的轨迹照样建得出树');
let openFrames = 0;
for (const id of tCut.order) {
  const n = TM.nodeAt(tCut, id);
  if (n.popStep !== -1) { continue; }
  openFrames++;
  T.ok(n.value === null, '没关闭的帧没有 value');
  /* mvCount 同样必须是 null 而不是 0：这一帧还没跑完，它有几个走法根本
     还没写进轨迹。0 会把"不知道"伪装成一个测量值。 */
  T.ok(n.mvCount === null, '没关闭的帧没有 mvCount（不是 0，是不知道）');
}
T.ok(openFrames > 0, '截断处栈上那几帧的 popStep 是 -1');
T.eq(TM.nodeAt(tCut, tCut.rootId).popStep, -1, '被截断时连根都没关闭');

/* ==================== 规则 2 的真正杀手锏（另开一份 fixture）====================

   上面 minimax 那份 fixture **测不出**「父亲按栈判定」这条规则：实测它每一个
   search 入帧步都满足 `Step.depth === 树深 + 1`（三种组合 1:0 / 2:1 / 3:2，
   无一例外）——因为 genMoves / evaluate / onBoard 全都在递归调用**之前**就
   已经返回了，入帧的那一刻栈上只剩 search 帧。「整条轨迹的 Step.depth 到 4
   而树只有 2 层」这句话是真的，但它顶高的是**别的步**，不是入帧步。
   于是「拿 Step.depth 推父亲」这个错误实现在那份 fixture 上照样全绿 ——
   实测过，970 条断言一条不响。

   所以这里另开一份 fixture：入口函数经由一个**中间帧**再次进入自己。

       function via(g, k) { return g(k); }
       function node(n) {
         if (n === 0) { return 1; }
         return node(n - 1) + via(node, n - 1);
       }

   同一个父亲的两个孩子，一个直接调用、一个隔着 via，Step.depth 因此差 1；
   兄弟之间深度不同、不同层之间深度撞车，两种坏法一次凑齐。这不是手搓的
   假轨迹，是同一个解释器跑同一个子集跑出来的真轨迹。

   这段代码也顺带覆盖了 3b 那个原始教训的形状：`a() + b()` 会在连续两步里
   产生同深度的一次 pop 和一次 push。 */
const HO_SRC = [
  'function via(g, k) { return g(k); }',
  'function node(n) {',
  '  if (n === 0) { return 1; }',
  '  return node(n - 1) + via(node, n - 1);',
  '}',
  'return node(2);',
].join('\n');
const hoRun = I.run(HO_SRC, { host: {} });
T.eq(hoRun.result, 4, '前提：这份 fixture 跑出 4（node(2) = node(1)*2 = 4）');
const hoTree = TM.build(hoRun.trace, 'node');
T.eq(hoTree.order.length, 7, '前提：7 个 node 帧（1 + 2 + 4）');

/* 前提断言：这份 fixture 真的把 Step.depth 和树深脱钩了。
   没有这一条，下面的对拍**可能又是空转**——正是上面那份 fixture 的教训。

   按 **parentId** 分组，不按树深分组：真正让深度推断崩掉的性质是
   「**同一个父亲**的两个孩子有不同的 Step.depth」——一个直接调用、一个
   隔着 via。按树深分组恰好也成立（今天是 {2:[2,3], 4:[3,4], 20:[4,5]}），
   但那只是顺带，措辞与所断言的东西对不上。 */
const bySibling = {};
for (const id of hoTree.order) {
  const p = TM.nodeAt(hoTree, id).parentId;
  (bySibling[p] = bySibling[p] || []).push(hoRun.trace[id].depth);
}
let decoupled = false;
for (const p of Object.keys(bySibling)) {
  const ds = bySibling[p];
  for (const x of ds) { if (x !== ds[0]) { decoupled = true; } }
}
T.ok(decoupled, '前提：同一个父亲的两个孩子拥有不同的 Step.depth（深度与树结构已脱钩）');

/* 与 brief 同一招：拿运行时调用栈当独立参照，逐项对拍父链。 */
const hoCur = D.create(hoRun.trace);
for (const id of hoTree.order) {
  D.goto(hoCur, id);
  const stack = D.callStack(hoCur);
  const ids = D.frameIds(hoCur);
  const runtimeIds = [];
  for (let k = 0; k < stack.length; k++) {
    if (stack[k].name === 'node') { runtimeIds.push(ids[k]); }
  }
  const chain = [];
  let n = TM.nodeAt(hoTree, id);
  while (n) { chain.unshift(n.id); n = n.parentId < 0 ? null : TM.nodeAt(hoTree, n.parentId); }
  T.eq(chain, runtimeIds, '隔着中间帧递归时，节点 ' + id + ' 的父链仍与运行时调用栈一致');
}

/* entryName 只认它自己那一种帧。换成 'via' 之后建出来的是**另一棵**树：
   3 个 via 帧（n > 0 的那 3 个 node 各调用一次），其中两个是顶层的
   （node(2) 和第一个 node(1) 各自的 via 之间没有嵌套关系），另一个嵌在
   `via → node → via` 里。这顺带钉住了实现注释里写的那条：轨迹里出现多个
   顶层 entry 帧时，rootId 取第一个，其余照常建节点、不悄悄丢掉。 */
const viaTree = TM.build(hoRun.trace, 'via');
T.eq(viaTree.order.length, 3, "entryName 换成 'via' 认得 3 个 via 帧");
let viaTops = 0;
for (const id of viaTree.order) {
  T.eq(hoRun.trace[id].frameName, 'via', 'via 树里的 id 指向 via 帧');
  if (TM.nodeAt(viaTree, id).parentId < 0) { viaTops++; }
}
T.eq(viaTops, 2, 'via 帧里有两个是顶层的');
T.eq(viaTree.rootId, viaTree.order[0], 'rootId 取第一个顶层帧');
T.eq(TM.build(hoRun.trace, 'nosuchfn').order, [], '认一个不存在的函数名建出空树');
T.eq(TM.build(hoRun.trace, 'nosuchfn').rootId, -1, '认不到就没有根');

// ============ 增量游标与剪枝 ============

const abSrc = ALGO.source({ mode: 'ab', depth: 3 });
const abTrace = I.run(abSrc, { host: {} }).trace;
T.ok(!abTrace.truncated, '前提：depth 3 的 α-β 不会截断');
const abTree = TM.build(abTrace, 'search');

// ---- 增量与全量必须给出同一个答案（这条是本任务的命脉）----
/* 增量推进最典型的坏法是「和全量算出来的不一样，但只在某些路径上」。
   拿全量重建当参照逐点对拍，而不是相信增量自己。 */
let mismatches = 0, sampled = 0;
const stride = Math.max(1, Math.floor(abTrace.length / 60));
const inc = TM.createView(abTree, abTrace);
for (let i = 0; i < abTrace.length; i += stride) {
  TM.seek(inc, i);                                   // 增量路径
  const fresh = TM.createView(abTree, abTrace);
  TM.seek(fresh, i);                                 // 全量路径（新 view，必然全量）
  if (JSON.stringify(TM.visibleAt(inc)) !== JSON.stringify(TM.visibleAt(fresh))) { mismatches++; }
  if (JSON.stringify(TM.spineAt(inc)) !== JSON.stringify(TM.spineAt(fresh))) { mismatches++; }
  sampled++;
}
T.eq(mismatches, 0, '增量推进与全量重建逐点一致');
T.ok(sampled >= 30, '对拍采样了至少 30 个游标位置');

// ---- 后退也要对（不能只在前进方向上正确）----
let backMismatch = 0;
for (let i = abTrace.length - 1; i >= 0; i -= stride) {
  TM.seek(inc, i);
  const fresh = TM.createView(abTree, abTrace);
  TM.seek(fresh, i);
  if (JSON.stringify(TM.visibleAt(inc)) !== JSON.stringify(TM.visibleAt(fresh))) { backMismatch++; }
}
T.eq(backMismatch, 0, '反向推进同样与全量一致');

// ---- 可见节点单调增长 ----
const grow = TM.createView(abTree, abTrace);
let prevLen = 0, grew = 0;
for (let i = 0; i < abTrace.length; i += stride) {
  TM.seek(grow, i);
  const len = TM.visibleAt(grow).length;
  T.ok(len >= prevLen, '可见节点数不随游标前进而减少（i=' + i + '）');
  if (len > prevLen) { grew++; }
  prevLen = len;
}
T.ok(grew >= 5, '可见节点确实在增长，不是恒为 0');

// ---- 剪枝：α-β 必须剪掉一些，纯 minimax 一个都不剪 ----
const abEnd = TM.createView(abTree, abTrace);
TM.seek(abEnd, abTrace.length - 1);
const abStats = TM.statsAt(abEnd);
T.ok(abStats.pruned > 0, 'α-β 到末尾时确实剪掉了分支：' + abStats.pruned);

const plainTrace = I.run(ALGO.source({ mode: 'plain', depth: 3 }), { host: {} }).trace;
T.ok(!plainTrace.truncated, '前提：depth 3 的纯 minimax 不截断');
const plainTree = TM.build(plainTrace, 'search');
const plainEnd = TM.createView(plainTree, plainTrace);
TM.seek(plainEnd, plainTrace.length - 1);
T.eq(TM.statsAt(plainEnd).pruned, 0, '纯 minimax 一个分支都不剪 —— 这是两个 tab 的全部区别');

// ---- α-β 访问的节点必须严格少于纯 minimax ----
T.ok(TM.statsAt(abEnd).visited < TM.statsAt(plainEnd).visited,
     'α-β 访问的节点更少：' + TM.statsAt(abEnd).visited + ' < ' + TM.statsAt(plainEnd).visited);

// ---- 截断轨迹：剪枝不可判定时不许报 0（约束 3）----
const cutTrace = I.run(ALGO.source({ mode: 'plain', depth: 4 }), { host: {} }).trace;
T.eq(cutTrace.truncated, true, '前提：depth 4 的纯 minimax 会截断');
const cutTree = TM.build(cutTrace, 'search');
const cutView = TM.createView(cutTree, cutTrace);
TM.seek(cutView, cutTrace.length - 1);
const cutStats = TM.statsAt(cutView);
T.eq(cutStats.truncated, true, '截断轨迹的 stats 要如实标出 truncated');
/* 截断时根本没跑完，「剪了多少」是不知道的。报一个数字就是编造，
   与 3a 拒绝编造「省略了 N 步」是同一条纪律。 */
T.ok(TM.nodeAt(cutTree, cutTree.rootId).popStep === -1, '根帧从未关闭 —— 截断的直接体现');

// ---- seek 越界与空树不抛 ----
const safe = TM.createView(TM.build(I.run('', { host: {} }).trace, 'search'), []);
for (const i of [-5, 0, 999999]) {
  let threw = false;
  try { TM.seek(safe, i); TM.visibleAt(safe); TM.spineAt(safe); TM.statsAt(safe); }
  catch (e) { threw = true; }
  T.ok(!threw, '空树上 seek(' + i + ') 不抛异常');
}

/* ==================== brief 之外补充的断言（游标部分）====================

   brief 的这一段有三个缺口，每一个都能让上面的断言在**错误的实现上照样全绿**：

   ① 对拍**可能是空转的**。增量与全量之所以能对拍，前提是那 60 次 seek 真的
      走了增量路径；阈值一旦小于采样步长（ab d3 的 stride 是 629），两边就都
      是全量，「增量与全量一致」这句话变成「全量与全量一致」。从外面看不出
      差别 —— 只能数重建次数。
   ② 反向那一圈**只对了 visibleAt**，spineAt / statsAt / prunedAt 一个没比。
      而「只在前进方向上正确」正是增量状态最典型的坏法，反向恰恰是重灾区。
   ③ 截断那一段只断言了 `truncated === true`，**没有断言剪枝报的是「未知」**
      —— 而那才是整个约束 3 的落点。注释里写着「报一个数字就是编造」，测试
      却允许它报数字。 */

// ---- ① 对拍不是空转：那 120 次 seek 里绝大多数真的走了增量 ----
/* createView 自己算一次 i=0 的状态（rebuilds → 1），第一次 seek 强制全量
   （→ 2），此后 60 次前进 + 60 次后退全部是 629 步的小跨度，必须一次都不
   再重建。若哪天阈值被调到 629 以下，这一条会立刻响。 */
T.eq(inc.rebuilds, 2, '命脉对拍里 120 次 seek 只全量重建了 2 次（其余走增量，对拍没空转）');
T.ok(stride > 1, '采样步长 > 1，增量路径确实跨了多步（stride=' + stride + '）');

// ---- ② 反向也要逐点比 spine / stats / pruned，不只比 visible ----
const back2 = TM.createView(abTree, abTrace);
TM.seek(back2, abTrace.length - 1);
let backAll = 0, backSamples = 0;
for (let i = abTrace.length - 1; i >= 0; i -= stride) {
  TM.seek(back2, i);
  const fresh = TM.createView(abTree, abTrace);
  TM.seek(fresh, i);
  if (JSON.stringify(TM.spineAt(back2)) !== JSON.stringify(TM.spineAt(fresh))) { backAll++; }
  if (JSON.stringify(TM.statsAt(back2)) !== JSON.stringify(TM.statsAt(fresh))) { backAll++; }
  if (JSON.stringify(TM.prunedAt(back2)) !== JSON.stringify(TM.prunedAt(fresh))) { backAll++; }
  backSamples++;
}
T.eq(backAll, 0, '反向推进时 spine / stats / pruned 同样与全量逐点一致');
T.ok(backSamples >= 30, '反向对拍采样了至少 30 个游标位置');
T.eq(back2.rebuilds, 2, '反向那一圈也确实走的增量');

/* 前进方向补上 stats / pruned（brief 只比了 visible 与 spine）。 */
const fwd2 = TM.createView(abTree, abTrace);
let fwdAll = 0;
for (let i = 0; i < abTrace.length; i += stride) {
  TM.seek(fwd2, i);
  const fresh = TM.createView(abTree, abTrace);
  TM.seek(fresh, i);
  if (JSON.stringify(TM.statsAt(fwd2)) !== JSON.stringify(TM.statsAt(fresh))) { fwdAll++; }
  if (JSON.stringify(TM.prunedAt(fwd2)) !== JSON.stringify(TM.prunedAt(fresh))) { fwdAll++; }
}
T.eq(fwdAll, 0, '前进方向的 stats / pruned 也与全量逐点一致');

/* 一步一步走完一整段（±1），与全量逐点对拍。stride 那种大跨度掩盖不了
   「跨过 1 步」这条最常用的路径 —— 面板上按一次「下一步」走的正是它。 */
let oneStep = 0;
const walk = TM.createView(abTree, abTrace);
const WALK_FROM = Math.floor(abTrace.length / 2), WALK_TO = WALK_FROM + 400;
TM.seek(walk, WALK_FROM);
for (let i = WALK_FROM; i <= WALK_TO; i++) {
  TM.seek(walk, i);
  const fresh = TM.createView(abTree, abTrace); TM.seek(fresh, i);
  if (JSON.stringify(TM.visibleAt(walk)) !== JSON.stringify(TM.visibleAt(fresh))) { oneStep++; }
  if (JSON.stringify(TM.spineAt(walk)) !== JSON.stringify(TM.spineAt(fresh))) { oneStep++; }
  if (JSON.stringify(TM.statsAt(walk)) !== JSON.stringify(TM.statsAt(fresh))) { oneStep++; }
}
for (let i = WALK_TO; i >= WALK_FROM; i--) {   // 再原路退回来
  TM.seek(walk, i);
  const fresh = TM.createView(abTree, abTrace); TM.seek(fresh, i);
  if (JSON.stringify(TM.visibleAt(walk)) !== JSON.stringify(TM.visibleAt(fresh))) { oneStep++; }
  if (JSON.stringify(TM.spineAt(walk)) !== JSON.stringify(TM.spineAt(fresh))) { oneStep++; }
  if (JSON.stringify(TM.statsAt(walk)) !== JSON.stringify(TM.statsAt(fresh))) { oneStep++; }
}
T.eq(oneStep, 0, '±1 逐步走过 400 步再原路退回，每一步都与全量一致');
T.eq(walk.rebuilds, 2, '这 800 次 ±1 全部走增量');

// ---- ③ 截断时剪枝必须报「未知」，而且是 null，不是 undefined 也不是 0 ----
/* _test.js 的 eq 走 JSON.stringify，而 stringify(undefined) 与
   stringify(function(){}) 都是 undefined —— 拿 undefined 当「没有」会让
   一整类断言变成空转。null 的 stringify 是 'null'，与 0、与 undefined 都
   分得开，所以这三条要一起写，缺一条就漏掉一种坏法。 */
T.eq(cutStats.pruned, null, '截断时剪枝总数报 null（不知道），不是一个数字');
T.ok(cutStats.pruned === null, '而且真的是 null（=== 判定，挡住 undefined）');
T.ok(cutStats.pruned !== 0, '尤其不是 0 —— 0 会把「不知道」伪装成一次测量');
T.eq(cutStats.mvEnumerated, null, '截断时「枚举了多少走法」同样是 null');
T.ok(typeof cutStats.visited === 'number' && cutStats.visited > 0,
  '但「访问了多少个节点」是数得出来的，照常给数字：' + cutStats.visited);
T.eq(cutStats.prunedKnown, 0, '已确认被剪掉的分支数恒是数字，纯 minimax 上是 0');
T.ok(cutStats.unknown > 0, '并且如实说明有几个节点判不出来：' + cutStats.unknown);
T.eq(TM.prunedAt(cutView), [], '纯 minimax 截断轨迹上没有任何**已确认**的剪枝');

/* 反过来：没截断的轨迹上，pruned 必须是货真价实的数字，一次都不许是 null
   —— 否则 α-β 那一课的计数器全程是「—」。 */
T.eq(abStats.truncated, false, 'α-β 的完整轨迹不标 truncated');
T.eq(abStats.unknown, 0, '完整轨迹上没有判不出来的节点');
T.ok(typeof abStats.pruned === 'number', 'α-β 的剪枝总数是数字');
T.eq(abStats.pruned, abStats.prunedKnown, '没有未知项时，总数就等于已确认数');
T.ok(typeof abStats.mvEnumerated === 'number', 'α-β 的「枚举了多少走法」也是数字');

/* ---- 把 mvEnumerated 的**含义**钉住，而不只是钉住它的类型 ----
   它是「真的调用 genMoves 枚举出来的走法数之和」，不是「这些局面一共有
   多少条分支」（后者本模块给不出来，早退叶子有走法却从没枚举过）。
   两种读法在类型上都是数字，只有拿一个**独立的恒等式**才分得开：

     枚举出来的 − 被剪掉的 = 真的展开出来的孩子总数 = 节点数 − 顶层节点数

   左边全部来自 statsAt 的累加器，右边只数树上的节点，两边各算各的。
   若哪天有人把它改成「分支因子之和」（把早退叶子按某个猜测的走法数计入），
   左边会立刻变大，这条当场红。 */
/* ordered 也在这里一起过一遍 view —— 它是 shipped 工具里与 ab **并排**的
   那半个对比 tab，却是三个 mode 里唯一没有任何 view 级断言的。 */
const ordTrace = I.run(ALGO.source({ mode: 'ordered', depth: 3 }), { host: {} }).trace;
T.ok(!ordTrace.truncated, '前提：depth 3 的 ordered 不截断');
const ordTree = TM.build(ordTrace, 'search');
const ordEnd = TM.createView(ordTree, ordTrace);
TM.seek(ordEnd, ordTrace.length - 1);

for (const [tr0, tree0, lbl] of [[abTrace, abTree, 'ab'], [plainTrace, plainTree, 'plain'],
                                 [ordTrace, ordTree, 'ordered']]) {
  const v = TM.createView(tree0, tr0);
  TM.seek(v, tr0.length - 1);
  const st = TM.statsAt(v);
  let tops = 0;
  for (const id of tree0.order) { if (TM.nodeAt(tree0, id).parentId < 0) { tops++; } }
  T.eq(st.visited, tree0.order.length, lbl + '：跑到末尾时每个节点都访问过了');
  T.eq(st.mvEnumerated - st.pruned, st.visited - tops,
    lbl + '：枚举出来的走法 − 剪掉的 = 真的展开出来的孩子数');
}

/* ordered 的 view 级断言。它与 ab 并排展示的正是这两个数：同一个答案，
   更早试到好棋 ⟹ 剪得更多、看的节点更少。 */
const ordStats = TM.statsAt(ordEnd);
T.eq(ordStats.truncated, false, 'ordered 的完整轨迹不标 truncated');
T.eq(ordStats.unknown, 0, 'ordered 上没有判不出来的节点');
T.ok(typeof ordStats.pruned === 'number', 'ordered 的剪枝总数是数字');
T.ok(ordStats.pruned > 0, 'ordered 确实剪掉了分支：' + ordStats.pruned);
T.ok(ordStats.pruned > abStats.pruned,
  'ordered 比 ab 剪得更多：' + ordStats.pruned + ' > ' + abStats.pruned);
T.ok(ordStats.visited < abStats.visited,
  'ordered 看的节点比 ab 少：' + ordStats.visited + ' < ' + abStats.visited);
T.ok(TM.prunedAt(ordEnd).length > 0, 'ordered 指认得出被剪过的节点');
/* 三种 mode 在**同一个深度**上必须给出同一个答案 —— 剪枝和排序只改变
   要看多少个局面，不改变那个分数。注意参照要拿 depth 3 的 plain，
   不能拿文件开头那个 RESULT：那是 depth **2** 的答案（0），而 depth 3 是
   136（minimax.js 里 0 / 136 / −12 这组数字说的正是「多想一层会改主意」）。 */
T.eq(TM.nodeAt(ordTree, ordTree.rootId).value, TM.nodeAt(plainTree, plainTree.rootId).value,
  'ordered 的答案与同深度的 plain 相同 —— 排序只改变要看多少个局面');
T.eq(TM.nodeAt(abTree, abTree.rootId).value, TM.nodeAt(plainTree, plainTree.rootId).value,
  'ab 的答案与同深度的 plain 相同 —— 剪枝不改变答案');
T.ok(TM.nodeAt(plainTree, plainTree.rootId).value !== RESULT,
  '前提：depth 3 的答案与 depth 2 不同（否则上面两条拿错参照也看不出来）');

/* 剪枝计数在整条轨迹上**只增不减**（已确认的事实不会被推翻），
   而且中途一次都不会变成 null。 */
const mono = TM.createView(abTree, abTrace);
let prevPruned = -1, prunedGrew = 0, nulls = 0;
for (let i = 0; i < abTrace.length; i += stride) {
  TM.seek(mono, i);
  const st = TM.statsAt(mono);
  if (st.pruned === null) { nulls++; continue; }
  T.ok(st.pruned >= prevPruned, '已确认的剪枝数不随游标前进而减少（i=' + i + '）');
  if (st.pruned > prevPruned) { prunedGrew++; }
  prevPruned = st.pruned;
}
T.eq(nulls, 0, '完整轨迹上剪枝计数全程都是数字，没有中途变成 null');
T.ok(prunedGrew >= 3, '剪枝计数确实在长大，不是恒为 0');

// ---- spineAt 拿运行时调用栈当独立参照（本任务最强的一条对拍）----
/* 与任务 2 钉父链用的是同一招，但这次在**任意游标**上比，不只在入帧步上。
   spineAt 的两个边界（pop 步本身仍在栈上）是抄 debugger.callStack 的，
   抄得对不对只能靠它自己说话。 */
const spineCur = D.create(abTrace);
const spineView = TM.createView(abTree, abTrace);
let spineChecked = 0, spineBad = 0;
const spineStride = Math.max(1, Math.floor(abTrace.length / 120));
for (let i = 0; i < abTrace.length; i += spineStride) {
  D.goto(spineCur, i);
  TM.seek(spineView, i);
  const stack = D.callStack(spineCur), ids = D.frameIds(spineCur);
  const runtime = [];
  for (let k = 0; k < stack.length; k++) { if (stack[k].name === 'search') { runtime.push(ids[k]); } }
  if (JSON.stringify(TM.spineAt(spineView)) !== JSON.stringify(runtime)) { spineBad++; }
  spineChecked++;
}
T.eq(spineBad, 0, '每个游标上的 spine 都与运行时调用栈里的 search 帧逐项相同');
T.ok(spineChecked >= 100, 'spine 对拍跑了至少 100 个游标（不是空转）');
T.ok(spineChecked > 0 && TM.spineAt(spineView).length >= 0, 'spine 对拍真的取到了值');

// ---- spine 自身的形状：是一条真链，且每个成员都可见 ----
const shape = TM.createView(abTree, abTrace);
let shapeChecked = 0;
for (let i = 0; i < abTrace.length; i += stride) {
  TM.seek(shape, i);
  const sp = TM.spineAt(shape);
  const vis = TM.visibleAt(shape);
  for (let k = 0; k < sp.length; k++) {
    const n = TM.nodeAt(abTree, sp[k]);
    T.eq(n.parentId, k === 0 ? -1 : sp[k - 1], 'spine 是一条父链（第 ' + k + ' 段）');
    T.ok(vis.indexOf(sp[k]) >= 0, 'spine 上的节点必然已经可见');
    T.ok(shape.visible[sp[k]] === true, 'visible 这张表与 visibleAt 说的是同一件事');
    shapeChecked++;
  }
}
T.ok(shapeChecked > 20, 'spine 形状检查不是空转');

// ---- prunedAt 与 statsAt 同出一源 ----
/* 两个函数各算各的（一个现算、一个增量累加），必须永远对得上；
   这里把 prunedAt 报出来的节点逐个重算一遍差额，加起来去撞 prunedKnown。 */
const agree = TM.createView(abTree, abTrace);
let agreeChecked = 0;
for (let i = 0; i < abTrace.length; i += stride) {
  TM.seek(agree, i);
  const ids = TM.prunedAt(agree);
  let sum = 0;
  for (const id of ids) {
    const n = TM.nodeAt(abTree, id);
    T.ok(n.popStep >= 0 && n.popStep <= i, '报剪枝的节点必然已经出帧（否则判不出来）');
    T.ok(n.mvCount !== null, '报剪枝的节点必然读得到走法数');
    T.ok(n.childIds.length < n.mvCount, '报剪枝的节点真的少看了分支');
    sum += n.mvCount - n.childIds.length;
  }
  T.eq(sum, TM.statsAt(agree).prunedKnown, 'prunedAt 逐个重算的差额之和 = statsAt 的剪枝数');
  agreeChecked++;
}
T.ok(agreeChecked >= 30, 'prunedAt / statsAt 对拍不是空转');
T.ok(TM.prunedAt(abEnd).length > 0, 'α-β 末尾确实指认得出被剪过的节点：' + TM.prunedAt(abEnd).length);
T.eq(TM.prunedAt(plainEnd), [], '纯 minimax 全程指认不出任何被剪的节点');

/* prunedAt 报的是**父** id：被剪掉的分支根本没有 id 可报。逐个验证它们
   确实是树上的节点，而且孩子数严格少于走法数。 */
for (const id of TM.prunedAt(abEnd)) {
  T.ok(TM.nodeAt(abTree, id) !== null, '剪枝报出来的 id 是树上真实存在的节点');
}

// ---- 「关闭了、零孩子」那一档确定是 0，不是未知（cutOf 的核心判据）----
/* 若把这一档当未知，每棵树上一大半叶子都会污染总数，α-β 的 pruned 会变成
   null，那一课当场没了。实测六份 fixture 里「关闭了、读不到走法数、却有
   孩子」的节点数都是 0，所以这一档的判据是安全的 —— 这里把它钉住，
   哪天不成立了要当回归看。 */
for (const [t2, lbl] of [[abTree, 'ab'], [plainTree, 'plain'], [cutTree, 'cut'], [ordTree, 'ordered']]) {
  for (const id of t2.order) {
    const n = TM.nodeAt(t2, id);
    if (n.popStep < 0 || n.mvCount !== null) { continue; }
    T.eq(n.childIds.length, 0, lbl + '：关闭了却读不到走法数的节点必然没有孩子');
  }
}

// ---- 边界：createView 什么都不给也不抛 ----
let noThrow = true;
try {
  const v0 = TM.createView(null, null);
  TM.seek(v0, 3); TM.visibleAt(v0); TM.spineAt(v0); TM.prunedAt(v0); TM.statsAt(v0);
  T.eq(TM.visibleAt(v0), [], 'createView(null, null) 的可见集是空的');
  T.eq(TM.spineAt(v0), [], 'createView(null, null) 的 spine 是空的');
  T.eq(TM.statsAt(v0).visited, 0, 'createView(null, null) 访问了 0 个节点');
  T.eq(TM.statsAt(v0).pruned, 0, '空树上没有未知项，剪枝数是确定的 0');
} catch (e) { noThrow = false; }
T.ok(noThrow, 'createView(null, null) 全套读法都不抛');

// 空树上的 stats 也要如实：什么都没有 ≠ 不知道。
T.eq(TM.statsAt(safe).visited, 0, '空轨迹上访问了 0 个节点');
T.eq(TM.statsAt(safe).pruned, 0, '空轨迹上剪枝数是确定的 0，不是 null');
T.eq(TM.statsAt(safe).truncated, false, '空轨迹不是被截断的轨迹');
T.eq(TM.visibleAt(safe), [], '空轨迹上没有可见节点');

// seek 返回 view 本身（brief 的签名是 → view），且游标被夹在合法区间里
T.ok(TM.seek(abEnd, 10) === abEnd, 'seek 返回 view 本身');
T.eq(TM.seek(abEnd, -5).i, 0, 'seek 到负数夹回 0');
T.eq(TM.seek(abEnd, 999999).i, abTrace.length - 1, 'seek 越界夹到末尾');

T.report();
