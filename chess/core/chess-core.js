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

  return { WHITE, BLACK, EMPTY, P, N, B, R, Q, K,
           SQ, fileOf, rankOf, offBoard, toAlg, fromAlg, Position };
});
