(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    /* node 下取兄弟文件：路径用 path.join 拼，不写字面的父目录相对路径。
       理由不是风格——那个字符串会被 inline_core.py 原样内联进每个工具页，
       而 check.py 的 outbound_ref_check() 正在数整个子树里的父目录引用，
       用它守住"cryptography/ 可以整体搬走"这条约束。浏览器分支根本走不到
       这一行，为它留一条会触发普查的字面量不划算。 */
    module.exports = factory(
      require(require('path').join(__dirname, '..', 'crypto-core.js')),
      require(require('path').join(__dirname, 'polybius.js')));
  } else {
    root.CryptoAlgos = root.CryptoAlgos || {};
    /* ⚠ 浏览器分支从 root.CryptoAlgos.polybius 取方阵，所以工具页的
       `GENERATED:ALGOS` 清单里 **polybius.js 必须排在 fractionation.js 之前**，
       而 polybius.js 自己又要求 transposition.js 排在它之前。整条清单因此是
         transposition.js,polybius.js,fractionation.js
       顺序错了页面照样载入，直到用户第一次动手才死在 PB.makeSquare 上——
       与 check.py 第 9 道门守的 CRYPTO-CORE 顺序同一种失败形状。 */
    root.CryptoAlgos.fractionation = factory(root.CryptoCore, root.CryptoAlgos.polybius);
  }
})(typeof self !== 'undefined' ? self : this, function (C, PB) {
  'use strict';

  /* ================= 分割密码：Bifid / Trifid / 分行 Bifid =================

     波利比乌斯那一页已经证明过：方阵单独用毫无强度，它只是把每个字母换成
     一对坐标，频率剖面原封不动地跟着搬家。ADFGX 靠一次列换位把两半拉开。
     Delastelle 1901 年的 bifid 用的是另一条路，而且不需要第二把钥匙：

       把坐标写成上下两行，然后**按行读**。

     一个 L 个字母的块，坐标写成
         行： r0 r1 r2 … r(L-1)
         列： c0 c1 c2 … c(L-1)
     按行读出来是 r0 r1 … r(L-1) c0 c1 … c(L-1)，再两两重新配对成新的坐标对，
     查回方阵得到密文。于是第 k 个密文字母吃的是第 2k 与第 2k+1 个数字——
     它们**通常来自两个不同的明文字母**，而且一个可能是"行"、另一个是"列"。
     换位的那一步被折进了读取顺序里，没有第二把钥匙。

     ---- period 就是扩散旋钮，而 period = 1 是那个证明 ----
     块长 L = 1 时：一个字母、两个数字 r0 c0，读出来还是 r0 c0，配回去
     就是**原来那个字母**。也就是说

         bifidEncrypt(t, sq, 1) === PB.decode(PB.encode(t, sq), sq)

     ——正是波利比乌斯"编码再解码"的那条恒等式，一次代换，什么也没得到。
     周期越大，一个字母的两半在数字流里相距越远（正好 L），落到的两个密文
     字母也就越远。这个模块把这件事做成可测量的数：见 structure()。

     ---- 一条不能省略的观察：偶数周期是个陷阱 ----
     structure() 算出来的连通分量大小（"跟这个字母纠缠在一起的明文字母有几个"）
     在奇偶之间是锯齿形的：L 为奇数时整块 L 个字母连成一体，L 为偶数时**恒为 2**，
     再大也没用。原因是偶数块里行段与列段对齐，(r0,r1) 与 (c0,c1) 配的是同一对
     字母，第二次配对没有带来任何新的连接。ACA 的教材里"周期通常取奇数"这句
     经验之谈说的就是它。工具页第二个页签把这条锯齿直接画出来。

     ---- Trifid：同一个想法升一维 ----
     3×3×3 的立方体装 27 格（26 个字母 + 一个填充符），每个字母摊成三个坐标，
     写成三行、按行读、每三个一组配回去。一个字母因此能碰到**三个**密文字母，
     两半之间的最远距离也从 L/2 涨到 2L/3。

     ---- seriatedBifid：先说清楚它不是历史上的哪一个 ----
     ACA 的 "Seriated"（分行）是给 **Playfair** 定义的：明文写成两行、每行
     period 个字母，**竖着**成对，再按 Playfair 规则加密。文献里没有一个叫
     "seriated bifid" 的历史密码；bifid 本来就是按周期分行的，"seriated bifid"
     在多数资料里只是"带周期的 bifid"的别名。
     本模块给出的是把那套分行几何**原样搬到 bifid 上**的构造，并且写明它是
     构造而不是史料：每一竖对（第 i 列的上下两个字母）按 period 为 2 的 bifid
     加密。于是每个密文字母混的两个明文字母正好相距 period——扩散距离由
     period 直接给出，与 Seriated Playfair 的语义一致。 */

  /* ---- 3×3×3 立方体 ----
     不复用 PB.makeSquare：它只接受 5 阶与 6 阶，其余尺寸当场抛（那条纪律是
     故意的，见 polybius.js）。立方体是另一个形状——27 格、三个下标——硬塞进
     "size" 参数只会让那个函数同时表达两件不同的事。方阵那一半（bifid 用的
     5×5 / 6×6、coordsOf、charAt）仍然整段来自 polybius.js，本文件一行都没重写。

     第 27 个符号取 '.'：26 个字母正好差一个才凑满 27 格。它**不来自明文**
     （明文按 C.normalize 只留 A-Z），但可以出现在密文里——三个坐标指到那一格
     是完全正常的。这样 trifid 没有 5×5 那种 I/J 合并的信息丢失，往返是精确的。 */
  const CUBE_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ.';
  const CUBE_N = 3;

  function normalizeCubeKey(keyword) {
    return String(keyword == null ? '' : keyword).toUpperCase().replace(/[^A-Z.]/g, '');
  }

  function makeCube(keyword) {
    const kw = normalizeCubeKey(keyword);
    const cells = [];
    /* Object.create(null) 而不是 {}：格子里只有 A-Z 与 '.'，撞不上 'constructor'
       这类原型键，但这个哈希的用途就是"见过没有"，让它带一份原型属于白送一个
       将来会咬人的假阳性。与 polybius.makeSquare 同一条理由。 */
    const seen = Object.create(null);
    function push(ch) {
      if (seen[ch]) return;
      seen[ch] = 1;
      cells.push(ch);
    }
    for (let i = 0; i < kw.length; i++) push(kw.charAt(i));
    for (let i = 0; i < CUBE_POOL.length; i++) push(CUBE_POOL.charAt(i));
    return { size: CUBE_N, cells: cells, keyword: kw, pool: CUBE_POOL, dims: 3 };
  }

  /* 与 polybius 的 coordsOf 一样用**0 基**（它们是数组下标）；工具页要印
     教科书上的 1-3 时自己 +1。三个下标的名字是 a（层）b（行）c（列），
     index = a*9 + b*3 + c。 */
  function cubeCoordsOf(ch, cube) {
    const s = String(ch == null ? '' : ch).toUpperCase();
    if (s.length !== 1) return null;
    const i = cube.cells.indexOf(s);
    if (i < 0) return null;
    return { a: Math.floor(i / 9), b: Math.floor((i % 9) / 3), c: i % 3, index: i, ch: s };
  }

  function cubeCharAt(a, b, c, cube) {
    if (!Number.isInteger(a) || !Number.isInteger(b) || !Number.isInteger(c)) {
      /* 非整数下标会走成 cells[13.5] === undefined：不报错、密文里凭空少一个
         字母、中间没有任何一步出声。在入口拒绝比在输出端反查便宜得多。 */
      throw new Error('cubeCharAt: 三个坐标必须是整数，收到 (' + a + ', ' + b + ', ' + c + ')');
    }
    if (a < 0 || a > 2 || b < 0 || b > 2 || c < 0 || c > 2) return null;
    return cube.cells[a * 9 + b * 3 + c];
  }

  /* Trifid 的明文只留 A-Z：填充符 '.' 是立方体的第 27 格，不是明文的一部分。
     让它从明文进来会把"密文长度 = 明文字母数"这条使用者肉眼在数的关系搅乱。 */
  function normalizeCube(text) { return C.normalize(text); }

  /* ---- 分块 ----
     period <= 0（或没给）表示"整段文本一个块"，也就是 bifid 的古典形态。
     period 大于文本长度时同样只有一个块——不做任何填充，与 polybius/ADFGX
     的"密文长度恒等于明文字母数"保持同一条纪律。 */
  function blockLen(n, period) {
    if (period == null || period <= 0) return n;
    return Math.max(1, Math.round(period));
  }

  function blocksOf(n, period) {
    const out = [];
    if (!(n > 0)) return out;
    const L = blockLen(n, period);
    for (let s = 0; s < n; s += L) out.push({ start: s, len: Math.min(L, n - s) });
    return out;
  }

  /* ================= 结构：不看文本、只看形状 =================
     一个字母的第 h 个坐标在块内数字流里的位置是 q = h*L + j，
     第 k 个密文字母吃的是数字 q = k*d … k*d+d-1（d = 2 是 bifid、3 是 trifid）。
     两条式子互为逆：字母 j 的第 h 个坐标 → 密文 floor((h*L+j)/d)；
     密文 k 的第 slot 个坐标 ← 明文 (k*d+slot) % L。

     把它单独做成一个**与方阵、与文本都无关**的函数，有两个好处：
       ① 工具页的周期页要为 period = 1…12 各算一遍连通分量，跑真密码太贵；
       ② 测试可以拿它跟真算法逐字符对撞——两条独立推导给出同一个答案，
          才算真的钉住了"某个坐标落在哪儿"。
     touch[i] 是明文第 i 个字母**直接**影响到的密文下标（去重升序）；
     comp[i] 是它所在连通分量的大小（"要动它就得连带知道多少个明文字母"）。 */
  function structure(n, period, dims) {
    const d = Math.max(2, Math.round(dims == null ? 2 : dims));
    const blocks = blocksOf(n, period);
    const touch = new Array(n);
    const span = new Array(n);
    const src = new Array(n);
    const parent = new Array(n);
    for (let i = 0; i < n; i++) parent[i] = i;
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    function union(x, y) { const a = find(x), b = find(y); if (a !== b) parent[a] = b; }

    for (let bi = 0; bi < blocks.length; bi++) {
      const b = blocks[bi], L = b.len;
      for (let j = 0; j < L; j++) {
        const seen = [];
        for (let h = 0; h < d; h++) {
          const out = b.start + Math.floor((h * L + j) / d);
          if (seen.indexOf(out) < 0) seen.push(out);
        }
        seen.sort(function (x, y) { return x - y; });
        touch[b.start + j] = seen;
        span[b.start + j] = seen[seen.length - 1] - seen[0];
      }
      for (let k = 0; k < L; k++) {
        const from = [];
        for (let slot = 0; slot < d; slot++) {
          const p = b.start + ((k * d + slot) % L);
          if (from.indexOf(p) < 0) from.push(p);
        }
        from.sort(function (x, y) { return x - y; });
        src[b.start + k] = from;
        for (let z = 1; z < from.length; z++) union(from[0], from[z]);
      }
    }

    const size = Object.create(null);
    for (let i = 0; i < n; i++) {
      const r = find(i);
      size[r] = (size[r] || 0) + 1;
    }
    const comp = new Array(n);
    let maxComp = 0, maxTouch = 0, sumTouch = 0, sumSpan = 0;
    for (let i = 0; i < n; i++) {
      comp[i] = size[find(i)];
      if (comp[i] > maxComp) maxComp = comp[i];
      if (touch[i].length > maxTouch) maxTouch = touch[i].length;
      sumTouch += touch[i].length;
      sumSpan += span[i];
    }
    return {
      n: n, dims: d, len: blockLen(n, period), blocks: blocks,
      touch: touch, span: span, src: src, comp: comp,
      maxComp: maxComp, maxTouch: maxTouch,
      meanTouch: n ? sumTouch / n : 0,
      meanSpan: n ? sumSpan / n : 0
    };
  }

  /* ================= Bifid ================= */

  /* 坐标流：前 L 个是行、后 L 个是列。抽出来单独一个函数，因为加密、解密、
     trace 三处要的是**同一份**顺序，抄三遍迟早有一处写反。 */
  function bifidDigits(plain, square, start, len) {
    const rows = [], cols = [];
    for (let j = 0; j < len; j++) {
      const p = PB.coordsOf(plain.charAt(start + j), square);
      if (!p) throw new Error('bifid: 字符 ' + JSON.stringify(plain.charAt(start + j)) + ' 不在方阵里');
      rows.push(p.row); cols.push(p.col);
    }
    return rows.concat(cols);
  }

  function bifidEncrypt(text, square, period) {
    const plain = PB.normalizeFor(text, square.size);
    const n = plain.length;
    if (!n) return '';
    const blocks = blocksOf(n, period);
    let out = '';
    for (let bi = 0; bi < blocks.length; bi++) {
      const b = blocks[bi];
      const dg = bifidDigits(plain, square, b.start, b.len);
      for (let k = 0; k < b.len; k++) out += PB.charAt(dg[2 * k], dg[2 * k + 1], square);
    }
    return out;
  }

  function bifidDecrypt(cipher, square, period) {
    const c = PB.normalizeFor(cipher, square.size);
    const n = c.length;
    if (!n) return '';
    const blocks = blocksOf(n, period);
    let out = '';
    for (let bi = 0; bi < blocks.length; bi++) {
      const b = blocks[bi];
      /* 密文的坐标按顺序摊平就是当初读出来的那串数字，再劈成前后两半，
         第 j 个明文字母是 (前半[j], 后半[j])。 */
      const dg = [];
      for (let k = 0; k < b.len; k++) {
        const p = PB.coordsOf(c.charAt(b.start + k), square);
        if (!p) throw new Error('bifidDecrypt: 字符 ' + JSON.stringify(c.charAt(b.start + k)) + ' 不在方阵里');
        dg.push(p.row, p.col);
      }
      for (let j = 0; j < b.len; j++) out += PB.charAt(dg[j], dg[b.len + j], square);
    }
    return out;
  }

  /* ================= Trifid ================= */

  function trifidDigits(plain, cube, start, len) {
    const A = [], B = [], D = [];
    for (let j = 0; j < len; j++) {
      const p = cubeCoordsOf(plain.charAt(start + j), cube);
      if (!p) throw new Error('trifid: 字符 ' + JSON.stringify(plain.charAt(start + j)) + ' 不在立方体里');
      A.push(p.a); B.push(p.b); D.push(p.c);
    }
    return A.concat(B).concat(D);
  }

  function trifidEncrypt(text, cube, period) {
    const plain = normalizeCube(text);
    const n = plain.length;
    if (!n) return '';
    const blocks = blocksOf(n, period);
    let out = '';
    for (let bi = 0; bi < blocks.length; bi++) {
      const b = blocks[bi];
      const dg = trifidDigits(plain, cube, b.start, b.len);
      for (let k = 0; k < b.len; k++) out += cubeCharAt(dg[3 * k], dg[3 * k + 1], dg[3 * k + 2], cube);
    }
    return out;
  }

  function trifidDecrypt(cipher, cube, period) {
    /* 密文可以含第 27 个符号 '.'，所以这里**不能**用 normalizeCube（它只留 A-Z）。 */
    const c = String(cipher == null ? '' : cipher).toUpperCase().replace(/[^A-Z.]/g, '');
    const n = c.length;
    if (!n) return '';
    const blocks = blocksOf(n, period);
    let out = '';
    for (let bi = 0; bi < blocks.length; bi++) {
      const b = blocks[bi];
      const dg = [];
      for (let k = 0; k < b.len; k++) {
        const p = cubeCoordsOf(c.charAt(b.start + k), cube);
        if (!p) throw new Error('trifidDecrypt: 字符 ' + JSON.stringify(c.charAt(b.start + k)) + ' 不在立方体里');
        dg.push(p.a, p.b, p.c);
      }
      const L = b.len;
      for (let j = 0; j < L; j++) out += cubeCharAt(dg[j], dg[L + j], dg[2 * L + j], cube);
    }
    return out;
  }

  /* ================= 分行 Bifid（构造，不是史料——见文件头） =================
     一"组"是 2·period 个字母：上行 top 个、下行 bot 个。
       top = min(period, ceil(k/2))，bot = k − top
     这条式子保证 bot <= top <= period，且末组零填充：k = 2p 时 top = bot = p；
     k 为奇数时最后一列只有上行那一个字母。

     竖着成对的两个字母（上行第 i 个与下行第 i 个）按 period 为 2 的 bifid 加密：
       出[2i]   = charAt(行(上), 行(下))
       出[2i+1] = charAt(列(上), 列(下))
     只有上行的那一列（i >= bot）没有对手，它的行与列配回自己，**原样穿过**。
     这是真实存在的一个洞，不是四舍五入——所以 trace 里把它单独标出来
     （unpaired），工具页可以用设计规范那个专供"没有对手"的品红色画它。 */
  function seriesOf(n, period) {
    const p = Math.max(1, Math.round(period == null || period <= 0 ? n : period));
    const out = [];
    if (!(n > 0)) return out;
    for (let s = 0; s < n; s += 2 * p) {
      const k = Math.min(2 * p, n - s);
      const top = Math.min(p, Math.ceil(k / 2));
      out.push({ start: s, len: k, top: top, bot: k - top });
    }
    return out;
  }

  function seriatedBifidEncrypt(text, square, period) {
    const plain = PB.normalizeFor(text, square.size);
    const n = plain.length;
    if (!n) return '';
    const series = seriesOf(n, period);
    let out = '';
    for (let si = 0; si < series.length; si++) {
      const S = series[si];
      let paired = '', solo = '';
      for (let i = 0; i < S.top; i++) {
        const a = PB.coordsOf(plain.charAt(S.start + i), square);
        if (i < S.bot) {
          const b = PB.coordsOf(plain.charAt(S.start + S.top + i), square);
          paired += PB.charAt(a.row, b.row, square) + PB.charAt(a.col, b.col, square);
        } else {
          solo += PB.charAt(a.row, a.col, square);
        }
      }
      out += paired + solo;
    }
    return out;
  }

  function seriatedBifidDecrypt(cipher, square, period) {
    const c = PB.normalizeFor(cipher, square.size);
    const n = c.length;
    if (!n) return '';
    const series = seriesOf(n, period);
    let out = '';
    for (let si = 0; si < series.length; si++) {
      const S = series[si];
      const topLine = [], botLine = [];
      for (let i = 0; i < S.bot; i++) {
        const u = PB.coordsOf(c.charAt(S.start + 2 * i), square);
        const v = PB.coordsOf(c.charAt(S.start + 2 * i + 1), square);
        topLine.push(PB.charAt(u.row, v.row, square));
        botLine.push(PB.charAt(u.col, v.col, square));
      }
      for (let i = S.bot; i < S.top; i++) topLine.push(c.charAt(S.start + S.bot + i));
      out += topLine.join('') + botLine.join('');
    }
    return out;
  }

  /* ================= trace：每个坐标半落在哪儿 =================
     工具页画的每一条线都从这里来，测试也从这里拿数——两边读同一份表，
     "画面上的那条线"和"断言里的那个数"就不会各自算一遍再慢慢错开
     （polybius.adfgxTrace 立的是同一条规矩）。

       coords[i]        第 i 个明文字母的坐标（bifid 是 {row,col}，trifid 是 {a,b,c}）
       dest[2i+h] / [3i+h]  第 i 个字母的第 h 个坐标落在密文的第几个字母上
       slot[…]          它落进那个密文字母的第几个坐标位（0 = 第一个坐标）
       srcOf[k]         密文第 k 个字母的 d 个坐标各自来自哪个明文字母
       srcHalf[k]       …以及那来的是明文字母的第几个坐标（画颜色要用）
       touch/span/comp  见 structure() */
  function traceCommon(plain, cipher, coords, dims, period) {
    const n = plain.length;
    const st = structure(n, period, dims);
    const dest = new Array(n * dims);
    const slot = new Array(n * dims);
    const srcOf = new Array(n);
    const srcHalf = new Array(n);
    for (let bi = 0; bi < st.blocks.length; bi++) {
      const b = st.blocks[bi], L = b.len;
      for (let j = 0; j < L; j++) {
        for (let h = 0; h < dims; h++) {
          const q = h * L + j;
          dest[(b.start + j) * dims + h] = b.start + Math.floor(q / dims);
          slot[(b.start + j) * dims + h] = q % dims;
        }
      }
      for (let k = 0; k < L; k++) {
        const from = [], half = [];
        for (let s = 0; s < dims; s++) {
          const q = k * dims + s;
          from.push(b.start + (q % L));
          half.push(Math.floor(q / L));
        }
        srcOf[b.start + k] = from;
        srcHalf[b.start + k] = half;
      }
    }
    return {
      plain: plain, n: n, cipher: cipher, coords: coords,
      dims: dims, period: period, len: st.len, blocks: st.blocks,
      dest: dest, slot: slot, srcOf: srcOf, srcHalf: srcHalf,
      touch: st.touch, span: st.span, comp: st.comp,
      maxComp: st.maxComp, maxTouch: st.maxTouch,
      meanTouch: st.meanTouch, meanSpan: st.meanSpan
    };
  }

  function bifidTrace(text, square, period) {
    const plain = PB.normalizeFor(text, square.size);
    const coords = [];
    for (let i = 0; i < plain.length; i++) coords.push(PB.coordsOf(plain.charAt(i), square));
    return traceCommon(plain, bifidEncrypt(plain, square, period), coords, 2, period);
  }

  function trifidTrace(text, cube, period) {
    const plain = normalizeCube(text);
    const coords = [];
    for (let i = 0; i < plain.length; i++) coords.push(cubeCoordsOf(plain.charAt(i), cube));
    return traceCommon(plain, trifidEncrypt(plain, cube, period), coords, 3, period);
  }

  /* 分行 bifid 的去向表另算：它的几何不是"块内数字流"，而是"竖对"。
     硬套 traceCommon 会给出一张看起来很像、其实指错地方的表——比没有表更坏。 */
  function seriatedTrace(text, square, period) {
    const plain = PB.normalizeFor(text, square.size);
    const n = plain.length;
    const coords = [];
    for (let i = 0; i < n; i++) coords.push(PB.coordsOf(plain.charAt(i), square));
    const cipher = seriatedBifidEncrypt(plain, square, period);
    const series = seriesOf(n, period);
    const dest = new Array(n * 2);
    const slot = new Array(n * 2);
    const partner = new Array(n);
    const unpaired = [];
    for (let si = 0; si < series.length; si++) {
      const S = series[si];
      for (let i = 0; i < S.top; i++) {
        const a = S.start + i;
        if (i < S.bot) {
          const b = S.start + S.top + i;
          partner[a] = b; partner[b] = a;
          dest[a * 2] = S.start + 2 * i;     slot[a * 2] = 0;
          dest[a * 2 + 1] = S.start + 2 * i + 1; slot[a * 2 + 1] = 0;
          dest[b * 2] = S.start + 2 * i;     slot[b * 2] = 1;
          dest[b * 2 + 1] = S.start + 2 * i + 1; slot[b * 2 + 1] = 1;
        } else {
          const q = S.start + S.bot + i;
          partner[a] = -1;
          unpaired.push(a);
          dest[a * 2] = q; slot[a * 2] = 0;
          dest[a * 2 + 1] = q; slot[a * 2 + 1] = 1;
        }
      }
    }
    const touch = new Array(n), span = new Array(n), comp = new Array(n);
    for (let i = 0; i < n; i++) {
      const t = (dest[i * 2] === dest[i * 2 + 1]) ? [dest[i * 2]] : [dest[i * 2], dest[i * 2 + 1]];
      touch[i] = t;
      span[i] = t[t.length - 1] - t[0];
      comp[i] = partner[i] >= 0 ? 2 : 1;
    }
    return {
      plain: plain, n: n, cipher: cipher, coords: coords,
      dims: 2, period: period, series: series,
      dest: dest, slot: slot, partner: partner, unpaired: unpaired,
      touch: touch, span: span, comp: comp
    };
  }

  /* 三条路的统一入口。工具页的三个页签共用一个调用点，少一处"这一页调哪个"
     的分支就少一处会写反的地方。 */
  function trace(kind, text, key, period) {
    if (kind === 'trifid') return trifidTrace(text, key, period);
    if (kind === 'seriated') return seriatedTrace(text, key, period);
    if (kind === 'bifid') return bifidTrace(text, key, period);
    throw new Error('trace: kind 只能是 bifid / trifid / seriated，收到 ' + JSON.stringify(kind));
  }

  return {
    CUBE_POOL,
    makeCube, cubeCoordsOf, cubeCharAt, normalizeCube, normalizeCubeKey,
    blockLen, blocksOf, seriesOf, structure,
    bifidEncrypt, bifidDecrypt, bifidTrace,
    trifidEncrypt, trifidDecrypt, trifidTrace,
    seriatedBifidEncrypt, seriatedBifidDecrypt, seriatedTrace,
    trace
  };
});
