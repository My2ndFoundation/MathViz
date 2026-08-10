'use strict';
const T = require('../_test.js');
const C = require('../crypto-core.js');
const P = require('./one-time-pad.js');
const EXC = require('../../examples/examples-classical.js');

/* 教学明文取自 examples/：这一页的每一个数字都是在**这几段文本**上量出来的，
   换一段文本就得重新量。用 examples/ 而不是就地造句，是为了让第 1 章与第 4 章
   在同一段文字上对照。 */
function plain(id) {
  for (let i = 0; i < EXC.plaintexts.length; i++) {
    if (EXC.plaintexts[i].id === id) return EXC.plaintexts[i].text.en;
  }
  throw new Error('one-time-pad.test: examples 里没有 "' + id + '"');
}
const T_PANGRAM = plain('pangram');
const T_QUOTE = plain('caesar-quote');
const T_NOTE = plain('cryptanalysis-note');

/* rng 一律注入、种子写死。模块内不碰 Math.random（crypto-core.randomBytes
   直接拒收非函数），测试里同样一处都不用：一个用了 Math.random 的测试今天绿
   明天红，最后必然被加上 retry 或者干脆删掉。 */
const RNG_SEED = 20260810;

/* ================= 地基：XOR 是自己的逆 ================= */
const msg = C.toBytes('ATTACK AT DAWN');
const key = P.makeKey(P.seededRng(RNG_SEED), msg.length);
T.eq(key.length, msg.length, '密钥长度必须等于报文长度');
const ct = P.encrypt(msg, key);
T.eq(Array.from(P.decrypt(ct, key)), Array.from(msg), '再异或一次同一把密钥就回到明文');
T.eq(Array.from(P.encrypt(msg, key)), Array.from(P.decrypt(msg, key)),
     'encrypt 与 decrypt 是同一个运算（这正是这一页要讲的）');

/* 长度不等必须抛，不许截断。悄悄截到短的那一串会画出一次"成功的加密"，
   而后半段明文根本没被动过——一个看上去完全正常的假象。 */
T.throws(function () { P.encrypt(msg, key.slice(0, 5)); },
         '密钥比报文短时必须抛', /长度必须相同/);

/* 种子决定一切：同种子同字节、异种子异字节。前者是可复现的前提，
   后者拦的是"发生器其实没在动"这种最难发现的坏。 */
T.eq(Array.from(P.makeKey(P.seededRng(7), 16)), Array.from(P.makeKey(P.seededRng(7), 16)),
     '同一个种子给出同一串密钥');
T.ok(!T.wouldPass(Array.from(P.makeKey(P.seededRng(7), 16)),
                  Array.from(P.makeKey(P.seededRng(8), 16))),
     '不同种子给出不同的密钥（否则发生器根本没在动）');
T.throws(function () { P.seededRng(1.5); }, '种子必须是整数', /种子必须是整数/);
/* 生成的字节必须真的落在 0–255，且不是一串常数。 */
(function () {
  const k = P.makeKey(P.seededRng(99), 256);
  let bad = 0, distinct = {};
  for (let i = 0; i < k.length; i++) {
    if (!(k[i] >= 0 && k[i] <= 255)) bad++;
    distinct[k[i]] = 1;
  }
  T.eq(bad, 0, '密钥字节全部落在 0–255');
  T.ok(Object.keys(distinct).length > 100, '256 个字节里出现了 100 种以上的值');
})();

/* ================= 事实 1：密钥重用时，密钥自己消掉 =================
   c1 ^ c2 = (p1 ^ k) ^ (p2 ^ k) = p1 ^ p2。
   代数上显然，但这一页整页都建立在它上面，所以在真实语料上**逐字节**量一次。 */
(function () {
  const a = C.toBytes(T_PANGRAM), b = C.toBytes(T_QUOTE);
  const n = Math.min(a.length, b.length);
  T.eq(n, 114, '两段教学明文的公共长度是 114 字节（页面上的数字来自这里）');
  const p1 = a.slice(0, n), p2 = b.slice(0, n);
  const k = P.makeKey(P.seededRng(RNG_SEED), n);
  const c1 = P.encrypt(p1, k), c2 = P.encrypt(p2, k);
  const cmp = P.compare(P.combine(c1, c2), C.xorBytes(p1, p2));
  T.eq(cmp.same, 114, 'C1 ⊕ C2 与 P1 ⊕ P2 有 114 个字节相同');
  T.eq(cmp.equal, true, 'C1 ⊕ C2 === P1 ⊕ P2 —— 密钥一个字节都没剩下');
  T.eq(cmp.firstDiff, -1, '没有任何一处不同');

  /* 反证：换一把密钥加密第二段，密钥就不再消掉。没有这一条，上面那个 equal
     与"compare 恒返回 true"长得一模一样。 */
  const k2 = P.makeKey(P.seededRng(RNG_SEED + 1), n);
  const cmpBad = P.compare(P.combine(c1, P.encrypt(p2, k2)), C.xorBytes(p1, p2));
  T.eq(cmpBad.equal, false, '两段用不同密钥时，异或结果不再等于 P1 ⊕ P2');
  T.ok(cmpBad.same < 20, '不同密钥下相同字节数应当很少（实测 ' + cmpBad.same + '/114）');
})();

/* ================= 事实 2：完美保密是构造性的 =================
   钉住一份密文，任给一段等长候选明文，倒推出所需密钥，再用它解密——
   必须**正好**落回那段候选。

   ⚠ 这个循环有一种非常安静的失败方式：候选如果比密文短、或者列表恰好是空的，
   循环体一次都不执行，而"没有失败"会被报成"全部通过"。所以下面既数了实际
   跑过几个候选（tested），也断言了那个数字。写这条检查的第一版就是这么错的：
   候选全都短于密文，实测跑了**零**个，仍然报成功。 */
(function () {
  const plainBytes = C.toBytes(T_PANGRAM);
  const n = plainBytes.length;
  T.eq(n, 117, '那份钉死的密文是 117 字节');
  const k = P.makeKey(P.seededRng(4242), n);
  const cipher = P.encrypt(plainBytes, k);

  const candidates = [
    new Array(n + 1).join('a'),     // 全是 a：与密文同样相容
    T_QUOTE,                        // 114 字节，补空格
    T_NOTE,                         // 808 字节，截断
    'Meet me at the north bridge at midnight and bring the second envelope with you'
  ];
  let tested = 0, matched = 0;
  for (let i = 0; i < candidates.length; i++) {
    const fit = P.fitBytes(C.toBytes(candidates[i]), n);
    T.eq(fit.bytes.length, n, '候选 ' + i + ' 已经对齐到 ' + n + ' 字节');
    const kNeed = P.keyFor(fit.bytes, cipher);
    const back = P.decrypt(cipher, kNeed);
    const cmp = P.compare(back, fit.bytes);
    tested++;
    if (cmp.equal) matched++;
    T.eq(cmp.same, n, '候选 ' + i + '：解出来的 ' + n + ' 个字节全部等于候选本身');
  }
  T.eq(tested, 4, '循环体真的跑过 4 个候选（不是一个空循环报成功）');
  T.eq(matched, 4, '4 个候选全部与同一份密文相容');

  /* 反证控制：把倒推出的密钥改坏**一个比特**，匹配立刻断掉。 */
  const fit = P.fitBytes(C.toBytes(T_QUOTE), n);
  const kNeed = P.keyFor(fit.bytes, cipher);
  const broken = P.flipBit(kNeed, 7 * 8 + 3);
  const cmpBad = P.compare(P.decrypt(cipher, broken), fit.bytes);
  T.eq(cmpBad.equal, false, '反证控制：密钥翻一个比特之后不再吻合');
  T.eq(cmpBad.same, n - 1, '反证控制：正好差一个字节（' + (n - 1) + '/' + n + '）');
  T.eq(cmpBad.firstDiff, 7, '反证控制：第一处不同落在第 7 个字节');
  /* flipBit 只动一个比特，不动别的。 */
  let diffBits = 0;
  const bitsA = C.toBits(kNeed), bitsB = C.toBits(broken);
  for (let i = 0; i < bitsA.length; i++) if (bitsA[i] !== bitsB[i]) diffBits++;
  T.eq(diffBits, 1, 'flipBit 恰好改了一个比特');

  /* 真正的密钥当然也在这个族里——它没有任何特殊之处，这正是要点。 */
  T.eq(Array.from(P.keyFor(plainBytes, cipher)), Array.from(k),
       '真明文倒推出来的密钥就是当初那把密钥');
})();

/* ================= 事实 3：密文不是文本 =================
   crypto-core 的 fromBytes 在非法 UTF-8 上**抛异常**，不产出 U+FFFD。
   密文是随机字节，所以它一定会抛——这就是"密文一律用 toHex 显示"的理由，
   不是一句风格声明。 */
(function () {
  const plainBytes = C.toBytes(T_PANGRAM);
  const cipher = P.encrypt(plainBytes, P.makeKey(P.seededRng(4242), plainBytes.length));
  T.throws(function () { C.fromBytes(cipher); },
           'fromBytes 在随机密钥的密文上抛错', /fromBytes/);
  /* 而 toHex 一定成功，长度是字节数的两倍。 */
  T.eq(C.toHex(cipher).length, 2 * cipher.length, 'toHex 每个字节两位，永远成功');
  /* 往返恒等式：文本 → 字节 → 文本 不丢东西。第 4 章一切演示的地基。 */
  T.eq(C.fromBytes(C.toBytes(T_PANGRAM)), T_PANGRAM, 'fromBytes(toBytes(s)) === s（英文）');
  const zh = '一次一密：密钥只用一次。';
  T.eq(C.fromBytes(C.toBytes(zh)), zh, 'fromBytes(toBytes(s)) === s（中文，每字 3 字节）');
  T.eq(C.toBytes(zh).length, 3 * zh.length, '中文每个字符占 3 个字节 —— 密钥要按字节算');
})();

/* ================= 三条使用条件被违反时 ================= */
/* ① 密钥比报文短：必然重复，而重复必须被**报出来**。 */
(function () {
  const n = C.toBytes(T_PANGRAM).length;
  const st = P.stretchKey(C.toBytes('PADPADPAD'), n);
  T.eq(st.sourceLen, 9, '短密钥 9 个字节');
  T.eq(st.repeated, true, '密钥比报文短 → repeated 为真');
  T.eq(st.bytes.length, n, '拉长之后长度对齐到报文');
  T.eq(st.bytes[0], st.bytes[9], '第 9 个字节就是第 0 个字节 —— 周期回来了');
  const exact = P.stretchKey(C.toBytes('PADPADPAD'), 9);
  T.eq(exact.repeated, false, '密钥正好够长时 repeated 为假');
})();

/* ② 密钥是英文：结构留在密文里，而且不需要任何统计学就能看见。
   ASCII 的最高位恒为 0，所以 ASCII ⊕ ASCII 的最高位也恒为 0；均匀随机的
   密钥则会让它约一半是 1。这是第 1 章"滚动密钥输在密钥是英文"的字节层版本。 */
(function () {
  const p = C.toBytes(T_PANGRAM);
  const n = p.length;
  const engKey = P.fitBytes(C.toBytes(T_NOTE), n);
  T.eq(engKey.action, 'truncated', '英文密钥文本比报文长，被截断');
  const engCipher = P.encrypt(p, engKey.bytes);
  T.eq(P.stats(engCipher).high, 0, '英文密钥：0 个字节 ≥ 0x80');
  const padCipher = P.encrypt(p, P.makeKey(P.seededRng(4242), n));
  T.eq(P.stats(padCipher).high, 66, '真密钥本（种子 4242）：66/117 个字节 ≥ 0x80');
  T.ok(P.stats(padCipher).high > n * 0.35, '真密钥本让最高位接近一半');
})();

/* ③ 密钥用了两次：拖词把两段明文一起剥开。
   长 crib 稳稳排第一；短 crib 与几十个错误位置并列——**长度**才让一次猜测
   变成证据。下面这些名次全部是实测值，不是估计。 */
(function () {
  const a = C.toBytes(T_PANGRAM), b = C.toBytes(T_QUOTE);
  const n = Math.min(a.length, b.length);
  const p1 = a.slice(0, n), p2 = b.slice(0, n);
  const k = P.makeKey(P.seededRng(RNG_SEED), n);
  const x = P.combine(P.encrypt(p1, k), P.encrypt(p2, k));

  function trial(cribStr) {
    const crib = C.toBytes(cribStr);
    const drags = P.cribDrag(x, crib);
    const order = P.rankByScore(drags);
    const truth = {};
    P.occurrences(p1, crib).forEach(function (o) { truth[o] = 1; });
    P.occurrences(p2, crib).forEach(function (o) { truth[o] = 1; });
    let rank = -1;
    for (let i = 0; i < order.length; i++) {
      if (truth[drags[order[i]].offset]) { rank = i + 1; break; }
    }
    return { drags: drags, order: order, truth: truth, rank: rank, crib: crib };
  }

  /* 11 字节的 crib：真位置排第一，而且掉出来的正是**另一段明文**的那一段。 */
  const fox = trial(' brown fox ');
  T.eq(fox.drags.length, 104, '11 字节的 crib 在 114 字节上有 104 个位置');
  T.eq(fox.rank, 1, '" brown fox " 的真位置排第一');
  const best = fox.drags[fox.order[0]];
  T.eq(best.offset, 9, '真位置是第 9 个字节（P1 里 " brown fox " 就在那儿）');
  T.eq(String.fromCharCode.apply(null, Array.from(best.bytes)), 'saw I conqu',
       '猜中一段，另一段明文自己掉出来 —— 逐字节等于 P2 的同一段');
  T.eq(Array.from(best.bytes), Array.from(p2.slice(9, 9 + fox.crib.length)),
       'derived 与 P2 的那一段逐字节相同');

  /* 9 字节的 crib 同样排第一，而这一次它出现在**第二段**里：拖词分不清
     猜中的是哪一段，两段都是英文，两边对称。 */
  const conq = trial('conquered');
  T.eq(conq.rank, 1, '"conquered" 的真位置排第一');
  T.eq(conq.drags[conq.order[0]].offset, 15, '它在 P2 的第 15 个字节处');
  T.eq(String.fromCharCode.apply(null, Array.from(conq.drags[conq.order[0]].bytes)),
       ' fox jump', '掉出来的是 P1 的那一段');

  /* 3 字节的 crib：真位置只能排到第 3，前面两个都是假的。 */
  const the = trial('the');
  T.eq(the.rank, 3, '"the" 的真位置只排到第 3 —— 短 crib 不构成证据');
  T.eq(the.drags[the.order[0]].score, 1, '第一名（假的）也拿满分 1.000');
  let ties = 0;
  for (let i = 0; i < the.drags.length; i++) if (the.drags[i].score === 1) ties++;
  T.eq(ties, 22, '"the" 有 22 个位置并列满分 —— 并列本身就是"没有信息"');
  /* 对照：长 crib 一个并列都没有。这两个数字并排才有意义——只测短的那个
     会让"并列多"看起来像这把尺子本身的毛病。页面读数印的就是这个计数。 */
  let tiesFox = 0;
  const foxTop = fox.drags[fox.order[0]].score;
  for (let i = 0; i < fox.drags.length; i++) if (fox.drags[i].score === foxTop) tiesFox++;
  T.eq(tiesFox, 1, '" brown fox " 的第一名没有任何并列');
  T.eq(Object.keys(the.truth).length, 5, '"the" 在两段报文里真的出现了 5 处');
  T.eq(Object.keys(fox.truth).length, 1, '" brown fox " 只出现了 1 处');

  /* 排名必须只由分数与 offset 决定（同分按 offset 升序），否则截图第二天就
     对不上。同一份输入连算两次，名次必须逐项相同。 */
  T.eq(P.rankByScore(fox.drags, 8), P.rankByScore(fox.drags, 8), '排名对同一份输入恒定');
})();

/* ================= 入口守卫 =================
   坏参数要在入口就被拒绝，而不是变成一串看着正常的错字节。 */
T.throws(function () { P.cribDrag(C.toBytes('abc'), C.toBytes('')); },
         '空 crib 必须抛', /至少要有一个字节/);
T.throws(function () { P.fitBytes([1, 2, 3], 4); },
         'fitBytes 只收 Uint8Array', /需要 Uint8Array/);
T.throws(function () { P.flipBit(C.toBytes('ab'), 16); },
         'flipBit 的比特下标越界必须抛', /比特下标必须落在/);
T.throws(function () { P.compare(C.toBytes('ab'), C.toBytes('abc')); },
         'compare 的两串长度必须相同', /长度必须相同/);
T.throws(function () { P.makeKey(0.5, 4); },
         'makeKey 的 rng 必须是函数', /需要一个返回/);

/* fitBytes 的三种走向各测一次，并且**补的是空格**（0x20）不是 0：
   补 0 会让候选明文里凭空出现一串控制字符，而那一页要的是"仍然是一段能读的
   文本"。 */
(function () {
  const short = P.fitBytes(C.toBytes('abc'), 6);
  T.eq(short.action, 'padded', '短了就是 padded');
  T.eq(Array.from(short.bytes), [97, 98, 99, 32, 32, 32], '补的是 0x20 空格');
  T.eq(short.origLen, 3, '原长度被记下来了');
  const long = P.fitBytes(C.toBytes('abcdef'), 3);
  T.eq(long.action, 'truncated', '长了就是 truncated');
  T.eq(Array.from(long.bytes), [97, 98, 99], '截断保留前 n 个字节');
  T.eq(P.fitBytes(C.toBytes('abc'), 3).action, 'exact', '正好就是 exact');
})();

/* textScore 的三档权重：字母与空格满分、标点数字 0.35、控制字符 0。
   这几个数字是被拖词的实测排名逼出来的（见上面 "the" 那 33 个并列），
   改动它们就得重新量那些名次。 */
T.eq(P.textScore(C.toBytes('the fox')), 1, '全是字母与空格 → 1');
T.eq(P.textScore(new Uint8Array([0, 1, 2, 3])), 0, '全是控制字符 → 0');
T.eq(P.textScore(new Uint8Array([0x41, 0x00])), 0.5, '一半字母一半控制字符 → 0.5');
T.eq(P.textScore(new Uint8Array([0x2e, 0x2e])), 0.35, '全是标点 → 0.35');
T.eq(P.textScore(new Uint8Array(0)), 0, '空串 → 0（不是 NaN）');

/* occurrences 是页面上那一列"真相"的来源：它必须找全，也不能多找。 */
(function () {
  const hay = C.toBytes('abcabcabc');
  T.eq(P.occurrences(hay, C.toBytes('abc')), [0, 3, 6], '三处全找到');
  T.eq(P.occurrences(hay, C.toBytes('zz')), [], '找不到就是空数组');
  T.eq(P.occurrences(C.toBytes('ab'), C.toBytes('abc')), [], '搜索串比被搜串长 → 空数组');
})();

T.report('one-time-pad');
