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

  // a–h/1–8 坐标标签离棋盘外框的偏移，按格宽的比例算。
  const COORD_LABEL_OFFSET = 0.42;

  /* ctx: CanvasRenderingContext2D；C: 相机；E: VizEngine（注入而非全局引用，
     这样本模块在 node 里可加载、可测，不需要 DOM）。

     ctx 参数名副其实：格子填色本就全程用它。但外框与坐标标签走的是
     E.strokePoly / E.label3——这两个图元一直画在 VizEngine.init() 时钉死
     的模块私有画布上，从不理会调用方传进来的 ctx，于是 drawBoard(其他画布, …)
     的输出会被悄悄劈成两半（详见 viz-engine.js 的 withContext 注释）。
     这里用 E.withContext(ctx, fn) 把私有画布临时换成调用方给的这块，
     执行完自动换回去——阶段 1 规则工具要并排画「伪合法 / 合法」两块棋盘，
     就是靠这行才不会串到同一块画布上。 */
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

    const o = L.squareCorners(0, 0)[0];
    E.withContext(ctx, function () {
      // 外框
      const frame = [o, [o[0] + L.w, o[1], 0], [o[0] + L.w, o[1] + L.h, 0], [o[0], o[1] + L.h, 0], o];
      E.strokePoly(C, frame, { color: EDGE, width: 1.4 });

      if (spec.coords !== false) {
        for (let f = 0; f < L.files; f++) {
          const c = L.squareCenter(f, 0);
          E.label3(C, [c[0], o[1] - COORD_LABEL_OFFSET * L.cell, 0], fileLabel(f),
                   { color: COORD, size: 12, align: 'center' });
        }
        for (let r = 0; r < L.ranks; r++) {
          const c = L.squareCenter(0, r);
          E.label3(C, [o[0] - COORD_LABEL_OFFSET * L.cell, c[1], 0], String(r + 1),
                   { color: COORD, size: 12, align: 'center' });
        }
      }
    });
    return L;
  }

  /* 反向查询：屏幕坐标 → 棋盘格。是「点击选子」这枚阶段 1 头号交互
     （点棋子→高亮合法目标→点目标→落子）唯一需要的引擎入口。
     用 E.unproject 把射线与棋盘所在的 z=0 平面求交，再按 layout 的格距换算
     成 file/rank；落在相机之后、或点在棋盘外框之外都返回 null。 */
  function pickSquare(C, E, screenXY, L) {
    const p = E.unproject(C, screenXY, 0);
    if (!p) return null;
    const o = L.squareCorners(0, 0)[0];   // 棋盘左下角，和 drawBoard 的外框基准一致
    const f = Math.floor((p[0] - o[0]) / L.cell);
    const r = Math.floor((p[1] - o[1]) / L.cell);
    if (f < 0 || f >= L.files || r < 0 || r >= L.ranks) return null;
    return { file: f, rank: r };
  }

  /* 棋子写成 SVG 路径（0..100 方框，y 向下，底座压在 y≈98）。
     运行时用 Path2D 交给 Canvas 2D 绘制 —— 保留 SVG 的作者体验，
     又不引入任何外部文件或加载器。将来若上 3D，替换 drawPiece 即可，
     路径数据可作为旋转体的侧影复用（马除外）。

     六子结构互异，避免小尺寸下认错：
     - 兵 P：整圆头（半径 11 的正圆）+ 单层衣领，轮廓最简单。
     - 象 B：尖顶泪滴形主教冠（非正圆，顶端收成一点）+ 冠上十字形裂口，
       与兵的正圆头一望可辨。
     - 后 Q：冠部是 5 齿锯齿状皇冠，齿尖各顶一颗小圆珠。
     - 王 K：冠部是单拱形冠带（无锯齿），冠上另立一个十字架，
       与后的锯齿皇冠在剪影上明显不同。 */
  const PIECE_PATHS = {
    P: [
      'M39 24 A11 11 0 1 0 61 24 A11 11 0 1 0 39 24 z',
      'M40 37 H60 L63 45 H37 z',
      'M44 47 H56 L63 78 H37 z',
      'M28 78 H72 V88 H28 z',
      'M24 88 H76 V98 H24 z',
    ],
    N: [
      'M32 88 C30 61 41 47 53 39 C50 33 46 31 42 31 L49 20 C56 21 62 26 66 32 ' +
      'C73 44 74 63 72 88 z',
      'M44 26 A3 3 0 1 0 50 26 A3 3 0 1 0 44 26 z',
      'M24 88 H76 V98 H24 z',
    ],
    B: [
      'M50 10 C59 17 65 27 65 37 C65 46 58 52 50 52 C42 52 35 46 35 37 ' +
      'C35 27 41 17 50 10 z',
      'M46 22 H54 V28 H60 V36 H54 V42 H46 V36 H40 V28 H46 z',
      'M40 54 H60 L65 78 H35 z',
      'M28 78 H72 V88 H28 z',
      'M24 88 H76 V98 H24 z',
    ],
    R: [
      'M28 14 H37 V21 H45 V14 H55 V21 H63 V14 H72 V34 H66 V66 H74 V78 H26 V66 H34 V34 H28 z',
      'M24 88 H76 V98 H24 z',
    ],
    Q: [
      'M24 32 L31 66 H69 L76 32 L64 48 L56 24 L49 48 L42 24 L34 48 z',
      'M22 28 A4 4 0 1 0 30 28 A4 4 0 1 0 22 28 z',
      'M70 28 A4 4 0 1 0 78 28 A4 4 0 1 0 70 28 z',
      'M46 18 A4 4 0 1 0 54 18 A4 4 0 1 0 46 18 z',
      'M31 66 H69 L73 78 H27 z',
      'M24 88 H76 V98 H24 z',
    ],
    K: [
      'M46 6 H54 V15 H63 V23 H54 V34 H46 V23 H37 V15 H46 z',
      'M30 36 C37 28 63 28 70 36 L65 66 H35 z',
      'M31 66 H69 L73 78 H27 z',
      'M24 88 H76 V98 H24 z',
    ],
  };

  const CODE_KEY = { 1: 'P', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K' };

  const WHITE_FILL = 'rgba(226,232,240,0.94)';
  const WHITE_EDGE = 'rgba(15,23,42,0.85)';
  const BLACK_FILL = 'rgba(15,23,42,0.90)';
  const BLACK_EDGE = 'rgba(148,163,184,0.90)';

  /* 棋子路径的设计框契约：PIECE_PATHS 的坐标都画在一个 0..100 的方框里
     （PIECE_BOX），底座中点钉在 (50, 88)（PIECE_ANCHOR）——drawPiece 用它们
     把设计框换算成屏幕像素、再把底座对准格心。这两个数不是随手写的裁剪值，
     导出它们是因为将来「按深度算一个合适的 scale」这类计算离不开设计框
     本身的尺寸与锚点，不该让调用方去反猜 /100 和 (50,88) 是什么。 */
  const PIECE_BOX = 100;
  const PIECE_ANCHOR = [50, 88];

  const pathCache = Object.create(null);
  function path2d(d) {
    if (!pathCache[d]) pathCache[d] = new Path2D(d);
    return pathCache[d];
  }

  /* 棋子画成朝向相机的剪影：把它的世界坐标投影成屏幕点，
     然后在屏幕空间里以该点为基准绘制。这样任意相机角度下都读得清。 */
  function drawPiece(ctx, C, E, o) {
    const s = E.proj(C, o.center);
    if (!s) return;
    const key = CODE_KEY[Math.abs(o.code)];
    if (!key) return;
    const white = o.code > 0;
    const k = (o.scale || 1) / PIECE_BOX;

    ctx.save();
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.translate(s[0], s[1]);
    ctx.scale(k, k);
    ctx.translate(-PIECE_ANCHOR[0], -PIECE_ANCHOR[1]);   // 以底座中点对齐格心
    ctx.fillStyle = white ? WHITE_FILL : BLACK_FILL;
    ctx.strokeStyle = white ? WHITE_EDGE : BLACK_EDGE;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    const ds = PIECE_PATHS[key];
    for (let i = 0; i < ds.length; i++) {
      const p = path2d(ds[i]);
      ctx.fill(p);
      ctx.stroke(p);
    }
    ctx.restore();
  }

  return {
    layout: layout, fileLabel: fileLabel, isLight: isLight,
    drawBoard: drawBoard, pickSquare: pickSquare,
    PIECE_PATHS: PIECE_PATHS, drawPiece: drawPiece,
    PIECE_BOX: PIECE_BOX, PIECE_ANCHOR: PIECE_ANCHOR, CODE_KEY: CODE_KEY,
  };
});
