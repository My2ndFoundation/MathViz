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

T.report();
