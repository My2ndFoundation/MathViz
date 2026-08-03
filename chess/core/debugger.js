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

  /* locals(cur) → { [name]: value }，当前帧的局部变量。规则见上面那段长注释。

     **调用方注意：返回的是无原型对象（Object.create(null)），不是普通对象。**
     这不是随手写的，是必需的：学习者完全可以写 `let __proto__ = 1;`，普通对象
     字面量会把这个名字写进原型而不是自有属性，Object.keys 拿不到，面板上那一行
     就凭空消失了。代价是这个返回值**没有** Object.prototype 上的方法：
         locals(cur).hasOwnProperty(x)   ✗ 抛 TypeError（不是函数）
         Object.prototype.hasOwnProperty.call(locals(cur), x)   ✓
         x in locals(cur)                ✓（无原型，in 只会命中自有属性）
     Object.keys / for…in / 属性读 / JSON.stringify 一切照常。 */
  function locals(cur) {
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
    return stack[stack.length - 1].vars;
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

  return {
    create: create, goto: goto, step: step,
    stepIn: stepIn, stepOver: stepOver, stepOut: stepOut, runTo: runTo,
    toggleBreak: toggleBreak, hasBreak: hasBreak,
    currentLine: currentLine, visitedLines: visitedLines, callStack: callStack,
    locals: locals, output: output, boardState: boardState,
  };
});
