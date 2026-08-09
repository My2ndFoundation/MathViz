'use strict';
/* 「立成高度」可行性探针（阶段 9c 收尾，规格 §4⑤ 裁定 ⑥）。
   9f 的 fieldBFS 要把每格的标量**立成高度**，而 9c 只实现了「写数字」。
   这一段不实现高度，它只回答一个问题：**同一条数字通道够不够 9f 用**。
   探针不落成工具、不进注册表。 */
const T = require('../_test.js');
const I = require('../interp.js');
const P = require('./path-count.js');

/* 拿一个**值域小**的例子模拟 fieldBFS 的形状：距离 0–6。
   pathCount 自己的值会涨到几千（所以它写数字），但通道是同一条。 */
const marks = [];
I.run(P.source({ N: 4, blocked: [], lang: 'zh' }), { host: {
  mark: function (sq, kind) { if (typeof kind === 'number') marks.push([sq, kind]); },
} });

T.ok(marks.length > 0, '探针：数字确实通过 mark 通道送出来了');

/* ① 柱高要的单位：宿主拿到的是**原始数值**，不是格式化过的字符串 ——
   所以 9f 可以直接拿它当高度，不必反解析。 */
T.ok(marks.every(function (m) { return typeof m[1] === 'number' && isFinite(m[1]); }),
     '探针①：拿到的是可直接当高度用的有限数值，不是字符串');

/* ② 0 值：0 是一个**真实的答案**（墙上的格子、够不到的格子），
   不是「没有值」。通道必须能把 0 与「从没标过」区分开。 */
const zeroRun = [];
I.run(P.source({ N: 5, blocked: [0], lang: 'zh' }), { host: {
  mark: function (sq, kind) { if (typeof kind === 'number') zeroRun.push([sq, kind]); },
} });
T.ok(zeroRun.some(function (m) { return m[1] === 0; }),
     '探针②：0 是被真的标出来的值，不是缺席 —— 9f 画柱子时 0 要画成贴地的一格，不是不画');

/* ③ 值域跨度：pathCount 到几千，fieldBFS 只有 0–6。
   同一条通道两种量级都过得去，说明 9f 不需要另开一条。 */
const big = marks.map(function (m) { return m[1]; }).sort(function (a, b) { return b - a; })[0];
T.ok(big >= 20, '探针③：同一条通道扛得住 pathCount 的量级（本例最大 ' + big + '）');

T.report();
