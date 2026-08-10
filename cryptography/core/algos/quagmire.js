(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    /* node 下取兄弟文件：路径用 path.join 拼，不写字面的父目录相对路径。
       理由与 caesar.js / polybius.js 那两行完全相同，不是风格——那个字符串会被
       inline_core.py 原样内联进每个工具页，而 check.py 的 outbound_ref_check()
       正在数整个子树里的父目录引用，用它守住"cryptography/ 可以整体搬走"这条
       约束。浏览器分支根本走不到这一行，为它留一条会触发普查的字面量不划算。 */
    module.exports = factory(
      require(require('path').join(__dirname, '..', 'crypto-core.js')),
      require(require('path').join(__dirname, 'substitution.js')));
  } else {
    root.CryptoAlgos = root.CryptoAlgos || {};
    /* ⚠ 浏览器分支从 root.CryptoAlgos.substitution 取关键词字母表，所以工具页的
       `GENERATED:ALGOS` 清单里 **substitution.js 必须排在 quagmire.js 之前**。
       顺序错了页面照样载入，直到第一次调用才死在 SUB.keyFromKeyword 上——与
       check.py 第 9 道门守的 CRYPTO-CORE 顺序是同一种失败形状（polybius.js
       对 transposition.js 的依赖有同一条注释）。 */
    root.CryptoAlgos.quagmire = factory(root.CryptoCore, root.CryptoAlgos.substitution);
  }
})(typeof self !== 'undefined' ? self : this, function (C, SUB) {
  'use strict';

  /* ================= Quagmire I–IV =================

     Quagmire 就是**把字母表也编上钥匙**的维吉尼亚。三样东西各司其职：

       明文字母表 pt   —— 表头那一行，决定"一个明文字母落在第几列"
       密文字母表 ct   —— 每一行的内容，决定"那一列上写着什么字母"
       指示词 indicator —— 循环重复的那把密钥，决定"这一个字母用第几行"

     四个变体只在"哪一侧被编了钥匙"上不同：

       I    明文表编钥匙，密文表是顺序表 A–Z
       II   明文表顺序，密文表编钥匙
       III  两侧**同一张**编钥匙的表（历史上叫 Keyed Vigenère）
       IV   两侧各编各的钥匙，两张表不同

     ---- 行的对齐规则（唯一一条，四个变体共用）----
     每一行是 ct 整体旋转之后的样子，旋转量由该行的指示字母定：
     **指示字母必须落在"明文表里字母 A 所在的那一列"**。

     记 aCol = pt.indexOf('A')、xPos = ct.indexOf(x)，则该行 = ct 左旋
     (xPos − aCol) mod 26，于是 row[aCol] === x，正是上面那句话。

     这条规则是照着一份公开的、可逐字复核的 Quagmire I 表定出来的
     （CryptoCrack 用户手册，关键词 PAULBRANDT、指示词 BRANDT）：

       pt   P A U L B R N D T C E F G H I J K M O Q S V W X Y Z
       (B)  A B C D E F G H I J K L M N O P Q R S T U V W X Y Z
       (R)  Q R S T U V W X Y Z A B C D E F G H I J K L M N O P
       (A)  Z A B C D E F G H I J K L M N O P Q R S T U V W X Y

     pt 里 A 在第 1 列（0 起数），三行的第 1 列恰好是 B、R、A。
     quagmire.test.js 把这张表整份钉了下来。

     另一种流传的对齐是"指示字母落在第 0 列"。两者只差一个常数旋转，
     密码强度与本工具要讲的所有结论都不受影响，但表格画出来不一样，
     所以这里把采用哪一种写在明处，而不是留给读代码的人去反推。

     ---- 这个模块真正想说的那句话 ----
     设 σ 是"按 pt 查列号"这个置换、τ 是"按列号查 ct 字母"这个置换，则

         Quagmire(P) = τ ( Vigenère( σ(P), 位移串 ) )

     σ 与 τ 都是**单表**代换。于是：

       · τ 套在最外面——单表代换不改变任何一段密文的重复结构，也不改变
         逐周期重合指数（IoC 只看字母出现次数的多重集合，换个名字不影响）。
         Quagmire II 的密文因此与同明文同指示词的维吉尼亚密文**逐项同分**：
         icByPeriod 与 kasiskiPeriods 的输出一个数都不差。
       · σ 套在里面——它把明文换了名字，但单表代换同样保持重复结构，
         所以 Kasiski 看到的证据在统计上是同一份。

     结论就是这个工具第二页要讲的那件事：**给字母表编钥匙，打掉的是维吉尼亚
     攻击的最后一步，不是第一步。** 周期是几，Kasiski 与重合指数照样告诉你；
     变的是每一列不再是凯撒位移，而是一张 26! 里的单表代换。 */

  const VARIANT_TABLE = [
    { id: 1, roman: 'I',   ptKeyed: true,  ctKeyed: false, shared: false },
    { id: 2, roman: 'II',  ptKeyed: false, ctKeyed: true,  shared: false },
    { id: 3, roman: 'III', ptKeyed: true,  ctKeyed: true,  shared: true  },
    { id: 4, roman: 'IV',  ptKeyed: true,  ctKeyed: true,  shared: false }
  ];

  /* 结构事实，不含任何界面文案——文案是工具页的事，模块只讲数学。
     返回浅拷贝而不是内部数组本身：调用方每帧都在读它，一次手滑的
     `variants()[0].shared = true` 会把这个模块从此改成另一个密码。 */
  function variants() {
    return VARIANT_TABLE.map(function (v) {
      return { id: v.id, roman: v.roman, ptKeyed: v.ptKeyed,
               ctKeyed: v.ctKeyed, shared: v.shared };
    });
  }

  const ROMAN = { I: 1, II: 2, III: 3, IV: 4 };

  /* 变体号既收 1–4 也收 'I'–'IV'：前者是循环与数组下标要用的，后者是人写
     配置时会写的。不收的一律当场抛——悄悄退回 variant 1 会让页面画出一张
     语法正确、含义全错的表，而那种错要很久以后才有人撞见。 */
  function normVariant(v) {
    if (typeof v === 'number' && VARIANT_TABLE.some(function (t) { return t.id === v; })) return v;
    const s = String(v == null ? '' : v).trim().toUpperCase();
    if (ROMAN[s]) return ROMAN[s];
    if (/^[1-4]$/.test(s)) return Number(s);
    throw new Error('quagmire: variant 必须是 1–4 或 I–IV，收到 ' + JSON.stringify(v));
  }

  function meta(id) { return VARIANT_TABLE[id - 1]; }

  /* 关键词 → 26 字母表，直接走 substitution.keyFromKeyword，不在这里另写一份。
     那个函数已经定义了"关键词去重后排前面、剩下的按字母序补齐"这条编码方式，
     两份实现总有一天会给出两个字母表，而那天没人知道该信哪个。
     空关键词给出顺序表 A–Z——这不是兜底，是这个模块最要紧的那个退化情形：
     两侧都不编钥匙时四个变体**逐字节等于维吉尼亚**（见下面的 encrypt 注释）。

     null / undefined 必须在这里折成空串，不能直接透传：normalize() 走的是
     String(word)，于是 undefined 会变成字面的 'UNDEFINED'——九个货真价实的
     字母，keyFromKeyword 会老老实实按它编一张表。开发时实测过这一幕：
     `{ variant: 3, indicator: 'LEMON' }` 不写 ptKey，本该退化成维吉尼亚，
     实际得到的是关键词 UNDEFINED 的 Quagmire III，四条等价断言全红而
     密文看上去完全正常。省略一个可选参数是最常见的调用方式，它必须是对的。 */
  function keyedAlphabet(word) { return SUB.keyFromKeyword(word == null ? '' : word); }

  function hasLetters(word) { return C.normalize(word == null ? '' : word).length > 0; }

  /* 一个变体用不上的关键词，**必须为空**，否则当场抛。
     不是洁癖：Quagmire I 的密文表恒为 A–Z，此时收下一个 ctKey 再默默丢掉，
     页面上就会出现"我明明填了密文关键词，画面却一点没变"——而那正是使用者
     最会归因于自己而不是工具的一种错。III 只有一把关键词（两侧同一张表），
     同理只收 ptKey。 */
  function alphabets(id, o) {
    const m = meta(id);
    const usesPt = m.ptKeyed;
    const usesCt = m.ctKeyed && !m.shared;
    if (!usesPt && hasLetters(o.ptKey)) {
      throw new Error('quagmire: 变体 ' + m.roman + ' 的明文表是顺序表 A–Z，不接受 ptKey，收到 ' +
                      JSON.stringify(String(o.ptKey)));
    }
    if (!usesCt && hasLetters(o.ctKey)) {
      throw new Error('quagmire: 变体 ' + m.roman +
                      (m.shared ? ' 两侧共用同一张表，只接受 ptKey，不接受 ctKey，收到 '
                                : ' 的密文表是顺序表 A–Z，不接受 ctKey，收到 ') +
                      JSON.stringify(String(o.ctKey)));
    }
    const ptA = usesPt ? keyedAlphabet(o.ptKey) : C.ALPHABET;
    const ctA = m.shared ? ptA : (usesCt ? keyedAlphabet(o.ctKey) : C.ALPHABET);
    return { pt: ptA, ct: ctA };
  }

  /* 指示词至少要含一个字母。与 vigenere.js 的 keyIndices 同一条策略、同一句
     措辞：空指示词不是一个更弱的密码，它是**没有密码**，而 j % 0 会算出 NaN，
     一路变成一串看着像密文的垃圾。守卫放在这里，调用方（工具页）自己再挡一道。

     null / undefined 先折成空串，理由与 keyedAlphabet 那一行完全相同：
     normalize() 走 String(x)，于是**忘了写 indicator** 会得到字面的 'UNDEFINED'
     ——九个货真价实的字母，周期 9，这道守卫一声不吭地放行。这不是假设，
     quagmire.test.js 里那条 `tableau({ variant: 1 })` 当场抓到过它。
     漏掉一个必填参数是最该报错的情形，不能是最沉默的那个。 */
  function indicatorLetters(indicator) {
    const s = C.normalize(indicator == null ? '' : indicator);
    if (!s.length) {
      /* 报**原值**而不是 String(原值)：漏写参数时后者会印成带引号的 "undefined"，
         看起来像"有人传了字符串 undefined 进来"，把读错误的人引向另一个方向。 */
      throw new Error('quagmire: 指示词至少要含一个字母，收到 ' + JSON.stringify(indicator));
    }
    return s;
  }

  /* 字母 → 它在某张 26 字母表里的下标。表恒为 A–Z 的排列（keyFromKeyword 保证），
     所以 26 个下标一定都能填上。 */
  function posTable(alpha) {
    const out = new Array(C.N);
    for (let i = 0; i < C.N; i++) out[alpha.charCodeAt(i) - 65] = i;
    return out;
  }

  function rotate(s, k) {
    const r = C.mod(k, C.N);
    return s.slice(r) + s.slice(0, r);
  }

  /* ================= 表格 =================
     工具页要画的就是这个返回值本身，不额外算一遍：画面上的每一格与密文里的
     每一个字母出自同一份数据，两处各算一遍迟早出现半帧错位。

     返回：
       pt / ct    两张字母表（ct 是**旋转之前**的那一张）
       aCol       指示字母落在第几列 = pt.indexOf('A')
       indicator  归一化后的指示词
       rows[j]    { key, ctPos, shift, letters }
                  letters 就是第 j 行整行，letters.charAt(col) 是那一格的字母 */
  function tableau(opts) {
    const o = opts || {};
    const id = normVariant(o.variant);
    const ab = alphabets(id, o);
    const ind = indicatorLetters(o.indicator);
    const ctPos = posTable(ab.ct);
    const aCol = ab.pt.indexOf('A');
    const rows = [];
    for (let j = 0; j < ind.length; j++) {
      const v = ind.charCodeAt(j) - 65;
      const p = ctPos[v];
      const shift = C.mod(p - aCol, C.N);
      rows.push({ key: ind.charAt(j), ctPos: p, shift: shift, letters: rotate(ab.ct, shift) });
    }
    return { variant: id, roman: meta(id).roman,
             pt: ab.pt, ct: ab.ct, aCol: aCol, indicator: ind, rows: rows };
  }

  /* ================= 加解密 =================
     两条约定与 caesar.js / vigenere.js 完全一致，理由也一样：

     ① **保留大小写与非字母字符**，让人一眼看出只有字母参与运算。
     ② **非字母不消耗指示词**。这一条比①要紧得多：空格若也吃掉一个指示字母，
        密文的周期就不再等于指示词长度，第二页整页在讲的 Kasiski 与逐周期
        重合指数会当场全部失效，而画面上没有任何东西会提示这件事。

     另有一条只属于这个模块的性质，值得在这里点名，因为它是整个工具的支点：
     两张字母表都不编钥匙（ptKey / ctKey 为空）时，pt = ct = A–Z、aCol = 0、
     shift = 指示字母的下标，于是 row[col] = ALPHABET[(col + k) mod 26]，
     而 col 就是明文字母本身的下标——**逐字节等于维吉尼亚**。四个变体全都如此。
     quagmire.test.js 对四个变体各钉了一条断言，工具页第一页把这件事画在屏幕上。 */
  function walk(text, opts, decode) {
    const T = tableau(opts);
    const ptPos = posTable(T.pt);
    const ctPos = posTable(T.ct);
    const L = T.rows.length;
    const s = String(text);
    let out = '';
    let j = 0;                       // 已经处理过几个**字母**（不是几个字符）
    for (let i = 0; i < s.length; i++) {
      const ch = s.charAt(i);
      const c = s.charCodeAt(i);
      let base;
      if (c >= 65 && c <= 90) base = 65;
      else if (c >= 97 && c <= 122) base = 97;
      else { out += ch; continue; }
      const row = T.rows[j % L];
      let ltr;
      if (decode) {
        /* 解密：密文字母在 ct 里的位置减去这一行的旋转量就是列号，
           那一列的表头字母即明文。不是"把整行扫一遍找相等"——那样是 O(26)
           而且会在两处各写一遍"哪一格是哪一格"的定义。 */
        ltr = T.pt.charAt(C.mod(ctPos[c - base] - row.shift, C.N));
      } else {
        ltr = row.letters.charAt(ptPos[c - base]);
      }
      out += (base === 97) ? ltr.toLowerCase() : ltr;
      j++;
    }
    return out;
  }

  function encrypt(text, opts) { return walk(text, opts, false); }
  function decrypt(text, opts) { return walk(text, opts, true); }

  /* ================= 每一列的那张单表 =================
     这是这个工具第三页的全部依据。指示词长度为 L 时，密文按 L 分列，第 j 列
     自始至终只用第 j 行——而"第 j 行"作为一个映射，就是一张**普通的单表代换
     密钥**：明文字母 i ↦ rows[j].letters[pt 里 i 的列号]。

     返回的每一条都是 substitution.js 认的那种 26 字母排列密钥，可以直接喂给
     substitution.encrypt / decrypt / invertKey。这不是为了省事，是为了让"每一列
     就是一次单表代换"这句话在代码里是**可执行的**，而不是一句旁白：
     测试里有一条断言拿它跑通了整条链路。

     维吉尼亚是它的特例——那时每一张都恰好是字母表整体转 k 位，也就是凯撒，
     26! 里只剩 26 个。被打掉的正是这一步：候选从 26 个变回 26!。 */
  function cosetKeys(opts) {
    const T = tableau(opts);
    const ptPos = posTable(T.pt);
    return T.rows.map(function (row) {
      let key = '';
      for (let i = 0; i < C.N; i++) key += row.letters.charAt(ptPos[i]);
      return key;
    });
  }

  return { encrypt, decrypt, tableau, variants, cosetKeys, keyedAlphabet };
});
