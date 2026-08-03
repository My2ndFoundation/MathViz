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
    /* 往回拖时间轴要把「身后」（> target）已经触发过的关键步重新武装，
       否则「播放→在关键步暂停→拖回去重看→再播放」这条最典型的教学动线
       会在第二遍失效：使用者往回拖恰恰是因为没看懂想重看，一个只响一次
       的自动暂停等于告诉她「你已经看过了」。往前拖不清——身后已经触发
       过的不需要重新武装，否则会在还没走到的地方也保留旧状态。 */
    if (target < rs.ply) {
      for (const p in rs.fired) if (+p > target) delete rs.fired[p];
    }
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
    if (rs.maxPly === 0) { rs.playing = false; return false; }
    if (!rs.playing) return false;
    const interval = 1 / Math.max(0.01, rs.speed);
    /* Math.max(0, dt) 钳不住 NaN —— Math.max(0, NaN) 还是 NaN，一次 NaN 的 dt
       就会永久毒化 acc，此后 acc >= interval 恒为 false：回放不报错、不停止，
       就是静默地再也不前进。NaN / Infinity / undefined 一律当成 0 丢弃。 */
    const step = +dt;
    rs.acc += (step > 0 && isFinite(step)) ? step : 0;
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

  /* 子力价值：一套约定俗成的近似，不是定理。工具的说明区必须写明这一点。
     王取 0 —— 王不会被吃，给它任何有限值都只会让曲线在残局里失真。 */
  const PIECE_VALUE = { 1: 1, 2: 3, 3: 3, 4: 5, 5: 9, 6: 0 };

  /* 0x88 的 128 格里只有 64 格在盘内。这张表只算一次，之后所有遍历都走它——
     每次现算 offBoard 在 series() 里会被跑上百次 × 64 格。 */
  const SQUARES = (function () {
    const a = [];
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) a.push(C.SQ(f, r));
    return a;
  })();

  const KING_STEPS = [1, -1, 16, -16, 17, -17, 15, -15];

  function materialOf(pos) {
    let s = 0;
    for (let i = 0; i < SQUARES.length; i++) {
      const v = pos.board[SQUARES[i]];
      if (v === C.EMPTY) continue;
      s += (v > 0 ? 1 : -1) * PIECE_VALUE[Math.abs(v)];
    }
    return s;
  }

  /* 「控制」= 被该方任一子攻击到的不同格子数。attacksFrom 含被己方子占据的
     格（那是保护），且不含兵的前进（兵不攻击正前方）——所以这个数量的是
     火力覆盖，不是安全占据。工具的说明区必须写明这一点。 */
  function controlOf(pos, colour) {
    const seen = {};
    let n = 0;
    for (let i = 0; i < SQUARES.length; i++) {
      const sq = SQUARES[i];
      const v = pos.board[sq];
      if (v === C.EMPTY) continue;
      if ((v > 0 ? C.WHITE : C.BLACK) !== colour) continue;
      const hits = pos.attacksFrom(sq);
      for (let j = 0; j < hits.length; j++) {
        if (!seen[hits[j]]) { seen[hits[j]] = 1; n++; }
      }
    }
    return n;
  }

  /* 王的安全度（规格 §4③ 给定）：己方王周围「在盘内的」格中被对方攻击的
     格数，取负。王在边角时邻格不足 8 —— 只数盘内的，因此范围是 [−8, 0]。
     粗糙之处：只数邻格，不看攻击者是谁、路上有没有挡子、能不能真的杀过来。 */
  function safetyOf(pos, colour) {
    const k = pos.kingSq(colour);
    if (k < 0) return 0;
    let n = 0;
    for (let i = 0; i < KING_STEPS.length; i++) {
      const t = k + KING_STEPS[i];
      if (C.offBoard(t)) continue;
      if (pos.isAttacked(t, -colour)) n++;
    }
    return n === 0 ? 0 : -n;      // 别让 −0 漏进读数
  }

  function evalAt(pos) {
    const cw = controlOf(pos, C.WHITE), cb = controlOf(pos, C.BLACK);
    const sw = safetyOf(pos, C.WHITE), sb = safetyOf(pos, C.BLACK);
    return {
      material: materialOf(pos),
      control: cw - cb, controlW: cw, controlB: cb,
      safety: sw - sb, safetyW: sw, safetyB: sb,
    };
  }

  /* 整局一次算完并缓存在 rs 上：每帧重算 34～273 个局面的攻击域会吃掉整个
     4ms 绘制预算。载入一局是一次性成本（最长的棋局约 273 个局面 × 32 子）。 */
  function series(rs) {
    if (rs.series) return rs.series;
    const material = [], control = [], safety = [];
    for (let i = 0; i < rs.positions.length; i++) {
      const e = evalAt(rs.positions[i]);
      material.push(e.material); control.push(e.control); safety.push(e.safety);
    }
    rs.series = { material: material, control: control, safety: safety };
    return rs.series;
  }

  /* 子力轨迹：追踪的是「同一颗子」，不是「每一步的起讫」。三处特殊规则
     全部在这里收口，各配一条测试：
       易位   —— 一个半步里王和车各走一段；
       吃过路兵 —— 被吃的兵不在落点格上，它在落点格的正后方一格；
       升变   —— 同一条轨迹换身份（code 变），不是新长出一条。
     用 FLAG 判定而不是靠「起讫格相隔两列就是易位」这类几何猜测：Move 上
     本来就带着生成器给的权威标记，猜是没有理由的。 */
  function traces(rs) {
    if (rs.traces) return rs.traces;
    const start = rs.positions[0];
    const list = [];
    const at = {};                 // square -> list 下标

    for (let i = 0; i < SQUARES.length; i++) {
      const sq = SQUARES[i];
      const v = start.board[sq];
      if (v === C.EMPTY) continue;
      at[sq] = list.length;
      list.push({ id: list.length, code: v, from: sq,
                  points: [{ ply: 0, sq: sq }], capturedAt: null, promotedAt: null });
    }

    function walk(from, to, ply) {
      const k = at[from];
      if (k == null) return;       // 不该发生；发生了也不要静默造一条假轨迹
      delete at[from];
      at[to] = k;
      list[k].points.push({ ply: ply, sq: to });
    }
    function kill(sq, ply) {
      const k = at[sq];
      if (k == null) return;
      list[k].capturedAt = ply;
      delete at[sq];
    }

    for (let i = 0; i < rs.moves.length; i++) {
      const m = rs.moves[i], ply = i + 1;
      if (m.flags & C.FLAG.EP) {
        // 被吃的兵在落点格的「后方」一格：白方吃则在下一横行，黑方吃则在上一横行
        kill(m.to + (m.piece > 0 ? -16 : 16), ply);
      } else if (at[m.to] != null) {
        kill(m.to, ply);
      }
      walk(m.from, m.to, ply);
      // 易位的车：短易位 h 线车 → 王落点的左邻；长易位 a 线车 → 王落点的右邻
      if (m.flags & C.FLAG.CASTLE_K) walk(m.to + 1, m.to - 1, ply);
      if (m.flags & C.FLAG.CASTLE_Q) walk(m.to - 2, m.to + 1, ply);
      if (m.promo) {
        const tr = list[at[m.to]];
        tr.code = m.piece > 0 ? m.promo : -m.promo;
        tr.promotedAt = ply;
      }
    }
    rs.traces = list;
    return list;
  }

  /* 累计热力：数的是「有子落在这一格」的次数，不是控制、也不是经过。
     一步易位算两次落子（王一次、车一次），所以 landings 与半步数不相等——
     工具的读数区把两个数都列出来，别让人以为它们该相等。
     不缓存：整局最多 273 个半步，按当前 ply 现算一次是微秒级，而缓存
     「截至第 k 步」需要 273 份快照，得不偿失。 */
  function heat(rs, uptoPly) {
    const n = Math.max(0, Math.min(rs.maxPly, uptoPly == null ? rs.maxPly : uptoPly | 0));
    const counts = {};
    let max = 0, landings = 0;
    function land(sq) {
      counts[sq] = (counts[sq] || 0) + 1;
      if (counts[sq] > max) max = counts[sq];
      landings++;
    }
    for (let i = 0; i < n; i++) {
      const m = rs.moves[i];
      land(m.to);
      if (m.flags & C.FLAG.CASTLE_K) land(m.to - 1);
      if (m.flags & C.FLAG.CASTLE_Q) land(m.to + 1);
    }
    return { counts: counts, max: max, landings: landings };
  }

  return {
    load: load, position: position, goto: goto, step: step,
    setPlaying: setPlaying, rewind: rewind, tick: tick,
    zStep: zStep, Z_SPAN_MAX: Z_SPAN_MAX, Z_STEP_DEFAULT: Z_STEP_DEFAULT,
    evalAt: evalAt, series: series, PIECE_VALUE: PIECE_VALUE,
    traces: traces, heat: heat,
  };
});
