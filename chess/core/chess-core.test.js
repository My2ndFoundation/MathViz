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

// ---- FEN 校验（修复轮次 1 · I1）----
T.throws(() => C.Position.fromFEN('4k3/8/8/8/8/8/8/4K3 z - - 0 1'), '轮次字段非 w/b 应抛错');
T.throws(() => C.Position.fromFEN('4k3/8/8/8/8/8/8/4K3 w - - xx 1'), '半步计数非数字应抛错');
T.throws(() => C.Position.fromFEN('4k3/8/8/8/8/8/8/4K3 w - - 0 yy'), '回合数非数字应抛错');
T.throws(() => C.Position.fromFEN('8/8/8/8/8/8/8/4K3 w - - 0 1'), '没有黑王应抛错');
T.throws(() => C.Position.fromFEN('4k3/8/8/8/8/8/8/8 w - - 0 1'), '没有白王应抛错');
T.throws(() => C.Position.fromFEN('4k3/8/8/8/8/8/8/K3K3 w - - 0 1'), '白方两个王应抛错');

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
T.eq(promoMoves.map(m => m.promo).sort((a, b) => a - b), [C.N, C.B, C.R, C.Q].sort((a, b) => a - b), '四种升变棋子齐全');
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

// attacksFrom：与走法不同，跳点上有己方子也不影响"攻击"这件事本身
const lone = C.Position.fromFEN('8/8/8/8/3N4/8/8/K6k w - - 0 1');
T.eq(lone.attacksFrom(C.fromAlg('d4')).length, 8, '空旷处的马攻击 8 格');
T.eq(lone.attacksFrom(C.fromAlg('e5')), [], '空格没有攻击范围');

// ---- 攻击几何修复（修复轮次 1 · CRITICAL）----
// 原实现借道 pseudoLegalMoves()，只回答"能走到哪"：
// 空盘上孤立的兵不攻击任何格（因为兵前方没有可吃的子）、
// 己方棋子占据的格不算被攻击（因为走法生成器不会生成"吃自己"的着）。
// 这两条都与"攻击"的国际象棋定义矛盾，已改为独立于走法生成的几何扫描。

// 孤立兵攻击的是它斜前方两格，无论那里有没有子
const loneWP = C.Position.fromFEN('8/8/8/8/4P3/8/8/K6k w - - 0 1');
T.eq(loneWP.attacksFrom(C.fromAlg('e4')).map(C.toAlg).sort(), ['d5', 'f5'].sort(),
     '空盘上孤立的白兵仍攻击 d5 与 f5 —— 与"能走到哪"无关');

const loneBP = C.Position.fromFEN('8/8/8/4p3/8/8/8/K6k w - - 0 1');
T.eq(loneBP.attacksFrom(C.fromAlg('e5')).map(C.toAlg).sort(), ['d4', 'f4'].sort(),
     '空盘上孤立的黑兵攻击 d4 与 f4（方向相反）');

// 被己方棋子占据的格仍然"被攻击"——这正是"防守"的定义
const defend = C.Position.fromFEN('k7/8/2P5/8/8/8/2R5/K7 w - - 0 1');
T.eq(defend.isAttacked(C.fromAlg('c6'), C.WHITE), true, 'c2 车攻击着己方在 c6 的兵（即在防守它）');
T.eq(defend.attackedBy(C.fromAlg('c6'), C.WHITE).map(C.toAlg), ['c2'],
     'attackedBy 与 isAttacked 在"己方子被攻击"这件事上必须一致');

// 被 8 颗己方兵包围的马仍攻击全部 8 格 —— 跳点有没有子不影响马的攻击范围
const ringed = C.Position.fromFEN('k7/8/2P1P3/1P3P2/3N4/1P3P2/2P1P3/K7 w - - 0 1');
T.eq(ringed.attacksFrom(C.fromAlg('d4')).length, 8, '被己方兵包围的马仍攻击 8 格');

// 不变量：attackedBy(s, c).length > 0 当且仅当 isAttacked(s, c) —— 这正是本 bug 违反的性质。
// 在一批已有局面上，对全部 64 格逐一核对两者是否一致。
function checkAgreement(pos) {
  for (const c of [C.WHITE, C.BLACK]) {
    for (let f = 0; f < 8; f++) {
      for (let r = 0; r < 8; r++) {
        const s = C.SQ(f, r);
        if ((pos.attackedBy(s, c).length > 0) !== pos.isAttacked(s, c)) return false;
      }
    }
  }
  return true;
}
for (const pos of [atk, blockAtk, knightAtk, pawnAtk, wPawnAtk, multi, lone, defend, ringed,
                    C.Position.fromFEN(START), C.Position.fromFEN(KIWI),
                    C.Position.fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')]) {
  T.ok(checkAgreement(pos), 'attackedBy 与 isAttacked 在全部 64 格上必须一致：' + pos.toFEN());
}

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

// 黑方易位（修复轮次 1 · M8）：此前只有 Kiwipete perft 间接覆盖了黑方易位，
// 补上直接测试，短易位与长易位各一个。
const cstB = C.Position.fromFEN('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1');
const cstBAfterK = cstB.make(cstB.pseudoLegalMoves().find(m => m.flags & C.FLAG.CASTLE_K));
T.eq(cstBAfterK.board[C.fromAlg('g8')], -C.K, '黑方短易位后王在 g8');
T.eq(cstBAfterK.board[C.fromAlg('f8')], -C.R, '黑方短易位后车在 f8');
T.eq(cstBAfterK.board[C.fromAlg('e8')], C.EMPTY, '黑方短易位后 e8 为空');
T.eq(cstBAfterK.board[C.fromAlg('h8')], C.EMPTY, '黑方短易位后 h8 为空');
T.eq(cstBAfterK.kingB, C.fromAlg('g8'), '黑方短易位后 kingB 更新');
T.eq(cstBAfterK.castling, 3, '黑方短易位后黑方失去全部易位权（保留白方 KQ）');

const cstBAfterQ = cstB.make(cstB.pseudoLegalMoves().find(m => m.flags & C.FLAG.CASTLE_Q));
T.eq(cstBAfterQ.board[C.fromAlg('c8')], -C.K, '黑方长易位后王在 c8');
T.eq(cstBAfterQ.board[C.fromAlg('d8')], -C.R, '黑方长易位后车在 d8');
T.eq(cstBAfterQ.board[C.fromAlg('a8')], C.EMPTY, '黑方长易位后 a8 为空');

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
// 反面断言（修复轮次 1 · M6）：光测"沿线可动"测不出别子逻辑本身 ——
// 一个完全不做合法性过滤的实现也会让这条断言通过。必须同时证明
// "离开这条线"是非法的。
T.ok(!pinLine.legalMoves().some(m => m.from === C.fromAlg('e2') && m.to === C.fromAlg('b2')),
     '被沿直列别住的车不能离开该直列（否则暴露王）');

// 被将军时只能应将（修复轮次 1 · I4）
// 原断言 `legalMoves().every(...)` 在 legalMoves() 返回空数组时也为真，
// 且用同一个 legalMoves() 的产物去验证 legalMoves() 本身，是同义反复。
// 换成一个三种应将方式（走王、吃将军子、挡将）都存在的局面，用
// 恰好一致的走法全集来断言：白王 e1 被 e8 车将军，
// 白车 a8 可吃掉 e8 车，白马 f2 可跳到 e4 挡住将军线，
// 王本身可走到 d1/d2/f1（未被攻击）。
const mustBlock = C.Position.fromFEN('R3r2k/8/8/8/8/8/5N2/4K3 w - - 0 1');
T.eq(mustBlock.legalMoves().map(C.moveToUCI).sort(),
     ['a8e8', 'e1d1', 'e1d2', 'e1f1', 'f2e4'].sort(),
     '将军时的合法走法恰好是：吃掉将军车（a8e8）、挡将（f2e4）、走王三格（e1d1/e1d2/e1f1）');

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

// 子力不足的两个陷阱（修复轮次 1 · I3）：这两条不该被一次天真的重写误伤。
T.eq(C.Position.fromFEN('k7/8/8/8/8/8/8/NNK5 w - - 0 1').status(), 'ongoing',
     '王双马对王不是子力不足——理论上仍存在杀法（尽管实战极难逼出）');
T.eq(C.Position.fromFEN('k7/8/8/5b2/8/8/8/K1B5 w - - 0 1').status(), 'ongoing',
     '异色格象对异色格象不是子力不足（本函数不比较象所在格颜色，见源码注释）');

// check 必须排在 fifty 之前（修复轮次 1 · 判断调用）：五十步规则是"可申明"而非
// 自动生效，被将军是当下正在发生的事实，棋局仍然"活着"。
T.eq(C.Position.fromFEN('4k3/4R3/8/8/8/8/8/4K3 b - - 100 60').status(), 'check',
     '半步计数达到 100 但正被将军时，应报告 check 而非 fifty');

// ---- perft ----
// 参考值取自国际象棋编程社区的公认定值。任何一处对不上，
// 都说明走法生成器在某个边界上错了 —— 而人眼查不出这类错。
const PERFT = [
  { name: '初始局面', fen: START,
    counts: [20, 400, 8902, 197281, 4865609] },
  { name: 'Kiwipete', fen: KIWI,
    counts: [48, 2039, 97862, 4085603] },
  { name: '位置3（兵与车的边界）', fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    counts: [14, 191, 2812, 43238, 674624] },
  { name: '位置4（升变与别子）', fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    counts: [6, 264, 9467, 422333] },
  { name: '位置5', fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    counts: [44, 1486, 62379, 2103487] },
  { name: '位置6', fen: 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',
    counts: [46, 2079, 89890, 3894594] },
];

for (const c of PERFT) {
  for (let d = 1; d <= c.counts.length; d++) {
    const t0 = Date.now();
    const got = C.perft(C.Position.fromFEN(c.fen), d);
    const ms = Date.now() - t0;
    T.eq(got, c.counts[d - 1], 'perft ' + c.name + ' depth ' + d + '（用时 ' + ms + 'ms）');
  }
}

// perftDivide 的分支总和必须等于 perft 本身（修复轮次 1 · M3）——
// 近乎零成本的一致性检查，能在 Task 9 依赖 moveToUCI 之前
// 就抓住例如 PROMO_CH 拼错这类问题。
const divideSum = Object.values(C.perftDivide(C.Position.fromFEN(START), 2))
  .reduce((a, b) => a + b, 0);
T.eq(divideSum, C.perft(C.Position.fromFEN(START), 2), 'perftDivide 各分支之和应等于 perft(depth 2)');

// ---- SAN ----
function san(fen, from, to, promo) {
  const p = C.Position.fromFEN(fen);
  const f = C.fromAlg(from), t = C.fromAlg(to);
  const m = p.legalMoves().find(x => x.from === f && x.to === t && (promo ? x.promo === promo : !x.promo));
  return C.moveToSAN(p, m);
}

T.eq(san(START, 'e2', 'e4'), 'e4', '兵推进只写落点');
T.eq(san(START, 'g1', 'f3'), 'Nf3', '子力走动写棋子字母 + 落点');
T.eq(san('8/8/8/3r4/8/8/3R4/K6k w - - 0 1', 'd2', 'd5'), 'Rxd5', '吃子用 x');
// 原始简报此处的 FEN 没有黑王（'8/8/8/8/8/8/4p3/3P3K'），
// 会被已合并的 FEN 校验拒绝（黑方必须恰好一个王）。
// 已在 h8（与 e 列/第一横行的战术无关）补上黑王，语义不变。
T.eq(san('7k/8/8/8/8/8/4p3/3P3K b - - 0 1', 'e2', 'e1', C.Q), 'e1=Q+', '升变写 =Q，并带将军号');
T.eq(san('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1', 'g1'), 'O-O', '短易位');
T.eq(san('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1', 'c1'), 'O-O-O', '长易位');
T.eq(san('4k3/8/8/8/8/8/8/4R2K w - - 0 1', 'e1', 'e7'), 'Re7+', '将军加 +');
T.eq(san('4k3/8/4Q3/8/8/8/8/4K3 w - - 0 1', 'e6', 'e7'), 'Qe7+', '后将军');
// 后落 g7 与黑王贴身，且被 g6 的白王保护 —— 这才是真将死。
// （若白王不在 g6，黑王可以 Kxg7，就只是将军而非将死。）
T.eq(san('7k/Q7/6K1/8/8/8/8/8 w - - 0 1', 'a7', 'g7'), 'Qg7#', '将死加 #');

// 兵吃子写起始直列
T.eq(san('8/8/8/3p4/4P3/8/8/K6k w - - 0 1', 'e4', 'd5'), 'exd5', '兵吃子写 e 列 + x');

// 消歧：两颗同种子都能到同一格
// 以下几处原始简报的 FEN（'8/8/8/8/8/8/8/R6R'、'R7/8/8/8/8/8/8/R7'、
// 'Q6Q/8/8/8/8/8/8/Q6Q'）都没有王，会被已合并的 FEN 校验拒绝
// （双方必须各恰好一个王）。已在不影响消歧几何的角落补上双王。
T.eq(san('3K1k2/8/8/8/8/8/8/R6R w - - 0 1', 'a1', 'd1'), 'Rad1', '同一横行两车 —— 用直列消歧');
T.eq(san('3K1k2/8/8/8/8/8/8/R6R w - - 0 1', 'h1', 'd1'), 'Rhd1', '另一侧同理');
T.eq(san('R7/8/8/8/4k3/8/4K3/R7 w - - 0 1', 'a1', 'a5'), 'R1a5', '同一直列两车 —— 用横行消歧');
T.eq(san('R7/8/8/8/4k3/8/4K3/R7 w - - 0 1', 'a8', 'a5'), 'R8a5', '另一侧同理');
// 简报另有一处不只是缺王，逻辑本身就错了：'Q6Q/8/8/8/8/8/8/Q6Q'（角上四后）
// 从 a1 出发时，a8 与 h1 两后都无法用一步走到 d4（既不同列同行也不同斜线），
// 唯一能到 d4 的对手只有 h8（斜线），而 h8 与 a1 不同列——按简报自己给出的
// disambiguate() 算法，这只需要"直列"就够消歧（"Qad4"），并不需要写全格。
// 换成一个真正需要"直列与横行都不足"的局面：a7（与 a1 同列）和 g1（与 a1
// 同行）都能斜线走到 d4，这样两条消歧线索都被占用，才真的需要 'Qa1d4'。
T.eq(san('4k3/Q7/8/8/8/8/8/Q5QK w - - 0 1', 'a1', 'd4'), 'Qa1d4', '直列与横行都不足以消歧时写全格');
// h1 车沿第一横行到 b1 的路上只有空格（a1 在 b1 更左侧，挡不住），
// 所以两车都能到 b1，仍需消歧。
T.eq(san('3K1k2/8/8/8/8/8/8/R6R w - - 0 1', 'a1', 'b1'), 'Rab1', 'b1 两车皆可达，用直列消歧');
T.eq(san('3K1k2/8/8/8/8/8/8/R6R w - - 0 1', 'h1', 'g1'), 'Rhg1', 'g1 同理');

// 解析：SAN 往返
const sanCases = [
  [START, 'e4'], [START, 'Nf3'], [START, 'd4'],
  ['r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'O-O'],
  ['r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'O-O-O'],
  ['8/8/8/3r4/8/8/3R4/K6k w - - 0 1', 'Rxd5'],
  ['3K1k2/8/8/8/8/8/8/R6R w - - 0 1', 'Rad1'],
  ['8/8/8/3p4/4P3/8/8/K6k w - - 0 1', 'exd5'],
  ['7k/8/8/8/8/8/4p3/3P3K b - - 0 1', 'e1=Q+'],
];
for (const [fen, s] of sanCases) {
  const p = C.Position.fromFEN(fen);
  T.eq(C.moveToSAN(p, C.parseSAN(p, s)), s, 'SAN 往返一致：' + s);
}

// 宽容解析：带不带 +/# 都应该认
const relaxed = C.Position.fromFEN('4k3/8/8/8/8/8/8/4R2K w - - 0 1');
T.eq(C.moveToSAN(relaxed, C.parseSAN(relaxed, 'Re7')), 'Re7+', '省略 + 也能解析');

T.throws(() => C.parseSAN(C.Position.fromFEN(START), 'Qh5'), 'SAN 指向非法走法应抛错');
T.throws(() => C.parseSAN(C.Position.fromFEN(START), 'zz9'), 'SAN 语法错误应抛错');

// ---- UCI ----
const u0 = C.Position.fromFEN(START);
T.eq(C.moveToUCI(C.parseSAN(u0, 'e4')), 'e2e4', 'SAN e4 的 UCI 是 e2e4');
T.eq(C.moveToUCI(C.parseSAN(u0, 'Nf3')), 'g1f3', 'SAN Nf3 的 UCI 是 g1f3');
T.eq(C.moveToSAN(u0, C.parseUCI(u0, 'e2e4')), 'e4', 'UCI e2e4 的 SAN 是 e4');

const uc = C.Position.fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
T.eq(C.moveToUCI(C.parseSAN(uc, 'O-O')), 'e1g1', '短易位的 UCI 记王的起讫格');
T.eq(C.moveToSAN(uc, C.parseUCI(uc, 'e1c1')), 'O-O-O', 'UCI e1c1 解析回长易位');

// 同 Task 9 处的缺陷：原始简报 FEN 没有黑王，在 h8 补上。
const up = C.Position.fromFEN('7k/8/8/8/8/8/4p3/3P3K b - - 0 1');
T.eq(C.moveToUCI(C.parseUCI(up, 'e2e1q')), 'e2e1q', '升变的 UCI 带小写棋子字母');
T.eq(C.moveToSAN(up, C.parseUCI(up, 'e2e1n')), 'e1=N', 'underpromotion 也能解析');

T.throws(() => C.parseUCI(u0, 'e2e5'), 'UCI 指向非法走法应抛错');
T.throws(() => C.parseUCI(u0, 'xx'), 'UCI 语法错误应抛错');

// ---- PGN ----
const FOOLS = [
  '[Event "Fool\'s Mate"]',
  '[Site "?"]',
  '[Date "????.??.??"]',
  '[White "?"]',
  '[Black "?"]',
  '[Result "0-1"]',
  '',
  '1. f3 e5 2. g4 Qh4# 0-1',
].join('\n');

const g1 = C.parsePGN(FOOLS);
T.eq(g1.headers.Event, "Fool's Mate", 'PGN 标签解析正确');
T.eq(g1.headers.Result, '0-1', 'Result 标签解析正确');
T.eq(g1.result, '0-1', '棋谱结果解析正确');
T.eq(g1.moves.length, 4, 'Fool\'s Mate 共 4 个半步');
T.eq(g1.positions.length, 5, 'positions 比 moves 多一个起始局面');
T.eq(g1.positions[0].toFEN(), START, 'positions[0] 是初始局面');
T.eq(g1.positions[4].status(), 'checkmate', '最后一个局面是将死');

// 走法逐步重放 —— 抄错一步就会在这里当场走不通
const replayed = g1.moves.map((m, i) => C.moveToSAN(g1.positions[i], m));
T.eq(replayed, ['f3', 'e5', 'g4', 'Qh4#'], '逐步重放得到原样的 SAN 序列');

// 归一化往返
const written = C.writePGN(g1.headers, g1.moves);
T.eq(C.parsePGN(written).moves.length, 4, 'writePGN 的输出能被 parsePGN 读回');
T.ok(written.indexOf('1. f3 e5 2. g4 Qh4#') >= 0, 'writePGN 输出标准的回合编号格式');

// Scholar's Mate
const SCHOLARS = '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6?? 4. Qxf7# 1-0';
const g2 = C.parsePGN(SCHOLARS);
T.eq(g2.moves.length, 7, 'Scholar\'s Mate 共 7 个半步');
T.eq(g2.result, '1-0', '无标签时也能从结果标记读出胜负');
T.eq(g2.positions[7].status(), 'checkmate', 'Scholar\'s Mate 结尾是将死');

// 注释与变着被跳过而非报错
const WITH_NOISE = '1. e4 {好棋} e5 2. Nf3 (2. f4 exf4) Nc6 *';
const g3 = C.parsePGN(WITH_NOISE);
T.eq(g3.moves.length, 4, '注释与变着被跳过，主线 4 个半步');
T.ok(g3.skipped > 0, '跳过的内容被计数，不静默');

// 从非初始局面开始
const FROM_FEN = '[FEN "4k3/8/8/8/8/8/8/4K2R w K - 0 1"]\n[SetUp "1"]\n\n1. O-O *';
const g4 = C.parsePGN(FROM_FEN);
T.eq(g4.positions[0].toFEN(), '4k3/8/8/8/8/8/8/4K2R w K - 0 1', 'FEN 标签作为起始局面');
T.eq(C.moveToSAN(g4.positions[0], g4.moves[0]), 'O-O', '从自定义局面开始的走法解析正确');

// 抄错的棋谱必须报错，且指明第几步
T.throws(() => C.parsePGN('1. e4 e5 2. Qh5 Qh4 3. Nf7 *'),
         '非法走法应抛错（Nf7 在该局面下走不通）');

T.report();
