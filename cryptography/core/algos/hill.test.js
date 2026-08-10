'use strict';
const T = require('../_test.js');
const C = require('../crypto-core.js');
const hill = require('./hill.js');
/* 仿射也被 require 进来，不是为了顺手多测一点：这个文件里最重要的一条断言就是
   **1×1 的 Hill 逐字节等于仿射**。"Hill 是仿射升一维"这句话只有在两份独立实现
   真的对得上时才成立；对不上的时候，工具页第一个页签那块"k = 1 就是仿射密码"
   的牌子会是错的，而没有任何东西会报警。 */
const affine = require('./affine.js');

const HILL2 = [[3, 3], [2, 5]];                             // 教科书 2×2（HELP → HIAT）
const HILL3 = [[6, 24, 1], [13, 16, 10], [20, 17, 15]];     // 教科书 3×3（ACT → POH）
const I2 = [[1, 0], [0, 1]];

/* ================= 教科书向量 ================= */
T.eq(hill.encrypt('HELP', HILL2), 'HIAT', '2×2 教科书向量 HELP → HIAT');
T.eq(hill.decrypt('HIAT', HILL2), 'HELP', '2×2 解密回原文');
T.eq(hill.encrypt('ACT', HILL3), 'POH', '3×3 教科书向量 ACT → POH');
T.eq(hill.encrypt('CAT', HILL3), 'FIN', '3×3 教科书向量 CAT → FIN');
T.eq(hill.decrypt('POH', HILL3), 'ACT', '3×3 解密回原文');

/* 密钥的字母写法与矩阵是同一个东西——两种写法之间必须能来回。 */
T.eq(hill.keyLetters(HILL2), 'DDCF', 'keyLetters([[3,3],[2,5]]) = DDCF');
T.eq(hill.keyLetters(HILL3), 'GYBNQKURP', 'keyLetters 给出经典的 GYBNQKURP');
T.eq(hill.keyFromString('DDCF', 2), HILL2, 'keyFromString 是 keyLetters 的逆（k=2）');
T.eq(hill.keyFromString('GYBNQKURP', 3), HILL3, 'keyFromString 是 keyLetters 的逆（k=3）');
T.eq(hill.keyFromString('gybnqkurp!!', 3), HILL3, 'keyFromString 先规范化，多余字符不算数');
T.eq(hill.keyFromString('DDCFZZZZZ', 2), HILL2, '多余的字母被忽略：同一串既是 3×3 也是 2×2 的密钥');
T.throws(function () { hill.keyFromString('DDC', 2); },
         '字母不够时抛，而不是循环补齐', /需要 4 个字母，只拿到 3/);
T.throws(function () { hill.keyFromString('DDCFGYBN', 3); },
         'k=3 差一个字母也要抛', /需要 9 个字母，只拿到 8/);
T.throws(function () { hill.keyFromString('DDCF', 0); }, 'k=0 抛', /必须是正整数/);

/* ================= 分组与补位 =================
   补位字母是 X，只在长度不是 k 的整数倍时补，一个不多。 */
T.eq(hill.PAD, 'X', '补位字母是 X');
T.eq(hill.pad('HELP', 2), 'HELP', '长度已经是整数倍时一个字母都不补');
T.eq(hill.pad('HELLO', 2), 'HELLOX', '5 个字母补成 6 个');
T.eq(hill.pad('HELLO', 3), 'HELLOX', 'k=3：5 → 6');
T.eq(hill.pad('HELLOW', 4), 'HELLOWXX', 'k=4：6 → 8，补两个');
T.eq(hill.pad('Hello, World!', 2), 'HELLOWORLD', '规范化在补位之前：标点不占位置');
T.eq(hill.blocks('HELP', 2), [[7, 4], [11, 15]], 'blocks 给出下标分组');
T.eq(hill.blocks('HELLO', 2), [[7, 4], [11, 11], [14, 23]], '末组带着补出来的 X = 23');
T.throws(function () { hill.pad('HELLO', 0); }, 'k 必须是正整数', /必须是正整数/);

/* ---- 与 caesar/affine 的分歧：Hill 一律规范化 ----
   这不是漏了"保留大小写"，是 block 边界只能定义在字母上（见 hill.js 顶部）。
   把它钉成断言，免得将来有人"顺手对齐一下另外两个文件"。 */
T.eq(hill.encrypt('Hello, World!', HILL2), hill.encrypt('HELLOWORLD', HILL2),
     '大小写与标点在入口就被规范化掉');
T.eq(hill.encrypt('中文 attack', HILL2), hill.encrypt('ATTACK', HILL2),
     '非 ASCII 同样被丢弃，不参与分组');
T.eq(hill.encrypt('', HILL2), '', '空文本加密出空文本，不补出一整组');
T.eq(hill.encrypt('12345', HILL2), '', '一个字母都没有时输出为空');

/* ================= 往返：decrypt(encrypt(p)) === pad(p) =================
   往返的严格形式带着补位：明文长度不是 k 的整数倍时，还回来的是补齐后的那一串。
   这不是缺陷，是古典 Hill 的定义，所以断言写成它真实的样子，而不是挑一批
   长度刚好的明文把这件事藏起来。 */
const SAMPLE = 'The Quick Brown Fox Jumps Over 13 Lazy Dogs! —— 中文';
[2, 3].forEach(function (k) {
  const M = k === 2 ? HILL2 : HILL3;
  T.eq(hill.decrypt(hill.encrypt(SAMPLE, M), M), hill.pad(SAMPLE, k),
       'k=' + k + '：往返回到 pad(p, k)');
  T.eq(hill.encrypt(SAMPLE, M).length % k, 0, 'k=' + k + '：密文长度恒是 k 的整数倍');
  T.eq(hill.encrypt(SAMPLE, M).length, hill.pad(SAMPLE, k).length,
       'k=' + k + '：密文与补齐后的明文等长');
});
/* 长度本就是整数倍时，往返是逐字节的恒等式。 */
T.eq(hill.decrypt(hill.encrypt('ATTACKATDAWN', HILL2), HILL2), 'ATTACKATDAWN',
     '长度是 2 的倍数时往返逐字节相同');
T.eq(hill.decrypt(hill.encrypt('ATTACKATDAWN', HILL3), HILL3), 'ATTACKATDAWN',
     '长度是 3 的倍数时同样');

/* ---- 大量可用密钥上的往返（确定性抽样，不用 Math.random）----
   种子写死，这一段每次跑的是同一批矩阵，失败可以原样复现。 */
function lcg(seed) {
  let s = seed >>> 0;
  /* 取高位而不是低位取模：LCG 的低位周期极短。 */
  return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
[[2, 3000], [3, 1200]].forEach(function (cfg) {
  const k = cfg[0], want = cfg[1];
  const rnd = lcg(20260810 + k);
  const text = 'ATTACKATDAWNTONIGHTBRINGSIXTEENLADDERS';
  let done = 0, bad = 0, badInv = 0;
  while (done < want) {
    const M = hill.randomKey(k, rnd);
    if (hill.decrypt(hill.encrypt(text, M), M) !== hill.pad(text, k)) bad++;
    /* M⁻¹ 也必须是一把可用的密钥，而且用它加密再用 M 解密同样往返——
       "解密就是用逆矩阵再做一次同样的变换"这句话的对称形式。 */
    const Mi = hill.inverseKey(M);
    if (!hill.isUsableKey(Mi) || hill.decrypt(hill.encrypt(text, Mi), Mi) !== hill.pad(text, k)) badInv++;
    done++;
  }
  T.eq(bad, 0, 'k=' + k + '：' + want + ' 把随机可用密钥全部往返成立');
  T.eq(badInv, 0, 'k=' + k + '：每把密钥的逆同样可用且同样往返');
});

/* ================= 可用性判据：gcd(det, 26) = 1 =================
   穷举全部 26⁴ 个 2×2 矩阵，把三种问法钉成同一件事：
     isUsableKey(M)  ⟺  matInverse(M,26) !== null  ⟺  gcd(det M, 26) = 1
   crypto-core.test.js 已经穷举过后两者；这里重跑一遍是因为**第一者是本模块的**，
   而"判据在 core 里对、在这里被写成了别的东西"正是一个没人会去查的分叉。
   顺带用群论算出的 |GL₂(ℤ/26ℤ)| = 6 × 26208 = 157248 当作独立期望值：
   实现整体偏移时，回归基线会跟着偏移，这个数不会。 */
let usable2 = 0, mismatchInv = 0, mismatchGcd = 0;
for (let a = 0; a < 26; a++) {
  for (let b = 0; b < 26; b++) {
    for (let c = 0; c < 26; c++) {
      for (let d = 0; d < 26; d++) {
        const M = [[a, b], [c, d]];
        const u = hill.isUsableKey(M);
        if (u !== (C.matInverse(M, 26) !== null)) mismatchInv++;
        if (u !== (C.gcd(C.matDet(M, 26), 26) === 1)) mismatchGcd++;
        if (!u) continue;
        usable2++;
      }
    }
  }
}
T.eq(mismatchInv, 0, 'isUsableKey ⟺ matInverse ≠ null（穷举 26⁴ 个 2×2）');
T.eq(mismatchGcd, 0, 'isUsableKey ⟺ gcd(det,26) = 1（穷举 26⁴ 个 2×2）');
T.eq(usable2, 157248, '可用的 2×2 恰有 |GL₂(ℤ/26ℤ)| = 157248 个');

/* det = 13 的矩阵在实数上完全可逆，模 26 却是死的——这一条是整个工具页
   第二个页签的主张，所以它必须是断言而不是注释。 */
T.eq(C.matDet([[13, 0], [0, 1]], 26), 13, 'det = 13');
T.ok(!hill.isUsableKey([[13, 0], [0, 1]]), 'det = 13 的矩阵不可用（实数上却可逆）');
T.eq(hill.inverseKey([[13, 0], [0, 1]]), null, '不可用时 inverseKey 返回 null，不抛');
T.ok(!hill.isUsableKey([[2, 4], [6, 8]]), 'det ≡ 18，gcd = 2，不可用');
T.ok(!hill.isUsableKey([[0, 0], [0, 0]]), '零矩阵不可用');
T.ok(hill.isUsableKey(HILL2) && hill.isUsableKey(HILL3), '两把教科书密钥都可用');

/* 不可用的密钥必须抛，而不是悄悄返回点什么。消息里要带上 gcd——
   使用者看到 "gcd = 13" 才知道自己撞的是哪个因子。 */
T.throws(function () { hill.encrypt('HELLO', [[13, 0], [0, 1]]); },
         '不可用密钥加密抛异常', /gcd = 13/);
T.throws(function () { hill.decrypt('HELLO', [[13, 0], [0, 1]]); },
         '不可用密钥解密同样抛异常', /没有逆/);
T.throws(function () { hill.encrypt('HELLO', [[2, 4], [6, 8]]); },
         'gcd = 2 的矩阵同样抛', /gcd = 2/);
/* 裸变换在不可用的 M 上照样给结果，不抛——工具页的塌陷页签靠它画图。 */
T.eq(hill.applyRaw('ABCD', [[0, 1], [0, 1]]), 'BBDD',
     'applyRaw 在奇异矩阵上照常返回（两个字母塌成同一对）');
T.eq(hill.applyRaw('HELP', HILL2), hill.encrypt('HELP', HILL2),
     '可用的 M 上 applyRaw 与 encrypt 逐字节相同');
/* 形状不合法仍然要抛——那不是数学事实，是调用方写错了。 */
T.throws(function () { hill.encrypt('HELLO', [[1, 2, 3], [4, 5, 6]]); },
         '非方阵抛', /方阵/);
T.throws(function () { hill.encrypt('HELLO', [[1, 2], [3, 2.5]]); },
         '非整数元素抛', /不是整数/);

/* ================= Hill ⊃ 仿射：k = 1 就是仿射密码 =================
   ⚠ 这条等式只在**规范化之后**成立，且这一点是有原因的、不是将就：
   affine.encrypt 保留大小写与标点，hill.encrypt 在入口就把它们丢掉了
   （Hill 是分组密码，block 边界只能定义在字母上）。所以两侧的公平比较是
     hill.encrypt(t, [[a]]) === affine.encrypt(CryptoCore.normalize(t), a, 0)
   它对**任意**文本都成立；而写成 affine.encrypt(t, a, 0) 的那个更短的形式，
   在 t 本身已经规范化时同样逐字节成立。两种形式都钉一遍。 */
const RAW = 'Hello, World! 中文 123';
const NORM = C.normalize(RAW);
for (let a = 0; a < 26; a++) {
  /* 裸映射这一层对全部 26 个 a 成立，包括不可逆的那 14 个。 */
  T.eq(hill.applyRaw(RAW, [[a]]), affine.mapRaw(NORM, a, 0),
       'k=1：applyRaw 与仿射的裸映射一致（a = ' + a + '）');
  if (!affine.isValidA(a)) continue;
  T.eq(hill.encrypt(RAW, [[a]]), affine.encrypt(NORM, a, 0),
       'k=1：hill.encrypt(t,[[' + a + ']]) === affine.encrypt(normalize(t),' + a + ',0)');
  T.eq(hill.encrypt(NORM, [[a]]), affine.encrypt(NORM, a, 0),
       'k=1：文本已规范化时，等式就是 affine.encrypt(t,a,0) 本身（a = ' + a + '）');
  T.eq(hill.decrypt(hill.encrypt(NORM, [[a]]), [[a]]), NORM,
       'k=1：往返（a = ' + a + '）');
  /* 可用性判据在 k=1 上退化成仿射的 gcd(a,26)=1，一字不差。 */
  T.eq(hill.isUsableKey([[a]]), affine.isValidA(a),
       'k=1：isUsableKey 退化成 affine.isValidA（a = ' + a + '）');
}
T.eq(hill.isUsableKey([[13]]), false, 'k=1：a=13 不可用，与仿射同一条理由');

/* ================= 塌陷普查 =================
   imageCensus 把 26^k 个分组全过一遍。数字来自群论，不是"跑一遍看看输出"：
   像集大小 = 26^k / |ker M|，而每个被击中的点的原像恰好是 ker 的一个陪集，
   所以非零计数必须**全部相等**。 */
function cen(M) { return hill.imageCensus(M); }

T.eq(cen(HILL2).distinct, 676, '可用的 2×2：676 个 digraph 一个不丢（是个置换）');
T.eq(cen(HILL2).lost, 0, '可用时没有够不着的 digraph');
T.eq(cen(HILL2).fold, 1, '可用时每个像恰好一个原像');
T.ok(cen(HILL2).invertible, 'census 的 invertible 与 isUsableKey 一致');
T.eq(cen([[13, 0], [0, 1]]).distinct, 52, 'gcd = 13：676 个 digraph 只剩 52 个像');
T.eq(cen([[13, 0], [0, 1]]).fold, 13, 'gcd = 13：13 个 digraph 挤在同一个像上');
T.eq(cen([[13, 0], [0, 1]]).lost, 624, 'gcd = 13：624 个 digraph 永远不会出现在密文里');
T.eq(cen([[2, 4], [6, 8]]).distinct, 169, '这个 gcd = 2 的矩阵折成 169 个像');
T.eq(cen([[0, 1], [0, 1]]).distinct, 26, '两行相同：整个平面压到一条对角线上，26 个像');
T.eq(cen([[0, 0], [0, 0]]).distinct, 1, '零矩阵：676 个 digraph 全压成一个点');
T.eq(cen([[0, 0], [0, 0]]).fold, 676, '零矩阵：一个像上挤着全部 676 个原像');
T.eq(cen(HILL3).distinct, 17576, '可用的 3×3：17576 个 trigraph 一个不丢');
T.eq(cen(hill.keyFromString('HILLHILLH', 3)).distinct, 1352,
     'HILLHILLH（det = 13）：17576 → 1352');

/* 群论恒等式，逐个矩阵钉：
     Σ counts = 26^k
     distinct × fold = 26^k
     每个非零计数都等于 fold（原像是 ker 的陪集，大小相同）
     invertible ⟺ isUsableKey */
const CENSUS_CASES = [HILL2, [[13, 0], [0, 1]], [[2, 4], [6, 8]], [[0, 1], [0, 1]],
                      [[0, 0], [0, 0]], [[1, 0], [0, 13]], [[4, 6], [8, 10]],
                      [[7]], [[13]], [[0]], HILL3, hill.keyFromString('HILLHILLH', 3),
                      hill.keyFromString('SAMESAMES', 3)];
CENSUS_CASES.forEach(function (M) {
  const s = cen(M);
  const tag = 'census ' + hill.keyLetters(M);
  let sum = 0, wrongFold = 0, nonzero = 0;
  for (let i = 0; i < s.counts.length; i++) {
    sum += s.counts[i];
    if (s.counts[i] === 0) continue;
    nonzero++;
    if (s.counts[i] !== s.fold) wrongFold++;
  }
  T.eq(sum, s.total, tag + '：原像计数之和 = 26^k');
  T.eq(nonzero, s.distinct, tag + '：非零计数的个数 = distinct');
  T.eq(wrongFold, 0, tag + '：每个被击中的点的原像数都恰好是 |ker M|');
  T.eq(s.distinct * s.fold, s.total, tag + '：distinct × fold = 26^k');
  T.eq(s.invertible, hill.isUsableKey(M), tag + '：census 的可逆判定与 isUsableKey 一致');
});

/* ================= 已知明文攻击 =================
   k² 个未知数，k 组配对刚好够：M = Q·P⁻¹ (mod 26)。恢复必须是**精确**的，
   不是"最像的那一把"。 */
const CRIB = 'ATTACKATDAWNTONIGHTBRINGSIXTEENLADDERS';

[[2, 900], [3, 400]].forEach(function (cfg) {
  const k = cfg[0], want = cfg[1];
  const rnd = lcg(31415 + k);
  let bad = 0, notOk = 0, tooManyBlocks = 0;
  for (let i = 0; i < want; i++) {
    const M = hill.randomKey(k, rnd);
    const r = hill.solveKey(CRIB, hill.encrypt(CRIB, M), k);
    if (!r.ok) { notOk++; continue; }
    if (JSON.stringify(r.M) !== JSON.stringify(M)) bad++;
    if (r.cols.length !== k) tooManyBlocks++;
  }
  T.eq(notOk, 0, 'k=' + k + '：' + want + ' 把随机密钥全部被已知明文攻击命中');
  T.eq(bad, 0, 'k=' + k + '：恢复出来的 M 与真密钥逐元素相同');
  T.eq(tooManyBlocks, 0, 'k=' + k + '：每次只用了 k 组配对，一组不多');
});

/* 只给恰好 k 组配对（k² 个字母）也必须够——"k 组就够"这句话的最小形式。 */
const MIN2 = 'HELP';                                   // 2 组 digraph
T.eq(hill.solveKey(MIN2, hill.encrypt(MIN2, HILL2), 2).M, HILL2,
     'k=2：恰好 2 组配对就解出密钥');
/* 'ONETWOSIX' 的三组 trigraph 拼出来的 P 的 det ≡ 3，与 26 互素——挑一段
   明文当最小样例时**必须先验一下它的 P 可逆**：'ACTCATRUN' 读起来更像教科书，
   但它的 det ≡ 2，属于下面 dependent 那一类。 */
const MIN3 = 'ONETWOSIX';                              // 3 组 trigraph
const min3 = hill.solveKey(MIN3, hill.encrypt(MIN3, HILL3), 3);
T.eq(min3.ok && JSON.stringify(min3.M) === JSON.stringify(HILL3), true,
     'k=3：恰好 3 组配对就解出密钥');
T.eq(hill.solveKey(MIN2, hill.encrypt(MIN2, HILL2), 2).cols, [0, 1],
     '用的就是前两组');

/* ---- 优雅失败之一：配对不够 ---- */
const few = hill.solveKey('HE', hill.encrypt('HE', HILL2), 2);
T.eq(few.ok, false, '只有 1 组配对时不给答案');
T.eq(few.reason, 'too-few', '原因是 too-few，不是随便解一个出来');
T.eq(few.M, null, '失败时 M 必须是 null，不能是"猜的那一把"');
T.eq(few.blocksAvailable, 1, '如实报出手上有几组');
T.eq(few.need, 2, '如实报出需要几组');

/* ---- 优雅失败之二：配对在模 26 下线性相关 ----
   'ABABAB…' 的每个 digraph 都是同一个向量 (0,1)，任取两组拼出来的 P 都有
   两列相同，det ≡ 0。这不是构造出来的怪例——学习者拿重复串当明文是常事。 */
const DEP = 'ABABABABABABABAB';
[2, 3].forEach(function (k) {
  const M = k === 2 ? HILL2 : HILL3;
  const r = hill.solveKey(DEP, hill.encrypt(DEP, M), k);
  T.eq(r.ok, false, 'k=' + k + '：线性相关的配对不给答案');
  T.eq(r.reason, 'dependent', 'k=' + k + '：原因是 dependent');
  T.eq(r.M, null, 'k=' + k + '：失败时 M 是 null，不是一把错的密钥');
  T.ok(r.tried > 1, 'k=' + k + '：确实把多组组合都试过了（tried = ' + r.tried + '）');
  T.ok(r.dets.length > 0 && r.dets.every(function (d) { return C.gcd(d, 26) !== 1; }),
       'k=' + k + '：试过的每一组 P 的 det 都与 26 不互素');
});
/* 相关的前几组之后接上无关的几组，攻击必须自己找过去——这才是"给够独立配对
   就一定成功"那句话的实际内容。 */
const MIXED = 'ABABABAB' + 'HELPMENOW';
const mixed = hill.solveKey(MIXED, hill.encrypt(MIXED, HILL2), 2);
T.eq(mixed.ok, true, '前几组相关、后面独立时，攻击会自己挪到独立的那几组');
T.eq(mixed.M, HILL2, '挪过去之后恢复的仍然是精确的真密钥');
T.ok(mixed.cols[0] !== 0 || mixed.cols[1] !== 1, '用的不是前两组（它们是相关的）');

/* ---- 优雅失败之三：配对根本不来自同一把密钥 ----
   改掉密文里靠后的一个字母：前两组仍然解得出一个 M，但它对不上后面的配对。
   此时给出那个 M 是错的——它只是"恰好满足被选中的那两组"的东西。 */
const good = hill.encrypt(CRIB, HILL2);
const tampered = good.slice(0, 8) + (good.charAt(8) === 'A' ? 'B' : 'A') + good.slice(9);
const inc = hill.solveKey(CRIB, tampered, 2);
T.eq(inc.ok, false, '密文被改过一个字母时不给答案');
T.eq(inc.reason, 'inconsistent', '原因是 inconsistent：这些配对不来自同一把密钥');
T.eq(inc.M, null, 'inconsistent 时同样不给 M');
T.eq(inc.failedBlock, 4, '如实指出是第 4 组（下标 8、9 那一组）对不上');

/* 明文与密文长度不一致时如实标记，但仍按较短的那一头尽力而为。 */
const lm = hill.solveKey(CRIB, hill.encrypt(CRIB, HILL2).slice(0, 12), 2);
T.eq(lm.lengthMismatch, true, '长度不一致时 lengthMismatch 为 true');
T.eq(lm.ok, true, '较短的那一头够 k 组时照样解得出来');
T.eq(lm.M, HILL2, '解出来的仍然是真密钥');

T.throws(function () { hill.solveKey('AB', 'CD', 0); }, 'solveKey 的 k 必须是正整数', /正整数/);

/* ================= 随机密钥：随机源必须是注入的 ================= */
T.throws(function () { hill.randomKey(2); },
         '不传随机源时抛，绝不偷偷去拿 Math.random', /需要注入一个随机源/);
T.throws(function () { hill.randomKey(2, 0.5); },
         '随机源不是函数时抛', /需要注入一个随机源/);
T.throws(function () { hill.randomKey(0, Math.random); },
         'k 必须是正整数', /必须是正整数/);
T.throws(function () { hill.randomKey(2, function () { return 0; }); },
         '常数随机源抽不到可用矩阵时要响，不能静静地转下去', /连抽 400 次/);
T.throws(function () { hill.randomKey(2, function () { return 1; }); },
         '返回 1 违反 [0,1) 契约，当场报出来', /契约要求/);
T.throws(function () { hill.randomKey(2, function () { return undefined; }); },
         '返回 undefined 时报的是随机源的错，不是"元素不是整数"', /契约要求/);

/* 同一个种子必须给出同一把密钥——可复现是注入随机源的全部意义。 */
T.eq(hill.randomKey(2, lcg(7)), hill.randomKey(2, lcg(7)), '同种子同密钥（k=2）');
T.eq(hill.randomKey(3, lcg(7)), hill.randomKey(3, lcg(7)), '同种子同密钥（k=3）');
T.ok(JSON.stringify(hill.randomKey(2, lcg(7))) !== JSON.stringify(hill.randomKey(2, lcg(8))),
     '不同种子给出不同密钥');
/* 抽出来的每一把都必须真的可用，而且形状对。 */
[1, 2, 3].forEach(function (k) {
  const rnd = lcg(99 + k);
  let bad = 0;
  for (let i = 0; i < 300; i++) {
    const M = hill.randomKey(k, rnd);
    if (!hill.isUsableKey(M) || M.length !== k || M[0].length !== k) bad++;
  }
  T.eq(bad, 0, 'k=' + k + '：300 把随机密钥个个可用且形状正确');
});
/* 密钥的每个元素都要落在 [0,26)——rngFn 给 0.999… 时不许溢出成 26。 */
const edge = hill.randomKey(2, (function () {
  const seq = [0.99999, 0, 0, 0.99999];     // [[25,0],[0,25]]，det = 625 ≡ 1，可用
  let i = 0;
  return function () { return seq[i++ % seq.length]; };
})());
T.eq(edge, [[25, 0], [0, 25]], '0.99999 落到 25，不会溢出成 26');
T.ok(hill.isUsableKey(edge), '这把边界密钥确实可用（det = 625 ≡ 1）');

/* M·M⁻¹ = I 这条最后再走一次本模块的出口（core 已经验过，这里验的是
   inverseKey 没有在中间做别的事）。 */
T.eq(C.matMul(HILL2, hill.inverseKey(HILL2), 26), I2, 'inverseKey 给出的确实是模 26 的逆');

T.report('hill');
