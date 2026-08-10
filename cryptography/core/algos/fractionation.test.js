'use strict';
const T = require('../_test.js');
const PB = require('./polybius.js');
const F = require('./fractionation.js');

/* ---- 教科书向量：Delastelle 的 bifid ----
   方阵直接把 25 个字母当关键词喂进 makeSquare：它们互不重复，去重后原样落格，
   于是这里用的就是文献里印的那一张随机方阵，而不是"差不多的一张"。 */
const WSQ = PB.makeSquare('BGWKZQPNDSIOAXEFCLUMTHYVR');
T.eq(WSQ.cells.join(''), 'BGWKZQPNDSIOAXEFCLUMTHYVR', '25 个字母当关键词时方阵原样落格');
T.eq(F.bifidEncrypt('FLEEATONCE', WSQ, 0), 'UAEOLWRINS', 'bifid 教科书向量（整段一个块）');
T.eq(F.bifidDecrypt('UAEOLWRINS', WSQ, 0), 'FLEEATONCE', 'bifid 教科书向量解密');
/* period 大于文本长度与 period = 0 是同一件事：都只有一个块，不做任何填充。 */
T.eq(F.bifidEncrypt('FLEEATONCE', WSQ, 99), 'UAEOLWRINS', 'period 超过文本长度 = 整段一个块');

/* ---- 教科书向量：Delastelle 的 trifid（周期 5）---- */
const CUBE = F.makeCube('FELIX MARIE DELASTELLE');
T.eq(CUBE.cells.join(''), 'FELIXMARDSTBCGHJKNOPQUVWYZ.', '立方体按关键词去重后补齐 27 格');
T.eq(F.trifidEncrypt('AIDE TOI, LE CIEL TAIDERA', CUBE, 5), 'FMJFVOISSUFTFPUFEQQC',
     'trifid 教科书向量，周期 5');
T.eq(F.trifidDecrypt('FMJFVOISSUFTFPUFEQQC', CUBE, 5), 'AIDETOILECIELTAIDERA',
     'trifid 教科书向量解密');

/* ---- period = 1 的退化：这一条是整个工具页的立论 ----
   块长 1 时行、列两个数字读出来还是原来的次序，配回去就是原来那个字母。
   于是 bifid(period 1) 与"用方阵编码再解码"逐字符相同——正是波利比乌斯那一页
   已经证明过可破的那次代换，一点强度都没有加上去。 */
const SQ = PB.makeSquare('CIPHER');
const SAMPLE = 'ATTACK AT DAWN';
const SAMPLE_N = PB.normalizeFor(SAMPLE, 5);
T.eq(F.bifidEncrypt(SAMPLE, SQ, 1), PB.decode(PB.encode(SAMPLE, SQ), SQ),
     'period 1 的 bifid 等于方阵编码再解码（一次代换）');
T.eq(F.bifidEncrypt(SAMPLE, SQ, 1), SAMPLE_N,
     'period 1 的密文就是规范化后的明文本身——恒等代换');
const LONG = 'The quick brown fox jumps over the lazy dog and then runs away';
T.eq(F.bifidEncrypt(LONG, SQ, 1), PB.normalizeFor(LONG, 5), 'period 1 在长文本上同样是恒等');
/* 反过来：period >= 2 一定不再是恒等，否则"周期是旋钮"这句话就是空的。 */
T.ok(F.bifidEncrypt(LONG, SQ, 2) !== PB.normalizeFor(LONG, 5), 'period 2 已经不是恒等');
T.ok(F.bifidEncrypt(LONG, SQ, 0) !== PB.normalizeFor(LONG, 5), '整段一个块也不是恒等');

/* ---- 往返：bifid / trifid / 分行 bifid ---- */
const PLAIN_N = PB.normalizeFor(LONG, 5);
for (let p = 0; p <= 13; p++) {
  T.eq(F.bifidDecrypt(F.bifidEncrypt(LONG, SQ, p), SQ, p), PLAIN_N,
       'bifid 往返 period=' + p);
  T.eq(F.seriatedBifidDecrypt(F.seriatedBifidEncrypt(LONG, SQ, p), SQ, p), PLAIN_N,
       '分行 bifid 往返 period=' + p);
}
const CUBE_PLAIN = F.normalizeCube(LONG);
for (let p = 0; p <= 13; p++) {
  T.eq(F.trifidDecrypt(F.trifidEncrypt(LONG, CUBE, p), CUBE, p), CUBE_PLAIN,
       'trifid 往返 period=' + p);
}
/* 长度守恒：一个填充字符都没有（与 polybius / ADFGX 同一条纪律）。 */
T.eq(F.bifidEncrypt(LONG, SQ, 7).length, PLAIN_N.length, 'bifid 密文长度 = 明文字母数');
T.eq(F.trifidEncrypt(LONG, CUBE, 7).length, CUBE_PLAIN.length, 'trifid 密文长度 = 明文字母数');
T.eq(F.seriatedBifidEncrypt(LONG, SQ, 7).length, PLAIN_N.length, '分行 bifid 密文长度 = 明文字母数');
/* 6 阶方阵没有 I/J 合并，J 活着穿过全程。 */
const SQ6 = PB.makeSquare('CIPHER', { size: 6 });
T.eq(F.bifidDecrypt(F.bifidEncrypt('JAM SESSION 42', SQ6, 5), SQ6, 5), 'JAMSESSION42',
     '6 阶方阵下 J 与数字都活着往返');
T.eq(F.bifidEncrypt('JAM', SQ, 5), F.bifidEncrypt('IAM', SQ, 5),
     '5 阶方阵下 J 在第一步就变成 I（与 polybius 同一笔定价）');

/* ---- 空输入与单字母 ---- */
T.eq(F.bifidEncrypt('', SQ, 5), '', '空明文出空密文');
T.eq(F.trifidEncrypt('!!!', CUBE, 5), '', '没有字母就没有密文');
T.eq(F.bifidEncrypt('A', SQ, 5), 'A', '单个字母：块长 1，恒等');
T.eq(F.blocksOf(0, 5).length, 0, '零长度没有块');
T.eq(F.blocksOf(7, 3), [{ start: 0, len: 3 }, { start: 3, len: 3 }, { start: 6, len: 1 }],
     '末块可以是短的，不填充');

/* ================= structure()：形状层的独立推导 =================
   structure 只看 n / period / 维数，不看方阵也不看文本。它与真算法是两条
   独立的推导，所以下面这批断言是真的在对撞，而不是拿一份结果验它自己。 */

/* dest 逐位与真密文对撞：把明文第 i 个字母的第 h 个坐标，按 trace 说的位置
   去密文里取出来，必须等于那一位的坐标。这一条钉住的是"画面上那条线指对了"。 */
function assertDestMatches(tr, square, label) {
  let checked = 0;
  for (let i = 0; i < tr.n; i++) {
    for (let h = 0; h < tr.dims; h++) {
      const out = tr.dest[i * tr.dims + h];
      const slot = tr.slot[i * tr.dims + h];
      const cc = PB.coordsOf(tr.cipher.charAt(out), square);
      const mine = h === 0 ? tr.coords[i].row : tr.coords[i].col;
      const theirs = slot === 0 ? cc.row : cc.col;
      if (mine !== theirs) {
        T.ok(false, label + '：第 ' + i + ' 个字母的第 ' + h + ' 个坐标没落在 dest 说的位置');
        return;
      }
      checked++;
    }
  }
  T.ok(checked === tr.n * tr.dims, label + '：' + checked + ' 个坐标半全部落在 dest 说的位置');
}
for (let p = 1; p <= 9; p++) assertDestMatches(F.bifidTrace(LONG, SQ, p), SQ, 'bifid dest period=' + p);
assertDestMatches(F.bifidTrace(LONG, SQ, 0), SQ, 'bifid dest 整段一个块');
for (let p = 1; p <= 9; p++) assertDestMatches(F.seriatedTrace(LONG, SQ, p), SQ, '分行 dest period=' + p);

/* srcOf 是 dest 的逆：密文第 k 个字母的第 s 个坐标，来自 srcOf[k][s] 那个明文
   字母的第 srcHalf[k][s] 个坐标。两张表必须互相指得回去。 */
(function () {
  const tr = F.bifidTrace(LONG, SQ, 7);
  let ok = true;
  for (let k = 0; k < tr.n; k++) {
    for (let s = 0; s < tr.dims; s++) {
      const i = tr.srcOf[k][s], h = tr.srcHalf[k][s];
      if (tr.dest[i * tr.dims + h] !== k || tr.slot[i * tr.dims + h] !== s) ok = false;
    }
  }
  T.ok(ok, 'srcOf / srcHalf 是 dest / slot 的逆');
})();

/* ---- 影响集：改一个明文字母，密文里到底有几个位置会变 ----
   这是"扩散"这个词唯一诚实的量法：把第 i 个字母换成方阵里其余每一个字母，
   把所有变过的密文位置并起来。它必须与 structure 算出的 touch[i] 逐位相同。 */
function influenceByExperiment(plain, square, period) {
  const base = F.bifidEncrypt(plain, square, period);
  const out = [];
  for (let i = 0; i < plain.length; i++) {
    const hit = Object.create(null);
    for (let z = 0; z < square.cells.length; z++) {
      const alt = square.cells[z];
      if (alt === plain.charAt(i)) continue;
      const cm = F.bifidEncrypt(plain.slice(0, i) + alt + plain.slice(i + 1), square, period);
      for (let k = 0; k < base.length; k++) if (cm.charAt(k) !== base.charAt(k)) hit[k] = 1;
    }
    out.push(Object.keys(hit).map(Number).sort(function (a, b) { return a - b; }));
  }
  return out;
}
(function () {
  const short = PB.normalizeFor('ATTACK AT DAWN AGAIN', 5);   // 17 个字母，实验跑得动
  for (let p = 1; p <= 6; p++) {
    const exp = influenceByExperiment(short, SQ, p);
    const st = F.structure(short.length, p, 2);
    T.eq(exp, st.touch, '实测影响集 == structure().touch  period=' + p);
  }
})();

/* ---- 影响集大小：period 1 是 1，其余恒为 2 ----
   这条不是"越大越多"。一个字母只有两个坐标，最多碰到两个密文字母；
   真正随周期长大的是**两个落点之间的距离**（span）与**纠缠成一团的字母数**
   （comp）。工具页上的文案必须说这一条，而不是"影响的字母越来越多"。 */
(function () {
  const n = 60;
  T.eq(F.structure(n, 1, 2).maxTouch, 1, 'period 1：一个字母只碰到一个密文字母（就是它自己）');
  for (let p = 2; p <= 12; p++) {
    const st = F.structure(n, p, 2);
    T.eq(st.maxTouch, 2, 'period ' + p + '：一个字母碰到 2 个密文字母');
    T.eq(st.meanTouch, 2, 'period ' + p + '：每一个字母都碰到 2 个，没有例外');
  }
  T.eq(F.structure(n, 1, 3).maxTouch, 1, 'trifid period 1 同样只碰到 1 个');
  T.eq(F.structure(n, 2, 3).maxTouch, 2, 'trifid period 2：三个坐标挤进 2 个密文字母');
  for (let p = 3; p <= 12; p++) {
    T.eq(F.structure(n, p, 3).maxTouch, 3, 'trifid period ' + p + '：碰到 3 个密文字母');
  }
})();

/* ---- 两个落点的距离：随周期线性长大 ----
   块长 L 时，第 j 个字母的两个坐标在数字流里相距 L，落点相距
   floor((L+j)/2) − floor(j/2)。首字母（j = 0）就是 floor(L/2)——**不是**
   ceil：数字流下标从 0 起，第 0 个坐标落在密文第 0 个字母上。
   第一次写这条断言时写的是 ceil，测试当场判红，这行注释是那次的收据。 */
(function () {
  const n = 120;
  for (let p = 1; p <= 12; p++) {
    const st = F.structure(n, p, 2);
    T.eq(st.span[0], Math.floor(p / 2), 'period ' + p + '：首字母两半的落点相距 floor(p/2)');
  }
  T.eq(F.structure(n, 1, 2).span[0], 0, 'period 1：两半落在同一个字母上，距离 0');
  /* 逐字母核对同一条式子，免得"首字母对了"被当成"整段都对了"。 */
  (function () {
    const p = 7, st = F.structure(n, p, 2);
    let ok = true;
    for (let j = 0; j < p; j++) {
      if (st.span[j] !== Math.floor((p + j) / 2) - Math.floor(j / 2)) ok = false;
    }
    T.ok(ok, 'period 7：块内每个字母的落点距离都合式子');
  })();
})();

/* ---- 纠缠：奇偶锯齿 ----
   comp[i] 是"跟第 i 个字母连在一起的明文字母有几个"（密文字母把它的来源
   连成一条边，取连通分量）。奇数周期把整块连成一体；**偶数周期恒为 2**，
   再大也不长——偶数块里行段与列段对齐，(r0,r1) 与 (c0,c1) 配的是同一对字母，
   第二次配对一条新边都没带来。ACA 教材"周期取奇数"那句经验之谈就是这个。 */
(function () {
  const n = 120;
  for (let p = 1; p <= 13; p++) {
    const want = (p % 2 === 1) ? p : 2;
    T.eq(F.structure(n, p, 2).comp[0], want,
         'bifid period ' + p + ' 的纠缠分量大小 = ' + want);
  }
  /* trifid 的同一条规律换成模 3：周期是 3 的倍数时塌回 3。 */
  for (let p = 1; p <= 13; p++) {
    const want = (p % 3 === 0) ? 3 : p;
    T.eq(F.structure(n, p, 3).comp[0], want,
         'trifid period ' + p + ' 的纠缠分量大小 = ' + want);
  }
})();

/* structure() 与 trace() 必须给出同一份 touch/comp——工具页画的是 trace，
   测的是 structure，两者错开一次就够让画面与结论各说各话。 */
(function () {
  const tr = F.bifidTrace(LONG, SQ, 5);
  const st = F.structure(tr.n, 5, 2);
  T.eq(tr.touch, st.touch, 'trace.touch === structure().touch');
  T.eq(tr.comp, st.comp, 'trace.comp === structure().comp');
})();

/* ================= 分行 bifid ================= */

/* 定义即断言：分行 bifid 的每一竖对，就是对那两个字母做一次 period = 2 的 bifid。
   period = 1 时上下两行各 1 个字母，竖对就是相邻两个字母，于是它**整体退化成
   period 2 的 bifid**——这一条把"我到底实现了什么"钉死在纸面上。 */
T.eq(F.seriatedBifidEncrypt(LONG, SQ, 1), F.bifidEncrypt(LONG, SQ, 2),
     '分行 period 1 == bifid period 2');
(function () {
  /* 一般情形：把明文按 seriation 重排成 上0,下0,上1,下1,… 之后做 period 2 的
     bifid，结果必须与分行 bifid 逐字符相同（末尾那个没有对手的字母除外，
     它在两种写法里都原样穿过，但落点不同，所以这里挑一段长度是 2·period
     整数倍的明文）。 */
  const p = 4;
  const src = PB.normalizeFor(LONG, 5).slice(0, 8 * p);   // 32 个字母，正好 4 组
  const series = F.seriesOf(src.length, p);
  let woven = '';
  for (let s = 0; s < series.length; s++) {
    const S = series[s];
    for (let i = 0; i < S.top; i++) {
      woven += src.charAt(S.start + i);
      if (i < S.bot) woven += src.charAt(S.start + S.top + i);
    }
  }
  T.eq(F.seriatedBifidEncrypt(src, SQ, p), F.bifidEncrypt(woven, SQ, 2),
       '分行 bifid == 重排后的 period 2 bifid');
})();

/* 落单的那个字母是真的原样穿过——不许四舍五入成"差不多加密了"。 */
(function () {
  const odd = PB.normalizeFor('ATTACKATDAWNX', 5);        // 13 个字母，period 3 → 末组落单
  const tr = F.seriatedTrace(odd, SQ, 3);
  T.ok(tr.unpaired.length > 0, '奇数尾巴会留下没有对手的字母');
  for (let z = 0; z < tr.unpaired.length; z++) {
    const i = tr.unpaired[z];
    T.eq(tr.cipher.charAt(tr.dest[i * 2]), odd.charAt(i),
         '落单的第 ' + i + ' 个字母原样出现在密文里');
    T.eq(tr.comp[i], 1, '落单字母的纠缠分量是 1');
  }
  for (let i = 0; i < tr.n; i++) {
    if (tr.partner[i] >= 0) T.eq(tr.partner[tr.partner[i]], i, '配对是对称的：' + i);
  }
})();

/* ================= 立方体自身 ================= */
T.eq(F.cubeCoordsOf('F', CUBE), { a: 0, b: 0, c: 0, index: 0, ch: 'F' }, '首格坐标是 (0,0,0)');
T.eq(F.cubeCharAt(0, 0, 0, CUBE), 'F', 'charAt 与 coordsOf 互逆');
T.eq(F.cubeCharAt(2, 2, 2, CUBE), '.', '末格是第 27 个符号');
T.eq(F.cubeCoordsOf('?', CUBE), null, '不在池子里的字符没有坐标');
T.eq(F.cubeCharAt(3, 0, 0, CUBE), null, '越界是正常的"没有这一格"');
T.throws(function () { F.cubeCharAt(1.5, 0, 0, CUBE); },
         '非整数坐标当场抛，不产出 undefined', /整数/);
T.throws(function () { F.trace('nope', 'A', CUBE, 3); },
         'trace 的 kind 只有三个值', /kind/);
(function () {
  const c2 = F.makeCube('');
  T.eq(c2.cells.join(''), F.CUBE_POOL, '空关键词就是池子本身');
  T.eq(c2.cells.length, 27, '立方体恒有 27 格');
  const c3 = F.makeCube('BALLOON');
  T.eq(c3.cells.slice(0, 5).join(''), 'BALON', '关键词先填、重复的只留一次');
  T.eq(c3.cells.length, 27, '去重之后仍然是 27 格');
})();

/* trace 的三条路都能从统一入口拿到，且与直呼各自的函数同一个结果。 */
T.eq(F.trace('bifid', 'ATTACK', SQ, 3).cipher, F.bifidTrace('ATTACK', SQ, 3).cipher,
     'trace("bifid") 与 bifidTrace 一致');
T.eq(F.trace('trifid', 'ATTACK', CUBE, 3).cipher, F.trifidTrace('ATTACK', CUBE, 3).cipher,
     'trace("trifid") 与 trifidTrace 一致');
T.eq(F.trace('seriated', 'ATTACK', SQ, 3).cipher, F.seriatedTrace('ATTACK', SQ, 3).cipher,
     'trace("seriated") 与 seriatedTrace 一致');

T.report('fractionation');
