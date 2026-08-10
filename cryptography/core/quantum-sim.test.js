'use strict';
const T = require('./_test.js');
const Q = require('./quantum-sim.js');
const C = require('./crypto-core.js');
const A = require('./cryptanalysis.js');

/* 本文件里**没有一处** Math.random、Date.now 或任何隐式时间源。check.py 的
   "确定性种子"门会把这个文件跑两遍、逐字节比对两次的输出——所以任何不确定
   的东西都会当场变红，包括打印顺序。凡是打印出来的数都要么是精确值，要么是
   固定种子下的固定值。 */
const TOL = Q.NORM_TOL;

/* ================= 复数 ================= */
T.eq(Q.cx(1, -2), { re: 1, im: -2 }, 'cx 建复数');
T.eq(Q.cMul(Q.cx(0, 1), Q.cx(0, 1)), { re: -1, im: 0 }, 'i·i = −1');
T.eq(Q.cConj(Q.cx(3, 4)), { re: 3, im: -4 }, '共轭翻虚部符号');
T.eq(Q.cAbs2(Q.cx(3, 4)), 25, '|3+4i|² = 25');
T.eq(Q.cAbs(Q.cx(3, 4)), 5, '|3+4i| = 5');
T.eq(Q.cAdd(Q.cx(1, 2), Q.cx(-1, 5)), { re: 0, im: 7 }, '复数加法');
T.eq(Q.cSub(Q.cx(1, 2), Q.cx(-1, 5)), { re: 2, im: -3 }, '复数减法');
T.eq(Q.cScale(Q.cx(1, 2), 3), { re: 3, im: 6 }, '实数缩放');
T.ok(Math.abs(Q.cPhase(Math.PI).re + 1) < TOL, 'e^{iπ} 的实部是 −1');
/* 非有限数必须在产生它的那一步抛。放过去的话 NaN 会一路流到概率上，
   而 NaN 参与的比较全为 false——排序与分桶会静静走另一支。 */
T.throws(function () { Q.cx(NaN, 0); }, 'cx 拒绝 NaN', /有限数/);
T.throws(function () { Q.cx(0, Infinity); }, 'cx 拒绝 Infinity', /有限数/);
T.throws(function () { Q.qubit('1', 0); }, 'toC 拒绝字符串', /需要一个数/);

/* ================= 态的构造 ================= */
T.eq(Q.norm2(Q.KET.zero), 1, '|0⟩ 的模方是 1');
T.ok(Math.abs(Q.norm2(Q.KET.plus) - 1) <= TOL, '|+⟩ 的模方在容差内是 1');
/* 这一条是 NORM_TOL 不能为 0 的直接证据：一个**精确写法**的态在双精度下
   就已经偏了 2.2e-16。 */
T.ok(Q.norm2(Q.KET.plus) !== 1, '|+⟩ 的模方并不精确等于 1（SQRT1_2² 的浮点残差）');
T.throws(function () { Q.qubit(1, 1); }, 'qubit 拒绝未归一化的态', /必须是 1/);
T.throws(function () { Q.unitQubit(0, 0); }, 'unitQubit 拒绝零向量', /零向量/);
T.ok(Math.abs(Q.norm2(Q.unitQubit(3, 4)) - 1) <= TOL, 'unitQubit 显式归一化');
T.ok(Math.abs(Q.unitQubit(3, 4).a.re - 0.6) <= TOL, 'unitQubit(3,4) 的 α 是 0.6');
/* 常量态被冻结：五个页面共享同一份对象，任何一页改了它都会污染其余四页。 */
T.ok(Object.isFrozen(Q.KET.zero) && Object.isFrozen(Q.KET.zero.a), 'KET 常量态被冻结');

/* ================= 基的正交归一 =================
   这一组不是形式主义：基矢抄错一个符号时，probabilities() 的两个分量就不再
   加到 1，而那是唯一能发现它的信号。 */
Object.keys(Q.BASES).forEach(function (id) {
  const B = Q.basis(id);
  T.ok(Math.abs(Q.probabilityOf(B.vectors[0], B.vectors[0]) - 1) <= TOL,
       id + ' 的第 0 个基矢自投影为 1');
  T.ok(Math.abs(Q.probabilityOf(B.vectors[1], B.vectors[1]) - 1) <= TOL,
       id + ' 的第 1 个基矢自投影为 1');
  T.ok(Q.probabilityOf(B.vectors[0], B.vectors[1]) <= TOL,
       id + ' 的两个基矢正交');
  T.ok(B.label && B.label.en && B.label.zh, id + ' 有双语 label');
});
T.eq(Q.BB84_BASES.slice(), ['rect', 'diag'], 'BB84 用直线基与对角基');
T.throws(function () { Q.basis('nope'); }, '未知基要抛', /找不到基/);

/* ================= 概率 ================= */
T.eq(Q.probabilities(Q.KET.zero, 'rect'), [1, 0], '|0⟩ 在直线基下确定给出 0');
T.eq(Q.probabilities(Q.KET.one, 'rect'), [0, 1], '|1⟩ 在直线基下确定给出 1');
const pDiag = Q.probabilities(Q.KET.zero, 'diag');
T.ok(Math.abs(pDiag[0] - 0.5) <= TOL && Math.abs(pDiag[1] - 0.5) <= TOL,
     '|0⟩ 在对角基下五五开——共轭基之间完全不确定');
/* 全部基 × 全部常量态：概率必须落在 [0,1] 且成对加到 1。
   check.py 的概率门跑的是同一条性质的更大网格，这里先在 node 分支上钉住。 */
Object.keys(Q.BASES).forEach(function (id) {
  Object.keys(Q.KET).forEach(function (k) {
    const p = Q.probabilities(Q.KET[k], id);
    T.ok(p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1,
         k + ' 在 ' + id + ' 下的两个概率都落在 [0,1]');
    T.ok(Math.abs(p[0] + p[1] - 1) <= TOL, k + ' 在 ' + id + ' 下概率和为 1');
  });
});

/* ================= 偏振：玻恩规则 == 马吕斯定律 =================
   这是第 5 章第一页的桥。两条完全不同的路径必须给出同一个数字：
   经典的 cos²Δ 与量子的 |⟨θb|θa⟩|²。 */
for (let a = 0; a < 180; a += 15) {
  for (let b = 0; b < 180; b += 15) {
    const p = Q.probabilityOf(Q.fromPolarisation(a), Q.fromPolarisation(b));
    T.ok(Math.abs(p - Q.malus(a - b)) <= TOL,
         '玻恩规则与马吕斯定律一致：' + a + '° → ' + b + '°');
  }
}
T.eq(Q.malus(0), 1, 'malus(0) = 1');
T.ok(Math.abs(Q.malus(90)) <= TOL, 'malus(90) = 0');
T.ok(Q.malus(135) >= 0, 'malus 永不为负（cos² 而不是 cos）');
T.throws(function () { Q.malus(NaN); }, 'malus 拒绝 NaN', /有限数/);

/* 偏振角往返。fromPolarisation 与 polarisationAngle 都只走 Bloch 坐标，
   所以这一条同时钉住了"物理偏振角与 Bloch 角是 2:1"这件事。 */
for (let deg = 0; deg < 180; deg += 5) {
  const back = Q.polarisationAngle(Q.fromPolarisation(deg));
  T.ok(Math.abs(back - deg) <= 1e-9, '偏振角往返 ' + deg + '° → ' + back);
}
T.eq(Q.polarisationAngle(Q.KET.right), null, '圆偏振没有偏振轴，返回 null');
T.eq(Q.polarisationAngle(Q.KET.left), null, '左旋圆偏振同上');
T.eq(Q.polarisationAngle(Q.KET.plus), 45, '|+⟩ 就是 +45° 线偏振');
T.eq(Q.polarisationAngle(Q.KET.minus), 135, '|−⟩ 就是 +135° 线偏振');
/* |−⟩ 与 fromPolarisation(135°) 必须**符号约定相同**，不能差一个全局相位：
   页面会把"基矢"与"偏振角"并排显示，多一个负号就要多一句解释。
   逐位相等做不到，也不该要求——Math.cos(135°) 与 −Math.SQRT1_2 差 1 ulp
   （−0.7071067811865475 对 −0.7071067811865476）。要钉的是符号，不是最后一位。 */
const m135 = Q.fromPolarisation(135);
T.ok(Math.abs(Q.KET.minus.a.re - m135.a.re) <= TOL &&
     Math.abs(Q.KET.minus.b.re - m135.b.re) <= TOL,
     '|−⟩ 与 fromPolarisation(135°) 的符号约定一致（不差全局相位）');
T.ok(Q.KET.minus.a.re < 0 && Q.KET.minus.b.re > 0, '|−⟩ 写成 (−1/√2, +1/√2)');

/* ================= Bloch 球坐标 ================= */
T.eq(Q.bloch(Q.KET.zero).z, 1, '|0⟩ 在北极');
T.eq(Q.bloch(Q.KET.one).z, -1, '|1⟩ 在南极');
T.ok(Math.abs(Q.bloch(Q.KET.plus).x - 1) <= TOL, '|+⟩ 在 +x');
T.ok(Math.abs(Q.bloch(Q.KET.minus).x + 1) <= TOL, '|−⟩ 在 −x');
T.ok(Math.abs(Q.bloch(Q.KET.right).y - 1) <= TOL, '|R⟩ 在 +y');
T.ok(Math.abs(Q.bloch(Q.KET.left).y + 1) <= TOL, '|L⟩ 在 −y');
Object.keys(Q.KET).forEach(function (k) {
  T.ok(Math.abs(Q.blochRadius(Q.KET[k]) - 1) <= TOL, k + ' 落在 Bloch 球面上');
});
/* 往返：(θ,φ) → 态 → (x,y,z) 必须回到原处。两极上 φ 无定义，所以比的是
   直角坐标而不是角度。 */
for (let ti = 0; ti <= 8; ti++) {
  for (let pi = 0; pi < 8; pi++) {
    const th = ti * Math.PI / 8, ph = pi * Math.PI / 4;
    const v = Q.bloch(Q.fromBloch(th, ph));
    T.ok(Math.abs(v.x - Math.sin(th) * Math.cos(ph)) <= 1e-12 &&
         Math.abs(v.y - Math.sin(th) * Math.sin(ph)) <= 1e-12 &&
         Math.abs(v.z - Math.cos(th)) <= 1e-12,
         'Bloch 往返 θ=' + ti + 'π/8 φ=' + pi + 'π/4');
  }
}
/* 全局相位不可观测：e^{iγ}|ψ⟩ 与 |ψ⟩ 是 Bloch 球上的同一个点。
   这条性质正是 measure() 可以直接返回本征矢、不做 |b⟩⟨b|ψ⟩/√p 除法的依据。 */
const gamma = 0.987;
const phased = Q.qubit(Q.cMul(Q.cPhase(gamma), Q.KET.plus.a),
                       Q.cMul(Q.cPhase(gamma), Q.KET.plus.b));
const v0 = Q.bloch(Q.KET.plus), v1 = Q.bloch(phased);
T.ok(Math.abs(v0.x - v1.x) <= TOL && Math.abs(v0.y - v1.y) <= TOL &&
     Math.abs(v0.z - v1.z) <= TOL, 'Bloch 坐标对全局相位免疫');
T.throws(function () { Q.bloch({ a: Q.cx(1, 0), b: Q.cx(1, 0) }); },
         'bloch 拒绝未归一化的态', /没有归一化/);
T.throws(function () { Q.fromBloch(NaN, 0); }, 'fromBloch 拒绝 NaN', /有限数/);

/* ================= 酉门 ================= */
Object.keys(Q.GATES).forEach(function (k) {
  T.ok(Q.isUnitary(Q.GATES[k]), k + ' 门是酉的');
});
[0.3, 1.1, -2.2].forEach(function (t) {
  T.ok(Q.isUnitary(Q.rx(t)) && Q.isUnitary(Q.ry(t)) && Q.isUnitary(Q.rz(t)),
       '旋转门在 θ=' + t + ' 上是酉的');
});
/* 一个写错的门必须被 isUnitary 抓住——否则上面那一圈断言什么也没证明。 */
T.ok(!Q.isUnitary(Q.gate(0.707, 0.707, 0.707, -0.707)),
     'isUnitary 认得出 1/√2 被写成 0.707 的 H 门（负控）');
const h0 = Q.applyGate(Q.KET.zero, Q.GATES.H);
T.ok(Math.abs(Q.probabilityOf(h0, Q.KET.plus) - 1) <= TOL, 'H|0⟩ = |+⟩');
T.ok(Math.abs(Q.probabilityOf(Q.applyGate(h0, Q.GATES.H), Q.KET.zero) - 1) <= TOL,
     'H·H = I');
T.ok(Math.abs(Q.probabilityOf(Q.applyGate(Q.KET.zero, Q.GATES.X), Q.KET.one) - 1) <= TOL,
     'X|0⟩ = |1⟩');
T.ok(Math.abs(Q.probabilityOf(Q.applyGate(Q.KET.plus, Q.GATES.Z), Q.KET.minus) - 1) <= TOL,
     'Z|+⟩ = |−⟩');
T.throws(function () { Q.applyGate(Q.KET.zero, [[1, 0]]); },
         'applyGate 拒绝形状不对的矩阵', /2×2/);

/* 序列后的归一化。单次施加看不出累积——这一条必须跑一长串。
   固定种子、固定门序列，所以这个数字每次都一样。 */
const GATE_SEQ = [Q.GATES.H, Q.GATES.X, Q.GATES.Y, Q.GATES.Z, Q.GATES.S, Q.GATES.T,
                  Q.rx(0.7), Q.ry(1.3), Q.rz(2.1), Q.rx(-0.37)];
const seqRng = Q.rng32(20260810);
let seqState = Q.KET.zero;
let seqWorst = 0;
for (let i = 0; i < 20000; i++) {
  seqState = Q.applyGate(seqState, Q.randomChoice(seqRng, GATE_SEQ));
  const d = Math.abs(Q.norm2(seqState) - 1);
  if (d > seqWorst) seqWorst = d;
}
T.ok(seqWorst <= TOL, '20000 步随机门序列后模方仍在容差内（实测偏差 ' +
                      seqWorst.toExponential(3) + '，容差 ' + TOL + '）');
T.ok(seqWorst > 0, '偏差确实非零——这条断言不是在比较 1 和 1');

/* ================= 随机数 =================
   与 cryptanalysis.rng32 必须是**同一个流**。这条断言是本模块有意重复
   mulberry32 的唯一护栏：两份实现一旦分歧，这里当场变红。 */
[0, 1, -1, 20260810, 2147483647, -2147483648].forEach(function (seed) {
  const mine = Q.rng32(seed), theirs = A.rng32(seed);
  const x = [], y = [];
  for (let i = 0; i < 64; i++) { x.push(mine()); y.push(theirs()); }
  T.eq(x, y, 'rng32 与 cryptanalysis.rng32 在种子 ' + seed + ' 上逐位相同');
});
T.throws(function () { Q.measure(Q.KET.zero, 'rect', null); },
         '测量必须注入 rng', /Math.random/);
T.throws(function () { Q.measure(Q.KET.zero, 'rect', function () { return 1; }); },
         'rng 返回 1 要拒（落在 [0,1) 之外）', /\[0,1\)/);
T.throws(function () { Q.measure(Q.KET.zero, 'rect', function () { return -0.1; }); },
         'rng 返回负数要拒', /\[0,1\)/);

/* ================= 单次测量 ================= */
/* 同基测量是确定性的：|0⟩ 在直线基下，无论 rng 给什么都必须是 0。
   这一条不依赖统计，所以它比下面那条频率断言更硬。 */
[0, 0.25, 0.5, 0.75, 0.999999].forEach(function (u) {
  T.eq(Q.measure(Q.KET.zero, 'rect', function () { return u; }).outcome, 0,
       'u=' + u + ' 时 |0⟩ 在直线基下仍然给出 0');
});
T.eq(Q.measure(Q.KET.one, 'rect', function () { return 0; }).outcome, 1,
     '|1⟩ 在直线基下给出 1');
/* 塌缩后的态就是本征矢本身。 */
T.eq(Q.measure(Q.KET.plus, 'rect', function () { return 0.9; }).state, Q.KET.one,
     '塌缩后的态是本征矢');
/* 共轭基下五五开。样本量 20000、期望 0.5，标准差 √(0.25/20000) = 0.00354；
   容差取 5σ，写成样本量的函数而不是一个魔数。 */
const MEAS_N = 20000;
const measSd = Math.sqrt(0.25 / MEAS_N);
const measRng = Q.rng32(991);
let ones = 0;
for (let i = 0; i < MEAS_N; i++) {
  if (Q.measure(Q.KET.zero, 'diag', measRng).outcome === 1) ones++;
}
T.ok(Math.abs(ones / MEAS_N - 0.5) <= 5 * measSd,
     '|0⟩ 在对角基下 ' + MEAS_N + ' 次测量给出 ' + ones + ' 个 1（' +
     (ones / MEAS_N).toFixed(5) + '，容差 5σ = ' + (5 * measSd).toFixed(5) + '）');

/* ================= BB84 ================= */
T.eq(Q.bb84Photon(0, 'rect'), Q.KET.zero, 'BB84 光子：直线基的 0 就是 |0⟩');
T.eq(Q.bb84Photon(1, 'diag'), Q.KET.minus, 'BB84 光子：对角基的 1 就是 |−⟩');
T.throws(function () { Q.bb84Photon(2, 'rect'); }, '比特只能是 0 或 1', /0 或 1/);
T.throws(function () { Q.bb84Run({ n: 0, rng: Q.rng32(1) }); }, 'n 必须为正', /正整数/);
T.throws(function () { Q.bb84Run({ n: 10 }); }, 'bb84Run 必须注入 rng', /Math.random/);
T.throws(function () { Q.bb84Run({ n: 10, rng: Q.rng32(1), bases: ['rect'] }); },
         '只有一个基的"协议"要拒', /至少需要两个基/);
/* 长度够但重复，是同一个病的另一副样子：双方永远同基，筛选率恒为 1、
   QBER 恒为 0，页面上一片完美的绿。长度检查拦不住它。 */
T.throws(function () { Q.bb84Run({ n: 10, rng: Q.rng32(1), bases: ['rect', 'rect'] }); },
         '重复的基要拒', /不能重复/);
T.throws(function () { Q.bb84Run({ n: 10, rng: Q.rng32(1), bases: ['rect', 'nope'] }); },
         '未知的基要拒', /找不到基/);
/* 六态协议（加上圆偏振基）是同一段代码的合法配置，筛选率降到约 1/3。 */
const sixState = Q.bb84Run({ n: 3000, rng: Q.rng32(7), bases: ['rect', 'diag', 'circ'] });
T.ok(Math.abs(sixState.siftRate - 1 / 3) <= 5 * Math.sqrt((1 / 3) * (2 / 3) / 3000),
     '三个基时筛选率降到约 1/3（实测 ' + sixState.siftRate.toFixed(5) + '）');
T.eq(sixState.qber.rate, 0, '六态协议无 Eve 时 QBER 同样恰好为 0');

const BB_N = 20000;
const BB_SEEDS = [20260810, 7, 991];
BB_SEEDS.forEach(function (seed) {
  const clean = Q.bb84Run({ n: BB_N, rng: Q.rng32(seed), eve: false });
  const spied = Q.bb84Run({ n: BB_N, rng: Q.rng32(seed), eve: true });

  /* 先钉住"有东西可比"。compared === 0 时 QBER 是 null 而不是 0，但一条
     只写 `rate === 0` 的断言在一个**空**的筛后密钥上照样能绿——本仓两次
     把这种真空探针当成结论发出去过。 */
  T.ok(clean.qber.compared > 1000,
       '种子 ' + seed + '：筛后有 ' + clean.qber.compared + ' 个比特可比');
  T.eq(clean.qber.rate, 0,
       '种子 ' + seed + '：无 Eve 时筛后密钥逐位相同，QBER 恰好为 0');
  T.eq(clean.qber.errors, 0, '种子 ' + seed + '：无 Eve 时零错误');

  /* 拦截—重发的期望 QBER 是 25%：Eve 有一半的机会选对基（此时无害），
     另一半 Bob 的结果完全随机、其中一半出错 → 0.5 × 0.5 = 0.25。
     容差按样本量算，不是魔数：p=0.25 时 σ = √(0.1875/compared)，取 6σ。 */
  const qSd = Math.sqrt(0.25 * 0.75 / spied.qber.compared);
  T.ok(Math.abs(spied.qber.rate - 0.25) <= 6 * qSd,
       '种子 ' + seed + '：有 Eve 时 QBER = ' + spied.qber.rate.toFixed(5) +
       '（期望 0.25，容差 6σ = ' + (6 * qSd).toFixed(5) + '）');

  /* 基对账保留约一半光子。Eve 不影响这个比例——她的基选择跟 Alice/Bob
     的基是否相同毫无关系，所以两次运行的筛选率必须**完全相同**。 */
  const sSd = Math.sqrt(0.25 / BB_N);
  T.ok(Math.abs(clean.siftRate - 0.5) <= 6 * sSd,
       '种子 ' + seed + '：筛选率 = ' + clean.siftRate.toFixed(5) +
       '（期望 0.5，容差 6σ = ' + (6 * sSd).toFixed(5) + '）');
  T.eq(spied.siftRate, clean.siftRate,
       '种子 ' + seed + '：Eve 不改变筛选率');

  /* 开关 Eve 只改变一件事。这条性质是 DRAWS_PER_PHOTON 恒为 6 的全部理由：
     抽样数随 Eve 有无而变的话，同一种子下整条光子链会错位，页面上就分不清
     多出来的错误是 Eve 造成的还是换了一批光子造成的。 */
  let aligned = true;
  for (let i = 0; i < BB_N; i++) {
    const p = clean.photons[i], s = spied.photons[i];
    if (p.aliceBit !== s.aliceBit || p.aliceBasis !== s.aliceBasis ||
        p.bobBasis !== s.bobBasis) { aligned = false; break; }
  }
  T.ok(aligned, '种子 ' + seed + '：开关 Eve 后 Alice 比特 / 双方基逐位不变');
});
T.eq(Q.DRAWS_PER_PHOTON, 6, '每个光子固定抽 6 个随机数');

/* 无 Eve 时，未筛掉的那一半才是随机的——若不筛选，错误率会跳到 25%。
   这条是上面"QBER 恰好为 0"的负控：它证明那个 0 来自基对账，
   而不是来自"这个模拟器根本不会出错"。 */
const noSift = Q.bb84Run({ n: BB_N, rng: Q.rng32(20260810), eve: false });
let allErr = 0;
noSift.photons.forEach(function (p) { if (p.bobBit !== p.aliceBit) allErr++; });
T.ok(Math.abs(allErr / BB_N - 0.25) <= 6 * Math.sqrt(0.25 * 0.75 / BB_N),
     '不做基对账时错误率跳到 ' + (allErr / BB_N).toFixed(5) + '（期望 0.25）——' +
     '上面那个"QBER = 0"确实来自筛选');

/* QBER 本身 */
T.eq(Q.qberOf([0, 1, 0], [0, 0, 0]), { errors: 1, compared: 3, rate: 1 / 3 }, 'qberOf 计数');
T.eq(Q.qberOf([], []).rate, null,
     '零个比特可比时 rate 是 null 而不是 0——没有证据不等于没有错误');
T.eq(Q.qberOf([], []).compared, 0, '空比对的 compared 是 0');
T.throws(function () { Q.qberOf([0, 1], [0]); }, '长度不等要抛，不许截断', /长度必须相同/);
T.throws(function () { Q.qberOf('01', '01'); }, 'qberOf 只收数组', /比特数组/);

/* keyHex 走的是 crypto-core 的 fromBits + toHex —— 这也是本模块在浏览器分支里
   捕获 root.CryptoCore 的唯一用处，内联顺序门守的就是它。 */
T.eq(Q.keyHex([1, 0, 0, 0, 1, 1, 0, 1]), '8d', 'keyHex 高位在前');
T.eq(Q.keyHex(C.toBits(C.fromHex('cafe'))), 'cafe', 'keyHex 与 crypto-core 往返一致');
T.throws(function () { Q.keyHex([1, 0, 1]); },
         '比特数不是 8 的倍数要抛（补零是调用方的决定）', /8 的整数倍/);

/* ================= 纠缠 ================= */
Object.keys(Q.BELL).forEach(function (id) {
  const p = Q.jointProbabilities(Q.bellState(id), 0.3, 1.1);
  T.ok(p.every(function (x) { return x >= 0 && x <= 1; }), id + ' 的四个联合概率都在 [0,1]');
  T.ok(Math.abs(p[0] + p[1] + p[2] + p[3] - 1) <= TOL, id + ' 的联合概率和为 1');
});
T.throws(function () { Q.bellState('phi'); }, '未知贝尔态要抛', /找不到贝尔态/);
T.throws(function () { Q.jointProbabilities([1, 0, 0, 0.5], 0, 0); },
         '未归一化的双比特态要抛', /没有归一化/);

/* 单态的解析关联是 E(θa, θb) = −cos(θa − θb)，且只依赖角度差（旋转不变）。
   这条式子是 E91 的全部数学内容，逐点比对。 */
for (let i = 0; i <= 12; i++) {
  for (let j = 0; j <= 12; j++) {
    const ta = i * Math.PI / 6, tb = j * Math.PI / 6;
    const e = Q.correlation(Q.BELL['psi-'], ta, tb);
    T.ok(Math.abs(e + Math.cos(ta - tb)) <= 1e-12,
         '单态关联 E(' + i + 'π/6, ' + j + 'π/6) = −cos(Δ)');
    T.ok(e >= -1 - TOL && e <= 1 + TOL, '关联落在 [−1,1]');
  }
}
/* 同角必然反关联，这是 E91 能生成密钥的依据。 */
T.ok(Math.abs(Q.correlation(Q.BELL['psi-'], 1.234, 1.234) + 1) <= TOL,
     '单态在同一方向上完全反关联');

const S = Q.chsh(Q.BELL['psi-']);
T.ok(Math.abs(Math.abs(S) - 2 * Math.SQRT2) <= 1e-12,
     '单态在经典角度组下 |S| = 2√2 = ' + (2 * Math.SQRT2).toFixed(12) +
     '（实测 ' + S.toFixed(12) + '）');
T.ok(Math.abs(S) > 2, '|S| 超过经典上界 2 —— 这正是 E91 的判据');

/* 可分离态必须守住经典上界。这是上面那条的负控：若 chsh() 对任何态都给出
   2√2，上面那条断言什么也没证明。 */
function product(u, v) {
  return [Q.cMul(u.a, v.a), Q.cMul(u.a, v.b), Q.cMul(u.b, v.a), Q.cMul(u.b, v.b)];
}
let worstProduct = 0;
for (let i = 0; i < 12; i++) {
  for (let j = 0; j < 12; j++) {
    const u = Q.analyser(i * Math.PI / 6)[0], v = Q.analyser(j * Math.PI / 6)[0];
    const s = Math.abs(Q.chsh(product(u, v)));
    if (s > worstProduct) worstProduct = s;
  }
}
T.ok(worstProduct <= 2 + 1e-12,
     '可分离态的 |S| 最大只到 ' + worstProduct.toFixed(12) + '，不超过经典上界 2');

/* 联合测量的频率必须收敛到联合概率。固定种子、样本量 20000、5σ 容差。 */
const PAIR_N = 20000;
const pairRng = Q.rng32(20260810);
const pairAngles = [0, Math.PI / 3];
const wanted = Q.jointProbabilities(Q.BELL['psi-'], pairAngles[0], pairAngles[1]);
const seen = [0, 0, 0, 0];
for (let i = 0; i < PAIR_N; i++) {
  seen[Q.measurePair(Q.BELL['psi-'], pairAngles[0], pairAngles[1], pairRng).index]++;
}
for (let k = 0; k < 4; k++) {
  const sd = Math.sqrt(wanted[k] * (1 - wanted[k]) / PAIR_N);
  T.ok(Math.abs(seen[k] / PAIR_N - wanted[k]) <= 5 * sd,
       '联合测量频率收敛：桶 ' + k + ' 实测 ' + (seen[k] / PAIR_N).toFixed(5) +
       '，期望 ' + wanted[k].toFixed(5));
}
const mp = Q.measurePair(Q.BELL['psi-'], 0, 0, function () { return 0.5; });
T.ok(mp.a !== mp.b, '同角单态的联合测量必然一个 0 一个 1');
T.throws(function () { Q.analyser(Infinity); }, 'analyser 拒绝非有限角', /有限数/);

/* ================= 浏览器加载路径 =================
   上面每一条走的都是 node 分支（module.exports + require）。页面里跑的是
   **另一条**：没有 module、没有 require，模块把自己挂到 root.QuantumSim，
   并在**加载时**捕获 root.CryptoCore。两条分支只有一条被覆盖过，而本仓出事的
   一直是没被覆盖的那条（examples.test.js 与 check.py 的 ALGOS 求值门各为同一个
   理由立过一道门）。

   注意：`node -e` 与 node 从 stdin 读脚本**都会**定义 module 与 require，
   那样测出来的仍然是 node 分支。只有 vm 的裸上下文才走另一条。 */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const SRC = {
  core: fs.readFileSync(path.join(__dirname, 'crypto-core.js'), 'utf8'),
  quantum: fs.readFileSync(path.join(__dirname, 'quantum-sim.js'), 'utf8')
};

function browserContext() {
  const sandbox = {};
  sandbox.self = sandbox;          // 页面里 self === window
  return vm.createContext(sandbox);
}

const ctx = browserContext();
vm.runInContext(SRC.core, ctx);
vm.runInContext(SRC.quantum, ctx);
T.ok(ctx.module === undefined && ctx.require === undefined,
     '沙箱是干净的：没有 module / require，测的确实是浏览器分支');
T.ok(!!ctx.QuantumSim, '浏览器分支下模块挂到了 root.QuantumSim');
T.eq(ctx.QuantumSim.NORM_TOL, Q.NORM_TOL, '两条分支的 NORM_TOL 是同一个值');
T.eq(ctx.QuantumSim.probabilities(ctx.QuantumSim.KET.zero, 'rect'), [1, 0],
     '浏览器分支下的测量概率与 node 分支一致');
T.eq(ctx.QuantumSim.keyHex([1, 0, 0, 0, 1, 1, 0, 1]), '8d',
     '浏览器分支下 keyHex 能用——它捕获到了 root.CryptoCore');
const bbBrowser = ctx.QuantumSim.bb84Run({ n: 2000, rng: ctx.QuantumSim.rng32(7), eve: true });
const bbNode = Q.bb84Run({ n: 2000, rng: Q.rng32(7), eve: true });
T.eq(bbBrowser.qber, bbNode.qber, '两条分支跑出同一个 BB84 结果');

/* 顺序反过来的后果必须被写下来：模块**照样挂得上**，直到第一次调用 keyHex
   才炸。这就是 check.py 第 9 道门（内联顺序）存在的全部理由——语法门、内联门
   都看不见它，因为它们各自的前提都是"模块已经正确加载"。 */
const lone = browserContext();
vm.runInContext(SRC.quantum, lone);
T.ok(!!lone.QuantumSim, '没有 CryptoCore 时 QuantumSim 仍然挂得上（这正是危险之处）');
T.eq(lone.QuantumSim.probabilities(lone.QuantumSim.KET.plus, 'diag')[0], 1,
     '不碰 CryptoCore 的功能照常工作，页面加载时毫无征兆');
T.throws(function () { lone.QuantumSim.keyHex([1, 0, 0, 0, 1, 1, 0, 1]); },
         '要到第一次调用 keyHex 才炸——内联顺序门守的就是这一刻', /undefined/);

T.report('quantum-sim');
