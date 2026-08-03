/* 调试器游标：纯逻辑，零 DOM —— 在 Interp.run(...).trace 这条**已经录完**
   的轨迹上移动一个下标，从不驱动生成器。
   零依赖；node 与浏览器双用。编辑源，运行时被内联进 tools/*.html。

   步入 / 步过 / 步出全部是在**已记录的轨迹**上移动下标，不驱动生成器。
   这是规格 §2.7「先跑完、记全轨迹、再回放」的直接后果 —— 「后退」只有
   这样才做得到，而后退是这套调试器最贵的功能。判据是每条 Step 的 depth：
     步入 = 前进一步（深度可能变大）
     步过 = 前进到 depth <= 当前
     步出 = 前进到 depth <  当前
   在最外层步出没有「更浅的下一步」，此时跑到末尾 —— 这与主流调试器
   一致（VS Code 里在顶层 Step Out 就是继续跑完）。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Debugger = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* create(trace) → cur：trace **不**保证非空——空源码或纯空白源码
     （`''`、`'   '`）经 interp.run(...) 产出的 trace 长度就是 0（清空
     编辑器缓冲区是阶段 3b 真实可达的状态，不是理论边角）。cur.i 仍然从
     0 起步——「停在第一步」是唯一自然的初始状态，即使这个"第一步"在
     空轨迹上根本不存在也一样，因为 create() 本身不解引用 trace，只有
     真正要读某个下标对应的 Step 时才需要关心这件事（每个这么做的函数
     自己负责在空轨迹上短路，见 goto/stepOver/stepOut 各自的注释）。
     breakpoints 用一个普通对象当 Set-like（key 是行号的字符串形式），
     不用真正的 Set，是为了在没有 Set 的极旧环境（这个子项目全程
     node/浏览器双跑，但没理由多依赖一个未必到处都有的构造器）里也一样
     成立——反正这里只需要增/删/查三个操作。 */
  function create(trace) {
    return { trace: trace, i: 0, breakpoints: {} };
  }

  /* 把下标夹到 [0, trace.length-1]。trace 长度**不**恒 >= 1——空白或纯空白
     源码（`''`、`'   '`）会让 interp.run(...).trace 长度是 0（已用
     `I.run('', {host:{}})` 验证过，不是猜测），这是可达的真实场景：阶段
     3b 的编辑器允许清空缓冲区。`create([])` 之后 `cur.i` 落在 0，指向一个
     不存在的元素——本模块的每一个 mover 都必须在这种输入下安全 no-op，
     不能抛异常（清空编辑器不该让调试面板崩掉）。
     当 trace.length === 0 时，`trace.length - 1 === -1`，`Math.min` 与
     `Math.max` 这两行会把 clamped 算成 0——与 `cur.i` 的初始值一致，
     天然落进下面的"未移动"分支返回 false，不需要专门的空轨迹分支。
     返回值是「下标是否真的变了」，不是「参数是否合法」——goto(cur, cur.i)
     应该返回 false：调用方（比如 UI 层判断要不要重绘）关心的是有没有
     发生真正的移动。 */
  function goto(cur, i) {
    const clamped = Math.max(0, Math.min(cur.trace.length - 1, i | 0));
    if (clamped === cur.i) return false;
    cur.i = clamped;
    return true;
  }

  /* step(cur, delta) → bool：delta 是 +1 或 -1（也接受任意整数，语义是
     「移动这么多步，越界就夹住」），复用 goto 的夹范围/变没变判定，
     不重复写一遍。 */
  function step(cur, delta) {
    return goto(cur, cur.i + (delta | 0));
  }

  /* 从 i+1 开始找第一个满足 pred(trace[k]) 的下标；找不到就停在末尾
     （trace.length - 1）。stepOver/stepOut 共用这个扫描逻辑，区别只在
     pred 本身。已经在末尾时直接返回 false（无处可去），不进入循环——
     这也是"末尾调用是安全 no-op"这条契约的落脚点。 */
  function advanceWhile(cur, pred) {
    const trace = cur.trace;
    if (cur.i >= trace.length - 1) return false;
    for (let k = cur.i + 1; k < trace.length; k++) {
      if (pred(trace[k])) return goto(cur, k);
    }
    return goto(cur, trace.length - 1);
  }

  /* 步入 = 就是前进一步。在末尾时 step(cur,1) 天然返回 false（goto 夹住
     不动），无需额外判断。 */
  function stepIn(cur) {
    return step(cur, 1);
  }

  /* 步过 = 前进到 depth <= 当前深度的下一步——如果紧跟着的是被调用函数
     内部（depth 更深），一路跳过整段调用，直到深度回落到不高于当前。
     空轨迹（trace.length === 0）必须最先判掉：`cur.trace[cur.i]` 在这种
     输入下是 `undefined`，advanceWhile 自己的边界检查（`cur.i >=
     trace.length - 1`）虽然也能在空轨迹上安全返回 false，但那是在
     `.depth` 读取之后才会跑到的地方——base 那一行会在到达那个检查之前
     就先对 undefined 取 `.depth`，抛 TypeError。 */
  function stepOver(cur) {
    if (cur.trace.length === 0) return false;
    const base = cur.trace[cur.i].depth;
    return advanceWhile(cur, function (s) { return s.depth <= base; });
  }

  /* 步出 = 前进到 depth < 当前深度的下一步。在最外层（depth 已经是 0，
     不会再有更浅的下一步）时，advanceWhile 找不到满足条件的位置，
     退到 trace.length-1——效果就是"跑到末尾"，与主流调试器一致。
     空轨迹判空的理由同 stepOver。 */
  function stepOut(cur) {
    if (cur.trace.length === 0) return false;
    const base = cur.trace[cur.i].depth;
    return advanceWhile(cur, function (s) { return s.depth < base; });
  }

  function breakKey(line) { return String(line | 0); }

  function toggleBreak(cur, line) {
    const k = breakKey(line);
    if (cur.breakpoints[k]) delete cur.breakpoints[k];
    else cur.breakpoints[k] = true;
  }

  function hasBreak(cur, line) {
    return !!cur.breakpoints[breakKey(line)];
  }

  /* runTo(cur) → bool：前进到下一个断点行；没有命中则跑到末尾。
     从 i+1 开始找（不是 i）——断点设在游标当前所在的行时，F5 必须真的
     往前走一次，而不是「已经在断点上」就地不动，否则界面上看起来像
     冻住了。命中即停，不管命中的是第几个；trace 里同一行可能出现多次
     （循环体、多次调用同一函数），每次 runTo 只找**下一次**。 */
  function runTo(cur) {
    return advanceWhile(cur, function (s) { return hasBreak(cur, s.line); });
  }

  /* ==================== 由游标派生的显示数据 ====================
     六个纯函数，输入只有 cur，输出是五个面板各自要画的东西。全部是
     「从头回放到 cur.i」的**单趟线性扫描**，不缓存（阶段 5/6 再按实测
     决定要不要加缓存层，现在加是 YAGNI）。
     每一个都必须在空轨迹（trace.length === 0，清空编辑器缓冲区的真实
     状态）上安全返回空值而不抛异常，理由同 Task 1 各 mover 的注释。 */

  /* 当前行。空轨迹上返回 **null** 而不是 0 或 -1：源码行号是 1 起的，
     任何数字都会被高亮成某一行，而"没有任何一行是当前行"才是空缓冲区
     的实情——用 null 让调用方非显式处理不可，比悄悄高亮第 0 行诚实。 */
  function currentLine(cur) {
    const s = cur.trace[cur.i];
    return s ? s.line : null;
  }

  /* 已执行过的行（去重，按首次到达的顺序）。给编辑器画淡色痕迹用。
     含当前步自己——"当前行"同时也是"已访问的最后一行"。
     用普通对象当 Set-like，理由同 breakpoints。 */
  function visitedLines(cur) {
    const trace = cur.trace, seen = {}, lines = [];
    for (let k = 0; k <= cur.i && k < trace.length; k++) {
      const ln = trace[k].line, key = String(ln);
      if (!seen[key]) { seen[key] = true; lines.push(ln); }
    }
    return lines;
  }

  /* 调用栈，由外到内。规则：k <= i 的 push 压一帧，k < i 的 pop 弹一帧。
     两个边界不对称，不是笔误：
       - push 步**本身**已经身处新帧里（它的 depth 就是新帧的深度，
         varDelta 正是这次调用的形参绑定），所以 k === i 时要算进去；
       - pop 步记录的仍是**内层**（尚未 --）的 depth，函数直到下一步才
         真正回到调用方，所以 k === i 时**不能**弹。
     这样 callStack(cur).length === trace[cur.i].depth 在每一个下标上都
     成立（已用两条 fixture 的全下标循环钉住）。
     frame.line 取入帧那一步的行号 = **调用点所在行**（push 步的 node 是
     CallExpression），这与主流调试器对外层帧的显示一致。 */
  function callStack(cur) {
    const trace = cur.trace, frames = [];
    for (let k = 0; k <= cur.i && k < trace.length; k++) {
      const s = trace[k];
      if (s.frameOp === 'push') {
        frames.push({ name: s.frameName, line: s.line, depth: s.depth });
      } else if (s.frameOp === 'pop' && k < cur.i) {
        frames.pop();
      }
    }
    return frames;
  }

  /* locals 必须只反映**当前帧**的局部变量。
     3a 的 varDelta 只带 { name, from, to }，**不带作用域标识** —— 递归时
     同名参数在不同帧各有一份，全局按名扁平回放会跨帧串味。

     简报给的做法（"找到本帧起点，回放那个区间内的全部 varDelta"）**不够**，
     会静默算错。以 fact(3) 的真实轨迹为例（i / depth / frameOp / varDelta）：
         1  d1 push  n→3      3  d2 push  n→2      5  d3 push  n→1
         8  d3 pop   {n,from:1,to:undefined}       9  d2  -    []
     取 i=9（depth 2），本帧起点是 i=3。区间 [3,9] 的**全部** varDelta 扁平
     回放会依次应用 n→2、n→1，再应用第 8 步那条"删除 n"的 delta —— 得到
     n === undefined，而正确答案是 2。

     正确的规则是**深度窗口**：起点 = 最近一个 `frameOp==='push' && depth
     === 当前 depth` 的 k <= i（当前 depth 为 0 时起点是 0，全局帧没有 push），
     然后**只回放 [起点, i] 区间内 depth === 当前 depth 的那些步**。更深的
     帧 depth 恒严格更大，这个过滤把它们不多不少地排除干净。

     `to === undefined` 表示这个名字**不再存在**（closeScope 在作用域退出时
     补的恢复 delta：外层没有同名变量时 to 就是 undefined），因此删除而不是
     置为 undefined。已知的信息缺口：`let a;` 产生的也是 to === undefined，
     从轨迹里无法与"名字消失"区分——后果只是面板暂时不显示这个尚未赋值的
     名字，不会显示错误的值（详见任务报告的「关切」）。

     阶段 5 的六道算法题全是递归 —— 这里错了，那六道题的变量面板全是错的。 */
  function locals(cur) {
    const trace = cur.trace, s = trace[cur.i];
    if (!s) return {};
    const depth = s.depth;
    let start = 0;
    if (depth > 0) {
      for (let k = cur.i; k >= 0; k--) {
        if (trace[k].frameOp === 'push' && trace[k].depth === depth) { start = k; break; }
      }
    }
    const vars = {};
    for (let k = start; k <= cur.i; k++) {
      const step = trace[k];
      if (step.depth !== depth) continue;
      /* 出帧步**自己**那条 varDelta 要跳过：它是这一帧的拆除记录，而
         closeScope 写进 `to` 的是**外层同名变量此刻的值**（interp.js
         closeScope：`to = outer ? snap(outer.vars.get(name).value) : undefined`）。
         照单应用会把调用方/全局的值贴上被调方帧的标签显示出来 ——
         `let n = 99; function f(n){...}; f(5);` 停在 f 的出帧步时会显示
         「f 的 n = 99」，正是本阶段第一条约束要禁止的跨帧串味。
         跳过之后，出帧步显示的是「这一帧返回时的样子」（n = 5），这也是
         学习者单步停在 return 上时真正想看的东西。
         只可能命中 k === cur.i：depth 为 d 的出帧步会让深度回落，若它落在
         窗口中间，则其后必然还有一个 depth === d 的入帧步，而那个入帧步
         才会被选作 start —— 与前提矛盾。所以这一行不会误伤窗口内的其它步。 */
      if (step.frameOp === 'pop') continue;
      const d = step.varDelta;
      for (let m = 0; m < d.length; m++) {
        if (typeof d[m].to === 'undefined') delete vars[d[m].name];
        else vars[d[m].name] = d[m].to;
      }
    }
    return vars;
  }

  /* 截至当前步的日志。
     判据是 `out !== null` —— **不是真值判断**。Step.out 是字符串：
     `log("")` 产出 `""`（假值），`log(0)` 产出 `"0"`。用 `if (s.out)` 过滤
     会让学习者写的空 log 行凭空消失，那正是本项目最不能容忍的安静谎话。
     一步里连续多次 log 时 3a 把它们用 '\n' 拼进同一个 out（见 interp.js 的
     wrapHostForTrace），这里原样保留一条，不拆分——拆分会让"一步 = 一条
     记录"这个与游标对齐的关系变松。 */
  function output(cur) {
    const trace = cur.trace, lines = [];
    for (let k = 0; k <= cur.i && k < trace.length; k++) {
      const o = trace[k].out;
      if (o !== null && typeof o !== 'undefined') lines.push(o);
    }
    return lines;
  }

  /* 棋盘状态：全区间 [0, cur.i] 正向回放 boardOps。棋盘是全局的、不分帧，
     所以这里没有 locals 那套深度窗口。
     marks 与 pieces **分两个槽**（3a 的 B-4/I5 修复把影子状态分成两层，
     同一格可以同时有一枚棋子和一个标记——N 皇后"放皇后 + 标记它攻击的
     格子"就是这么写的），clear 一次清掉两层。
     实现选择：**从 0 正向重放**，因此完全不读 op.from。撤销信息（from）
     是给"沿轨迹倒着走"的实现用的；正向重放天然正确、且后退与前进走的是
     同一条代码路径，不会出现"前进对、后退错"这类只在某个方向上暴露的
     bug。代价是每次调用 O(i)，与其它五个函数同一量级。 */
  function boardState(cur) {
    const trace = cur.trace, marks = {}, pieces = {};
    for (let k = 0; k <= cur.i && k < trace.length; k++) {
      const ops = trace[k].boardOps;
      for (let m = 0; m < ops.length; m++) {
        const op = ops[m];
        if (op.kind === 'mark') marks[op.sq] = op.to;
        else if (op.kind === 'place') pieces[op.sq] = op.to;
        else if (op.kind === 'clear') { delete marks[op.sq]; delete pieces[op.sq]; }
      }
    }
    return { marks: marks, pieces: pieces };
  }

  return {
    create: create, goto: goto, step: step,
    stepIn: stepIn, stepOver: stepOver, stepOut: stepOut, runTo: runTo,
    toggleBreak: toggleBreak, hasBreak: hasBreak,
    currentLine: currentLine, visitedLines: visitedLines, callStack: callStack,
    locals: locals, output: output, boardState: boardState,
  };
});
