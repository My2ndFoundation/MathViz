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
      moves: [null],            // moves[i] 是产生 stack[i] 的那一步；moves[0] 恒为 null
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
    if (!m) {
      // 走法本身（忽略 promo）是合法的——explain() 只看 from/to，会在这里
      // 判它「合法」而沉默地返回 null。真正的问题是 promo 给的不是四个
      // 待选项之一，必须给一个诚实的理由，而不是让调用方拿到一个 null。
      return {
        ok: false,
        reason: msg('bad-promotion',
          'That is not a valid promotion choice — choose queen, rook, bishop or knight.',
          '那不是有效的升变选择 —— 请选后、车、象或马。'),
      };
    }

    const san = C.moveToSAN(st.pos, m);
    st.stack.length = st.idx + 1;      // 截断旧分支
    st.moves.length = st.idx + 1;      // moves 与 stack 同步截断，旧分支不能靠 redo 复活
    st.pos = st.pos.make(m);
    st.stack.push(st.pos);
    st.moves.push(m);
    st.idx = st.stack.length - 1;
    st.lastMove = m;
    clear(st);
    return { ok: true, move: m, san: san };
  }

  function canUndo(st) { return st.idx > 0; }
  function canRedo(st) { return st.idx < st.stack.length - 1; }

  function undo(st) {
    if (!canUndo(st)) return false;
    // lastMove 不清空——回退到的这个局面本身就是由 moves[idx] 走出来的，
    // 这正是「你现在停在哪一步」的定向线索，撤销不该把它抹掉。
    st.idx--; st.pos = st.stack[st.idx]; st.lastMove = st.moves[st.idx]; clear(st);
    return true;
  }

  function redo(st) {
    if (!canRedo(st)) return false;
    // 同理：redo 刚刚重放的正是 moves[idx] 这一步，信息已经在手，不该丢掉。
    st.idx++; st.pos = st.stack[st.idx]; st.lastMove = st.moves[st.idx]; clear(st);
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
      // 兵必须单独判断：attacksFrom 是「攻击域」，故意不含兵的直进（兵不吃
      // 正前方），也永远含它的两个斜前方（不论是否真能吃子）。用它给兵的
      // shape/blocked 分类会两头都判错——直进被挡说成「形状不对」，斜走到
      // 空格却说成「被挡住」。兵的可达性单独按方向/步数/是否吃子判断。
      if (Math.abs(v) === C.P) return explainPawn(pos, from, to, v, mine);

      // 其余棋子：走法形状对不对，与路上有没有挡子，是两件事——
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
    // 每个攻击者各自带一个 "the"——join(' and ') 只会把外层套一次 "the"
    // 用到第一个名词短语头上，多攻击者（双将）时第二个就没了冠词。
    const desc = attackers.map(function (sq) {
      return 'the ' + PIECE_EN[Math.abs(after.board[sq])] + ' on ' + C.toAlg(sq);
    }).join(' and ');
    const descZh = attackers.map(function (sq) {
      return C.toAlg(sq) + ' 的' + PIECE_ZH[Math.abs(after.board[sq])];
    }).join('、');

    if (pos.inCheck(mine)) {
      return msg('still-in-check', 'You are in check; after ' + C.toAlg(from) + C.toAlg(to) +
                 ' your king is still attacked by ' + desc + '.',
                 '你正被将军；走 ' + C.toAlg(from) + C.toAlg(to) + ' 之后，王仍被' + descZh + '攻击。');
    }
    return msg('exposes-king', 'Illegal: after ' + C.toAlg(from) + C.toAlg(to) +
               ' your king would be attacked by ' + desc + '.',
               '不合法：走 ' + C.toAlg(from) + C.toAlg(to) + ' 之后，你的王会被' + descZh + '攻击。');
  }

  // 兵在「伪合法为假」时的具体理由：走法形状（直进/斜走）先判，
  // 是否被挡、是否缺目标，取决于走的是哪一种形状。
  function explainPawn(pos, from, to, v, mine) {
    const fwd = mine === C.WHITE ? 1 : -1;         // 前进方向：白 +1 横行，黑 −1 横行
    const startRank = mine === C.WHITE ? 1 : 6;
    const df = C.fileOf(to) - C.fileOf(from);
    const dr = C.rankOf(to) - C.rankOf(from);

    if (df === 0 && dr === fwd) {
      // 单步直进，形状对——伪合法为假只可能是因为挡住了（pushPawn 生成
      // 单步直进的唯一前提就是目标格为空）。
      return msg('blocked', 'The pawn on ' + C.toAlg(from) + ' is blocked before it reaches ' + C.toAlg(to) + '.',
                            C.toAlg(from) + ' 的兵到 ' + C.toAlg(to) + ' 的路上有子挡着。');
    }
    if (df === 0 && dr === fwd * 2 && C.rankOf(from) === startRank) {
      // 双步直进，起始格也对——伪合法为假必是中间格或落点格有子挡着。
      return msg('blocked', 'The pawn on ' + C.toAlg(from) + ' is blocked before it reaches ' + C.toAlg(to) + '.',
                            C.toAlg(from) + ' 的兵到 ' + C.toAlg(to) + ' 的路上有子挡着。');
    }
    if (Math.abs(df) === 1 && dr === fwd) {
      // 斜走一格，形状对——伪合法为假意味着落点既非对方棋子也非吃过路兵
      // 的目标格，即「斜走到空格」。兵只有吃子才能斜走，这里没有子可吃。
      return msg('no-capture', 'A pawn only moves diagonally when it captures — ' + C.toAlg(to) + ' is empty.',
                               '兵只有吃子时才走斜线 —— ' + C.toAlg(to) + ' 上没有可吃的子。');
    }
    // 其余：距离/方向不对（倒退、一次走三格等）——形状本身就不成立。
    return msg('shape', 'A pawn cannot move from ' + C.toAlg(from) + ' to ' + C.toAlg(to) + '.',
                        '兵不能从 ' + C.toAlg(from) + ' 走到 ' + C.toAlg(to) + '。');
  }

  function msg(code, en, zh) { return { code: code, en: en, zh: zh }; }

  return {
    create: create, select: select, clear: clear, highlights: highlights,
    tryMove: tryMove, undo: undo, redo: redo, canUndo: canUndo, canRedo: canRedo,
    PROMO_CHOICES: PROMO_CHOICES, explain: explain,
  };
});
