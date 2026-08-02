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

T.report();
