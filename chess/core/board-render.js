/* 参数化棋盘与棋子渲染。棋盘以原点为中心，躺在 layout({z}) 指定的平面上，
   z 默认 0 —— 前两个工具只有一块棋盘，工具③ 的历史局面才需要沿 −z 分层。
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
    /* z：棋盘所在的平面。默认 0（前两个工具的全部用法）。工具③ 的历史局面
       沿 −z 后退，每一层是一块自己的 layout——把 z 放进 layout 而不是让每个
       调用方在拿到 [x,y,0] 之后自己改第三个分量，是因为 pickSquare 也要用
       同一个 z 去求交：两处各写一遍必然有一天对不上。 */
    const z = (spec && spec.z) || 0;
    const w = files * cell, h = ranks * cell;
    const x0 = -w / 2, y0 = -h / 2;

    return {
      files: files, ranks: ranks, cell: cell, z: z, w: w, h: h,
      squareCenter: function (f, r) {
        return [x0 + (f + 0.5) * cell, y0 + (r + 0.5) * cell, z];
      },
      squareCorners: function (f, r) {
        const x = x0 + f * cell, y = y0 + r * cell;
        return [[x, y, z], [x + cell, y, z], [x + cell, y + cell, z], [x, y + cell, z]];
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
  // 导出它是因为调用方（如需要按视口算合适相机距离的顶视角）要知道
  // 「标了坐标的棋盘」比棋盘本身的世界半径多出多少，不能自己再猜一遍。
  const COORD_LABEL_OFFSET = 0.42;

  // 坐标标签字号：不再写死成常量。12×12 的算法棋盘（如八皇后）和 8×8 的
  // 经典棋盘用同一套相机距离时，前者每格在屏幕上投影出的像素本就更小——
  // 写死 12px 会让 8×8 棋盘上的字显小（用户报告的 defect），而反过来把
  // 12px 调大又会让 12×12 棋盘的字挤成一团。这里改成按「投影后一个格子
  // 有多大」换算：格子越大（相机越近/棋盘越少），字号跟着变大；格子越小，
  // 字号跟着变小。地板/天花板防止近裁剪或极端缩放把字变得读不出来或荒谬。
  const COORD_LABEL_SIZE_FACTOR = 0.34;
  const COORD_LABEL_SIZE_MIN = 12;
  const COORD_LABEL_SIZE_MAX = 26;

  /* 量出「一个格子投影到屏幕上有多大」，用来把坐标标签的字号和它挂靠的
     格子大小挂钩（见上面 COORD_LABEL_SIZE_* 的注释）。用 a1 角上那格的
     两条边（沿 x、沿 y 各一条)分别投影量一次再取平均，而不是只量一条边——
     顶视角之外的角度下，两个方向的投影长度并不总相等（透视 + 旋转）。
     任一角点被近裁剪掉（E.proj 返回 null）时退回地板值，总比整体不画字好。 */
  function coordLabelSize(C, E, L) {
    const o = L.squareCorners(0, 0)[0];
    const p0 = E.proj(C, o);
    const px = E.proj(C, [o[0] + L.cell, o[1], L.z]);
    const py = E.proj(C, [o[0], o[1] + L.cell, L.z]);
    if (!p0 || !px || !py) return COORD_LABEL_SIZE_MIN;
    const cellPx = (Math.hypot(px[0] - p0[0], px[1] - p0[1]) +
                    Math.hypot(py[0] - p0[0], py[1] - p0[1])) / 2;
    return Math.max(COORD_LABEL_SIZE_MIN, Math.min(COORD_LABEL_SIZE_MAX, cellPx * COORD_LABEL_SIZE_FACTOR));
  }

  /* ctx: CanvasRenderingContext2D；C: 相机；E: VizEngine（注入而非全局引用，
     这样本模块在 node 里可加载、可测，不需要 DOM）。

     ctx 参数名副其实：格子填色本就全程用它。但外框与坐标标签走的是
     E.strokePoly / E.label3——这两个图元一直画在 VizEngine.init() 时钉死
     的模块私有画布上，从不理会调用方传进来的 ctx，于是 drawBoard(其他画布, …)
     的输出会被悄悄劈成两半（详见 viz-engine.js 的 withContext 注释）。
     这里用 E.withContext(ctx, fn) 把私有画布临时换成调用方给的这块，
     执行完自动换回去——阶段 1 规则工具要并排画「伪合法 / 合法」两块棋盘，
     就是靠这行才不会串到同一块画布上。 */
  /* a–h/1–8 坐标标签，从 drawBoard 里拆出来的独立入口。存在的唯一理由是
     task-14 perf-gate 的 draw-cost 面板要把「文字渲染」和「格子填色 + 外框」
     分开计时——第一轮 draw-cost 读数（6ms，远高于诊断阶段量到的 ~1.2ms）
     没法只靠一个不透明的总数判断超出的部分是不是文字渲染，所以拆开让
     每一项都能单独测。drawBoard(spec) 在 spec.coords !== false 时原样调用
     这个函数，因此默认行为、绘制顺序、坐标计算都和拆分之前逐字节一致，
     不是重新实现一遍。 */
  function drawCoordLabels(ctx, C, E, spec) {
    const L = spec.layout || layout(spec);
    const o = L.squareCorners(0, 0)[0];
    const size = coordLabelSize(C, E, L);
    E.withContext(ctx, function () {
      for (let f = 0; f < L.files; f++) {
        const c = L.squareCenter(f, 0);
        E.label3(C, [c[0], o[1] - COORD_LABEL_OFFSET * L.cell, L.z], fileLabel(f),
                 { color: COORD, size: size, align: 'center' });
      }
      for (let r = 0; r < L.ranks; r++) {
        const c = L.squareCenter(0, r);
        E.label3(C, [o[0] - COORD_LABEL_OFFSET * L.cell, c[1], L.z], String(r + 1),
                 { color: COORD, size: size, align: 'center' });
      }
    });
  }

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
      const frame = [o, [o[0] + L.w, o[1], L.z], [o[0] + L.w, o[1] + L.h, L.z], [o[0], o[1] + L.h, L.z], o];
      E.strokePoly(C, frame, { color: EDGE, width: 1.4 });
    });

    if (spec.coords !== false) drawCoordLabels(ctx, C, E, { layout: L });

    return L;
  }

  /* 反向查询：屏幕坐标 → 棋盘格。是「点击选子」这枚阶段 1 头号交互
     （点棋子→高亮合法目标→点目标→落子）唯一需要的引擎入口。
     用 E.unproject 把射线与棋盘所在的平面（L.z，默认 0）求交，再按 layout
     的格距换算成 file/rank；落在相机之后、或点在棋盘外框之外都返回 null。 */
  function pickSquare(C, E, screenXY, L) {
    const p = E.unproject(C, screenXY, L.z || 0);
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

  /* defect：drawPiece 曾经把 o.scale（一个原始像素数）直接当 k 用，两个消费
     工具各自手写死了一个常量（chess-moves-geometry.html 用 42，
     chess-rules-check-mate.html 用 46）。相机怎么缩放、棋子都是这么大——
     缩远了棋子溢出格线，缩近了棋子小得像丢在格子里。用户拿着两种失败模式
     的截图报告过这个问题；这是我（任务下发者）的漏项，Phase 1 评审时就
     记过、却没有真正排进任何一个任务，不是两个实现者的偏差。

     修法：省略 o.scale 时，按「这枚棋子自己所在格」投影到屏幕的边长现算
     scale，而不是吃调用方写死的像素数——这样近大远小（透视景深）和相机
     远近（整体缩放）两件事都被同一个量自然吃掉了。

     PIECE_SQUARE_FRACTION 不是拍脑袋定的：两位实现者互不知情地为各自的
     工具手调过一个固定像素常量——46px（chess-rules-check-mate.html，
     dist=11 附近调的）、42px（chess-moves-geometry.html，dist=13 附近调的）。
     换算成「scale ÷ 当时那格的投影边长」，分别是 0.543 与 0.588——两次独立
     的手感调校收敛到同一个窄区间。这里取区间中段的 0.58，直接复用两人已经
     验证过「棋子读得清楚、又不会越出格线蹭到邻居」的手感，而不是重新发明
     一个数字。 */
  const PIECE_SQUARE_FRACTION = 0.58;
  // 量不出格宽时（近裁剪、相机异常）的地板——退回旧手感的量级，
  // 好过整帧不画这枚子。
  const PIECE_SCALE_FALLBACK = 46;

  /* 量出「一枚棋子自己所在格」投影到屏幕上的边长：从格心沿 +x/+y 各探一步
     （世界坐标，步长 = cell），退化到 -x/-y（棋盘外沿一侧没有邻格——例如
     a1 的左边和下边都探不到东西），两个方向都探不到时（例如整块画面被
     近裁剪，或调用方给了一个退化的相机）返回 null，交给 pieceAutoScale
     兜底，而不是在这里悄悄吐出一个编造的数字。按这枚子自己的格心探测、
     不是量一次全棋盘——否则透视下远排的棋子会被按近排的格宽现算，反而
     放大了「近大远小」本该消除的错觉（这正是 coordLabelSize() 量整块棋盘
     一次就够用、而这里不能照抄的原因：坐标标签只有一处，棋子却排布在
     不同深度）。两个方向都探到时取平均，同一手法 coordLabelSize() 已经在
     用——顶视角之外，x/y 两个方向的投影步长本就不总相等（透视 + 旋转）。 */
  function pieceSquarePx(C, E, center, cell) {
    const s0 = E.proj(C, center);
    if (!s0) return null;
    function probe(dx, dy) {
      const p = E.proj(C, [center[0] + dx, center[1] + dy, center[2]]);
      return p ? Math.hypot(p[0] - s0[0], p[1] - s0[1]) : null;
    }
    const dx = probe(cell, 0) != null ? probe(cell, 0) : probe(-cell, 0);
    const dy = probe(0, cell) != null ? probe(0, cell) : probe(0, -cell);
    const parts = [dx, dy].filter(function (v) { return v != null; });
    if (!parts.length) return null;
    return parts.reduce(function (a, b) { return a + b; }, 0) / parts.length;
  }

  /* drawPiece 的默认缩放：cell 省略时按 1（本子项目目前所有棋盘都是
     cell=1），仍然可覆盖——留给将来 cell 更小的算法棋盘（如八皇后的
     12×12）一个入口，不必回头改这里的签名。 */
  function pieceAutoScale(C, E, center, cell) {
    const px = pieceSquarePx(C, E, center, cell == null ? 1 : cell);
    return px == null ? PIECE_SCALE_FALLBACK : px * PIECE_SQUARE_FRACTION;
  }

  /* 棋子画成朝向相机的剪影：把它的世界坐标投影成屏幕点，
     然后在屏幕空间里以该点为基准绘制。这样任意相机角度下都读得清。

     o.scale 仍然是可选的显式覆盖——_piece-preview.html 的合法性网格要给
     32 颗子摆一个刻意固定、彼此可比的尺寸做视觉核验，那里不该跟着相机
     距离自动变化，必须原样保留这个逃生舱口。省略 o.scale 时才现算。 */
  function drawPiece(ctx, C, E, o) {
    const s = E.proj(C, o.center);
    if (!s) return;
    const key = CODE_KEY[Math.abs(o.code)];
    if (!key) return;
    const white = o.code > 0;
    const scale = o.scale != null ? o.scale : pieceAutoScale(C, E, o.center, o.cell);
    const k = (scale || 1) / PIECE_BOX;

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
    drawBoard: drawBoard, drawCoordLabels: drawCoordLabels, pickSquare: pickSquare,
    coordLabelSize: coordLabelSize, COORD_LABEL_OFFSET: COORD_LABEL_OFFSET,
    PIECE_PATHS: PIECE_PATHS, drawPiece: drawPiece,
    PIECE_BOX: PIECE_BOX, PIECE_ANCHOR: PIECE_ANCHOR, CODE_KEY: CODE_KEY,
    pieceSquarePx: pieceSquarePx, pieceAutoScale: pieceAutoScale,
    PIECE_SQUARE_FRACTION: PIECE_SQUARE_FRACTION,
  };
});
