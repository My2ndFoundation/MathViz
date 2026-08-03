/* 博弈树模型：把**一条已经录完的解释器轨迹**变成一棵树。纯逻辑，零 DOM。
   零依赖；node 与浏览器双用。编辑源，运行时被内联进 tools/*.html。

   这个模块存在的全部理由，是一个刻意的架构决定：**树完全由调用栈派生，
   interp.js 一个字节都不改。** 搜索算法不"上报"自己在建什么树，它只是
   照常递归；每一次 `search()` 入帧就是树上的一个节点，每一次出帧就是这个
   节点算完了。于是右边那棵树与左边那份源码不可能漂移——它们是同一件事的
   两种画法，而不是两份各自维护的状态。

   这也意味着本模块**不 require debugger.js**：一趟线性扫描就能把树建出来，
   不需要游标。Debugger 只在测试里当**独立参照**用（把树的父链跟运行时
   callStack/frameIds 逐项对拍）——拿一个独立实现来对拍，比拿手写期望值
   对拍更能抓住真错，这是本项目三个阶段里战果最大的一招。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TreeModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ==================== 两条硬规则 ====================

     【1】节点 id **就是该帧 push 步在轨迹里的下标**，不是按深度编号的序号。
     阶段 3b 用深度认帧栽过：`return f(1) + f(1);` 会在连续两步里产生同深度的
     一次 pop 和一次 push，深度认帧把两个不同的帧当成同一个，静默藏起一个刚
     诞生的绑定。push 步下标是全局唯一且单调的，
     「push-index > 某个游标 ⟺ 该帧在那个时刻还不存在」是**精确判据**，
     不是启发式——阶段 3 的 visibleAt 全靠它，本模块也把它当身份证。

     【2】父子关系按**栈**判定，不按 Step.depth。
     depth 会被 evaluate / genMoves / onBoard 这些非 search 帧顶高：实测
     `Algos.source({mode:'plain',depth:2})` 的轨迹里，树只有 2 层，
     `Step.depth` 却到 4（入帧次数 search 57 / genMoves 9 / onBoard 189 /
     evaluate 48）。同一层的两个 search 节点完全可以有不同的 Step.depth，
     反过来不同层的两个节点也可以撞上同一个 depth。
     扫轨迹时自己维护一个 search 帧栈即可——那是**精确**的，不是近似的。 */

  /* ---------------- 从 varDelta 里读局部量 ----------------

     Step 里**没有返回值这一项**（3a 的 Step 只有 line/depth/frameOp/
     frameName/varDelta/boardOps/out）。所以节点的 value / mvCount / 窗口
     只能从 varDelta 里认名字读出来，而这些名字属于 algos/minimax.js 生成的
     那份 search()：

       入帧步 varDelta = 形参绑定  → bd, depth, alpha, beta, white
       出帧步 varDelta = 作用域拆除 → 上面五个 + 函数体顶层声明的 ms / best，
                                     每条带 `from` = 离开作用域那一刻的值

     由此：
       mvCount = 出帧步里 ms 的 from 的长度
       value   = 出帧步里 best 的 from（`return best` 返回的就是它）

     **读不到就是 null，不是 0。** 这两个字段的缺席有三种成因，没有一种
     支持"0"这个数：
       ① 轨迹被截断，这一帧从未关闭 —— 它有几个走法根本还没写进轨迹；
       ② `depth === 0` 那种当场 `return evaluate(bd)` 的叶子 —— 那个局面
          **有**合法走法，只是搜索没去枚举它们，说它"有 0 个走法"是假话；
       ③ 使用者把源码里的 `ms` 改名了（这份源码本来就是拿来给人改的）——
          此时整棵树的分支因子会一起读不到。
     写 0 会把这三种"不知道"伪装成一个具体的测量值，而面板没有任何办法
     再把它们分辨出来。null 让"不知道"一路传到面板上，由调用方显式处理。
     ——顺带说明为什么这条契约必须在**这一层**做对：即使将来让 Algos 导出
     一份变量名表，那张表也是构建期的，使用者一改名它当场就过期；能一路
     承载"我不知道"的只有这里的 null。

     `return evaluate(bd)` 那两条早退路径（depth === 0、或一步都走不了）没有
     best，值只在**调用方**那边现身：被调方 pop 的下一步就是调用方的
     `const v = search(...)`，varDelta 里那条 `v` 就是刚刚返回的值（实测：
     leaf pop 在 741 步，742 步是 `{name:'v', to:-100}`，深度正好回落一级）。
     所以补一条后备路径去读它。取它时要校验 `trace[q+1].depth === trace[q].depth - 1`
     ——出帧步记的仍是内层深度，调用方恢复执行时深度才降一级；不校验就可能
     把别处一个碰巧叫 v 的绑定当成返回值。

     这几个名字是与那份生成源码的**约定**，改源码里的变量名就要改这里。
     没有更"通用"的办法：轨迹里确实没有返回值，任何读法都得认某个名字 ——
     所以上面那条 null 契约不是洁癖，是这个约定失效时唯一的安全出口。 */
  const V_MOVES = 'ms';    // 走法表：ms.length 就是这个节点的分支因子
  const V_BEST = 'best';   // 这一帧最终返回的分数
  const V_RET = 'v';       // 调用方接住子节点返回值的那个绑定

  function deltaOf(deltas, name) {
    if (!deltas) return null;
    for (let m = 0; m < deltas.length; m++) {
      if (deltas[m].name === name) return deltas[m];
    }
    return null;
  }

  /* 从入帧步的形参绑定里读一个值；没有这个形参就返回 null。
     判据用 `typeof d.to !== 'undefined'` 而不是真值判断：alpha 是 −99999、
     white 是 false、分数可以是 0，任何真值判断都会把它们抹掉。 */
  function paramAt(step, name) {
    const d = deltaOf(step.varDelta, name);
    return (d && typeof d.to !== 'undefined') ? d.to : null;
  }

  /* build(trace, entryName) → tree

     tree = { nodes: (id → Node) 的无原型对象, rootId: number, order: number[] }
     Node = { id, parentId, depth, childIds, pushStep, popStep,
              mvCount, value, alpha, beta, white }

       id / pushStep  该帧入帧步的下标（规则 1）。两个名字是同一个数字：
                      id 是身份，pushStep 是「它在时间轴上的位置」，
                      调用方读起来意思不同，留两个名字比省一个字段清楚。
       popStep        出帧步下标；**-1 表示这一帧从未关闭**——轨迹撞上
                      STEP_LIMIT 被截断时（深度 4 的纯 minimax 就会）栈上
                      所有帧都停在开着的状态，这是设计内的情形，不是异常。
                      此时 mvCount 与 value 都是 null（读不到就是不知道）。
       mvCount        这个节点的分支因子（走法数）；**null = 读不到**，
                      成因见上面那段。不要把 null 当 0 用。
       value          这一帧返回的分数；**null = 读不到**，同上。
       depth          **树深**，根为 0、逐层加一。不是 search 的 depth 形参
                      （那个是倒着数的），更不是 Step.depth（见规则 2）。
       alpha / beta   **入帧时**的窗口，即「这个节点是带着什么窗口被搜的」。
                      纯 minimax 里恒为 ±99999；α-β 里父节点收窄之后传下来的
                      窗口正是剪枝那一课要看的东西。出帧时的窗口另在出帧步的
                      varDelta 里，本任务不需要，没有存。
       white          入帧时轮到谁走（true = 白 = 取极大）。

     order 是节点 id 的**升序**，也就是入帧的时间顺序，同时正好是这棵树的
     先序遍历——递归的调用顺序天然如此，不需要再排一次。

     `order` 用数组、`nodes` 用无原型对象：id 是数字，不会撞上 __proto__，
     但无原型对象仍是这个仓库里所有「名字 → 值」映射的默认写法（见
     debugger.js 里 ownedNames 的注释），保持一致。

     多个顶层 entry 帧（轨迹里前后跑了两次搜索）时，rootId 取**第一个**；
     其余顶层帧照常建节点、parentId 也是 -1，只是从 rootId 出发走不到它们。
     本阶段的源码只跑一次搜索，这里不为它专门设计，但也不悄悄丢掉。 */
  function build(trace, entryName) {
    const tr = trace || [];
    const nodes = Object.create(null);
    const order = [];
    let rootId = -1;

    /* 两个栈：allStack 记**每一帧**的名字（pop 必须与它自己的 push 配对，
       不能只盯着 search 帧——genMoves 的 pop 若被当成 search 的 pop，
       整棵树就从那里开始错位）；searchStack 只记 entry 帧的 id，栈顶就是
       当前节点的父亲（规则 2）。 */
    const allStack = [];
    const searchStack = [];

    for (let k = 0; k < tr.length; k++) {
      const s = tr[k];
      if (s.frameOp === 'push') {
        allStack.push(s.frameName);
        if (s.frameName !== entryName) continue;
        const parentId = searchStack.length ? searchStack[searchStack.length - 1] : -1;
        const node = {
          id: k,
          parentId: parentId,
          depth: parentId < 0 ? 0 : nodes[parentId].depth + 1,
          childIds: [],
          pushStep: k,
          popStep: -1,
          mvCount: null,
          value: null,
          alpha: paramAt(s, 'alpha'),
          beta: paramAt(s, 'beta'),
          white: paramAt(s, 'white'),
        };
        if (parentId >= 0) nodes[parentId].childIds.push(k);
        else if (rootId < 0) rootId = k;
        nodes[k] = node;
        order.push(k);
        searchStack.push(k);
        continue;
      }
      if (s.frameOp === 'pop') {
        /* 空栈上的 pop 在完整轨迹里不可能出现（每个 pop 都由
           callInterpreted 与它自己的 push 成对发出）。仍然判一下：这个模块
           的输入是"外面递进来的一个数组"，一条手搓的或被截过头的轨迹不该
           让面板崩掉。 */
        const name = allStack.length ? allStack.pop() : null;
        if (name !== entryName || !searchStack.length) continue;
        const id = searchStack.pop();
        const node = nodes[id];
        node.popStep = k;
        const ms = deltaOf(s.varDelta, V_MOVES);
        if (ms && ms.from && typeof ms.from.length === 'number') node.mvCount = ms.from.length;
        const best = deltaOf(s.varDelta, V_BEST);
        if (best && typeof best.from !== 'undefined') {
          node.value = best.from;
        } else {
          // 早退帧（`return evaluate(bd)`）：值只在调用方接住它的那一步里。
          const nxt = tr[k + 1];
          if (nxt && nxt.depth === s.depth - 1) {
            const ret = deltaOf(nxt.varDelta, V_RET);
            if (ret && typeof ret.to !== 'undefined') node.value = ret.to;
          }
        }
      }
    }

    return { nodes: nodes, rootId: rootId, order: order };
  }

  /* nodeAt(tree, id) → Node | null。**不存在就是 null，不是 undefined**：
     JSON.stringify(undefined) 与 JSON.stringify(function(){}) 都是 undefined，
     用 undefined 当"没有"会让一整类断言变成空转（_test.js 的 eq 走的正是
     JSON.stringify）。null 在任何比较里都看得见。
     id 非数字（调用方从 dataset 里读出来的字符串）也照样返回 null 而不是
     去索引一次——无原型对象上 `nodes['3']` 与 `nodes[3]` 其实是同一个键，
     所以这里**不**做类型收紧，让字符串 id 也能查到；真正要挡的只有"查不到"。 */
  function nodeAt(tree, id) {
    if (!tree || !tree.nodes) return null;
    const n = tree.nodes[id];
    return n ? n : null;
  }

  return { build: build, nodeAt: nodeAt };
});
