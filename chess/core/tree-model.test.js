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

T.report();
