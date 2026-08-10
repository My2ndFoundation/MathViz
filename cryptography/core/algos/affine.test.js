'use strict';
const T = require('../_test.js');
const C = require('../crypto-core.js');
const affine = require('./affine.js');
/* 凯撒也被 require 进来，不是为了顺手多测一点：这个文件里最重要的一条断言
   就是 a=1 与凯撒**逐字节**相同。仿射是凯撒的推广这句话，只有在两份独立
   实现真的对得上时才成立；对不上的时候，工具页第一个页签"a=1 就是凯撒"
   那句文案会是错的，而没有任何东西会报警。 */
const caesar = require('./caesar.js');

/* ---- 教科书向量（a=5, b=8）---- */
T.eq(affine.encrypt('AFFINECIPHER', 5, 8), 'IHHWVCSWFRCP', 'a=5,b=8 教科书向量');
T.eq(affine.decrypt('IHHWVCSWFRCP', 5, 8), 'AFFINECIPHER', 'a=5,b=8 解密回原文');
/* b=0 的纯乘法：A 是不动点（0 乘什么都是 0），这一条把"a 是拉伸、b 是平移"
   拆开验证了一半——没有平移时，字母表的第一个字母原地不动。 */
T.eq(affine.encrypt('ATTACK AT DAWN', 3, 0), 'AFFAGE AF JAON', 'a=3,b=0 纯乘法');
T.eq(affine.encrypt('ATTACK AT DAWN', 3, 0).charAt(0), 'A', 'b=0 时 A 是不动点');

/* ---- 大小写与非字母字符原样保留（与 caesar.js 同一条约定）---- */
T.eq(affine.encrypt('Hello, World!', 1, 3), 'Khoor, Zruog!', 'a=1,b=3 保留大小写与标点');
T.eq(affine.encrypt('中文 123', 5, 8), '中文 123', '非 ASCII 与数字原样穿过');
T.eq(affine.encrypt('affinecipher', 5, 8), 'ihhwvcswfrcp', '小写走同一张表，输出仍是小写');
T.eq(affine.encrypt('a-z A-Z', 5, 8), 'i-d I-D', '两端都要绕回，且大小写各自守住');

/* ---- 可逆的 a 恰好 12 个 ---- */
const VALID = affine.validAs();
T.eq(VALID.length, 12, '与 26 互素的 a 恰好 12 个（φ(26) = 12）');
T.eq(VALID, [1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25], 'validAs() 的具体名单');
/* 名单与判定必须是同一个事实的两种问法——分开写就会分开漂。 */
for (let a = 0; a < 26; a++) {
  T.eq(affine.isValidA(a), VALID.indexOf(a) >= 0,
       'isValidA(' + a + ') 与 validAs() 名单一致');
  T.eq(affine.isValidA(a), C.gcd(a, 26) === 1,
       'isValidA(' + a + ') 就是 gcd(a,26)===1');
}
T.eq(affine.isValidA(0), false, 'a=0 不可逆（gcd = 26，整个字母表压成一个字母）');
T.eq(affine.isValidA(13), false, 'a=13 不可逆——13 是 26 的因子');
T.eq(affine.isValidA(2), false, 'a=2 不可逆——2 是 26 的因子');

/* ---- a、b 的规约：同余的密钥必须是同一个密钥 ---- */
T.eq(affine.encrypt('HELLO', 27, 8), affine.encrypt('HELLO', 1, 8), 'a=27 等于 a=1');
T.eq(affine.encrypt('HELLO', -1, 8), affine.encrypt('HELLO', 25, 8), 'a=−1 等于 a=25');
T.eq(affine.encrypt('HELLO', 5, 34), affine.encrypt('HELLO', 5, 8), 'b=34 等于 b=8');
T.eq(affine.encrypt('HELLO', 5, -18), affine.encrypt('HELLO', 5, 8), 'b=−18 等于 b=8');
T.eq(affine.isValidA(27), true, 'a=27 与 a=1 同余，同样可逆');

/* ---- 性质：全部 12×26 = 312 个密钥都必须往返 ---- */
const SAMPLE = 'The Quick Brown Fox Jumps Over 13 Lazy Dogs! —— 中文';
let roundtrips = 0;
VALID.forEach(function (a) {
  for (let b = 0; b < 26; b++) {
    T.eq(affine.decrypt(affine.encrypt(SAMPLE, a, b), a, b), SAMPLE,
         'decrypt(encrypt(p,' + a + ',' + b + '),' + a + ',' + b + ') === p');
    roundtrips++;
  }
});
T.eq(roundtrips, 312, '往返断言覆盖了全部 312 个密钥，一个不少');

/* ---- 仿射 ⊃ 凯撒：a=1 必须逐字节等于凯撒 ---- */
for (let k = 0; k < 26; k++) {
  T.eq(affine.encrypt(SAMPLE, 1, k), caesar.encrypt(SAMPLE, k),
       'a=1 时 encrypt(p,1,' + k + ') 与凯撒 encrypt(p,' + k + ') 逐字节相同');
  T.eq(affine.decrypt(SAMPLE, 1, k), caesar.decrypt(SAMPLE, k),
       'a=1 时 decrypt 也与凯撒一致');
}

/* ---- 不可逆的 a 必须抛，而不是悄悄返回点什么 ---- */
T.throws(function () { affine.encrypt('HELLO', 2, 3); },
         'a=2 加密抛异常', /不互素/);
T.throws(function () { affine.encrypt('HELLO', 13, 0); },
         'a=13 加密抛异常', /gcd = 13/);
T.throws(function () { affine.decrypt('HELLO', 13, 0); },
         'a=13 解密同样抛异常', /不互素/);
T.throws(function () { affine.encrypt('HELLO', 0, 5); },
         'a=0 抛异常（gcd = 26）', /gcd = 26/);
T.throws(function () { affine.encrypt('HELLO', 26, 5); },
         'a=26 与 a=0 同余，同样抛', /gcd = 26/);

/* ---- 裸映射：不可逆的 a 上照样给结果，不抛 ---- */
T.eq(affine.mapping(1, 0), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
                            14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25],
     'a=1,b=0 是恒等映射');
T.eq(affine.mapping(5, 8)[0], 8, 'mapping(5,8) 把 A 送到下标 8');
T.eq(affine.mapping(13, 0)[0], 0, 'a=13：偶数下标全落到 0');
T.eq(affine.mapping(13, 0)[1], 13, 'a=13：奇数下标全落到 13');
T.eq(affine.mapping(13, 0)[2], 0, 'a=13：下标 2 与下标 0 撞在一起');
/* mapRaw 在可逆的 a 上必须与 encrypt 一模一样——否则工具页在"合法 a 用
   encrypt、非法 a 用 mapRaw"这条分支上会画出两套不同的图。 */
VALID.forEach(function (a) {
  T.eq(affine.mapRaw(SAMPLE, a, 7), affine.encrypt(SAMPLE, a, 7),
       'a=' + a + ' 可逆时 mapRaw 与 encrypt 一致');
});
T.eq(affine.mapRaw('ABCDEF', 13, 0), 'ANANAN', 'a=13 的裸映射：六个字母塌成两个');

/* ---- 塌陷普查 ---- */
function col(a, b) { return affine.collapse(a, b); }

T.eq(col(5, 8).invertible, true, 'a=5 是双射');
T.eq(col(5, 8).distinct, 26, 'a=5：26 个字母各占一个像');
T.eq(col(5, 8).lost, 0, 'a=5：一个字母都没丢');
T.eq(col(5, 8).unreachable, [], 'a=5：没有够不着的字母');
T.eq(col(5, 8).g, 1, 'a=5：gcd = 1');

T.eq(col(2, 0).g, 2, 'a=2：gcd = 2');
T.eq(col(2, 0).distinct, 13, 'a=2：像集只剩 13 个字母');
T.eq(col(2, 0).lost, 13, 'a=2：13 个明文字母被合并掉');
T.eq(col(2, 0).unreachable.length, 13, 'a=2：13 个密文字母永远不出现');
T.eq(col(2, 0).preimages[0], [0, 13], 'a=2,b=0：A 与 N 都映到 A');

T.eq(col(13, 0).g, 13, 'a=13：gcd = 13');
T.eq(col(13, 0).distinct, 2, 'a=13：整个字母表只剩 2 个像');
T.eq(col(13, 0).lost, 24, 'a=13：24 个明文字母被合并掉');
T.eq(col(13, 0).unreachable.length, 24, 'a=13：24 个密文字母永远不出现');
T.eq(col(13, 0).preimages[0].length, 13, 'a=13：13 个字母挤在同一个像上');

T.eq(col(0, 4).g, 26, 'a=0：gcd = 26');
T.eq(col(0, 4).distinct, 1, 'a=0：整个字母表压成一个字母');
T.eq(col(0, 4).lost, 25, 'a=0：25 个字母被合并掉');

/* 恒等式：被合并掉的字母数 ≡ 够不着的字母数 ≡ 26 − 26/g。
   工具页在两个位置分别显示这两个数，靠的就是这条恒等式；
   逐个 a 钉一遍，比在注释里声明它可靠。 */
for (let a = 0; a < 26; a++) {
  const s = col(a, 11);
  T.eq(s.lost, s.unreachable.length, 'a=' + a + '：被合并数 === 够不着数');
  T.eq(s.distinct, 26 / s.g, 'a=' + a + '：像集大小 === 26/gcd');
  T.eq(s.invertible, s.lost === 0, 'a=' + a + '：可逆 ⟺ 一个字母都没丢');
  /* 每个非空像的原像数都恰好是 g——"g 对 1"这句话的实际内容。 */
  for (let y = 0; y < 26; y++) {
    const n = s.preimages[y].length;
    T.ok(n === 0 || n === s.g, 'a=' + a + '：像 ' + y + ' 的原像数是 0 或 ' + s.g);
  }
}
/* b 只平移不塌陷：换 b 不改变任何一个计数。 */
for (let b = 0; b < 26; b++) {
  T.eq(col(2, b).lost, 13, 'a=2 时 b=' + b + ' 的塌陷程度不变');
}

/* ---- bruteForce ---- */
const CIPHER = affine.encrypt('ATTACK AT DAWN', 5, 8);
const bf = affine.bruteForce(CIPHER);
T.eq(bf.length, 312, 'bruteForce 恒给 312 个候选（12 个 a × 26 个 b）');
T.eq(bf[0].a, 1, 'bruteForce 首项 a=1');
T.eq(bf[0].b, 0, 'bruteForce 首项 b=0');
T.eq(bf[311].a, 25, 'bruteForce 末项 a=25');
T.eq(bf[311].b, 25, 'bruteForce 末项 b=25');
/* 候选里必须真的有那把真钥匙，而且它解出来的就是明文。 */
const hit = bf.filter(function (c) { return c.a === 5 && c.b === 8; });
T.eq(hit.length, 1, '真钥匙 (5,8) 在候选里恰好出现一次');
T.eq(hit[0].text, 'ATTACK AT DAWN', '真钥匙那一项解出的就是明文');
/* 每一项都必须等于用那对 (a,b) 解出来的结果——312 行里不许有一行是摆设，
   使用者正是靠扫这 312 格得到"密钥空间还是太小"这个结论的。 */
let mismatched = 0, seen = {};
bf.forEach(function (c) {
  if (c.text !== affine.decrypt(CIPHER, c.a, c.b)) mismatched++;
  seen[c.a + ',' + c.b] = (seen[c.a + ',' + c.b] || 0) + 1;
});
T.eq(mismatched, 0, '312 个候选全部与 decrypt 一致');
T.eq(Object.keys(seen).length, 312, '312 对 (a,b) 互不重复');
/* 每个候选的 a 都必须是可逆的——不可逆的 a 不是密钥，不该占一个格子。 */
T.eq(bf.filter(function (c) { return !affine.isValidA(c.a); }).length, 0,
     'bruteForce 里没有不可逆的 a');

T.report('affine');
