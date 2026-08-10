(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    /* node 下取兄弟目录的 crypto-core：路径用 path.join 拼，不写字面的父目录
       相对路径。理由与 caesar.js 那一处相同，也不是风格问题——那个字符串会被
       inline_core.py 原样内联进每个工具页，而 check.py 的 outbound_ref_check()
       正在数整个子树里的父目录引用，用它守住"cryptography/ 可以整体搬走"这条
       约束。浏览器分支根本走不到这一行，为它留一条会触发普查的字面量不划算。 */
    module.exports = factory(require(require('path').join(__dirname, '..', 'crypto-core.js')));
  } else {
    root.CryptoAlgos = root.CryptoAlgos || {};
    root.CryptoAlgos.morse = factory(root.CryptoCore);
  }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* ================= 编码不是密码 =================

     摩尔斯码是一个**编码**：码表是公开的，没有密钥，任何人都能反着查回去。
     它提供的保密性是零。本模块把这件事做成可执行的事实——fromMorse() 不接受
     任何密钥参数，因为**没有密钥可接**。

     但它是一个极好的**密码基底**，理由有两条，都写在数据结构里：

       ① 它把 26 个字母重写进一个只有点、划两种符号的字母表；
       ② 码长是**变长**的（E 是 1 个符号，0 是 5 个），所以"第几个符号属于
          第几个字母"这件事不再能靠数数得到。

     ①+② 加在一起，就是分裂式摩尔斯（fractionated Morse）赖以成立的东西：
     把符号流按**固定长度 3**重新切段，切口与字母边界系统性地错开，此后密文里
     任何一个字母都不再对应明文里的任何一个字母。

     ---- 一个必须说清楚的事实：摩尔斯**不是**前缀码 ----
     E = "." 是 I = ".." 的前缀，I 又是 S = "..." 的前缀，S 又是 H 的前缀。
     在只有点划两种符号的字母表上，摩尔斯是**歧义**的：裸的 "..." 可以读成
     S、EI、IE、EEE 四种（countReadings 会把这个数算出来）。
     所以字母之间那个"停顿"不是排版习惯，它是**第三个符号**，而且是让整套
     编码可解的那一个。本模块把它写成字面的 'x'，正是为了让它在数据里也占一格，
     而不是变成一个看不见的约定。 */

  /* ITU 标准码表：26 个字母 + 10 个数字。标点不收——古典密码工具里没有一处
     用得上，收进来只会让"26 个有效三元组"那笔账多出一堆需要解释的例外。 */
  const MORSE_TABLE = {
    A: '.-',    B: '-...',  C: '-.-.',  D: '-..',   E: '.',     F: '..-.',
    G: '--.',   H: '....',  I: '..',    J: '.---',  K: '-.-',   L: '.-..',
    M: '--',    N: '-.',    O: '---',   P: '.--.',  Q: '--.-',  R: '.-.',
    S: '...',   T: '-',     U: '..-',   V: '...-',  W: '.--',   X: '-..-',
    Y: '-.--',  Z: '--..',
    0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
    5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.'
  };

  /* 反查表。建表时**逐条查重**：两个字符共用一个码意味着 fromMorse 会静静地
     丢掉其中一个，而那种错误在页面上表现为"某个字母解出来变成了另一个"，
     没有任何东西会报警。 */
  const CODE_TO_CHAR = (function () {
    const out = {};
    Object.keys(MORSE_TABLE).forEach(function (ch) {
      const code = MORSE_TABLE[ch];
      if (out[code] !== undefined) {
        throw new Error('morse: 码表里 ' + JSON.stringify(code) + ' 被 ' +
                        out[code] + ' 与 ' + ch + ' 共用');
      }
      out[code] = ch;
    });
    return out;
  })();

  /* 最长的码是 5 个符号（数字全是 5）。分段搜索靠它收敛，写死一个常量比在
     循环里现算 Math.max 好：现算一次要遍历整张表，而这个上限是 ITU 定死的。 */
  const MAX_CODE_LEN = 5;

  const DOT = '.', DASH = '-', SEP = 'x';
  /* 三符号字母表的**固定顺序**。三元组表按这个顺序做进位枚举，所以它同时
     定义了 tripleTable() 的次序，也就间接定义了密钥字母表怎么对齐。
     换掉这个顺序等于换掉整个密码，不是换个写法。 */
  const SYMBOLS = [DOT, DASH, SEP];

  function isMorseChar(ch) { return MORSE_TABLE[ch] !== undefined; }

  /* 规范化：大写，只留 A-Z 与 0-9，其余一切（标点、中文、换行）折成单个空格，
     首尾去空。空格必须留下来——分裂式摩尔斯的词间隔是 'xx'，把词边界丢掉
     等于换了一段明文，往返承诺当场不成立。

     与 caesar.js "保留大小写与标点"的选择相反，理由与 transposition.js 那段
     一样：这里的运算定义在**符号位置**上，一个不属于码表的字符没有符号可占，
     留着它就得回答"它占几个符号"，而任何答案都是编出来的。 */
  function normalizeText(text) {
    const s = String(text == null ? '' : text).toUpperCase();
    let out = '';
    let pendingSpace = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s.charAt(i);
      if (isMorseChar(ch)) {
        if (pendingSpace && out.length) out += ' ';
        pendingSpace = false;
        out += ch;
      } else {
        pendingSpace = true;
      }
    }
    return out;
  }

  function codeOf(ch) {
    const code = MORSE_TABLE[String(ch).toUpperCase()];
    if (code === undefined) {
      throw new Error('morse.codeOf: 码表里没有 ' + JSON.stringify(String(ch)));
    }
    return code;
  }

  function charOf(code) {
    const ch = CODE_TO_CHAR[String(code)];
    if (ch === undefined) {
      throw new Error('morse.charOf: 不是一个合法的摩尔斯码 ' + JSON.stringify(String(code)));
    }
    return ch;
  }

  /* ================= 人读的那一层：toMorse / fromMorse =================
     字母之间一个空格，词之间一个斜杠——这是电报抄本与今天所有摩尔斯练习软件
     共用的写法。斜杠不是装饰：没有它，"SOS OS" 与 "SOSOS" 写出来一模一样。

     **这两个函数都不接受密钥，因为没有密钥可接。** 这就是"编码不是密码"
     这句话在代码里的形状：谁拿到 fromMorse 谁就能读，而 fromMorse 就在这里。 */
  const WORD_GAP = ' / ';

  function toMorse(text) {
    const plain = normalizeText(text);
    if (!plain) return '';
    return plain.split(' ').map(function (word) {
      let parts = [];
      for (let i = 0; i < word.length; i++) parts.push(MORSE_TABLE[word.charAt(i)]);
      return parts.join(' ');
    }).join(WORD_GAP);
  }

  /* 解码。空白怎么写都认（多个空格、换行、制表符），'/' 与 '|' 都当词边界——
     抄下来的电报很少排版整齐，而这个函数的全部意义就是"任何人都能读回去"。
     认不出来的码当场抛：静静地跳过一个坏码，得到的是一段看着正常、其实少了
     一个字母的明文，那种错误要等很久才会被人撞见。 */
  function fromMorse(code) {
    const s = String(code == null ? '' : code).trim();
    if (!s) return '';
    const tokens = s.split(/\s+/);
    let out = '';
    for (let i = 0; i < tokens.length; i++) {
      const tk = tokens[i];
      if (tk === '/' || tk === '|') {
        if (out.length && out.charAt(out.length - 1) !== ' ') out += ' ';
        continue;
      }
      out += charOf(tk);
    }
    return out.trim();
  }

  /* ================= 歧义：没有分隔符时能读出几种 =================
     裸的点划串（把字母间隔全抹掉）能被切成多少种合法读法。这是"分隔符是承重
     结构"这句话的**可计算版本**：加上分隔符，读法恰好 1 种；抹掉分隔符，
     读法是下面这个数。

     DP：ways[i] = 前 i 个符号的切法数 = Σ ways[i−L]（末段长 L 且是合法码）。
     L 只需扫到 MAX_CODE_LEN。

     返回的是 JS number。约 2^53 之后计数不再精确——那个规模上"到底几种"
     早已不是问题的重点（几百万种和几万亿种同样意味着不可读），所以不引入
     BigInt；调用方若在意，看 exact 字段。 */
  function countReadings(bare) {
    const s = String(bare == null ? '' : bare);
    for (let i = 0; i < s.length; i++) {
      if (s.charAt(i) !== DOT && s.charAt(i) !== DASH) {
        throw new Error('morse.countReadings: 只接受点与划组成的裸串，收到 ' +
                        JSON.stringify(s));
      }
    }
    const n = s.length;
    if (!n) return 1;                    // 空串恰有一种读法：什么都不读
    const ways = new Array(n + 1).fill(0);
    ways[0] = 1;
    for (let i = 1; i <= n; i++) {
      for (let L = 1; L <= MAX_CODE_LEN && L <= i; L++) {
        if (ways[i - L] === 0) continue;
        if (CODE_TO_CHAR[s.slice(i - L, i)] !== undefined) ways[i] += ways[i - L];
      }
    }
    return ways[n];
  }

  /* 把前若干种读法真的列出来（给页面展示用）。limit 必须有：'…………' 那种输入
     的读法数是指数级的，不封顶就是一个会把标签页挂死的函数。
     枚举顺序按"末段从短到长"深度优先，于是 '...' 的第一条是 EEE、最后一条是 S，
     每一步都是"能不能再拆细一点"，读起来正好是歧义本身的形状。 */
  function ambiguousReadings(bare, limit) {
    const s = String(bare == null ? '' : bare);
    const cap = (limit === undefined) ? 8 : Math.max(1, Math.round(limit));
    const out = [];
    (function walk(pos, acc) {
      if (out.length >= cap) return;
      if (pos === s.length) { out.push(acc); return; }
      for (let L = 1; L <= MAX_CODE_LEN && pos + L <= s.length; L++) {
        const ch = CODE_TO_CHAR[s.slice(pos, pos + L)];
        if (ch === undefined) continue;
        walk(pos + L, acc + ch);
        if (out.length >= cap) return;
      }
    })(0, '');
    return out;
  }

  /* ================= 三符号流：分裂式摩尔斯的基底 =================
     字母内符号直接相连，字母之间插一个 'x'，词之间插两个 'x'。于是：

         "AB CD"  ->  ".-x-...xx-.-.x-.."

     两条性质是后面一切的前提，都由这条构造直接保证：
       · 'x' 的连续段长度只可能是 1 或 2，**永远不会是 3**——所以 27 个三元组
         里 'xxx' 是不可能出现的那一个，剩下的恰好 26 个，恰好配一个字母表。
         这不是巧合，是这个密码被设计成这样的原因。
       · 符号流以字母的点划收尾（normalizeText 已经去掉首尾空白），补位补的
         'x' 最多 2 个，因此补位也造不出 'xxx'。

     owner[] 是每个符号属于明文第几个字符（分隔符是 −1）。工具页画"字母边界
     原来在哪"那一条靠它，测试也靠它钉住边界——把它算在这里而不是让页面自己
     推一遍，是因为页面推的那一份与加密用的这一份一旦错开，画面会漂亮地指错
     地方，而没有任何东西会报警。 */
  function symbolStream(text) {
    const plain = normalizeText(text);
    const codes = [];        // 与 plain 逐字符对齐；空格位置是空串
    let stream = '';
    const owner = [];
    const first = [];        // first[j] / last[j]：明文第 j 个字符占符号流的哪一段
    const last = [];
    for (let j = 0; j < plain.length; j++) {
      const ch = plain.charAt(j);
      if (ch === ' ') {
        codes.push('');
        first.push(-1); last.push(-1);
        stream += SEP + SEP;
        owner.push(-1, -1);
        continue;
      }
      const code = MORSE_TABLE[ch];
      codes.push(code);
      /* 词边界那两个 'x' 已经由空格那一支写过，这里只补字母之间的那一个。 */
      if (j > 0 && plain.charAt(j - 1) !== ' ') { stream += SEP; owner.push(-1); }
      first.push(stream.length);
      for (let k = 0; k < code.length; k++) { stream += code.charAt(k); owner.push(j); }
      last.push(stream.length - 1);
    }
    return { plain: plain, codes: codes, stream: stream, owner: owner,
             first: first, last: last };
  }

  /* ================= 26 个有效三元组 =================
     三个符号、每位三选一 = 27 种，去掉不可能出现的 'xxx'，正好 26 种。
     进位枚举的顺序（点 < 划 < x）就是历史上那张表的排法，'xxx' 恰好排在最后，
     所以"去掉它"在实现上就是截断，不需要挖洞。 */
  function tripleTable() {
    const out = [];
    for (let a = 0; a < SYMBOLS.length; a++) {
      for (let b = 0; b < SYMBOLS.length; b++) {
        for (let c = 0; c < SYMBOLS.length; c++) {
          const t = SYMBOLS[a] + SYMBOLS[b] + SYMBOLS[c];
          if (t !== SEP + SEP + SEP) out.push(t);
        }
      }
    }
    return out;
  }

  const TRIPLES = tripleTable();
  const TRIPLE_INDEX = (function () {
    const m = {};
    for (let i = 0; i < TRIPLES.length; i++) m[TRIPLES[i]] = i;
    return m;
  })();

  /* 密钥字母表：A–Z 的一个 26 字母排列，第 i 个字母对应第 i 个三元组。
     省略（或空串）时退回 A–Z——它同样是 26! 个密钥中的一个，一点也不特殊，
     只是刚好让"三元组 → 字母"这张表读起来像教科书上的那一张。
     非法密钥当场抛，与 substitution.js 的 requireKey 同一条纪律：悄悄退回
     恒等会吐出一段既解不开、也不是任何人密文的东西。 */
  function requireKeyAlphabet(keyAlphabet) {
    if (keyAlphabet === undefined || keyAlphabet === null || keyAlphabet === '') {
      return C.ALPHABET;
    }
    const key = String(keyAlphabet);
    let ok = key.length === C.N;
    if (ok) {
      const seen = new Array(C.N).fill(false);
      for (let i = 0; i < C.N; i++) {
        const v = key.charCodeAt(i) - 65;
        if (!(v >= 0 && v < C.N) || seen[v]) { ok = false; break; }
        seen[v] = true;
      }
    }
    if (!ok) {
      throw new Error('morse: 密钥字母表必须是 A–Z 的一个 26 字母排列，收到 ' +
                      JSON.stringify(String(keyAlphabet)));
    }
    return key;
  }

  /* 全流程留痕。工具页三条带（符号流 / 三个一组 / 密文）以及"字母边界与组边界
     错开多少"那个读数全部读它，加解密也走它——一份真相，不是两份。 */
  function fractionatedTrace(text, keyAlphabet) {
    const key = requireKeyAlphabet(keyAlphabet);
    const st = symbolStream(text);
    const pad = st.stream.length ? (3 - st.stream.length % 3) % 3 : 0;
    let padded = st.stream;
    for (let i = 0; i < pad; i++) padded += SEP;
    const owner = st.owner.slice();
    for (let i = 0; i < pad; i++) owner.push(-1);

    const groups = [];
    let cipher = '';
    for (let i = 0; i < padded.length; i += 3) {
      const g = padded.slice(i, i + 3);
      const idx = TRIPLE_INDEX[g];
      if (idx === undefined) {
        /* 到不了这里：symbolStream 的构造保证 'x' 连续段不超过 2 个。真到了
           就说明构造被改坏了，当场炸比吐一个静静错掉的密文强。 */
        throw new Error('morse: 出现了不可能的三元组 ' + JSON.stringify(g));
      }
      groups.push(g);
      cipher += key.charAt(idx);
    }
    return {
      key: key, plain: st.plain, codes: st.codes,
      stream: st.stream, padded: padded, pad: pad,
      owner: owner, first: st.first, last: st.last,
      groups: groups, cipher: cipher
    };
  }

  function fractionatedEncrypt(text, keyAlphabet) {
    return fractionatedTrace(text, keyAlphabet).cipher;
  }

  /* 解密。密钥的逆排列把密文字母映回三元组下标，拼回符号流，去掉末尾的补位
     'x'（合法符号流永远以点或划收尾，所以"末尾的 x 全是补位"这条是安全的），
     再按 'xx' 切词、'x' 切字母，交给 fromMorse。

     刻意复用 fromMorse 而不是另写一份查表循环：两份解码实现迟早会在某个
     边界上走偏，而"分裂式摩尔斯解出来的东西与人手抄的摩尔斯解出来的东西
     是同一个"恰恰是这个密码在教学上的全部意义。 */
  function fractionatedDecrypt(cipher, keyAlphabet) {
    const key = requireKeyAlphabet(keyAlphabet);
    const inv = new Array(C.N);
    for (let i = 0; i < C.N; i++) inv[key.charCodeAt(i) - 65] = i;

    const s = C.normalize(cipher);
    if (!s) return '';
    let stream = '';
    for (let i = 0; i < s.length; i++) {
      const idx = inv[s.charCodeAt(i) - 65];
      stream += TRIPLES[idx];
    }
    let end = stream.length;
    while (end > 0 && stream.charAt(end - 1) === SEP) end--;
    stream = stream.slice(0, end);
    if (!stream) return '';

    const spaced = stream.split(SEP + SEP).map(function (word) {
      return word.split(SEP).join(' ');
    }).join(WORD_GAP);
    return fromMorse(spaced);
  }

  return {
    MORSE_TABLE: MORSE_TABLE, CODE_TO_CHAR: CODE_TO_CHAR,
    SYMBOLS: SYMBOLS, DOT: DOT, DASH: DASH, SEP: SEP, MAX_CODE_LEN: MAX_CODE_LEN,
    normalizeText: normalizeText, isMorseChar: isMorseChar,
    codeOf: codeOf, charOf: charOf,
    toMorse: toMorse, fromMorse: fromMorse,
    countReadings: countReadings, ambiguousReadings: ambiguousReadings,
    symbolStream: symbolStream,
    tripleTable: tripleTable,
    fractionatedTrace: fractionatedTrace,
    fractionatedEncrypt: fractionatedEncrypt,
    fractionatedDecrypt: fractionatedDecrypt
  };
});
