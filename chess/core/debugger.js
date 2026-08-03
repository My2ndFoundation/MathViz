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

  /* ---------------- locals：按「帧归属」回放 ----------------

     locals 必须只反映**当前帧**的局部变量。3a 的 varDelta 只带
     { name, from, to }，**不带作用域标识**，所以「这条改动属于哪一帧」必须
     从轨迹的形状反推出来。

     两条走不通的路（都实测验证过，不是推测）：

     (A) 全局按名扁平回放 —— 递归时同名参数跨帧串味：fact(3) 停在 i=9
         (depth 2) 会得到 n === undefined，正确答案是 2。

     (B) 深度窗口（只回放本帧区间内 depth 相同的步）—— 看似干净，但会**漏掉
         深帧对外层绑定的赋值**。累加器是阶段 5 六道题的通用形状：
             let sol = 0;
             function go(k) { if (k === 0) { sol = sol + 1; return; } go(k-1); go(k-1); }
             go(2); return sol;
         `sol = sol + 1` 记在 depth 3 的步上。深度窗口在最后的 `return sol`
         (depth 0) 只回放 depth 0 的步，于是显示 sol: 0，而程序真的返回 4；
         同时 depth 3 的帧里又凭空多出一个它并不拥有的 sol。两个方向都错。

     正确的做法是**帧归属回放**：维护一个帧栈，每条 delta 落到真正拥有那个
     名字的帧上。难点在于「声明遮蔽」与「对外层赋值」在中途那一步长得
     一模一样 —— 实测 `let t = 1; function g() { let t = 5; ... }` 与
     `let t = 1; function g() { t = 5; ... }` 的中途 delta 都是
     `{name:'t', from:1, to:5}`，**逐字节相同**。

     判别器是这一帧**自己的出帧拆除 delta**（轨迹已经录完，前瞻是免费的）：
         let t = 5 遮蔽外层 t   中途 {t,from:1,to:5}   出帧 [{t,from:5,to:1}]
         t = 5 赋值给外层 t     中途 {t,from:1,to:5}   出帧 []
         let q = 7（外层没有 q）中途 {q,to:7}          出帧 [{q,from:7}]
     出现在某帧出帧 delta 里的名字，就是**这一帧声明的**；不出现的，是一次
     向外触达的赋值。于是：
         owned(帧) = names(入帧步 varDelta) ∪ names(匹配的出帧步 varDelta)

     解析一条 delta 的归属时，按下面的优先级**逐级扫描整个帧栈**（先把规则 1
     在所有帧上试一遍，再试规则 2，最后才是规则 3 —— 顺序反了 `sol` 就会落进
     最内层帧）：
       1) owned 里有这个名字的帧（由内向外第一个）；
       2) 否则，当前 vars 里已经有这个名字的帧（全局帧就是这样认领 sol 和 t 的）；
       3) 否则，最内层的开着的帧（就地新建的绑定 —— 比如函数体内嵌套块里的
          `let b`，它由块自己的 closeScope 收尾，不会出现在函数的出帧 delta 里）。

     `to` 缺席表示这个名字**不再存在**（closeScope 在作用域退出时补的恢复
     delta），所以是删除而不是置 undefined。已知的信息缺口：`let a;` 产生的
     也是 to === undefined，从轨迹里无法与"名字消失"区分 —— 后果只是面板暂时
     不显示这个尚未赋值的名字，不会显示错误的值（详见任务报告的「关切」）。

     阶段 5 的六道算法题全是递归 + 累加器 —— 这里错了，那六道题的变量面板
     全是错的。 */

  /* 把每个入帧步配上它匹配的出帧步下标（没有匹配的记 -1）。
     匹配规则：出帧步按后进先出配对，用一个下标栈一趟扫完，O(n)。
     `upto` 是当前游标：一旦扫过了游标**且栈已空**，游标之前开的帧就全都
     配对完了，可以提前收工 —— 游标停在轨迹前段时不必扫完整条轨迹。
     注意不能只扫到 upto 就停：**游标处还开着的帧，它们的出帧步在 upto
     之后**，而 owned 正需要那一条。
     -1（没有匹配的出帧步）是**设计内**的情形，不是异常：撞上 STEP_LIMIT
     的轨迹（trace.truncated）会把帧永远留在开着的状态。此时 owned 退化成
     只有入帧 delta，函数照常返回，不抛。 */
  function matchFrames(trace, upto) {
    const popOf = {}, open = [];
    for (let k = 0; k < trace.length; k++) {
      const op = trace[k].frameOp;
      if (op === 'push') { popOf[k] = -1; open.push(k); }
      else if (op === 'pop') { const p = open.pop(); if (p !== undefined) popOf[p] = k; }
      if (k >= upto && open.length === 0) break;
    }
    return popOf;
  }

  /* 一个帧的 owned 名字集。用 Object.create(null) 而不是 {}：学习者完全
     可以写 `let __proto__ = 1;`（解释器接受，并照常发出 delta），而普通对象
     字面量会把这个名字吞掉 —— 面板上那一行会凭空消失。所有 per-frame 的
     映射（owned 与 vars）都因此走无原型对象。 */
  function ownedNames(trace, pushIdx, popOf) {
    const owned = Object.create(null);
    const own = function (deltas) {
      for (let m = 0; m < deltas.length; m++) owned[deltas[m].name] = true;
    };
    own(trace[pushIdx].varDelta);
    const q = popOf[pushIdx];
    if (q >= 0) own(trace[q].varDelta);
    return owned;
  }

  function newFrame(owned) {
    return { owned: owned || Object.create(null), vars: Object.create(null) };
  }

  /* 三级优先级，规则在外层、帧在内层：先看有没有哪一帧 own 了这个名字，
     再看有没有哪一帧当前就持有它，都没有才落到最内层帧。

     **规则 2 必须由「这条 delta 有没有 from」把门。** 没有 from 意味着这个
     名字在此之前哪儿都不存在 —— 那是一次**全新绑定**，只可能属于最内层的帧
     （规则 3）；有 from 才说明它在改一个已经存在于某处的绑定。

     不加这道门会让「块作用域声明 + 外层帧有同名变量」两头落空（实测回归）：
         function go(k) { if (k===0) { return 0; }
                          { let b = k*10; go(k-1); return b; } }
         return go(2);
     depth 2 那一帧的 `let b`（`{b, to:10}`，无 from）既不在入帧 delta 也不在
     出帧 delta 里（块作用域由块自己的 closeScope 收尾），规则 1 认不出；规则 2
     于是找到 depth 1 那一帧 —— 它此刻正持有自己的 b=20 —— 把它覆盖成 10；
     随后块拆除的 `{b, from:10}` 又从同一帧把它删掉。结果 b 在**两个帧里都消失**。
     加上这道门之后：`{b, to:10}` 无 from → 规则 3 → 落进 depth 2 自己的帧（正确）；
     它的拆除 `{b, from:10}` 有 from → 规则 2 → 命中此刻持有 b 的最内层帧，
     正是同一个 depth 2 帧 → 从正确的地方删掉。

     判据只能是 `d.from === undefined`，**不能**用 `'from' in d`：3a 的
     recordVarDelta 恒写全 {name, from, to} 三个键，`'from' in d` 永远是 true
     （JSON 里看不见只是因为 JSON.stringify 丢弃 undefined）。 */
  function ownerFrame(stack, d) {
    const name = d.name;
    for (let j = stack.length - 1; j >= 0; j--) if (stack[j].owned[name]) return stack[j];
    if (typeof d.from !== 'undefined') {
      for (let j = stack.length - 1; j >= 0; j--) if (name in stack[j].vars) return stack[j];
    }
    return stack[stack.length - 1];
  }

  function applyTo(frame, deltas) {
    for (let m = 0; m < deltas.length; m++) {
      const d = deltas[m];
      if (typeof d.to === 'undefined') delete frame.vars[d.name];
      else frame.vars[d.name] = d.to;
    }
  }

  /* locals(cur[, depth]) → { [name]: value }，某一帧的局部变量。规则见上面那段长注释。

     **depth 省略（或 null/undefined）= 当前最内层帧**，与本函数原来的唯一行为
     完全一致；给了 depth 就返回**那一帧**的变量。编号与 callStack 对齐：
         depth 0            全局帧（callStack 里没有它，它没有入/出帧步）
         depth k (k >= 1)   callStack(cur)[k - 1] 那一帧
     这个参数是给 3b 的调试面板「点调用栈某一帧 → 变量区显示那一帧的变量」用的。
     没有它，面板会把 A 帧的代码摆在 B 帧的变量旁边而不加任何说明 —— 对一个
     正在学「每次递归调用都有自己的 n」的人来说，那是最坏的一种并排。

     实现代价是 O(1)：下面那趟按帧归属的回放本来就把整个帧栈建了出来，
     这里只是从 `stack[stack.length - 1]` 改成 `stack[d]`，一行下标之差，
     没有任何算法改动。

     **越界的 depth 返回空对象，不夹到边界上。** 夹住会安静地显示另一帧的变量
     （面板看起来一切正常，值却属于别人）；返回空让「没有这一帧」当场看得见。
     负数同理。

     **调用方注意：返回的是无原型对象（Object.create(null)），不是普通对象。**
     这不是随手写的，是必需的：学习者完全可以写 `let __proto__ = 1;`，普通对象
     字面量会把这个名字写进原型而不是自有属性，Object.keys 拿不到，面板上那一行
     就凭空消失了。代价是这个返回值**没有** Object.prototype 上的方法：
         locals(cur).hasOwnProperty(x)   ✗ 抛 TypeError（不是函数）
         Object.prototype.hasOwnProperty.call(locals(cur), x)   ✓
         x in locals(cur)                ✓（无原型，in 只会命中自有属性）
     Object.keys / for…in / 属性读 / JSON.stringify 一切照常。 */
  function locals(cur, depth) {
    const trace = cur.trace, i = cur.i;
    if (!trace[i]) return Object.create(null);
    const popOf = matchFrames(trace, i);
    const stack = [newFrame()];            // 全局帧永远在栈底，它没有入/出帧步
    for (let k = 0; k <= i; k++) {
      const s = trace[k];
      if (s.frameOp === 'push') {
        /* 入帧步的 delta 是这次调用的**形参绑定**，直接落进新帧 ——
           这正是「形参遮蔽同名全局」能被正确分开的地方
           （let n = 99; function f(n) {…} 里 f 的 n 与全局的 n）。 */
        const f = newFrame(ownedNames(trace, k, popOf));
        stack.push(f);
        applyTo(f, s.varDelta);
        continue;
      }
      if (s.frameOp === 'pop') {
        /* 出帧步一条 delta 都不应用：那是拆除记录，closeScope 往 `to` 里写的
           是**外层**同名变量此刻的值，照单应用会把调用方/全局的值贴上被调方
           帧的标签（`let n = 99; function f(n){…}` 停在 f 的 return 上会显示
           「f 的 n = 99」）。
           帧只在 k < i 时才关闭，与 callStack 的约定一致 —— 停在 return 那一步
           时面板仍然显示「这一帧返回时的样子」，而不是已经跳回调用方。 */
        if (k < i && stack.length > 1) stack.pop();
        continue;
      }
      const deltas = s.varDelta;
      for (let m = 0; m < deltas.length; m++) {
        applyTo(ownerFrame(stack, deltas[m]), [deltas[m]]);
      }
    }
    /* 此刻 stack 正是 [全局帧, ...callStack(cur)]：push/pop 的收放边界
       （k <= i 压、k < i 弹）与 callStack 逐字相同，所以
       stack.length === callStack(cur).length + 1 在每个下标上都成立，
       depth 参数因此可以直接当下标用。 */
    if (depth === undefined || depth === null) return stack[stack.length - 1].vars;
    const d = depth | 0;
    if (d < 0 || d >= stack.length) return Object.create(null);
    return stack[d].vars;
  }

  /* 截至当前步的日志。
     判据是 `out !== null` —— **不是真值判断**。Step.out 是字符串：
     `log("")` 产出 `""`（假值），`log(0)` 产出 `"0"`。用 `if (s.out)` 过滤
     会让学习者写的空 log 行凭空消失，那正是本项目最不能容忍的安静谎话。
     下面那行**故意**比规格的 `out !== null` 再宽一点，连 undefined 一起挡掉：
     3a 的 newPending() 把 out 初始化成 null，正常轨迹里不会出现 undefined，
     但手搓的 Step（测试夹具、将来别的轨迹来源）少写一个 out 字段是很容易的，
     那时 `!== null` 会让一个 undefined 混进输出面板。这不是顺手写宽的，
     是明确要覆盖「字段缺席」这一种情况。
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

  /* ==================== DOM 层：五区面板与控制条（规格 §2.7） ====================

     以下所有代码**只在 mount() 被调用之后**才碰 document / window。上面的游标
     与六个派生函数一律零 DOM，node 测试套件（debugger.test.js）因此照常装载得了
     这个文件。这条分界线是本模块的架构承诺，不要越过它：任何判断都留在上面的
     纯函数里，这一层只负责把结果画出来。

     **为什么这里有一份缓存，而上面没有**：六个派生函数每次调用都从第 0 步重放
     整条轨迹（那是刻意的设计，见上面的注释）。实测（200k 步轨迹）单是 locals
     就要 8.45 ms，五区全量重算 14.72 ms——而本仓库给每帧绘制的预算是 4 ms。
     所以缓存必须存在，但它属于**这一层**：只在游标真的移动、或轨迹被换掉时
     重算一次，渲染循环只读缓存。反过来把缓存塞进 locals() 里会让那六个函数
     从纯函数变成有状态的东西，测试与推理都要跟着变贵。

     **不要假设「下一步一定换行」**：3b 对 interp.js 的修复会在进入新帧之前，
     先把调用方挂着的变量增量刷成独立的一步。于是连着两步停在同一源码行是
     正常轨迹（第一步是赋值，第二步才入帧），而且那条被刷出来的增量记在
     **调用点那一行**上——变量面板里可能出现一个在 for 头部声明的名字，而
     高亮还停在调用行。这是对的，不要在这一层"修"它。 */

  const DBG_CSS_ID = 'chess-debugger-dom-css';
  const DBG_CSS = [
    '.dbg-root{display:flex;flex-direction:column;gap:8px;min-height:0}',
    '.dbg-bar{display:flex;flex-wrap:wrap;gap:5px;align-items:center}',
    '.dbg-btn{padding:5px 9px;border-radius:8px;border:1px solid rgba(148,163,184,.25);',
    'background:rgba(30,41,59,.55);color:#d7e2f2;font-size:11.5px;cursor:pointer;',
    'font-family:inherit;transition:border-color .15s,color .15s,background .15s}',
    '.dbg-btn:hover:not(:disabled){border-color:rgba(45,212,234,.55);color:#bfefff}',
    '.dbg-btn:disabled{opacity:.4;cursor:default}',
    '.dbg-btn.on{border-color:rgba(45,212,234,.8);background:rgba(45,212,234,.12);color:#9be8f7}',
    '.dbg-speed{display:flex;align-items:center;gap:6px;margin-left:auto;font-size:11px;color:rgba(159,176,200,.8)}',
    '.dbg-speed input{width:96px}',
    '.dbg-speed b{font-family:ui-monospace,Menlo,monospace;font-weight:500;color:#7dd3fc;min-width:52px;text-align:right}',
    '.dbg-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;min-height:0}',
    '.dbg-pane{display:flex;flex-direction:column;min-height:0;background:rgba(8,13,24,.55);',
    'border:1px solid rgba(148,163,184,.14);border-radius:10px;overflow:hidden}',
    '.dbg-pane h4{margin:0;padding:6px 10px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;',
    'color:rgba(159,176,200,.62);border-bottom:1px solid rgba(148,163,184,.12);font-weight:600}',
    '.dbg-list{flex:1 1 auto;min-height:0;overflow:auto;padding:4px 0;',
    'font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:11.5px;line-height:1.65}',
    '.dbg-list::-webkit-scrollbar{width:7px}',
    '.dbg-list::-webkit-scrollbar-thumb{background:rgba(148,163,184,.26);border-radius:4px}',
    '.dbg-row{padding:1px 10px;color:#c6d2e4;white-space:pre-wrap;word-break:break-word}',
    '.dbg-frame{cursor:pointer}',
    '.dbg-frame:hover{background:rgba(45,212,234,.09);color:#bfefff}',
    '.dbg-frame.sel{background:rgba(167,139,250,.14);color:#ddd0ff}',
    '.dbg-frame .at{color:rgba(159,176,200,.5)}',
    '.dbg-var .nm{color:#7dd3fc}',
    '.dbg-var .eq{color:rgba(159,176,200,.5)}',
    '.dbg-var.chg{animation:dbgFlash .55s ease-out 1}',
    '@keyframes dbgFlash{0%{background:rgba(251,191,36,.42)}100%{background:transparent}}',
    '.dbg-out .dbg-row{color:rgba(159,176,200,.86)}',
    '.dbg-empty{padding:3px 10px;color:rgba(159,176,200,.38);font-style:italic}',
    '.dbg-readout{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:11px;',
    'line-height:1.7;color:#a9b8cd;padding:7px 10px;background:rgba(8,13,24,.55);',
    'border:1px solid rgba(148,163,184,.14);border-radius:10px}',
    '.dbg-readout b{color:#7dd3fc;font-weight:600}',
    '.dbg-readout .warn{color:#fb923c}',
  ].join('');

  const DBG_UI = {
    play:    { zh: '▶ 播放', en: '▶ Play' },
    pause:   { zh: '⏸ 暂停', en: '⏸ Pause' },
    step:    { zh: '单步 ▸', en: 'Step ▸' },
    back:    { zh: '◂ 后退', en: '◂ Back' },
    stepIn:  { zh: '步入', en: 'Step in' },
    stepOver:{ zh: '步过', en: 'Step over' },
    stepOut: { zh: '步出', en: 'Step out' },
    runTo:   { zh: '跑到断点', en: 'Run to bp' },
    speed:   { zh: '速度', en: 'Speed' },
    stack:   { zh: '调用栈', en: 'Call stack' },
    vars:    { zh: '变量', en: 'Variables' },
    out:     { zh: '输出', en: 'Output' },
    global:  { zh: '（全局）', en: '(global)' },
    noStack: { zh: '只有全局帧', en: 'global frame only' },
    noVars:  { zh: '本帧还没有变量', en: 'no variables in this frame yet' },
    selected:{ zh: '（已选中，执行位置未动）', en: '(selected — execution has not moved)' },
    noOut:   { zh: '还没有输出', en: 'no output yet' },
    stepsPerSec: { zh: ' 步/秒', en: ' steps/s' },
    roStep:  { zh: '步', en: 'step' },
    roLine:  { zh: '行', en: 'line' },
    roDepth: { zh: '深度', en: 'depth' },
    roBreaks:{ zh: '断点', en: 'breakpoints' },
    roTrunc: { zh: '轨迹已达上限，后续步数未记录', en: 'trace hit the step limit; later steps were not recorded' },
    keys:    { zh: 'F10 步过 · F11 步入 · Shift+F11 步出 · F9 断点 · F5 跑到断点',
               en: 'F10 step over · F11 step in · Shift+F11 step out · F9 breakpoint · F5 run to breakpoint' },
  };

  /* 播放节流的算术：把「已积攒的时间 + 本帧时长」换算成「这一帧该走几步」
     与「剩下多少时间留给下一帧」。纯函数、零 DOM，所以它在 node 里可测——
     「按时间推进、不按帧计数」这条硬约束的正确性全落在这几行上，它不该只能
     靠在浏览器里手喂 dt 来验。

     cap 是单帧步数上限。它的意义在批量化之后变了：以前每步都要重算一遍五个
     面板，cap 是在挡「一帧算 240 次」的墙钟灾难；现在一整批只重算一次，cap
     只剩下「别让一帧在轨迹上跑太远」这一个作用。

     dt <= 0（含 NaN）当 0 处理：引擎第一帧的 dt 可能是 0，不该让它把累加器
     搅成 NaN 之后再也走不动。sps <= 0 同理兜到 1。 */
  /* 实现用「乘以速率」一次算出步数，**不是**反复减去 1/sps 的循环。
     两个理由，第二个是实测出来的：
       1) O(1) 而不是 O(步数)；
       2) 反复减会把浮点误差累起来。实测 3.0 秒 @10 步/秒 走出 **29** 步：
          从 3.0 连减 29 次 0.1 之后余下 0.09999999999999973，比 0.1 差一点点，
          第 30 次的 `a >= iv` 就不成立了。改成 Math.floor(3.0 * 10) = 30，
          正是应有的答案（少的那一步虽然会留在 acc 里由下一帧补上，但
          「一秒钟到底走几步」不该靠下一帧来找齐）。 */
  /* EPS：把「差一个浮点末位就够一步」算作够了。
     这不是随手加的容差，是实测的：60 帧各喂 1/60 秒，累加出来的 a 是
     0.9999999999999999 而不是 1.0（二进制里 1/60 不精确），×10 得
     9.999999999999998，floor 成 9 —— 满一秒却只走了 9 步。30 帧各喂 1/30
     秒时又恰好凑够 10 步，于是同一段墙钟时间在 60 Hz 与 30 Hz 上走出不同
     的步数，正好踩中本项目要防的那件事（开发者的外接屏是 30 Hz）。
     1e-9 步是纳秒级的松弛，比任何真实计时分辨率都小若干个数量级，
     不可能凭空多走一步；而它足够盖住 IEEE754 在这个量级上的末位误差。 */
  const PLAY_EPS = 1e-9;
  /* 单帧步数上限的默认值。cap 省略时必须兜到它，**不能**让 Math.min(undefined, n)
     算出 NaN —— NaN 会写进调用方的累加器，而 NaN 一旦进去就再也出不来
     （NaN + dt 还是 NaN，NaN * rate 还是 NaN，floor 还是 NaN），播放从此
     静默死掉且不可恢复。本仓库唯一的调用点是传了 cap 的，但这是个导出给
     工具 ④⑤ 用的公开函数，下一个调用方会在另一个文件里安静地中招。
     同理挡掉 NaN / 负数 cap（Infinity 是有意义的"不设上限"，放行）。 */
  const PLAY_BURST_CAP = 240;
  function playSteps(acc, dt, sps, cap) {
    const lim = (typeof cap === 'number' && cap >= 0) ? cap : PLAY_BURST_CAP;
    const rate = sps > 0 ? sps : 1;
    const a = acc + (dt > 0 ? dt : 0);
    const n = Math.max(0, Math.min(lim, Math.floor(a * rate + PLAY_EPS)));
    return { steps: n, acc: Math.max(0, a - n / rate) };
  }

  function ensureDbgStyles() {
    if (document.getElementById(DBG_CSS_ID)) return;
    const st = document.createElement('style');
    st.id = DBG_CSS_ID;
    st.textContent = DBG_CSS;
    document.head.appendChild(st);
  }

  /* locals() 里的值**已经是 interp.js 的 snap() 快照**，不是活对象：
     snap() 会把函数值（解释出来的 {__fn:true,…} 和真 JS function 两种）
     就地换成字符串 `'ƒ 名字'`，把环形引用换成 `'[环形引用]'`，其余原样。
     所以下面这个前缀判断不是装饰：不加它，`ƒ safe` 会落进上一行的字符串
     分支被 JSON.stringify 加上一对引号，面板上显示成 `safe = "ƒ safe"`
     ——看起来像一个内容碰巧是这几个字的字符串变量，而不是一个函数。
     （实测抓到的，见任务报告。）
     代价是一个真的以 U+0192 加空格开头的用户字符串会被显示成不带引号的
     样子。这份歧义是 snap() 在轨迹里就已经造成的，不是这一层引入的——
     这一层只能选把常见情形显示对，而不是把它显示错。
     下面 function / __fn 两个分支因此在**正常轨迹上永远走不到**，留着是给
     没经过 snap() 的值用的：fmtVal 也被验收页拿去渲染 run().result，那个
     值是活的原值，不是快照。 */
  function fmtVal(v, depth) {
    depth = depth || 0;
    if (v === null) return 'null';
    if (typeof v === 'undefined') return 'undefined';
    if (typeof v === 'string') return v.slice(0, 2) === 'ƒ ' ? v : JSON.stringify(v);
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (typeof v === 'function') return 'ƒ ' + (v.name || '(anonymous)');
    if (typeof v === 'object' && v.__fn === true) return 'ƒ ' + (v.name || '(anonymous)');
    if (Array.isArray(v)) {
      if (depth >= 2) return '[…]';
      const parts = [];
      for (let k = 0; k < v.length && k < 12; k++) parts.push(fmtVal(v[k], depth + 1));
      if (v.length > 12) parts.push('… +' + (v.length - 12));
      return '[' + parts.join(', ') + ']';
    }
    if (typeof v === 'object') {
      if (depth >= 2) return '{…}';
      const keys = Object.keys(v), parts = [];
      for (let k = 0; k < keys.length && k < 8; k++) parts.push(keys[k] + ': ' + fmtVal(v[keys[k]], depth + 1));
      if (keys.length > 8) parts.push('… +' + (keys.length - 8));
      return '{' + parts.join(', ') + '}';
    }
    return String(v);
  }

  /* mount(el, cur, opts) → handle。

     opts:
       editor        Editor.mount() 的句柄。**代码区就是它**（规格 §2.8：
                     「当前执行行高亮（与调试器共用同一状态）」）——本模块不
                     另建第二个代码视图，只往这个句柄里写执行行/已访问行/断点。
       t             i18n 取值函数（页面传 VizEngine.t）。省略时退回英文。
       onCursorMove  游标移动且缓存已刷新之后调用，参数是 handle.state()。
       readout       可选：返回一段 HTML，追加进读数区（工具 ④⑤ 的尝试/回溯/
                     剪枝计数属于工具，不属于本模块）。
       keyTarget     绑快捷键的目标，默认 window。

     **本模块不自己起 rAF**：播放靠调用方每帧调一次 tick(dt)，dt 必须来自
     VizEngine.state.dt（引擎唯一的时钟出口，已 clamp 到 [0,0.05]）。按时间
     推进而不是按帧计数，是硬约束——开发者的外接屏是 30 Hz，任何按帧计数的
     速度在那台机器上都会慢一半。 */
  function mount(el, cur, opts) {
    opts = opts || {};
    ensureDbgStyles();
    const T = opts.t || function (s) { return (s && typeof s === 'object') ? (s.en != null ? s.en : s.zh) : s; };
    const editor = opts.editor || null;
    const keyTarget = opts.keyTarget || window;

    el.classList.add('dbg-root');
    el.textContent = '';

    const bar = document.createElement('div');
    bar.className = 'dbg-bar';
    function mkBtn(key, fn, title) {
      const b = document.createElement('button');
      b.className = 'dbg-btn';
      b.dataset.k = key;
      if (title) b.dataset.hint = title;
      b.addEventListener('click', fn);
      bar.appendChild(b);
      return b;
    }
    const bPlay = mkBtn('play', function () { setPlaying(!playing); });
    const bBack = mkBtn('back', function () { move(function (c) { return step(c, -1); }); });
    const bStep = mkBtn('step', function () { move(function (c) { return step(c, 1); }); });
    const bIn   = mkBtn('stepIn', function () { move(stepIn); }, 'F11');
    const bOver = mkBtn('stepOver', function () { move(stepOver); }, 'F10');
    const bOut  = mkBtn('stepOut', function () { move(stepOut); }, 'Shift+F11');
    const bRun  = mkBtn('runTo', function () { move(runTo); }, 'F5');

    const speedWrap = document.createElement('div');
    speedWrap.className = 'dbg-speed';
    const speedLab = document.createElement('span');
    const speedIn = document.createElement('input');
    speedIn.type = 'range';
    speedIn.min = '1'; speedIn.max = '120'; speedIn.step = '1'; speedIn.value = '10';
    const speedVal = document.createElement('b');
    speedWrap.appendChild(speedLab);
    speedWrap.appendChild(speedIn);
    speedWrap.appendChild(speedVal);
    bar.appendChild(speedWrap);

    const grid = document.createElement('div');
    grid.className = 'dbg-grid';
    function mkPane(cls) {
      const p = document.createElement('section');
      p.className = 'dbg-pane ' + cls;
      const h = document.createElement('h4');
      const list = document.createElement('div');
      list.className = 'dbg-list';
      p.appendChild(h);
      p.appendChild(list);
      return { pane: p, head: h, list: list };
    }
    const paneStack = mkPane('dbg-stack');
    const paneVars = mkPane('dbg-vars');
    const paneOut = mkPane('dbg-out');
    grid.appendChild(paneStack.pane);
    grid.appendChild(paneVars.pane);

    const readoutEl = document.createElement('div');
    readoutEl.className = 'dbg-readout';

    el.appendChild(bar);
    el.appendChild(grid);
    el.appendChild(paneOut.pane);
    el.appendChild(readoutEl);

    /* ---------------- 缓存：只在游标移动 / 换轨迹 / 换选中帧时重算 ---------------- */
    let cache = null;
    let prevVals = Object.create(null);   // 上一**步**的变量渲染文本，用来判定"这一步变了谁"
    let flashed = Object.create(null);    // 上一步真的变了的那些名字
    let flashedFrame = -1;                // 那份标记是在哪一帧上算出来的
    /* 选中的调用栈帧。-1 = 跟随最内层（默认，也是每次单步之后自动回到的状态）；
       >= 0 则是显式选中的一帧，0 是全局帧。选中一帧会同时改**两样**东西：
       代码视图跳到那一帧的行，**变量区换成那一帧的变量**。只跳代码不换变量，
       等于把 A 帧的代码摆在 B 帧的变量旁边而不加说明——对一个正在学
       「每次递归调用都有自己的 n」的人，那是最坏的一种并排。 */
    let selFrame = -1;

    function recompute() {
      const stack = callStack(cur);
      /* selFrame < 0 时传 undefined，让 locals 走它的默认分支（最内层帧）；
         选中某一帧时传那一帧的 depth。越界（选中的帧因为游标移动已经不在栈上）
         由 locals 自己返回空对象，这里不额外兜。 */
      const lv = locals(cur, selFrame < 0 ? undefined : selFrame);
      const vals = Object.create(null);
      const names = Object.keys(lv).sort();
      for (let k = 0; k < names.length; k++) vals[names[k]] = fmtVal(lv[names[k]]);
      const shown = selFrame < 0 ? stack.length : selFrame;
      cache = {
        i: cur.i, len: cur.trace.length,
        truncated: !!cur.trace.truncated,
        line: currentLine(cur),
        depth: stack.length,
        visited: visitedLines(cur),
        stack: stack,
        /* varsFrame：变量区此刻显示的是**哪一帧**。面板标题写出来，
           不让使用者自己猜（规格 §2.7 的变量区只说"当前作用域"，而一旦
           允许点栈帧，"当前"就有两个可能的意思了）。 */
        varsFrame: shown,
        varsFrameName: shown === 0 ? null : ((stack[shown - 1] && stack[shown - 1].name) || '(anonymous)'),
        selected: selFrame >= 0,
        names: names, vals: vals,
        output: output(cur),
        board: boardState(cur),
      };
    }

    /* ---------------- 渲染 ---------------- */
    function rowText(cls, text) {
      const d = document.createElement('div');
      d.className = 'dbg-row ' + cls;
      d.textContent = text;
      return d;
    }
    function emptyRow(msg) {
      const d = document.createElement('div');
      d.className = 'dbg-empty';
      d.textContent = T(msg);
      return d;
    }

    function paintStack() {
      const frag = document.createDocumentFragment();
      const g = document.createElement('div');
      g.className = 'dbg-row dbg-frame' + (selFrame === 0 ? ' sel' : '');
      g.dataset.fi = '0';
      g.textContent = T(DBG_UI.global);
      frag.appendChild(g);
      for (let k = 0; k < cache.stack.length; k++) {
        const f = cache.stack[k];
        const d = document.createElement('div');
        d.className = 'dbg-row dbg-frame' + (selFrame === k + 1 ? ' sel' : '');
        d.dataset.fi = String(k + 1);
        d.dataset.line = String(f.line);
        const nm = document.createElement('span');
        nm.textContent = '  '.repeat(k) + (f.name || '(anonymous)') + '()';
        const at = document.createElement('span');
        at.className = 'at';
        at.textContent = '  @' + T(DBG_UI.roLine) + ' ' + f.line;
        d.appendChild(nm);
        d.appendChild(at);
        frag.appendChild(d);
      }
      if (!cache.stack.length) frag.appendChild(emptyRow(DBG_UI.noStack));
      paneStack.list.textContent = '';
      paneStack.list.appendChild(frag);
    }

    /* paintVars(isStep) —— **琥珀色闪烁的唯一含义是「这一步变了」。**
       因此只有真的走了一步（游标移动或换轨迹）才允许比对与重置基线；
       任何"不是一步"的重绘（点栈帧换看哪一帧、切语言）都必须 isStep=false：
       不闪，也**不动 prevVals**。

       两个具体的坏法，都是这条不变量被破坏的样子：
       ① 点外层帧时若照常比对，prevVals 还是最内层帧的值、cache.vals 已是
          外层帧的值，两帧的变量名基本不重合 —— 整屏变量一起闪，而根本没有
          任何一步发生；
       ② 更隐蔽的是接下来那一下 F10：若刚才顺手把 prevVals 重置成了外层帧的
          值，这一步就会拿最内层帧的新值去跟**另一帧**的旧值比，于是又闪一屏。
       验收清单第 23 条把"凭空的琥珀色"直接判成 bug，这里正是它的另一个来源。 */
    function paintVars(isStep) {
      /* 标记归属于一对 (哪一步, 哪一帧)：
         - 真的走了一步 → 现算，记下来，并把基线推进到本步的值；
         - 不是一步 → **原样复用**上一步算出来的那份标记，前提是现在显示的
           还是同一帧。只把 changed 一律当 false 会把当前这一步的琥珀色抹掉
           （切语言时就会这样）；而不看帧就复用，又会把最内层帧变了的名字
           标到外层帧同名的变量上。两个条件都要。 */
      let marks;
      if (isStep) {
        marks = Object.create(null);
        for (let k = 0; k < cache.names.length; k++) {
          const n = cache.names[k];
          if (prevVals[n] !== cache.vals[n]) marks[n] = true;
        }
        flashed = marks;
        flashedFrame = cache.varsFrame;
        prevVals = cache.vals;
      } else {
        marks = (cache.varsFrame === flashedFrame) ? flashed : Object.create(null);
      }
      const frag = document.createDocumentFragment();
      for (let k = 0; k < cache.names.length; k++) {
        const n = cache.names[k];
        const changed = !!marks[n];
        const d = document.createElement('div');
        d.className = 'dbg-row dbg-var' + (changed ? ' chg' : '');
        const nm = document.createElement('span');
        nm.className = 'nm';
        nm.textContent = n;
        const eq = document.createElement('span');
        eq.className = 'eq';
        eq.textContent = ' = ';
        d.appendChild(nm);
        d.appendChild(eq);
        d.appendChild(document.createTextNode(cache.vals[n]));
        frag.appendChild(d);
      }
      if (!cache.names.length) frag.appendChild(emptyRow(DBG_UI.noVars));
      paneVars.list.textContent = '';
      paneVars.list.appendChild(frag);
      /* 标题写出这一栏显示的是哪一帧的变量。选中外层帧时额外加一个记号，
         省得看着一屏不熟悉的值去猜「程序是不是跳走了」——执行位置并没有动。 */
      paneVars.head.textContent = T(DBG_UI.vars) + ' · ' +
        (cache.varsFrameName ? cache.varsFrameName + '()' : T(DBG_UI.global)) +
        (cache.selected ? '  ' + T(DBG_UI.selected) : '');
    }

    /* 输出区增量渲染：日志只在末尾增删（输出是 [0, i] 的前缀），所以
       前进时只追加、后退时只砍尾，不整块重建——重建会把使用者的滚动位置
       每一步都甩回顶部。 */
    let outLen = 0;
    function paintOut() {
      const want = cache.output.length;
      if (want < outLen) {
        while (paneOut.list.children.length > want) paneOut.list.removeChild(paneOut.list.lastChild);
      } else if (want > outLen) {
        if (outLen === 0) paneOut.list.textContent = '';
        const frag = document.createDocumentFragment();
        for (let k = outLen; k < want; k++) frag.appendChild(rowText('', cache.output[k]));
        paneOut.list.appendChild(frag);
        paneOut.list.scrollTop = paneOut.list.scrollHeight;
      }
      outLen = want;
      if (!want && !paneOut.list.children.length) paneOut.list.appendChild(emptyRow(DBG_UI.noOut));
    }

    function paintReadout() {
      const nBreaks = Object.keys(cur.breakpoints).length;
      let html = '<b>' + (cache.len ? cache.i + 1 : 0) + '</b> / ' + cache.len + ' ' + T(DBG_UI.roStep) +
                 ' &middot; ' + T(DBG_UI.roLine) + ' <b>' + (cache.line == null ? '—' : cache.line) + '</b>' +
                 ' &middot; ' + T(DBG_UI.roDepth) + ' <b>' + cache.depth + '</b>' +
                 ' &middot; ' + T(DBG_UI.roBreaks) + ' <b>' + nBreaks + '</b>';
      if (cache.truncated) html += '<br><span class="warn">' + T(DBG_UI.roTrunc) + '</span>';
      if (typeof opts.readout === 'function') {
        const extra = opts.readout(cache);
        if (extra) html += '<br>' + extra;
      }
      html += '<br><span style="opacity:.62">' + T(DBG_UI.keys) + '</span>';
      readoutEl.innerHTML = html;
    }

    /* 一次性把三样调试状态推给编辑器。**必须走 setDebugState 这一个调用**，
       不能拆成 setVisited + setExecLine + setFrameLine——那是三次独立的
       refreshMarkers()，每次都要重建整块条纹层（有语法错时还各自重算一遍
       lineStarts）。播放时这条路径每帧都走，三倍开销白付。 */
    function paintEditor(frameLine) {
      if (!editor) return;
      editor.setDebugState({
        visited: cache.visited,
        execLine: cache.line,
        frameLine: frameLine == null ? null : frameLine,
        scrollTo: frameLine == null ? cache.line : frameLine,
      });
    }

    /* 游标移动之后的整套重算 + 重绘。**选中的帧在这里被清掉**：单步之后
       自动回到最内层帧，与主流调试器一致（她按了一下单步，看的就该是
       程序现在所在的那一帧）。 */
    function refresh() {
      selFrame = -1;
      repaint(null, true);          // ← 这是唯一一条「真的走了一步」的路径
    }

    /* 重算 + 重绘，但不动 selFrame。选中某一帧走这条路（游标没动，只是换了
       在看哪一帧），单步走上面的 refresh()。
       isStep 一路传给 paintVars —— 见那里关于琥珀色闪烁不变量的注释。 */
    function repaint(frameLine, isStep) {
      recompute();
      paintStack();
      paintVars(!!isStep);
      paintOut();
      paintReadout();
      paintEditor(frameLine);
      if (typeof opts.onCursorMove === 'function') opts.onCursorMove(cache);
    }

    /* move(fn)：单次游标移动的唯一出口。fn 返回「下标是否真的变了」——
       没变就不重绘（六个派生函数都是 O(i) 的，白算一遍没有任何意义）。
       播放的批量推进**不走这里**，见下面 tick() 的注释。 */
    function move(fn) {
      const changed = fn(cur);
      if (changed) refresh();
      return changed;
    }

    /* 点调用栈某一帧 = **选中**它：代码视图跳到那一帧的行，变量区换成那一帧的
       变量，标题写明在看哪一帧。**执行位置不动** —— 外层帧本来就还没执行到
       别处去，把游标挪过去等于凭空改写"程序现在在哪儿"。
       只跳代码、变量区还留在最内层帧，是明确被否掉的做法：那会把 A 帧的代码
       摆在 B 帧的变量旁边而不加任何说明，对一个正在学「每次递归调用都有自己的
       n」的人来说，恰恰是这一阶段要防的那种并排。 */
    paneStack.list.addEventListener('click', function (e) {
      const row = e.target && e.target.closest ? e.target.closest('.dbg-frame') : null;
      if (!row) return;
      selFrame = +row.dataset.fi;
      const line = row.dataset.line ? +row.dataset.line : cache.line;
      repaint(selFrame === 0 ? null : line, false);   // 不是一步：不闪、不重置基线
    });

    /* ---------------- 播放：按时间推进，不按帧计数 ----------------

       **一整批只重算一次。** 这里曾经是每走一步就 move(stepIn) 一次，而 move
       会 refresh() → recompute()（六趟 O(i) 回放）+ 全量重绘。于是播放时的
       每帧代价 = 本帧步数 × 一次全量重算：滑杆拉到 120 步/秒、60 fps 时约是
       每帧两次全量重算，在工具 ④⑤ 那种 200k 步轨迹上（实测一次五区重算
       14.72 ms）就是每帧 ~29 ms，而绘制预算只有 4 ms；补帧那一下更可以是
       240 × 14.72 ms ≈ 3.5 秒的界面冻结。缓存挡得住"空闲帧不重算"，挡不住
       这个乘数——播放循环本身就是热点。
       现在：先把游标连着推 N 次（每次都是纯下标移动，O(1)），推完之后
       refresh() 一次。代价从 O(N · i) 降到 O(i)。 */
    const BURST_CAP = PLAY_BURST_CAP;
    let playing = false, acc = 0, sps = 10;
    function setPlaying(v) {
      playing = !!v && cur.trace.length > 0;
      acc = 0;
      syncPlayButton();
    }
    function tick(dt) {
      if (!playing) return;
      const plan = playSteps(acc, dt, sps, BURST_CAP);
      acc = plan.acc;
      if (!plan.steps) return;
      let moved = false, atEnd = false;
      for (let k = 0; k < plan.steps; k++) {
        if (stepIn(cur)) moved = true;         // 纯下标移动，不重绘
        else { atEnd = true; break; }
      }
      if (moved) refresh();                    // ← 一整批就这一次
      if (atEnd) setPlaying(false);            // 到末尾自动停（refresh 之后，读的是新缓存）
    }
    speedIn.addEventListener('input', function () {
      sps = +speedIn.value || 1;
      acc = 0;
      syncSpeedLabel();
    });

    /* ---------------- 快捷键（规格 §5.4） ----------------
       **只处理这五个键，其余一律放行。** 方向键、退格、字母、Tab……全都属于
       编辑器，被这里吞掉一次，代码面板就再也编辑不了了。所以这里写的是
       白名单 + 命中才 preventDefault，绝不是"先 preventDefault 再看看"。
       带 Ctrl/Meta/Alt 的组合同样放行（Ctrl+F5 是浏览器的强制刷新）。 */
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      let hit = false;
      if (e.key === 'F10' && !e.shiftKey) { move(stepOver); hit = true; }
      else if (e.key === 'F11') { move(e.shiftKey ? stepOut : stepIn); hit = true; }
      else if (e.key === 'F9' && !e.shiftKey) { toggleBreakAt(breakLine()); hit = true; }
      else if (e.key === 'F5' && !e.shiftKey) { move(runTo); hit = true; }
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
    }
    keyTarget.addEventListener('keydown', onKey);

    /* F9 打在哪一行：编辑器有焦点就打在光标所在行（她正看着那一行），
       否则打在当前执行行。两者都取不到时什么也不做。 */
    function breakLine() {
      if (editor && document.activeElement === editor.textarea) return editor.caretLine();
      return cache ? cache.line : null;
    }
    function toggleBreakAt(line) {
      if (line == null) return;
      toggleBreak(cur, line);
      if (editor) editor.setBreakpoints(function (ln) { return hasBreak(cur, ln); });
      paintReadout();
    }

    /* 播放键与速度标签各自单独同步。setPlaying / 速度滑杆以前调的是整个
       relabel()，而 relabel() 末尾会重绘栈/变量/读数——那不但白画，还会把
       变量区刚刚点亮的「本步变了谁」的闪烁一次性抹掉（重绘时 prevVals 已经
       等于 cache.vals，没有一个名字算"变了"）。 */
    function syncPlayButton() {
      bPlay.textContent = T(playing ? DBG_UI.pause : DBG_UI.play);
      bPlay.classList.toggle('on', playing);
    }
    function syncSpeedLabel() {
      speedVal.textContent = sps + T(DBG_UI.stepsPerSec);
    }

    function relabel() {
      syncPlayButton();
      bBack.textContent = T(DBG_UI.back);
      bStep.textContent = T(DBG_UI.step);
      bIn.textContent = T(DBG_UI.stepIn);
      bOver.textContent = T(DBG_UI.stepOver);
      bOut.textContent = T(DBG_UI.stepOut);
      bRun.textContent = T(DBG_UI.runTo);
      [bIn, bOver, bOut, bRun].forEach(function (b) { b.title = b.dataset.hint; });
      speedLab.textContent = T(DBG_UI.speed);
      syncSpeedLabel();
      paneStack.head.textContent = T(DBG_UI.stack);
      paneVars.head.textContent = T(DBG_UI.vars);   // paintVars 会补上"· 哪一帧"
      paneOut.head.textContent = T(DBG_UI.out);
      /* 切语言也不是一步：重画可以，但不能把当前这一步的琥珀色标记抹掉，
         更不能把基线重置成本步的值（那会让紧接着的下一步少闪一片）。 */
      if (cache) { paintStack(); paintVars(false); paintReadout(); }
    }

    if (editor) {
      editor.setBreakpoints(function (ln) { return hasBreak(cur, ln); });
      editor.onGutterClick(function (ln) { toggleBreakAt(ln); });
    }
    relabel();
    refresh();

    return {
      root: el,
      cursor: function () { return cur; },
      /* 换轨迹（Run 之后）：新游标、清缓存、面板从第 0 步重画。断点跟着新的
         cur 走——调用方若想保留断点，自己在建新 cur 时把 breakpoints 搬过去。 */
      setCursor: function (next) {
        cur = next;
        playing = false;
        acc = 0;
        /* 旧轨迹的缓存必须当场作废，且**在它被作废之前不能画任何东西**。
           这里原来先调 relabel()，而 relabel() 末尾有
           `if (cache) { paintStack(); paintVars(); paintReadout(); }` ——
           那一下会拿**上一条轨迹**的 cache 去配**新轨迹**的 cur.breakpoints
           画一遍读数（两条轨迹混在同一行里），更要命的是 paintVars() 末尾的
           `prevVals = cache.vals` 会把旧程序的值存成"上一次"，于是新轨迹第 0 步
           的第一次 refresh 会拿新值去跟旧程序的值比，凭空闪一片琥珀色。
           改成：先作废 cache，refresh() 之后再同步按钮文案（只同步按钮，
           不重绘面板——见 syncPlayButton 的注释）。 */
        cache = null;
        prevVals = Object.create(null);
        flashed = Object.create(null);
        flashedFrame = -1;
        outLen = 0;
        paneOut.list.textContent = '';
        if (editor) editor.setBreakpoints(function (ln) { return hasBreak(cur, ln); });
        refresh();
        syncPlayButton();
      },
      state: function () { return cache; },
      refresh: refresh,
      relabel: relabel,
      tick: tick,
      isPlaying: function () { return playing; },
      setPlaying: setPlaying,
      speed: function () { return sps; },
      toggleBreakAt: toggleBreakAt,
      destroy: function () {
        keyTarget.removeEventListener('keydown', onKey);
        el.textContent = '';
        el.classList.remove('dbg-root');
      },
    };
  }

  return {
    create: create, goto: goto, step: step,
    stepIn: stepIn, stepOver: stepOver, stepOut: stepOut, runTo: runTo,
    toggleBreak: toggleBreak, hasBreak: hasBreak,
    currentLine: currentLine, visitedLines: visitedLines, callStack: callStack,
    locals: locals, output: output, boardState: boardState,
    mount: mount, fmtVal: fmtVal, playSteps: playSteps,
  };
});
