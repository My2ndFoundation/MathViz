(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./crypto-core.js'));
  else root.QuantumSim = factory(root.CryptoCore);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* ================================================================
     quantum-sim.js —— 第 5 章「量子时代密码学」的共享核心

     **这是教学模拟器，不是在假装实现真实的量子硬件**（架构规范 §13 原话）。
     它跑的是教科书里那个纯态、无噪声、理想投影测量的模型：
       · 只有纯态，没有密度矩阵、没有退相干、没有信道损耗；
       · 探测器效率 100%、暗计数为 0、没有多光子脉冲；
       · 测量是理想的冯·诺依曼投影，塌缩后的态就是本征矢本身。
     真实的 BB84 里 QBER 有一大部分来自器件而**不是**窃听者，本模块里没有那一部分。
     这句话必须由页面的文案讲出来，否则使用者会带走一个"QBER 不为零就是有 Eve"
     的错误结论——那是这一章最容易被讲反的一件事。写在文件开头，是因为下一个人
     多半是从这段注释开始读的。

     职责表（架构规范 §13）与对应的出口：
       qubit state              qubit / unitQubit / KET
       basis                    BASES / basis()
       measurement              measure / measurePair
       probability              probabilities / probabilityOf / jointProbabilities
       polarisation             fromPolarisation / polarisationAngle / malus
       Bloch sphere coordinates bloch / fromBloch / blochRadius
       BB84 photon state        bb84Photon / bb84Run
       Eve interception         intercept（也是 bb84Run 的 eve 选项）
       QBER                     qberOf（bb84Run 的返回值里带一份）
       entanglement correlation BELL / bellState / jointProbabilities / correlation / chsh

     Bloch 坐标是这个子项目当初保留 3D 子系统的两个理由之一：核心只负责给出
     坐标（x, y, z, theta, phi），怎么画由工具页决定——核心里一行绘图代码都没有。

     刻意**不**做的三件事，写出来免得下一个人以为是漏掉了：
       · **没有 E91 的协议级流程。** 纠缠关联的原语在这里是齐的（贝尔态、联合
         概率、关联函数 E、CHSH），但"双方同角取位 → 反关联翻转 → 抽样验 CHSH"
         那一层属于 crypto-e91 那一页，等它来加。理由与本章不预先建
         examples-quantum.js 完全相同：一个没有消费者的空壳，最后只会逼着校验门
         给它开一条例外。
       · **没有 Grover / Shor。** 那是 crypto-quantum-attacks 的事；它们是多量子
         比特电路，跟这里的单/双比特模型不是同一个东西，硬塞进来会让这个文件
         变成两个模块。
       · **没有混合态 / 密度矩阵。** 一旦引入，测量、Bloch 半径、纠缠判据三处
         全要改写，而第 5 章的五页都用不上。

     随机性纪律：本模块**任何**地方都不调用 Math.random，也不拿时间当种子。
     每一次测量都必须由调用方传入一个返回 [0,1) 的函数。测量就是这一章的主题，
     一个"有时候变红"的测量测试比没有测试更糟；crypto-core 的
     randomBytes(rngFn, n) 与 cryptanalysis 的 rng32 是同一条纪律的先例。
     ================================================================ */

  /* 归一化容差。这个数字是**选**出来的，不是拍的：

     · 下界（不能更小）：本模块的基矢里就有 Math.SQRT1_2，而
       SQRT1_2² + SQRT1_2² === 1.0000000000000002 —— 一个**精确写法**的
       态在双精度下就已经偏了 2.2e-16。容差写 0 的话，|+⟩ 自己都进不了门。
       连续施加酉门还会累积，实测（十个门里随机取一个连着施加，种子固定）：
           100 步 4.0e-15 · 1000 步 2.6e-14 · 20000 步 4.8e-13 · 200000 步 4.8e-12
       —— 大致按 √步数 走的随机游走。教学页面一次交互撑死几百步，离 1e-9
       还差六个数量级；就算跑满 20 万步也还有 200 倍余量。
     · 上界（不能更大）：这个容差要能区分"浮点噪声"与"真的写错了"。真实的
       错误——H 门的 1/√2 写成 0.707（实测一步就把模长打到 0.99970）、漏掉
       一次共轭、基矢少归一化一次——对 |α|²+|β|² 的影响都在 1e-4 到 1 之间，
       比 1e-9 大五个数量级以上。
     1e-9 落在这两条线中间、离两边都有五个数量级以上的余量，所以它既不会误报，
     也不会把真错误放过去。测试与校验门都读这里的 NORM_TOL，不各写各的常数。 */
  const NORM_TOL = 1e-9;

  const SQRT1_2 = Math.SQRT1_2;
  const DEG = Math.PI / 180;

  /* ================= 复数 =================
     只够用的一小组。用 {re, im} 普通对象而不是双元素数组：页面上要把
     α、β 逐个印出来，`amp.re` 比 `amp[0]` 少一次"这个 0 是实部还是第一项"
     的犹豫；代价是每次运算多建一个对象，在这个规模下无所谓。 */
  function cx(re, im) {
    /* 非有限数必须在**产生它的那一步**就抛。放过去的话 NaN 会一路流到概率上，
       而 NaN 参与的比较全为 false：排序、`p < 0`、`u < p0` 全都静静地走另一支，
       页面画出一张看着正常的图。core/_test.js 开头那段注释记的是同一类事故。 */
    if (!Number.isFinite(re) || !Number.isFinite(im)) {
      throw new Error('cx 的实部与虚部必须是有限数，收到 ' + String(re) + ' / ' + String(im));
    }
    return { re: re, im: im };
  }

  function toC(v, name) {
    if (typeof v === 'number') return cx(v, 0);
    if (v && typeof v === 'object' && typeof v.re === 'number' && typeof v.im === 'number') {
      return cx(v.re, v.im);
    }
    throw new Error(name + ' 需要一个数或 {re, im}，收到 ' + JSON.stringify(v));
  }

  function cAdd(p, q) { return cx(p.re + q.re, p.im + q.im); }
  function cSub(p, q) { return cx(p.re - q.re, p.im - q.im); }
  function cMul(p, q) { return cx(p.re * q.re - p.im * q.im, p.re * q.im + p.im * q.re); }
  function cConj(p) { return cx(p.re, -p.im); }
  function cScale(p, k) { return cx(p.re * k, p.im * k); }
  function cAbs2(p) { return p.re * p.re + p.im * p.im; }
  function cAbs(p) { return Math.sqrt(cAbs2(p)); }
  /* e^{iθ}。相位在这里出现得太频繁，写成函数比每处手写 cos/sin 少一个抄错的机会。 */
  function cPhase(theta) { return cx(Math.cos(theta), Math.sin(theta)); }

  /* ================= 单量子比特纯态 =================
     |ψ⟩ = α|0⟩ + β|1⟩，{a, b} 两个复数。 */

  function rawState(a, b) {
    return { a: a, b: b };
  }

  function norm2(state) {
    return cAbs2(state.a) + cAbs2(state.b);
  }

  /* 严格构造：不归一化，不满足 |α|²+|β|² = 1 就抛。
     为什么不"顺手归一化一下"：调用方给出一个非单位向量，几乎总是因为算错了
     （漏了 1/√2、把概率当成了振幅）。悄悄归一化会把这个错变成一个**方向正确、
     大小错误**的态——页面照常画，Bloch 球上的点也照常落在球面上，没有任何
     东西会说哪里不对。要归一化就显式写 unitQubit()。 */
  function qubit(a, b) {
    const s = rawState(toC(a, 'qubit 的 α'), toC(b, 'qubit 的 β'));
    const n = norm2(s);
    if (Math.abs(n - 1) > NORM_TOL) {
      throw new Error('qubit：|α|²+|β|² 必须是 1（容差 ' + NORM_TOL + '），实际 ' + n +
                      '——要自动归一化请显式调用 unitQubit()');
    }
    return s;
  }

  /* 显式归一化构造。零向量没有方向，只能抛——返回 |0⟩ 之类的"默认态"
     等于替调用方猜，而猜错的那一次没人看得见。 */
  function unitQubit(a, b) {
    const s = rawState(toC(a, 'unitQubit 的 α'), toC(b, 'unitQubit 的 β'));
    const n = Math.sqrt(norm2(s));
    if (!(n > 0)) throw new Error('unitQubit：零向量不是量子态，无法归一化');
    return rawState(cScale(s.a, 1 / n), cScale(s.b, 1 / n));
  }

  function assertState(state, name) {
    if (!state || typeof state !== 'object' ||
        !state.a || !state.b ||
        typeof state.a.re !== 'number' || typeof state.b.re !== 'number') {
      throw new Error(name + ' 需要一个 {a:{re,im}, b:{re,im}} 量子态');
    }
    const n = norm2(state);
    if (!(Math.abs(n - 1) <= NORM_TOL)) {
      throw new Error(name + ' 收到的态没有归一化：|α|²+|β|² = ' + n +
                      '（容差 ' + NORM_TOL + '）');
    }
    return state;
  }

  /* 常量态一律冻结。五个工具页共享这一份对象，任何一页顺手改一下 KET.zero.a
     都会污染其它四页，而那种 bug 的现场离原因非常远。冻结的代价是零。 */
  function freezeState(s) {
    Object.freeze(s.a); Object.freeze(s.b);
    return Object.freeze(s);
  }

  const KET = Object.freeze({
    zero:  freezeState(qubit(1, 0)),                        // |0⟩ = H，水平偏振
    one:   freezeState(qubit(0, 1)),                        // |1⟩ = V，垂直偏振
    plus:  freezeState(qubit(SQRT1_2, SQRT1_2)),            // |+⟩ = D，+45°
    minus: freezeState(qubit(-SQRT1_2, SQRT1_2)),           // |−⟩ = A，+135°
    /* 圆偏振。BB84 用不到，六态协议与 Bloch 球的 y 轴要用；把它放进来，
       Bloch 球上才有第三根轴上的实例可指。 */
    right: freezeState(qubit(SQRT1_2, cx(0, SQRT1_2))),     // |R⟩，+y
    left:  freezeState(qubit(SQRT1_2, cx(0, -SQRT1_2)))     // |L⟩，−y
  });

  /* |−⟩ 写成 (−1/√2, +1/√2) 而不是 (+1/√2, −1/√2)：两者只差一个全局相位、
     物理上完全等价，但只有前一个与 fromPolarisation(135°) 的符号约定相同
     （cos135° = −1/√2, sin135° = +1/√2）。页面会把"基矢"与"偏振角"并排显示，
     约定不一致就会凭空多出一个负号要解释。
     （只是"约定相同"，不是逐位相同：Math.cos(135°) 与 −Math.SQRT1_2 差 1 ulp。） */

  /* ================= 基 =================
     每个基是一对正交归一矢。polarisation 是对应的物理偏振角（度）；
     圆偏振没有线偏振角，写 null 而不是随便填一个数。 */
  const BASES = Object.freeze({
    rect: Object.freeze({
      id: 'rect', symbol: '+',
      label: { en: 'Rectilinear', zh: '直线基' },
      vectors: Object.freeze([KET.zero, KET.one]),
      polarisation: Object.freeze([0, 90])
    }),
    diag: Object.freeze({
      id: 'diag', symbol: '×',
      label: { en: 'Diagonal', zh: '对角基' },
      vectors: Object.freeze([KET.plus, KET.minus]),
      polarisation: Object.freeze([45, 135])
    }),
    circ: Object.freeze({
      id: 'circ', symbol: 'O',
      label: { en: 'Circular', zh: '圆偏振基' },
      vectors: Object.freeze([KET.right, KET.left]),
      polarisation: Object.freeze([null, null])
    })
  });

  /* 取不存在的基必须抛，不能返回 undefined。examples.plaintext() 用的是同一条
     规矩：一个 undefined 的基会在 vectors[0] 那里炸出一句跟原因毫无关系的
     "Cannot read properties of undefined"。 */
  function basis(id) {
    const b = BASES[id];
    if (!b) {
      throw new Error('找不到基 ' + JSON.stringify(id) +
                      '，可用的是 ' + Object.keys(BASES).join(' / '));
    }
    return b;
  }

  /* BB84 只用这两个基。写成常量而不是每处现拼数组：它是协议定义的一部分，
     改动它就是改协议（六态协议要加 'circ'），值得有个名字。 */
  const BB84_BASES = Object.freeze(['rect', 'diag']);

  /* ================= 概率与测量 ================= */

  /* 概率的上界只可能被浮点噪声顶破一个 ulp（柯西—施瓦茨给出 p ≤ ‖t‖²·‖ψ‖²，
     而两个模长都已经在入口被断言为 1 ± NORM_TOL），下界根本不可能被破——
     p 是两个实数的平方和。所以这里夹掉的是最后一位的噪声，不是在替某个 bug
     兜底：真正非法的态在 assertState 那里就抛了，走不到这一行。 */
  function clamp01(p) { return p < 0 ? 0 : (p > 1 ? 1 : p); }

  /* 玻恩规则：p = |⟨target|ψ⟩|²。⟨target| 是共轭转置，漏掉共轭在实振幅上
     完全看不出来（第 1–4 章全是实数），到圆偏振与相对相位上才会错。 */
  function probabilityOf(state, target) {
    const s = assertState(state, 'probabilityOf 的 state');
    const t = assertState(target, 'probabilityOf 的 target');
    const amp = cAdd(cMul(cConj(t.a), s.a), cMul(cConj(t.b), s.b));
    return clamp01(cAbs2(amp));
  }

  /* 返回 [p0, p1]。两个概率**各算各的**，不写成 [p0, 1 − p0]：
     后者会让"这个基真的正交归一吗"这条性质永远无法被观测到——基矢抄错一个
     符号时 p0 + p1 就不再是 1，而那正是唯一能发现它的信号。测试与校验门都在
     查这个和。 */
  function probabilities(state, basisId) {
    const B = basis(basisId);
    return [probabilityOf(state, B.vectors[0]), probabilityOf(state, B.vectors[1])];
  }

  /* 取一个随机数并当场校验。
     不夹、直接拒：u === 1 会静静落进"最后一个桶"，而 p0 === 1 时正确答案是
     第 0 个桶——一个只在**确定性测量**上出错的 bug，页面上的表现是"同基测量
     偶尔翻转"，正好把这一章要讲的第一条性质讲反。 */
  function draw(rng, name) {
    if (typeof rng !== 'function') {
      throw new Error(name + ' 需要一个返回 [0,1) 的随机数函数；本模块内不使用 Math.random');
    }
    const u = rng();
    if (typeof u !== 'number' || !(u >= 0) || !(u < 1)) {
      throw new Error(name + ' 的随机数函数返回了 ' + String(u) + '，必须落在 [0,1)');
    }
    return u;
  }

  function bitFrom(u) { return u < 0.5 ? 0 : 1; }

  function choiceFrom(u, arr) {
    if (!Array.isArray(arr) || arr.length === 0) {
      throw new Error('choiceFrom 需要非空数组');
    }
    const i = Math.floor(u * arr.length);
    /* draw() 已经保证 u < 1，所以 i 不可能越界。这里仍然夹一下，是因为
       choiceFrom 也接受调用方自己算出来的 u——把"不可能"写成"就算发生也不越界"，
       比在注释里承诺便宜。 */
    return arr[i >= arr.length ? arr.length - 1 : i];
  }

  function randomBit(rng) { return bitFrom(draw(rng, 'randomBit')); }
  function randomChoice(rng, arr) { return choiceFrom(draw(rng, 'randomChoice'), arr); }

  /* 单次投影测量。塌缩后的态**就是本征矢本身**，不做 |b⟩⟨b|ψ⟩/√p 的除法：
     二维空间里秩 1 投影的结果与本征矢只差一个全局相位，而全局相位不可观测。
     写成除法反而有害——p 极小时除法会把浮点误差放大到肉眼可见。 */
  function measure(state, basisId, rng) {
    const B = basis(basisId);
    const p = probabilities(state, basisId);
    const u = draw(rng, 'measure');
    const outcome = u < p[0] ? 0 : 1;
    return {
      basis: B.id,
      outcome: outcome,
      p: p[outcome],
      probabilities: p,
      state: B.vectors[outcome]
    };
  }

  /* 拦截—重发：Eve 测一次，然后把**塌缩后的**态原样发给 Bob。
     它字面上就是 measure()，独立出来是因为 BB84 那一页要按名字讲这件事，
     而"Eve 的攻击就是一次普通测量"恰恰是那一页的顿悟点——不该让读代码的人
     在 bb84Run 内部才发现这一点。 */
  function intercept(state, basisId, rng) {
    return measure(state, basisId, rng);
  }

  /* ================= 偏振 =================
     物理偏振角 θ 与 Bloch 角是 2:1 的关系：|θ⟩ = cosθ|H⟩ + sinθ|V⟩，
     它在 Bloch 球上落在 (sin2θ, 0, cos2θ)。这个 2 倍是偏振教学里最常被
     绕晕的一处，所以两条方向都只走 bloch()，不各写一份三角函数。 */

  function fromPolarisation(deg) {
    if (!Number.isFinite(deg)) {
      throw new Error('fromPolarisation 的角度必须是有限数，收到 ' + String(deg));
    }
    const r = deg * DEG;
    return qubit(Math.cos(r), Math.sin(r));
  }

  /* 线偏振时返回 [0,180) 度的偏振轴角；圆偏振或椭圆偏振返回 null。
     返回 null 而不是"最接近的线偏振角"：|R⟩ 没有偏振轴，给它编一个角度会让
     Bloch 球上那根本该消失的偏振片指针继续指着某个方向，看上去完全正常。 */
  function polarisationAngle(state) {
    const v = bloch(state);
    if (Math.abs(v.y) > NORM_TOL) return null;      // 有 y 分量 ⇒ 不是线偏振
    let deg = Math.atan2(v.x, v.z) / 2 / DEG;
    if (deg < 0) deg += 180;
    if (deg >= 180) deg -= 180;
    return deg;
  }

  /* 马吕斯定律 p = cos²Δ。经典光学的那条式子与玻恩规则在这里给出同一个数，
     这是第 5 章第一页的桥：测试里有一条断言把两条路径钉在一起。 */
  function malus(deltaDeg) {
    if (!Number.isFinite(deltaDeg)) {
      throw new Error('malus 的角度差必须是有限数，收到 ' + String(deltaDeg));
    }
    const c = Math.cos(deltaDeg * DEG);
    return clamp01(c * c);
  }

  /* ================= Bloch 球坐标 =================
     |ψ⟩ = cos(θ/2)|0⟩ + e^{iφ}sin(θ/2)|1⟩ 时
         x = ⟨σx⟩ = 2·Re(ᾱβ)、y = ⟨σy⟩ = 2·Im(ᾱβ)、z = ⟨σz⟩ = |α|² − |β|²。
     纯态必有 x²+y²+z² = 1；blochRadius() 把这条性质暴露出来，供页面与门检查。
     bloch() 对全局相位免疫（ᾱβ 里两个相位相消），这正是"Bloch 球上的点是射线
     而不是矢量"的那句话在代码里的样子。 */
  function bloch(state) {
    const s = assertState(state, 'bloch');
    const ab = cMul(cConj(s.a), s.b);
    const x = 2 * ab.re;
    const y = 2 * ab.im;
    const z = cAbs2(s.a) - cAbs2(s.b);
    /* acos 的定义域是 [−1,1]，而 z 可能因为浮点误差是 1.0000000000000002，
       那时 acos 返回 NaN——一个只在极点上出现、只在某些态上出现的 NaN。 */
    const zc = z > 1 ? 1 : (z < -1 ? -1 : z);
    return {
      x: x, y: y, z: z,
      theta: Math.acos(zc),
      /* 两极上 φ 无定义；atan2(0,0) === 0，等于选了 φ = 0 这个代表元。
         这是刻意的：页面要画一根从原点到球面的矢量，NaN 会让它整根消失。 */
      phi: Math.atan2(y, x)
    };
  }

  function fromBloch(theta, phi) {
    if (!Number.isFinite(theta) || !Number.isFinite(phi)) {
      throw new Error('fromBloch 的 theta / phi 必须是有限数，收到 ' +
                      String(theta) + ' / ' + String(phi));
    }
    const half = theta / 2;
    /* α 取实非负，是这条射线的规范代表元——否则同一个 (θ,φ) 能造出无穷多个
       只差全局相位的态，往返测试就没法逐位比对。 */
    return unitQubit(Math.cos(half), cScale(cPhase(phi), Math.sin(half)));
  }

  function blochRadius(state) {
    const v = bloch(state);
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  /* ================= 酉门 =================
     2×2 复矩阵 [[m00,m01],[m10,m11]]。第 5 章第一页要在 Bloch 球上演示
     "门 = 绕某根轴转一个角"，所以门必须是核心里的一等公民。 */

  function gate(m00, m01, m10, m11) {
    return Object.freeze([
      Object.freeze([toC(m00, 'gate m00'), toC(m01, 'gate m01')]),
      Object.freeze([toC(m10, 'gate m10'), toC(m11, 'gate m11')])
    ]);
  }

  const GATES = Object.freeze({
    I: gate(1, 0, 0, 1),
    X: gate(0, 1, 1, 0),
    Y: gate(0, cx(0, -1), cx(0, 1), 0),
    Z: gate(1, 0, 0, -1),
    H: gate(SQRT1_2, SQRT1_2, SQRT1_2, -SQRT1_2),
    S: gate(1, 0, 0, cx(0, 1)),
    T: gate(1, 0, 0, cPhase(Math.PI / 4))
  });

  /* 绕三根轴的旋转。R_n(θ) = cos(θ/2)·I − i·sin(θ/2)·σ_n。 */
  function rx(theta) {
    const c = Math.cos(theta / 2), s = Math.sin(theta / 2);
    return gate(c, cx(0, -s), cx(0, -s), c);
  }
  function ry(theta) {
    const c = Math.cos(theta / 2), s = Math.sin(theta / 2);
    return gate(c, -s, s, c);
  }
  function rz(theta) {
    return gate(cPhase(-theta / 2), 0, 0, cPhase(theta / 2));
  }

  /* 只做矩阵乘，**不**检查酉性、**不**重新归一化。
     两条都是刻意的：重新归一化会把一个写错的门矩阵伪装成正确的（模长被强行
     拉回 1，只有相对相位错了，页面照常画）；而酉性检查放在这里会让"长序列后
     模长仍为 1"那道门变成同义反复——它测的就是浮点累积，而累积只有在不被
     纠正时才看得见。要检查矩阵本身，用 isUnitary()，测试里逐个门查过。 */
  function applyGate(state, M) {
    const s = assertState(state, 'applyGate');
    if (!Array.isArray(M) || M.length !== 2 || !Array.isArray(M[0]) || M[0].length !== 2) {
      throw new Error('applyGate 需要 2×2 的复矩阵 [[m00,m01],[m10,m11]]');
    }
    return rawState(
      cAdd(cMul(M[0][0], s.a), cMul(M[0][1], s.b)),
      cAdd(cMul(M[1][0], s.a), cMul(M[1][1], s.b))
    );
  }

  /* M†M = I。给测试与页面用；容差走同一个 NORM_TOL。 */
  function isUnitary(M, tol) {
    const t = tol === undefined ? NORM_TOL : tol;
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        let acc = cx(0, 0);
        for (let k = 0; k < 2; k++) acc = cAdd(acc, cMul(cConj(M[k][i]), M[k][j]));
        const want = (i === j) ? 1 : 0;
        if (Math.abs(acc.re - want) > t || Math.abs(acc.im) > t) return false;
      }
    }
    return true;
  }

  /* ================= 可复现的随机数 =================
     mulberry32，与 cryptanalysis.js 里那个**逐位相同**。这是本仓少见的一处
     有意重复，理由与代价都写在这里：

     · 为什么不复用：复用意味着 quantum-sim 依赖 Cryptanalysis，于是每一个量子
       页面都得把那六百行频率分析（含 IoC 扫描实验）一起内联进去，只为拿七行
       伪随机数；同时内联顺序门要多守一条边（QUANTUM-SIM 必须排在 CRYPTANALYSIS
       之后）。为五个并行开工的页面多加一条会静默失败的加载顺序边，不划算。
     · 为什么这里重复是安全的：本仓禁止重复实现的那条规矩（crypto-core 矩阵那段
       "两份模逆实现总有一天会给出两个答案"）针对的是**答案可能分歧**的实现。
       两份 mulberry32 是不是同一个流，是可判定的——quantum-sim.test.js 里有一条
       断言逐个种子比对两边的输出序列，一分歧当场变红。

     调用方仍然可以传任何返回 [0,1) 的函数；rng32 只是推荐的那一个。 */
  function rng32(seed) {
    let a = seed | 0;
    return function () {
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ================= BB84 ================= */

  /* Alice 要发的那个光子：在基 basisId 下编码比特 bit。 */
  function bb84Photon(bit, basisId) {
    if (bit !== 0 && bit !== 1) {
      throw new Error('bb84Photon 的比特必须是 0 或 1，收到 ' + JSON.stringify(bit));
    }
    return basis(basisId).vectors[bit];
  }

  /* QBER。长度不等必须抛，不许截到短的那一串——理由与 crypto-core 的 xorBytes
     一模一样：截断会给出一个**看上去完全正常**的错误率，而那一页讲的就是
     "这个数字是不是零"。

     compared === 0 时 rate 是 null，不是 0。零个被比对的比特是"没有证据"，
     不是"没有错误"；返回 0 等于在没有任何数据的情况下宣布"信道干净"，
     那是这一章能犯的最坏的一个错。页面拿到 null 要画成"—"。 */
  function qberOf(aliceBits, bobBits) {
    if (!Array.isArray(aliceBits) || !Array.isArray(bobBits)) {
      throw new Error('qberOf 需要两个比特数组');
    }
    if (aliceBits.length !== bobBits.length) {
      throw new Error('qberOf：两串长度必须相同，收到 ' + aliceBits.length +
                      ' 与 ' + bobBits.length);
    }
    let errors = 0;
    for (let i = 0; i < aliceBits.length; i++) {
      if (aliceBits[i] !== bobBits[i]) errors++;
    }
    const compared = aliceBits.length;
    return {
      errors: errors,
      compared: compared,
      rate: compared === 0 ? null : errors / compared
    };
  }

  /* 把筛后密钥转成十六进制。比特数不是 8 的倍数时抛——补零还是丢弃是**调用方
     的决定**（crypto-core 的 fromBits 注释里写着同一条），BB84 的筛后长度本来
     就是随机的，替页面选一种补法等于替它决定密钥的最后几位。 */
  function keyHex(bits) {
    return C.toHex(C.fromBits(bits));
  }

  /* 每个光子固定抽 6 个随机数——**不管这一轮有没有 Eve**。

     这不是浪费，是为了让"打开/关闭 Eve"这个开关只改变一件事。抽样数随 Eve
     有无而变的话，同一个种子下两次运行的 Alice 比特、双方基全都会错位，页面
     上表现为"勾选 Eve，整条光子链换了一批"——使用者根本无从判断多出来的错误
     是 Eve 造成的，还是换了一批光子造成的。而这一页要讲的恰恰是"只有 Eve 变了"。
     测试里有一条断言把这条性质钉住：同种子下 eve:true 与 eve:false 两次运行的
     aliceBits / aliceBases / bobBases 三者逐位相同。 */
  const DRAWS_PER_PHOTON = 6;

  function bb84Run(opts) {
    const o = opts || {};
    const n = o.n;
    if (!Number.isInteger(n) || n <= 0) {
      throw new Error('bb84Run 的 n 必须是正整数，收到 ' + String(n));
    }
    const rng = o.rng;
    if (typeof rng !== 'function') {
      throw new Error('bb84Run 需要注入 rng（返回 [0,1) 的函数）；本模块内不使用 Math.random');
    }
    const bases = o.bases || BB84_BASES;
    /* 只有一个基的"协议"筛选率恒为 1、错误率恒为 0——页面上看起来是完美成功，
       实际上什么也没保护。这是个手滑就能造出来的配置，所以在入口拒绝。 */
    if (!Array.isArray(bases) || bases.length < 2) {
      throw new Error('bb84Run 至少需要两个基，收到 ' + JSON.stringify(bases) +
                      '——只有一个基时筛选率恒为 1、QBER 恒为 0，看着成功其实毫无安全性');
    }
    bases.forEach(function (id) { basis(id); });      // 未知基当场抛
    /* 重复的基与"只有一个基"是同一个病：['rect','rect'] 长度是 2、每个 id 也都
       合法，但双方永远同基，筛选率恒为 1、QBER 恒为 0——页面上是一片完美的绿。
       长度检查拦不住它，所以单列一条。 */
    if (new Set(bases).size !== bases.length) {
      throw new Error('bb84Run 的基不能重复，收到 ' + JSON.stringify(bases) +
                      '——重复的基让双方永远同基，筛选率恒为 1、QBER 恒为 0');
    }
    const eve = !!o.eve;

    const photons = [];
    const siftedIndices = [], siftedAlice = [], siftedBob = [];
    for (let i = 0; i < n; i++) {
      const u = new Array(DRAWS_PER_PHOTON);
      for (let k = 0; k < DRAWS_PER_PHOTON; k++) u[k] = draw(rng, 'bb84Run');

      const aliceBit = bitFrom(u[0]);
      const aliceBasis = choiceFrom(u[1], bases);
      const sent = bb84Photon(aliceBit, aliceBasis);

      let inFlight = sent;
      let eveRec = null;
      if (eve) {
        const eveBasis = choiceFrom(u[2], bases);
        const m = intercept(inFlight, eveBasis, function () { return u[3]; });
        eveRec = { basis: eveBasis, outcome: m.outcome, p: m.p };
        inFlight = m.state;                            // 重发的是塌缩后的态
      }

      const bobBasis = choiceFrom(u[4], bases);
      const bm = measure(inFlight, bobBasis, function () { return u[5]; });

      const sifted = bobBasis === aliceBasis;
      const error = sifted && bm.outcome !== aliceBit;
      if (sifted) {
        siftedIndices.push(i);
        siftedAlice.push(aliceBit);
        siftedBob.push(bm.outcome);
      }
      photons.push({
        index: i,
        aliceBit: aliceBit, aliceBasis: aliceBasis, sent: sent,
        eve: eveRec, received: inFlight,
        bobBasis: bobBasis, bobBit: bm.outcome,
        sifted: sifted, error: error
      });
    }

    return {
      n: n, bases: bases.slice(), eve: eve,
      photons: photons,
      sifted: {
        indices: siftedIndices,
        alice: siftedAlice,
        bob: siftedBob,
        length: siftedAlice.length
      },
      siftRate: siftedAlice.length / n,
      qber: qberOf(siftedAlice, siftedBob)
    };
  }

  /* ================= 纠缠 =================
     双比特纯态写成 4 个复振幅，下标 = 2·a + b（a 是 Alice 那一位）。 */

  function bellVector(c00, c01, c10, c11) {
    return Object.freeze([
      Object.freeze(cx(c00, 0)), Object.freeze(cx(c01, 0)),
      Object.freeze(cx(c10, 0)), Object.freeze(cx(c11, 0))
    ]);
  }

  const BELL = Object.freeze({
    'phi+': bellVector(SQRT1_2, 0, 0, SQRT1_2),
    'phi-': bellVector(SQRT1_2, 0, 0, -SQRT1_2),
    'psi+': bellVector(0, SQRT1_2, SQRT1_2, 0),
    /* 单态。E91 用的就是它：任何**同一个**方向上两边必然反关联，
       且这条性质与方向无关（单态是旋转不变的）。 */
    'psi-': bellVector(0, SQRT1_2, -SQRT1_2, 0)
  });

  function bellState(id) {
    const s = BELL[id];
    if (!s) {
      throw new Error('找不到贝尔态 ' + JSON.stringify(id) +
                      '，可用的是 ' + Object.keys(BELL).join(' / '));
    }
    return s;
  }

  function assertPair(pair, name) {
    if (!Array.isArray(pair) || pair.length !== 4) {
      throw new Error(name + ' 需要 4 个复振幅的双比特态');
    }
    let n = 0;
    for (let i = 0; i < 4; i++) n += cAbs2(toC(pair[i], name + ' 的第 ' + i + ' 个振幅'));
    if (!(Math.abs(n - 1) <= NORM_TOL)) {
      throw new Error(name + ' 收到的双比特态没有归一化：Σ|c|² = ' + n);
    }
    return pair;
  }

  /* 分析器：Bloch 球 x–z 平面上角度 theta 的那对本征矢。
     用 Bloch 角而不是物理偏振角，是因为 CHSH 的那组经典角度（0、π/2、π/4、3π/4）
     在教科书里就是按 Bloch 角给的；要用偏振角的页面自己乘 2。 */
  function analyser(theta) {
    if (!Number.isFinite(theta)) {
      throw new Error('analyser 的角度必须是有限数，收到 ' + String(theta));
    }
    const c = Math.cos(theta / 2), s = Math.sin(theta / 2);
    return [qubit(c, s), qubit(-s, c)];
  }

  /* 联合概率 [p00, p01, p10, p11]。
     振幅 = Σ_{m,n} conj(u_i[m])·conj(v_j[n])·Ψ[2m+n]。 */
  function jointProbabilities(pair, thetaA, thetaB) {
    assertPair(pair, 'jointProbabilities 的 pair');
    const U = analyser(thetaA), V = analyser(thetaB);
    const out = [];
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        let amp = cx(0, 0);
        for (let m = 0; m < 2; m++) {
          for (let nn = 0; nn < 2; nn++) {
            const u = m === 0 ? U[i].a : U[i].b;
            const v = nn === 0 ? V[j].a : V[j].b;
            amp = cAdd(amp, cMul(cMul(cConj(u), cConj(v)), pair[2 * m + nn]));
          }
        }
        out.push(clamp01(cAbs2(amp)));
      }
    }
    return out;
  }

  /* 关联函数 E = p00 + p11 − p01 − p10，落在 [−1, 1]。
     单态在这里的解析值是 −cos(θa − θb)，测试里逐点比对过。 */
  function correlation(pair, thetaA, thetaB) {
    const p = jointProbabilities(pair, thetaA, thetaB);
    return p[0] + p[3] - p[1] - p[2];
  }

  /* CHSH 的经典角度组。单态在这组角度下 S = −2√2，|S| 超过经典上界 2 —— 这
     就是 E91 判"信道里真有纠缠、没有被替换成经典关联"的依据。 */
  const CHSH_ANGLES = Object.freeze({
    a: 0, aP: Math.PI / 2, b: Math.PI / 4, bP: 3 * Math.PI / 4
  });

  function chsh(pair, angles) {
    const g = angles || CHSH_ANGLES;
    return correlation(pair, g.a, g.b) - correlation(pair, g.a, g.bP)
         + correlation(pair, g.aP, g.b) + correlation(pair, g.aP, g.bP);
  }

  /* 一次联合测量。四个结果按累积概率分桶；最后一桶兜住浮点残差——
       Σp 可能是 0.9999999999999999，此时 u = 0.99999999999999995 不落在任何
       一桶里，靠 fallthrough 归给最后一个，而不是返回 undefined。 */
  function measurePair(pair, thetaA, thetaB, rng) {
    const p = jointProbabilities(pair, thetaA, thetaB);
    const u = draw(rng, 'measurePair');
    let acc = 0, idx = 3;
    for (let k = 0; k < 3; k++) {
      acc += p[k];
      if (u < acc) { idx = k; break; }
    }
    const i = idx >> 1, j = idx & 1;
    const U = analyser(thetaA), V = analyser(thetaB);
    return {
      a: i, b: j, index: idx, p: p[idx], probabilities: p,
      stateA: U[i], stateB: V[j]
    };
  }

  return {
    NORM_TOL: NORM_TOL,
    /* 复数 */
    cx: cx, cAdd: cAdd, cSub: cSub, cMul: cMul, cConj: cConj,
    cScale: cScale, cAbs: cAbs, cAbs2: cAbs2, cPhase: cPhase,
    /* 态与基 */
    qubit: qubit, unitQubit: unitQubit, norm2: norm2, KET: KET,
    BASES: BASES, basis: basis, BB84_BASES: BB84_BASES,
    /* 概率与测量 */
    probabilityOf: probabilityOf, probabilities: probabilities,
    measure: measure, intercept: intercept,
    randomBit: randomBit, randomChoice: randomChoice, rng32: rng32,
    /* 偏振 */
    fromPolarisation: fromPolarisation, polarisationAngle: polarisationAngle, malus: malus,
    /* Bloch */
    bloch: bloch, fromBloch: fromBloch, blochRadius: blochRadius,
    /* 门 */
    GATES: GATES, gate: gate, rx: rx, ry: ry, rz: rz,
    applyGate: applyGate, isUnitary: isUnitary,
    /* BB84 */
    bb84Photon: bb84Photon, bb84Run: bb84Run, qberOf: qberOf, keyHex: keyHex,
    DRAWS_PER_PHOTON: DRAWS_PER_PHOTON,
    /* 纠缠 */
    BELL: BELL, bellState: bellState, analyser: analyser,
    jointProbabilities: jointProbabilities, correlation: correlation,
    CHSH_ANGLES: CHSH_ANGLES, chsh: chsh, measurePair: measurePair
  };
});
