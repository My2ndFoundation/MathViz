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

  /* create(trace) → cur：trace 至少有一条 Step（interp.run 对任何非空
     程序都会记至少一条),cur.i 从 0 起步——「停在第一步」是调试器打开
     一段轨迹时唯一自然的初始状态。breakpoints 用一个普通对象当
     Set-like（key 是行号的字符串形式），不用真正的 Set，是为了在没有
     Set 的极旧环境（这个子项目全程 node/浏览器双跑，但没理由多依赖
     一个未必到处都有的构造器）里也一样成立——反正这里只需要
     增/删/查三个操作。 */
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

  return {
    create: create, goto: goto, step: step,
    stepIn: stepIn, stepOver: stepOver, stepOut: stepOut, runTo: runTo,
    toggleBreak: toggleBreak, hasBreak: hasBreak,
  };
});
