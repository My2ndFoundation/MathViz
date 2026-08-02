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
    if (!legal.length) return { ok: false, reason: explain(st.pos, from, to) };

    // 同一 from/to 有多条走法，只可能是升变（四选一）。
    // 没指定就不猜——猜成后是最常见的默认，但那样 underpromotion 永远走不出来。
    if (legal.length > 1 || (legal[0].flags & C.FLAG.PROMO)) {
      if (!promo) {
        // needsPromotion 不是错误，是「还需要你选一个」——不填 reason。
        return { ok: false, needsPromotion: true, choices: PROMO_CHOICES.slice(), reason: null };
      }
    }
    const m = promo
      ? legal.filter(function (x) { return x.promo === promo; })[0]
      : legal[0];
    if (!m) return { ok: false, reason: explain(st.pos, from, to) };

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

  const PIECE_EN = { 1: 'pawn', 2: 'knight', 3: 'bishop', 4: 'rook', 5: 'queen', 6: 'king' };
  const PIECE_ZH = { 1: '兵', 2: '马', 3: '象', 4: '车', 5: '后', 6: '王' };

  function explain(pos, from, to) {
    if (pos.legalMoves().some(function (m) { return m.from === from && m.to === to; })) return null;

    const v = pos.board[from];
    if (v === C.EMPTY) {
      return msg('empty', 'There is no piece on ' + C.toAlg(from) + '.',
                          C.toAlg(from) + ' 上没有棋子。');
    }
    const mine = v > 0 ? C.WHITE : C.BLACK;
    if (mine !== pos.turn) {
      const side = pos.turn === C.WHITE ? ['White', '白方'] : ['Black', '黑方'];
      return msg('not-your-piece', 'It is ' + side[0] + " to move; that piece is not yours.",
                                   '现在轮到' + side[1] + '走，那不是你的子。');
    }
    const tv = pos.board[to];
    if (tv !== C.EMPTY && (tv > 0 ? C.WHITE : C.BLACK) === mine) {
      return msg('own-piece', 'Your own ' + PIECE_EN[Math.abs(tv)] + ' already stands on ' + C.toAlg(to) + '.',
                              C.toAlg(to) + ' 上是你自己的' + PIECE_ZH[Math.abs(tv)] + '。');
    }

    const pseudo = pos.pseudoLegalMoves().some(function (m) { return m.from === from && m.to === to; });
    if (!pseudo) {
      // 走法形状对不对，与路上有没有挡子，是两件事：
      // 空盘上重算一次同一颗子的攻击域，够得着就说明是被挡住，够不着才是走法不对。
      const bare = new C.Position();
      bare.board[from] = v;
      const reach = bare.attacksFrom(from).indexOf(to) >= 0;
      const name = PIECE_EN[Math.abs(v)], nameZh = PIECE_ZH[Math.abs(v)];
      if (reach) {
        return msg('blocked', 'The ' + name + ' on ' + C.toAlg(from) + ' is blocked before it reaches ' + C.toAlg(to) + '.',
                              C.toAlg(from) + ' 的' + nameZh + '到 ' + C.toAlg(to) + ' 的路上有子挡着。');
      }
      return msg('shape', 'A ' + name + ' cannot move from ' + C.toAlg(from) + ' to ' + C.toAlg(to) + '.',
                          nameZh + '不能从 ' + C.toAlg(from) + ' 走到 ' + C.toAlg(to) + '。');
    }

    // 伪合法但不合法 —— 只可能是王被暴露。走一步看看谁在打王。
    // 必须用生成器产出的那个 Move 对象，不能手搓一个：吃过路兵的被吃兵不在落点格，
    // 手搓的对象缺 FLAG.EP，_make 就不会把它移走，于是攻击者名单会算错。
    const pm = pos.pseudoLegalMoves().filter(function (m) {
      return m.from === from && m.to === to;
    })[0];
    const after = pos.make(pm);
    const k = after.kingSq(mine);
    const attackers = k >= 0 ? after.attackedBy(k, -mine) : [];
    const desc = attackers.map(function (sq) {
      return PIECE_EN[Math.abs(after.board[sq])] + ' on ' + C.toAlg(sq);
    }).join(' and ');
    const descZh = attackers.map(function (sq) {
      return C.toAlg(sq) + ' 的' + PIECE_ZH[Math.abs(after.board[sq])];
    }).join('、');

    if (pos.inCheck(mine)) {
      return msg('still-in-check', 'You are in check; after ' + C.toAlg(from) + C.toAlg(to) +
                 ' your king is still attacked by the ' + desc + '.',
                 '你正被将军；走 ' + C.toAlg(from) + C.toAlg(to) + ' 之后，王仍被' + descZh + '攻击。');
    }
    return msg('exposes-king', 'Illegal: after ' + C.toAlg(from) + C.toAlg(to) +
               ' your king would be attacked by the ' + desc + '.',
               '不合法：走 ' + C.toAlg(from) + C.toAlg(to) + ' 之后，你的王会被' + descZh + '攻击。');
  }

  function msg(code, en, zh) { return { code: code, en: en, zh: zh }; }

  return {
    create: create, select: select, clear: clear, highlights: highlights,
    tryMove: tryMove, undo: undo, redo: redo, canUndo: canUndo, canRedo: canRedo,
    PROMO_CHOICES: PROMO_CHOICES, explain: explain,
  };
});
