(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    /* node 下取兄弟目录的 crypto-core：路径用 path.join 拼，不写字面的父目录
       相对路径。理由与 caesar.js / vigenere.js 那两行完全相同，不是风格——这个
       字符串会被 inline_core.py 原样内联进每个工具页，而 check.py 的
       outbound_ref_check() 正在数整个子树里的父目录引用，用它守住
       "cryptography/ 可以整体搬走"这条约束。浏览器分支根本走不到这一行，
       为它留一条会触发普查的字面量不划算。 */
    module.exports = factory(require(require('path').join(__dirname, '..', 'crypto-core.js')));
  } else {
    root.CryptoAlgos = root.CryptoAlgos || {};
    const mod = factory(root.CryptoCore);
    /* **两个键指向同一个对象，不是两份实现。**
       工具页读 CryptoAlgos.streamClassical（JS 里的驼峰命名），而 check.py 的
       algos_gate 是拿**文件名**去 root 上找的（`stream-classical.js` → 去掉
       后缀就是它要的键）。文件名带连字符，在 JS 里当标识符写不出来，于是
       两边天然对不上：只挂驼峰名，那道门会报 "CryptoAlgos.stream-classical
       未挂上 root"；只挂连字符名，页面第一次调用就是 undefined。
       同时挂两个键、指向同一个 mod，是让"门检查的东西"与"页面用的东西"
       真的是同一份——而不是各写一份将来各自漂移。 */
    root.CryptoAlgos.streamClassical = mod;
    root.CryptoAlgos['stream-classical'] = mod;
  }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* ================= 古典流密码：自动密钥与滚动密钥 =================
     维吉尼亚倒下，是因为密钥**重复**：周期一旦被认出来，密文就塌回成 n 个
     各自独立的凯撒。这一族的做法是把重复本身拿掉——密钥不再循环，而是一路
     取自一段和报文一样长的字母流：

       自动密钥 autokey      密钥 = 引钥(primer) 接上**明文自己**
                             k_i = primer_i        (i < L)
                             k_i = p_{i-L}         (i >= L)
       滚动密钥 running key  密钥 = **另一段英文**
                             k_i = key_i

     两者的加密规则都还是 c = p + k (mod 26)，与维吉尼亚逐字节相同；差别只在
     那条密钥流从哪儿来。所以它们不是"更强的多表代换"，而是同一个多表代换
     换了一份密钥流——这正是本模块要让页面画出来的东西。

     两条与 vigenere.js 完全一致的约定，不是抄，是必须相同：

     ① **保留大小写与非字母字符**。'Attack at dawn' 一眼看出只有字母参与运算。
     ② **非字母不消耗密钥**。若空格也吃掉一个密钥字母，自动密钥的"第 i 个
        密钥字母就是第 i−L 个明文字母"这条关系会随标点漂移，而页面上那条
        从明文格连到密钥格的丝带正是按这条关系画的——两边必须是同一条规则。

     还有一条只属于本模块的：**自动密钥的密钥流由明文定义，不由密文定义。**
     所以 keyStreamOf('autokey', …) 的第二参必须是明文；拿密文去调它会算出
     一串没有意义的字母，而不会报错。解密时密钥流是一边解一边长出来的
     （见 autokeyDecrypt），这也正是它"错一个字母就一路错下去"的来源。 */

  const MODE_AUTOKEY = 'autokey';
  const MODE_RUNNING = 'running';

  /* 密钥归一化成下标数组。空密钥当场抛，理由与 vigenere.js 的 keyIndices
     一字不差：空密钥不是一个更弱的密码，它是**没有密码**，而 j % 0 会算出
     NaN、经 fromCharCode 变成一串垃圾字符，页面上看起来像加密成功了。
     调用方（工具页）自己保证非空——它每一帧都在调 encrypt，一帧非法就是
     整页停在空白 canvas 上，所以那道守卫必须在调用方，不能靠这里兜。 */
  function keyIndices(key, what) {
    const idx = C.letters(key);
    if (!idx.length) {
      throw new Error(what + '至少要含一个字母，收到 ' + JSON.stringify(String(key)));
    }
    return idx;
  }

  /* 逐字母遍历器。step(p, k, j) 给出这一位的输出下标；next(p, c, j) 在这一位
     算完之后被调用，让自动密钥把**刚刚确定的明文字母**推进密钥流里。
     加密时那个明文字母是输入，解密时是刚解出来的输出——两条路唯一的差别
     就在这里，所以只写一个遍历器、由调用方决定往 next 里塞什么。 */
  function walk(text, keyAt, step, next) {
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
      const x = c - base;
      const k = keyAt(j);
      const y = C.mod(step(x, k), C.N);
      out += String.fromCharCode(base + y);
      if (next) next(x, y, j);
      j++;
    }
    return out;
  }

  /* ---- 自动密钥 ----
     加密：密钥流 = 引钥 + 明文。明文是输入，所以 next 记录输入的那个下标。 */
  function autokeyEncrypt(text, primer) {
    const pr = keyIndices(primer, 'autokey 的引钥');
    const plain = [];
    return walk(text,
      function (j) { return j < pr.length ? pr[j] : plain[j - pr.length]; },
      function (p, k) { return p + k; },
      function (p) { plain.push(p); });
  }

  /* 解密：密钥流同样是 引钥 + 明文，但明文要一位一位**解出来之后**才有。
     这条自举正是自动密钥的性格：第 i 位解错，第 i+L 位的密钥就错，错误
     每隔 L 位复制一次，一路传到报文末尾。第三页那条"一次正确的猜测会
     传播出去"讲的是同一件事的正面。 */
  function autokeyDecrypt(text, primer) {
    const pr = keyIndices(primer, 'autokey 的引钥');
    const plain = [];
    return walk(text,
      function (j) { return j < pr.length ? pr[j] : plain[j - pr.length]; },
      function (c, k) { return c - k; },
      function (c, p) { plain.push(p); });
  }

  /* ---- 滚动密钥 ----
     密钥是另一段英文，长度不够时**循环**。循环回去就等于把周期请了回来，
     所以这不是一个可以静悄悄发生的退化：keyStreamOf 会把 wrapped 报出来，
     工具页据此打一条橙色横幅，第二页那条"平的曲线"也会当场长出峰来——
     那正是这一族真正的使用条件（密钥流必须与报文一样长）被违反时的样子。
     不选择抛异常：工具页每一帧都在调它，一帧非法就是整页白屏；而"用户
     把明文打长了一点"是最普通不过的操作，不该是一次崩溃。 */
  function runningKeyEncrypt(text, keyText) {
    const kk = keyIndices(keyText, 'running key 的密钥文本');
    return walk(text,
      function (j) { return kk[j % kk.length]; },
      function (p, k) { return p + k; });
  }
  function runningKeyDecrypt(text, keyText) {
    const kk = keyIndices(keyText, 'running key 的密钥文本');
    return walk(text,
      function (j) { return kk[j % kk.length]; },
      function (c, k) { return c - k; });
  }

  /* 两个模式的统一入口。工具页有一个模式开关，让它去写 if/else 只会把
     "模式名 → 函数"这份映射复制到页面里再维护一遍。 */
  function encryptWith(mode, text, key) {
    return mode === MODE_RUNNING ? runningKeyEncrypt(text, key) : autokeyEncrypt(text, key);
  }
  function decryptWith(mode, text, key) {
    return mode === MODE_RUNNING ? runningKeyDecrypt(text, key) : autokeyDecrypt(text, key);
  }

  /* ================= 画丝带用的密钥流 =================
     返回的不只是密钥字母，还有**每个密钥字母是从哪儿来的**：

       from[i] = 'primer' | 'plain' | 'key'
       at[i]   = 它在引钥 / 明文 / 密钥文本里的下标

     页面那条从明文第 at[i] 格连到密钥第 i 格的箭头就是照着这两个数组画的。
     只返回 ks 的话，"密钥从明文里长出来"这件事就得由页面再推一遍同样的
     算式——两份推导迟早会有一份先改。

     ⚠ 自动密钥模式下 text **必须是明文**。密钥流的定义就是明文，喂密文
     进来会算出一串合法但无意义的字母，且不会有任何报错。 */
  function keyStreamOf(mode, text, key) {
    const idx = C.letters(text);
    const n = idx.length;
    const ks = [], from = [], at = [];
    if (mode === MODE_RUNNING) {
      const kk = keyIndices(key, 'running key 的密钥文本');
      for (let i = 0; i < n; i++) {
        ks.push(kk[i % kk.length]);
        from.push('key');
        at.push(i % kk.length);
      }
      return { mode: MODE_RUNNING, n: n, ks: ks, from: from, at: at,
               sourceLen: kk.length, wrapped: n > kk.length };
    }
    const pr = keyIndices(key, 'autokey 的引钥');
    for (let i = 0; i < n; i++) {
      if (i < pr.length) { ks.push(pr[i]); from.push('primer'); at.push(i); }
      else { ks.push(idx[i - pr.length]); from.push('plain'); at.push(i - pr.length); }
    }
    return { mode: MODE_AUTOKEY, n: n, ks: ks, from: from, at: at,
             sourceLen: pr.length, wrapped: false };
  }

  /* ================= 拖词（crib dragging） =================
     把一段猜测的明文（crib）沿密文一格一格拖过去，每个位置算一次

         derived_i = c_{offset+i} − crib_i   (mod 26)

     也就是"如果这里的明文真是 crib，那这几位的密钥就是这几个字母"。
     这两族密码之所以怕它，是因为**密钥本身是英文**：
       · 滚动密钥下 derived 是另一段英文的片段；
       · 自动密钥下 derived 是 L 位之前的明文（或引钥）——同样是英文。
     于是"哪个位置对"这个问题退化成"哪一段 derived 最像英文"，而一次性
     密码本恰恰在这里不同：它的密钥是均匀随机的，每个位置的 derived 都
     同样像随机串，拖词得不到任何信号。

     只返回代数结果，不打分。打分要一张英文频率表，那张表的唯一真相在
     cryptanalysis.js 的 ENGLISH_FREQ 里；在这里再抄一份，两份迟早会分家，
     而画面上那条排序一旦错了没有任何东西会报警。 */
  function cribDrag(cipher, crib) {
    const c = C.letters(cipher);
    const w = C.letters(crib);
    if (!w.length) {
      throw new Error('cribDrag 的 crib 至少要含一个字母，收到 ' + JSON.stringify(String(crib)));
    }
    const out = [];
    for (let j = 0; j + w.length <= c.length; j++) {
      const d = [];
      for (let i = 0; i < w.length; i++) d.push(C.mod(c[j + i] - w[i], C.N));
      out.push({ offset: j, derived: C.fromIndices(d), idx: d });
    }
    return out;
  }

  /* ================= 自动密钥：一次正确的猜测会传播 =================
     这是整个工具的落点。已知 p_j …… p_{j+m-1} 之后：

       前向  k_{i+L} = p_i          ⇒  p_{i+L} = c_{i+L} − p_i
       后向  k_i     = p_{i-L}      ⇒  p_{i-L} = c_i − p_i
       引钥  i < L 时 k_i = primer_i ⇒  primer_i = c_i − p_i

     三条都只用到已知的 p_i 与密文，所以每一个猜中的位置都会沿着**步长 L**
     的那条链向两头一路解开。后果可以直接算出来：一段长 m 的 crib 猜中之后，
     恢复的正是下标 mod L 落在 {j, …, j+m−1} 里的那些位置，也就是 m/L 的报文；
     m >= L 时整篇明文连同引钥一起掉出来。

     滚动密钥没有这条链——各位置互不相干，猜中一段只能得到另一段文本的
     那几个字母。两页并排看，"自动密钥更省事（密钥不用另外传）"的代价
     就变成了可以数的东西。

     返回 known（长度 n，−1 表示未知）与 primer（长度 L，−1 表示未知）。 */
  function autokeyPropagate(cipher, primerLen, offset, cribIdx) {
    const c = C.letters(cipher);
    const n = c.length;
    const L = primerLen;
    if (!Number.isInteger(L) || L < 1) {
      throw new Error('autokeyPropagate 的引钥长度必须是 >= 1 的整数，收到 ' + primerLen);
    }
    const known = new Array(n).fill(-1);
    const primer = new Array(L).fill(-1);
    const queue = [];
    for (let i = 0; i < cribIdx.length; i++) {
      const at = offset + i;
      if (at < 0 || at >= n) continue;
      if (known[at] >= 0) continue;
      known[at] = C.mod(cribIdx[i], C.N);
      queue.push(at);
    }
    while (queue.length) {
      const i = queue.pop();
      const p = known[i];
      if (i + L < n && known[i + L] < 0) {
        known[i + L] = C.mod(c[i + L] - p, C.N);
        queue.push(i + L);
      }
      if (i >= L && known[i - L] < 0) {
        known[i - L] = C.mod(c[i] - p, C.N);
        queue.push(i - L);
      }
      if (i < L) primer[i] = C.mod(c[i] - p, C.N);
    }
    let count = 0;
    for (let i = 0; i < n; i++) if (known[i] >= 0) count++;
    return { known: known, primer: primer, n: n, L: L, count: count };
  }

  return { MODE_AUTOKEY, MODE_RUNNING,
           autokeyEncrypt, autokeyDecrypt,
           runningKeyEncrypt, runningKeyDecrypt,
           encryptWith, decryptWith,
           keyStreamOf, cribDrag, autokeyPropagate };
});
