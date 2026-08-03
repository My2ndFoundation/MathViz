'use strict';
const T = require('./_test.js');
const I = require('./interp.js');
const D = require('./debugger.js');

/* 用真实的解释器轨迹做 fixture，而不是手搓一个假 trace ——
   手搓的假 trace 会悄悄偏离真实形状，而这个模块的全部正确性
   都建立在「真实轨迹长什么样」上。 */
const SRC = [
  'function inner(x) {',      // 1
  '  return x + 1;',          // 2
  '}',                        // 3
  'function outer(y) {',      // 4
  '  const a = inner(y);',    // 5
  '  return a * 2;',          // 6
  '}',                        // 7
  'const r = outer(3);',      // 8
  'return r;',                // 9
].join('\n');
const trace = I.run(SRC, { host: {} }).trace;

// ---- 基本移动 ----
const cur = D.create(trace);
T.eq(cur.i, 0, '初始停在第 0 步');
T.eq(D.step(cur, 1), true, '前进一步');
T.eq(cur.i, 1, 'i 变成 1');
T.eq(D.step(cur, -1), true, '后退一步');
T.eq(cur.i, 0, 'i 回到 0');
T.eq(D.step(cur, -1), false, '已在开头，再后退无效');
T.eq(D.goto(cur, 9999), true, '越界被夹到末尾');
T.eq(cur.i, trace.length - 1, '夹到最后一步');
T.eq(D.step(cur, 1), false, '已在末尾，再前进无效');

// ---- 步入 / 步过 / 步出：判据是 depth ----
/* 找到第一处 frameOp==='push' 的位置，它的前一步就是「即将进入函数的那一行」。 */
const pushAt = trace.findIndex(s => s.frameOp === 'push');
T.ok(pushAt > 0, '轨迹里有入帧标记');

const over = D.create(trace);
D.goto(over, pushAt - 1);
const depthBefore = trace[pushAt - 1].depth;
D.stepOver(over);
T.ok(trace[over.i].depth <= depthBefore, '步过之后深度不高于原来 —— 整个函数调用被跳过了');

const into = D.create(trace);
D.goto(into, pushAt - 1);
D.stepIn(into);
T.eq(into.i, pushAt, '步入就是前进一步，落在入帧那一步');

const out = D.create(trace);
D.goto(out, pushAt);
const depthIn = trace[pushAt].depth;
D.stepOut(out);
T.ok(trace[out.i].depth < depthIn, '步出之后深度严格变小');

// 在最外层步出：走到末尾而不是原地不动
const outTop = D.create(trace);
D.goto(outTop, 0);
D.stepOut(outTop);
T.eq(outTop.i, trace.length - 1, '在深度 0 步出 = 跑到末尾');

// ---- 断点 ----
const bp = D.create(trace);
T.eq(D.hasBreak(bp, 2), false, '初始没有断点');
D.toggleBreak(bp, 2);
T.eq(D.hasBreak(bp, 2), true, '设上了');
D.toggleBreak(bp, 2);
T.eq(D.hasBreak(bp, 2), false, '再点一次取消');

const run = D.create(trace);
D.toggleBreak(run, 2);          // inner 的 return 那一行
D.goto(run, 0);
T.eq(D.runTo(run), true, '跑到断点');
T.eq(trace[run.i].line, 2, '停在断点所在的行');

// 没有断点时跑到末尾
const runNone = D.create(trace);
D.goto(runNone, 0);
D.runTo(runNone);
T.eq(runNone.i, trace.length - 1, '没有断点就跑到末尾');

/* 注意：简报原文这里紧跟着 T.report()——但 T.report() 会 process.exit()，
   若在此处调用，下面的补充测试永远不会执行。所以把简报的 T.report()
   调用挪到本文件末尾（补充测试之后），只保留一次。 */

/* ============================================================
   以下是本任务派发者要求的补充测试（超出简报底线）：cursor 的
   契约在这几个角落如果不测，很容易悄悄做出一个「看起来对，用起来
   错」的调试器。
   ============================================================ */

// ---- stepOver 从帧内部出发不能逃出这一帧 ----
/* pushAt 本身就是 outer 的入帧步（depth=1，frameOp='push'，见派发简报
   验证过的真实轨迹表：i=2 是 push/outer/depth1，i=3 才是 push/inner/
   depth2）——「身处 outer 内部、depth=1」这个落脚点就是 pushAt 自己，
   不需要往前挪一步。 */
T.eq(trace[pushAt].frameOp, 'push', 'pushAt 本身就是入帧步');
T.eq(trace[pushAt].frameName, 'outer', 'pushAt 入帧的是 outer（不是 inner）');
T.eq(trace[pushAt].depth, 1, 'outer 入帧深度为 1');

const overIn = D.create(trace);
D.goto(overIn, pushAt);
D.stepOver(overIn);
T.ok(trace[overIn.i].depth <= 1, '步过之后深度回到 outer 自己的层级或更浅');
T.ok(overIn.i < 9, 'stepOver 没有跳出 outer 帧，落在 depth<=1 的帧内步（< i=9 的顶层步，' +
     '否则说明它把 inner 调用连同 outer 剩余部分一起跳过去了）');

// ---- 每个 mover 在末尾都是安全的 no-op ----
function atEnd(label, fn, expectReturn) {
  const c = D.create(trace);
  D.goto(c, trace.length - 1);
  let threw = false, ret;
  try { ret = fn(c); } catch (e) { threw = true; }
  T.ok(!threw, label + '：末尾调用不抛异常');
  T.eq(c.i, trace.length - 1, label + '：末尾调用不移动下标');
  if (expectReturn !== undefined) T.eq(ret, expectReturn, label + '：返回值符合"无法再动"的语义');
}
atEnd('step(+1)', c => D.step(c, 1), false);
atEnd('stepOver', c => D.stepOver(c), false);
atEnd('stepIn', c => D.stepIn(c), false);
atEnd('stepOut', c => D.stepOut(c), false);
atEnd('runTo', c => D.runTo(c), false);

// ---- toggleBreak / hasBreak 在没有语句落在该行时也不能抛 ----
const NO_STEP_LINE = 3; // 源码第 3 行是单独的 '}'，不会有任何 Step.line === 3
T.ok(!trace.some(s => s.line === NO_STEP_LINE), '确认第 3 行确实没有任何步（否则下面的断言不成立）');
const blank = D.create(trace);
let blankThrew = false;
try {
  T.eq(D.hasBreak(blank, NO_STEP_LINE), false, '空行初始没有断点');
  D.toggleBreak(blank, NO_STEP_LINE);
  T.eq(D.hasBreak(blank, NO_STEP_LINE), true, '空行也能被点上断点（合法：用户可能点在 } 上）');
} catch (e) { blankThrew = true; }
T.ok(!blankThrew, '在没有语句落脚的行上 toggleBreak/hasBreak 不抛异常');

// ---- 断点设在游标当前所在的行：runTo 必须走到"下一次"命中，而不是原地不动 ----
const here = D.create(trace);
D.goto(here, pushAt); // 停在 pushAt，line = trace[pushAt].line
const curLine = trace[pushAt].line;
D.toggleBreak(here, curLine);
const movedToNext = D.runTo(here);
T.ok(here.i !== pushAt, 'runTo 从断点所在行出发必须离开原地（不能原地不动）');
T.ok(here.i > pushAt, 'runTo 前进而不是后退');
if (here.i < trace.length - 1) {
  T.eq(trace[here.i].line, curLine, '如果不是跑到末尾，停下的地方应该真的是断点命中');
} else {
  T.ok(movedToNext === true || movedToNext === false, 'runTo 到达末尾时返回值仍是合法布尔');
}

// ---- 空轨迹：清空的编辑器缓冲区（'' 或纯空白源码）产出 trace.length===0 ----
/* 这是真实可达的场景，不是构造出来的边角——先用真实解释器验证前提，
   否则如果哪天 interp.js 的空源码行为变了，这条测试应该大声失败，而不是
   悄悄测着一个已经不成立的假设。 */
const emptyTrace = I.run('', { host: {} }).trace;
T.eq(emptyTrace.length, 0, '前提：空源码产出长度为 0 的 trace（否则下面全部测试没有意义）');
const whitespaceTrace = I.run('   \n\t  ', { host: {} }).trace;
T.eq(whitespaceTrace.length, 0, '前提：纯空白源码同样产出长度为 0 的 trace');

/* 每个 mover 加上 toggleBreak/hasBreak 都必须在空轨迹上安全 no-op——
   用循环而不是一堆并排的 ad-hoc 用例，这样以后新增一个 mover 时，
   这条测试天然把它也覆盖进去，不需要有人记得手动加一行。 */
function checkEmptySafe(label, makeCur) {
  const movers = [
    ['goto', function (c) { return D.goto(c, 3); }],
    ['step(+1)', function (c) { return D.step(c, 1); }],
    ['step(-1)', function (c) { return D.step(c, -1); }],
    ['stepIn', function (c) { return D.stepIn(c); }],
    ['stepOver', function (c) { return D.stepOver(c); }],
    ['stepOut', function (c) { return D.stepOut(c); }],
    ['runTo', function (c) { return D.runTo(c); }],
  ];
  for (let m = 0; m < movers.length; m++) {
    const name = movers[m][0], fn = movers[m][1];
    const c = makeCur();
    let mThrew = false, mRet;
    try { mRet = fn(c); } catch (e) { mThrew = true; }
    T.ok(!mThrew, label + '.' + name + '：空轨迹上不抛异常');
    T.eq(c.i, 0, label + '.' + name + '：空轨迹上下标不变');
    T.eq(mRet, false, label + '.' + name + '：空轨迹上返回 false（没有发生真正的移动）');
  }

  const bpCur = makeCur();
  let bpThrew = false;
  try {
    T.eq(D.hasBreak(bpCur, 1), false, label + '.hasBreak：空轨迹上初始没有断点');
    D.toggleBreak(bpCur, 1);
    T.eq(D.hasBreak(bpCur, 1), true, label + '.toggleBreak：空轨迹上仍然能设置断点（不依赖轨迹内容）');
  } catch (e) { bpThrew = true; }
  T.ok(!bpThrew, label + '.toggleBreak/hasBreak：空轨迹上不抛异常');
}

checkEmptySafe('空源码派生的空轨迹', function () { return D.create(emptyTrace); });
checkEmptySafe('纯空白源码派生的空轨迹', function () { return D.create(whitespaceTrace); });
checkEmptySafe('手搓的字面量空数组', function () { return D.create([]); });

// ============ 派生显示数据 ============

// ---- 当前行与已访问行 ----
const disp = D.create(trace);
D.goto(disp, 0);
T.eq(D.currentLine(disp), trace[0].line, '当前行取自当前步');
D.goto(disp, 5);
T.ok(D.visitedLines(disp).indexOf(trace[0].line) >= 0, '已访问行含第 0 步的行');
T.ok(D.visitedLines(disp).indexOf(trace[trace.length - 1].line) < 0,
     '还没走到的行不算已访问');

// ---- 调用栈 ----
const st = D.create(trace);
const deepest = trace.reduce((best, s, k) => s.depth > trace[best].depth ? k : best, 0);
D.goto(st, deepest);
const stack = D.callStack(st);
T.eq(stack.length, trace[deepest].depth, '栈深与该步的 depth 一致');
T.ok(stack.every((f, k) => k === 0 || f.depth > stack[k - 1].depth), '由外到内深度递增');

// ---- locals：**必须是当前帧的**（约束 1）----
/* 递归里同名参数在不同帧各有一份。全局按名扁平回放会跨帧串味 ——
   这条测试就是拿递归来钉死它。 */
const REC = [
  'function fact(n) {',        // 1
  '  if (n <= 1) { return 1; }', // 2
  '  return n * fact(n - 1);', // 3
  '}',                         // 4
  'return fact(3);',           // 5
].join('\n');
const rt = I.run(REC, { host: {} }).trace;

/* 找到最深那一帧里的某一步（n 应该是 1），以及一个较浅帧里的步（n 应该是 3）。 */
const deepIdx = rt.reduce((best, s, k) => s.depth > rt[best].depth ? k : best, 0);
const deepCur = D.create(rt); D.goto(deepCur, deepIdx);
T.eq(D.locals(deepCur).n, 1, '最深帧里 n === 1');

const shallowIdx = rt.findIndex(s => s.depth === 1 && s.varDelta.some(d => d.name === 'n'));
const shallowCur = D.create(rt); D.goto(shallowCur, shallowIdx);
T.eq(D.locals(shallowCur).n, 3, '第一帧里 n === 3 —— 没有被更深的帧串味');

/* 块作用域遮蔽：3a 已经让轨迹在作用域退出时补恢复 delta，
   所以 locals 在块结束之后要看到外层的值。 */
const SH = 'let a = 1;\n{ let a = 2; }\nreturn a;';
const sht = I.run(SH, { host: {} }).trace;
const shc = D.create(sht); D.goto(shc, sht.length - 1);
T.eq(D.locals(shc).a, 1, '块结束后 a 是外层的 1，不是内层的 2');

// ---- 输出 ----
const OUT = 'log("a");\nlog("b");\nlog("c");';
const ot = I.run(OUT, { host: {} }).trace;
const oc = D.create(ot);
D.goto(oc, ot.length - 1);
T.eq(D.output(oc), ['a', 'b', 'c'], '截至末尾有三行');
const oc2 = D.create(ot);
/* 简报原文是 `(s, k)`，但回调从不读 s（静态检查会报未使用参数）——
   改成 `(_, k)`，语义完全不变。 */
const secondLog = ot.findIndex((_, k) => ot.slice(0, k + 1).filter(x => x.out).length === 2);
D.goto(oc2, secondLog);
T.eq(D.output(oc2), ['a', 'b'], '截至第二条日志只有两行 —— 输出跟着游标走');

// ---- 棋盘状态：正放与反放都要对 ----
const BD = 'mark(5, "trying");\nmark(5, "confirmed");\nclear(5);';
const bt = I.run(BD, { host: {} }).trace;
const bc = D.create(bt);
const afterFirst = bt.findIndex(s => s.boardOps.length);
D.goto(bc, afterFirst);
T.eq(D.boardState(bc).marks[5], 'trying', '第一次标记后是 trying');
D.goto(bc, bt.length - 1);
T.ok(typeof D.boardState(bc).marks[5] === 'undefined', 'clear 之后这一格没有标记');
D.goto(bc, afterFirst);
T.eq(D.boardState(bc).marks[5], 'trying', '**反放回去仍然是 trying** —— 撤销信息真的被用上了');
/* 注意：上一条断言的措辞过头了。本实现是「从 0 全区间正向回放」，压根
   不读 boardOps.from —— 断言本身仍然成立（回到第 0 步时重放只走一步，
   自然还是 trying），但它证明不了"撤销信息真的被用上了"。如实记在这里，
   而不是为了让注释成真去把实现拧成反向撤销（见任务报告）。 */

/* ============================================================
   以下是本任务派发者要求的、超出简报底线的补充测试。简报自己的两条
   locals 断言**没有牙齿**：deepIdx(=5) 与 shallowIdx(=1) 都恰好落在
   push 步上（起点 === 当前下标），窗口只有一步，扁平回放看起来也是对的。
   ============================================================ */

// ---- ① locals 的真正不变量：fact(3) 每一帧里 n === 4 - depth ----
/* 用循环遍历整条轨迹推导，而不是挑几个下标硬编码 —— 硬编码正是简报
   那两条断言失去牙齿的原因。扁平回放在 i=9 与 i=11 会得到 undefined
   （更深帧退出时的 pop delta 把 n 删掉了），这条测试因此会红。
   pop 步本身排除在外：那一步的 varDelta 正是在拆掉这一帧的绑定。 */
let recFrameChecks = 0;
for (let k = 0; k < rt.length; k++) {
  const s = rt[k];
  if (s.depth < 1 || s.frameOp === 'pop') continue;
  const c = D.create(rt); D.goto(c, k);
  T.eq(D.locals(c).n, 4 - s.depth,
       'fact(3) 第 ' + k + ' 步（depth=' + s.depth + '）里 n === ' + (4 - s.depth));
  recFrameChecks++;
}
T.ok(recFrameChecks >= 8,
     '上面这个循环真的跑了 ' + recFrameChecks + ' 次（>= 8）—— 循环体一次都没执行也能"通过"是假绿');

// ---- ② 不同名变量也不能跨帧渗漏 ----
/* 控制权回到 outer、a 刚绑上的那一步（depth 1，inner 已经出帧）：
   locals 里要有 y 和 a，且**不能**有 inner 的形参 x。
   缺席一律用 `typeof === 'undefined'` 判定，绝不用 T.eq(x, undefined)——
   _test.js 的 eq 走 JSON.stringify，而 JSON.stringify(function(){}) 与
   JSON.stringify(undefined) 都是 undefined，一个泄漏进来的函数值会让
   T.eq(x, undefined) 假绿。 */
const aBound = trace.findIndex(s => s.depth === 1 && s.frameOp !== 'pop' &&
                                    s.varDelta.some(d => d.name === 'a'));
T.ok(aBound > 0, 'SRC 轨迹里找得到「回到 outer 且 a 刚绑上」那一步');
const leakCur = D.create(trace); D.goto(leakCur, aBound);
const leakLocals = D.locals(leakCur);
T.eq(leakLocals.y, 3, 'outer 帧里 y === 3');
T.eq(leakLocals.a, 4, 'outer 帧里 a === 4');
T.ok(typeof leakLocals.x === 'undefined', 'inner 的形参 x 没有渗漏进 outer 帧');

// ---- ③ callStack 深度不变量：在两条 fixture 的**每一个**下标上都成立 ----
function checkStackDepthEverywhere(label, tr) {
  for (let k = 0; k < tr.length; k++) {
    const c = D.create(tr); D.goto(c, k);
    const s = D.callStack(c);
    T.eq(s.length, tr[k].depth, label + ' 第 ' + k + ' 步：栈深 === depth');
    T.ok(s.every((f, j) => j === 0 || f.depth > s[j - 1].depth),
         label + ' 第 ' + k + ' 步：帧由外到内深度严格递增');
  }
}
checkStackDepthEverywhere('SRC', trace);
checkStackDepthEverywhere('fact(3)', rt);

// ---- ④ output 不许用真值判断：'' 与 '0' 都是合法日志 ----
/* Step.out 是**字符串**。log("") 产出 out: ""（假值），log(0) 产出 "0"。
   用 `if (s.out)` 过滤会让学习者写的空 log 行凭空消失 —— 这正是本项目
   最不能容忍的那种"安静的谎话"。 */
const FALSY = 'log("a");\nlog("");\nlog(0);\nlog("c");';
const ft = I.run(FALSY, { host: {} }).trace;
const fc = D.create(ft); D.goto(fc, ft.length - 1);
T.eq(D.output(fc), ['a', '', '0', 'c'], '空字符串日志与 "0" 都必须在输出里（真值过滤会漏掉前两条）');

/* ============================================================
   下面五组是变异测试（自审）暴露出来的缺口补测。前面那批断言全部通过，
   但把实现改坏成以下几种样子时它们**依然全绿** —— 也就是说这几条性质
   当时根本没有被守住。每一条都注明了它钉死的那个变异体。
   ============================================================ */

// ---- ⑤ locals 的窗口起点必须是本帧的入帧步，不能图省事从 0 扫 ----
/* 杀掉的变异体：起点恒为 0（仍按 depth 过滤）。
   前面的 fixture 都杀不掉它 —— fact/inner/outer 里同深度只有一帧，或者
   前一帧的出帧 delta 恰好把自己清理干净了，从 0 扫和从入帧扫结果一样。
   下面这段不一样：全局有个 n=99，f 的形参也叫 n。f 出帧时 closeScope 记的是
   {n, from:5, to:99}（把全局值还回去）。从 0 扫到 g 的帧里，就会先把 n=99
   捡起来 —— 于是 g 的变量面板里凭空多出一个它根本看不见的 n。 */
const SIB = [
  'let n = 99;',                      // 1
  'function f(n) { return n + 1; }',  // 2
  'function g(k) { return k + 1; }',  // 3
  'const p = f(5);',                  // 4
  'const q = g(7);',                  // 5
  'return p + q;',                    // 6
].join('\n');
const sbt = I.run(SIB, { host: {} }).trace;
const gPush = sbt.findIndex(s => s.frameOp === 'push' && s.varDelta.some(d => d.name === 'k'));
T.ok(gPush > 0, '找得到 g 的入帧步');
const gCur = D.create(sbt); D.goto(gCur, gPush);
const gLocals = D.locals(gCur);
T.eq(gLocals.k, 7, 'g 帧里 k === 7');
T.ok(typeof gLocals.n === 'undefined',
     '全局 n 没有从上一个同深度的帧渗进 g 的局部变量（从 0 扫会捡到 n=99）');
T.eq(Object.keys(gLocals).sort(), ['k'], 'g 帧的局部变量**只有** k');

// ---- ⑥ 出帧步显示的是「这一帧返回时的样子」，不是调用方的值 ----
/* 杀掉的变异体：不跳过出帧步自己那条拆除 delta。
   closeScope 往 `to` 里写的是**外层**同名变量此刻的值，照单应用会把全局的
   n=99 贴上 f 帧的标签显示出来。 */
const fPop = sbt.findIndex(s => s.frameOp === 'pop' && s.varDelta.some(d => d.name === 'n'));
T.ok(fPop > 0, '找得到 f 的出帧步');
const fpCur = D.create(sbt); D.goto(fpCur, fPop);
T.eq(D.locals(fpCur).n, 5, 'f 的出帧步显示 n === 5（这一帧返回时的值），不是全局的 99');

/* 递归同理：fact 的每个出帧步也该显示本帧的 n，而不是外层帧的。
   这把简报那条测试排除掉的 pop 步一并盖住了。 */
let popChecks = 0;
for (let k = 0; k < rt.length; k++) {
  if (rt[k].frameOp !== 'pop') continue;
  const c = D.create(rt); D.goto(c, k);
  T.eq(D.locals(c).n, 4 - rt[k].depth,
       'fact(3) 第 ' + k + ' 步（出帧，depth=' + rt[k].depth + '）显示本帧的 n');
  popChecks++;
}
T.ok(popChecks >= 3,
     '上面这个出帧步循环真的跑了 ' + popChecks + ' 次（>= 3）—— 补上哨兵，避免空转假绿');

// ---- ⑦ 名字消失就要真的消失，不能留一个值为 undefined 的空行 ----
/* 杀掉的变异体：把 `to === undefined`（closeScope 记的"这个名字不再存在"）
   当成"赋值为 undefined"。属性读两者都是 undefined，只有比对键集合才分得开；
   而 Task 5 的变量面板是按 Object.keys 逐行渲染的，留下的空行就是一个
   明明已经出了作用域、界面上却还在的变量。 */
const GONE = 'let a = 1;\n{ let b = 2; }\nreturn a;';
const gt = I.run(GONE, { host: {} }).trace;
const goneCur = D.create(gt); D.goto(goneCur, gt.length - 1);
T.eq(Object.keys(D.locals(goneCur)).sort(), ['a'],
     '块结束后 b 从局部变量里彻底消失，而不是留一个 b: undefined 的空行');

// ---- ⑧ clear 要同时清掉棋子槽与标记槽 ----
/* 杀掉的变异体：clear 只清 marks。简报的 BD fixture 从头到尾没放过棋子，
   所以它对这个 bug 完全无感 —— 而"同一格既有棋子又有标记"正是 N 皇后
   （放皇后 + 标记它攻击的格子）的标准写法，也正是 3a 的 I5 修复把影子
   状态拆成两层的原因。 */
const BD2 = 'place(9, "wQ");\nmark(9, "confirmed");\nclear(9);';
const b2t = I.run(BD2, { host: {} }).trace;
const b2c = D.create(b2t);
D.goto(b2c, 1);
T.eq(D.boardState(b2c).pieces[9], 'wQ', '同一格可以同时有棋子');
T.eq(D.boardState(b2c).marks[9], 'confirmed', '……和标记，两个槽互不覆盖');
D.goto(b2c, 2);
const cleared = D.boardState(b2c);
T.ok(typeof cleared.pieces[9] === 'undefined', 'clear 之后棋子槽也空了');
T.ok(typeof cleared.marks[9] === 'undefined', 'clear 之后标记槽也空了');

// ---- ⑨ 当前行本身算「已访问」 ----
/* 杀掉的变异体：visitedLines 的循环写成 k < cur.i（漏掉当前步）。
   现有 fixture 里第 0 步的行恰好在更早就被访问过，所以漏掉最后一步也照样
   全绿。契约要写死：当前这一行是刚刚执行完的那一行，必然属于已访问。 */
function checkCurrentIsVisited(label, tr) {
  for (let k = 0; k < tr.length; k++) {
    const c = D.create(tr); D.goto(c, k);
    T.ok(D.visitedLines(c).indexOf(D.currentLine(c)) >= 0,
         label + ' 第 ' + k + ' 步：当前行必在已访问行里');
  }
}
checkCurrentIsVisited('SRC', trace);
checkCurrentIsVisited('fact(3)', rt);

/* ============================================================
   复审发现：深度窗口（只回放本帧区间内 depth 相同的步）会**漏掉深帧对
   外层绑定的赋值**。累加器是阶段 5 六道题的通用形状，两个方向都会错：
   拥有它的帧显示陈旧值，不拥有它的帧却把它显示出来。
   实现已改为**帧归属回放**，下面这几组就是钉死新规则的测试。
   ============================================================ */

// ---- ⑩ 累加器：深帧对外层绑定的赋值 ----
const ACC = [
  'let sol = 0;',                                                        // 1
  'function go(k) { if (k === 0) { sol = sol + 1; return; } go(k - 1); go(k - 1); }', // 2
  'go(2);',                                                              // 3
  'return sol;',                                                         // 4
].join('\n');
const at = I.run(ACC, { host: {} }).trace;
const accCur = D.create(at); D.goto(accCur, at.length - 1);
T.eq(D.locals(accCur).sol, 4,
     '最后的 return sol 那一步 sol === 4 —— 深帧里做的累加要落回拥有它的全局帧');

/* 反向：sol 不属于 go 的任何一帧，就不能出现在那些帧的局部变量里。 */
let deepAccChecks = 0;
for (let k = 0; k < at.length; k++) {
  if (at[k].depth < 1) continue;
  const c = D.create(at); D.goto(c, k);
  const lv = D.locals(c);
  T.ok(typeof lv.sol === 'undefined',
       'go 的第 ' + k + ' 步（depth=' + at[k].depth + '）局部变量里没有 sol —— 它是全局的');
  T.eq(typeof lv.k, 'number', 'go 的第 ' + k + ' 步有自己的形参 k');
  deepAccChecks++;
}
T.ok(deepAccChecks >= 20, '累加器循环真的跑了 ' + deepAccChecks + ' 次（>= 20）');

// ---- ⑪ 遮蔽声明 vs 对外层赋值：中途那条 delta 逐字节相同 ----
/* 这两段源码在函数中途产生的 varDelta 完全一样（实测都是
   {name:'t', from:1, to:5}），唯一的判别器是**这一帧自己的出帧拆除 delta**：
   遮蔽会留下 [{t, from:5, to:1}]，对外层赋值则是 []。 */
const SHADOW = 'let t = 1;\nfunction g() { let t = 5; return t; }\nconst z = g();\nreturn t;';
const ASSIGN = 'let t = 1;\nfunction g() { t = 5; return t; }\nconst z = g();\nreturn t;';
const sht2 = I.run(SHADOW, { host: {} }).trace;
const ast2 = I.run(ASSIGN, { host: {} }).trace;

/* 先把「中途 delta 真的一模一样」这个前提钉住 —— 否则下面两组断言就不是在
   考验判别器了，而哪天 3a 改了 delta 形状，这里应该大声失败。 */
const midS = sht2.findIndex(s => s.depth === 1 && s.varDelta.some(d => d.name === 't'));
const midA = ast2.findIndex(s => s.depth === 1 && s.varDelta.some(d => d.name === 't'));
T.eq(sht2[midS].varDelta, ast2[midA].varDelta,
     '前提：遮蔽与赋值在函数中途那一步的 varDelta 逐字节相同（判别器只能是出帧 delta）');

const shMid = D.create(sht2); D.goto(shMid, midS);
T.eq(D.locals(shMid).t, 5, '遮蔽：g 帧内的 t 是自己声明的 5');
const shEnd = D.create(sht2); D.goto(shEnd, sht2.length - 1);
T.eq(D.locals(shEnd).t, 1, '遮蔽：全局的 t 完好无损，仍是 1');

const asMid = D.create(ast2); D.goto(asMid, midA);
T.ok(typeof D.locals(asMid).t === 'undefined',
     '赋值：t 归全局帧所有，不出现在 g 的局部变量里');
const asEnd = D.create(ast2); D.goto(asEnd, ast2.length - 1);
T.eq(D.locals(asEnd).t, 5, '赋值：全局的 t 真的被改成了 5');

// ---- ⑫ 形参遮蔽同名全局 ----
const PSH = 'let n = 99;\nfunction f(n) { return n + 1; }\nconst p = f(2);\nreturn n;';
const pt2 = I.run(PSH, { host: {} }).trace;
const pPush = pt2.findIndex(s => s.frameOp === 'push');
const pPop = pt2.findIndex(s => s.frameOp === 'pop');
const pPushCur = D.create(pt2); D.goto(pPushCur, pPush);
T.eq(D.locals(pPushCur).n, 2, 'f 帧里的形参 n === 2（不是全局的 99）');
const pPopCur = D.create(pt2); D.goto(pPopCur, pPop);
T.eq(D.locals(pPopCur).n, 2, 'f 的出帧步仍显示本帧的 n === 2');
const pEnd = D.create(pt2); D.goto(pEnd, pt2.length - 1);
T.eq(D.locals(pEnd).n, 99, '全局的 n 从头到尾都是 99');

// ---- ⑬ 函数体内嵌套块里的 let 要落在这个函数的帧里 ----
/* 这种绑定由块自己的 closeScope 收尾，**不会**出现在函数的出帧 delta 里，
   所以 owned 认不出它 —— 归属靠的是优先级 3「最内层开着的帧」。 */
const NEST = 'let t = 1;\nfunction g(a) { if (a > 0) { let b = a * 2; return b; } return 0; }\nconst z = g(3);\nreturn t;';
const nt = I.run(NEST, { host: {} }).trace;
const bBound = nt.findIndex(s => s.depth === 1 && s.varDelta.some(d => d.name === 'b' && 'to' in d && typeof d.to !== 'undefined'));
T.ok(bBound > 0, '找得到嵌套块里 b 绑定的那一步');
const nbCur = D.create(nt); D.goto(nbCur, bBound);
T.eq(D.locals(nbCur).b, 6, '嵌套块的 b 落在 g 的帧里');
T.ok(typeof D.locals(nbCur).t === 'undefined', 'g 的帧里没有全局的 t');
const nEnd = D.create(nt); D.goto(nEnd, nt.length - 1);
T.ok(typeof D.locals(nEnd).b === 'undefined', 'b 没有渗漏进全局帧');
T.eq(D.locals(nEnd).t, 1, '全局帧里的 t 仍是 1');

// ---- ⑭ 截断轨迹：帧可能永远没有匹配的出帧步 ----
/* trace.truncated 是设计内的场景（STEP_LIMIT），不是异常。此时 owned 退化成
   只有入帧 delta，六个函数照常工作、不抛。 */
const TRUNC = ['function fact(n) {', '  if (n <= 1) { return 1; }',
               '  return n * fact(n - 1);', '}', 'return fact(6);'].join('\n');
const tt = I.run(TRUNC, { host: {}, limit: 8 }).trace;
T.eq(tt.truncated, true, '前提：limit=8 真的截断了这条轨迹');
T.eq(tt.length, 8, '前提：截断后的轨迹长度就是 limit');
T.ok(tt.some(s => s.frameOp === 'push') && !tt.some(s => s.frameOp === 'pop'),
     '前提：截断轨迹里有入帧步、一个出帧步都没有（帧永远开着）');
const tCur = D.create(tt); D.goto(tCur, tt.length - 1);
let truncThrew = false, truncLocals;
try { truncLocals = D.locals(tCur); } catch (e) { truncThrew = true; }
T.ok(!truncThrew, '没有匹配出帧步时 locals 不抛');
T.eq(truncLocals.n, 3, '入帧 delta 单独就够认领形参：最内层帧 n === 3');
T.eq(D.callStack(tCur).length, tt[tt.length - 1].depth, '截断轨迹上栈深不变量依然成立');

// ---- ⑮ 名为 __proto__ 的变量不能被悄悄吞掉 ----
/* 解释器接受 `let __proto__ = 1;` 并照常发出 delta；用 {} 字面量当变量表
   会让它写进原型而不是自有属性，Object.keys 拿不到 —— 面板上那一行凭空消失。
   所有 per-frame 的映射都必须是 Object.create(null)。 */
const PROTO = 'let __proto__ = 1;\nfunction h(__proto__) { return __proto__; }\nconst w = h(7);\nreturn 0;';
const prt = I.run(PROTO, { host: {} }).trace;
const prCur = D.create(prt); D.goto(prCur, 0);
T.eq(Object.keys(D.locals(prCur)).indexOf('__proto__') >= 0, true,
     '名为 __proto__ 的全局变量出现在 Object.keys 里');
T.eq(D.locals(prCur).__proto__, 1, '并且读得到它的值 1');
const prPush = prt.findIndex(s => s.frameOp === 'push');
const prPushCur = D.create(prCur.trace); D.goto(prPushCur, prPush);
T.eq(D.locals(prPushCur).__proto__, 7, 'h 帧里名为 __proto__ 的形参也照常分帧（7，不是全局的 1）');

/* ============================================================
   ⑯ 差分守卫：新旧两套 locals 规则逐下标对拍

   这条规则已经错过两次，第二次**通过了当时全部 369 条断言**才被复审逮住。
   所以把「对拍旧实现」做成常驻的测试设施，而不是一次性脚本：以后再动这套
   规则时，任何一处与 534cfaf 的深度窗口产生的分歧都会被列出来，逼着改动者
   为每一处分歧给出判断，而不是悄悄用一个回归换掉另一个回归。

   下面这个 depthWindowLocals 是 534cfaf 的实现原样搬过来（照 diff 的 `-` 行
   重建），**故意保留它的缺陷** —— 它是基线，不是参考答案。两边不一致时，
   由 EXPECTED_DIVERGENCES 逐条写明「哪边对、为什么」。 */
function depthWindowLocals(cur) {
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
    if (step.frameOp === 'pop') continue;
    const d = step.varDelta;
    for (let m = 0; m < d.length; m++) {
      if (typeof d[m].to === 'undefined') delete vars[d[m].name];
      else vars[d[m].name] = d[m].to;
    }
  }
  return vars;
}

/* 每种程序形状：名字、源码、以及**期望的分歧条数**。
   期望值不是"随它去"的橡皮图章 —— 它钉住的是「新规则应该在多少个下标上
   与旧规则不同」。修好一个真 bug 会让某个数字变大，而**意外**引入回归会让
   本该为 0 的形状冒出分歧。两个方向都会失败。 */
const DIFF_SHAPES = [
  { name: '块内 let 与外层帧同名（复审逮住的回归形状）',
    src: ['function go(k) {',
          '  if (k === 0) { return 0; }',
          '  { let b = k * 10;',
          '    go(k - 1);',
          '    return b; }',
          '}',
          'return go(2);'].join('\n'),
    /* 旧规则在这里其实是**对的**（块内 let 与本帧同深度，深度窗口照收），
       新规则修好回归之后应该与它一致。 */
    expectDiff: 0,
    why: '新规则修好块作用域回归后，与深度窗口在这个形状上应当完全一致' },

  { name: '块内 let 不与任何外层名字相撞',
    src: ['function g(a) {',
          '  { let fresh = a + 1;',
          '    return fresh; }',
          '}',
          'return g(5);'].join('\n'),
    expectDiff: 0,
    why: '没有同名冲突时两套规则都把 fresh 归给当前帧' },

  { name: '循环每轮重新声明的 let',
    src: ['let total = 0;',
          'for (let i = 0; i < 3; i = i + 1) { let d = i * 2; total = total + d; }',
          'return total;'].join('\n'),
    expectDiff: 0,
    why: '全部发生在深度 0 的全局帧里，两套规则等价' },

  { name: 'sol 累加器（深帧写外层绑定）',
    src: ['let sol = 0;',
          'function go(k) { if (k === 0) { sol = sol + 1; return; } go(k - 1); go(k - 1); }',
          'go(2);',
          'return sol;'].join('\n'),
    expectDiff: -1,   // -1 = 只要求"必有分歧"，不锁死条数
    why: '旧规则两头错（拥有 sol 的全局帧显示陈旧值，不拥有它的深帧却显示它），新规则对' },

  { name: '遮蔽声明 vs 对外层赋值',
    src: ['let t = 1;',
          'function g() { t = 5; return t; }',
          'const z = g();',
          'return t;'].join('\n'),
    expectDiff: -1,
    why: '对外层赋值：旧规则把 t 留在 g 的帧里，新规则判给全局帧' },

  /* 【任务 4.5】阶段 5 六道题共同的形状：递归 + for 头部声明的循环变量，
     且**循环体第一条语句就是递归调用**。3a 的 callInterpreted 把调用方攒
     在 pending 里的 `let c = 0` 搭进了被调方的入帧步，于是面板把调用方的
     循环计数器 c 挂到被调方的帧上（下标 3/5/25），而真正拥有它的那一帧
     反而看不见它（下标 30/36）。轨迹在源头修好之后，这个形状里没有任何
     跨帧写，深度窗口与新规则必须逐下标一致——所以 expectDiff 是 0，
     而这个 0 恰恰是"入帧步只含形参"的等价说法：一旦 Part 1 的 flush 被
     去掉，深度窗口会把 c 记进被调方的帧、新规则不会，这一条立刻变红。 */
  { name: 'N 皇后形状：for 头声明 + 循环体首句递归（任务 4.5）',
    src: ['function go(row) {',
          '  if (row === 2) { return 1; }',
          '  for (let c = 0; c < 2; c = c + 1) {',
          '    go(row + 1);',
          '  }',
          '  return 0;',
          '}',
          'return go(0);'].join('\n'),
    expectDiff: 0,
    why: '没有跨帧写，两套规则必须完全一致；不一致说明入帧步又混进了调用方的 delta' },

  { name: 'fact(3) 纯递归',
    src: ['function fact(n) {',
          '  if (n <= 1) { return 1; }',
          '  return n * fact(n - 1);',
          '}',
          'return fact(3);'].join('\n'),
    expectDiff: 0,
    why: '没有跨帧写、没有块作用域，两套规则必须完全一致（约束 1 的基线）' },
];

let diffTotal = 0;
for (let sh = 0; sh < DIFF_SHAPES.length; sh++) {
  const shape = DIFF_SHAPES[sh];
  const dt = I.run(shape.src, { host: {} }).trace;
  T.ok(dt.length > 0, '差分形状「' + shape.name + '」产出了非空轨迹');
  let diffs = 0;
  for (let k = 0; k < dt.length; k++) {
    const cNew = D.create(dt); D.goto(cNew, k);
    const cOld = D.create(dt); D.goto(cOld, k);
    const a = JSON.stringify(D.locals(cNew)), b = JSON.stringify(depthWindowLocals(cOld));
    if (a !== b) diffs++;
  }
  diffTotal += diffs;
  if (shape.expectDiff < 0) {
    T.ok(diffs > 0, '差分形状「' + shape.name + '」与深度窗口有分歧（' + diffs + ' 处）—— ' + shape.why);
  } else {
    T.eq(diffs, shape.expectDiff,
         '差分形状「' + shape.name + '」与深度窗口的分歧条数 —— ' + shape.why);
  }
}
T.ok(diffTotal > 0, '差分对拍整体上确实跑出了分歧（' + diffTotal + ' 处）—— 否则说明两套规则被改成了同一个');

/* 上面的对拍只统计条数。下面把复审逮住的那个具体下标钉死：**站在
   `let b = k * 10;` 这一行上**（depth 2）必须看得见 b，而且外层帧的 b
   不能被连累。回归发生时 b 在两个帧里都消失。 */
const REG = ['function go(k) {',
             '  if (k === 0) { return 0; }',
             '  { let b = k * 10;',
             '    go(k - 1);',
             '    return b; }',
             '}',
             'return go(2);'].join('\n');
const gt2 = I.run(REG, { host: {} }).trace;
const inner = gt2.findIndex(s => s.depth === 2 && s.varDelta.some(d => d.name === 'b' && d.to === 10));
T.ok(inner > 0, '找得到 depth 2 那一帧绑定 b = 10 的步');
const innerCur = D.create(gt2); D.goto(innerCur, inner);
T.eq(D.locals(innerCur).b, 10, '站在块内 let b 这一行（depth 2）看得见自己的 b === 10');
T.eq(D.locals(innerCur).k, 1, '同一帧的 k === 1');

const outerRet = gt2.findIndex((s, k) => s.depth === 1 && s.line === 5 && k > inner);
T.ok(outerRet > 0, '找得到外层帧回到 return b 的那一步');
const outerCur = D.create(gt2); D.goto(outerCur, outerRet);
T.eq(D.locals(outerCur).b, 20, '外层帧（depth 1）的 b 仍是自己的 20 —— 没有被内层帧连累删掉');
T.eq(D.locals(outerCur).k, 2, '外层帧的 k === 2');

/* 判据只能是 from 的值，不能是 'from' in d —— 把这个前提钉住，
   哪天 3a 改了 delta 的写法，这里要大声失败而不是悄悄失效。 */
const freshDelta = gt2[inner].varDelta.filter(d => d.name === 'b')[0];
T.eq('from' in freshDelta, true, '前提：recordVarDelta 恒写全三个键，`from` 键永远存在');
T.eq(typeof freshDelta.from, 'undefined', '前提：全新绑定的 from 值是 undefined（判据只能看值）');

/* ============================================================
   ⑰【任务 4.5】循环计数器只出现在拥有它的那一帧里 —— 逐下标验收

   上面 DIFF_SHAPES 的那条 0 分歧是"两套规则一致"，这里再正面钉一次
   "面板显示的到底对不对"：独立写一个只认深度的参考模型（这个形状里没有
   任何跨帧写，深度就是唯一正确的归属依据），逐下标与 locals 对拍，并
   单独盯住 c。 */
const T45_SRC = ['function go(row) {',
                 '  if (row === 2) { return 1; }',
                 '  for (let c = 0; c < 2; c = c + 1) {',
                 '    go(row + 1);',
                 '  }',
                 '  return 0;',
                 '}',
                 'return go(0);'].join('\n');
const t45 = I.run(T45_SRC, { host: {} }).trace;
T.ok(t45.length > 40, '4.5 前提：这个形状的轨迹足够长（' + t45.length + ' 步）');

/* 参考模型：一摞帧，入帧步的 delta 落进新帧，出帧步的 delta 一律不应用，
   其余每条步的 delta 落进 stack[step.depth]。 */
function depthOwnedLocals(trace, i) {
  const stack = [Object.create(null)];
  for (let k = 0; k <= i; k++) {
    const s = trace[k];
    if (s.frameOp === 'push') {
      const f = Object.create(null);
      stack.push(f);
      for (let m = 0; m < s.varDelta.length; m++) f[s.varDelta[m].name] = s.varDelta[m].to;
      continue;
    }
    if (s.frameOp === 'pop') { if (k < i && stack.length > 1) stack.pop(); continue; }
    const f = stack[s.depth];
    for (let m = 0; m < s.varDelta.length; m++) {
      const d = s.varDelta[m];
      if (typeof d.to === 'undefined') delete f[d.name]; else f[d.name] = d.to;
    }
  }
  return stack[stack.length - 1];
}

let t45Mismatch = [];
let t45CInPush = [];
let t45CSeen = 0;
for (let k = 0; k < t45.length; k++) {
  const c45 = D.create(t45); D.goto(c45, k);
  const got = D.locals(c45), want = depthOwnedLocals(t45, k);
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    t45Mismatch.push({ at: k, got: got, want: want });
  }
  if ('c' in got) t45CSeen++;
  /* 站在入帧步上 = 刚刚进入被调方、形参绑好、函数体一条都没跑。
     此刻被调方帧里**只能**有形参，绝不能有调用方的循环计数器。 */
  if (t45[k].frameOp === 'push' && 'c' in got) t45CInPush.push({ at: k, locals: got });
}
T.eq(t45Mismatch, [], '4.5③: 逐下标与"按深度归属"参考模型完全一致');
T.eq(t45CInPush, [], '4.5③: 任何一条入帧步上，被调方帧里都不含调用方的 c');
T.ok(t45CSeen > 0, '4.5③ 反向哨兵：c 确实在若干下标上是可见的（' + t45CSeen +
                   ' 处）—— 否则"哪儿都不显示 c"也能让上面两条通过');

/* 拥有 c 的那一帧必须看得见它：每条 `c` 的 delta 步（frameOp 为 null）
   站上去时，locals().c 必须等于这条 delta 的 to（to 为 undefined 时则是
   "c 已被拆除"，不该再出现）。修复前下标 30/36 正是在这里失败：c 被记在
   了别的帧上，站在拥有它的帧上反而读不到。 */
let t45Own = [];
for (let k = 0; k < t45.length; k++) {
  const s = t45[k];
  if (s.frameOp !== null) continue;
  const dc = s.varDelta.filter(function (d) { return d.name === 'c'; })[0];
  if (!dc) continue;
  const c45 = D.create(t45); D.goto(c45, k);
  const got = D.locals(c45);
  const okHere = (typeof dc.to === 'undefined') ? !('c' in got) : got.c === dc.to;
  if (!okHere) t45Own.push({ at: k, delta: dc, locals: got });
}
T.eq(t45Own, [], '4.5③: 每一条 c 的 delta 步上，站在当前帧就能看到这次改动的结果');

// ---- 六个派生函数在空轨迹上也不能抛 ----
/* 与上面 checkEmptySafe 同样的循环写法：清空编辑器缓冲区是阶段 5 验收
   页面的初始状态，面板必须能在长度为 0 的轨迹上正常渲染。 */
function checkEmptyDerived(label, makeCur) {
  const derived = [
    ['currentLine', function (c) { return D.currentLine(c); }, null],
    ['visitedLines', function (c) { return D.visitedLines(c); }, []],
    ['callStack', function (c) { return D.callStack(c); }, []],
    ['locals', function (c) { return D.locals(c); }, {}],
    ['output', function (c) { return D.output(c); }, []],
    ['boardState', function (c) { return D.boardState(c); }, { marks: {}, pieces: {} }],
  ];
  for (let m = 0; m < derived.length; m++) {
    const name = derived[m][0], fn = derived[m][1], want = derived[m][2];
    const c = makeCur();
    let dThrew = false, dRet;
    try { dRet = fn(c); } catch (e) { dThrew = true; }
    T.ok(!dThrew, label + '.' + name + '：空轨迹上不抛异常');
    T.eq(dRet, want, label + '.' + name + '：空轨迹上返回约定的空值');
  }
}
checkEmptyDerived('空源码派生的空轨迹', function () { return D.create(emptyTrace); });
checkEmptyDerived('纯空白源码派生的空轨迹', function () { return D.create(whitespaceTrace); });
checkEmptyDerived('手搓的字面量空数组', function () { return D.create([]); });

/* ==================== 3b 复审新增的三组断言 ====================
   整块包在一个 block 里：这个文件上半部分已经用掉了 cur/trace/g 之类的短名，
   块作用域让新断言不必去跟既有夹具抢名字，也不会反过来污染它们。 */
{

/* -------------------- ① locals 的 depth 参数 --------------------
   点调用栈某一帧时，变量区要显示**那一帧**的变量。这个参数是那条交互唯一的
   支点——错了的话面板会把 A 帧的代码摆在 B 帧的变量旁边，而这一阶段的整个
   要点恰恰是「每次递归调用都有自己的 n」。 */

const RECUR = [
  'function fact(n) {',              // 1
  '  if (n <= 1) { return 1; }',     // 2
  '  const sub = fact(n - 1);',      // 3
  '  return n * sub;',               // 4
  '}',                               // 5
  'const answer = fact(3);',         // 6
  'return answer;',                  // 7
].join('\n');
const rt = I.run(RECUR, { host: {} }).trace;

/* 找一个真正停在最深处（三层 = fact(1)）的下标，不靠猜某个具体的 i。 */
let deepIdx = -1;
for (let k = 0; k < rt.length; k++) {
  const c = D.create(rt); D.goto(c, k);
  if (D.callStack(c).length === 3) deepIdx = k;
}
T.ok(deepIdx >= 0, 'depth 夹具：递归确实到过三层深');

const deep = D.create(rt);
D.goto(deep, deepIdx);
T.eq(D.callStack(deep).length, 3, 'depth 夹具：游标停在三层深处');

// 向后兼容：省略 depth 必须与显式传当前最内层深度逐字节相同
T.eq(D.locals(deep), D.locals(deep, 3), 'locals：省略 depth === 传当前最内层深度');
T.eq(D.locals(deep, undefined), D.locals(deep), 'locals：显式 undefined === 省略');
T.eq(D.locals(deep, null), D.locals(deep), 'locals：null === 省略');

// 选中外层帧拿到的必须是那一帧的 n。fact(3) 三层的 n 分别是 3 / 2 / 1。
const nAt = [0, 1, 2, 3].map(function (d) { return D.locals(deep, d).n; });
T.eq(nAt[3], 1, 'locals(cur, 3)：最内层帧的 n 是 1');
T.eq(nAt[2], 2, 'locals(cur, 2)：中间帧的 n 是 2');
T.eq(nAt[1], 3, 'locals(cur, 1)：最外层调用帧的 n 是 3');
T.eq([nAt[1], nAt[2], nAt[3]], [3, 2, 1],
     'locals：三层递归的同名 n 互不相同，各归各帧（同名参数串味的探针）');

// depth 0 = 全局帧：持有函数声明，不持有任何一帧的形参
const glob = D.locals(deep, 0);
T.ok('fact' in glob, 'locals(cur, 0)：全局帧持有函数声明 fact');
T.ok(!('n' in glob), 'locals(cur, 0)：全局帧不持有任何一帧的形参 n');
T.ok('answer' in glob === false, 'locals(cur, 0)：此刻 answer 还没被赋值，全局帧里没有它');

/* 越界返回空对象，**不夹到边界上**。夹住会安静地显示另一帧的变量——面板
   看着一切正常，值却属于别人，正是本项目最不能容忍的那种安静谎话。 */
T.eq(Object.keys(D.locals(deep, 4)), [], 'locals：depth 大于栈高 → 空对象（不夹到最内层）');
T.eq(Object.keys(D.locals(deep, 99)), [], 'locals：depth 远大于栈高 → 空对象');
T.eq(Object.keys(D.locals(deep, -1)), [], 'locals：负 depth → 空对象');
T.ok(!('n' in D.locals(deep, 4)), 'locals：越界返回的确实不是最内层那一帧');
T.eq(Object.getPrototypeOf(D.locals(deep, 99)), null, 'locals：越界返回值同样是无原型对象');

/* 上面三条挡的是「太大 / 太小」，挡不住「压根不是一个帧号」。`depth | 0` 把
   NaN / 'x' / Infinity 一律折成 0，于是算错的 depth 不会报错，而是**稳稳地
   显示全局帧**——面板上一排变量看着都对，值却属于别人，与夹到边界上是同一种
   安静的谎话。判定必须排在 `| 0` 之前，这几条就是钉住这一点的。
   注意断言的是「全局帧的名字不在里面」而不只是 Object.keys 为空：全局帧
   恰好持有 fact，只测空会在 fact 被改名之后变成一条空过的断言。 */
const badDepths = [NaN, 'x', '2', Infinity, -Infinity, 2.5, true, {}, [], function () {}];
const depthLies = [];
for (let bd = 0; bd < badDepths.length; bd++) {
  const got = D.locals(deep, badDepths[bd]);
  if (Object.keys(got).length !== 0) depthLies.push(String(badDepths[bd]));
}
T.eq(depthLies, [], 'locals：非整数/非有限/非数字的 depth 一律返回空对象，不悄悄退成全局帧');
T.ok(!('fact' in D.locals(deep, NaN)), 'locals(cur, NaN)：拿到的不是全局帧');
T.ok(!('n' in D.locals(deep, NaN)), 'locals(cur, NaN)：拿到的也不是任何一个调用帧');
T.eq(Object.getPrototypeOf(D.locals(deep, NaN)), null, 'locals(cur, NaN)：返回值同样是无原型对象');
T.ok(!('fact' in D.locals(deep, 'x')), "locals(cur, 'x')：字符串 depth 拿到的不是全局帧");
T.ok(!('n' in D.locals(deep, 2.5)), 'locals(cur, 2.5)：小数 depth 不被折到第 2 帧');
/* 有牙齿：把同一条夹具喂给合法的 0 与 3，确实各自拿得到东西。 */
T.ok('fact' in D.locals(deep, 0), '有牙齿：合法的 depth 0 确实拿得到全局帧的 fact');
T.ok('n' in D.locals(deep, 3), '有牙齿：合法的 depth 3 确实拿得到那一帧的 n');

// 空轨迹 + depth 不抛（清空编辑器缓冲区是可达状态）
const emptyCur = D.create([]);
let ldThrew = false;
try { D.locals(emptyCur, 2); } catch (e) { ldThrew = true; }
T.ok(!ldThrew, 'locals：空轨迹 + depth 参数不抛');
T.eq(Object.keys(D.locals(emptyCur, 2)), [], 'locals：空轨迹 + depth 返回空对象');

/* 全下标扫一遍：depth 能当下标用的前提是「内部帧栈高 === callStack + 1」。
   这条在每一个下标上都必须成立，否则 UI 的 selFrame 会整体错一格。 */
const depthMismatch = [];
for (let k = 0; k < rt.length; k++) {
  const c = D.create(rt); D.goto(c, k);
  const h = D.callStack(c).length;
  if (JSON.stringify(D.locals(c, h)) !== JSON.stringify(D.locals(c))) depthMismatch.push(k);
}
T.eq(depthMismatch, [], 'locals：每个下标上 locals(cur, callStack.length) === locals(cur)');

/* -------------------- ② 播放节流的算术 --------------------
   「按时间推进、不按帧计数」是硬约束（开发者的外接屏是 30 Hz，按帧计数在
   那台机器上会慢一半）。这几行以前只能靠在浏览器里手喂 dt 验，提成纯函数
   之后在这里钉死。 */

T.eq(D.playSteps(0, 1, 10, 1000).steps, 10, 'playSteps：1 秒 @10 步/秒 = 10 步');
T.eq(D.playSteps(0, 1, 30, 1000).steps, 30, 'playSteps：1 秒 @30 步/秒 = 30 步');
T.eq(D.playSteps(0, 0.5, 10, 1000).steps, 5, 'playSteps：半秒 @10 步/秒 = 5 步');
/* 浮点回归：第一版用「反复减 1/sps」的循环实现，3 秒 @10 步/秒 只走 29 步
   （连减 29 次 0.1 之后余 0.09999999999999973，第 30 次比不过 0.1）。
   实测在浏览器里抓到的。改成 Math.floor(a * sps) 之后是 30。 */
T.eq(D.playSteps(0, 3, 10, 1000).steps, 30, 'playSteps：3 秒 @10 步/秒 = 30 步（浮点累减的回归）');
T.eq(D.playSteps(0, 7, 3, 1000).steps, 21, 'playSteps：7 秒 @3 步/秒 = 21 步');
T.eq(D.playSteps(0, 0.7, 10, 1000).steps, 7, 'playSteps：0.7 秒 @10 步/秒 = 7 步（0.7 不是二进制精确值）');
T.eq(D.playSteps(0, 2.9, 10, 1000).steps, 29, 'playSteps：2.9 秒 @10 步/秒 = 29 步');

// 帧无关性：同样一秒切成 20 帧，总步数必须与一次喂完相同（余数留在 acc 里）
let accum = 0, total = 0;
for (let k = 0; k < 20; k++) {
  const plan = D.playSteps(accum, 0.05, 10, 1000);
  accum = plan.acc; total += plan.steps;
}
T.eq(total, 10, 'playSteps：20 帧 × 0.05s 与一次 1s 走的步数相同（帧无关）');

let acc60 = 0, tot60 = 0;
for (let k = 0; k < 60; k++) {
  const plan = D.playSteps(acc60, 1 / 60, 7, 1000);
  acc60 = plan.acc; tot60 += plan.steps;
}
T.eq(tot60, 7, 'playSteps：60 fps 跑满一秒 @7 步/秒 = 7 步（除不尽也不丢步）');

// 30 Hz 与 60 Hz 跑同样的墙钟时间必须走同样多步 —— 那块外接屏的直接回归
function runFor(seconds, fps, sps) {
  let a = 0, n = 0;
  for (let k = 0; k < seconds * fps; k++) {
    const plan = D.playSteps(a, 1 / fps, sps, 1000);
    a = plan.acc; n += plan.steps;
  }
  return n;
}
T.eq(runFor(2, 30, 12), runFor(2, 60, 12), 'playSteps：30 Hz 与 60 Hz 在同样墙钟时间里走同样多步');
T.eq(runFor(2, 30, 12), 24, 'playSteps：2 秒 @12 步/秒 = 24 步，与刷新率无关');

/* 刷新率 × 速度的交叉表。第一版在 60 fps @10 步/秒 上走 9 步、30 fps 上走
   10 步——同一段墙钟时间在两块屏上走出不同步数，正是这个项目要防的那件事
   （开发者的外接屏是 30 Hz）。原因是累加 60 个 1/60 得到 0.9999999999999999
   而不是 1.0。浏览器里实测抓到的，PLAY_EPS 就是为它加的。 */
const rateGrid = [];
for (const fps of [24, 30, 50, 60, 120, 144]) {
  for (const sps of [1, 7, 10, 12, 30, 60]) {
    const got = runFor(1, fps, sps);
    if (got !== sps) rateGrid.push({ fps: fps, sps: sps, got: got, want: sps });
  }
}
T.eq(rateGrid, [], 'playSteps：任意刷新率 × 任意速度，跑满一秒恰好走 sps 步');

/* 反向保证：容差不能让它凭空多走一步。差得比一个浮点末位多时必须还差着。 */
T.eq(D.playSteps(0, 0.99, 10, 1000).steps, 9, 'playSteps：0.99 秒 @10 步/秒 是 9 步，容差不凭空多给一步');
T.eq(D.playSteps(0, 0.0999, 10, 1000).steps, 0, 'playSteps：差一点点就是不够一步');
T.ok(D.playSteps(0, 1, 10, 1000).acc >= 0, 'playSteps：acc 不会被减成负数');

// cap 截断：多出来的时间留在 acc 里，不丢
const capped = D.playSteps(0, 10, 100, 240);
T.eq(capped.steps, 240, 'playSteps：单帧步数被 cap 截住');
T.ok(capped.acc > 0, 'playSteps：被 cap 截掉的时间留在 acc 里');
T.eq(Math.round(capped.acc * 1000), Math.round((10 - 240 / 100) * 1000),
     'playSteps：留下的正是没走完的那部分时间');

// 退化输入不能把累加器搅坏（引擎第一帧的 dt 可能是 0）
T.eq(D.playSteps(0, 0, 10, 240), { steps: 0, acc: 0 }, 'playSteps：dt 为 0 时不前进也不污染 acc');
/* 负 dt 当 0 处理 —— 判据是「与 dt=0 的结果完全相同」，**不是**「acc 原样不动」：
   已经积攒的时间该照常花掉（acc=0.5 在 10 步/秒下本来就够走 5 步），负 dt 只是
   不再往里加。第一版断言写成了 acc 保持 0.5，是断言错了，不是函数错了。 */
T.eq(D.playSteps(0.5, -1, 10, 240), D.playSteps(0.5, 0, 10, 240), 'playSteps：负 dt 与 dt=0 结果一致');
T.eq(D.playSteps(0.5, -1, 10, 240).steps, 5, 'playSteps：负 dt 时已积攒的时间照常花掉');
T.ok(D.playSteps(0.5, -100, 10, 240).acc < 0.1, 'playSteps：负 dt 不会把 acc 减成负数');
T.eq(D.playSteps(0, NaN, 10, 240), { steps: 0, acc: 0 }, 'playSteps：NaN dt 当 0（不让 acc 变成 NaN）');
T.eq(D.playSteps(0, 1, 0, 240).steps, 1, 'playSteps：sps 为 0 兜成 1 步/秒，不除以零');

/* cap 省略 / 非法时必须兜到默认值，**绝不能算出 NaN**。
   Math.min(undefined, n) 是 NaN，而 NaN 一旦被写回调用方的累加器就再也出不来
   （NaN+dt、NaN*rate、Math.floor(NaN) 全是 NaN），播放从此静默死掉且不可恢复。
   本仓库唯一的调用点是传了 cap 的，但这是导出给工具 ④⑤ 的公开函数，
   下一个调用方会在另一个文件里安静地中招。 */
const noCap = D.playSteps(0, 1, 10);
T.eq(noCap.steps, 10, 'playSteps：省略 cap 时照常前进（不是 NaN）');
T.ok(isFinite(noCap.acc), 'playSteps：省略 cap 时 acc 是有限数（NaN 会永久毒死累加器）');
T.ok(isFinite(D.playSteps(noCap.acc, 1, 10).acc), 'playSteps：省略 cap 连续调用，acc 始终有限');
T.ok(isFinite(D.playSteps(0, 1, 10, NaN).acc), 'playSteps：cap 为 NaN 时兜到默认值');
T.eq(D.playSteps(0, 1, 10, NaN).steps, 10, 'playSteps：cap 为 NaN 不影响步数');
T.ok(isFinite(D.playSteps(0, 1, 10, null).acc), 'playSteps：cap 为 null 时兜到默认值');
T.eq(D.playSteps(0, 1, 10, -5).steps, 10, 'playSteps：负 cap 兜到默认值（不是"永不前进"）');
T.eq(D.playSteps(0, 100, 10, Infinity).steps, 1000, 'playSteps：Infinity 是有意义的"不设上限"，放行');
T.eq(D.playSteps(0, 100, 10).steps, 240, 'playSteps：省略 cap 时用的是默认上限 240');
T.eq(D.playSteps(0, 1, 10, 0).steps, 0, 'playSteps：显式 cap=0 是"这一帧不走"，与省略不同');
/* 连喂 50 帧不带 cap，累加器必须始终有限——毒化是累积的，单次调用看不出来。 */
let noCapAcc = 0, noCapOk = true;
for (let k = 0; k < 50; k++) {
  const p = D.playSteps(noCapAcc, 1 / 60, 10);
  noCapAcc = p.acc;
  if (!isFinite(noCapAcc) || !isFinite(p.steps)) noCapOk = false;
}
T.ok(noCapOk, 'playSteps：省略 cap 连喂 50 帧，steps 与 acc 全程有限');

/* -------------------- ③ fmtVal --------------------
   第一条是一个真 bug 的回归：interp.js 的 snap() 在**记录 delta 之前**就把
   函数值换成了字符串 'ƒ 名字'，于是「字符串 → JSON.stringify」这条分支会把它
   渲染成 `"ƒ safe"`，看起来像一个内容碰巧是这几个字的字符串变量。 */
T.eq(D.fmtVal('ƒ safe'), 'ƒ safe', 'fmtVal：snap() 的函数快照不再被套引号（真 bug 的回归）');
T.eq(D.fmtVal('safe'), '"safe"', 'fmtVal：普通字符串照常加引号');
T.eq(D.fmtVal('ƒsafe'), '"ƒsafe"', 'fmtVal：要「ƒ + 空格」才算函数快照，不是光看首字符');
T.eq(D.fmtVal({ __fn: true, name: 'go' }), 'ƒ go', 'fmtVal：未经 snap 的解释器函数值（run().result 走这条）');
T.eq(D.fmtVal({ __fn: true }), 'ƒ (anonymous)', 'fmtVal：匿名解释器函数');
T.eq(D.fmtVal(null), 'null', 'fmtVal：null');
T.eq(D.fmtVal(undefined), 'undefined', 'fmtVal：undefined');
T.eq(D.fmtVal(0), '0', 'fmtVal：0 不被当成假值吞掉');
T.eq(D.fmtVal(false), 'false', 'fmtVal：false 不被当成假值吞掉');
T.eq(D.fmtVal(''), '""', 'fmtVal：空字符串显示成一对引号，不是一片空白');
T.eq(D.fmtVal([1, 2, 3]), '[1, 2, 3]', 'fmtVal：数组');
T.eq(D.fmtVal([]), '[]', 'fmtVal：空数组');
T.eq(D.fmtVal({ a: 1, b: 'x' }), '{a: 1, b: "x"}', 'fmtVal：对象');
/* 截断：BFS 的 dist 表就是 64 个元素，整条铺开会把面板撑成一堵墙。
   截断处必须显式写出还剩几个，不做"看起来就这么多"的安静省略。 */
const big = [];
for (let k = 0; k < 20; k++) big.push(k);
T.eq(D.fmtVal(big), '[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, … +8]',
     'fmtVal：长数组截断并写出还剩几个');
T.eq(D.fmtVal([[[1]]]), '[[[…]]]', 'fmtVal：嵌套超过两层折成省略号');

}

/* ==================== Task 6：琥珀色标记的归属（换帧那一半） ====================

   上一轮补的守卫只挡住了「不是一步」的重绘；`isStep` 这条路仍然拿**上一步
   那一帧**的值当基线，于是每一次换帧都整帧闪。步入时那一闪是真的（形参确实
   是这一步才诞生的绑定），步出时那一闪是假的（调用方的变量从被挂起到现在
   一个字节都没动）—— 而步出正是学习者看递归收栈时盯着的那一下。 */
{

/* fact(n, acc)：尾递归的阶乘，跨帧同名（每一层都有自己的 n 和 acc），
   步入步出各四次。选它是因为它就是这一阶段要教的那一课的最小形状。 */
const FSRC = 'function fact(n, acc) { if (n <= 1) { return acc; } return fact(n - 1, acc * n); }\nreturn fact(4, 1);';
const ftrace = I.run(FSRC, { host: {} }).trace;
const fcur = D.create(ftrace);

/* frameIds 与 callStack 必须永远等长、逐帧对应。两个函数的压/弹边界是抄的，
   一旦有人只改一处，这条会当场炸——琥珀色的整套归属都建在这个对应上。 */
let idsAligned = [];
for (let k = 0; k < ftrace.length; k++) {
  fcur.i = k;
  const st = D.callStack(fcur), ids = D.frameIds(fcur);
  if (ids.length !== st.length) idsAligned.push({ i: k, stack: st.length, ids: ids.length });
  for (let m = 0; m < ids.length; m++) {
    /* 入帧步下标指向的那一步必须真的是这一帧的 push，且行号对得上。 */
    if (!ftrace[ids[m]] || ftrace[ids[m]].frameOp !== 'push' || ftrace[ids[m]].line !== st[m].line) {
      idsAligned.push({ i: k, m: m, idx: ids[m] });
    }
  }
}
T.eq(idsAligned, [], 'frameIds：全下标与 callStack 等长且逐帧指向真正的 push 步');
fcur.i = 0;
T.eq(D.frameIds(fcur), [], 'frameIds：全局帧不占位（与 callStack 一致）');
/* 单调：入帧步下标只增不减，这正是它能当身份证而深度不能的理由。 */
let idsMono = true;
for (let k = 0; k < ftrace.length; k++) {
  fcur.i = k;
  const ids = D.frameIds(fcur);
  for (let m = 1; m < ids.length; m++) if (ids[m] <= ids[m - 1]) idsMono = false;
}
T.ok(idsMono, 'frameIds：由外到内严格递增');

/* ---- 把 DOM 层的那一步比对逐步重放一遍（flashMarks 是纯函数，可以） ---- */
function replayFlash(cur, trace) {
  const rows = [];
  let base = null;
  for (let k = 0; k < trace.length; k++) {
    cur.i = k;
    const stack = D.callStack(cur), ids = D.frameIds(cur);
    const lv = D.locals(cur);
    const names = Object.keys(lv).sort();
    const vals = Object.create(null);
    for (let m = 0; m < names.length; m++) vals[names[m]] = D.fmtVal(lv[names[m]]);
    const shown = stack.length;
    const cache = {
      i: k, names: names, vals: vals,
      varsFrameId: shown === 0 ? -1 : (ids[shown - 1] != null ? ids[shown - 1] : -2),
    };
    const marks = D.flashMarks(base, cache);
    rows.push({ i: k, depth: trace[k].depth, frameId: cache.varsFrameId,
                names: names, flash: Object.keys(marks).sort(), vals: vals });
    base = { frameId: cache.varsFrameId, i: k, vals: vals };
  }
  return rows;
}
const frows = replayFlash(fcur, ftrace);

/* 步出（深度变小）的那些步：**一个琥珀色都不许有**。这是本条修复的靶心。
   修复前实测：fact(4) 的四次步出每一次都把调用方的 acc 与 n 一起点亮。 */
const outFlashes = [];
for (let k = 1; k < frows.length; k++) {
  if (frows[k].depth < frows[k - 1].depth && frows[k].flash.length) {
    outFlashes.push({ i: k, from: frows[k - 1].depth, to: frows[k].depth, flash: frows[k].flash });
  }
}
T.eq(outFlashes, [], 'flashMarks：步出回到调用方时，调用方的变量一个都不闪（本轮修复的靶心）');
/* 有牙齿吗？确认这条轨迹里真的存在步出，否则上面那条是空过。 */
let stepOuts = 0;
for (let k = 1; k < frows.length; k++) if (frows[k].depth < frows[k - 1].depth) stepOuts++;
T.ok(stepOuts >= 4, 'fact(4) 的轨迹里确实有 ≥4 次步出（上一条不是空过）');

/* 而这些步上调用方的值**确实没变**——不是"变了但我们不显示"。
   这条把「不闪」的正当性也钉住：值真的一模一样。 */
const outValsSame = [];
for (let k = 1; k < frows.length; k++) {
  if (frows[k].depth >= frows[k - 1].depth) continue;
  /* 找回到同一帧的上一次出现，比对那时的值 */
  for (let m = k - 1; m >= 0; m--) {
    if (frows[m].frameId === frows[k].frameId) {
      for (let q = 0; q < frows[k].names.length; q++) {
        const nm = frows[k].names[q];
        if (frows[m].vals[nm] !== frows[k].vals[nm]) outValsSame.push({ i: k, name: nm });
      }
      break;
    }
  }
}
T.eq(outValsSame, [], '步出那一步，调用方的每一个变量与它被挂起时逐字节相同（所以不闪是对的）');

/* 步入（深度变大）仍然整帧点亮 —— 那些绑定确实是这一步才诞生的。
   这一半是**有意保留**的，不是漏网：一刀切"换帧不标"会把它一起杀掉。 */
const inMissed = [];
for (let k = 1; k < frows.length; k++) {
  if (frows[k].depth > frows[k - 1].depth &&
      frows[k].flash.join(',') !== frows[k].names.join(',')) {
    inMissed.push({ i: k, flash: frows[k].flash, names: frows[k].names });
  }
}
T.eq(inMissed, [], 'flashMarks：步入压新帧时整帧点亮（新绑定确实是这一步诞生的）');
T.eq(frows[1].flash, ['acc', 'n'], 'fact(4)：第一次步入点亮 acc 与 n');

/* 第 0 步：没有基线，一个都不许闪（setCursor / mount 之后的那一次 refresh）。
   修复前它会把第 0 步可见的每一个绑定都点亮，验收清单第 23 条明令禁止。 */
T.eq(frows[0].flash, [], 'flashMarks：没有基线时一个都不标（换样例之后的第 0 步）');
T.eq(Object.keys(D.flashMarks(null, { i: 0, varsFrameId: -1, names: ['a', 'b'], vals: { a: '1', b: '2' } })), [],
     'flashMarks：base 为 null → 空标记');
T.eq(Object.keys(D.flashMarks({ frameId: null, i: -1, vals: {} },
                              { i: 0, varsFrameId: -1, names: ['a'], vals: { a: '1' } })), [],
     'flashMarks：base.frameId 为 null（刚换轨迹）→ 空标记');

/* 同一帧内照常比对 —— 这条修复不能把真正的闪烁一起关掉。 */
T.eq(Object.keys(D.flashMarks({ frameId: 5, i: 9, vals: { a: '1', b: '2' } },
                              { i: 10, varsFrameId: 5, names: ['a', 'b'], vals: { a: '1', b: '3' } })).sort(),
     ['b'], 'flashMarks：同一帧里只标真的变了的那个');
/* 换到一个**早就存在**的帧（入帧步下标 <= 上一步的游标）→ 不标。 */
T.eq(Object.keys(D.flashMarks({ frameId: 9, i: 20, vals: { n: '1' } },
                              { i: 21, varsFrameId: 3, names: ['n', 'acc'], vals: { n: '4', acc: '1' } })), [],
     'flashMarks：换回旧帧（frameId 小于等于上一步的游标）→ 一个都不标');
/* 换到一个**这一步才诞生**的帧（入帧步下标 > 上一步的游标）→ 全标。 */
T.eq(Object.keys(D.flashMarks({ frameId: 3, i: 20, vals: { n: '1' } },
                              { i: 21, varsFrameId: 21, names: ['acc', 'n'], vals: { n: '4', acc: '1' } })).sort(),
     ['acc', 'n'], 'flashMarks：新诞生的帧 → 整帧点亮');
/* 全局帧（frameId = -1）永远不算"新诞生"：-1 不可能大于任何 >= 0 的游标。 */
T.eq(Object.keys(D.flashMarks({ frameId: 7, i: 12, vals: {} },
                              { i: 13, varsFrameId: -1, names: ['N'], vals: { N: '6' } })), [],
     'flashMarks：回到全局帧不算新诞生，不闪');

/* 全轨迹的兜底不变量：**任何被点亮的名字，要么值真的变了，要么它所在的帧
   是这一步才诞生的。** 这一条比上面每一条都强，它就是那句不变量本身。 */
const lies = [];
for (let k = 1; k < frows.length; k++) {
  const born = frows[k].frameId > frows[k - 1].i;
  if (born) continue;
  for (let q = 0; q < frows[k].flash.length; q++) {
    const nm = frows[k].flash[q];
    if (frows[k - 1].frameId === frows[k].frameId &&
        frows[k - 1].vals[nm] !== frows[k].vals[nm]) continue;
    lies.push({ i: k, name: nm });
  }
}
T.eq(lies, [], '琥珀色的不变量：全轨迹上每一个点亮的名字，要么真的变了，要么帧是这一步才诞生的');

/* 同样的不变量在 N 皇后那条真轨迹上再跑一遍（递归 + 循环 + 剪枝，
   形状与 fact 完全不同，两条都过才说明修的是不变量不是那条 fixture）。 */
const QSRC = [
  'const N = 6;',
  'const cols = [];',
  'function safe(row, col) {',
  '  for (let r = 0; r < row; r = r + 1) {',
  '    const c = cols[r];',
  '    if (c === col) { return false; }',
  '    if (row - r === col - c) { return false; }',
  '    if (row - r === c - col) { return false; }',
  '  }',
  '  return true;',
  '}',
  'function solve(row) {',
  '  if (row === N) { return 1; }',
  '  for (let col = 0; col < N; col = col + 1) {',
  '    if (safe(row, col)) {',
  '      cols[row] = col;',
  '      if (solve(row + 1) === 1) { return 1; }',
  '    }',
  '  }',
  '  return 0;',
  '}',
  'return solve(0);',
].join('\n');
const qtrace = I.run(QSRC, { host: {} }).trace;
T.ok(qtrace.length > 500, 'N 皇后 fixture 的轨迹够长（' + qtrace.length + ' 步）');
const qrows = replayFlash(D.create(qtrace), qtrace);
const qlies = [];
for (let k = 1; k < qrows.length; k++) {
  const born = qrows[k].frameId > qrows[k - 1].i;
  if (born) continue;
  for (let q = 0; q < qrows[k].flash.length; q++) {
    const nm = qrows[k].flash[q];
    if (qrows[k - 1].frameId === qrows[k].frameId &&
        qrows[k - 1].vals[nm] !== qrows[k].vals[nm]) continue;
    qlies.push({ i: k, name: nm });
  }
}
T.eq(qlies, [], '琥珀色的不变量：N 皇后整条轨迹上同样成立');
/* 有牙齿：这条轨迹上确实有大量步出，而且确实有大量真闪烁。 */
let qOuts = 0, qFlash = 0;
for (let k = 1; k < qrows.length; k++) {
  if (qrows[k].depth < qrows[k - 1].depth) qOuts++;
  if (qrows[k].flash.length) qFlash++;
}
T.ok(qOuts > 50, 'N 皇后轨迹里有大量步出（' + qOuts + ' 次），上面那条不是空过');
T.ok(qFlash > 50, 'N 皇后轨迹里仍有大量真闪烁（' + qFlash + ' 步），修复没有把闪烁关死');

/* 上面这一整段琥珀色不变量所依赖的两个纯函数确实在模块导出面上（它们是从
   mount 的内部逻辑里提出来、专为在 node 里可测才导出的；漏掉导出会让上面
   几百条断言变成"测不到"而不是"测失败"）。
   **这里没有覆盖 handle.redraw：** redraw 只能经由 mount() 拿到，而 mount 是
   DOM 层，node 里跑不到，所以整个分支上 redraw 一条断言都没有。它与 refresh
   的区别（refresh 会推进琥珀色基线并清掉选中帧，redraw 两样都不做）只由
   debugger.js 里那段注释和浏览器验收把守——工具 ④⑤ 若拿 refresh 去做 resize
   重绘会静默改状态，而这道测试套件不会因此变红。不要在这里写一条假装覆盖了
   它的断言：一条为不存在的测试作保的注释，正是下一次回归蒙混过关的方式。 */
T.ok(typeof D.flashMarks === 'function', 'flashMarks 已导出（纯函数，node 可测）');
T.ok(typeof D.frameIds === 'function', 'frameIds 已导出');

}

T.report();
