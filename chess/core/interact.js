/* 交互内核：选择、高亮层、走法栈、非法走法的理由。
   纯逻辑、零 DOM —— 工具负责画，本模块负责「现在该高亮哪些格」。
   零依赖；node 与浏览器双用。编辑源，运行时被内联进 tools/*.html。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./chess-core.js'));
  else root.Interact = factory(root.ChessCore);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  function create(opts) {
    return {
      pos: opts.position,
      stack: [opts.position],   // 局面栈，stack[i] 是走完第 i 步之后的局面
      idx: 0,
      sel: -1,
      selMoves: [],             // 选中格的合法走法
      selPseudo: [],            // 选中格的伪合法走法
      lastMove: null,
    };
  }

  function clear(st) { st.sel = -1; st.selMoves = []; st.selPseudo = []; }

  function select(st, sq) {
    const v = st.pos.board[sq];
    // 空格、或对方的子：一律清空。教学工具里「点错了」应当无声复位，
    // 而不是给一个需要再点一次才能消掉的半选中状态。
    if (v === C.EMPTY || (v > 0 ? C.WHITE : C.BLACK) !== st.pos.turn) { clear(st); return false; }
    st.sel = sq;
    st.selMoves = st.pos.legalMoves().filter(function (m) { return m.from === sq; });
    st.selPseudo = st.pos.pseudoLegalMoves().filter(function (m) { return m.from === sq; });
    return true;
  }

  function highlights(st) {
    const targets = st.selMoves.map(function (m) { return m.to; });
    const pseudoOnly = [];
    for (let i = 0; i < st.selPseudo.length; i++) {
      const to = st.selPseudo[i].to;
      if (targets.indexOf(to) < 0 && pseudoOnly.indexOf(to) < 0) pseudoOnly.push(to);
    }
    const me = st.pos.turn;
    const k = st.pos.kingSq(me);
    return {
      selected: st.sel,
      targets: dedupe(targets),
      pseudoOnly: pseudoOnly,
      lastMove: st.lastMove ? [st.lastMove.from, st.lastMove.to] : [],
      check: (k >= 0 && st.pos.inCheck(me)) ? k : -1,
    };
  }

  function dedupe(a) {
    const out = [];
    for (let i = 0; i < a.length; i++) if (out.indexOf(a[i]) < 0) out.push(a[i]);
    return out;
  }

  const PROMO_CHOICES = [C.Q, C.R, C.B, C.N];

  function tryMove(st, from, to, promo) {
    const legal = st.pos.legalMoves().filter(function (m) {
      return m.from === from && m.to === to;
    });
    if (!legal.length) return { ok: false, reason: null };

    // 同一 from/to 有多条走法，只可能是升变（四选一）。
    // 没指定就不猜——猜成后是最常见的默认，但那样 underpromotion 永远走不出来。
    if (legal.length > 1 || (legal[0].flags & C.FLAG.PROMO)) {
      if (!promo) {
        return { ok: false, needsPromotion: true, choices: PROMO_CHOICES.slice(), reason: null };
      }
    }
    const m = promo
      ? legal.filter(function (x) { return x.promo === promo; })[0]
      : legal[0];
    if (!m) return { ok: false, reason: null };

    const san = C.moveToSAN(st.pos, m);
    st.stack.length = st.idx + 1;      // 截断旧分支
    st.pos = st.pos.make(m);
    st.stack.push(st.pos);
    st.idx = st.stack.length - 1;
    st.lastMove = m;
    clear(st);
    return { ok: true, move: m, san: san };
  }

  function canUndo(st) { return st.idx > 0; }
  function canRedo(st) { return st.idx < st.stack.length - 1; }

  function undo(st) {
    if (!canUndo(st)) return false;
    st.idx--; st.pos = st.stack[st.idx]; st.lastMove = null; clear(st);
    return true;
  }

  function redo(st) {
    if (!canRedo(st)) return false;
    st.idx++; st.pos = st.stack[st.idx]; st.lastMove = null; clear(st);
    return true;
  }

  return {
    create: create, select: select, clear: clear, highlights: highlights,
    tryMove: tryMove, undo: undo, redo: redo, canUndo: canUndo, canRedo: canRedo,
    PROMO_CHOICES: PROMO_CHOICES,
  };
});
