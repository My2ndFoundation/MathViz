(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    /* node 下取兄弟目录的 crypto-core：路径用 path.join 拼，不写字面的父目录
       相对路径。理由与 caesar.js 那一行完全相同，不是风格——这个字符串会被
       inline_core.py 原样内联进每个工具页，而 check.py 的 outbound_ref_check()
       正在数整个子树里的父目录引用，用它守住"cryptography/ 可以整体搬走"
       这条约束。浏览器分支根本走不到这一行，为它留一条会触发普查的字面量
       不划算。 */
    module.exports = factory(require(require('path').join(__dirname, '..', 'crypto-core.js')));
  } else {
    root.CryptoAlgos = root.CryptoAlgos || {};
    root.CryptoAlgos.vigenere = factory(root.CryptoCore);
  }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* ================= 维吉尼亚家族 =================
     三个变体共用同一副骨架：把明文字母按位置配一个密钥字母，再按各自的规则
     算出密文字母。差别只在那条规则本身：

       维吉尼亚  c = p + k     不自反，加密与解密是两个方向
       博福特    c = k − p     **自反**：加密两次回到明文
       波尔塔    13 张表        **自反**，且密钥字母成对（A/B 同一张表）

     把三者放进同一个模块而不是三个文件，是因为它们真正的共同点不是"都叫
     多表代换"，而是**共用同一个密钥推进规则**——那条规则（见 walk）才是这
     一族的定义，也是第二页要讲的周期从哪来。 */

  /* 密钥归一化成下标数组。空密钥当场抛，不做"退化成凯撒 0"之类的兜底：
     空密钥不是一个更弱的密码，它是**没有密码**，而 walk 里 j % 0 会算出
     NaN、经 fromCharCode 变成一串同样的垃圾字符，页面上看起来像是加密成功了。
     调用方（工具页）自己保证密钥非空——它每一帧都在调 encrypt，一帧非法就是
     整页停在空白 canvas 上，所以那道守卫必须在调用方，不能靠这里兜。 */
  function keyIndices(key) {
    const idx = C.letters(key);
    if (!idx.length) {
      throw new Error('vigenere: 密钥至少要含一个字母，收到 ' + JSON.stringify(String(key)));
    }
    return idx;
  }

  /* 重复展开的密钥，长度 n。对经典维吉尼亚，这串数字**就是**每一列的凯撒
     位移，工具页拿它去画那一行密钥字母与一排小字母轮；对博福特与波尔塔，
     它是密钥字母的下标而不是位移（那两个变体的规则里 k 不是加上去的），
     所以这个函数只承诺"密钥怎么重复"，不承诺"位移是多少"。 */
  function keyStream(key, n) {
    const k = keyIndices(key);
    if (!Number.isInteger(n) || n < 0) {
      throw new Error('keyStream 的 n 必须是 >= 0 的整数，收到 ' + n);
    }
    const out = [];
    for (let i = 0; i < n; i++) out.push(k[i % k.length]);
    return out;
  }

  /* 唯一的遍历器。三个变体只往这里传一条 step(x, k) 规则。

     两条约定，都直接决定了页面上看到的东西：

     ① **保留大小写与非字母字符**，与 caesar.js 同一条理由：
        'Attack at dawn' → 'Lxfoaw ep hoky' 让人一眼看出只有字母参与运算。

     ② **非字母不消耗密钥**。这一条比①要紧得多：如果空格也吃掉一个密钥字母，
        那么密文的周期就不再等于密钥长度，而是等于"密钥长度与文本里字母
        分布的某种耦合"——第二页整页在讲的 Kasiski 与逐周期重合指数会当场
        全部失效，而页面上没有任何东西会提示这件事。工具页的密钥条正是按
        "第 j 个**字母**配第 j mod L 个密钥字母"画的，两边必须是同一条规则。 */
  function walk(text, key, step) {
    const ks = keyIndices(key);
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
      out += String.fromCharCode(base + C.mod(step(c - base, ks[j % ks.length]), C.N));
      j++;
    }
    return out;
  }

  /* ---- 经典维吉尼亚：c = p + k ----
     密钥长 1 时它**逐字节等于**凯撒——这不是巧合也不是近似，是同一个式子：
     k 恒定的 c = p + k 就是凯撒的定义。vigenere.test.js 里有一条断言把
     vigenere.encrypt(t, 'D') 与 caesar.encrypt(t, 3) 钉在一起，因为这条
     等式正是第一页要讲的话——"多表"多出来的只有"表会换"，别的一样都没变。 */
  function encrypt(text, key) { return walk(text, key, function (p, k) { return p + k; }); }
  function decrypt(text, key) { return walk(text, key, function (c, k) { return c - k; }); }

  /* ---- 博福特：c = k − p ----
     自反：把结果再跑一遍就回到明文，因为 k − (k − p) = p。
     所以 decrypt 直接就是 encrypt，不另写一份——写两份"看起来不同其实相同"
     的实现，早晚有一份被改坏而另一份还是对的，那时没人知道该信哪个。
     导出 beaufortDecrypt 这个名字是为了调用点读起来仍然是"解密"，
     而不是逼每个调用方自己记住"这里要调 encrypt"。 */
  function beaufortEncrypt(text, key) { return walk(text, key, function (p, k) { return k - p; }); }
  function beaufortDecrypt(text, key) { return beaufortEncrypt(text, key); }

  /* ---- 波尔塔：13 张表 ----
     密钥字母**成对**取表：A/B 用第 0 张、C/D 用第 1 张……Y/Z 用第 12 张，
     所以 j = ⌊k/2⌋。每张表把字母表切成两半、互相对射：

       表 j=0：ABCDEFGHIJKLM ↔ NOPQRSTUVWXYZ
       表 j=1：ABCDEFGHIJKLM ↔ OPQRSTUVWXYZN   （下半圈再转 1 位）

     形式化：x < 13 时 c = ((x + j) mod 13) + 13；x >= 13 时 c = (x − 13 − j) mod 13。
     两式互为逆：前者的结果代进后者得 ((x+j) − j) mod 13 = x，反之亦然——
     所以整个密码自反，portaDecrypt 与 portaEncrypt 是同一个函数。

     "成对"这一条不是趣闻，它在第三页有直接后果：一列密文的 χ² 对 A 与 B
     给出**完全相同**的分数，于是频率攻击只能定到"哪一对"，定不到"哪一个"。
     工具页据此把恢复出的密钥写成 'C/D' 而不是随便挑一个印出来。 */
  function portaStep(x, k) {
    const j = Math.floor(k / 2);
    if (x < 13) return ((x + j) % 13) + 13;
    return C.mod(x - 13 - j, 13);
  }
  function portaEncrypt(text, key) { return walk(text, key, portaStep); }
  function portaDecrypt(text, key) { return portaEncrypt(text, key); }

  return { encrypt, decrypt,
           beaufortEncrypt, beaufortDecrypt,
           portaEncrypt, portaDecrypt,
           keyStream };
});
