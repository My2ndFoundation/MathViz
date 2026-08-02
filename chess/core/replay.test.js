'use strict';
const T = require('./_test.js');
const C = require('./chess-core.js');
const R = require('./replay.js');

// 歌剧院局（Morphy, 1858）——33 个半步，1-0，末局面是将死。
// 这三个数已在本机用 chess-core 逐步重放核对过；改动本文件时不要重新猜。
const OPERA = '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 ' +
              '7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 ' +
              '13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0';

// ---- load ----
const rs = R.load({ pgn: OPERA });
T.eq(rs.maxPly, 33, '歌剧院局 33 个半步');
T.eq(rs.result, '1-0', '结果 1-0');
T.eq(rs.ply, 0, '载入停在第 0 步（起始局面）');
T.eq(rs.playing, false, '载入即暂停 —— 与引擎 state.running 默认 false 同一条规矩');
T.eq(rs.positions.length, 34, 'positions 比半步数多一个（起始局面）');
T.eq(rs.san.length, 33, 'SAN 表与半步一一对应');
T.eq(rs.san[0], 'e4', '第 1 个半步是 e4');
T.eq(rs.san[32], 'Rd8#', '最后一个半步是 Rd8#');
T.eq(R.position(rs).toFEN(), C.START_FEN, 'ply=0 就是初始局面');

// ---- goto / step ----
T.eq(R.goto(rs, 1), true, 'goto 到第 1 步，ply 变了');
T.eq(rs.ply, 1, 'ply 现在是 1');
T.eq(R.position(rs).board[C.fromAlg('e4')], C.P, '第 1 步之后 e4 上是白兵');
T.eq(R.goto(rs, 1), false, 'goto 到同一步返回 false');
T.eq(R.goto(rs, -5), true, '负数被夹到 0');
T.eq(rs.ply, 0, '夹到了 0');
T.eq(R.goto(rs, 999), true, '超出被夹到 maxPly');
T.eq(rs.ply, 33, '夹到了 33');
T.eq(R.step(rs, 1), false, '已在末尾，再前进无效');
T.eq(R.step(rs, -1), true, '后退一步有效');
T.eq(rs.ply, 32, '后退到 32');

// ---- 自动播放按 dt 推进，不按帧计数 ----
const auto = R.load({ pgn: OPERA });
auto.speed = 2;                      // 每秒 2 个半步
R.setPlaying(auto, true);
R.tick(auto, 0.2);
T.eq(auto.ply, 0, '0.2 秒不够走一个半步（需要 0.5 秒）');
R.tick(auto, 0.35);                  // 累计 0.55 秒
T.eq(auto.ply, 1, '累计超过 0.5 秒后推进一个半步');
// 一次大 dt 应当补上多个半步（后台标签页回来时），而不是只走一步
R.tick(auto, 1.6);                   // 余 0.05 + 1.6 = 1.65 秒 → 3 个半步
T.eq(auto.ply, 4, '大 dt 一次补齐多个半步');
R.setPlaying(auto, false);
R.tick(auto, 10);
T.eq(auto.ply, 4, '暂停后 tick 不推进');
// 走到末尾自动停
R.goto(auto, 32);
R.setPlaying(auto, true);
R.tick(auto, 10);
T.eq(auto.ply, 33, '推进到末尾就停住');
T.eq(auto.playing, false, '到末尾自动取消播放');

// ---- keyMoves：自动暂停 + 说明 ----
const KM = [
  { ply: 10, note: { en: 'Morphy gives up a knight to open the b-file.', zh: '莫菲弃马打开 b 线。' } },
  { ply: 33, note: { en: 'Mate with the last two pieces he has left.', zh: '用仅剩的两个子将死。' } },
];
const key = R.load({ pgn: OPERA, keyMoves: KM });
key.speed = 100;                     // 快到一次 tick 能跨过关键步
R.setPlaying(key, true);
R.tick(key, 1);
T.eq(key.ply, 10, '自动播放在关键步停住，不越过它');
T.eq(key.playing, false, '关键步自动暂停');
T.eq(key.note.en, KM[0].note.en, '关键步的说明被亮出来');
// 再播不该在同一步再停一次
R.setPlaying(key, true);
R.tick(key, 0.02);
T.ok(key.ply > 10, '同一个关键步不会二次拦住播放');
// 手动跳到关键步：给说明，但不需要「自动暂停」这件事发生
const key2 = R.load({ pgn: OPERA, keyMoves: KM });
R.goto(key2, 10);
T.eq(key2.note.en, KM[0].note.en, '手动跳到关键步同样显示说明');
R.goto(key2, 11);
T.eq(key2.note, null, '离开关键步说明消失');
// rewind 复位
R.rewind(key);
T.eq(key.ply, 0, 'rewind 回到第 0 步');
T.eq(key.playing, false, 'rewind 后是暂停态');
T.eq(key.note, null, 'rewind 清掉说明');
key.speed = 100;
R.setPlaying(key, true);
R.tick(key, 1);
T.eq(key.ply, 10, 'rewind 之后关键步重新生效');

// ---- zStep：任意长度的棋局都塞进同一段 z ----
T.eq(R.zStep(0), 0, '零步棋（纯 FEN）不需要 z 跨度');
T.ok(R.zStep(33) <= 0.12 + 1e-9, '短棋局用默认间距上限');
T.ok(R.zStep(272) * 272 <= R.Z_SPAN_MAX + 1e-9,
     '272 个半步（史上最长世界冠军赛对局的量级）仍然塞得进 Z_SPAN_MAX');
T.ok(R.zStep(272) < R.zStep(33), '越长的棋局间距越小');

// ---- 变着与注释：跳过并如实报数，不静默 ----
const withVar = R.load({ pgn: '1. e4 e5 (1... c5 2. Nf3) 2. Nf3 {a comment} Nc6 1/2-1/2' });
T.eq(withVar.maxPly, 4, '主线之外的变着不进走法表');
T.eq(withVar.skipped, 2, '跳过的段数如实记下（一段变着 + 一段注释）');

T.report();
