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
  const cur = makeCur();
  let threw = false, ret;
  try { ret = D.goto(cur, 3); } catch (e) { threw = true; }
  T.ok(!threw, label + '.goto：空轨迹上不抛异常');
  T.eq(cur.i, 0, label + '.goto：空轨迹上下标不变');

  const movers = [
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

T.report();
