/* 回放内核：一局棋沿「半步」这根离散时间轴的全部可观测量。
   纯逻辑、零 DOM —— 工具负责画，本模块负责「第 k 个半步的世界长什么样」。
   零依赖；node 与浏览器双用。编辑源，运行时被内联进 tools/*.html。

   本子项目的存档格式就是 PGN（规格 §1.3）：这里不发明任何私有序列化格式，
   载入是 parsePGN、导出是 writePGN，一局棋的真身始终是那串 SAN。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./chess-core.js'));
  else root.Replay = factory(root.ChessCore);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* 历史沿 z 展开的总跨度上限（世界单位）。棋盘边长是 8，14 让最长的棋局
     也只比棋盘长出不到一倍——再长，侧视角下一头一尾就同时读不清了。
     短棋局不必摊薄到这个跨度，因此 zStep 取「默认间距」与「摊满上限」中
     较小的那个。 */
  const Z_SPAN_MAX = 14;
  const Z_STEP_DEFAULT = 0.12;

  function zStep(maxPly) {
    if (!maxPly || maxPly <= 0) return 0;
    return Math.min(Z_STEP_DEFAULT, Z_SPAN_MAX / maxPly);
  }

  function load(opts) {
    const parsed = C.parsePGN(opts.pgn);
    const san = [];
    for (let i = 0; i < parsed.moves.length; i++) {
      san.push(C.moveToSAN(parsed.positions[i], parsed.moves[i]));
    }
    const keyMoves = (opts.keyMoves || []).slice().sort(function (a, b) { return a.ply - b.ply; });
    return {
      headers: parsed.headers,
      moves: parsed.moves,
      positions: parsed.positions,
      san: san,
      maxPly: parsed.moves.length,
      result: parsed.result,
      skipped: parsed.skipped,
      startFEN: parsed.startFEN,
      ply: 0,
      /* playing 默认 false：与引擎 state.running 同一条规矩——打开 = 静止，
         播放是使用者主动要的动作。阶段 1 两个工具因为默认 true 被用户报过
         「到达页面时演示已经在切换」。 */
      playing: false,
      speed: 1.5,          // 半步 / 秒
      acc: 0,              // 自动播放的时间累加器（秒）
      keyMoves: keyMoves,
      fired: {},           // ply -> 1，本轮已经因为它自动暂停过
      note: null,          // 当前半步的关键步说明（{en,zh}）或 null
      zStep: zStep(parsed.moves.length),
      series: null,        // Task 5 惰性填充
      traces: null,        // Task 6 惰性填充
    };
  }

  function position(rs) { return rs.positions[rs.ply]; }

  function keyAt(rs, ply) {
    for (let i = 0; i < rs.keyMoves.length; i++) if (rs.keyMoves[i].ply === ply) return rs.keyMoves[i];
    return null;
  }

  function goto(rs, ply) {
    const target = Math.max(0, Math.min(rs.maxPly, ply | 0));
    if (target === rs.ply) return false;
    rs.ply = target;
    /* 说明随「当前停在哪一步」走，与「是不是自动暂停过」无关：手动拖时间轴
       到关键步同样该看到说明，只是不需要再拦一次播放。 */
    const k = keyAt(rs, target);
    rs.note = k ? k.note : null;
    return true;
  }

  function step(rs, delta) { return goto(rs, rs.ply + (delta | 0)); }

  function setPlaying(rs, on) {
    rs.playing = !!on;
    if (rs.playing) rs.acc = 0;    // 从按下播放的那一刻起算，不继承上次的零头
  }

  function rewind(rs) {
    rs.ply = 0;
    rs.playing = false;
    rs.acc = 0;
    rs.fired = {};
    rs.note = null;
  }

  /* 自动播放：按 dt 累加，绝不按帧计数（开发机是 30Hz 外接显示器，按帧
     计数会让回放速度慢一半）。一次大 dt（后台标签页回来）要补齐多个半步，
     但遇到关键步就停在那一步、把剩下的时间丢掉——「走到关键步自动暂停」
     如果被同一次 tick 里后续的推进越过去，等于没有暂停。 */
  function tick(rs, dt) {
    if (!rs.playing || rs.maxPly === 0) return false;
    const interval = 1 / Math.max(0.01, rs.speed);
    rs.acc += Math.max(0, dt);
    let moved = false;
    let guard = 0;
    while (rs.acc >= interval && guard++ < 4096) {
      rs.acc -= interval;
      if (rs.ply >= rs.maxPly) { rs.playing = false; rs.acc = 0; break; }
      goto(rs, rs.ply + 1);
      moved = true;
      if (rs.ply >= rs.maxPly) { rs.playing = false; rs.acc = 0; break; }
      const k = keyAt(rs, rs.ply);
      if (k && !rs.fired[rs.ply]) {
        rs.fired[rs.ply] = 1;
        rs.playing = false;
        rs.acc = 0;
        break;
      }
    }
    return moved;
  }

  return {
    load: load, position: position, goto: goto, step: step,
    setPlaying: setPlaying, rewind: rewind, tick: tick,
    zStep: zStep, Z_SPAN_MAX: Z_SPAN_MAX, Z_STEP_DEFAULT: Z_STEP_DEFAULT,
  };
});
