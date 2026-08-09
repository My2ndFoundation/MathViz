'use strict';
const T = require('../_test.js');
const I = require('../interp.js');
const P = require('./path-count.js');

/* 宿主侧的独立参照 DP —— 不是写死期望值，是另写一份实现来对拍。
   规格 §7.3 的判据是「跟另一份实现一致」，写死的期望值只能覆盖
   测试作者想到的输入。 */
function hostCount(N, blocked) {
  const B = {};
  for (let i = 0; i < blocked.length; i++) B[blocked[i]] = true;
  const dp = [];
  for (let r = 0; r < N; r++) { dp.push(new Array(N).fill(0)); }
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (B[r * N + c]) { dp[r][c] = 0; continue; }
      if (r === 0 && c === 0) { dp[r][c] = 1; continue; }
      dp[r][c] = (r > 0 ? dp[r - 1][c] : 0) + (c > 0 ? dp[r][c - 1] : 0);
    }
  }
  return dp[N - 1][N - 1];
}

/* 四档盘面 + 两组额外形状。四档的答案在计划里是实测写死的，这里**不**写死 ——
   拿 hostCount 对拍，两边都错成同一个数的可能性远低于我把某个数抄错。 */
const CASES = [
  { N: 4, blocked: [], tag: '档0 4×4 空盘' },
  { N: 8, blocked: [], tag: '档1 8×8 空盘' },
  { N: 8, blocked: [26, 35, 44], tag: '档2 8×8 三堵墙' },
  { N: 8, blocked: [7, 14, 21, 28, 35, 42, 49, 56], tag: '档3 8×8 整条反对角线' },
  { N: 1, blocked: [], tag: '1×1（起点就是终点）' },
  { N: 5, blocked: [0], tag: '起点自己被堵上' },
];
let n = 0;
for (const cs of CASES) {
  const r = I.run(P.source({ N: cs.N, blocked: cs.blocked, lang: 'zh' }), { host: {} });
  T.ok(!r.trace.truncated, cs.tag + ' —— 没撞步数上限');
  T.eq(r.result, hostCount(cs.N, cs.blocked), cs.tag + ' —— 与宿主侧 DP 一致');
  n++;
}
T.eq(n, 6, '六组都对拍过');

/* 计划里那四个数是实测写死的。这四条**不是**上面那组的重复：上面比的是
   「两份实现一致」，这四条钉的是「那个一致的数就是计划里写的数」——
   两份实现同时错成同一个数，只有这四条拦得住。 */
T.eq(hostCount(4, []), 20, '档0 = 20');
T.eq(hostCount(8, []), 3432, '档1 = 3432（C(14,7)）');
T.eq(hostCount(8, [26, 35, 44]), 1287, '档2 = 1287');
T.eq(hostCount(8, [7, 14, 21, 28, 35, 42, 49, 56]), 0, '档3 = 0（整条反对角线堵死）');

/* ---- mark 通道：这道题发的是**数字**，不是四种状态之一 ---- */
const marks = [];
I.run(P.source({ N: 4, blocked: [], lang: 'zh' }), { host: {
  mark: function (sq, kind) { marks.push([sq, kind]); },
} });
T.ok(marks.length >= 16, '每一格都被标过（' + marks.length + ' 次）');
const nums = marks.filter(function (m) { return typeof m[1] === 'number'; });
T.ok(nums.length >= 16, '标出来的值里有数字 —— 这就是「每格带一个标量」那笔账');
T.ok(marks.filter(function (m) { return m[1] === 'try'; }).length > 0,
     '也发了 try（正在算这一格），数字与状态两种 kind 并存');

/* ---- 三道双语门（规格 §7.5）---- */
const zh = P.source({ N: 8, blocked: [26, 35, 44], lang: 'zh' });
const en = P.source({ N: 8, blocked: [26, 35, 44], lang: 'en' });
T.ok(zh !== en, '两种语言真的不一样');
T.eq(zh.split('\n').length, en.split('\n').length, '① 行数同一（规格 §1.6 的逐行对齐）');
T.eq(I.run(zh, { host: {} }).trace.length, I.run(en, { host: {} }).trace.length,
     '② 步数同一（注释不产生步）');
T.ok(!/[一-鿿㐀-䶿　-〿＀-￯]/.test(en.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')),
     '③ 英文变体抽掉注释后没有汉字');

/* lang 必填 —— 默认成任何一种都是让同一个缺陷换个地方复活 */
T.throws(function () { P.source({ N: 4 }); }, 'lang 缺席当场抛',
         'source({ lang }) 少了 lang');
T.throws(function () { P.source({ N: 4, lang: 'fr' }); }, 'lang 只认 zh/en',
         'source({ lang }) 的 lang 只认 "zh" 或 "en"');
T.throws(function () { P.source({ lang: 'zh' }); }, 'N 缺席当场抛',
         'source({ N }) 少了 N');

T.report();
