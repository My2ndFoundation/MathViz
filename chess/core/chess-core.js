/* 国际象棋内核 —— 0x88 表示、走法生成、FEN/SAN/UCI/PGN。
   零依赖；node 与浏览器双用。编辑源，运行时被内联进 tools/*.html。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ChessCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const WHITE = 1, BLACK = -1;
  const EMPTY = 0, P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;

  // 标准初始局面的 FEN —— PGN 在没有 [FEN] 标签时以此为起点。
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  // 0x88：索引 = rank * 16 + file。盘内格的第 4、7 位必为 0，
  // 所以越界检测是一次按位与，不需要两次范围比较。
  function SQ(file, rank) { return rank * 16 + file; }
  function fileOf(s) { return s & 7; }
  function rankOf(s) { return s >> 4; }
  function offBoard(s) { return (s & 0x88) !== 0; }

  function toAlg(s) {
    return String.fromCharCode(97 + fileOf(s)) + (rankOf(s) + 1);
  }

  function fromAlg(a) {
    if (typeof a !== 'string' || a.length !== 2) throw new Error('Bad square: ' + a);
    const f = a.charCodeAt(0) - 97, r = a.charCodeAt(1) - 49;
    if (f < 0 || f > 7 || r < 0 || r > 7) throw new Error('Bad square: ' + a);
    return SQ(f, r);
  }

  const FEN_TO_CODE = { p: P, n: N, b: B, r: R, q: Q, k: K };
  const CODE_TO_FEN = { [P]: 'p', [N]: 'n', [B]: 'b', [R]: 'r', [Q]: 'q', [K]: 'k' };

  function Position() {
    this.board = new Int8Array(128);
    this.turn = WHITE;
    this.castling = 0;      // 1=K 2=Q 4=k 8=q
    this.ep = -1;
    this.half = 0;
    this.full = 1;
    this.kingW = -1;
    this.kingB = -1;
  }

  Position.prototype.kingSq = function (colour) {
    return colour === WHITE ? this.kingW : this.kingB;
  };

  Position.prototype.clone = function () {
    const p = new Position();
    p.board.set(this.board);
    p.turn = this.turn; p.castling = this.castling; p.ep = this.ep;
    p.half = this.half; p.full = this.full;
    p.kingW = this.kingW; p.kingB = this.kingB;
    return p;
  };

  Position.fromFEN = function (fen, opts) {
    const requireKings = !opts || opts.requireKings !== false;
    const parts = String(fen).trim().split(/\s+/);
    if (parts.length < 4) throw new Error('Bad FEN: expected at least 4 fields, got ' + parts.length);
    const rows = parts[0].split('/');
    if (rows.length !== 8) throw new Error('Bad FEN: expected 8 ranks, got ' + rows.length);

    const p = new Position();
    let wKings = 0, bKings = 0;
    for (let r = 0; r < 8; r++) {
      const row = rows[7 - r];          // FEN 从第 8 横行开始写
      let f = 0;
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch >= '1' && ch <= '8') { f += +ch; continue; }
        const lower = ch.toLowerCase();
        const code = FEN_TO_CODE[lower];
        if (!code) throw new Error('Bad FEN: unknown piece "' + ch + '"');
        if (f > 7) throw new Error('Bad FEN: rank ' + (r + 1) + ' overflows');
        const s = SQ(f, r);
        const signed = (ch === lower) ? -code : code;
        p.board[s] = signed;
        if (code === K) {
          if (signed > 0) { p.kingW = s; wKings++; } else { p.kingB = s; bKings++; }
        }
        f++;
      }
      if (f !== 8) throw new Error('Bad FEN: rank ' + (r + 1) + ' has ' + f + ' squares, expected 8');
    }
    // 没有王、或某一方不止一个王，都不是一个真实的国际象棋局面 ——
    // 放任它通过会让 legalMoves/inCheck 在下游悄悄地对着 −1 出错。
    // 但这条护栏只对"对局"场景成立：有些教学用途（例如孤马 BFS 到
    // 每格最短步数场）就是要表示没有王的局面，所以留一个显式的
    // opt-out —— { requireKings: false }，默认仍为 true。
    if (requireKings) {
      if (wKings !== 1) throw new Error('Bad FEN: white must have exactly one king, found ' + wKings);
      if (bKings !== 1) throw new Error('Bad FEN: black must have exactly one king, found ' + bKings);
    }

    if (parts[1] !== 'w' && parts[1] !== 'b') {
      throw new Error('Bad FEN: side to move must be "w" or "b", got "' + parts[1] + '"');
    }
    p.turn = parts[1] === 'b' ? BLACK : WHITE;
    if (parts[2] !== '-') {
      if (parts[2].indexOf('K') >= 0) p.castling |= 1;
      if (parts[2].indexOf('Q') >= 0) p.castling |= 2;
      if (parts[2].indexOf('k') >= 0) p.castling |= 4;
      if (parts[2].indexOf('q') >= 0) p.castling |= 8;
    }
    p.ep = parts[3] === '-' ? -1 : fromAlg(parts[3]);
    if (parts.length > 4 && !/^\d+$/.test(parts[4])) {
      throw new Error('Bad FEN: half-move clock must be a non-negative integer, got "' + parts[4] + '"');
    }
    if (parts.length > 5 && !/^\d+$/.test(parts[5])) {
      throw new Error('Bad FEN: full-move number must be a non-negative integer, got "' + parts[5] + '"');
    }
    p.half = parts.length > 4 ? parseInt(parts[4], 10) : 0;
    p.full = parts.length > 5 ? parseInt(parts[5], 10) : 1;
    return p;
  };

  Position.prototype.toFEN = function () {
    const rows = [];
    for (let r = 7; r >= 0; r--) {
      let row = '', gap = 0;
      for (let f = 0; f < 8; f++) {
        const v = this.board[SQ(f, r)];
        if (v === EMPTY) { gap++; continue; }
        if (gap) { row += gap; gap = 0; }
        const ch = CODE_TO_FEN[Math.abs(v)];
        row += v > 0 ? ch.toUpperCase() : ch;
      }
      if (gap) row += gap;
      rows.push(row);
    }
    let cast = '';
    if (this.castling & 1) cast += 'K';
    if (this.castling & 2) cast += 'Q';
    if (this.castling & 4) cast += 'k';
    if (this.castling & 8) cast += 'q';
    return rows.join('/') + ' ' + (this.turn === WHITE ? 'w' : 'b') +
           ' ' + (cast || '-') +
           ' ' + (this.ep < 0 ? '-' : toAlg(this.ep)) +
           ' ' + this.half + ' ' + this.full;
  };

  const FLAG = { CAPTURE: 1, EP: 2, CASTLE_K: 4, CASTLE_Q: 8, DOUBLE: 16, PROMO: 32 };

  // 0x88 下的方向偏移：+16 是往上一横行，+1 是往右一直列。
  const OFF_N = [33, 31, 18, 14, -33, -31, -18, -14];
  const OFF_B = [17, 15, -17, -15];
  const OFF_R = [16, 1, -16, -1];
  // 八个方向的并集：斜线（象）∪ 直线（车）= 后的射线表，也恰好是王走一步
  // 能到的八个方向——王与后共享这张表纯属几何巧合（王只走一步，后可以
  // 滑到底），二者语义并不相同，所以用 OFF_K 只作为"王用这张表"的别名，
  // 不要把它当成"王专属"的表来读。
  const OFF_ALL8 = [17, 16, 15, 1, -17, -16, -15, -1];
  const OFF_K = OFF_ALL8;
  const SLIDE = { [B]: OFF_B, [R]: OFF_R, [Q]: OFF_ALL8 };   // B / R / Q 共用射线表
  const PROMO_PIECES = [Q, R, B, N];

  function mk(from, to, piece, captured, promo, flags) {
    return { from: from, to: to, piece: piece,
             captured: captured || 0, promo: promo || 0, flags: flags || 0 };
  }

  // Move 是每次调用现造的新对象，没有稳定恒等性——工具代码（例如用
  // pseudoLegalMoves() 减 legalMoves() 求"被别住的子"）需要按值比较两步棋
  // 是否是同一步。在同一局面内，from/to/promo 三项已完全确定一步棋
  // （piece/captured/flags 都能从局面 + from/to/promo 推出，不需要参与比较）。
  function sameMove(a, b) {
    return a.from === b.from && a.to === b.to && a.promo === b.promo;
  }

  Position.prototype.pseudoLegalMoves = function () {
    const out = [];
    const me = this.turn, bd = this.board;

    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }        // 跳过越界半区
      const v = bd[s];
      if (v === EMPTY || (v > 0 ? WHITE : BLACK) !== me) continue;
      const type = Math.abs(v);

      if (type === P) { pawnMoves(this, s, me, out); continue; }

      if (type === N || type === K) {
        const offs = type === N ? OFF_N : OFF_K;
        for (let i = 0; i < offs.length; i++) {
          const to = s + offs[i];
          if (to & 0x88) continue;
          const tv = bd[to];
          if (tv !== EMPTY && (tv > 0 ? WHITE : BLACK) === me) continue;
          out.push(mk(s, to, v, tv, 0, tv === EMPTY ? 0 : FLAG.CAPTURE));
        }
        continue;
      }

      const offs = SLIDE[type];
      for (let i = 0; i < offs.length; i++) {
        let to = s + offs[i];
        while (!(to & 0x88)) {
          const tv = bd[to];
          if (tv === EMPTY) { out.push(mk(s, to, v, 0, 0, 0)); to += offs[i]; continue; }
          if ((tv > 0 ? WHITE : BLACK) !== me) out.push(mk(s, to, v, tv, 0, FLAG.CAPTURE));
          break;                                  // 无论敌我，射线到此为止
        }
      }
    }
    castleMoves(this, me, out);
    return out;
  };

  function castleMoves(pos, me, out) {
    const bd = pos.board;
    const home = me === WHITE ? SQ(4, 0) : SQ(4, 7);
    if (bd[home] !== (me === WHITE ? K : -K)) return;
    if (pos.isAttacked(home, -me)) return;          // 被将军时不能易位

    const kBit = me === WHITE ? 1 : 4;
    const qBit = me === WHITE ? 2 : 8;
    const rookK = home + 3, rookQ = home - 4;

    if ((pos.castling & kBit) && bd[rookK] === (me === WHITE ? R : -R) &&
        bd[home + 1] === EMPTY && bd[home + 2] === EMPTY &&
        !pos.isAttacked(home + 1, -me) && !pos.isAttacked(home + 2, -me)) {
      out.push(mk(home, home + 2, bd[home], 0, 0, FLAG.CASTLE_K));
    }
    // 长易位：b 列（home−3）必须为空，但王不经过它，所以不检查它是否被攻击
    if ((pos.castling & qBit) && bd[rookQ] === (me === WHITE ? R : -R) &&
        bd[home - 1] === EMPTY && bd[home - 2] === EMPTY && bd[home - 3] === EMPTY &&
        !pos.isAttacked(home - 1, -me) && !pos.isAttacked(home - 2, -me)) {
      out.push(mk(home, home - 2, bd[home], 0, 0, FLAG.CASTLE_Q));
    }
  }

  function pawnMoves(pos, s, me, out) {
    const bd = pos.board;
    const dir = me === WHITE ? 16 : -16;
    const startRank = me === WHITE ? 1 : 6;
    const lastRank = me === WHITE ? 7 : 0;
    const piece = me === WHITE ? P : -P;

    const one = s + dir;
    if (!(one & 0x88) && bd[one] === EMPTY) {
      pushPawn(out, s, one, piece, 0, lastRank, 0);
      const two = s + dir * 2;
      if (rankOf(s) === startRank && !(two & 0x88) && bd[two] === EMPTY) {
        out.push(mk(s, two, piece, 0, 0, FLAG.DOUBLE));
      }
    }
    const caps = [dir + 1, dir - 1];
    for (let i = 0; i < 2; i++) {
      const to = s + caps[i];
      if (to & 0x88) continue;
      const tv = bd[to];
      if (tv === EMPTY) {
        if (to === pos.ep && pos.ep >= 0) {
          // 被吃的兵不在落点格，而在落点格的"身后"一格
          const victim = to - dir;
          out.push(mk(s, to, piece, bd[victim], 0, FLAG.CAPTURE | FLAG.EP));
        }
        continue;
      }
      if ((tv > 0 ? WHITE : BLACK) === me) continue;
      pushPawn(out, s, to, piece, tv, lastRank, FLAG.CAPTURE);
    }
  }

  function pushPawn(out, from, to, piece, captured, lastRank, flags) {
    if (rankOf(to) !== lastRank) { out.push(mk(from, to, piece, captured, 0, flags)); return; }
    for (let i = 0; i < PROMO_PIECES.length; i++) {
      out.push(mk(from, to, piece, captured, PROMO_PIECES[i], flags | FLAG.PROMO));
    }
  }

  // 易位权掩码：某格一旦被"离开或被占据"，对应的权利就消失。
  // 例如 a1 既是白后翼车的家，也是黑车吃过来时会落到的格，两种情况都该清 Q。
  const CASTLE_MASK = new Int8Array(128).fill(15);
  CASTLE_MASK[SQ(4, 0)] = 12;   // e1：白王一动，K 与 Q 全没
  CASTLE_MASK[SQ(0, 0)] = 13;   // a1：清 Q
  CASTLE_MASK[SQ(7, 0)] = 14;   // h1：清 K
  CASTLE_MASK[SQ(4, 7)] = 3;    // e8：清 k 与 q
  CASTLE_MASK[SQ(0, 7)] = 7;    // a8：清 q
  CASTLE_MASK[SQ(7, 7)] = 11;   // h8：清 k

  Position.prototype._make = function (m) {
    const undo = { castling: this.castling, ep: this.ep, half: this.half,
                   kingW: this.kingW, kingB: this.kingB };
    const bd = this.board;

    if (m.flags & FLAG.EP) {
      bd[m.to - (this.turn === WHITE ? 16 : -16)] = EMPTY;   // 被吃的兵不在落点格
    } else if (m.flags & FLAG.CASTLE_K) {
      bd[m.to + 1] = EMPTY; bd[m.to - 1] = this.turn === WHITE ? R : -R;
    } else if (m.flags & FLAG.CASTLE_Q) {
      bd[m.to - 2] = EMPTY; bd[m.to + 1] = this.turn === WHITE ? R : -R;
    }

    bd[m.from] = EMPTY;
    bd[m.to] = m.promo ? (this.turn === WHITE ? m.promo : -m.promo) : m.piece;

    if (Math.abs(m.piece) === K) {
      if (this.turn === WHITE) this.kingW = m.to; else this.kingB = m.to;
    }

    this.castling &= CASTLE_MASK[m.from] & CASTLE_MASK[m.to];
    this.ep = (m.flags & FLAG.DOUBLE)
      ? m.from + (this.turn === WHITE ? 16 : -16)
      : -1;
    this.half = (Math.abs(m.piece) === P || m.captured) ? 0 : this.half + 1;
    if (this.turn === BLACK) this.full++;
    this.turn = -this.turn;
    return undo;
  };

  Position.prototype._unmake = function (m, undo) {
    const bd = this.board;
    this.turn = -this.turn;
    if (this.turn === BLACK) this.full--;
    bd[m.from] = m.piece;
    bd[m.to] = m.captured;
    if (m.flags & FLAG.EP) {
      bd[m.to] = EMPTY;                                       // 落点本来是空的
      bd[m.to - (this.turn === WHITE ? 16 : -16)] = m.captured;
    } else if (m.flags & FLAG.CASTLE_K) {
      bd[m.to - 1] = EMPTY; bd[m.to + 1] = this.turn === WHITE ? R : -R;
    } else if (m.flags & FLAG.CASTLE_Q) {
      bd[m.to + 1] = EMPTY; bd[m.to - 2] = this.turn === WHITE ? R : -R;
    }
    this.castling = undo.castling; this.ep = undo.ep; this.half = undo.half;
    this.kingW = undo.kingW; this.kingB = undo.kingB;
  };

  Position.prototype.make = function (m) {
    const p = this.clone();
    p._make(m);
    return p;
  };

  // 从被攻击格反向扫射线：与其枚举所有敌子的走法，不如站在目标格上
  // 沿八个方向看出去，遇到的第一颗子是不是"能这样打过来"的类型。
  Position.prototype.isAttacked = function (target, by) {
    const bd = this.board;

    for (let i = 0; i < OFF_N.length; i++) {
      const s = target + OFF_N[i];
      if (s & 0x88) continue;
      const v = bd[s];
      if (v !== EMPTY && (v > 0 ? WHITE : BLACK) === by && Math.abs(v) === N) return true;
    }

    for (let i = 0; i < OFF_K.length; i++) {
      const dir = OFF_K[i];
      const diagonal = (dir === 17 || dir === 15 || dir === -17 || dir === -15);
      let s = target + dir, dist = 1;
      while (!(s & 0x88)) {
        const v = bd[s];
        if (v !== EMPTY) {
          if ((v > 0 ? WHITE : BLACK) === by) {
            const t = Math.abs(v);
            if (t === Q) return true;
            if (t === (diagonal ? B : R)) return true;
            if (dist === 1) {
              if (t === K) return true;
              // 兵只在"从目标格反过来看"的对应斜方向才构成攻击：
              // 白兵攻击的是它前方（+16 方向）两侧的格，所以反过来从
              // 目标格看，白兵攻击者应在 −17 / −15 方向（黑兵则相反，
              // 在 +17 / +15 方向）。
              if (t === P && diagonal) {
                if (by === WHITE && (dir === -17 || dir === -15)) return true;
                if (by === BLACK && (dir === 17 || dir === 15)) return true;
              }
            }
          }
          break;                      // 无论敌我，这条射线到此为止
        }
        s += dir; dist++;
      }
    }
    return false;
  };

  Position.prototype.inCheck = function (colour) {
    const k = this.kingSq(colour);
    return k < 0 ? false : this.isAttacked(k, -colour);
  };

  // 攻击 ≠ 走法：这两个函数回答"棋盘几何上谁打到了谁"，与"谁能合法地走
  // 到哪"是两个不同的问题——被己方子占据的格仍然"被攻击"（这正是"保护"
  // 的定义），兵的正前方推进与易位落点则从不算攻击。早先版本借道
  // pseudoLegalMoves() 实现，那只回答"能走到哪"，会把己方占据的格与
  // 未被防守的兵前方漏掉，导致 attackedBy 与 isAttacked 在同一局面上矛盾。
  // 现在与 isAttacked 共用同一套反向射线/马步/兵步几何，只是不提前
  // return，而是把每个方向命中的攻击方棋子收集起来。
  Position.prototype.attackedBy = function (target, by) {
    const bd = this.board;
    const out = [];

    for (let i = 0; i < OFF_N.length; i++) {
      const s = target + OFF_N[i];
      if (s & 0x88) continue;
      const v = bd[s];
      if (v !== EMPTY && (v > 0 ? WHITE : BLACK) === by && Math.abs(v) === N) out.push(s);
    }

    for (let i = 0; i < OFF_K.length; i++) {
      const dir = OFF_K[i];
      const diagonal = (dir === 17 || dir === 15 || dir === -17 || dir === -15);
      let s = target + dir, dist = 1;
      while (!(s & 0x88)) {
        const v = bd[s];
        if (v !== EMPTY) {
          if ((v > 0 ? WHITE : BLACK) === by) {
            const t = Math.abs(v);
            let hit = false;
            if (t === Q) hit = true;
            else if (t === (diagonal ? B : R)) hit = true;
            else if (dist === 1) {
              if (t === K) hit = true;
              else if (t === P && diagonal) {
                if (by === WHITE && (dir === -17 || dir === -15)) hit = true;
                if (by === BLACK && (dir === 17 || dir === 15)) hit = true;
              }
            }
            if (hit) out.push(s);
          }
          break;                      // 无论敌我，这条射线到此为止
        }
        s += dir; dist++;
      }
    }
    return out;
  };

  // 该格棋子的攻击范围：从棋子出发沿几何看能打到哪些格，
  // 与 isAttacked/attackedBy 是同一套几何的正向版本。包含被己方子
  // 占据的格（防守也是攻击），不含兵的正前方推进与易位落点
  // （那些是走法，不是攻击）。
  Position.prototype.attacksFrom = function (from) {
    const v = this.board[from];
    if (v === EMPTY) return [];
    const bd = this.board;
    const type = Math.abs(v);
    const colour = v > 0 ? WHITE : BLACK;
    const out = [];

    if (type === P) {
      const dir = colour === WHITE ? 16 : -16;
      const caps = [dir + 1, dir - 1];
      for (let i = 0; i < 2; i++) {
        const to = from + caps[i];
        if (!(to & 0x88)) out.push(to);
      }
      return out;
    }

    if (type === N || type === K) {
      const offs = type === N ? OFF_N : OFF_K;
      for (let i = 0; i < offs.length; i++) {
        const to = from + offs[i];
        if (!(to & 0x88)) out.push(to);
      }
      return out;
    }

    const offs = SLIDE[type];
    for (let i = 0; i < offs.length; i++) {
      let to = from + offs[i];
      while (!(to & 0x88)) {
        out.push(to);
        if (bd[to] !== EMPTY) break;   // 遇子（不论敌我）即为攻击范围的边界
        to += offs[i];
      }
    }
    return out;
  };

  Position.prototype.legalMoves = function () {
    const me = this.turn, out = [];
    const ms = this.pseudoLegalMoves();
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i];
      const undo = this._make(m);
      // 与 inCheck 保持一致：找不到王（k < 0）视为"不构成将军"，
      // 而不是让 isAttacked(-1, …) 悄悄给出未定义的答案。
      // 这不是漏洞，是有意为之：没有王的局面（fromFEN(fen, {requireKings:false})
      // 构造出来的教学局面，例如孤马 BFS 场）根本没有"将军"这回事可暴露，
      // 所以 k < 0 时直接放行——legalMoves() 在此退化为 pseudoLegalMoves()，
      // 全部走法都算合法。调用方如果依赖"合法性过滤"这一行为，
      // 需要自己先确认局面里有王。
      const k = this.kingSq(me);
      if (k < 0 || !this.isAttacked(k, -me)) out.push(m);
      this._unmake(m, undo);
    }
    return out;
  };

  // 保守规则：只有"双方都不可能强制将死"才判子力不足。任何一方达到
  // 两个轻子（无论颜色组合）就已经存在理论杀法（KNN 对 K 也算，尽管
  // 实战极难逼出），所以立即返回 false。
  // 已知的不完整之处（有意为之，不是漏了）：同色格象分居两侧属于死局，
  // 但本函数把它算作"进行中"——要判定这种死局需要比较象所在格的颜色，
  // 这里没有做，读者不要以为这条规则是完整的。
  function insufficientMaterial(pos) {
    let minors = 0;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const t = Math.abs(pos.board[s]);
      if (t === EMPTY || t === K) continue;
      if (t === P || t === R || t === Q) return false;
      minors++;
      if (minors > 1) return false;      // 两个轻子起就可能杀（含异色象）
    }
    return true;
  }

  Position.prototype.status = function () {
    const has = this.legalMoves().length > 0;
    const chk = this.inCheck(this.turn);
    if (!has) return chk ? 'checkmate' : 'stalemate';
    // 这条排在 chk 判断之前是刻意的：即使 this.turn 一方正被将军，只要子力
    // 不足，也报告 'insufficient' 而不是 'check'——checkmate 已经在上面的
    // !has 分支被排除了，所以这里不会掩盖任何将死；FIDE 的死局规则本就
    // 不区分"死局时是否被将军"。想单独知道"当下是否被将军"这个盘面事实
    // 的调用方，应该直接调 inCheck()，不要依赖 status() 的优先级。
    if (insufficientMaterial(this)) return 'insufficient';   // 死局自动成立，优先于一切
    // 将军是当下必须回应的事实；五十步规则只是"可主张"而非自动生效，
    // 棋局仍在进行中，所以将军排在五十步之前——这个顺序不是随意的。
    if (chk) return 'check';
    if (this.half >= 100) return 'fifty';
    return 'ongoing';
  };

  function perft(pos, depth) {
    if (depth <= 0) return 1;
    const ms = pos.legalMoves();
    if (depth === 1) return ms.length;     // 叶子层不必真的走一遍
    let n = 0;
    for (let i = 0; i < ms.length; i++) {
      const undo = pos._make(ms[i]);
      n += perft(pos, depth - 1);
      pos._unmake(ms[i], undo);
    }
    return n;
  }

  // 分支计数：某个 depth 的总数对不上时，用它逐支比对，
  // 一层一层缩小范围直到定位到具体是哪个走法算错了。
  function perftDivide(pos, depth) {
    const out = {};
    const ms = pos.legalMoves();
    for (let i = 0; i < ms.length; i++) {
      const undo = pos._make(ms[i]);
      out[moveToUCI(ms[i])] = perft(pos, depth - 1);
      pos._unmake(ms[i], undo);
    }
    return out;
  }

  // 与文件里其它查表一样提到模块层：先前是函数内的字面量，每次调用
  // moveToUCI() 都要重新分配一次——perft 的热路径里 moveToUCI 调用量
  // 很大（例如 perftDivide），没必要每次都重建这张表。
  const PROMO_CH = { [N]: 'n', [B]: 'b', [R]: 'r', [Q]: 'q' };

  function moveToUCI(m) {
    return toAlg(m.from) + toAlg(m.to) + (m.promo ? PROMO_CH[m.promo] : '');
  }

  const SAN_CH = { 1: '', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K' };
  const SAN_TO_CODE = { N: N, B: B, R: R, Q: Q, K: K };

  function moveToSAN(pos, m) {
    if (!m) throw new Error('moveToSAN: move is required');
    let s;
    if (m.flags & FLAG.CASTLE_K) s = 'O-O';
    else if (m.flags & FLAG.CASTLE_Q) s = 'O-O-O';
    else {
      const type = Math.abs(m.piece);
      if (type === P) {
        s = (m.flags & FLAG.CAPTURE) ? toAlg(m.from)[0] + 'x' : '';
        s += toAlg(m.to);
        if (m.promo) s += '=' + SAN_CH[m.promo];
      } else {
        s = SAN_CH[type] + disambiguate(pos, m) +
            ((m.flags & FLAG.CAPTURE) ? 'x' : '') + toAlg(m.to);
      }
    }
    const after = pos.make(m);
    if (after.inCheck(after.turn)) s += after.legalMoves().length ? '+' : '#';
    return s;
  }

  // 消歧规则：先试直列，不够再试横行，还不够就写全格。
  function disambiguate(pos, m) {
    const type = Math.abs(m.piece);
    const rivals = pos.legalMoves().filter(x =>
      x.to === m.to && x.from !== m.from && Math.abs(x.piece) === type);
    if (!rivals.length) return '';
    const sameFile = rivals.some(x => fileOf(x.from) === fileOf(m.from));
    const sameRank = rivals.some(x => rankOf(x.from) === rankOf(m.from));
    if (!sameFile) return toAlg(m.from)[0];
    if (!sameRank) return toAlg(m.from)[1];
    return toAlg(m.from);
  }

  const SAN_RE = /^([NBRQK])?([a-h])?([1-8])?(x)?([a-h][1-8])(?:=?([NBRQ]))?[+#]?$/;

  function parseSAN(pos, text) {
    const s = String(text).trim().replace(/[!?]+$/, '');
    const legal = pos.legalMoves();

    if (s === 'O-O' || s === '0-0') {
      const m = legal.find(x => x.flags & FLAG.CASTLE_K);
      if (!m) throw new Error('Illegal SAN "' + text + '": kingside castling is not available');
      return m;
    }
    if (s === 'O-O-O' || s === '0-0-0') {
      const m = legal.find(x => x.flags & FLAG.CASTLE_Q);
      if (!m) throw new Error('Illegal SAN "' + text + '": queenside castling is not available');
      return m;
    }

    const g = SAN_RE.exec(s);
    if (!g) throw new Error('Bad SAN syntax: "' + text + '"');
    const type = g[1] ? SAN_TO_CODE[g[1]] : P;
    const hintF = g[2] ? g[2].charCodeAt(0) - 97 : -1;
    const hintR = g[3] ? g[3].charCodeAt(0) - 49 : -1;
    const to = fromAlg(g[5]);
    const promo = g[6] ? SAN_TO_CODE[g[6]] : 0;

    const hits = legal.filter(x =>
      Math.abs(x.piece) === type && x.to === to &&
      (promo ? x.promo === promo : !x.promo) &&
      (hintF < 0 || fileOf(x.from) === hintF) &&
      (hintR < 0 || rankOf(x.from) === hintR));

    if (hits.length === 1) return hits[0];
    if (!hits.length) throw new Error('Illegal SAN "' + text + '" in position ' + pos.toFEN());
    throw new Error('Ambiguous SAN "' + text + '": ' + hits.length + ' moves match');
  }

  const UCI_RE = /^([a-h][1-8])([a-h][1-8])([nbrq])?$/;
  const UCI_TO_CODE = { n: N, b: B, r: R, q: Q };

  function parseUCI(pos, text) {
    const g = UCI_RE.exec(String(text).trim());
    if (!g) throw new Error('Bad UCI syntax: "' + text + '" (expected e.g. e2e4 or e7e8q)');
    const from = fromAlg(g[1]), to = fromAlg(g[2]);
    const promo = g[3] ? UCI_TO_CODE[g[3]] : 0;
    const m = pos.legalMoves().find(x =>
      x.from === from && x.to === to && (promo ? x.promo === promo : !x.promo));
    if (!m) throw new Error('Illegal UCI move "' + text + '" in position ' + pos.toFEN());
    return m;
  }

  const TAG_RE = /\[\s*(\w+)\s*"((?:[^"\\]|\\.)*)"\s*\]/g;
  const RESULTS = ['1-0', '0-1', '1/2-1/2', '*'];

  function parsePGN(text) {
    const src = String(text);
    const headers = {};
    let m, tagEnd = 0;
    TAG_RE.lastIndex = 0;
    // 注意：exec 返回 null 时 lastIndex 会被重置为 0，所以必须在循环里
    // 自己记住最后一个标签的结束位置，不能循环结束后再读 lastIndex。
    while ((m = TAG_RE.exec(src))) {
      headers[m[1]] = m[2].replace(/\\(.)/g, '$1');
      tagEnd = TAG_RE.lastIndex;
    }
    const body = src.slice(tagEnd);      // 无标签时 tagEnd 为 0，即全文

    let skipped = 0;
    // 逐层剥掉 { } 注释与 ( ) 变着（可嵌套）
    let clean = '', depth = 0;
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (ch === '{' || ch === '(') { depth++; if (depth === 1) skipped++; continue; }
      if (ch === '}' || ch === ')') { if (depth > 0) depth--; continue; }
      if (depth === 0) clean += ch;
    }
    clean = clean.replace(/;[^\n]*/g, '')          // 行注释
                 .replace(/\$\d+/g, '')            // NAG
                 .replace(/\d+\s*\.(\.\.)?/g, ' ') // 回合编号
                 .replace(/\s+/g, ' ').trim();

    // PGN 标准规定 [SetUp "1"] 才"授权" [FEN] 标签生效，但这里刻意从宽：
    // 只要携带了 [FEN] 就采信，不论有没有 [SetUp]——后续阶段要加载来源各异
    // 的历史棋谱，不少真实存在的 PGN 只写 FEN 不写 SetUp，严格按标准拒绝
    // 这些合法数据只是在满足形式主义，对下游没有好处。
    const startFEN = headers.FEN || null;
    let pos = startFEN ? Position.fromFEN(startFEN) : Position.fromFEN(START_FEN);

    const moves = [], positions = [pos];
    let result = '*';
    const tokens = clean ? clean.split(' ') : [];
    for (let i = 0; i < tokens.length; i++) {
      const tk = tokens[i];
      if (!tk) continue;
      if (RESULTS.indexOf(tk) >= 0) { result = tk; break; }
      let mv;
      try {
        mv = parseSAN(pos, tk);
      } catch (e) {
        throw new Error('PGN move ' + (moves.length + 1) + ' ("' + tk + '") is illegal: ' + e.message);
      }
      moves.push(mv);
      pos = pos.make(mv);
      positions.push(pos);
    }
    if (headers.Result && RESULTS.indexOf(headers.Result) >= 0 && result === '*') {
      result = headers.Result;
    }
    return { headers: headers, moves: moves, positions: positions,
             result: result, skipped: skipped, startFEN: startFEN };
  }

  function writePGN(headers, moves, startFEN) {
    const out = [];
    const seven = ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result'];
    for (let i = 0; i < seven.length; i++) {
      const k = seven[i];
      const v = (headers && headers[k] != null) ? String(headers[k]) : '?';
      out.push('[' + k + ' "' + v.replace(/["\\]/g, '\\$&') + '"]');
    }
    for (const k in headers) {
      if (seven.indexOf(k) >= 0) continue;
      out.push('[' + k + ' "' + String(headers[k]).replace(/["\\]/g, '\\$&') + '"]');
    }
    out.push('');

    let pos = startFEN ? Position.fromFEN(startFEN) : Position.fromFEN(START_FEN);
    const toks = [];
    for (let i = 0; i < moves.length; i++) {
      if (pos.turn === WHITE) toks.push(pos.full + '.');
      // 只有白方走动才带回合号是不够的：如果棋谱本身从黑方先行的局面
      // 开始（[FEN]/[SetUp] 起点，或历史棋谱的中局切片），第一个黑方
      // 半步也必须标出回合号，写成 "N..." 形式，否则输出的 PGN 丢了
      // 回合号，不是合法 PGN。只有序列的第一个半步需要这样补——此后
      // 黑方的半步照常紧跟在同一回合的白方半步之后，不需要回合号。
      else if (i === 0) toks.push(pos.full + '...');
      toks.push(moveToSAN(pos, moves[i]));
      pos = pos.make(moves[i]);
    }
    const res = (headers && headers.Result) || '*';
    toks.push(res);

    // 按 80 列折行，这是 PGN 的通行写法
    let line = '';
    for (let i = 0; i < toks.length; i++) {
      if (line && line.length + 1 + toks[i].length > 80) { out.push(line); line = ''; }
      line = line ? line + ' ' + toks[i] : toks[i];
    }
    if (line) out.push(line);
    return out.join('\n') + '\n';
  }

  return { WHITE, BLACK, EMPTY, P, N, B, R, Q, K,
           SQ, fileOf, rankOf, offBoard, toAlg, fromAlg, Position, FLAG,
           perft, perftDivide, moveToUCI, moveToSAN, parseSAN, parseUCI,
           parsePGN, writePGN, START_FEN, sameMove };
});
