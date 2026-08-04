'use strict';
const T = require('../_test.js');
const I = require('../interp.js');
const D = require('./tour-dfs.js');
const W = require('./tour-warnsdorff.js');

// ---- 两份源码必须在子集里合法 ----
for (const [name, M] of [['dfs', D], ['warnsdorff', W]]) {
  let err = null;
  try { I.parse(M.source({ W: 3, H: 4, start: 0 })); } catch (e) { err = e; }
  T.ok(err === null, name + ' 的源码在子集里合法' + (err ? '：' + err.message : ''));
}

/* 巡游合法性：不能只看返回 true。一个「返回 true 但路径是错的」实现
   会骗过所有只看返回值的断言，而这正是学习者要照着学的东西。
   所以从 boardOps 里把路径重建出来，独立验证它真是一条巡游。 */
function tourPath(src, W_, H_) {
  const seq = [];
  I.run(src, { host: {
    mark: function () {}, clear: function () {},
    place: function (sq) { seq.push(sq); },
  } });
  return seq;
}
function isLegalTour(seq, W_, H_) {
  if (seq.length !== W_ * H_) { return 'length ' + seq.length + ' != ' + (W_ * H_); }
  const seen = {};
  for (const sq of seq) {
    if (seen[sq]) { return 'square ' + sq + ' visited twice'; }
    seen[sq] = 1;
  }
  for (let i = 1; i < seq.length; i++) {
    const ax = seq[i - 1] % W_, ay = (seq[i - 1] - ax) / W_;
    const bx = seq[i] % W_, by = (seq[i] - bx) / W_;
    const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
    if (!((dx === 1 && dy === 2) || (dx === 2 && dy === 1))) {
      return 'step ' + i + ' is not a knight move';
    }
  }
  return null;
}

// ---- 3×4 角起：两边都跑得完，且都给出合法巡游 ----
let legalChecked = 0;
for (const [name, M] of [['dfs', D], ['warnsdorff', W]]) {
  const src = M.source({ W: 3, H: 4, start: 0 });
  const r = I.run(src, { host: {} });
  T.ok(!r.trace.truncated, '3x4 ' + name + ' 未截断');
  T.eq(r.result, true, '3x4 ' + name + ' 找到巡游');
  const why = isLegalTour(tourPath(src, 3, 4), 3, 4);
  T.ok(why === null, '3x4 ' + name + ' 的路径是一条合法巡游' + (why ? '：' + why : ''));
  legalChecked++;
}
T.eq(legalChecked, 2, '两份实现都验过合法性');

// ---- 三段弧线：这是这一题的全部内容 ----
function steps(M, W_, H_) {
  return I.run(M.source({ W: W_, H: H_, start: 0 }), { host: {} }).trace;
}
// 第一段 3×4：朴素的反而更便宜 —— 启发式的代价在小盘上收不回来
const d34 = steps(D, 3, 4), w34 = steps(W, 3, 4);
T.ok(d34.length < w34.length,
     '3x4：朴素 DFS 比 Warnsdorff 便宜（' + d34.length + ' < ' + w34.length + '）');

// 第二段 4×5：朴素的撞墙，启发式从容
const d45 = steps(D, 4, 5), w45 = steps(W, 4, 5);
T.eq(d45.truncated, true, '4x5：朴素 DFS 撞上 STEP_LIMIT');
T.ok(!w45.truncated, '4x5：Warnsdorff 跑得完（' + w45.length + ' 步）');

// 第三段 3×7：连启发式也失败 —— 它不是保证
const w37 = steps(W, 3, 7);
T.eq(w37.truncated, true, '3x7：Warnsdorff 也撞墙 —— 启发式不保证');

/* ======== 以下三段是简报之外补的，不改上面任何一条 ======== */

// ---- 缺参数当场抛（阶段 5 约束 6：省略参数已经是本仓库抓到过三次的缺陷类）----
for (const [name, M] of [['dfs', D], ['warnsdorff', W]]) {
  T.throws(function () { M.source({ H: 4, start: 0 }); }, name + '：缺 W 当场抛');
  T.throws(function () { M.source({ W: 3, start: 0 }); }, name + '：缺 H 当场抛');
  T.throws(function () { M.source({ W: 3, H: 4 }); }, name + '：缺 start 当场抛');
  T.throws(function () { M.source(); }, name + '：连 opts 都没有也当场抛');
  T.throws(function () { M.source({ W: 3, H: 4, start: 12 }); }, name + '：start 越界当场抛');
  T.throws(function () { M.source({ W: 3.5, H: 4, start: 0 }); }, name + '：W 不是整数当场抛');
  // 但**不**校验「跑不跑得完」：撞墙那两格正是要生成出来跑给她看的。
  let err = null;
  try { M.source({ W: 3, H: 7, start: 0 }); } catch (e) { err = e; }
  T.ok(err === null, name + '：明知会撞墙的 3x7 照常吐源码');
}

/* ---- 两份源码除了「选下一步」之外逐字相同 ----

   §4⑤ 的落点是「两份可以逐行对比的源码」并排显示。这件事今天只靠两个
   文件头里的一句叮嘱守着，是人肉门 —— 而人肉门在这个仓库里已经漏过。
   这里把它变成机器门：剥掉注释与空行之后，**朴素那份的每一行代码都必须
   按原顺序出现在 Warnsdorff 那份里**（后者只是多了 degree() 与排序）。
   比子序列而不是比行数，是为了不让改一句注释、加一行说明就误报。 */
function codeLines(src) {
  const out = [];
  let inBlock = false;
  for (const raw of src.split('\n')) {
    let s = raw;
    if (inBlock) {
      const end = s.indexOf('*/');
      if (end < 0) { continue; }
      s = s.slice(end + 2); inBlock = false;
    }
    const open = s.indexOf('/*');
    if (open >= 0 && s.indexOf('*/', open) < 0) { inBlock = true; s = s.slice(0, open); }
    s = s.trim();
    if (s === '' || s.slice(0, 2) === '//') { continue; }
    out.push(raw);
  }
  return out;
}
const dCode = codeLines(D.source({ W: 3, H: 4, start: 0 }));
const wCode = codeLines(W.source({ W: 3, H: 4, start: 0 }));
T.ok(dCode.length > 40, '剥注释之后还剩得下代码（' + dCode.length + ' 行），这道门没有空转');
let cursor = 0, missing = null;
for (const lineText of dCode) {
  let j = cursor;
  while (j < wCode.length && wCode[j] !== lineText) { j++; }
  if (j >= wCode.length) { missing = lineText; break; }
  cursor = j + 1;
}
T.ok(missing === null,
     '朴素那份的每一行代码都逐字出现在 Warnsdorff 那份里' +
     (missing === null ? '' : '，最先对不上的是：' + missing));
T.ok(wCode.length > dCode.length,
     'Warnsdorff 确实多出了代码（' + dCode.length + ' → ' + wCode.length + ' 行）');

T.report();
