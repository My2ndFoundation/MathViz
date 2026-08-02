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

T.report();
