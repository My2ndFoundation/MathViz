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

  /* ==================== 游标视图：某一刻这棵树长什么样 ====================

     build 给的是**整条轨迹跑完**的那棵树；面板要画的却是「游标停在第 i 步
     时」的那一棵——哪些节点已经诞生、栈上正开着哪一条、哪些分支已经确定
     被砍掉。view 就是这个「某一刻」的状态。

     seek 是增量的，因为**撞墙演示恰好就是性能最坏点**：深度 4 的 tree tab
     是一条 200,000 步的截断轨迹，而截断轨迹里帧永不关闭，debugger.js 的
     matchFrames 早退分支失效、每次推导退化成 O(trace.length)——实测
     i=199999 时一次五区重算 16.12 ms，预算是 4 ms。
     所以：游标 ±1 时只处理跨过的那几步，只有跳转/换轨迹才全量重建。
     缓存放在这里而不是 debugger.js 里——那个模块的零 DOM 纯度是约 4,100
     条 node 断言的前提，不能为了性能赔掉。

     view 对外的字段是 brief 约定的那五个（tree / trace / i / visible /
     spineIds），其余（popIndex / visCount / acc / seeked）是增量簿记，
     调用方不要读，更不要写——它们与 i 之间有不变式，手改一处就全错。 */

  /* 节点「开着」= 已经入帧、还没离开调用栈。两个边界与 debugger.callStack
     **逐字相同**（那边的注释解释了为什么不对称）：
       · push 步本身已经身处新帧里 → `pushStep <= i` 算进去；
       · pop 步记的仍是内层深度，函数直到下一步才真正回到调用方 →
         `popStep >= i` 时仍在栈上。
     于是 spineAt(view) 与 D.frameIds(cur) 里的 search 帧序列在每个下标上
     都对得上——两个模块各算各的，能对上才说明两边都没错。
     popStep < 0（截断，永不关闭）的帧一直算开着，它确实再也没弹出去过。 */
  function isOpen(n, i) {
    return n.pushStep <= i && (n.popStep < 0 || n.popStep >= i);
  }

  /* ---------------- 剪枝判据 ----------------

     一个**已经关闭**的节点确定被剪掉了几个分支；**-1 表示不可判定**。

     判据本身很简单：mvCount 是「本来要看的走法数」，childIds.length 是
     「真的看了的」，差额就是 `if (beta <= alpha) { break; }` 砍掉的。

     难的是 mvCount === null（读不到走法数）那一档要不要当 0。**分两种，
     必须分开，否则不是漏报就是虚报**：

       · 没有孩子 → 确实剪了 0 个。这一帧是 `depth === 0` 或
         `ms.length === 0` 那两条早退路径，压根没跑到 `for (const mv of ms)`，
         没有循环也就没有 break。**这不是「不知道」，是「确定是 0」**：
         剪枝只可能发生在 `const v = search(...)` 之后，所以任何真被剪过的
         节点必然至少有一个孩子；反过来「关闭了且零孩子」⟹ 一个都没剪。
         （实测佐证：plain d2/d3、ab d3、ordered d3、plain d4、ab d4 六份
         fixture 里，「关闭了、读不到 mvCount、却有孩子」的节点数都是 0。）
         这一档**不能**报未知：否则每棵树上一大半都是叶子，α-β 的剪枝总数
         会被自己的叶子污染成 null，那一课就没了。
       · 有孩子却读不到 → **真的不知道**，返回 -1。这只有一种成因：使用者
         把源码里的 `ms` 改了名（这份源码本来就是拿来给人改的）。此时这一帧
         明明跑过循环，分母却读不到，报 0 就是虚报。

     还有一档在这个函数之外：`popStep < 0`（截断，帧永不关闭）。那种节点
     连「关没关」都还没发生，压根轮不到这里判，见 onBorn。 */
  function cutOf(n) {
    if (n.mvCount === null) return n.childIds.length ? -1 : 0;
    return n.mvCount - n.childIds.length;
  }

  function newAcc() {
    return {
      closed: 0,        // 截至游标已经关闭的节点数
      prunedSum: 0,     // 已**确定**被剪掉的分支总数（只累加判得出来的）
      mvSum: 0,         // 已经**枚举出来**的走法总数（见 statsAt 的 mvEnumerated）
      openForever: 0,   // 可见节点里永不关闭的（= 轨迹被截断的直接证据）
      unreadable: 0,    // 关闭了、有孩子、却读不到走法数的（= 变量被改名）
    };
  }

  /* 节点诞生 / 撤销诞生。sign = +1 前进，-1 后退，两边逐字对称。
     永不关闭的帧一**露面**就把「不可判定」记上：它不会再有关闭那一刻了。 */
  function onBorn(acc, n, sign) {
    if (n.popStep < 0) acc.openForever += sign;
  }

  /* 节点关闭 / 撤销关闭。只有 popStep >= 0 的节点会走到这里（popIndex 里
     根本没有 -1 那一档）。 */
  function onClose(acc, n, sign) {
    acc.closed += sign;
    const cut = cutOf(n);
    if (cut < 0) { acc.unreadable += sign; return; }
    /* `mvCount === null` 的那一档（早退叶子）**枚举出来的走法就是 0 个**
       ——它压根没调用过 genMoves。这里**显式**判 null 而不是靠
       `sign * null === 0` 那个隐式强制：算出来的数一样，但一个 null 悄悄
       变成 0 的表达式，正是这个文件从头到尾在防的那件事，不该在实现里
       留一处反例。（注意这与「说这个局面有 0 个走法」不是一回事：
       那个局面**有**合法走法，只是搜索没去枚举——所以这个累加器叫
       「枚举了多少」，不叫「有多少」，见 statsAt。） */
    if (n.mvCount !== null) acc.mvSum += sign * n.mvCount;
    if (cut > 0) acc.prunedSum += sign * cut;
  }

  /* 出帧步下标 → 节点 id。**只有它让增量成立**：跨过第 k 步时要知道
     「有没有哪个节点在这一步关闭」，没有这张表就只能回头翻轨迹。
     入帧方向不需要这张表——规则 1 说了 id 就是入帧步下标，`nodes[k]`
     本身就是那张表。 */
  function popIndexOf(tree) {
    const idx = Object.create(null);
    for (let k = 0; k < tree.order.length; k++) {
      const n = tree.nodes[tree.order[k]];
      if (n.popStep >= 0) idx[n.popStep] = n.id;
    }
    return idx;
  }

  /* 全量重建：不看轨迹，只扫这棵树（≤ 1,243 个节点），O(节点数)。
     注意它**不读 trace 的任何一步**——所有需要的时间信息（pushStep /
     popStep）在 build 那一趟已经蒸馏进节点里了。这也是为什么本模块能躲开
     matchFrames 那个 O(trace.length)：那边每次都要重新配对帧，这边配对
     一次就存下来了。 */
  function rebuild(view, i) {
    const order = view.tree.order, nodes = view.tree.nodes;
    const visible = Object.create(null);
    const acc = newAcc();
    let vis = 0;
    for (let k = 0; k < order.length; k++) {
      const n = nodes[order[k]];
      if (n.pushStep > i) break;   // order 是 id 升序，后面的只会更晚
      visible[n.id] = true;
      vis++;
      onBorn(acc, n, 1);
      if (n.popStep >= 0 && n.popStep <= i) onClose(acc, n, 1);
    }
    /* 脊：从可见前缀的**末尾往回**找第一个还开着的节点。它必定是最内层的
       ——开着的节点两两之间只可能是祖先/后代关系（兄弟是先后串行的，弟弟
       入帧时哥哥早就弹了），所以「开着的」构成一条链，链上 pushStep 最大的
       就是链尾。倒着扫遇到的第一个正是它。 */
    const spine = [];
    for (let k = vis - 1; k >= 0; k--) {
      const n = nodes[order[k]];
      if (!isOpen(n, i)) continue;
      let m = n;
      while (m) { spine.unshift(m.id); m = m.parentId < 0 ? null : nodes[m.parentId]; }
      break;
    }
    view.visible = visible;
    view.visCount = vis;
    view.spineIds = spine;
    view.acc = acc;
    view.i = i;
    view.rebuilds++;
  }

  /* 前进：逐步跨过 (view.i, to]，每一步只做三件事，全是 O(1) 查表。
     顺序不能换，它就是「游标从 k-1 迈到 k」这一瞬间发生的事的时间顺序：
       ① k-1 那一步关掉的帧，此刻才真正离开调用栈（pop 步本身仍算在栈上）；
       ② 第 k 步若是某个节点的入帧步，它诞生并压上栈；
       ③ 第 k 步若是某个节点的出帧步，它的 ms / best 就写在这一步的 varDelta
          里——**信息在这一刻就已经拿得到**，所以记账也在这一刻，
          尽管按 ① 那条边界它还要在栈上多待一步。两件事不矛盾。 */
  function advance(view, to) {
    const nodes = view.tree.nodes, popIndex = view.popIndex, acc = view.acc;
    for (let k = view.i + 1; k <= to; k++) {
      if (popIndex[k - 1] !== undefined) view.spineIds.pop();
      const born = nodes[k];
      if (born !== undefined) {
        view.visible[born.id] = true;
        view.visCount++;
        onBorn(acc, born, 1);
        view.spineIds.push(born.id);
      }
      const shut = popIndex[k];
      if (shut !== undefined) onClose(acc, nodes[shut], 1);
    }
    view.i = to;
  }

  /* 后退：把 advance 做过的每一件事**逐条反着撤销**（顺序也反过来）。
     后退方向单独写一遍，不是图省事的对称抄写——只在前进方向上正确的增量
     状态是这类代码最典型的坏法，测试因此在两个方向上各对拍一遍。 */
  function retreat(view, to) {
    const nodes = view.tree.nodes, popIndex = view.popIndex, acc = view.acc;
    for (let k = view.i; k > to; k--) {
      const shut = popIndex[k];
      if (shut !== undefined) onClose(acc, nodes[shut], -1);
      const born = nodes[k];
      if (born !== undefined) {
        delete view.visible[born.id];
        view.visCount--;
        onBorn(acc, born, -1);
        view.spineIds.pop();
      }
      const back = popIndex[k - 1];
      if (back !== undefined) view.spineIds.push(back);
    }
    view.i = to;
  }

  /* createView(tree, trace) → view。游标落在 0（与 Debugger.create 一致：
     「停在第一步」是唯一自然的初始状态，哪怕空轨迹上这一步并不存在）。
     tree / trace 缺席都不抛：这个模块的输入是外面递进来的东西，清空编辑器
     缓冲区在 3b 是真实可达的状态，不该让面板崩掉。 */
  function createView(tree, trace) {
    const tr = tree && tree.order ? tree : { nodes: Object.create(null), rootId: -1, order: [] };
    const view = {
      tree: tr,
      trace: trace || [],
      i: 0,
      visible: Object.create(null),
      spineIds: [],
      popIndex: popIndexOf(tr),
      visCount: 0,
      acc: newAcc(),
      seeked: false,
      /* 全量重建了几次。**留着是给测试用的**：命脉那条对拍（增量 vs 全量）
         有一种无声的坏法——阈值定小了，两边其实都走了全量，对拍从此空转
         而全绿。除了从外面数一下重建次数，没有别的办法把它钉住。 */
      rebuilds: 0,
    };
    rebuild(view, clampTo(view, 0));
    /* rebuild 之后仍标成「没 seek 过」：让**第一次 seek 必然走全量**。
       这不是洁癖——测试拿「新建的 view 上 seek 一次」当全量参照去对拍
       增量，若小游标处新 view 也走了增量，那一次对拍就变成了自己跟自己比，
       白白丢掉几个采样点的鉴别力。 */
    view.seeked = false;
    return view;
  }

  /* 把下标夹到 [0, trace.length-1]，与 Debugger.goto 同一套（含空轨迹时
     `length - 1 === -1` 被 Math.max 拉回 0 的那条边界）。 */
  function clampTo(view, i) {
    return Math.max(0, Math.min(view.trace.length - 1, i | 0));
  }

  /* 增量与全量的分水岭。**测出来的，不是拍的**（第一版拍了 4096，实测差了
     一倍多，当场改掉）：在 1,243 个节点 / 200,000 步的截断 d4 轨迹上，
       · 全量重建（rebuild，O(节点数)）    0.060 ms
       · 增量每跨一步                      0.0000345 ms
     打平点 = 0.060 / 0.0000345 ≈ 1,740 步。取 2048 是那个量级上的整数，
     边界处最多比全量贵 0.01 ms，可以忽略。
     这个常数**只影响快慢，不影响答案**——两条路径给出的状态必须逐点相同，
     测试正是拿全量当参照把这一条钉死的。 */
  const REBUILD_MAX = 2048;

  /* seek(view, i) → view（返回 view 本身，方便链式调用；不是新对象）。 */
  function seek(view, i) {
    const to = clampTo(view, i);
    if (!view.seeked) { view.seeked = true; rebuild(view, to); return view; }
    if (to === view.i) return view;
    if (to > view.i + REBUILD_MAX || to < view.i - REBUILD_MAX) { rebuild(view, to); return view; }
    if (to > view.i) advance(view, to); else retreat(view, to);
    return view;
  }

  /* visibleAt(view) → 截至游标已经**被访问过**的节点 id，按访问先后。
     它恒是 tree.order 的一段前缀：可见 ⟺ pushStep <= i，而 order 正是
     pushStep 升序。返回**副本**，调用方随便改都伤不到 view。 */
  function visibleAt(view) {
    return view.tree.order.slice(0, view.visCount);
  }

  /* spineAt(view) → 根到最内层 search 帧的路径（由外到内）。同样返回副本
     ——这是 view 的内部栈，被外面 pop 一下整个增量状态就废了。 */
  function spineAt(view) {
    return view.spineIds.slice();
  }

  /* prunedAt(view) → 截至游标**已确定**有分支被剪掉的节点 id（升序）。

     返回的是「被剪掉的节点的**父** id」，因为被剪掉的分支根本没进过轨迹
     ——它们没有入帧步，也就没有 id，永远画不出来。能指认的只有「在谁身上
     少看了几个分支」。

     每次现算而不做增量缓存：它与 statsAt 的剪枝数必须同出一源（都走
     cutOf），两处各存一份状态迟早分岔；O(可见节点数) ≤ 1,243 也不值得为它
     再养一个不变式。 */
  function prunedAt(view) {
    const out = [], order = view.tree.order, nodes = view.tree.nodes;
    for (let k = 0; k < view.visCount; k++) {
      const n = nodes[order[k]];
      if (n.popStep < 0 || n.popStep > view.i) continue;   // 还没关，还轮不到判
      if (cutOf(n) > 0) out.push(n.id);
    }
    return out;
  }

  /* statsAt(view) → { visited, pruned, prunedKnown, mvEnumerated, unknown, truncated }

     **pruned 与 mvEnumerated 会是 null，这是本函数的全部要点。**

     「剪掉了几个」这个总数只有在**每一个可见节点都判得出来**时才是一个数。
     只要有一个判不出来（截断导致帧永不关闭，或者使用者改了 `ms` 的名字），
     真实总数就在已知数之上、之外，报那个已知数等于宣称「就这么多」。
     ——与 3a 拒绝编造「省略了 N 步」是同一条纪律：**null 一路传到面板，
     由面板显式地画成「—」，而不是在这里悄悄变成一个像样的数字。**

     三档要分清，混起来就没意义了：
       · pending（popStep > i，此刻开着但**将来**会关）——不是不可判定，
         只是还没轮到。不计入 unknown，否则根节点一直开到最后一步，整段
         演示里剪枝计数全是 null，那个逐步长大的计数器就没了。
       · unknown（openForever + unreadable）——**永远**判不出来。
       · 其余都判得出来，含「关闭了、零孩子」那种确定剪了 0 个的叶子。

     prunedKnown 恒是数字：已确认被剪掉的分支数，是个**下界**。面板可以在
     pruned === null 时画「至少 N（另有 M 个节点判不出来）」，而不是干瞪眼。
     所以这里同时给出两个字段，不是冗余：一个是「总数」（可能不知道），
     一个是「已经确认的」（永远知道）。

     ---- mvEnumerated 是「**枚举出来了**多少个走法」，不是「一共有多少个」----

     名字里的 Enumerated 是要害，它曾经叫 mvTotal，而 "total" 会把面板引向
     另一个量：「这些局面**一共有**多少条分支」。那个量本模块**给不出来**，
     `depth === 0` 的早退叶子有合法走法却从没枚举过（本文件 :52 起那段
     null 契约说的正是它），把它们当 0 加进去就是编造——与上面 pruned 的
     null 裁决自相矛盾。

     所以定义钉死为：**每一帧真的调用 genMoves 生成出来的走法数之和**。
     早退叶子贡献 0（它确实一个都没枚举），这是事实不是估计。这也正是
     α-β 那一课要的分母：「本来要看的」对「真的看了的」，
     而 `mvEnumerated - pruned` 恰好等于**真的展开出来的孩子总数**
     （整条轨迹跑完时 = visited − 顶层节点数；测试拿它当独立参照钉住了这个读法）。

     它跟着 pruned 一起变 null，理由也一致：有节点永远判不出来时，
     那些帧枚举了多少走法同样无从知道。

     truncated 只由**截断**决定：轨迹自己说被截断，或者可见节点里有永不关闭
     的帧。改名导致的 unreadable 不算截断——那是另一码事，走 unknown。 */
  function statsAt(view) {
    const a = view.acc;
    const unknown = a.openForever + a.unreadable;
    return {
      visited: view.visCount,
      pruned: unknown ? null : a.prunedSum,
      prunedKnown: a.prunedSum,
      mvEnumerated: unknown ? null : a.mvSum,
      unknown: unknown,
      truncated: !!view.trace.truncated || a.openForever > 0,
    };
  }

  /* ==================== 布局：按子树叶子数压缩 ====================

     layout(tree, opts) → { pos: id → {x, y, z}, width, maxDepth }
       opts = { spanX, spanZ }

     ---- 为什么横向空间按**子树叶子数**分配 ----

     规格 §4④ 那一课是「α-β 剪掉的**体积**是肉眼可见的一块」。要看见体积，
     两个 tab 里的同一棵树必须落在**同一个横向总宽**里——只有总宽固定，
     「ab 那棵比 plain 那棵少掉的那片」才是一块看得见的空缺，而不是被自动
     缩放悄悄抹平成两张一样满的图。

     而树宽得离谱：实测 plain d3 = 388 个节点、ab d3 = 225、ordered d3 = 157，
     截断的 plain d4 = 1,243。按节点画一格是画不下的。所以反过来做：
     总宽固定为 spanX，每个节点分到的横向区间宽度**正比于它子树里的叶子数**
     ——叶子是这棵树真正的"宽度单位"（内部节点不占额外横向空间，它靠孩子
     撑开），于是同层区间恰好铺满、互不重叠，整棵树无论多大都压进 spanX。

     「按节点平均分」是个看起来差不多的错做法：那样每层各自填满 spanX，
     一棵被剪掉一半的树和一棵完整的树画出来一样宽，**剪掉的体积当场消失**。
     这正是这个函数存在的理由，不是实现细节。

     ---- 父节点为什么取孩子的中点，而不是自己区间的中点 ----

     两者**不相等**：孩子按叶子数分到的区间宽度不同，
     第一个孩子中心到最后一个孩子中心的中点 = 区间中心 + (w_首 − w_尾)/4。
     取孩子的中点，画出来父子连线才是对称的一把扇子（也是测试断言的那条）；
     取区间中心则会在首尾孩子胖瘦不同时把父亲拉偏。
     父亲仍然**严格落在自己的区间内**（孩子中心都在区间内），所以同层节点
     的先后与不重叠不受影响，±spanX/2 的上界也照旧成立。

     ---- 与 null 契约的关系：这里一个"不知道"都用不上 ----

     叶子数只数 childIds，**不碰 mvCount**。mvCount 是"本来有几个走法"，
     可能是 null（见文件开头那段），拿它当宽度就得替 null 挑一个数——
     那正是本模块从头到尾在拒绝的事。被剪掉的分支本来就没有节点、画不出来，
     它们在图上表现为"这个父亲的扇子比兄弟窄"，那恰恰就是要看见的东西。
     popStep < 0（截断、永不关闭）的帧照常参与布局：它是一个真实到过的节点，
     只是没关；有没有关不影响它在横向上占多宽。

     ---- 布局与游标无关 ----

     入参是 tree 不是 view：坐标必须**在整段演示里钉死**。若按"当前可见的
     节点"重算，每诞生一个孩子整棵树就要横向重排一次，看的人只会看见满屏
     乱跳，而"长出来一块"和"少掉一块"的对比也就没了。面板该做的是按 view
     决定每个节点画不画、什么颜色，而不是画在哪。

     ---- 三个返回值 ----
       pos      id → {x, y, z}。y 恒为 0：树铺在 y=0 这个平面上（引擎里几何
                体也在这个平面）。要不要把分数抬到 y 上是任务 6 的展示决定，
                布局不替它做——何况 value 可能是 null，抬高就得替"不知道"
                编一个高度。
       width    **实际**横向跨度（max x − min x），不是 spanX：最左最右两个
                叶子各自只占自己区间的中心，真实跨度恒比 spanX 少一点点。
                **width === 0 不等于"空树"**：只有一个节点的树、以及一整条
                单孩子链（每层都只有一个节点，全部叠在 x = 0 上）宽度同样是
                0，而它们都是货真价实的树——深度 1 且只有一步合法走法时就会
                长成这样。判空请一律看 `maxDepth < 0`，那是**唯一**没有歧义
                的信号；`if (!lay.width) return` 会把一棵单节点树悄悄跳过。
       maxDepth 最大树深；**空树是 -1**，与 build 的 rootId = -1 同一个用法
                ——"没有任何一层"不能写成 0，那会让 `for (d = 0; d <= maxDepth)`
                凭空多转一圈。

     实现两趟，都在 order 上迭代、不递归（截断的 d4 有 1,243 个节点，深度虽
     浅，但递归在这个模块里没有任何必要）。order 是先序、且孩子的 id 必然
     大于父亲的 id（孩子是后入帧的），所以：
       ① 正向一趟自上而下切区间（切孩子时父亲的区间已经算好）；
       ② 反向一趟自下而上定 x（定父亲时孩子的 x 已经算好）。

     多个顶层帧（轨迹里前后跑了两次搜索）时，spanX 按各自的叶子数分给它们，
     和处理兄弟节点是同一套——不为它专门设计，但也不让它挤成一团。 */
  function layout(tree, opts) {
    const o = opts || {};
    /* 非正数 / 非有限值一律退回默认值：这两个数是从面板尺寸算出来递进来的，
       容器还没布局好时拿到 0 或 NaN 是真实可达的，不该把整棵树算成 NaN。 */
    const spanX = (typeof o.spanX === 'number' && isFinite(o.spanX) && o.spanX > 0) ? o.spanX : 10;
    const spanZ = (typeof o.spanZ === 'number' && isFinite(o.spanZ) && o.spanZ > 0) ? o.spanZ : 1.5;

    const pos = Object.create(null);
    const t = (tree && tree.order) ? tree : { nodes: Object.create(null), rootId: -1, order: [] };
    const order = t.order, nodes = t.nodes;
    if (!order.length) return { pos: pos, width: 0, maxDepth: -1 };

    // ① 子树叶子数。反向扫 order：孩子的 id 大于父亲，所以孩子必然先算完。
    const leaves = Object.create(null);
    for (let k = order.length - 1; k >= 0; k--) {
      const n = nodes[order[k]];
      if (!n.childIds.length) { leaves[n.id] = 1; continue; }
      let sum = 0;
      for (let c = 0; c < n.childIds.length; c++) sum += leaves[n.childIds[c]];
      leaves[n.id] = sum;
    }

    /* ② 自上而下切区间。顶层帧先按叶子数瓜分 [−spanX/2, +spanX/2]。
       lo/w 只在这一趟里用得着，用两张表存，不往 pos 里塞中间量。 */
    const lo = Object.create(null), wide = Object.create(null);
    let topLeaves = 0;
    for (let k = 0; k < order.length; k++) {
      const n = nodes[order[k]];
      if (n.parentId < 0) topLeaves += leaves[n.id];
    }
    let cursor = -spanX / 2;
    for (let k = 0; k < order.length; k++) {
      const n = nodes[order[k]];
      if (n.parentId < 0) {
        const w = spanX * leaves[n.id] / topLeaves;
        lo[n.id] = cursor; wide[n.id] = w; cursor += w;
      }
      if (!n.childIds.length) continue;
      let at = lo[n.id];
      for (let c = 0; c < n.childIds.length; c++) {
        const cid = n.childIds[c];
        const w = wide[n.id] * leaves[cid] / leaves[n.id];
        lo[cid] = at; wide[cid] = w; at += w;
      }
    }

    /* ③ 自下而上定 x：叶子取自己区间的中心，内部节点取**首尾孩子的中点**
       （不是区间中心，理由见上）。反向扫 order，孩子必然先定好。 */
    let maxDepth = 0, minX = Infinity, maxX = -Infinity;
    for (let k = order.length - 1; k >= 0; k--) {
      const n = nodes[order[k]];
      let x;
      if (!n.childIds.length) {
        x = lo[n.id] + wide[n.id] / 2;
      } else {
        let a = Infinity, b = -Infinity;
        for (let c = 0; c < n.childIds.length; c++) {
          const cx = pos[n.childIds[c]].x;
          if (cx < a) a = cx;
          if (cx > b) b = cx;
        }
        x = (a + b) / 2;
      }
      pos[n.id] = { x: x, y: 0, z: n.depth * spanZ };
      if (n.depth > maxDepth) maxDepth = n.depth;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }

    return { pos: pos, width: maxX - minX, maxDepth: maxDepth };
  }

  return {
    build: build,
    nodeAt: nodeAt,
    layout: layout,
    createView: createView,
    seek: seek,
    visibleAt: visibleAt,
    spineAt: spineAt,
    prunedAt: prunedAt,
    statsAt: statsAt,
  };
});
