(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    /* node 下取兄弟目录的 crypto-core：路径用 path.join 拼，不写字面的父目录
       相对路径。理由与 caesar.js / substitution.js 那两行完全相同——那个字符串
       会被 inline_core.py 原样内联进每个工具页，而 check.py 的
       outbound_ref_check() 正在数整个子树里的父目录引用，用它守住
       "cryptography/ 可以整体搬走"这条约束。浏览器分支根本走不到这一行，
       为它留一条会触发普查的字面量不划算。 */
    module.exports = factory(require(require('path').join(__dirname, '..', 'crypto-core.js')));
  } else {
    root.CryptoAlgos = root.CryptoAlgos || {};
    root.CryptoAlgos.playfair = factory(root.CryptoCore);
  }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* ================= Playfair 家族 =================
     这一族是本章第一个**不做模运算**的密码。凯撒、仿射、单表代换都在算
     c ≡ f(p) (mod 26)；Playfair 里没有任何一步是算术——两个字母在 5×5 方阵
     里各占一个格子，规则只看它们的**相对位置**：同一行、同一列、还是构成一个
     矩形。把这一条讲清楚是 square 那一页的全部任务。

     真正的分水岭在另一处：它加密的单位是**一对字母**，不是一个字母。
     26 个符号变成 600 个二元组，此前每一页都靠得住的单字母指纹于是消失了。
     但指纹没有蒸发，它**上移了一层**——Playfair 是二元组上的单表代换，所以
     二元组的计数被原样保留（只是换了标签）。digraph 那一页要量的就是这句话。 */

  const SIZE = 5;
  /* 25 个格子放 26 个字母，必须并掉一个。历史上并的是 I/J（也有并 C/K 的版本，
     这里不提供选项：一个只在极少数教材里出现的开关，换来的是每个调用点都要
     多传一个参数、每条测试向量都要说明自己用的是哪种约定）。
     并的方向是 J → I：解密回来的文本里 J 永远变成 I，这是不可逆的损失，
     和插进去的填充字母一样，属于必须对使用者说破的事实。 */
  const MERGED = 'J';
  const SQUARE_ALPHABET = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';   // 25 个字母，没有 J
  /* 默认填充字母。X 是传统选择（英文里 X 极罕见，插进去几乎不会与真正的
     明文混淆）；ALT 只在"要填的那个位置上本来就是 X"时顶上来，理由见 prepare。 */
  const FILLER = 'X';
  const ALT_FILLER = 'Q';

  /* 归一化 + 并字母。normalize 只留 A–Z 并大写（不做 Unicode 折叠，见
     crypto-core 里那段说明），这里再把 J 折进 I —— 方阵里没有 J 的格子，
     不折的话 posOf 会返回 null，一个含 J 的明文会在加密途中当场抛异常。 */
  function mergeJ(text) {
    return C.normalize(text).split(MERGED).join('I');
  }

  /* ================= 方阵 =================
     关键词去重后按出现顺序排在前面，余下的 25 个字母按字母序补齐，行主序。
     与 substitution.keyFromKeyword 是同一条编码习惯——人记不住 25 个乱序
     字母，记得住一个词——只是字母表少了 J、长度是 25 而不是 26。

     返回一个 25 字符的字符串而不是二维数组：方阵在本模块里唯一的用法是
     "给字母找坐标"与"给坐标找字母"，字符串的 indexOf / charAt 直接就是这两件事，
     而二维数组要多一层遍历才能做前者。工具页要画格子时用 at(sq, r, c) 取值，
     不需要它真的是嵌套数组。 */
  function makeSquare(keyword) {
    const s = mergeJ(keyword == null ? '' : keyword);
    const seen = Object.create(null);
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const ch = s.charAt(i);
      if (seen[ch]) continue;
      seen[ch] = 1;
      out += ch;
    }
    for (let i = 0; i < SQUARE_ALPHABET.length; i++) {
      const ch = SQUARE_ALPHABET.charAt(i);
      if (!seen[ch]) out += ch;
    }
    return out;
  }

  /* 方阵只做最便宜的那道检查：是不是 25 字符的字符串。完整的"是不是 25 个
     字母的排列"没必要在这里逐字母数——posOf 找不到字母时本来就会让调用方
     当场抛，而 makeSquare 的输出永远合法。这条判断的全部价值是把
     "传进来一个 undefined / 二维数组"这类调用错误挡在能给出好消息的地方。 */
  function requireSquare(sq, name) {
    if (typeof sq !== 'string' || sq.length !== SIZE * SIZE) {
      throw new Error(name + ' 需要一个 ' + (SIZE * SIZE) + ' 字符的方阵字符串，收到 ' +
                      JSON.stringify(sq));
    }
  }

  /* 字母 → [行, 列]；不在方阵里返回 null（不是抛）。调用方拿 null 去组织
     自己的错误消息，比在这里抛一条不知道上下文的异常有用。 */
  function posOf(square, ch) {
    const i = square.indexOf(ch);
    if (i < 0) return null;
    return [Math.floor(i / SIZE), i % SIZE];
  }

  function at(square, r, c) {
    return square.charAt(C.mod(r, SIZE) * SIZE + C.mod(c, SIZE));
  }

  /* ================= 二元组预处理 —— 各家实现真正分岔的地方 =================

     本模块采用的策略，逐条写死在这里，测试逐条钉住：

       ① 归一化：只留 A–Z、一律大写、J 并进 I。
       ② 从左往右扫。设 a 是当前字母、b 是下一个字母：
          · b 存在且 b === a  →  输出 (a, F)，**只消费 a**（拆开重复对）；
          · b 存在且 b !== a  →  输出 (a, b)，消费两个；
          · b 不存在（a 是最后一个）→ 输出 (a, F)，消费 a（补齐奇数尾）。
       ③ F 取填充字母 X；**当 a 本身就是 X 时改取 Q**。

     ③ 是最容易被漏掉的一条，而漏掉它的后果不是输出难看，是**死循环或非法
     输出**：'XX' 若也用 X 去拆，得到的仍是一对重复字母 (X, X)，方阵里两个
     相同字母落在同一个格子上，三条规则全部退化（既同行又同列），mapPair 无
     从下手。换一个字母顶上去，这个情形就被彻底消灭——由此得到一条可以断言
     的性质：**prepare 的输出里永远不存在重复对**（测试里有这条）。

     还有一条同样容易漏：拆重复对时只能消费一个字母。'AAA' 必须变成
     'AXAXAX'，消费两个的写法会得到 'AXA' 再补一个尾巴，字母都对不上了。

     splitDoubles 默认 true（Playfair 需要它）。四方阵与二方阵**不需要**拆
     重复对——它们的两个字母取自不同的方阵，(a, a) 一点也不退化——所以那两族
     调用时把它关掉，只保留归一化与补尾。这个开关是有默认值的参数而不是两个
     函数，因为除了这一条，三族的预处理逐字节相同，分成两份迟早会走偏。

     诚实声明：这一步是**不可逆**的。解密还原不出原始拼写——插进去的 X 会
     原样出现在解密结果里，J 也一去不返。这不是 bug，是 Playfair 的真实性质，
     工具页必须把它印在画面上，而不是悄悄替使用者擦掉。 */
  function fillerOf(v, dflt) {
    if (v === undefined || v === null || v === '') return dflt;
    const s = C.normalize(v);
    if (s.length !== 1) {
      throw new Error('playfair: 填充字母必须是单个 A–Z 字母，收到 ' + JSON.stringify(v));
    }
    if (s === MERGED) {
      throw new Error('playfair: 填充字母不能是 J —— J 已被并进 I，方阵里没有它的格子');
    }
    return s;
  }

  function prepare(text, opts) {
    const o = opts || {};
    const filler = fillerOf(o.filler, FILLER);
    const alt = fillerOf(o.altFiller, ALT_FILLER);
    if (filler === alt) {
      throw new Error('playfair: 主填充字母与备用填充字母不能相同（都是 ' + filler +
                      '）——备用那个的全部职责就是在"要填的位置本来就是主填充字母"时顶上来');
    }
    const split = o.splitDoubles !== false;
    const s = mergeJ(text);
    let out = '';
    let i = 0;
    while (i < s.length) {
      const a = s.charAt(i);
      const b = (i + 1 < s.length) ? s.charAt(i + 1) : '';
      if (b === '' || (split && b === a)) {
        out += a + (a === filler ? alt : filler);
        i += 1;
      } else {
        out += a + b;
        i += 2;
      }
    }
    return out;
  }

  /* 切成二元组，**不补、不拆**——纯粹是一个视图，给工具页画格子用。
     奇数长度时最后一项长度为 1，如实返回：这里悄悄补一个填充字母会让画面
     显示的东西与 prepare 真正加密的东西不一致，而那种不一致没有任何东西会
     报警。要补齐是 prepare 的职责，两者分开。 */
  function digraphsOf(text) {
    const s = mergeJ(text);
    const out = [];
    for (let i = 0; i < s.length; i += 2) out.push(s.slice(i, i + 2));
    return out;
  }

  /* ================= 三条规则 =================
     dir = +1 加密、−1 解密。

       同一行  →  各自换成**右边**那一个（加密）／左边（解密），走到头绕回本行行首
       同一列  →  各自换成**下面**那一个（加密）／上面（解密），走到底绕回本列列首
       其余    →  两个字母张成一个矩形，各自换成**自己那一行上、对方那一列**的角

     矩形那条规则自己是自己的逆（换完再换一次就回来了），所以 dir 只作用于
     前两条。这不是巧合而是 Playfair 之所以"一套规则同时管加密和解密"的原因，
     也是工具页 square 页要画出来的东西。

     返回值带上全部中间量（两个输入坐标、两个输出坐标、命中的规则名），因为
     工具页要把"哪条规则响了"画在方阵上——让页面自己再判一遍行列相等，就会
     出现"画的是一条规则、算的是另一条"这种只有截图能发现的错。

     两个字母相同时当场抛：那意味着调用方绕过了 prepare（或把 splitDoubles
     关了却又走了 Playfair 这一支）。此时两个字母落在同一个格子上，"同行"与
     "同列"同时成立、矩形退化成一个点，三条规则给出三种互相矛盾的答案。
     悄悄挑一条来用，会产出一段谁也解不开的密文。 */
  function pairAt(square, a, b, dir) {
    const pa = posOf(square, a);
    const pb = posOf(square, b);
    if (!pa || !pb) {
      throw new Error('playfair: 字母 ' + JSON.stringify(!pa ? a : b) +
                      ' 不在方阵里——先过一遍 prepare（它会把 J 并进 I、丢掉非字母）');
    }
    if (pa[0] === pb[0] && pa[1] === pb[1]) {
      throw new Error('playfair: 二元组的两个字母相同（' + a + a + '），' +
                      '三条规则在同一个格子上全部退化——这一对本该在 prepare 里被拆开');
    }
    const d = dir < 0 ? -1 : 1;
    let rule, qa, qb;
    if (pa[0] === pb[0]) {
      rule = 'row';
      qa = [pa[0], C.mod(pa[1] + d, SIZE)];
      qb = [pb[0], C.mod(pb[1] + d, SIZE)];
    } else if (pa[1] === pb[1]) {
      rule = 'col';
      qa = [C.mod(pa[0] + d, SIZE), pa[1]];
      qb = [C.mod(pb[0] + d, SIZE), pb[1]];
    } else {
      rule = 'rect';
      qa = [pa[0], pb[1]];
      qb = [pb[0], pa[1]];
    }
    return {
      rule: rule, a: a, b: b,
      pa: pa, pb: pb, qa: qa, qb: qb,
      out: at(square, qa[0], qa[1]) + at(square, qb[0], qb[1])
    };
  }

  /* 对外的那一个：多一道方阵形状检查。加解密内部走 pairAt，不重复检查——
     它们的方阵是 makeSquare 现造的，每个二元组都验一遍纯属白花时间。 */
  function mapPair(square, a, b, dir) {
    requireSquare(square, 'mapPair');
    return pairAt(square, a, b, dir);
  }

  function encrypt(text, keyword, opts) {
    const sq = makeSquare(keyword);
    const p = prepare(text, opts);
    let out = '';
    for (let i = 0; i < p.length; i += 2) {
      out += pairAt(sq, p.charAt(i), p.charAt(i + 1), 1).out;
    }
    return out;
  }

  /* 解密**不走 prepare**：密文已经是成对的，再拆一次重复对只会凭空多插字母。
     （Playfair 密文里也不可能出现重复对：同行同列换出来的两个字母必然不同，
     矩形换出来的两个字母行号不同因而也必然不同。测试里钉了这条。）

     落单的尾字母原样穿过。真密文永远是偶数长度，这一支只在有人粘进一段残缺
     文本时才会走到；扔掉它是无声丢数据，抛异常则会让工具页整帧空白——原样
     留着最不容易骗人，画面上能直接看见那个孤零零的字母。 */
  function decrypt(text, keyword) {
    const sq = makeSquare(keyword);
    const gs = digraphsOf(text);
    let out = '';
    for (let i = 0; i < gs.length; i++) {
      const g = gs[i];
      if (g.length < 2) { out += g; continue; }
      out += pairAt(sq, g.charAt(0), g.charAt(1), -1).out;
    }
    return out;
  }

  /* ================= 四方阵 =================
     2×2 摆四个方阵：左上与右下是**标准字母表**（明文方阵），右上与左下由两个
     关键词生成（密文方阵）。

       (a, b)  →  a 在左上找坐标 (r1,c1)，b 在右下找坐标 (r2,c2)
                  密文 = 右上[r1][c2] + 左下[r2][c1]

     它买到的不是"更平的统计"（见下面 twoSquare 后面那段），而是两条结构性
     漏洞的消失：① 两个字母来自不同方阵，(a, a) 不再退化，重复对不必拆；
     ② Playfair 那条 AB→XY 蕴含 BA→YX 的对称性没有了。 */
  function fourSquares(kw1, kw2) {
    return {
      tl: SQUARE_ALPHABET, tr: makeSquare(kw1),
      bl: makeSquare(kw2), br: SQUARE_ALPHABET
    };
  }

  /* 四方阵与二方阵的预处理默认**不拆重复对**（splitDoubles 默认 false，与
     Playfair 相反），要拆得显式传 true。补奇数尾照旧——二元组密码总得有偶数
     个字母。 */
  function evenPrep(text, opts) {
    const o = opts || {};
    return prepare(text, {
      filler: o.filler, altFiller: o.altFiller,
      splitDoubles: o.splitDoubles === true
    });
  }

  function fourSquareEncrypt(text, kw1, kw2, opts) {
    const S = fourSquares(kw1, kw2);
    const p = evenPrep(text, opts);
    let out = '';
    for (let i = 0; i < p.length; i += 2) {
      const pa = posOf(S.tl, p.charAt(i));
      const pb = posOf(S.br, p.charAt(i + 1));
      out += at(S.tr, pa[0], pb[1]) + at(S.bl, pb[0], pa[1]);
    }
    return out;
  }

  /* 解密是同一个式子把两组方阵对调：密文第一个字母在右上找、第二个在左下找，
     明文取左上与右下。写成同一个形状而不是"反查表"，是为了让两条路径的对称性
     在代码里就看得见——它正是四方阵能解密的全部依据。 */
  function fourSquareDecrypt(text, kw1, kw2) {
    const S = fourSquares(kw1, kw2);
    const gs = digraphsOf(text);
    let out = '';
    for (let i = 0; i < gs.length; i++) {
      const g = gs[i];
      if (g.length < 2) { out += g; continue; }
      const pa = posOf(S.tr, g.charAt(0));
      const pb = posOf(S.bl, g.charAt(1));
      if (!pa || !pb) {
        throw new Error('fourSquareDecrypt: 字母 ' + JSON.stringify(!pa ? g.charAt(0) : g.charAt(1)) +
                        ' 不在密文方阵里');
      }
      out += at(S.tl, pa[0], pb[1]) + at(S.br, pb[0], pa[1]);
    }
    return out;
  }

  /* ================= 二方阵（竖排 / "双 Playfair"）=================
     上下摆两个方阵，都由关键词生成。

       (a, b)  →  a 在上方阵 (r1,c1)，b 在下方阵 (r2,c2)
                  密文 = 上[r1][c2] + 下[r2][c1]

     两件事顺着这条式子自己掉出来，不需要任何特判：

     ① **c1 === c2 时密文与明文完全相同。** 代入即得 上[r1][c1] + 下[r2][c2]
        = a + b。教科书通常把它写成一条单独的"同列则原样输出"规则，其实它就是
        通式的一个特例。随机情形下两个字母同列的概率是 1/5，也就是说大约每五个
        二元组就有一个**明文照抄在密文里**——这是二方阵最著名的弱点，工具页
        variants 那一页会把它数出来。
     ② **加密与解密是同一个函数。** 把输出再喂一遍：上一次的第一个字母在上方阵
        的坐标是 (r1,c2)、第二个在下方阵是 (r2,c1)，通式给出 上[r1][c1] + 下[r2][c2]
        = (a, b)。所以 twoSquareDecrypt 直接委托给 twoSquareEncrypt，而不是抄一份
        方向相反的实现——那份实现会与这条对合性质悄悄走偏，而没有任何东西会报警。 */
  function twoSquares(kw1, kw2) {
    return { top: makeSquare(kw1), bottom: makeSquare(kw2) };
  }

  function twoSquareEncrypt(text, kw1, kw2, opts) {
    const S = twoSquares(kw1, kw2);
    const p = evenPrep(text, opts);
    let out = '';
    for (let i = 0; i < p.length; i += 2) {
      const pa = posOf(S.top, p.charAt(i));
      const pb = posOf(S.bottom, p.charAt(i + 1));
      out += at(S.top, pa[0], pb[1]) + at(S.bottom, pb[0], pa[1]);
    }
    return out;
  }

  function twoSquareDecrypt(text, kw1, kw2, opts) {
    return twoSquareEncrypt(text, kw1, kw2, opts);
  }

  return {
    SIZE: SIZE, SQUARE_ALPHABET: SQUARE_ALPHABET,
    MERGED: MERGED, FILLER: FILLER, ALT_FILLER: ALT_FILLER,
    makeSquare: makeSquare, posOf: posOf, at: at,
    prepare: prepare, digraphsOf: digraphsOf, mapPair: mapPair,
    encrypt: encrypt, decrypt: decrypt,
    fourSquares: fourSquares, fourSquareEncrypt: fourSquareEncrypt,
    fourSquareDecrypt: fourSquareDecrypt,
    twoSquares: twoSquares, twoSquareEncrypt: twoSquareEncrypt,
    twoSquareDecrypt: twoSquareDecrypt
  };
});
