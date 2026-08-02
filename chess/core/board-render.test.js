'use strict';
const T = require('./_test.js');
const BR = require('./board-render.js');
const E = require('./viz-engine.js');

// ---- 布局 ----
const L8 = BR.layout({ files: 8, ranks: 8, cell: 1 });
T.eq(L8.w, 8, '8×8 棋盘宽 8');
T.eq(L8.h, 8, '8×8 棋盘高 8');
T.eq(L8.squareCenter(0, 0), [-3.5, -3.5, 0], 'a1 的中心在左下');
T.eq(L8.squareCenter(7, 7), [3.5, 3.5, 0], 'h8 的中心在右上');
T.eq(L8.squareCenter(4, 3), [0.5, -0.5, 0], 'e4 的中心');
T.ok(L8.squareCenter(0, 0).every(v => Math.abs(v) < 4), '棋盘以原点为中心');

// 非 8×8
const L4 = BR.layout({ files: 4, ranks: 4, cell: 1 });
T.eq(L4.squareCenter(0, 0), [-1.5, -1.5, 0], '4×4 棋盘 a1 的中心');
T.eq(L4.squareCenter(3, 3), [1.5, 1.5, 0], '4×4 棋盘 d4 的中心');

const L12 = BR.layout({ files: 12, ranks: 12, cell: 1 });
T.eq(L12.squareCenter(11, 11), [5.5, 5.5, 0], '12×12 棋盘右上角的中心');

// 非方形（为将来的变体题留的）
const L58 = BR.layout({ files: 5, ranks: 8, cell: 1 });
T.eq(L58.w, 5, '非方形棋盘宽度取 files');
T.eq(L58.h, 8, '非方形棋盘高度取 ranks');

// cell 缩放
const Lc = BR.layout({ files: 8, ranks: 8, cell: 0.5 });
T.eq(Lc.squareCenter(0, 0), [-1.75, -1.75, 0], 'cell=0.5 时坐标等比缩小');
T.eq(Lc.w, 4, 'cell=0.5 时总宽减半');

// 四角
const c = L8.squareCorners(0, 0);
T.eq(c.length, 4, '一格有 4 个角');
T.eq(c[0], [-4, -4, 0], 'a1 的左下角就是棋盘的左下角');
T.eq(c[2], [-3, -3, 0], 'a1 的右上角');

// ---- 直列标注 ----
T.eq(BR.fileLabel(0), 'a', '第 0 列是 a');
T.eq(BR.fileLabel(7), 'h', '第 7 列是 h');
T.eq(BR.fileLabel(11), 'l', '12×12 棋盘的最后一列是 l');

// ---- 格子明暗 ----
T.eq(BR.isLight(0, 0), false, 'a1 是深色格（国际象棋惯例：右下角为浅色）');
T.eq(BR.isLight(7, 0), true, 'h1 是浅色格');
T.eq(BR.isLight(0, 7), true, 'a8 是浅色格');

// ---- 棋子路径 ----
const KEYS = ['P', 'N', 'B', 'R', 'Q', 'K'];
for (const k of KEYS) {
  T.ok(Array.isArray(BR.PIECE_PATHS[k]), k + ' 有路径数组');
  T.ok(BR.PIECE_PATHS[k].length > 0, k + ' 的路径数组非空');
  for (const d of BR.PIECE_PATHS[k]) {
    T.ok(typeof d === 'string' && d.length > 0, k + ' 的每条路径都是非空字符串');
    T.ok(/^M/.test(d.trim()), k + ' 的路径以 M 开头');
    T.ok(/[zZ]\s*$/.test(d.trim()), k + ' 的路径以 z 闭合');
    // 坐标必须落在 0..100 的设计框内，否则缩放会串位
    const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
    T.ok(nums.every(n => n >= -10 && n <= 110), k + ' 的坐标在设计框范围内');
  }
}
T.eq(Object.keys(BR.PIECE_PATHS).sort(), KEYS.slice().sort(), '六种棋子齐全，无多余键');

// CODE_KEY 是 chess-core.js 编码约定的镜像，不是这里凭空定义的。
// chess-core.js（本次修改范围之外）第 10 行：
//   const EMPTY = 0, P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
// 两边一旦漂移，drawPiece 会认错子却不报错——所以在这里钉死这份映射关系。
T.eq(BR.CODE_KEY, { 1: 'P', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K' },
     'CODE_KEY 与 chess-core.js 的棋子编码常量一一对应');

// ---- 坐标标签字号：随「棋盘在屏幕上投影出的格子大小」缩放，不再写死 ----
// defect：a-h/1-8 标签曾经无论相机远近、格子多大都固定 size:12，用户报告
// 太小。字号必须是「投影后一个格子有多大」的函数——这个量只取决于 cell
// 的世界尺寸和相机远近，不取决于 files/ranks 有多少格（L8 与 L12 都用
// cell=1，同一相机下单格投影大小天然相近，字号也该相近；真正让 12×12
// 算法棋盘的格子在屏幕上变小的，是作者为了让更多格塞进同一屏幕而选用更小
// 的 cell 或更远的相机——这两种情况分别由下面两组断言覆盖）。
{
  const camNear = E.makeCam();   // 默认 cam：dist=10
  const sizeNear = BR.coordLabelSize(camNear, E, L8);
  T.ok(sizeNear > 12, '默认相机下 8×8 棋盘的字号应比旧的写死值 12 更大（这正是用户报告的 defect）');
  T.ok(sizeNear <= 26, '字号不应超过天花板');

  // cell 更小（Lc：cell=0.5，8×8 但棋盘整体只有 L8 的一半宽）→ 同一相机下
  // 单格投影天然更小 —— 这正是「12×12 算法棋盘为了同屏塞下更多格而缩小
  // cell」时会发生的情形，字号应跟着变小。
  const sizeSmallCell = BR.coordLabelSize(camNear, E, Lc);
  T.ok(sizeSmallCell < sizeNear, 'cell 更小时，单格投影更小，字号应更小');
  T.ok(sizeSmallCell >= 12, '字号不应低于地板');

  // 相机拉远 → 棋盘（连同每一格）在屏幕上整体缩小 → 字号应跟着变小——
  // 这是 12×12 棋盘常见的另一种情形：cell 不变，靠拉远相机让整块棋盘
  // 装进同一屏幕。
  const savedDist = E.cam.dist;
  E.cam.dist = savedDist * 6;
  const camFar = E.makeCam();
  const sizeFar = BR.coordLabelSize(camFar, E, L8);
  T.ok(sizeFar < sizeNear, '相机拉远、棋盘在屏幕上变小时，字号应跟着变小');
  T.eq(sizeFar, Math.max(12, sizeFar), '字号不应低于地板 12');
  E.cam.dist = savedDist;   // 还原，避免影响后面用默认相机的断言
}

// ---- pickSquare：屏幕坐标 → 棋盘格（点击选子的唯一入口） ----
// 用 proj 把每个格心投影到屏幕，再用 pickSquare 挑回来，必须得到同一格。
// 覆盖默认 8×8、非默认 12×12、非方形 5×8 —— 尺寸是参数化的，不能只测一种。
function assertPickRoundTrip(files, ranks, label) {
  const L = BR.layout({ files: files, ranks: ranks, cell: 1 });
  const C = E.makeCam();
  for (let r = 0; r < ranks; r++) {
    for (let f = 0; f < files; f++) {
      const center = L.squareCenter(f, r);
      const s = E.proj(C, center);
      T.ok(s, label + '：格心 ' + f + ',' + r + ' 不应被近裁剪掉');
      if (!s) continue;
      const picked = BR.pickSquare(C, E, s, L);
      T.eq(picked, { file: f, rank: r }, label + '：' + f + ',' + r + ' 投影再挑回应得同一格');
    }
  }
  // 棋盘外的一点必须挑不到格：把屏幕中心大幅偏移，落到棋盘范围之外
  const vi = E.viewInfo();
  T.eq(BR.pickSquare(C, E, [vi.CX + 5000, vi.CY + 5000], L), null,
       label + '：棋盘外的点应返回 null');
}
assertPickRoundTrip(8, 8, '8×8');
assertPickRoundTrip(12, 12, '12×12');
assertPickRoundTrip(5, 8, '5×8 非方形');

// ---- unproject 的两种退化情形：与平面平行、交点落在相机之后 ----
// 用手搭的相机基而不是 makeCam()，把边界条件摆得干净：
// eye 在 z=5 处，朝 -z 方向看（f=[0,0,-1]），r/u 是标准的右/上。
const flatCam = { eye: [0, 0, 5], f: [0, 0, -1], r: [1, 0, 0], u: [0, 1, 0] };
const vi = E.viewInfo();
T.eq(E.unproject(flatCam, [vi.CX, vi.CY], 0), [0, 0, 0],
     'unproject：屏幕正中心的射线应落在棋盘平面原点');
T.eq(E.unproject(flatCam, [vi.CX, vi.CY], 10), null,
     'unproject：z=10 的平面在相机之后（眼在 z=5 朝 -z 看），应返回 null');

// 与平面平行：相机沿世界 X 轴看（forward 的 z 分量为 0），
// 正对屏幕中心的那条射线永远停在同一个 z，不会与 z=0 平面相交。
const sidewaysCam = { eye: [10, 0, 0], f: [-1, 0, 0], r: [0, 0, -1], u: [0, 1, 0] };
T.eq(E.unproject(sidewaysCam, [vi.CX, vi.CY], 0), null,
     'unproject：射线与平面平行（forward 无 z 分量）应返回 null，而不是抛错或除零结果');

// ---- 棋子自动缩放：defect —— 棋子曾经吃 o.scale 这个写死的像素数，
// 不随相机远近 / 景深一起变，缩远了溢出格线、缩近了小得像丢在格子里。
// 现在默认（省略 o.scale）按「这枚子自己所在格」的投影边长现算。
// 核心不变量：scale / 那一格自己的投影边长 恒等于 PIECE_SQUARE_FRACTION——
// 不论相机拉多远、不论棋子在近排还是远排。这正是修复的证明：旧代码里这个
// 比值会随相机和深度到处漂移（因为分子是写死的常量），新代码里它是个常数。
{
  const board = BR.layout({ files: 8, ranks: 8, cell: 1 });
  const savedCam = { az: E.cam.az, el: E.cam.el, dist: E.cam.dist, tx: E.cam.tx, ty: E.cam.ty, tz: E.cam.tz };
  E.cam.az = -0.6; E.cam.el = 0.5; E.cam.tx = 0; E.cam.ty = 0; E.cam.tz = 0;

  const seenSquarePx = [];   // 用来断言「近排/远排」在不同相机距离下确实量出不同的格宽——
                              // 不然下面的比值不变断言会显得像是凑巧过的空判据。
  [8, 13, 20].forEach(dist => {
    E.cam.dist = dist;
    const cam = E.makeCam();
    [{ r: 0, tag: 'rank0' }, { r: 7, tag: 'rank7' }].forEach(({ r, tag }) => {
      const center = board.squareCenter(3, r);
      const sqPx = BR.pieceSquarePx(cam, E, center, 1);
      const scale = BR.pieceAutoScale(cam, E, center, 1);
      T.ok(sqPx > 0, 'dist=' + dist + ' ' + tag + '：格宽应量出正数');
      T.ok(Math.abs(scale / sqPx - BR.PIECE_SQUARE_FRACTION) < 1e-9,
           'dist=' + dist + ' ' + tag + '：scale/格宽 应恒等于 PIECE_SQUARE_FRACTION（' + BR.PIECE_SQUARE_FRACTION + '）');
      seenSquarePx.push(sqPx);
    });
  });
  // 至少要有明显不同的格宽读数——否则上面的「恒等」断言只是在重复量同一个数。
  T.ok(Math.max(...seenSquarePx) / Math.min(...seenSquarePx) > 1.5,
       '不同相机距离 / 不同排之间，量出的格宽应有显著差异（否则下面的恒等式没有验证力度）');

  // ---- 退化情形 1：棋盘角格（a1）没有 -x/-y 方向的邻格，必须退化到 +x/+y ----
  E.cam.dist = 13;
  const camCorner = E.makeCam();
  const a1 = board.squareCenter(0, 0);
  const cornerPx = BR.pieceSquarePx(camCorner, E, a1, 1);
  T.ok(cornerPx > 0, 'a1（棋盘角格）应能退化到 +x/+y 方向量出格宽');
  const d4Px = BR.pieceSquarePx(camCorner, E, board.squareCenter(3, 3), 1);
  T.ok(Math.abs(cornerPx - d4Px) / d4Px < 0.05,
       'a1 退化后量出的格宽应与盘中心格接近（同一相机下，格宽本身不该因为退化探测方向而失真）');

  // ---- 退化情形 2：这一格的两个方向都探不到（邻格被近裁剪 / 落在相机之后）——
  // 必须安静地退回 PIECE_SCALE_FALLBACK 那个量级的常量，而不是返回 NaN 或抛错。
  const degenerateCam = { eye: [-2.5, -3.5, 0.1], f: [1, 0, 0], r: [0, 0, -1], u: [0, 1, 0] };
  T.eq(BR.pieceSquarePx(degenerateCam, E, [-3.5, -3.5, 0], 1), null,
       '两个方向的邻格都探不到时，pieceSquarePx 应返回 null');
  const fallbackScale = BR.pieceAutoScale(degenerateCam, E, [-3.5, -3.5, 0], 1);
  T.ok(fallbackScale > 0 && isFinite(fallbackScale),
       'pieceSquarePx 返回 null 时，pieceAutoScale 应退回一个有限的正数兜底，而不是 NaN');

  // ---- o.scale 显式覆盖仍然优先——_piece-preview.html 的合法性网格要保留
  // 这个逃生舱口，摆出彼此可比、不随相机变化的固定尺寸。 ----
  Object.assign(E.cam, savedCam);
}

T.report();
