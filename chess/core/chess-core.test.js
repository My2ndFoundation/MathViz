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

T.report();
