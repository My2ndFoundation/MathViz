'use strict';
const T = require('../_test.js');
const C = require('../crypto-core.js');
const CA = require('../cryptanalysis.js');
const sub = require('./substitution.js');
const pf = require('./playfair.js');

/* 教科书方阵：关键词 "PLAYFAIR EXAMPLE"。
     P L A Y F
     I R E X M
     B C D G H
     K N O Q S
     T U V W Z
   下面所有手算向量都以它为准；每一条的推导都写在断言的说明里，
   好让读的人不必自己重画一遍方阵。 */
const SQ = 'PLAYFIREXMBCDGHKNOQSTUVWZ';
const KW = 'PLAYFAIR EXAMPLE';

/* ================= 方阵 ================= */
T.eq(pf.makeSquare(KW), SQ, '关键词去重在前、余下 25 个字母按序补齐');
T.eq(pf.makeSquare(''), pf.SQUARE_ALPHABET, '空关键词给出标准 25 字母方阵');
T.eq(pf.makeSquare('playfair example'), SQ, '小写与空格先被 normalize 掉');
T.eq(pf.makeSquare('JAM'), pf.makeSquare('IAM'), 'J 在关键词里也并进 I');
T.eq(pf.makeSquare('中文 123'), pf.SQUARE_ALPHABET, '一个字母都没有时退回标准方阵');
T.eq(pf.makeSquare(pf.SQUARE_ALPHABET), pf.SQUARE_ALPHABET, '拿方阵自己当关键词是恒等');
T.eq(pf.makeSquare(null), pf.SQUARE_ALPHABET, 'null 当空关键词处理，不抛');
T.ok(pf.SQUARE_ALPHABET.indexOf('J') < 0, '方阵字母表里没有 J');
T.eq(pf.SQUARE_ALPHABET.length, 25, '方阵字母表是 25 个字母');

/* 任何关键词都必须给出 25 个格子的**排列**——少一个字母或多一个重复，
   posOf 就会把某个明文字母映到 null，加密中途抛异常。 */
function isPermutation(sq) {
  if (typeof sq !== 'string' || sq.length !== 25) return false;
  return sq.split('').sort().join('') === pf.SQUARE_ALPHABET.split('').sort().join('');
}
['', 'PLAYFAIR EXAMPLE', 'ZEBRA', 'CRYPTOGRAPHY', 'JJJJ', 'the quick brown fox',
 'AAAA', pf.SQUARE_ALPHABET, 'MONARCHY', '中文'].forEach(function (w) {
  T.ok(isPermutation(pf.makeSquare(w)),
       'makeSquare(' + JSON.stringify(w) + ') 是 25 格的一个排列');
});

/* ================= 二元组预处理 —— 各家实现真正分岔的地方 ================= */
/* 本模块的策略（写在 playfair.js 顶上的那三条）逐条钉住。 */
T.eq(pf.prepare('HIDE THE GOLD IN THE TREE STUMP'), 'HIDETHEGOLDINTHETREXESTUMP',
     '重复对 EE 被 X 拆开：… TR | EX | ES …');
T.eq(pf.prepare('BALLOON'), 'BALXLOON',
     'BALLOON → BA LX LO ON：拆重复对时**只消费一个**字母');
T.eq(pf.prepare('HELLO'), 'HELXLO', 'HELLO 拆完正好偶数，不需要补尾');
T.eq(pf.prepare('CAT'), 'CATX', '奇数尾用 X 补齐');
T.eq(pf.prepare('AAA'), 'AXAXAX',
     'AAA → AX AX AX：只消费一个字母这条规则在连续三个相同字母上才看得出对错');
T.eq(pf.prepare('X'), 'XQ', '要补的位置本来就是 X 时改用备用填充字母 Q');
T.eq(pf.prepare('XX'), 'XQXQ',
     'XX 若也用 X 去拆会得到 (X,X)——仍是重复对，三条规则全部退化；备用字母消灭这个情形');
T.eq(pf.prepare('AXX'), 'AXXQ', '填充造成的相邻不会再触发一次拆分（AX 已经消费掉两个字母）');
T.eq(pf.prepare('JAZZ'), 'IAZXZX', 'J 并进 I 之后再做拆分与补尾');
T.eq(pf.prepare('Hello, World! 123'), 'HELXLOWORLDX',
     '标点、数字、大小写先被 normalize 掉，再做二元组处理（HE LX LO WO RL DX）');
T.eq(pf.prepare(''), '', '空串预处理还是空串');
T.eq(pf.prepare('中文 123'), '', '一个字母都没有时输出空串，而不是一对填充字母');

/* 关掉拆分（四方阵 / 二方阵用的那条路）：只归一化 + 补奇数尾。 */
T.eq(pf.prepare('BALLOON', { splitDoubles: false }), 'BALLOONX',
     'splitDoubles=false 时重复对原样保留，只补奇数尾');
T.eq(pf.prepare('HIDE THE GOLD IN THE TREE STUMP', { splitDoubles: false }),
     'HIDETHEGOLDINTHETREESTUMP' + 'X', '不拆时 EE 留在原位，长度 25 → 补一个 X');

/* 自定义填充字母 */
T.eq(pf.prepare('CAT', { filler: 'Z' }), 'CATZ', '填充字母可以换');
T.eq(pf.prepare('Z', { filler: 'Z' }), 'ZQ', '换了主填充字母，备用规则照常生效');
T.eq(pf.prepare('Z', { filler: 'Z', altFiller: 'W' }), 'ZW', '备用填充字母也可以换');
T.eq(pf.prepare('CAT', { filler: 'z' }), 'CATZ', '填充字母先 normalize，小写照收');
T.throws(function () { pf.prepare('CAT', { filler: 'J' }); },
         '填充字母不能是 J', /不能是 J/);
T.throws(function () { pf.prepare('CAT', { filler: 'XY' }); },
         '填充字母必须是单个字母', /单个 A–Z 字母/);
T.throws(function () { pf.prepare('CAT', { filler: 'X', altFiller: 'X' }); },
         '主填充与备用填充不能相同', /不能相同/);

/* 三条只能靠遍历钉住的性质。它们是整页 square 与 digraph 成立的前提：
   ① 输出恒为偶数长度；② 输出里**永远没有重复对**；③ prepare 是幂等的
   （工具页把"预处理后的明文"当成两种密码共同的输入，幂等性是那件事的依据）。 */
const TEXTS = ['', 'A', 'AB', 'AAA', 'BALLOON', 'HELLO WORLD', 'XX', 'XXX', 'AXX',
               'JAZZ BAND', 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG',
               'HIDE THE GOLD IN THE TREE STUMP', 'MISSISSIPPI', 'BOOKKEEPER',
               'AAAAAAAAAAAA', 'QQQQ', 'ZZ TOP', '中文 123 !!!'];
TEXTS.forEach(function (t) {
  const p = pf.prepare(t);
  T.eq(p.length % 2, 0, JSON.stringify(t) + '：预处理输出是偶数长度');
  let bad = null;
  for (let i = 0; i < p.length; i += 2) if (p.charAt(i) === p.charAt(i + 1)) bad = p.slice(i, i + 2);
  T.eq(bad, null, JSON.stringify(t) + '：预处理输出里没有重复对');
  T.eq(p.indexOf('J'), -1, JSON.stringify(t) + '：预处理输出里没有 J');
  T.eq(pf.prepare(p), p, JSON.stringify(t) + '：prepare 对已经处理过的文本是幂等的');
});

/* ================= digraphsOf —— 纯视图，不补不拆 ================= */
T.eq(pf.digraphsOf('HIDETHE'), ['HI', 'DE', 'TH', 'E'],
     'digraphsOf 不补齐：奇数长度时最后一项长度为 1，如实返回');
T.eq(pf.digraphsOf('BALLOON'), ['BA', 'LL', 'OO', 'N'],
     'digraphsOf 不拆重复对——补与拆是 prepare 的职责');
T.eq(pf.digraphsOf(''), [], '空串没有二元组');
T.eq(pf.digraphsOf('jazz'), ['IA', 'ZZ'], 'digraphsOf 也做归一化与 J 合并');

/* ================= 三条规则，逐条手算 ================= */
/* ① 矩形：H(2,4) 与 I(1,0) 张成矩形，各取自己那一行、对方那一列 → B(2,0) M(1,4)。 */
const rHI = pf.mapPair(SQ, 'H', 'I', 1);
T.eq(rHI.rule, 'rect', 'H 与 I 既不同行也不同列 → 矩形规则');
T.eq(rHI.out, 'BM', 'HI → BM（H 取第 2 行第 0 列 = B，I 取第 1 行第 4 列 = M）');
T.eq(rHI.pa, [2, 4], 'H 在 (2,4)');
T.eq(rHI.pb, [1, 0], 'I 在 (1,0)');
T.eq(rHI.qa, [2, 0], '密文第一个字母在 (2,0)');
T.eq(rHI.qb, [1, 4], '密文第二个字母在 (1,4)');
/* 矩形规则自己是自己的逆：方向反过来结果一样。 */
T.eq(pf.mapPair(SQ, 'H', 'I', -1).out, 'BM', '矩形规则与方向无关——它自己是自己的逆');
T.eq(pf.mapPair(SQ, 'B', 'M', 1).out, 'HI', '再做一次矩形规则就回到 HI');

/* ② 同列：D(2,2) 与 E(1,2) 同在第 2 列，各自换成**下面**那一个 → O(3,2) D(2,2)。 */
const rDE = pf.mapPair(SQ, 'D', 'E', 1);
T.eq(rDE.rule, 'col', 'D 与 E 同列 → 同列规则');
T.eq(rDE.out, 'OD', 'DE → OD（各自下移一行）');
T.eq(pf.mapPair(SQ, 'O', 'D', -1).out, 'DE', '同列规则解密时上移一行');

/* ③ 同行：E(1,2) 与 X(1,3) 同在第 1 行，各自换成**右边**那一个 → X(1,3) M(1,4)。 */
const rEX = pf.mapPair(SQ, 'E', 'X', 1);
T.eq(rEX.rule, 'row', 'E 与 X 同行 → 同行规则');
T.eq(rEX.out, 'XM', 'EX → XM（各自右移一列）');
T.eq(pf.mapPair(SQ, 'X', 'M', -1).out, 'EX', '同行规则解密时左移一列');

/* ================= 边界绕回 =================
   "最右一列 → 最左一列" 与 "最下一行 → 最上一行" 是这三条规则里唯一需要取模的
   地方，也是唯一会被写成 +1 而忘记绕回的地方。忘了绕回时 charAt 越界给出空
   字符串，密文会**凭空短一个字母**而不报任何错。 */
T.eq(pf.mapPair(SQ, 'Y', 'F', 1).out, 'FP',
     '同行绕回：F 在第 0 行最右一列（0,4），右移一格回到行首 P(0,0)');
T.eq(pf.mapPair(SQ, 'F', 'P', 1).out, 'PL',
     '同行绕回：F(0,4)→P(0,0)，P(0,0)→L(0,1)');
T.eq(pf.mapPair(SQ, 'P', 'L', -1).out, 'FP', '同行解密方向的绕回：P(0,0) 左移回到 F(0,4)');
T.eq(pf.mapPair(SQ, 'Z', 'M', 1).out, 'FH',
     '同列绕回：Z 在第 4 列最下一行（4,4），下移一格回到列首 F(0,4)');
T.eq(pf.mapPair(SQ, 'F', 'H', -1).out, 'ZM', '同列解密方向的绕回：F(0,4) 上移回到 Z(4,4)');
/* 密文长度必须与明文长度相等——绕回写错时最先塌掉的就是这条。 */
T.eq(pf.encrypt('YFFPZM', KW).length, 6, '绕回没写错时密文长度与预处理后的明文相等');

/* mapPair 的两条硬拒绝 */
T.throws(function () { pf.mapPair(SQ, 'A', 'A', 1); },
         '重复对在同一个格子上，三条规则全部退化 → 当场抛', /两个字母相同/);
T.throws(function () { pf.mapPair(SQ, 'J', 'A', 1); },
         'J 不在方阵里 → 当场抛（调用方该先过 prepare）', /不在方阵里/);
T.throws(function () { pf.mapPair('ABC', 'A', 'B', 1); },
         '方阵形状不对 → 当场抛', /25 字符的方阵/);

/* ================= 教科书整段向量 ================= */
const PLAIN_BOOK = 'HIDE THE GOLD IN THE TREE STUMP';
const CIPHER_BOOK = 'BMODZBXDNABEKUDMUIXMMOUVIF';
T.eq(pf.encrypt(PLAIN_BOOK, KW), CIPHER_BOOK,
     '教科书向量：HIDE THE GOLD IN THE TREE STUMP / PLAYFAIR EXAMPLE');
T.eq(pf.decrypt(CIPHER_BOOK, KW), 'HIDETHEGOLDINTHETREXESTUMP', '同一把密钥解密回预处理后的明文');
/* 这两条并列摆在一起，是因为它们说的是同一件事的两面：解密**没有**还原原始
   拼写，插进去的那个 X 就明晃晃地留在输出里。工具页必须把这件事印在画面上。 */
T.ok(pf.decrypt(CIPHER_BOOK, KW) !== C.normalize(PLAIN_BOOK),
     '解密结果与原始拼写不同——插入的填充字母是可见的，这是 Playfair 的真实性质');
T.eq(pf.decrypt(CIPHER_BOOK, KW), pf.prepare(PLAIN_BOOK),
     '解密恰好还原到 prepare 的输出，一个字母不多不少');

/* ================= 往返（在本模块声明的预处理策略之下）================= */
const KEYWORDS = ['', 'PLAYFAIR EXAMPLE', 'MONARCHY', 'ZEBRA', 'CRYPTOGRAPHY',
                  'THE QUICK BROWN FOX', 'JJJ', 'Z'];
KEYWORDS.forEach(function (kw) {
  TEXTS.forEach(function (t) {
    const p = pf.prepare(t);
    T.eq(pf.decrypt(pf.encrypt(t, kw), kw), p,
         'kw=' + JSON.stringify(kw) + ' text=' + JSON.stringify(t) +
         '：decrypt(encrypt(t)) === prepare(t)');
    T.eq(pf.encrypt(t, kw).length, p.length,
         'kw=' + JSON.stringify(kw) + ' text=' + JSON.stringify(t) + '：密文长度 = 预处理后长度');
  });
});

/* 密文里永远不会出现重复对——这正是 decrypt 敢于不走 prepare 的依据。
   同行 / 同列换出来的两个字母必然不同（两个不同的格子右移或下移同样多），
   矩形换出来的两个字母行号不同因而也必然不同。 */
KEYWORDS.forEach(function (kw) {
  TEXTS.forEach(function (t) {
    const c = pf.encrypt(t, kw);
    let bad = null;
    for (let i = 0; i < c.length; i += 2) if (c.charAt(i) === c.charAt(i + 1)) bad = c.slice(i, i + 2);
    T.eq(bad, null, 'kw=' + JSON.stringify(kw) + ' text=' + JSON.stringify(t) +
                    '：Playfair 密文里没有重复对');
  });
});

/* Playfair 的那条对称性：AB → XY 蕴含 BA → YX。三条规则都是"位置对调"，
   所以交换输入必然交换输出。四方阵存在的理由之一就是打掉这条。 */
['HI', 'DE', 'EX', 'YF', 'ZM', 'TR', 'OL'].forEach(function (g) {
  const a = g.charAt(0), b = g.charAt(1);
  T.eq(pf.mapPair(SQ, b, a, 1).out,
       pf.mapPair(SQ, a, b, 1).out.charAt(1) + pf.mapPair(SQ, a, b, 1).out.charAt(0),
       g + '：Playfair 下 AB→XY 蕴含 BA→YX');
});

/* ================= 四方阵 =================
   关键词 EXAMPLE / KEYWORD，明文方阵是标准 25 字母表。

     左上（明文）        右上（EXAMPLE）
     A B C D E           E X A M P
     F G H I K           L B C D F
     L M N O P           G H I K N
     Q R S T U           O Q R S T
     V W X Y Z           U V W Y Z

     左下（KEYWORD）     右下（明文）
     K E Y W O           A B C D E
     R D A B C           F G H I K
     F G H I L           L M N O P
     M N P Q S           Q R S T U
     T U V X Z           V W X Y Z

   手算第一组：HE。H 在左上 (1,2)，E 在右下 (0,4)。
   密文一 = 右上[1][4] = F；密文二 = 左下[0][2] = Y  →  FY。
   （这与常见教材的同一例子首尾相符；中间几组不同，因为那些教材的明文方阵
   并掉的是 K 而不是 J，本模块整族统一用 I/J 合并。） */
const FKW1 = 'EXAMPLE', FKW2 = 'KEYWORD';
const FS = pf.fourSquares(FKW1, FKW2);
T.eq(FS.tl, pf.SQUARE_ALPHABET, '四方阵左上是标准明文方阵');
T.eq(FS.br, pf.SQUARE_ALPHABET, '四方阵右下是标准明文方阵');
T.eq(FS.tr, 'EXAMPLBCDFGHIKNOQRSTUVWYZ', '四方阵右上由关键词一生成');
T.eq(FS.bl, 'KEYWORDABCFGHILMNPQSTUVXZ', '四方阵左下由关键词二生成');
T.eq(pf.fourSquareEncrypt('HELPMEOBIWANKENOBI', FKW1, FKW2), 'FYNFNEHWBXAFFOKHMD',
     '四方阵手算整段向量');
T.eq(pf.fourSquareDecrypt('FYNFNEHWBXAFFOKHMD', FKW1, FKW2), 'HELPMEOBIWANKENOBI',
     '四方阵解密回到明文（本例长度为偶、无需补尾，所以逐字节相等）');
/* 四方阵不必拆重复对：两个字母取自不同方阵，(a,a) 一点也不退化。 */
T.eq(pf.fourSquareDecrypt(pf.fourSquareEncrypt('BALLOON', FKW1, FKW2), FKW1, FKW2),
     'BALLOONX', '四方阵保留重复对，只补奇数尾');
KEYWORDS.forEach(function (kw) {
  TEXTS.forEach(function (t) {
    T.eq(pf.fourSquareDecrypt(pf.fourSquareEncrypt(t, kw, FKW2), kw, FKW2),
         pf.prepare(t, { splitDoubles: false }),
         '四方阵往返 kw=' + JSON.stringify(kw) + ' text=' + JSON.stringify(t));
  });
});
/* 打掉了 Playfair 那条对称性：至少要有一个二元组的 AB / BA 不再互为镜像，
   否则四方阵在这一点上白做了。 */
T.ok(pf.fourSquareEncrypt('HE', FKW1, FKW2) !== 'YF',
     '四方阵下 AB→XY 不再蕴含 BA→YX（HE→FY，而 EH 并不给出 YF）');

/* ================= 二方阵（竖排）=================
   上方阵 EXAMPLE、下方阵 KEYWORD，就是上面那两个密文方阵。
   手算第一组：HE。H 在上方阵 (2,1)，E 在下方阵 (0,1)——**同列**，
   通式给出 上[2][1] + 下[0][1] = HE，明文原样透出。 */
const TS = pf.twoSquares(FKW1, FKW2);
T.eq(TS.top, FS.tr, '二方阵上方阵 = 关键词一的方阵');
T.eq(TS.bottom, FS.bl, '二方阵下方阵 = 关键词二的方阵');
T.eq(pf.twoSquareEncrypt('HELPMEOBIWANKENOBI', FKW1, FKW2), 'HECMXWSRKYXPHWNODG',
     '二方阵手算整段向量');
T.eq(pf.twoSquareEncrypt('HE', FKW1, FKW2), 'HE',
     '同列的二元组原样透出——这是二方阵最有名的弱点，通式自己给出，不需要特判');
T.eq(pf.twoSquareEncrypt('NO', FKW1, FKW2), 'NO', '另一个同列的例子');
/* 对合：加密函数自己就是解密函数。 */
T.eq(pf.twoSquareDecrypt('HECMXWSRKYXPHWNODG', FKW1, FKW2), 'HELPMEOBIWANKENOBI',
     '二方阵解密回到明文');
KEYWORDS.forEach(function (kw) {
  TEXTS.forEach(function (t) {
    const p = pf.prepare(t, { splitDoubles: false });
    T.eq(pf.twoSquareEncrypt(pf.twoSquareEncrypt(t, kw, FKW2), kw, FKW2), p,
         '二方阵是对合的 kw=' + JSON.stringify(kw) + ' text=' + JSON.stringify(t));
    T.eq(pf.twoSquareDecrypt(pf.twoSquareEncrypt(t, kw, FKW2), kw, FKW2), p,
         '二方阵往返 kw=' + JSON.stringify(kw) + ' text=' + JSON.stringify(t));
  });
});

/* ================= 顿悟视角的数值执法者 =================
   工具页第二页的主张有两半，两半都必须是**可以核对的数**，不是形容词：

     ① 单字母指纹**消失了**：Playfair 密文的字母分布远比同一段明文的单表代换
        密文平坦。度量用"对均匀分布的 χ²"（期望值 n/26），不是 cryptanalysis
        的 chiSquare（那一个量的是"像不像英文"，而单表代换密文的字母分布是英文
        分布的一个排列，对英文的 χ² 反而很大——方向完全不对）。
     ② 指纹**上移了一层**：Playfair 是二元组上的单表代换，所以密文的二元组计数
        与预处理后明文的二元组计数是**同一个多重集**，只是换了标签。这一条不是
        统计性的，是精确相等——和单表代换那一页"排完序两排完全重合"是同一句话，
        只不过发生在 600 个二元组上。

   ⚠ 二元组必须按**不重叠**的方式数（0-1、2-3、…）。cryptanalysis.ngramCounts
   是**滑动窗口**（0-1、1-2、2-3、…），它数出来的 bigram 有一半跨在两个二元组
   之间，而 Playfair 对那一半毫无约束——用它去验证 ② 会得到一个必然失败的
   断言，而失败的原因与密码本身无关。 */

/* 这一段是本测试自己的语料，与工具页默认那段不是同一份文本（两处各自拥有
   自己的教学文本，就不需要靠人记住去同步）。选它的标准与 examples-classical.js
   一样：自造英文、无版权顾虑、长到让字母与二元组统计有意义。 */
const CORPUS =
  'A cipher that must be worked by hand in a tent at night has to be simple enough to ' +
  'remember and strong enough to matter. The clerk carries no machine and no printed ' +
  'table. He carries one word. From that word he rules a small grid of five rows by ' +
  'five columns and fills it out from memory, and the grid is the whole secret. Two ' +
  'letters at a time he reads them off, and two letters at a time he writes them down, ' +
  'and the work goes on by lamplight until the message is done. Nothing in it is ' +
  'arithmetic. There is no adding, no carrying, no counting on the fingers. There is ' +
  'only a pair of letters and the shape they make in the grid, and the answer is the ' +
  'shape that pair makes read the other way about.';

/* 对均匀分布的 χ²：Σ (观测 − n/26)² / (n/26)。越小越平。
   一段真正均匀随机的文本期望值是自由度 25 左右；英文在 n≈600 时是几百。 */
function flatChi(text) {
  const counts = CA.letterCounts(text);
  let n = 0;
  for (let i = 0; i < 26; i++) n += counts[i];
  if (n === 0) return 0;
  const e = n / 26;
  let x2 = 0;
  for (let i = 0; i < 26; i++) {
    const d = counts[i] - e;
    x2 += d * d / e;
  }
  return x2;
}

/* 不重叠的二元组计数。返回按次数降序的计数数组（只要形状，不要标签——
   "同一个多重集"这句话说的正是排序后的计数序列相等）。 */
function digraphProfile(text) {
  const m = new Map();
  const gs = pf.digraphsOf(text);
  for (let i = 0; i < gs.length; i++) {
    if (gs[i].length < 2) continue;
    m.set(gs[i], (m.get(gs[i]) || 0) + 1);
  }
  const out = [];
  m.forEach(function (v) { out.push(v); });
  out.sort(function (a, b) { return b - a; });
  return out;
}

/* 两种密码喂**同一份**输入：预处理后的明文。prepare 幂等（上面钉过），
   所以 Playfair 再处理一次不会改动它；单表代换也就与它逐字母对齐，
   两条密文长度相同、字母总数相同——这是让两个 χ² 可比的唯一办法。 */
const PREPPED = pf.prepare(CORPUS);
const PF_CIPHER = pf.encrypt(PREPPED, KW);
const SUB_CIPHER = sub.encrypt(PREPPED, sub.keyFromKeyword(KW));

T.eq(PF_CIPHER.length, PREPPED.length, 'Playfair 密文与预处理后的明文等长');
T.eq(SUB_CIPHER.length, PREPPED.length, '单表代换密文与预处理后的明文等长');

const CHI_PLAIN = flatChi(PREPPED);
const CHI_SUB = flatChi(SUB_CIPHER);
const CHI_PF = flatChi(PF_CIPHER);

/* 单表代换只换标签不换计数，所以它对均匀分布的 χ² 与明文**完全相等**。
   这条断言同时也是 flatChi 自己的自检：它必须是一个只看计数多重集的量。 */
T.ok(Math.abs(CHI_SUB - CHI_PLAIN) < 1e-9,
     '单表代换密文的平坦度 χ² 与明文完全相等（' + CHI_PLAIN.toFixed(1) +
     '）——它换的是标签，不是计数');

/* 实测（这段语料、五把不同的关键词）：Playfair 的 χ² 在 183–223 之间，
   单表代换恒为 438.3，比值 1.97–2.40 倍。门槛因此定在 1.6 倍——留出语料长度
   与关键词造成的波动余量，而不是贴着某一次的实测值写死（贴着写，换一段教学
   文本就会莫名其妙地红）。 */
T.ok(CHI_PF * 1.6 < CHI_SUB,
     'Playfair 密文的单字母分布明显比单表代换密文平坦：χ² ' + CHI_PF.toFixed(1) +
     ' vs ' + CHI_SUB.toFixed(1) + '（比值 ' + (CHI_SUB / CHI_PF).toFixed(2) + '×）');

/* 反方向的那条，同样必须钉住：**Playfair 并没有把单字母指纹压平**。
   完全均匀时 χ² 的期望是自由度 25，再加上 J 那一格恒为 0 贡献的 n/26，
   合起来大约 45；实测的 218 离它还有很远。教学页上"几乎平坦"这种说法是
   夸张的，这条断言就是防止有人把页面上的措辞往那个方向推。
   同一件事换 IoC 说：英文 0.067、25 个字母均匀随机 0.040，Playfair 落在
   0.050 上下——被抹掉的大约是**超出随机那部分的六成**，不是全部。 */
const FLOOR = 25 + PREPPED.length / 26;
T.ok(CHI_PF > FLOOR * 2,
     'Playfair 远没有把单字母分布压到均匀：χ² ' + CHI_PF.toFixed(1) +
     ' 仍是完全平坦时期望值（≈' + FLOOR.toFixed(0) + '）的数倍');
const IOC_PLAIN = CA.indexOfCoincidence(PREPPED);
const IOC_PF = CA.indexOfCoincidence(PF_CIPHER);
T.ok(IOC_PF < IOC_PLAIN - 0.01,
     'Playfair 把重合指数从 ' + IOC_PLAIN.toFixed(4) + ' 压到 ' + IOC_PF.toFixed(4));
T.ok(IOC_PF > 1 / 25,
     '但它没有压到 25 个字母均匀随机的 0.0400 —— 残留的信号是真实存在的');

/* ② 指纹上移了一层：二元组的计数被精确保留。 */
const PROF_PLAIN = digraphProfile(PREPPED);
const PROF_PF = digraphProfile(PF_CIPHER);
T.eq(PROF_PF, PROF_PLAIN,
     'Playfair 密文的二元组计数与明文是同一个多重集——指纹没有消失，只是上移了一层');
T.ok(PROF_PLAIN[0] >= 4,
     '这段语料的最高频二元组出现了 ' + PROF_PLAIN[0] + ' 次——二元组分布确实是偏斜的，' +
     '不是每个都只出现一次的一片平地');

/* 四方阵与二方阵同样是二元组上的单表代换，所以同一条精确相等对它们也成立。
   这一点很重要：它否掉了"多加几个方阵可以把二元组统计压平"这个直觉。
   （用不拆重复对的那份预处理来比，因为这两族走的是那条路。） */
const PREPPED_NS = pf.prepare(CORPUS, { splitDoubles: false });
T.eq(digraphProfile(pf.fourSquareEncrypt(PREPPED_NS, FKW1, FKW2)), digraphProfile(PREPPED_NS),
     '四方阵同样精确保留二元组计数——多两个方阵并没有压平二元组统计');
T.eq(digraphProfile(pf.twoSquareEncrypt(PREPPED_NS, FKW1, FKW2)), digraphProfile(PREPPED_NS),
     '二方阵同样精确保留二元组计数');

/* 二方阵的同列透明率：随机情形下两个字母同列的概率是 1/5，也就是大约每五个
   二元组就有一个明文照抄进密文。这里只钉一个宽松的区间——它是一条统计性质，
   把门槛写死在实测值上会让下一段语料无端变红。 */
(function () {
  const a = pf.digraphsOf(PREPPED_NS);
  const b = pf.digraphsOf(pf.twoSquareEncrypt(PREPPED_NS, FKW1, FKW2));
  let same = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) same++;
  const rate = same / a.length;
  T.ok(rate > 0.08 && rate < 0.35,
       '二方阵有 ' + same + '/' + a.length + ' = ' + (rate * 100).toFixed(1) +
       '% 的二元组原样透出（理论值 1/5）');
})();

/* 把三个数打印出来。断言只说"关系成立"，这一行说"成立到什么程度"——
   换语料、换实现之后，人一眼就能看见量级有没有变。 */
console.log('  平坦度 χ²（对均匀分布，n=' + PREPPED.length + '）：' +
            '明文 ' + CHI_PLAIN.toFixed(1) +
            ' · 单表代换 ' + CHI_SUB.toFixed(1) +
            ' · Playfair ' + CHI_PF.toFixed(1) +
            ' · 完全平坦时约 ' + FLOOR.toFixed(0) +
            '  →  ' + (CHI_SUB / CHI_PF).toFixed(2) + '× 更平，但没到平');
console.log('  重合指数 IoC：明文 ' + IOC_PLAIN.toFixed(4) +
            ' · Playfair ' + IOC_PF.toFixed(4) +
            ' · 25 字母均匀随机 0.0400  →  抹掉了超出随机部分的 ' +
            (((IOC_PLAIN - IOC_PF) / (IOC_PLAIN - 0.04)) * 100).toFixed(0) + '%');
console.log('  二元组最高频次：明文 ' + PROF_PLAIN[0] + ' · Playfair 密文 ' + PROF_PF[0] +
            '（不同的二元组，同一组计数）');

T.report('playfair');
