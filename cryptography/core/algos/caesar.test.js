'use strict';
const T = require('../_test.js');
const C = require('../crypto-core.js');
const caesar = require('./caesar.js');

/* ---- 教科书向量 ---- */
T.eq(caesar.encrypt('ATTACK AT DAWN', 3), 'DWWDFN DW GDZQ', 'k=3 经典向量');
T.eq(caesar.decrypt('DWWDFN DW GDZQ', 3), 'ATTACK AT DAWN', 'k=3 解密回原文');
T.eq(caesar.encrypt('HELLO', 13), 'URYYB', 'k=13 即 ROT13');
T.eq(caesar.encrypt(caesar.encrypt('HELLO', 13), 13), 'HELLO', 'ROT13 自逆');

/* ---- 大小写与非字母字符原样保留 ---- */
T.eq(caesar.encrypt('Hello, World!', 3), 'Khoor, Zruog!', '保留大小写与标点');
T.eq(caesar.encrypt('a-z A-Z', 1), 'b-a B-A', '两端都要绕回：z→a、Z→A');
T.eq(caesar.encrypt('中文 123', 5), '中文 123', '非 ASCII 与数字原样穿过');

/* ---- k 的边界与规约 ---- */
T.eq(caesar.encrypt('ABC', 0), 'ABC', 'k=0 是恒等');
T.eq(caesar.encrypt('ABC', 26), 'ABC', 'k=26 与 k=0 同一个轮子');
T.eq(caesar.encrypt('ABC', -1), caesar.encrypt('ABC', 25), 'k=-1 等于 k=25');
T.eq(caesar.encrypt('ABC', 29), caesar.encrypt('ABC', 3), 'k=29 等于 k=3');

/* ---- 性质：全 k 往返（check.py 第 12 道门也钉这一条）---- */
const SAMPLE = 'The Quick Brown Fox Jumps Over 13 Lazy Dogs! —— 中文';
for (let k = 0; k < 26; k++) {
  T.eq(caesar.decrypt(caesar.encrypt(SAMPLE, k), k), SAMPLE,
       'decrypt(encrypt(p,' + k + '),' + k + ') === p');
}

/* ---- bruteForce ---- */
const bf = caesar.bruteForce('DWWDFN');
T.eq(bf.length, 26, 'bruteForce 恒给 26 个候选');
T.eq(bf[0].k, 0, 'bruteForce 按 k 升序，首项 k=0');
T.eq(bf[25].k, 25, 'bruteForce 末项 k=25');
T.eq(bf[0].text, 'DWWDFN', 'k=0 的候选就是密文本身');
T.eq(bf[3].text, 'ATTACK', 'k=3 的候选是明文');
/* 每个候选都必须真的等于用那个 k 解出来的结果——否则 26 行里可能有一行是
   摆设，而使用者正是靠肉眼扫这 26 行得到"密钥空间才是弱点"这个结论的。 */
bf.forEach(function (c) {
  T.eq(c.text, caesar.decrypt('DWWDFN', c.k), 'bruteForce 第 ' + c.k + ' 项与 decrypt 一致');
});

T.report('caesar');
