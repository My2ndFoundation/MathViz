/* 参数化棋盘与棋子渲染。棋盘躺在 z=0 平面、以原点为中心。
   算法工具与规则工具共用同一套 —— 八皇后摆的是真正的后。
   零依赖；node 与浏览器双用。编辑源，运行时被内联。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BoardRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function layout(spec) {
    const files = (spec && spec.files) || 8;
    const ranks = (spec && spec.ranks) || 8;
    const cell = (spec && spec.cell) || 1;
    const w = files * cell, h = ranks * cell;
    const x0 = -w / 2, y0 = -h / 2;

    return {
      files: files, ranks: ranks, cell: cell, w: w, h: h,
      squareCenter: function (f, r) {
        return [x0 + (f + 0.5) * cell, y0 + (r + 0.5) * cell, 0];
      },
      squareCorners: function (f, r) {
        const x = x0 + f * cell, y = y0 + r * cell;
        return [[x, y, 0], [x + cell, y, 0], [x + cell, y + cell, 0], [x, y + cell, 0]];
      },
    };
  }

  function fileLabel(i) { return String.fromCharCode(97 + i); }

  // a1 是深色格。第 0 列第 0 行 → (0+0)%2===0 → 深。
  function isLight(f, r) { return ((f + r) & 1) === 1; }

  const SQ_DARK = 'rgba(30,41,59,0.55)';
  const SQ_LIGHT = 'rgba(148,163,184,0.16)';
  const EDGE = 'rgba(159,176,200,0.55)';
  const COORD = 'rgba(159,176,200,0.75)';

  /* ctx: CanvasRenderingContext2D；C: 相机；E: VizEngine（注入而非全局引用，
     这样本模块在 node 里可加载、可测，不需要 DOM）。 */
  function drawBoard(ctx, C, E, spec) {
    const L = spec.layout || layout(spec);
    const mask = spec.mask || null;

    for (let r = 0; r < L.ranks; r++) {
      for (let f = 0; f < L.files; f++) {
        if (mask && mask(f, r) === false) continue;
        const cs = L.squareCorners(f, r);
        const pts = cs.map(function (p) { return E.proj(C, p); });
        if (pts.some(function (p) { return !p; })) continue;   // 近裁剪掉的格不画
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fillStyle = isLight(f, r) ? SQ_LIGHT : SQ_DARK;
        ctx.fill();
      }
    }

    // 外框
    const o = L.squareCorners(0, 0)[0];
    const frame = [o, [o[0] + L.w, o[1], 0], [o[0] + L.w, o[1] + L.h, 0], [o[0], o[1] + L.h, 0], o];
    E.strokePoly(C, frame, { color: EDGE, width: 1.4 });

    if (spec.coords !== false) {
      for (let f = 0; f < L.files; f++) {
        const c = L.squareCenter(f, 0);
        E.label3(C, [c[0], o[1] - 0.42 * L.cell, 0], fileLabel(f),
                 { color: COORD, size: 12, align: 'center' });
      }
      for (let r = 0; r < L.ranks; r++) {
        const c = L.squareCenter(0, r);
        E.label3(C, [o[0] - 0.42 * L.cell, c[1], 0], String(r + 1),
                 { color: COORD, size: 12, align: 'center' });
      }
    }
    return L;
  }

  return { layout: layout, fileLabel: fileLabel, isLight: isLight, drawBoard: drawBoard };
});
