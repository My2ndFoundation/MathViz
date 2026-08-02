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

T.report();
