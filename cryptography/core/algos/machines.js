(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    /* node 下取兄弟目录的 crypto-core：路径用 path.join 拼，不写字面的父目录
       相对路径。理由与 caesar.js 同款——那个字符串会被 inline_core.py 原样内联
       进每个工具页，而 check.py 的 outbound_ref_check() 正在数整个子树里的
       父目录引用，用它守住"cryptography/ 可以整体搬走"这条约束。 */
    module.exports = factory(require(require('path').join(__dirname, '..', 'crypto-core.js')));
  } else {
    root.CryptoAlgos = root.CryptoAlgos || {};
    root.CryptoAlgos.machines = factory(root.CryptoCore);
  }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* ================= 第二章：机械密码 =================
     两台真机器，都早于 Enigma，都在讲同一件事：**密钥不再是一个词，而是一台
     机器的装配方式**。算法（齿轮怎么咬合）是公开的、可以拆开看的；秘密在
     配置里。这正是 Kerckhoffs 原则的金属版本。

       · Jefferson 圆柱密码 / M-94：25 片刻着乱序字母表的圆盘穿在一根轴上，
         盘的**排列顺序**就是密钥。把明文对齐成一行，另外 25 行里随便挑一行
         发出去。
       · Hagelin C-38 / M-209：六个销轮，齿数 26/25/23/21/19/17 两两互素，
         驱动一个 27 根杆的凸耳笼，每个字符产出一个位移；密文是用这个位移做的
         博福特代换。六个互素周期相乘 = 101 405 850 —— 长周期是**机械**买来的，
         不是保密买来的。 */

  /* ================= M-94 的 25 片圆盘 =================
     这些是**真实的历史数据**，不是本仓生成的。三个互相独立的来源逐字节一致：
       prc68.com/I/M94.shtml、jproc.ca/crypto/m94.html、dcode.fr 的 Jefferson
       wheel cipher 页。
     另有一条内生的自洽证据，比"三个网页都这么写"更硬：每片盘都以 A 开头，而
     25 片盘 A 之后的那个字母依次是 B、C、…、Z —— 这正是历史上圆盘的编号方式
     （盘身刻着 "B 1" 到 "Z 25"，编号取的就是 A 后面那个字母）。数据若在传抄中
     被打乱，这条规律会立刻断掉。machines.test.js 把这三件事都钉成断言：
     每片是 A–Z 的排列、都以 A 开头、第二个字母依次是 B..Z。
     第 17 片以 "ARMYOFTHEUS" 开头（US Army 的小彩蛋），这也是史料记载的。 */
  const M94_WHEELS = [
    'ABCEIGDJFVUYMHTQKZOLRXSPWN',
    'ACDEHFIJKTLMOUVYGZNPQXRWSB',
    'ADKOMJUBGEPHSCZINXFYQRTVWL',
    'AEDCBIFGJHLKMRUOQVPTNWYXZS',
    'AFNQUKDOPITJBRHCYSLWEMZVXG',
    'AGPOCIXLURNDYZHWBJSQFKVMET',
    'AHXJEZBNIKPVROGSYDULCFMQTW',
    'AIHPJOBWKCVFZLQERYNSUMGTDX',
    'AJDSKQOIVTZEFHGYUNLPMBXWCR',
    'AKELBDFJGHONMTPRQSVZUXYWIC',
    'ALTMSXVQPNOHUWDIZYCGKRFBEJ',
    'AMNFLHQGCUJTBYPZKXISRDVEWO',
    'ANCJILDHBMKGXUZTSWQYVORPFE',
    'AODWPKJVIUQHZCTXBLEGNYRSMF',
    'APBVHIYKSGUENTCXOWFQDRLJZM',
    'AQJNUBTGIMWZRVLXCSHDEOKFPY',
    'ARMYOFTHEUSZJXDPCWGQIBKLNV',
    'ASDMCNEQBOZPLGVJRKYTFUIWXH',
    'ATOJYLFXNGWHVCMIRBSEKUPDZQ',
    'AUTRZXQLYIOVBPESNHJWMDGFCK',
    'AVNKHRGOXEYBFSJMUDQCLZWTIP',
    'AWVSFDLIEBHKNRJQZGMXPUCOTY',
    'AXKWREVDTUFOYHMLSIQNJCPGBZ',
    'AYJPXMVKBQWUGLOSTECHNZFRID',
    'AZDNBUHYFWJLVGRCQMPSOEXTKI'
  ];

  /* 盘身刻的标识：第 n 片刻 "<字母> n"，字母就是该盘上 A 后面那一个。 */
  const M94_WHEEL_IDS = M94_WHEELS.map(function (w, i) { return w.charAt(1) + ' ' + (i + 1); });

  const M94_COUNT = M94_WHEELS.length;      // 25。Jefferson 的原设计是 36 片，
                                            // 但只有 M-94 这 25 片的字母表留下了记录。
  const M94_ROWS = C.N;                     // 圆周上 26 个位置 = 26 行

  /* 每片盘的"字母 → 圆周位置"反查表。draw() 每帧要问几十次，建一次就够。 */
  const M94_INDEX = M94_WHEELS.map(function (w) {
    const m = {};
    for (let i = 0; i < w.length; i++) m[w.charAt(i)] = i;
    return m;
  });

  /* wheelOrder 是**盘号**（1..25，与盘身刻的编号一致），不是数组下标。
     用刻在金属上的那个数当密钥的书写形式，页面上印出来的与操作员写在密钥表上
     的是同一串数字；换成 0 基下标只会让屏幕上的密钥与史料对不上。 */
  function normOrder(wheelOrder) {
    if (!Array.isArray(wheelOrder) || wheelOrder.length === 0) {
      throw new Error('m94: wheelOrder 需要非空数组（盘号 1..' + M94_COUNT + '）');
    }
    if (wheelOrder.length > M94_COUNT) {
      throw new Error('m94: 轴上只有 ' + M94_COUNT + ' 片盘，wheelOrder 给了 ' + wheelOrder.length + ' 个');
    }
    const seen = {};
    const out = [];
    for (let i = 0; i < wheelOrder.length; i++) {
      const v = wheelOrder[i];
      if (!Number.isInteger(v) || v < 1 || v > M94_COUNT) {
        throw new Error('m94: wheelOrder[' + i + '] 应是 1..' + M94_COUNT + ' 的整数，收到 ' + v);
      }
      /* 一片盘不能同时插在两个位置上。重复不是"更弱的密钥"，是一个装不出来的
         轴——静默接受它，页面上就会画出一台不存在的机器。 */
      if (seen[v]) throw new Error('m94: wheelOrder 里盘号 ' + v + ' 出现了两次');
      seen[v] = 1;
      out.push(v - 1);
    }
    return out;
  }

  /* M-94 只吃字母：字母在轴上的**位置**就是它落在哪一片盘上，中间混进一个
     空格就会把后面所有字母整体挪一格，密文与明文对不上。所以这里 normalize
     而不是像凯撒那样让标点旁观。历史上操作员也是先把报文抄成 5 字母一组的。 */
  function m94Shift(text, wheelOrder, offsetRow) {
    const order = normOrder(wheelOrder);
    const s = C.normalize(text);
    const r = C.mod(Math.round(offsetRow || 0), M94_ROWS);
    const w = order.length;
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const disc = order[i % w];
      const idx = M94_INDEX[disc][s.charAt(i)];
      out += M94_WHEELS[disc].charAt(C.mod(idx + r, M94_ROWS));
    }
    return out;
  }

  /* offsetRow = 0 是**明文那一行本身**（恒等），不是一个可用的密文行；
     可用的是 1..25 那 25 行。这里不拦 0：页面正是要把"第 0 行 = 明文"画出来，
     而"25 种不同的密文"这句话只有在 0 也在场时才看得出是 26 减 1。 */
  function m94Encrypt(text, wheelOrder, offsetRow) {
    return m94Shift(text, wheelOrder, offsetRow);
  }

  /* 解密就是往回转同样的行数。不写第二份查表逻辑：两份实现迟早给出两个答案，
     而那天没人知道该信哪个。 */
  function m94Decrypt(text, wheelOrder, offsetRow) {
    return m94Shift(text, wheelOrder, -Math.round(offsetRow || 0));
  }

  /* 一次装配、一段明文，26 行全给出来：第 0 行是明文，另外 25 行都是合法密文，
     操作员随便挑一行发出去。这一条正是 M-94 那一页要画的东西，所以由算法模块
     一次算完，而不是让页面自己循环 25 次 —— 画面与密文出自同一份代码。 */
  function m94Rows(text, wheelOrder) {
    const rows = [];
    for (let r = 0; r < M94_ROWS; r++) rows.push(m94Shift(text, wheelOrder, r));
    return rows;
  }

  /* ================= Hagelin C-38 / M-209 =================
     六个销轮从左到右分别有 26/25/23/21/19/17 个销。轮上刻的字母不是 A–Z 的
     前 n 个：史料记载的是 A–Z、A–Z 去掉 W、A–X 去掉 W、A–U、A–S、A–Q
     （来源：en.wikipedia.org/wiki/M-209）。这些字母只用于报读轮位，
     不参与运算——运算只认"这一格的销是推出来的还是缩回去的"。 */
  const C38_PINS = [26, 25, 23, 21, 19, 17];
  const C38_WHEEL_LETTERS = [
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',   // 26
    'ABCDEFGHIJKLMNOPQRSTUVXYZ',    // 25：去掉 W
    'ABCDEFGHIJKLMNOPQRSTUVX',      // 23：A–X 去掉 W
    'ABCDEFGHIJKLMNOPQRSTU',        // 21
    'ABCDEFGHIJKLMNOPQRS',          // 19
    'ABCDEFGHIJKLMNOPQ'             // 17
  ];
  const C38_BARS = 27;               // 凸耳笼上的杆数，固定 27 根
  const C38_WHEELS = C38_PINS.length;

  function wheelPeriods() { return C38_PINS.slice(); }

  /* 六个齿数两两互素，所以整台机器的状态周期就是它们的**乘积**。
     这个数在模块里算出来、不写成字面量：页面上印的那个 101 405 850 必须是
     C38_PINS 的后果，而不是一句需要人去核对的标语。 */
  function c38StatePeriod() {
    return C38_PINS.reduce(function (a, b) { return a * b; }, 1);
  }

  function lcm(a, b) { return a / C.gcd(a, b) * b; }

  /* 销图案：接受 0/1 数组、布尔数组，或一串字符。字符里 '1' 'x' 'X' '+' 是
     推出（有效），'0' '.' '-' ' ' 是缩回；其余字符当场拒绝——把一个看不懂的
     字符默默算成 0，等于让密钥悄悄变成另一把。 */
  function parsePinRow(v, len, which) {
    const out = new Array(len);
    const tag = 'c38: 第 ' + (which + 1) + ' 轮（' + len + ' 销）';
    if (typeof v === 'string') {
      if (v.length !== len) throw new Error(tag + ' 的销图案长度应为 ' + len + '，收到 ' + v.length);
      for (let i = 0; i < len; i++) {
        const ch = v.charAt(i);
        if (ch === '1' || ch === 'x' || ch === 'X' || ch === '+') out[i] = 1;
        else if (ch === '0' || ch === '.' || ch === '-' || ch === ' ') out[i] = 0;
        else throw new Error(tag + ' 的销图案里有无法解读的字符 ' + JSON.stringify(ch));
      }
      return out;
    }
    if (!Array.isArray(v)) throw new Error(tag + ' 的销图案要么是字符串，要么是数组，收到 ' + typeof v);
    if (v.length !== len) throw new Error(tag + ' 的销图案长度应为 ' + len + '，收到 ' + v.length);
    for (let i = 0; i < len; i++) {
      const b = v[i];
      if (b === 1 || b === true) out[i] = 1;
      else if (b === 0 || b === false) out[i] = 0;
      else throw new Error(tag + ' 的销 ' + i + ' 不是 0/1/true/false：' + b);
    }
    return out;
  }

  function normPins(pinSettings) {
    if (!Array.isArray(pinSettings) || pinSettings.length !== C38_WHEELS) {
      throw new Error('c38: pinSettings 需要 ' + C38_WHEELS + " 个销轮的图案，收到 " +
                      (Array.isArray(pinSettings) ? pinSettings.length : typeof pinSettings));
    }
    return pinSettings.map(function (v, i) { return parsePinRow(v, C38_PINS[i], i); });
  }

  /* 凸耳笼：27 根杆，每根杆上两个可移动的凸耳，每个凸耳要么对准 1..6 号轮，
     要么放在中立位（这里写 0）。杆数固定 27 —— 那是这台机器的物理事实，
     少一根多一根都不是 C-38 了，所以这里拒绝而不是宽容。 */
  function normLugs(lugSettings) {
    if (!Array.isArray(lugSettings) || lugSettings.length !== C38_BARS) {
      throw new Error('c38: lugSettings 需要 ' + C38_BARS + ' 根杆，收到 ' +
                      (Array.isArray(lugSettings) ? lugSettings.length : typeof lugSettings));
    }
    return lugSettings.map(function (bar, i) {
      if (!Array.isArray(bar) || bar.length !== 2) {
        throw new Error('c38: 第 ' + i + ' 根杆应是 [凸耳A, 凸耳B] 两个数，收到 ' + JSON.stringify(bar));
      }
      const a = bar[0], b = bar[1];
      [a, b].forEach(function (v, j) {
        if (!Number.isInteger(v) || v < 0 || v > C38_WHEELS) {
          throw new Error('c38: 第 ' + i + ' 根杆的凸耳 ' + j + ' 应是 0（中立）或 1..' +
                          C38_WHEELS + '，收到 ' + v);
        }
      });
      return [a, b];
    });
  }

  function normStart(start) {
    if (start == null) return new Array(C38_WHEELS).fill(0);
    if (!Array.isArray(start) || start.length !== C38_WHEELS) {
      throw new Error('c38: start 需要 ' + C38_WHEELS + ' 个轮位，收到 ' +
                      (Array.isArray(start) ? start.length : typeof start));
    }
    return start.map(function (v, i) {
      if (!Number.isInteger(v)) throw new Error('c38: start[' + i + '] 不是整数：' + v);
      return C.mod(v, C38_PINS[i]);
    });
  }

  /* 第 n 个字符时六个轮的有效销。所有轮每个字符各前进一格，互不干涉——
     "互素"这件事全部的机械含义就是这句话。 */
  function c38Bits(pins, start, n) {
    const bits = new Array(C38_WHEELS);
    for (let i = 0; i < C38_WHEELS; i++) {
      bits[i] = pins[i][C.mod(start[i] + n, C38_PINS[i])];
    }
    return bits;
  }

  /* 齿数（kick）= 被顶出去的杆数。一根杆只要**两个凸耳里有一个**对着有效销
     就整根被顶出去——所以它是 OR 而不是加法，这一点正是凸耳笼比"六个数相加"
     更难分析的地方：重叠杆让不同轮的贡献互相吞掉。 */
  function c38KickFromBits(bits, lugs) {
    let k = 0;
    for (let i = 0; i < lugs.length; i++) {
      const a = lugs[i][0], b = lugs[i][1];
      if ((a > 0 && bits[a - 1]) || (b > 0 && bits[b - 1])) k++;
    }
    return k;
  }

  /* 单点求值：给定第 n 个字符，直接从轮位算齿数，不必先生成前面 n 个。
     周期验证靠的就是这个 O(1) 入口 —— 要证明"周期真的是 101 405 850"，
     得比较 s(n) 与 s(n + 101405850/q)，而后者的下标大到不可能先生成出来。 */
  function c38KickAt(pinSettings, lugSettings, n, start) {
    const pins = normPins(pinSettings);
    const lugs = normLugs(lugSettings);
    const st = normStart(start);
    return c38KickFromBits(c38Bits(pins, st, n), lugs);
  }

  function c38KeyStream(pinSettings, lugSettings, n, start) {
    const pins = normPins(pinSettings);
    const lugs = normLugs(lugSettings);
    const st = normStart(start);
    const count = Math.max(0, Math.round(n || 0));
    const out = new Array(count);
    for (let i = 0; i < count; i++) out[i] = c38KickFromBits(c38Bits(pins, st, i), lugs);
    return out;
  }

  /* 每个字符的六个销状态，给页面画那六个转动的轮用。 */
  function c38BitsAt(pinSettings, start, n) {
    return c38Bits(normPins(pinSettings), normStart(start), n);
  }

  /* ================= 加密 =================
     C = 25 − P + K (mod 26)：先做 atbash（A↔Z 的反转），再按齿数反向移位。
     这就是一个密钥字母为 (25+K) mod 26 的博福特代换，因此**自反** ——
     解密与加密是同一次操作。代入验算：
        25 − (25 − P + K) + K = P。
     所以下面 c38Decrypt 直接调 c38Encrypt，不写第二份实现；这不是偷懒，
     是把"自反"这条性质变成代码结构本身，让它没有地方走岔。 */
  function c38Encrypt(text, pinSettings, lugSettings, start) {
    const pins = normPins(pinSettings);
    const lugs = normLugs(lugSettings);
    const st = normStart(start);
    /* 机器上没有空格键：操作员把空格抄成 Z 再打。这里只做 normalize（丢掉
       非字母），把"空格怎么办"留给页面去讲，而不是在算法里替使用者做一次
       他看不见的替换。 */
    const s = C.normalize(text);
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const k = c38KickFromBits(c38Bits(pins, st, i), lugs);
      out += C.ALPHABET.charAt(C.mod(25 - (s.charCodeAt(i) - 65) + k, C.N));
    }
    return out;
  }

  function c38Decrypt(text, pinSettings, lugSettings, start) {
    return c38Encrypt(text, pinSettings, lugSettings, start);
  }

  /* ================= 周期 =================
     一个销图案自己的最小周期。循环序列的不变位移构成 Z_P 的子群，所以最小
     周期必然**整除** P —— 只需要试 P 的因数。 */
  function minimalPinPeriod(row) {
    const P = row.length;
    for (let m = 1; m <= P; m++) {
      if (P % m !== 0) continue;
      let ok = true;
      for (let j = 0; j < P && ok; j++) if (row[j] !== row[j % m]) ok = false;
      if (ok) return m;
    }
    return P;
  }

  /* 齿数到底依不依赖第 i 个轮？枚举其余五个轮所有**可达**的销组合（某个轮
     的销图案若是常数，它就只有一个可达值），看翻转第 i 位会不会改变齿数。
     最多 32 次求值。 */
  function kickDependsOn(pins, lugs, i) {
    const vals = pins.map(function (row) {
      const s = {};
      for (let j = 0; j < row.length; j++) s[row[j]] = 1;
      return Object.keys(s).map(Number);
    });
    const others = [];
    for (let j = 0; j < C38_WHEELS; j++) if (j !== i) others.push(j);
    const bits = new Array(C38_WHEELS).fill(0);
    let found = false;
    (function rec(t) {
      if (found) return;
      if (t === others.length) {
        bits[i] = 0; const a = c38KickFromBits(bits, lugs);
        bits[i] = 1; const b = c38KickFromBits(bits, lugs);
        if (a !== b) found = true;
        return;
      }
      const j = others[t];
      for (let v = 0; v < vals[j].length && !found; v++) {
        bits[j] = vals[j][v];
        rec(t + 1);
      }
    })(0);
    return found;
  }

  /* 密钥流的**精确**周期，不是"理论上限"。
     推导（六个齿数两两互素是全部前提）：六个轮位构成群 G = ∏ Z_{P_i}，按 CRT
     它同构于 Z_L（L = ∏P_i），而循环群的子群就是各分量子群的直积。于是
     "密钥流在位移 d 下不变"等价于"对每个 i，单独把第 i 个分量平移 (d mod P_i)
     不改变齿数"。对第 i 个轮：
       · 若齿数根本不依赖它 → 它不构成任何约束；
       · 否则必须 p_i[φ + d] = p_i[φ] 对所有 φ 成立，即 m_i | d，
         m_i 是该销图案的最小周期。
     所以 T = lcm{ m_i : 齿数依赖第 i 个轮 }。
     这条公式让"周期"变成一个可以当场算出来印在屏幕上的量，而不是一句必须
     相信的话——销图案退化时它会自己塌下去（见 PIN_PRESETS 的 collapsed）。
     machines.test.js 用两条独立的证据交叉验证它：小规模配置下逐字符暴力测量，
     以及满规模下对 L 的每个素因子 q 展示 s(n) ≠ s(n + L/q)。 */
  function c38Period(pinSettings, lugSettings) {
    const pins = normPins(pinSettings);
    const lugs = normLugs(lugSettings);
    let T = 1;
    for (let i = 0; i < C38_WHEELS; i++) {
      const m = minimalPinPeriod(pins[i]);
      if (m === 1) continue;                        // 常数图案：这个轮什么也不贡献
      if (!kickDependsOn(pins, lugs, i)) continue;  // 凸耳笼没接它
      T = lcm(T, m);
    }
    return T;
  }

  /* ================= 密钥空间 =================
     第三页要印的那几个数，全部在这里算出来，页面一个字面量都不抄。
       · M-94：密钥就是 25 片盘的**排列**，25! 种。行号不算密钥——收报员把
         25 行全读一遍，挑读得通的那一行，所以它从来不是秘密。
       · C-38 销：131 个销各自推出或缩回 = 2^131。
       · C-38 凸耳笼：27 根杆，每根杆按"两个凸耳落在哪些轮上"分类。对齿数
         有影响的只有这个集合，于是每根杆有 22 种：两耳皆中立 1 种、只对一个轮
         6 种、对两个不同轮 C(6,2)=15 种。杆之间没有次序（齿数只数被顶出去的
         杆数），所以整笼是 22 类里取 27 个的**多重集**：C(27+22−1, 21) 种。
         这数的是**有效**配置，不是物理拨法——两个凸耳都压在同一个轮上跟只压
         一个是同一件事，把它们算成两种会把数字吹大。 */
  function log2Factorial(n) {
    let s = 0;
    for (let i = 2; i <= n; i++) s += Math.log2(i);
    return s;
  }

  function binom(n, k) {
    if (k < 0 || k > n) return 0;
    k = Math.min(k, n - k);
    let r = 1;
    for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
    return Math.round(r);
  }

  function keyspace() {
    const barTypes = 1 + C38_WHEELS + C38_WHEELS * (C38_WHEELS - 1) / 2;   // 22
    const lugCages = binom(C38_BARS + barTypes - 1, barTypes - 1);         // C(48,21)
    const pinCount = C38_PINS.reduce(function (a, b) { return a + b; }, 0); // 131
    const m94Bits = log2Factorial(M94_COUNT);
    const lugBits = Math.log2(lugCages);
    return {
      /* 盘数，不是"顺序数"——顺序数是 25!，在下面那个十进制串里。
         这个字段一开始叫 m94Orders，读起来像后者，改掉了。 */
      m94Discs: M94_COUNT,
      /* 25! 超出双精度整数的精确范围，所以数值与"给人看的十进制串"分开给：
         串由测试用 BigInt 独立复算过，不是抄来的。 */
      m94OrderCountText: '15511210043330985984000000',
      m94Bits: m94Bits,
      c38PinCount: pinCount,
      c38PinBits: pinCount,
      c38BarTypes: barTypes,
      c38LugCages: lugCages,
      c38LugBits: lugBits,
      c38Bits: pinCount + lugBits,
      statePeriod: c38StatePeriod()
    };
  }

  /* ================= 示例密钥 =================
     ⚠ 下面这些销图案与凸耳笼是**为教学造的例子**，不是任何一份历史密钥表。
     历史上的日密钥表另有一套编制规则（销的推出比例大致落在 4 到 6 成，
     凸耳笼还有"重叠杆数"之类的额外约束）。本仓不冒充史料。 */
  const LUG_DEMO = (function () {
    const bars = [];
    function add(n, a, b) { for (let i = 0; i < n; i++) bars.push([a, b]); }
    add(3, 1, 0);            // 只压 1 号轮
    add(6, 2, 0);
    add(1, 3, 0);
    add(1, 4, 0);
    add(4, 5, 0);
    add(4, 6, 0);
    add(2, 1, 4);            // 重叠杆：两个轮共用一根，贡献互相吞掉
    add(2, 2, 5);
    add(2, 3, 6);
    add(1, 1, 6);
    add(1, 0, 0);            // 一根空杆：齿数永远到不了 27
    return bars;
  })();

  /* 三套销图案，三种结局，全部由 c38Period() 当场算出来而不是写死：
       balanced   推出比例接近一半，六个轮各自满周期 → 101 405 850
       sparse     每个轮只推出一个销 → **仍然**是 101 405 850。周期不看密度，
                  只看"图案自己有没有更短的周期"，而单个 1 的图案不可能有。
       collapsed  3–6 号轮全缩回、1 号轮两格一循环、2 号轮五格一循环
                  → 周期塌到 10。同一台机器、同一个凸耳笼，只因为销拨错了。 */
  function pinRow(len, f) {
    let s = '';
    for (let i = 0; i < len; i++) s += f(i) ? 'x' : '.';
    return s;
  }
  /* balanced 那一套销图案由一个**写得出来、任何语言都能复算**的发生器给出，
     而不是手敲一串看着随机的字符：Park–Miller MINSTD（x ← 16807·x mod 2³¹−1），
     六个轮依次从同一条流里取销，销推出当且仅当 x mod 100 < 50。
     种子是 30，而 30 不是拍脑袋选的——它是**满足两条明写判据的最小种子**：
       ① 六个图案的最小周期都等于各自的销数（否则整机周期当场缩水，
          第一版用一条 mod 7 的规则时 21 销那个轮的周期就掉成了 7，
          总周期跟着从 101 405 850 掉到 33 801 950）；
       ② 六个图案的推出比例都落在 40%–60%——历史密钥表对销的疏密确有约束。
     两条判据都在 machines.test.js 里当场复核，不是靠这段注释背书。
     ⚠ 这仍然是一把**造出来的**演示密钥，不是任何一份历史密钥表。 */
  function minstdPins() {
    let x = 30;
    return C38_PINS.map(function (len) {
      return pinRow(len, function () { x = (16807 * x) % 2147483647; return x % 100 < 50; });
    });
  }

  const PIN_PRESETS = {
    balanced: minstdPins(),
    sparse: C38_PINS.map(function (len, w) {
      return pinRow(len, function (i) { return i === w; });
    }),
    collapsed: C38_PINS.map(function (len, w) {
      if (w === 0) return pinRow(len, function (i) { return i % 2 === 0; });   // 周期 2
      if (w === 1) return pinRow(len, function (i) { return i % 5 === 0; });   // 周期 5
      return pinRow(len, function () { return false; });                       // 常数
    })
  };

  return {
    /* M-94 */
    M94_WHEELS, M94_WHEEL_IDS, M94_COUNT, M94_ROWS,
    m94Encrypt, m94Decrypt, m94Rows,
    /* C-38 / M-209 */
    C38_PINS, C38_WHEEL_LETTERS, C38_BARS, C38_WHEELS,
    wheelPeriods, c38StatePeriod,
    c38KeyStream, c38KickAt, c38BitsAt, c38Encrypt, c38Decrypt,
    c38Period, minimalPinPeriod,
    LUG_DEMO, PIN_PRESETS,
    /* 第三页 */
    keyspace
  };
});
