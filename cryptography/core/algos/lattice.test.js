'use strict';
const T = require('../_test.js');
const C = require('../crypto-core.js');
const L = require('./lattice.js');
/* diffie-hellman 被 require 进来不是顺手多测一点：本文件最要紧的一条纪律断言，
   就是 periodOf 在**素数模**上必须逐个等于 DH.orderOf。lattice.js 里另写了一份
   求阶，理由写在那边（这一页的模数必须是合数，DH 那份要求素数）；两份实现之间
   的漂移只能靠一条真的跑起来的等式拴住。 */
const DH = require('./diffie-hellman.js');

/* ================= 可复现的随机源 =================
   本文件一次都不碰 Math.random。所有测量都要被写进报告，不可复现的数字
   等于没测；而且"这次绿了下次红"的测试比没有测试更坏。 */
function lcg(seed) {
  let s = seed >>> 0;
  /* 取高位（除以 2³²）而不是低位取模：LCG 的低位周期极短。 */
  return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

const M = [];      // 测出来的数字，末尾统一打印，方便抄进报告

/* ================= 二维整数矩阵 =================
   基准格：列 = (3,1) 与 (−1,3)，内积 −3 + 3 = 0 —— 这两支**正交**，长度都是 √10。
   选一个正交的约化基不是为了好看：正交时 ‖B·c − t‖² 在两个坐标上完全解耦，
   于是"各自四舍五入"就是精确的最近点，一次都不会错。这让第一个页签的两侧
   都变成可证的陈述而不是经验之谈——好基下取整**必对**，歪基下经常错。
   （真实的约化基通常只是近正交，那时取整只是"通常对"。这一点页面上要说出来。） */
const GOOD = [[3, -1], [1, 3]];             // 列 = (3,1) 与 (−1,3)，det = 10

T.eq(L.detInt(GOOD), 10, '整数行列式是 3·3 − (−1)·1 = 10');
T.eq(GOOD[0][0] * GOOD[0][1] + GOOD[1][0] * GOOD[1][1], 0, '两支基向量正交');
T.eq(L.detInt([[1, 0], [0, 1]]), 1, '单位阵的行列式是 1');
T.eq(L.detInt([[1, 5], [0, 1]]), 1, '剪切矩阵的行列式恒为 1');
T.ok(L.isUnimodular([[1, 5], [0, 1]]), '剪切矩阵是幺模的');
T.ok(L.isUnimodular([[0, 1], [1, 0]]), '换列矩阵 det = −1，同样幺模');
T.ok(!L.isUnimodular([[2, 0], [0, 1]]), 'det = 2 不是幺模——它生成的是一个子格');

/* ⚠ 整数行列式与 core 的 matDet 是**两件事**。这条断言把这件事钉住：
   det = 27 的矩阵在模 26 下也是 1，而它一点都不幺模。混用两者，
   "同一个格"这句话就会在某个 27 上悄悄变成假的。 */
T.eq(C.matDet([[27, 0], [0, 1]], 26), 1, 'core 的 matDet 是模 n 的：27 ≡ 1 (mod 26)');
T.eq(L.detInt([[27, 0], [0, 1]]), 27, 'detInt 是整数行列式：27 就是 27');
T.ok(!L.isUnimodular([[27, 0], [0, 1]]), '所以它不幺模——用 matDet 判会判反');

T.eq(L.matMulInt([[1, 2], [3, 4]], [[5, 6], [7, 8]]), [[19, 22], [43, 50]], '整数矩阵乘法');
T.eq(L.matPowInt(L.shearU(1), 5), L.shearU(5), '剪切矩阵的 k 次幂就是 shearU(k)');
T.eq(L.matPowInt(GOOD, 0), [[1, 0], [0, 1]], '零次幂是单位阵');
T.eq(L.shearU(3), [[1, 3], [0, 1]], 'shearU(3)');

T.throws(function () { L.detInt([[1, 2], [3]]); }, '行长不齐要抛', /必须是 2×2/);
T.throws(function () { L.detInt([[1, 2], [3, 2.5]]); }, '非整数元素要抛', /不是整数/);
T.throws(function () { L.matPowInt(GOOD, -1); }, '负指数要抛', /非负整数/);
T.throws(function () { L.coordsOf([[1, 2], [2, 4]], [0, 0]); }, '退化基要抛', /det = 0/);

/* ================= 坐标与 Babai ================= */
T.eq(L.apply(GOOD, [2, -1]), [7, -1], 'B·c 是整数格点');
T.eq(L.coordsOf(GOOD, [7, -1]), [2, -1], 'coordsOf 是 apply 的逆');
T.eq(L.babai(GOOD, [7, -1]).point, [7, -1], '目标本身就是格点时，取整法当然对');
T.eq(L.babai(GOOD, [7.05, -1.02]).point, [7, -1], '轻微扰动后仍取到同一个点');

/* ================= 断言 1：同一个格，两种描述 =================
   不是断言，是普查。B 与 B·U 在 [−HALF, HALF]² 里生成的格点集合逐点比较。
   两个方向都比：只查"B′ 的点都在 B 里"会漏掉 B 有而 B′ 没有的那一半，
   而那正好是"U 不幺模"最典型的病症（子格：点变少，但一个新点都没有）。 */
const HALF = 40;
const UNIMODULARS = [
  L.shearU(1), L.shearU(2), L.shearU(3), L.shearU(5), L.shearU(8),
  [[0, 1], [1, 0]],
  [[1, 0], [1, 1]],
  [[2, 3], [3, 5]],
  [[1, -4], [0, 1]],
  [[5, 8], [8, 13]]
];
let claim1Points = 0;
UNIMODULARS.forEach(function (U) {
  T.ok(L.isUnimodular(U), '普查用的 U 必须先是幺模的：' + JSON.stringify(U));
  const B2 = L.matMulInt(GOOD, U);
  const r = L.sameLattice(GOOD, B2, HALF);
  claim1Points = r.countA;
  T.ok(r.equal, '同一个格：B 与 B·' + JSON.stringify(U) + ' 在 ±' + HALF + ' 盒内点集完全相同');
  T.eq(r.countA, r.countB, '两侧点数也必须一样：' + JSON.stringify(U));
  /* 余体积是 |det|，不是 det：换列那个 U 的 det = −1，会把符号翻过去。
     第一版这里写成了 detInt(B2) === detInt(GOOD)，被换列矩阵当场判红——
     符号是基的定向，不是格的性质。 */
  T.eq(Math.abs(L.detInt(B2)), Math.abs(L.detInt(GOOD)), '幺模变换不改变 |det|（格的余体积）');
});
M.push('断言 1  ±' + HALF + ' 的方盒内，GOOD 基有 ' + claim1Points + ' 个格点；' +
       UNIMODULARS.length + ' 个幺模 U 各自生成的点集与它逐点相同（双向零差集）');

/* 负对照：非幺模的 U 必须让普查**失败**。没有这一条，上面那一排绿灯有可能
   只是因为 sameLattice 恒返回 true。 */
const SUB = L.matMulInt(GOOD, [[2, 0], [0, 1]]);
const subR = L.sameLattice(GOOD, SUB, HALF);
T.ok(!subR.equal, '负对照：det U = 2 生成的是子格，点集必须不同');
T.ok(subR.onlyA.length > 0, '子格里缺的那些点，必须真的被列出来');
T.eq(subR.onlyB.length, 0, '子格是真子集：它不会有 GOOD 没有的点');
M.push('断言 1 负对照  det U = 2 时 ' + subR.countA + ' → ' + subR.countB +
       ' 个点，缺 ' + subR.onlyA.length + ' 个，多 0 个（真子格）');

/* ================= Gauss 约化 ================= */
const RED = L.gaussReduce(GOOD);
T.eq(RED.B, GOOD, 'GOOD 本身已经是约化基，约化不动它');
T.eq(RED.steps, 0, '零步');
T.ok(L.isUnimodular(RED.U), '约化给出的 U 必须幺模');

[1, 2, 3, 5, 8, 12].forEach(function (k) {
  const B = L.matMulInt(GOOD, L.shearU(k));
  const r = L.gaussReduce(B);
  T.ok(L.isUnimodular(r.U), 'shear ' + k + '：约化的 U 幺模');
  T.eq(L.matMulInt(B, r.U), r.B, 'shear ' + k + '：reduced = B·U 是一个等式，不是口号');
  T.ok(L.sameLattice(B, r.B, 20).equal, 'shear ' + k + '：约化前后是同一个格');
  const n1 = L.norm2([r.B[0][0], r.B[1][0]]), n2 = L.norm2([r.B[0][1], r.B[1][1]]);
  T.ok(n1 <= n2, 'shear ' + k + '：约化后第一个基向量不长于第二个');
  T.eq(Math.min(n1, n2), 10, 'shear ' + k + '：最短向量是 (3,1)，长度² = 10，与描述无关');
});

/* ================= CVP：最近点与基无关 =================
   这是第一个页签的整条论点的另一半。难的是"找"，不是"有"——最近点是格的
   性质，换一组基一个像素都不会动。 */
const rngCvp = lcg(20260810);
let cvpAgree = 0, cvpTotal = 0;
for (let i = 0; i < 400; i++) {
  const t = [(rngCvp() * 2 - 1) * 15, (rngCvp() * 2 - 1) * 15];
  const a = L.closest(GOOD, t).point;
  const b = L.closest(L.matMulInt(GOOD, L.shearU(7)), t).point;
  cvpTotal++;
  if (a[0] === b[0] && a[1] === b[1]) cvpAgree++;
}
T.eq(cvpAgree, cvpTotal, '最近点与基无关：400 个随机目标上两组基给出同一个点');

/* closest 的正确性本身也要有独立的裁判：那个 ±3 的窗口是个常数，而常数是
   最容易在某一天被人"顺手调小一点"的东西。

   ⚠ 裁判的第一版是错的，而且错得恰好印证了这一页的论点：它在**当前这组基**下
   枚举 ±30 的整数系数。歪基下那 61×61 个系数覆盖的是一条又长又细的斜条带，
   真正的最近点根本不在里面——shear 8、目标 (9.27, −10.76) 上，裁判给出
   (9,−8)（d² = 7.68），而 closest 给出的 (11,−11)（d² = 3.06）才是对的
   （±300 的枚举证实了这一点）。**在坏基里做有界搜索会漏掉答案**，正是第一个
   页签要讲的事，只是这次它先咬了裁判一口。

   现在的裁判走 pointsInBox：它按盒子的四角反解系数范围，覆盖的是屏幕上那块
   方形区域里的**全部**格点，与基的歪斜无关，也不经过 gaussReduce 与那个 ±3
   窗口——是一条真正独立的代码路径。 */
const rngBrute = lcg(991);
const BRUTE_HALF = 60;                       // |t| ≤ 12，最近点绝不可能跑到 ±60 外
function bruteClosest(B, t) {
  const pts = L.pointsInBox(B, BRUTE_HALF);
  let best = null, bd = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const xy = pts[i].split(',');
    const p = [parseInt(xy[0], 10), parseInt(xy[1], 10)];
    const d = L.dist2(p, t);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
let bruteAgree = 0;
for (let i = 0; i < 120; i++) {
  const t = [(rngBrute() * 2 - 1) * 12, (rngBrute() * 2 - 1) * 12];
  const B = L.matMulInt(GOOD, L.shearU(i % 9));
  const a = L.closest(B, t).point, b = bruteClosest(B, t);
  if (a[0] === b[0] && a[1] === b[1]) bruteAgree++;
}
T.eq(bruteAgree, 120, 'closest 的 ±3 窗口与 ±' + BRUTE_HALF + ' 方盒的全枚举在 120 个用例上完全一致');

/* 把上面那次"裁判自己被坏基骗了"的事故钉成一条断言：它不是轶事，是本页论点的
   一个可复现的实例。 */
(function () {
  const B = L.matMulInt(GOOD, L.shearU(8));
  const t = [9.2677, -10.758];
  let bad = null, bd = Infinity;
  for (let i = -30; i <= 30; i++) {
    for (let j = -30; j <= 30; j++) {
      const p = L.apply(B, [i, j]);
      const d = L.dist2(p, t);
      if (d < bd) { bd = d; bad = p; }
    }
  }
  const truth = L.closest(B, t);
  T.ok(L.dist2(bad, t) > truth.dist * truth.dist + 1,
       '坏基下 ±30 的系数枚举漏掉了真正的最近点（d² ' + L.dist2(bad, t).toFixed(2) +
       ' vs ' + (truth.dist * truth.dist).toFixed(2) + '）');
  T.eq(bruteClosest(B, t), truth.point, '而按屏幕方盒枚举的裁判与 closest 一致');
})();

/* ================= 断言 4：取整法的成功率随基而变 =================
   同一个格、同一批目标点，换一组基，naive rounding 的命中率就掉下来。
   这是"陷门"这个词在这一页里的全部含义。 */
const CVP_SPAN = 12, CVP_COUNT = 2000;
const cvpRates = [];
[0, 1, 2, 3, 5, 8].forEach(function (k) {
  const B = L.matMulInt(GOOD, L.shearU(k));
  const r = L.cvpTrials({ B: B, rng: lcg(7 + k), count: CVP_COUNT, span: CVP_SPAN });
  cvpRates.push({ k: k, rate: r.rate, hits: r.hits });
  M.push('断言 4  shear ' + k + '：Babai 取整命中最近点 ' + r.hits + '/' + r.count +
         ' = ' + (r.rate * 100).toFixed(1) + '%');
});
/* shear 0 的基是正交的，所以 ‖B·c − t‖² 在两个坐标上解耦，各自取整就是精确解。
   这条 100% 是可证的，不是"实测碰巧"——所以它写成 === 1 而不是一个下限。 */
T.eq(cvpRates[0].rate, 1, '正交基（shear 0）下取整法在 ' + CVP_COUNT + ' 个目标上从不出错');
T.ok(cvpRates[cvpRates.length - 1].rate < 0.35,
     '最歪的那组基下命中率必须显著掉下来（实测 ' +
     (cvpRates[cvpRates.length - 1].rate * 100).toFixed(1) + '%）');
for (let i = 1; i < cvpRates.length; i++) {
  T.ok(cvpRates[i].rate <= cvpRates[i - 1].rate + 1e-9,
       '基越歪，命中率单调不升：shear ' + cvpRates[i - 1].k + ' → ' + cvpRates[i].k);
}

/* ================= LWE ================= */
const Q = 23;
T.throws(function () { L.instance({ q: 24, n: 3, rng: lcg(1) }); },
         'q 必须是素数', /必须是素数/);
T.throws(function () { L.instance({ q: Q, n: 3 }); },
         '不注入 rng 要抛，而不是偷偷用 Math.random', /rng/);
T.throws(function () { L.randomMatrix(2, 2, 21, lcg(1)); }, '21 = 3·7 不是素数', /必须是素数/);

/* b = A·s + e 的定义本身 */
(function () {
  const inst = L.instance({ n: 3, m: 5, q: Q, rng: lcg(5), bound: 1, noise: true });
  T.eq(inst.A.length, 5, 'A 有 m = 5 行');
  T.eq(inst.A[0].length, 3, 'A 有 n = 3 列');
  T.eq(inst.b.length, 5, 'b 的长度是 m');
  T.ok(inst.e.every(function (v) { return v >= -1 && v <= 1; }), '误差全落在 ±1 内');
  const as = L.mulModQ(inst.A, inst.s, Q);
  inst.b.forEach(function (bi, i) {
    T.eq(bi, C.mod(as[i] + inst.e[i], Q), '第 ' + i + ' 行：b = ⟨a,s⟩ + e (mod q)');
  });
})();

(function () {
  const inst = L.instance({ n: 3, m: 5, q: Q, rng: lcg(5), noise: false });
  T.ok(inst.e.every(function (v) { return v === 0; }), 'noise:false 时误差全是 0');
})();

/* ---- 断言 2 与断言 3：互为对照实验 ----
   同一个求解器、同一批参数，唯一的差别是 e。
     · e = 0   必须**永远**还原 s。做不到，说明坏的是求解器，而不是 LWE 难。
     · e ≠ 0   必须几乎永远还原不了。做得到，说明误差项没干活。
   两条都写在这里，而且下面还有一条断言明确要求它们**不同** —— 一对同进同出的
   数字什么都没有证明。 */
const TRIAL_N = 4, TRIAL_M = 6, TRIAL_COUNT = 500;
const clean = L.trials({ n: TRIAL_N, m: TRIAL_M, q: Q, rng: lcg(31337),
                         noise: false, count: TRIAL_COUNT });
const noisy = L.trials({ n: TRIAL_N, m: TRIAL_M, q: Q, rng: lcg(31337),
                         noise: true, bound: 1, count: TRIAL_COUNT });
M.push('断言 2  n=' + TRIAL_N + ' m=' + TRIAL_M + ' q=' + Q + ' e=0：消元精确还原 s ' +
       clean.fullExact + '/' + clean.count + ' = ' + (clean.fullRate * 100).toFixed(1) + '%' +
       '（其中不相容 ' + clean.inconsistent + '、欠定 ' + clean.underdetermined + '）');
M.push('断言 3  同参数、e ∈ {−1,0,1}：消元精确还原 s ' +
       noisy.fullExact + '/' + noisy.count + ' = ' + (noisy.fullRate * 100).toFixed(2) + '%' +
       '（不相容 ' + noisy.inconsistent + '、解出但解错 ' + noisy.solvedWrong + '）');
M.push('断言 3b 同参数、只取最早 n 行独立方程、不查相容：还原 ' +
       noisy.firstExact + '/' + noisy.count + ' = ' + (noisy.firstRate * 100).toFixed(2) +
       '%；这几行恰好全无误差的次数 ' + noisy.cleanRows +
       '（预言值 (1/3)^' + TRIAL_N + ' × ' + noisy.count + ' ≈ ' +
       (noisy.count / Math.pow(3, TRIAL_N)).toFixed(1) + '）');

/* 断言 2 的**定理形式**。写成 fullRate === 1 是脆的：随机的 A 偶尔秩不足
   （n=4, m=6, q=23 上实测约 1/5000），那时有多个 s 同样满足全部方程，求解器
   如实报 underdetermined —— 那是方程组没有唯一解，不是攻击失败。所以硬断言
   写成"要么精确还原、要么秩不足，二者必居其一，且永远不会不相容"，
   成功率作为实测数字报出来。 */
T.eq(clean.fullExact + clean.underdetermined, clean.count,
     '断言 2：无误差时每一次要么精确还原 s，要么 A 秩不足——没有第三种结局');
T.eq(clean.inconsistent, 0, '断言 2：没有误差时方程组永远相容');
T.eq(clean.solvedWrong, 0, '断言 2：没有误差时不存在"解出来但解错了"');
T.ok(clean.fullRate > 0.99, '断言 2：实测还原率 ' + (clean.fullRate * 100).toFixed(2) + '%');
T.eq(clean.firstRate, clean.fullRate, '断言 2：两种变体在无误差侧一致');

T.ok(noisy.fullRate < 0.02, '断言 3：加上 ±1 的误差后，同一个求解器几乎再也还原不了 s（实测 ' +
     (noisy.fullRate * 100).toFixed(2) + '%）');
T.ok(clean.fullRate - noisy.fullRate > 0.9,
     '两侧必须真的不同 —— 同进同出的一对数字证明不了任何事');

/* 两条**机理**断言。它们把"观察到失败"升级成"理解了失败"——没有它们，
   一个恒返回 null 的坏求解器也能让上面那一行变绿。 */
T.eq(noisy.exactWithNonzeroError, 0,
     '断言 3 的定理形式：误差非零时不可能精确还原 s（否则 e ≡ 0 mod q，而 |e| ≤ 1 < q/2）');
T.eq(noisy.fullExact, noisy.zeroError,
     '断言 3：消元残余的那几次成功，恰好就是 e 整条为零的那几次');
T.eq(noisy.firstExact, noisy.cleanRows,
     '断言 3b：不查相容的变体，成功次数恰好等于"用到的行全无误差"的次数');
M.push('断言 3c 机理  e 整条为零 ' + noisy.zeroError + '/' + noisy.count +
       '（预言 (1/3)^m = (1/3)^' + TRIAL_M + ' × ' + noisy.count + ' ≈ ' +
       (noisy.count / Math.pow(3, TRIAL_M)).toFixed(1) + '）；' +
       '误差非零却还原成功 ' + noisy.exactWithNonzeroError + ' 次（定理上必须是 0）；' +
       '无误差侧秩不足 ' + clean.rankDeficient + ' 次');

/* 更大的 n 让那个 (1/3)ⁿ 落到肉眼可见的零附近——报告里要用到这个数。 */
const noisy8 = L.trials({ n: 8, m: 12, q: 97, rng: lcg(4242), noise: true, bound: 1, count: 500 });
const clean8 = L.trials({ n: 8, m: 12, q: 97, rng: lcg(4242), noise: false, count: 500 });
M.push('断言 2/3 放大  n=8 m=12 q=97：e=0 还原 ' + clean8.fullExact + '/500，' +
       'e≠0 还原 ' + noisy8.fullExact + '/500（不查相容的变体 ' + noisy8.firstExact +
       '/500，预言 (1/3)^8 × 500 ≈ ' + (500 / Math.pow(3, 8)).toFixed(2) + '）');
T.eq(clean8.fullExact + clean8.underdetermined, 500, 'n=8 无误差侧：还原或秩不足，没有第三种');
T.eq(clean8.fullExact, 500, 'n=8 无误差侧实测 500/500 —— 这是对照组');
T.eq(noisy8.fullExact, 0, 'n=8 有误差侧 500 次一次都没还原出 s');
T.eq(noisy8.exactWithNonzeroError, 0, 'n=8 有误差侧同样没有"带着误差还原成功"这种事');

/* 求解器三种结局的形状本身也要被测到，不能只测"对不对"。 */
(function () {
  const A = [[1, 0], [0, 1], [1, 1]];
  T.eq(L.solve(A, [3, 4, 7], 23).s, [3, 4], '相容的超定方程组：唯一解');
  T.eq(L.solve(A, [3, 4, 8], 23).reason, 'inconsistent', '第三行对不上 → 不相容');
  T.eq(L.solve([[1, 1], [2, 2]], [3, 6], 23).reason, 'underdetermined', '秩不足 → 欠定');
  T.eq(L.solve([[1, 1], [2, 2]], [3, 7], 23).reason, 'inconsistent', '秩不足且矛盾 → 不相容优先');
})();

/* ================= 周期：对照面 ================= */
/* 纪律断言：素数模上 periodOf 必须与 diffie-hellman 的 orderOf 逐个相等。
   两份求阶实现之间只有这一条绳子。 */
[7, 11, 13, 23, 41].forEach(function (p) {
  for (let g = 1; g < p; g++) {
    T.eq(L.periodOf(g, p), DH.orderOf(g, p),
         'periodOf(' + g + ', ' + p + ') 必须等于 DH.orderOf');
  }
});

T.eq(L.periodOf(2, 91), 12, '2 在模 91 下的周期是 12');
T.eq(L.periodOf(1, 91), 1, '1 的周期是 1');
T.eq(L.periodOf(7, 91), null, 'gcd(7, 91) = 7 ≠ 1，没有周期可言');
T.throws(function () { L.periodOf(2, 1); }, '模数必须 ≥ 2', /必须 ≥ 2/);

(function () {
  const orb = L.orbit(2, 91, 25);
  T.eq(orb[0], 1, 'a⁰ = 1');
  T.eq(orb.slice(0, 12), [1, 2, 4, 8, 16, 32, 64, 37, 74, 57, 23, 46], '2ˣ mod 91 的一个周期');
  const r = L.periodOf(2, 91);
  for (let x = 0; x + r < orb.length; x++) {
    T.eq(orb[x + r], orb[x], '轨道以 r = ' + r + ' 重复：x = ' + x);
  }
})();

/* Shor 的经典后半段：找到 r 之后，因子由一次 gcd 交出来。 */
(function () {
  const p = L.shorPayload(2, 91);
  T.ok(p.ok, 'a = 2, N = 91：周期法给出真因子');
  T.eq(p.r, 12, 'r = 12');
  T.eq(p.x, 64, '2⁶ = 64');
  T.eq(p.factors.sort(function (a, b) { return a - b; }), [7, 13], '91 = 7 × 13');
  M.push('周期链路  N = 91, a = 2 → r = 12 → 2⁶ = 64 → gcd(63, 91) = 7、gcd(65, 91) = 13');
})();

/* Shor 真实的三种失败模式，各自被认出来而不是被当成 bug。 */
T.eq(L.shorPayload(7, 91).reason, 'not-coprime', 'gcd(a,N) ≠ 1：撞大运，直接得到因子');
T.eq(L.shorPayload(7, 91).factors.sort(function (a, b) { return a - b; }), [7, 13],
     '撞大运那一支也要把因子交出来');
(function () {
  /* N = 15, a = 14：14 ≡ −1 (mod 15)，r = 2，a^(r/2) = 14 = N−1 → 这条路失败。 */
  const p = L.shorPayload(14, 15);
  T.eq(p.reason, 'minus-one', 'a^(r/2) ≡ −1 是 Shor 的一种正常失败');
  T.eq(p.r, 2, 'r = 2');
})();
(function () {
  /* N = 21, a = 4：ord = 3，奇周期 → 这条路失败。 */
  const p = L.shorPayload(4, 21);
  T.eq(p.reason, 'odd-period', '奇周期是 Shor 的另一种正常失败');
  T.eq(p.r, 3, 'r = 3');
})();

/* ================= 一句不能被代码悄悄改掉的话 =================
   本模块的参数是玩具级的。把它钉成断言，免得有人哪天把它当成能用的东西。 */
T.ok(L.detInt(GOOD) < 100 && Q < 100, '这里的格是二维的、q 是两位数——玩具参数，不是可部署方案');

console.log('---- 实测数字 ----');
M.forEach(function (line) { console.log('  ' + line); });

T.report('lattice');
