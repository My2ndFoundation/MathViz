'use strict';
const T = require('./_test.js');
const C = require('./chess-core.js');

// ---- 0x88 坐标 ----
T.eq(C.SQ(0, 0), 0, 'a1 是 0');
T.eq(C.SQ(7, 7), 119, 'h8 是 119');
T.eq(C.fileOf(C.SQ(4, 3)), 4, 'e4 的 file 是 4');
T.eq(C.rankOf(C.SQ(4, 3)), 3, 'e4 的 rank 是 3');
T.eq(C.offBoard(C.SQ(4, 3)), false, 'e4 在盘内');
T.eq(C.offBoard(8), true, '索引 8 越界');
T.eq(C.offBoard(120), true, '索引 120 越界');
T.eq(C.toAlg(C.SQ(4, 3)), 'e4', 'SQ(4,3) 的代数记号是 e4');
T.eq(C.fromAlg('e4'), C.SQ(4, 3), 'e4 解析回 SQ(4,3)');
T.eq(C.toAlg(C.fromAlg('h8')), 'h8', 'h8 往返一致');
T.eq(C.toAlg(C.fromAlg('a1')), 'a1', 'a1 往返一致');
T.throws(() => C.fromAlg('z9'), 'fromAlg 对非法坐标应抛错');

// ---- FEN ----
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const p0 = C.Position.fromFEN(START);
T.eq(p0.board[C.fromAlg('e1')], C.K, 'e1 是白王');
T.eq(p0.board[C.fromAlg('e8')], -C.K, 'e8 是黑王');
T.eq(p0.board[C.fromAlg('a1')], C.R, 'a1 是白车');
T.eq(p0.board[C.fromAlg('d8')], -C.Q, 'd8 是黑后');
T.eq(p0.board[C.fromAlg('e4')], C.EMPTY, 'e4 为空');
T.eq(p0.turn, C.WHITE, '初始轮到白方');
T.eq(p0.castling, 15, '初始四项易位权俱全');
T.eq(p0.ep, -1, '初始无吃过路兵目标格');
T.eq(p0.half, 0, '初始半步计数为 0');
T.eq(p0.full, 1, '初始回合数为 1');
T.eq(p0.kingW, C.fromAlg('e1'), '白王位置记录正确');
T.eq(p0.kingB, C.fromAlg('e8'), '黑王位置记录正确');
T.eq(p0.toFEN(), START, '初始局面 FEN 往返一致');

const KIWI = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
T.eq(C.Position.fromFEN(KIWI).toFEN(), KIWI, 'Kiwipete FEN 往返一致');

const EPFEN = 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3';
const pep = C.Position.fromFEN(EPFEN);
T.eq(pep.ep, C.fromAlg('f6'), '吃过路兵目标格解析正确');
T.eq(pep.toFEN(), EPFEN, '带 ep 的 FEN 往返一致');

const NOCASTLE = '8/8/4k3/8/8/4K3/8/8 b - - 12 34';
const pnc = C.Position.fromFEN(NOCASTLE);
T.eq(pnc.castling, 0, '无易位权解析为 0');
T.eq(pnc.turn, C.BLACK, '轮到黑方');
T.eq(pnc.half, 12, '半步计数解析正确');
T.eq(pnc.full, 34, '回合数解析正确');
T.eq(pnc.toFEN(), NOCASTLE, '残局 FEN 往返一致');

const cl = p0.clone();
cl.board[C.fromAlg('e2')] = C.EMPTY;
T.eq(p0.board[C.fromAlg('e2')], C.P, 'clone 是深拷贝，改副本不影响原局面');

T.throws(() => C.Position.fromFEN('rnbqkbnr/pppppppp/8/8 w - -'), 'FEN 横行数不足应抛错');
T.throws(() => C.Position.fromFEN('rnbqkbnr/ppppXppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1'), 'FEN 未知棋子字符应抛错');
T.throws(() => C.Position.fromFEN('rnbqkbnr/ppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1'), 'FEN 某横行格数不足 8 应抛错');

// ---- 伪合法走法生成 ----
function movesFrom(pos, from) {
  return pos.pseudoLegalMoves()
    .filter(m => m.from === C.fromAlg(from))
    .map(m => C.toAlg(m.to)).sort();
}

// 空盘上的单子机动性
const rookMid = C.Position.fromFEN('8/8/8/3R4/8/8/8/K6k w - - 0 1');
T.eq(movesFrom(rookMid, 'd5').length, 14, '空盘中央的车有 14 个走法');

const knightMid = C.Position.fromFEN('8/8/8/3N4/8/8/8/K6k w - - 0 1');
T.eq(movesFrom(knightMid, 'd5'), ['b4','b6','c3','c7','e3','e7','f4','f6'], '空盘中央的马有 8 个走法');

const knightCorner = C.Position.fromFEN('N7/8/8/8/8/8/8/K6k w - - 0 1');
T.eq(movesFrom(knightCorner, 'a8'), ['b6','c7'], '角上的马只有 2 个走法');

const bishopMid = C.Position.fromFEN('8/8/8/3B4/8/8/8/K6k w - - 0 1');
T.eq(movesFrom(bishopMid, 'd5').length, 13, '空盘中央的象有 13 个走法');

const queenMid = C.Position.fromFEN('8/8/8/3Q4/8/8/8/K6k w - - 0 1');
T.eq(movesFrom(queenMid, 'd5').length, 27, '空盘中央的后有 27 个走法');

// 滑行被己方子挡住、可吃对方子
const blocked = C.Position.fromFEN('8/8/8/3R4/8/8/3P4/K2r3k w - - 0 1');
T.eq(movesFrom(blocked, 'd5'), ['a5','b5','c5','d3','d4','d6','d7','d8','e5','f5','g5','h5'],
     '车被己方兵挡在 d3，不能到 d2/d1');

const canCapture = C.Position.fromFEN('8/8/8/3R4/8/8/3r4/K6k w - - 0 1');
T.ok(movesFrom(canCapture, 'd5').indexOf('d2') >= 0, '车能吃到 d2 的黑车');
T.ok(movesFrom(canCapture, 'd5').indexOf('d1') < 0, '车不能穿过被吃的子到 d1');

// 兵：推进、双步、斜吃
const pawns = C.Position.fromFEN('8/8/8/8/8/3p1p2/4P3/K6k w - - 0 1');
T.eq(movesFrom(pawns, 'e2'), ['d3','e3','e4','f3'], '初始行的白兵：单步、双步、两侧斜吃');

const pawnBlocked = C.Position.fromFEN('8/8/8/8/8/4n3/4P3/K6k w - - 0 1');
T.eq(movesFrom(pawnBlocked, 'e2'), [], '正前方有子时白兵不能推进，也不能斜吃正前方');

const pawnNoDouble = C.Position.fromFEN('8/8/8/8/4n3/8/4P3/K6k w - - 0 1');
T.eq(movesFrom(pawnNoDouble, 'e2'), ['e3'], '双步落点被占时只能走单步');

const blackPawn = C.Position.fromFEN('8/4p3/3P1P2/8/8/8/8/K6k b - - 0 1');
T.eq(movesFrom(blackPawn, 'e7'), ['d6','e5','e6','f6'], '黑兵方向相反，同样有双步与斜吃');

// 升变：一个落点产生四条走法
const promo = C.Position.fromFEN('8/4P3/8/8/8/8/8/K6k w - - 0 1');
const promoMoves = promo.pseudoLegalMoves().filter(m => m.from === C.fromAlg('e7'));
T.eq(promoMoves.length, 4, '兵到底排产生四条升变走法');
T.eq(promoMoves.map(m => m.promo).sort(), [C.N, C.B, C.R, C.Q].sort(), '四种升变棋子齐全');
T.ok(promoMoves.every(m => m.flags & C.FLAG.PROMO), '升变走法都带 PROMO 标志');

// 只生成当前一方的走法
const turnCheck = C.Position.fromFEN('8/4p3/8/8/8/8/4P3/K6k w - - 0 1');
T.ok(turnCheck.pseudoLegalMoves().every(m => m.piece > 0), '轮到白方时不生成黑方走法');

// ---- 施加与撤销 ----
function findMove(pos, from, to, promo) {
  const f = C.fromAlg(from), t = C.fromAlg(to);
  const m = pos.pseudoLegalMoves().find(x =>
    x.from === f && x.to === t && (promo ? x.promo === promo : !x.promo));
  if (!m) throw new Error('测试用例找不到走法 ' + from + to);
  return m;
}

const mk1 = C.Position.fromFEN(START);
const e4 = findMove(mk1, 'e2', 'e4');
const after = mk1.make(e4);
T.eq(after.board[C.fromAlg('e4')], C.P, 'make 后 e4 是白兵');
T.eq(after.board[C.fromAlg('e2')], C.EMPTY, 'make 后 e2 为空');
T.eq(after.turn, C.BLACK, 'make 后轮到黑方');
T.eq(after.ep, C.fromAlg('e3'), '双步推进设置 ep 目标格为 e3');
T.eq(after.half, 0, '兵走动使半步计数归零');
T.eq(after.full, 1, '白方走完回合数不变');
T.eq(mk1.board[C.fromAlg('e2')], C.P, 'make 不修改原局面');
T.eq(mk1.turn, C.WHITE, 'make 不修改原局面的轮次');

const blackMoved = after.make(findMove(after, 'e7', 'e5'));
T.eq(blackMoved.full, 2, '黑方走完回合数 +1');

// _make / _unmake 必须精确还原
const roundTrip = C.Position.fromFEN(KIWI);
const before = roundTrip.toFEN();
for (const m of roundTrip.pseudoLegalMoves()) {
  const undo = roundTrip._make(m);
  roundTrip._unmake(m, undo);
  if (roundTrip.toFEN() !== before) {
    T.eq(roundTrip.toFEN(), before, '_unmake 未能还原走法 ' + C.toAlg(m.from) + C.toAlg(m.to));
    break;
  }
}
T.eq(roundTrip.toFEN(), before, 'Kiwipete 全部伪合法走法 make/unmake 后局面不变');

// 吃子与半步计数
const capPos = C.Position.fromFEN('8/8/8/3r4/8/8/3R4/K6k w - - 7 20');
const cap = findMove(capPos, 'd2', 'd5');
const capAfter = capPos.make(cap);
T.eq(capAfter.board[C.fromAlg('d5')], C.R, '吃子后落点是白车');
T.eq(capAfter.half, 0, '吃子使半步计数归零');

const quiet = C.Position.fromFEN('8/8/8/8/8/8/3R4/K6k w - - 7 20');
T.eq(quiet.make(findMove(quiet, 'd2', 'd4')).half, 8, '非吃子非兵走动使半步计数 +1');

// 升变
const promoPos = C.Position.fromFEN('8/4P3/8/8/8/8/8/K6k w - - 0 1');
const promoQ = promoPos.make(findMove(promoPos, 'e7', 'e8', C.Q));
T.eq(promoQ.board[C.fromAlg('e8')], C.Q, '升变后 e8 是白后');
T.eq(promoQ.board[C.fromAlg('e7')], C.EMPTY, '升变后 e7 为空');

// 王移动后位置记录同步
const kingPos = C.Position.fromFEN('8/8/8/8/8/8/8/K6k w - - 0 1');
T.eq(kingPos.make(findMove(kingPos, 'a1', 'b1')).kingW, C.fromAlg('b1'), '白王移动后 kingW 同步更新');

// 易位权因走动而失去
const rights = C.Position.fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
T.eq(rights.make(findMove(rights, 'e1', 'e2')).castling, 12, '白王走动后失去 KQ，保留 kq');
T.eq(rights.make(findMove(rights, 'a1', 'a2')).castling, 13, 'a1 车走动后失去 Q');
T.eq(rights.make(findMove(rights, 'h1', 'h2')).castling, 14, 'h1 车走动后失去 K');

const rookTaken = C.Position.fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
const takeA8 = rookTaken.pseudoLegalMoves().find(m =>
  m.from === C.fromAlg('a1') && m.to === C.fromAlg('a8'));
// a1 车离家清 Q(2)，a8 车被吃清 q(8)：15 − 2 − 8 = 5（剩 K 与 k）
T.eq(rookTaken.make(takeA8).castling, 5, 'a1 车吃掉 a8 车后，双方各失一项后翼易位权');

// ---- 攻击检测 ----
const atk = C.Position.fromFEN('8/8/8/3q4/8/8/8/K6k w - - 0 1');
T.eq(atk.isAttacked(C.fromAlg('d1'), C.BLACK), true, '黑后沿直列攻击 d1');
T.eq(atk.isAttacked(C.fromAlg('h1'), C.BLACK), true, '黑后沿斜线攻击 h1');
T.eq(atk.isAttacked(C.fromAlg('e3'), C.BLACK), false, 'e3 不在黑后的任一射线上');

const blockAtk = C.Position.fromFEN('8/8/8/3q4/8/3P4/8/K6k w - - 0 1');
T.eq(blockAtk.isAttacked(C.fromAlg('d1'), C.BLACK), false, '中间有子挡住时不算攻击');
T.eq(blockAtk.isAttacked(C.fromAlg('d3'), C.BLACK), true, '挡路的那颗子本身是被攻击的');

const knightAtk = C.Position.fromFEN('8/8/8/3n4/8/8/8/K6k w - - 0 1');
T.eq(knightAtk.isAttacked(C.fromAlg('c3'), C.BLACK), true, '马攻击 c3');
T.eq(knightAtk.isAttacked(C.fromAlg('d3'), C.BLACK), false, '马不攻击同一直列的 d3');

// 兵的攻击是斜的，不是正前方 —— 最常写错的一处
const pawnAtk = C.Position.fromFEN('8/8/8/8/8/4p3/8/K6k w - - 0 1');
T.eq(pawnAtk.isAttacked(C.fromAlg('d2'), C.BLACK), true, '黑兵斜向攻击 d2');
T.eq(pawnAtk.isAttacked(C.fromAlg('f2'), C.BLACK), true, '黑兵斜向攻击 f2');
T.eq(pawnAtk.isAttacked(C.fromAlg('e2'), C.BLACK), false, '黑兵不攻击正前方的 e2');
T.eq(pawnAtk.isAttacked(C.fromAlg('e4'), C.BLACK), false, '黑兵不向后攻击');

const wPawnAtk = C.Position.fromFEN('8/8/8/8/4P3/8/8/K6k w - - 0 1');
T.eq(wPawnAtk.isAttacked(C.fromAlg('d5'), C.WHITE), true, '白兵向上斜攻 d5');
T.eq(wPawnAtk.isAttacked(C.fromAlg('d3'), C.WHITE), false, '白兵不向下攻击');

// 将军
T.eq(C.Position.fromFEN('4k3/8/8/8/8/8/8/4K2R b K - 0 1').inCheck(C.BLACK), false,
     '车与黑王不同列时未将军');
T.eq(C.Position.fromFEN('4k3/8/8/8/8/8/8/4K2R w K - 0 1').inCheck(C.WHITE), false,
     '白方未被将军');
T.eq(C.Position.fromFEN('4k3/8/8/8/8/8/8/R3K3 b Q - 0 1').inCheck(C.BLACK), false,
     'a1 车不攻击 e8');
T.eq(C.Position.fromFEN('4k3/4R3/8/8/8/8/8/4K3 b - - 0 1').inCheck(C.BLACK), true,
     'e7 车将军 e8 的黑王');

// attackedBy：c6 同时在 c2 车的直列上、又是 d4 马的跳点
const multi = C.Position.fromFEN('8/8/2p5/8/3N4/8/2R5/K6k w - - 0 1');
T.eq(multi.attackedBy(C.fromAlg('c6'), C.WHITE).map(C.toAlg).sort(), ['c2','d4'].sort(),
     'c6 同时被 c2 的车与 d4 的马攻击');
T.eq(multi.attackedBy(C.fromAlg('c4'), C.WHITE).map(C.toAlg), ['c2'],
     'c4 只被车攻击 —— d4 到 c4 是一格，不是马步');

// attacksFrom：盘上不能有己方子占住跳点，否则会被走法生成器过滤掉
const lone = C.Position.fromFEN('8/8/8/8/3N4/8/8/K6k w - - 0 1');
T.eq(lone.attacksFrom(C.fromAlg('d4')).length, 8, '空旷处的马攻击 8 格');
T.eq(lone.attacksFrom(C.fromAlg('e5')), [], '空格没有攻击范围');

// ---- 易位 ----
const cst = C.Position.fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
T.eq(movesFrom(cst, 'e1').sort(), ['c1','d1','d2','e2','f1','f2','g1'].sort(),
     '两侧易位权俱全时白王有 7 个走法（含 c1 与 g1）');

const cstAfter = cst.make(cst.pseudoLegalMoves().find(m => m.flags & C.FLAG.CASTLE_K));
T.eq(cstAfter.board[C.fromAlg('g1')], C.K, '短易位后王在 g1');
T.eq(cstAfter.board[C.fromAlg('f1')], C.R, '短易位后车在 f1');
T.eq(cstAfter.board[C.fromAlg('e1')], C.EMPTY, '短易位后 e1 为空');
T.eq(cstAfter.board[C.fromAlg('h1')], C.EMPTY, '短易位后 h1 为空');
T.eq(cstAfter.kingW, C.fromAlg('g1'), '短易位后 kingW 更新');
T.eq(cstAfter.castling, 12, '短易位后白方失去全部易位权');

const cstQ = cst.make(cst.pseudoLegalMoves().find(m => m.flags & C.FLAG.CASTLE_Q));
T.eq(cstQ.board[C.fromAlg('c1')], C.K, '长易位后王在 c1');
T.eq(cstQ.board[C.fromAlg('d1')], C.R, '长易位后车在 d1');
T.eq(cstQ.board[C.fromAlg('a1')], C.EMPTY, '长易位后 a1 为空');

// 易位的四个前提，逐条测
const occupied = C.Position.fromFEN('r3k2r/8/8/8/8/8/8/R3KB1R w KQkq - 0 1');
T.ok(!occupied.pseudoLegalMoves().some(m => m.flags & C.FLAG.CASTLE_K),
     '王与车之间有子时不能短易位');

const bOccupied = C.Position.fromFEN('r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1');
T.ok(!bOccupied.pseudoLegalMoves().some(m => m.flags & C.FLAG.CASTLE_Q),
     '长易位路径上 b1 有子时不能长易位（b1 必须为空，尽管王不经过它）');

const noRight = C.Position.fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w Qkq - 0 1');
T.ok(!noRight.pseudoLegalMoves().some(m => m.flags & C.FLAG.CASTLE_K),
     '没有 K 权时不能短易位');

const inChk = C.Position.fromFEN('r3k2r/8/8/8/8/8/4r3/R3K2R w KQkq - 0 1');
T.ok(!inChk.pseudoLegalMoves().some(m => m.flags & (C.FLAG.CASTLE_K | C.FLAG.CASTLE_Q)),
     '被将军时不能易位');

const throughChk = C.Position.fromFEN('r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1');
T.ok(!throughChk.pseudoLegalMoves().some(m => m.flags & C.FLAG.CASTLE_K),
     'f1 受攻击时不能短易位（王不能穿过被攻击的格）');
T.ok(throughChk.pseudoLegalMoves().some(m => m.flags & C.FLAG.CASTLE_Q),
     'f1 受攻击不影响长易位');

const landChk = C.Position.fromFEN('r3k2r/8/8/8/8/8/6r1/R3K2R w KQkq - 0 1');
T.ok(!landChk.pseudoLegalMoves().some(m => m.flags & C.FLAG.CASTLE_K),
     'g1 受攻击时不能短易位（落点也不能被攻击）');

// b1 被攻击不妨碍长易位 —— 王不经过 b1
const b1Atk = C.Position.fromFEN('r3k2r/8/8/8/8/8/1r6/R3K2R w KQkq - 0 1');
T.ok(b1Atk.pseudoLegalMoves().some(m => m.flags & C.FLAG.CASTLE_Q),
     'b1 被攻击不影响长易位，因为王不经过 b1');

// ---- 吃过路兵 ----
const ep = C.Position.fromFEN('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3');
const epMove = ep.pseudoLegalMoves().find(m => m.flags & C.FLAG.EP);
T.ok(epMove, '存在吃过路兵走法');
T.eq(C.toAlg(epMove.from), 'e5', '吃过路兵的起点是 e5');
T.eq(C.toAlg(epMove.to), 'f6', '吃过路兵的落点是 f6');
const epAfter = ep.make(epMove);
T.eq(epAfter.board[C.fromAlg('f6')], C.P, '吃过路兵后 f6 是白兵');
T.eq(epAfter.board[C.fromAlg('f5')], C.EMPTY, '被吃的黑兵在 f5 被移走，不在落点格');
T.eq(epAfter.board[C.fromAlg('e5')], C.EMPTY, 'e5 为空');
T.eq(epAfter.ep, -1, '吃过路兵后 ep 目标格清空');

// ep 只在紧接的那一步有效
const epGone = ep.make(findMove(ep, 'd2', 'd3'));
T.eq(epGone.ep, -1, '走了别的棋之后 ep 目标格消失');

// unmake 必须把被吃的过路兵放回它原来的格，而不是落点格
const epRT = C.Position.fromFEN('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3');
const epBefore = epRT.toFEN();
const undoEp = epRT._make(epMove);
epRT._unmake(epMove, undoEp);
T.eq(epRT.toFEN(), epBefore, '吃过路兵的 make/unmake 精确还原');

// 易位的 unmake 也要把车放回去
const cRT = C.Position.fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
const cBefore = cRT.toFEN();
for (const m of cRT.pseudoLegalMoves()) {
  const u = cRT._make(m);
  cRT._unmake(m, u);
}
T.eq(cRT.toFEN(), cBefore, '含易位的全部走法 make/unmake 后局面不变');

// ---- 合法走法过滤 ----
T.eq(C.Position.fromFEN(START).legalMoves().length, 20, '初始局面有 20 个合法走法');

// 被别住的子不能动
// 注：原始简报此处的 FEN（马在 e2、车在 h1、王在 e1）并不构成别子 ——
// e2 不在 e1–h1 这条直线上，那其实是"王被将军，Ng1 挡将"的合法局面。
// 已改为马真正夹在王与车之间（f1）的局面，让测试名与局面相符。
const pinned = C.Position.fromFEN('4k3/8/8/8/8/8/8/4KN1r w - - 0 1');
T.eq(pinned.legalMoves().filter(m => m.from === C.fromAlg('f1')).length, 0,
     '被 h1 车沿第一横行别住的马一步也不能走');
T.ok(pinned.pseudoLegalMoves().filter(m => m.from === C.fromAlg('f1')).length > 0,
     '同一颗子的伪合法走法不为零 —— 差集正是"被别住"');

// 沿别住方向仍可移动
// 同理改为车真正被 e 列上的黑车别住（e2 挡在王 e1 与黑车 e8 之间）。
const pinLine = C.Position.fromFEN('4r2k/8/8/8/8/8/4R3/4K3 w - - 0 1');
T.ok(pinLine.legalMoves().some(m => m.from === C.fromAlg('e2') && m.to === C.fromAlg('e3')),
     '被沿直列别住的车仍可沿该直列移动');

// 被将军时只能应将
const mustBlock = C.Position.fromFEN('4k3/8/8/8/8/8/8/r3K3 w - - 0 1');
T.ok(mustBlock.legalMoves().every(m => !mustBlock.make(m).inCheck(C.WHITE)),
     '所有合法走法走完之后白王都不再被将军');

// 王不能走到被攻击的格
const kingSafe = C.Position.fromFEN('4k3/8/8/8/8/8/8/4K2r w - - 0 1');
T.ok(!kingSafe.legalMoves().some(m => m.to === C.fromAlg('f1')),
     '白王不能走到仍被 h1 车攻击的 f1');

// ---- status ----
T.eq(C.Position.fromFEN(START).status(), 'ongoing', '初始局面进行中');
T.eq(C.Position.fromFEN('4k3/4R3/8/8/8/8/8/4K3 b - - 0 1').status(), 'check', '被将军但可逃');
T.eq(C.Position.fromFEN('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3').status(),
     'checkmate', 'Fool\'s Mate 是将死');
T.eq(C.Position.fromFEN('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1').status(), 'stalemate',
     '黑王无合法走法且未被将军 —— 逼和');
T.eq(C.Position.fromFEN('4k3/8/8/8/8/8/8/4K3 w - - 0 1').status(), 'insufficient',
     '王对王是子力不足');
T.eq(C.Position.fromFEN('4k3/8/8/8/8/8/8/4KB2 w - - 0 1').status(), 'insufficient',
     '王象对王是子力不足');
T.eq(C.Position.fromFEN('4k3/8/8/8/8/8/8/4KN2 w - - 0 1').status(), 'insufficient',
     '王马对王是子力不足');
T.eq(C.Position.fromFEN('4k3/8/8/8/8/8/8/4KR2 w - - 0 1').status(), 'ongoing',
     '王车对王不是子力不足');
T.eq(C.Position.fromFEN('4k3/8/8/8/8/8/8/R3K3 w - - 100 60').status(), 'fifty',
     '半步计数达到 100 触发五十步规则');

T.report();
