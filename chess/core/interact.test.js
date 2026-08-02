'use strict';
const T = require('./_test.js');
const C = require('./chess-core.js');
const I = require('./interact.js');

const START = C.START_FEN;
function at(a) { return C.fromAlg(a); }

// ---- 选择 ----
const st = I.create({ position: C.Position.fromFEN(START) });
T.eq(I.highlights(st).selected, -1, '初始无选中');
T.eq(I.highlights(st).targets, [], '初始无目标格');

I.select(st, at('e2'));
const h1 = I.highlights(st);
T.eq(h1.selected, at('e2'), '选中 e2');
T.eq(h1.targets.map(C.toAlg).sort(), ['e3', 'e4'], 'e2 的兵有两个合法目标');

// 选中对方的子：不选中，也不给目标
I.select(st, at('e7'));
T.eq(I.highlights(st).selected, -1, '轮到白方时点黑子不选中');

// 选中空格：清空
I.select(st, at('e2'));
I.select(st, at('d5'));
T.eq(I.highlights(st).selected, -1, '点空格清空选择');

// ---- pseudoOnly：被别住的子 ----
// 白王 e1、白马 f1、黑车 h1 —— 马被别在第一横行上
const pinned = I.create({ position: C.Position.fromFEN('4k3/8/8/8/8/8/8/4KN1r w - - 0 1') });
I.select(pinned, at('f1'));
const hp = I.highlights(pinned);
T.eq(hp.targets, [], '被别住的马没有合法目标');
T.ok(hp.pseudoOnly.length > 0, '被别住的马有伪合法目标 —— 差集非空');
T.ok(hp.pseudoOnly.every(sq => !hp.targets.some(t => t === sq)),
     'pseudoOnly 与 targets 不相交（它就是差集）');

// 未被别住时差集为空
const free = I.create({ position: C.Position.fromFEN('4k3/8/8/8/8/8/8/4KN2 w - - 0 1') });
I.select(free, at('f1'));
T.eq(I.highlights(free).pseudoOnly, [], '未被别住时差集为空');

// ---- check 高亮 ----
const chk = I.create({ position: C.Position.fromFEN('4k3/4R3/8/8/8/8/8/4K3 b - - 0 1') });
T.eq(I.highlights(chk).check, at('e8'), '被将军时高亮己方王的格');
T.eq(I.highlights(free).check, -1, '未被将军时不高亮');

// ---- 走法栈 ----
const s2 = I.create({ position: C.Position.fromFEN(START) });
T.eq(I.canUndo(s2), false, '初始不能撤销');
T.eq(I.canRedo(s2), false, '初始不能重做');

const r1 = I.tryMove(s2, at('e2'), at('e4'));
T.eq(r1.ok, true, 'e2e4 是合法走法');
T.eq(r1.san, 'e4', '返回 SAN');
T.eq(s2.pos.turn, C.BLACK, '走完轮到黑方');
T.eq(I.highlights(s2).lastMove.map(C.toAlg), ['e2', 'e4'], 'lastMove 记录起讫格');
T.eq(I.highlights(s2).selected, -1, '走完自动清空选择');
T.eq(I.canUndo(s2), true, '走过一步后可以撤销');

I.tryMove(s2, at('e7'), at('e5'));
T.eq(I.canUndo(s2), true, '两步后仍可撤销');
T.eq(I.highlights(s2).lastMove.map(C.toAlg), ['e7', 'e5'], '第二步后 lastMove 是 e7e5');

T.eq(I.undo(s2), true, '撤销成功');
T.eq(s2.pos.turn, C.BLACK, '撤销一步后轮回黑方');
T.eq(I.canRedo(s2), true, '撤销后可以重做');
// 撤销不该把 lastMove 清空——它该指向「产生当前局面」的那一步（e2e4），
// 这正是回看历史时定位当前所在的线索。
T.eq(I.highlights(s2).lastMove.map(C.toAlg), ['e2', 'e4'],
     '撤销 e7e5 后，lastMove 指向产生当前局面的 e2e4');
T.eq(I.redo(s2), true, '重做成功');
T.eq(s2.pos.turn, C.WHITE, '重做后轮回白方');
// redo 重放的正是这一步，不该把它现有的信息丢掉。
T.eq(I.highlights(s2).lastMove.map(C.toAlg), ['e7', 'e5'],
     '重做后 lastMove 是刚重放的 e7e5');

// 回退后走新棋 = 开新分支，旧分支被截断
I.undo(s2);
I.undo(s2);
T.eq(s2.pos.toFEN(), START, '连撤两步回到初始局面');
T.eq(I.highlights(s2).lastMove, [], '回到初始局面后 lastMove 为空');
T.eq(I.canRedo(s2), true, '此时可以重做');
I.tryMove(s2, at('d2'), at('d4'));
T.eq(I.canRedo(s2), false, '走了新棋之后旧分支被截断，不能再重做');
T.eq(I.canUndo(s2), true, '新分支上仍可撤销');
T.eq(I.redo(s2), false, '新分支上尝试重做应失败，而不是复活旧分支');
T.eq(I.highlights(s2).lastMove.map(C.toAlg), ['d2', 'd4'],
     '再分支之后 lastMove 是新分支自己的这一步，旧分支的 e2e4/e7e5 不会被复活');

// 非法走法不进栈
const before = s2.stack.length;
const bad = I.tryMove(s2, at('d4'), at('d8'));
T.eq(bad.ok, false, 'd4d8 不是合法走法');
T.eq(s2.stack.length, before, '非法走法不改变走法栈');

// 升变必须指定棋子，否则拒绝并给出待选项
// 注：计划原稿把黑王放在 e8——正是白兵唯一的升变格，导致白兵在 e7
// 一步棋都走不出（既不能推进，也无斜吃可用）。这不是实现问题，是
// FEN 摆错了；黑王挪到 h8，其余不变，白兵才有路可升变。
const pr = I.create({ position: C.Position.fromFEN('7k/4P3/8/8/8/8/8/4K3 w - - 0 1') });
const need = I.tryMove(pr, at('e7'), at('e8'));
T.eq(need.ok, false, '未指定升变棋子时不落子');
T.eq(need.needsPromotion, true, '而是要求先选升变棋子');
T.eq(need.choices.sort(), [C.Q, C.R, C.B, C.N].sort(), '给出四个待选项');
const done = I.tryMove(pr, at('e7'), at('e8'), C.N);
T.eq(done.ok, true, '指定马之后落子成功');
T.eq(done.san, 'e8=N', 'underpromotion 的 SAN 正确');

// 升变棋子给错了（比如给了王）：不能沉默地返回 reason: null——
// explain() 单看 from/to 会发现「不看 promo 确实有合法走法」从而判它合法。
const pr2 = I.create({ position: C.Position.fromFEN('7k/4P3/8/8/8/8/8/4K3 w - - 0 1') });
const badPromo = I.tryMove(pr2, at('e7'), at('e8'), C.K);
T.eq(badPromo.ok, false, '用王作升变棋子不合法');
T.ok(badPromo.reason && badPromo.reason.code === 'bad-promotion',
     '给出具体理由，而不是沉默的 null：' + JSON.stringify(badPromo.reason));

// ---- 非法走法的理由 ----
function why(fen, from, to) { return I.explain(C.Position.fromFEN(fen), at(from), at(to)); }

T.eq(why(START, 'e4', 'e5').code, 'empty', '起点是空格');
T.eq(why(START, 'e7', 'e6').code, 'not-your-piece', '轮到白方时动黑子');
T.eq(why(START, 'a1', 'a3').code, 'blocked', '车被自家兵挡住');
T.eq(why(START, 'b1', 'd2').code, 'own-piece', '落点是己方棋子');
T.eq(why(START, 'g1', 'g3').code, 'shape', '马不这么走');

// ---- 兵的可达性：attacksFrom 不含兵的直进，通用探针对兵会算错 ----
// 单步直进被挡
T.eq(why('4k3/8/8/8/8/4n3/4P3/4K3 w - - 0 1', 'e2', 'e3').code, 'blocked',
     '兵单步直进被挡');
// 双步直进被挡——中间格（e3）有子
T.eq(why('4k3/8/8/8/8/4n3/4P3/4K3 w - - 0 1', 'e2', 'e4').code, 'blocked',
     '兵双步直进被挡——中间格有子');
// 双步直进被挡——落点格（e4）有子，中间格空
T.eq(why('4k3/8/8/8/4n3/8/4P3/4K3 w - - 0 1', 'e2', 'e4').code, 'blocked',
     '兵双步直进被挡——落点格有子');
// 斜走一格但落点是空格、且不是吃过路兵的目标格
{
  const nc = why('4k3/8/8/8/4P3/8/8/4K3 w - - 0 1', 'e4', 'd5');
  T.eq(nc.code, 'no-capture', '兵斜走到空格：只有吃子时才能斜走');
  T.ok(/d5/.test(nc.en), '英文理由点名了空格：' + nc.en);
  T.ok(/d5/.test(nc.zh), '中文理由同样点名格子：' + nc.zh);
}
// 兵不能倒退
T.eq(why('4k3/8/8/8/4P3/8/8/4K3 w - - 0 1', 'e4', 'e3').code, 'shape',
     '兵不能倒退');
// 一次走三格
T.eq(why('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', 'e2', 'e5').code, 'shape',
     '兵不能一次走三格');
// ---- 黑兵：方向取反，最容易在符号上出错 ----
T.eq(why('4k3/4p3/4N3/8/8/8/8/4K3 b - - 0 1', 'e7', 'e6').code, 'blocked',
     '黑兵单步直进被挡');
T.eq(why('4k3/8/8/4p3/8/8/8/4K3 b - - 0 1', 'e5', 'd4').code, 'no-capture',
     '黑兵斜走到空格');

// 被别住：走完自己的王会被将
const pinFen = '4k3/8/8/8/8/8/8/4KN1r w - - 0 1';
const ex = why(pinFen, 'f1', 'd2');
T.eq(ex.code, 'exposes-king', '被别住的马一动，王就暴露');
T.ok(/rook on h1/.test(ex.en), '英文理由点名了攻击者及其所在格：' + ex.en);
T.ok(/h1/.test(ex.zh), '中文理由同样点名格子：' + ex.zh);

// 正被将军，走一步不相干的棋
const inChk = '4k3/4r3/8/8/8/8/8/4K1N1 w - - 0 1';
const ex2 = why(inChk, 'g1', 'f3');
T.eq(ex2.code, 'still-in-check', '被将军时走别处仍是将军');
T.ok(/e7/.test(ex2.en), '点名将军的子在 e7：' + ex2.en);

// 双将：两个攻击者都要点名，英文冠词要各自成立——
// "the bishop on a5 and the rook on h1"，不是共用一个 "the"
{
  const dbl = why('4k3/8/8/b7/8/8/8/1N2K2r w - - 0 1', 'b1', 'a3');
  T.eq(dbl.code, 'still-in-check', '同时被象与车将军，走无关的马仍是被将军');
  T.ok(/the bishop on a5 and the rook on h1/.test(dbl.en),
       '两个攻击者各自有冠词：' + dbl.en);
}

// 合法走法返回 null
T.eq(I.explain(C.Position.fromFEN(START), at('e2'), at('e4')), null, '合法走法没有理由');

// tryMove 失败时把理由带出来
const s3 = I.create({ position: C.Position.fromFEN(pinFen) });
const bad3 = I.tryMove(s3, at('f1'), at('d2'));
T.eq(bad3.ok, false, '被别住的走法失败');
T.eq(bad3.reason.code, 'exposes-king', '失败结果里带着理由');

T.report();
