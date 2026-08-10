'use strict';
const T = require('../_test.js');
const C = require('../crypto-core.js');
const CA = require('../cryptanalysis.js');
const vig = require('./vigenere.js');
const caesar = require('./caesar.js');

/* ================= 教科书向量 =================
   三条都取自公开教材里通用的那组示例，且都是可以手算复核的：
   'ATTACKATDAWN' / 'LEMON' 逐字母就是 A+L=L、T+E=X、T+M=F…… */
T.eq(vig.encrypt('ATTACKATDAWN', 'LEMON'), 'LXFOPVEFRNHR', '维吉尼亚经典向量');
T.eq(vig.decrypt('LXFOPVEFRNHR', 'LEMON'), 'ATTACKATDAWN', '解密回原文');
T.eq(vig.beaufortEncrypt('DEFENDTHEEASTWALLOFTHECASTLE', 'FORTIFICATION'),
     'CKMPVCPVWPIWUJOGIUAPVWRIWUUK', '博福特经典向量');
T.eq(vig.portaEncrypt('DEFENDTHEEASTWALLOFTHECASTLE', 'FORTIFICATION'),
     'SYNNJSCVRNRLAHUTUKUCVRYRLANY', '波尔塔经典向量');

/* ================= 身份一：密钥长 1 的维吉尼亚**就是**凯撒 =================
   不是"很像"、不是"退化到"——是同一个式子。这条断言比任何往返测试都值钱：
   往返只证明 encrypt 与 decrypt 互逆（两个都错成同一个方向照样绿），
   这一条把 vigenere 钉在一份**独立实现**上。
   26 个密钥字母全测，不是挑一个：漏掉的那个正好是绕回边界的概率不低。 */
const SAMPLE = 'The Quick Brown Fox Jumps Over 13 Lazy Dogs! —— 中文';
for (let k = 0; k < C.N; k++) {
  T.eq(vig.encrypt(SAMPLE, C.ALPHABET.charAt(k)), caesar.encrypt(SAMPLE, k),
       '密钥 ' + C.ALPHABET.charAt(k) + ' 的维吉尼亚 === 凯撒 k=' + k);
}
T.eq(vig.encrypt(SAMPLE, 'D'), caesar.encrypt(SAMPLE, 3), "encrypt(t,'D') === caesar(t,3)");

/* ================= 身份二：博福特自反 =================
   c = k − p，所以 k − (k − p) = p。加密两次回到明文——这正是它与维吉尼亚
   最大的行为差别，也是页面上"同一个按钮既加密又解密"的依据。
   连同大小写与标点一起回来，才算真的自反：只比归一化后的字母，等于放过了
   "第二次跑丢了大小写"这种错法。 */
const MIXED = 'Attack at dawn, 05:30! —— 中文';
T.eq(vig.beaufortEncrypt(vig.beaufortEncrypt(MIXED, 'FORTIFY'), 'FORTIFY'), MIXED,
     '博福特连做两次是恒等（含大小写与非字母）');
T.eq(vig.beaufortDecrypt(vig.beaufortEncrypt(MIXED, 'FORTIFY'), 'FORTIFY'), MIXED,
     '博福特 decrypt 解得开 encrypt');
T.eq(vig.beaufortDecrypt(MIXED, 'FORTIFY'), vig.beaufortEncrypt(MIXED, 'FORTIFY'),
     '博福特 decrypt 与 encrypt 是同一个函数');
/* 反过来钉一条：维吉尼亚**不**自反。否则上面那三条断言在一份"所有变体都
   自反"的错误实现上也是全绿的。 */
T.ok(vig.encrypt(vig.encrypt('ATTACK', 'LEMON'), 'LEMON') !== 'ATTACK',
     '维吉尼亚不是自反的（对照组）');

/* ================= 身份三：波尔塔自反，且密钥字母成对 ================= */
T.eq(vig.portaEncrypt(vig.portaEncrypt(MIXED, 'FORTIFY'), 'FORTIFY'), MIXED,
     '波尔塔连做两次是恒等（含大小写与非字母）');
T.eq(vig.portaDecrypt(MIXED, 'FORTIFY'), vig.portaEncrypt(MIXED, 'FORTIFY'),
     '波尔塔 decrypt 与 encrypt 是同一个函数');
/* 13 张表：A/B 同一张、C/D 同一张……Y/Z 同一张。第三页的 χ² 因此只能定到
   "哪一对"，页面把恢复结果写成 'C/D' 就是这条断言的直接后果。 */
for (let k = 0; k < C.N; k += 2) {
  T.eq(vig.portaEncrypt(SAMPLE, C.ALPHABET.charAt(k)),
       vig.portaEncrypt(SAMPLE, C.ALPHABET.charAt(k + 1)),
       '波尔塔密钥 ' + C.ALPHABET.charAt(k) + ' 与 ' + C.ALPHABET.charAt(k + 1) + ' 是同一张表');
}
/* 而相邻的**对**之间必须不同——否则"13 张表"就成了 1 张表，上面 13 条
   断言在一个恒等实现上也全绿。 */
for (let j = 0; j < 12; j++) {
  T.ok(vig.portaEncrypt(SAMPLE, C.ALPHABET.charAt(2 * j)) !==
       vig.portaEncrypt(SAMPLE, C.ALPHABET.charAt(2 * j + 2)),
       '波尔塔第 ' + j + ' 张表与第 ' + (j + 1) + ' 张不同');
}
/* 逐字对照第 0、1 两张表：这是唯一不依赖任何其它断言的、能手工复核的锚点。 */
T.eq(vig.portaEncrypt(C.ALPHABET, 'A'), 'NOPQRSTUVWXYZABCDEFGHIJKLM', '波尔塔表 A/B');
T.eq(vig.portaEncrypt(C.ALPHABET, 'C'), 'OPQRSTUVWXYZNMABCDEFGHIJKL', '波尔塔表 C/D');

/* ================= 大小写、非字母、以及"非字母不消耗密钥" ================= */
T.eq(vig.encrypt('Attack at dawn!', 'LEMON'), 'Lxfopv ef rnhr!', '保留大小写与标点');
/* 关键的一条：空格没有吃掉密钥字母。'ABCDE' 与 'AB CDE' 的字母序列相同，
   密文的字母序列就必须相同——否则密文周期不再等于密钥长度，第二页的
   Kasiski 与逐周期重合指数会整页失效，而画面上不会有任何提示。 */
T.eq(C.normalize(vig.encrypt('AB CDE', 'KEY')), C.normalize(vig.encrypt('ABCDE', 'KEY')),
     '非字母不消耗密钥');
T.eq(vig.encrypt('中文 123', 'LEMON'), '中文 123', '一个字母都没有时原样穿过');
/* 密钥本身也归一化：小写、带空格的密钥与大写紧凑的密钥等价。 */
T.eq(vig.encrypt(SAMPLE, 'le mon'), vig.encrypt(SAMPLE, 'LEMON'), '密钥归一化（大小写与空格）');

/* ================= 全部三个变体的往返 ================= */
const KEYS = ['A', 'D', 'LEMON', 'FORTIFICATION', 'ZZZ', 'ab'];
KEYS.forEach(function (key) {
  T.eq(vig.decrypt(vig.encrypt(SAMPLE, key), key), SAMPLE, '维吉尼亚往返 key=' + key);
  T.eq(vig.beaufortDecrypt(vig.beaufortEncrypt(SAMPLE, key), key), SAMPLE, '博福特往返 key=' + key);
  T.eq(vig.portaDecrypt(vig.portaEncrypt(SAMPLE, key), key), SAMPLE, '波尔塔往返 key=' + key);
});

/* ================= keyStream ================= */
T.eq(vig.keyStream('LEMON', 7), [11, 4, 12, 14, 13, 11, 4], 'keyStream 循环展开');
T.eq(vig.keyStream('LEMON', 0), [], 'n=0 给空数组');
T.eq(vig.keyStream('le mon!', 5), [11, 4, 12, 14, 13], 'keyStream 也归一化密钥');
/* keyStream 与 encrypt 必须是同一条推进规则——两处各写一遍的话，画面上那行
   密钥字母迟早会与密文对不上，而两者看起来都"挺对的"。 */
const ks = vig.keyStream('LEMON', 12);
const pi = C.letters('ATTACKATDAWN');
const ci = C.letters(vig.encrypt('ATTACKATDAWN', 'LEMON'));
for (let i = 0; i < 12; i++) {
  T.eq(ci[i], C.mod(pi[i] + ks[i], C.N), 'keyStream 与 encrypt 同一条规则，第 ' + i + ' 位');
}

/* ================= 错误入口 ================= */
T.throws(function () { vig.encrypt('ABC', ''); }, '空密钥当场抛', /密钥至少要含一个字母/);
T.throws(function () { vig.encrypt('ABC', '123 !'); }, '一个字母都没有的密钥当场抛', /密钥至少要含一个字母/);
T.throws(function () { vig.beaufortEncrypt('ABC', ''); }, '博福特同样拒绝空密钥', /密钥至少要含一个字母/);
T.throws(function () { vig.portaEncrypt('ABC', ''); }, '波尔塔同样拒绝空密钥', /密钥至少要含一个字母/);
T.throws(function () { vig.keyStream('LEMON', -1); }, 'keyStream 拒绝负长度', /必须是 >= 0 的整数/);
T.throws(function () { vig.keyStream('LEMON', 2.5); }, 'keyStream 拒绝非整数', /必须是 >= 0 的整数/);

/* ================= 与分析工具的接口 =================
   这几条不测 cryptanalysis 自己（那边有自己的测试），测的是**这个模块产出的
   密文确实带着周期**——工具页第二页整页建立在这件事上。 */
const LONG = ('the primary purpose of a key that repeats is to hide the single alphabet ' +
              'behind several of them so that counting letters no longer tells you anything ' +
              'useful about the message that was written down before the key was applied to it');
const CIPH = vig.encrypt(LONG, 'HORIZONTAL');       // 10 字母密钥
const icAll = CA.icByPeriod(CIPH, 20);
/* 逐周期重合指数在真周期（以及它的倍数）处抬头。断言写成"p=10 高于 p=9 与
   p=11"，而不是"p=10 是全局最大"——全局最大很可能落在 20（真周期的倍数），
   那正是这个工具第二页要讲的现象，把它断言成失败就是在替数学撒谎。 */
const icAt = function (p) { return icAll[p - 1].ic; };
T.ok(icAt(10) > icAt(9) && icAt(10) > icAt(11), '重合指数在真周期 10 处高于两侧邻居');
T.ok(icAt(10) > icAt(3), '真周期处的重合指数明显高于一个错周期');
/* 整段密文（p=1）的重合指数被压向均匀随机的 1/26 ≈ 0.0385，而不是英文的
   0.066——这就是"多表代换把 IoC 压低了"的直接证据，也是第二页 p=1 那根
   柱子存在的理由。 */
T.ok(icAt(1) < 0.05, '整段密文的重合指数被压向随机（' + icAt(1).toFixed(4) + '）');
T.ok(CA.indexOfCoincidence(LONG) > 0.06, '同一段明文的重合指数仍在英文档位');

T.report('vigenere');
