/* 国际象棋内核 —— 0x88 表示、走法生成、FEN/SAN/UCI/PGN。
   零依赖；node 与浏览器双用。编辑源，运行时被内联进 tools/*.html。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ChessCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const WHITE = 1, BLACK = -1;
  const EMPTY = 0, P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;

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
  const CODE_TO_FEN = { 1: 'p', 2: 'n', 3: 'b', 4: 'r', 5: 'q', 6: 'k' };

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

  Position.fromFEN = function (fen) {
    const parts = String(fen).trim().split(/\s+/);
    if (parts.length < 4) throw new Error('Bad FEN: expected at least 4 fields, got ' + parts.length);
    const rows = parts[0].split('/');
    if (rows.length !== 8) throw new Error('Bad FEN: expected 8 ranks, got ' + rows.length);

    const p = new Position();
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
        if (code === K) { if (signed > 0) p.kingW = s; else p.kingB = s; }
        f++;
      }
      if (f !== 8) throw new Error('Bad FEN: rank ' + (r + 1) + ' has ' + f + ' squares, expected 8');
    }

    p.turn = parts[1] === 'b' ? BLACK : WHITE;
    if (parts[2] !== '-') {
      if (parts[2].indexOf('K') >= 0) p.castling |= 1;
      if (parts[2].indexOf('Q') >= 0) p.castling |= 2;
      if (parts[2].indexOf('k') >= 0) p.castling |= 4;
      if (parts[2].indexOf('q') >= 0) p.castling |= 8;
    }
    p.ep = parts[3] === '-' ? -1 : fromAlg(parts[3]);
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
  const OFF_K = [17, 16, 15, 1, -17, -16, -15, -1];
  const SLIDE = { 3: OFF_B, 4: OFF_R, 5: OFF_K };   // B / R / Q 共用射线表
  const PROMO_PIECES = [Q, R, B, N];

  function mk(from, to, piece, captured, promo, flags) {
    return { from: from, to: to, piece: piece,
             captured: captured || 0, promo: promo || 0, flags: flags || 0 };
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
              // 兵只在"从目标格看出去的斜前方"才构成攻击：
              // 白兵攻击的是它上方两格，所以从目标格看应在 +17 / +15 方向。
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

  Position.prototype.attackedBy = function (target, by) {
    const out = [], saved = this.turn;
    this.turn = by;
    const ms = this.pseudoLegalMoves();
    this.turn = saved;
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i];
      if (m.to !== target) continue;
      if (!isAttackingMove(m)) continue;
      if (out.indexOf(m.from) < 0) out.push(m.from);
    }
    return out;
  };

  // 走法 ≠ 攻击：兵的正前方推进不吃子，易位也不是"攻击落点"。
  // Task 6 加入易位后这条过滤才真正生效，但先写在这里免得日后忘。
  function isAttackingMove(m) {
    if (m.flags & (FLAG.CASTLE_K | FLAG.CASTLE_Q)) return false;
    if (Math.abs(m.piece) === P && fileOf(m.from) === fileOf(m.to)) return false;
    return true;
  }

  Position.prototype.attacksFrom = function (from) {
    const v = this.board[from];
    if (v === EMPTY) return [];
    const out = [], saved = this.turn;
    this.turn = v > 0 ? WHITE : BLACK;
    const ms = this.pseudoLegalMoves();
    this.turn = saved;
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i];
      if (m.from !== from) continue;
      if (!isAttackingMove(m)) continue;
      if (out.indexOf(m.to) < 0) out.push(m.to);
    }
    return out;
  };

  return { WHITE, BLACK, EMPTY, P, N, B, R, Q, K,
           SQ, fileOf, rankOf, offBoard, toAlg, fromAlg, Position, FLAG };
});
