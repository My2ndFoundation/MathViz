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

// 一次 NaN 的 dt 不该永久毒化 acc —— Math.max(0, NaN) 还是 NaN，
// 之后 acc 就再也追不上 interval，回放会静默地永远卡住，不报错也不停止。
const nanGuard = R.load({ pgn: OPERA });
nanGuard.speed = 2;
R.setPlaying(nanGuard, true);
R.tick(nanGuard, NaN);
T.eq(nanGuard.ply, 0, 'NaN dt 不推进，但也不该是别的坏结果');
R.tick(nanGuard, 0.6);
T.eq(nanGuard.ply, 1, 'NaN 之后正常 dt 照常推进 —— acc 没有被 NaN 污染');

// ---- maxPly === 0（单个局面，没有历史）：按下播放不该让按钮说谎 ----
// 可达路径：粘一个只有 FEN、没有着法的 PGN → maxPly 是 0 → 点 ▶ →
// 两个播放按钮都读 rs.playing 来决定显示「暂停」还是「播放」，如果
// tick() 只 return 而不把 playing 拉回 false，按钮就会一直显示
// 「⏸ Pause」，但画面（ply）永远不会动——UI 与真实状态相反。
const zeroPly = R.load({ pgn: '[FEN "4k3/8/8/8/8/8/8/4K3 w - - 0 1"]\n*' });
T.eq(zeroPly.maxPly, 0, '只有 FEN 没有着法的棋局 maxPly 是 0');
R.setPlaying(zeroPly, true);
T.eq(zeroPly.playing, true, 'setPlaying(true) 本身照常置位');
R.tick(zeroPly, 1);
T.eq(zeroPly.playing, false, 'maxPly=0 时 tick() 必须把 playing 拉回 false —— 没有历史可播放');
T.eq(zeroPly.ply, 0, 'ply 依旧是 0，没有任何东西可以推进');

// ---- keyMoves：自动暂停 + 说明 ----
const KM = [
  { ply: 10, note: { en: '5…dxe5 recaptures; material is level again.', zh: '5…dxe5 吃回来，子力重新持平。' } },
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

// 往回拖时间轴（不是 rewind）也要让身后已经触发过的关键步重新武装：
// 播放 → 在关键步暂停 → 拖回去重看 → 再播放 → 应该再次拦住。使用者往回拖
// 恰恰是因为没看懂想重看，一个只响一次的自动暂停等于告诉她"你已经看过了"。
const key3 = R.load({ pgn: OPERA, keyMoves: KM });
key3.speed = 100;
R.setPlaying(key3, true);
R.tick(key3, 1);
T.eq(key3.ply, 10, '第一次播放在关键步 10 停住');
R.goto(key3, 5);
T.eq(key3.ply, 5, '拖回到第 5 步（越过了已触发的 ply 10）');
R.setPlaying(key3, true);
R.tick(key3, 1);
T.eq(key3.ply, 10, '拖回去之后再播放，关键步 10 会再次拦住');

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

// ---- 评估：三个定值局面（下列数字全部是手推的，且已在本机对着 chess-core 复算一致）----
// 初始局面：完全对称，三项都必须是 0。
const e0 = R.evalAt(C.Position.fromFEN(C.START_FEN));
T.eq(e0.material, 0, '初始局面子力差为 0');
T.eq(e0.control, 0, '初始局面控制格差为 0');
T.eq(e0.safety, 0, '初始局面王的安全度差为 0');
// 22 = 8（兵的斜线攻击格，a3~h3；边翼兵各只有 1 条斜线且互相重叠，
//        去重后是 8 格，不是「16 格」——去重前的攻击实例数才是 14）
//    + 14（车/马/象/后/王能摸到的 1、2 线格，含彼此重叠去重之后的并集）
T.eq(e0.controlW, 22, '初始局面白方控制 22 格');
T.eq(e0.controlB, 22, '黑方同为 22 —— 对称');

// 白 Ke1 + Re7，黑 Ke8。手推：
//   子力：车 5，其余为 0 → +5
//   控制：白 = 车 e7 的 14 格 ∪ 王 e1 的 5 格，e2 重合一次 → 18；黑 = 王 e8 的 5 格 → 13
//   王安全：黑王 e8 的盘内邻格 d7 e7 f7 d8 f8 中，d7 与 f7 被 e7 的车攻击 → −2；
//           e7 是车自己站的格，车不攻击自己所在的格，白王也够不着，所以不算；
//           白王 e1 的邻格无一被黑方攻击 → 0。差 = 0 − (−2) = +2
const e1 = R.evalAt(C.Position.fromFEN('4k3/4R3/8/8/8/8/8/4K3 b - - 0 1'));
T.eq(e1.material, 5, '多一个车 = +5');
T.eq(e1.controlW, 18, '白方控制 18 格');
T.eq(e1.controlB, 5, '黑方控制 5 格');
T.eq(e1.control, 13, '控制格差 +13');
T.eq(e1.safetyW, 0, '白王邻格无一受攻');
T.eq(e1.safetyB, -2, '黑王有两个邻格受攻');
T.eq(e1.safety, 2, '王安全度差 +2');
T.ok(!Object.is(e1.safetyW, -0), '零要是正零，别让 −0 漏进读数');

// 空盘单车：控制 = 14，这是「盘上一个车能扫到多少格」的教科书数字
const bare = new C.Position();
bare.board[C.fromAlg('a1')] = C.R;
T.eq(R.evalAt(bare).controlW, 14, '空盘 a1 的车控制 14 格');

// ---- series：整局一次算完 ----
const srs = R.load({ pgn: OPERA });
const S = R.series(srs);
T.eq(S.material.length, 34, '每个半步一个点，加上起始局面');
T.eq(S.control.length, 34, '三条曲线等长');
T.eq(S.safety.length, 34, '三条曲线等长');
T.eq(S.material[0], 0, '开局子力差 0');
T.eq(S.control[0], 0, '开局控制差 0');
T.eq(S.safety[0], 0, '开局王安全差 0');
// 第 19 个半步是 10.Nxb5（白方吃掉 b5 的兵，暂时多一个兵）；
// 第 20 个半步是 10...cxb5（黑方吃回那只马）。两条一起断言，才看得见
// 「弃马」在这条曲线上是先上一格、再掉三格的一个两拍动作。
// 注意换算：白方第 N 回合的走法是第 2N−1 个半步 —— 10.Nxb5 是 ply 19，不是 ply 10。
T.eq(S.material[19], 1, '10.Nxb5 吃掉一个兵，白方暂时领先 1');
T.eq(S.material[20], -2, '10...cxb5 吃回马之后，白方净落后 2（马换兵）');
// 末局面：白方以少得多的子力将死 —— 断言符号而不是具体数字，
// 具体数字取决于双方各剩什么，改棋谱就会变，断言符号才是真意图
T.ok(S.material[33] < 0, '莫菲最后是在子力落后的情况下将死的');
// T.eq 是 JSON 比较：两个内容相同的不同对象也会通过，测不出缓存有没有真的生效。
// 缓存要测的是同一个对象引用，必须用 T.ok(... === ...)。
T.ok(R.series(srs) === S, 'series 缓存的是同一个对象（不是内容相等的新对象）');

// ---- 子力轨迹 ----
function tracesOf(pgn) { return R.traces(R.load({ pgn: pgn })); }
function findFrom(list, alg) { return list.filter(function (t) { return t.from === C.fromAlg(alg); })[0]; }

const t0 = tracesOf('1. e4 e5 1/2-1/2');
T.eq(t0.length, 32, '开局 32 颗子各一条轨迹');
const eP = findFrom(t0, 'e2');
T.eq(eP.points.map(function (p) { return [p.ply, C.toAlg(p.sq)]; }),
     [[0, 'e2'], [1, 'e4']], 'e2 的兵走了一步：起点在第 0 步，落点在第 1 步');
T.eq(eP.capturedAt, null, '它没被吃');
T.eq(findFrom(t0, 'b1').points.length, 1, 'b1 的马一步没动 —— 只有起点一个点');
const trs = R.load({ pgn: '1. e4 e5 1/2-1/2' });
const TR = R.traces(trs);
T.ok(R.traces(trs) === TR, 'traces 缓存的是同一个对象（不是内容相等的新数组）');

// 易位：一步动两颗子
// 易位 fixture 必须同时满足两个约束，缺一个整段就跑不通：
//   h8 的车要让开 h 线 —— 白方短易位之后 h1 空了，h 线全开，
//     否则第 3 个半步 Kh1 是走进将军；
//   a8 的车必须留在原地 —— 第 4 个半步的 O-O-O 要用它，
//     任何让 a8 车离家的走法都会当场毁掉黑方的长易位权。
// Rg8 同时满足两条（它顺带将了一军，白方 Kh1 正是应将）。
// 计划原稿写的是 Rd8：h8 的车被 e8 的王挡着到不了 d8，实际走的是
// a8 的车 —— 那个 fixture 先毁掉后面要测的东西，再去测它。
const cas = tracesOf('[FEN "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"]\n1. O-O Rg8 2. Kh1 O-O-O 1/2-1/2');
T.eq(findFrom(cas, 'e1').points.map(function (p) { return C.toAlg(p.sq); }), ['e1', 'g1', 'h1'],
     '白王短易位到 g1，再走 h1');
T.eq(findFrom(cas, 'h1').points.map(function (p) { return [p.ply, C.toAlg(p.sq)]; }),
     [[0, 'h1'], [1, 'f1']], '短易位同一步里 h1 的车到了 f1');
T.eq(findFrom(cas, 'e8').points.map(function (p) { return C.toAlg(p.sq); }), ['e8', 'c8'],
     '黑王长易位到 c8');
T.eq(findFrom(cas, 'a8').points.map(function (p) { return [p.ply, C.toAlg(p.sq)]; }),
     [[0, 'a8'], [4, 'd8']], '长易位同一步里 a8 的车到了 d8');

// 吃过路兵：被吃的兵不在落点格上
const ep = tracesOf('[FEN "rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3"]\n1. exf6 1-0');
const victim = findFrom(ep, 'f5');
T.eq(victim.capturedAt, 1, 'f5 的黑兵在第 1 个半步被吃');
T.eq(C.toAlg(victim.points[victim.points.length - 1].sq), 'f5',
     '它最后停在 f5 —— 吃它的兵落在 f6，别把尸体挪到落点格去');
T.eq(C.toAlg(findFrom(ep, 'e5').points[1].sq), 'f6', '吃过路兵的白兵落在 f6');

// 吃过路兵（黑方视角）：上面那组测的是白方吃，FLAG.EP 分支里
// m.piece > 0 ? -16 : 16 这条正负号只有黑方吃的时候才会走到另一半，
// 不补黑方就等于只测了一半的分支。白方兵 d2 走 d4（双步），
// 黑方兵 c4 提子 cxd3——被吃的白兵停在自己原来所在的 d4，不是 d3。
const epBlack = tracesOf('[FEN "4k3/8/8/8/2p5/8/3P4/4K3 w - - 0 1"]\n1. d4 cxd3 1/2-1/2');
const victimBlack = findFrom(epBlack, 'd2');
T.eq(victimBlack.capturedAt, 2, 'd2 的白兵在第 2 个半步被黑方吃过路兵吃掉');
T.eq(C.toAlg(victimBlack.points[victimBlack.points.length - 1].sq), 'd4',
     '它最后停在 d4（双步兵落点，也是它自己站的格）——吃它的黑兵落在 d3，别把尸体挪过去');
T.eq(C.toAlg(findFrom(epBlack, 'c4').points[1].sq), 'd3', '吃过路兵的黑兵落在 d3');

// 升变：同一颗子换了身份，不是新长出一颗
const pr = tracesOf('[FEN "8/4P3/8/8/8/8/8/4K2k w - - 0 1"]\n1. e8=N 1-0');
const promoted = findFrom(pr, 'e7');
T.eq(promoted.code, C.N, '升变后这条轨迹的身份变成马');
T.eq(promoted.promotedAt, 1, '记下在第几步升的变');
T.eq(promoted.points.length, 2, '还是同一条轨迹，不是新建一条');
T.eq(pr.length, 3, '盘上原本 3 颗子，升变没有让轨迹数变多');

// 升变（黑方视角）：tr.code = m.piece > 0 ? m.promo : -m.promo 这一行的
// 负号分支只有黑方升变才会走到，不补黑方等于只测了三元表达式的一半。
// 黑兵 d2 走到 d1 升变为马——身份必须是负的马（-N），不是正的。
const prBlack = tracesOf('[FEN "4k3/8/8/8/8/8/3p4/7K b - - 0 1"]\n1... d1=N 1/2-1/2');
const promotedBlack = findFrom(prBlack, 'd2');
T.eq(promotedBlack.code, -C.N, '黑方升变后这条轨迹的身份是负的马（−N），不是正的');
T.eq(promotedBlack.promotedAt, 1, '记下在第几步升的变');
T.eq(promotedBlack.points.length, 2, '还是同一条轨迹，不是新建一条');
T.eq(prBlack.length, 3, '盘上原本 3 颗子，升变没有让轨迹数变多');

// 守恒：活着的 + 被吃的 = 开局子数。断言真实数值，不要断言
// 「alive + dead === 32」这种恒等式 —— dead 就是按 capturedAt != null 数出来的，
// alive 就是按 capturedAt == null 数出来的，两者相加对任何实现都恒等于 32，
// 这条式子本身测不出任何东西。
const opera = tracesOf(OPERA);
const dead = opera.filter(function (t) { return t.capturedAt != null; }).length;
const alive = opera.filter(function (t) { return t.capturedAt == null; }).length;
T.eq(opera.length, 32, '歌剧院局从满盘开始');
T.eq(dead, 12, '歌剧院局吃掉了 12 颗子');
T.eq(alive, 20, '终局还剩 20 颗子');

// ---- 累计热力 ----
const h2 = R.heat(R.load({ pgn: '1. e4 e5 1/2-1/2' }), 2);
T.eq(h2.counts[C.fromAlg('e4')], 1, 'e4 被落子一次');
T.eq(h2.counts[C.fromAlg('e5')], 1, 'e5 被落子一次');
T.eq(Object.keys(h2.counts).length, 2, '其余 62 格从头到尾没人碰');
T.eq(h2.max, 1, '最热的格是 1');
T.eq(h2.landings, 2, '两个半步 = 两次落子');

const hcas = R.heat(R.load({ pgn: '[FEN "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"]\n1. O-O 1-0' }), 1);
T.eq(hcas.counts[C.fromAlg('g1')], 1, '易位：王的落点算一次');
T.eq(hcas.counts[C.fromAlg('f1')], 1, '易位：车的落点也算一次');
T.eq(hcas.landings, 2, '一步易位是两次落子 —— 落子数不等于半步数');

const hpartial = R.load({ pgn: OPERA });
T.eq(R.heat(hpartial, 0).landings, 0, '第 0 步时热力全空');
T.ok(R.heat(hpartial, 33).landings >= 33, '整局的落子数至少等于半步数');
T.ok(R.heat(hpartial, 10).landings < R.heat(hpartial, 33).landings, '热力随时间轴增长');

T.report();
