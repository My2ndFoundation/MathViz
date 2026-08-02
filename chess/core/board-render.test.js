'use strict';
const T = require('./_test.js');
const BR = require('./board-render.js');

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

T.report();
