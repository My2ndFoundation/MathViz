/* 编辑器高亮：纯函数，零 DOM —— 把源码切成一串带类别的文本片段。
   零依赖；node 与浏览器双用。编辑源，运行时被内联进 tools/*.html。

   高亮直接复用 Interp.tokenize，不自己写正则高亮器（规格 §2.8）——
   这样高亮看到的 token 流与执行看到的是同一份，不会出现「高亮说这是
   关键字、解释器说不是」的分歧。tokenize 专门产出 comment token 就是
   为了这里（解析器自己会把它们过滤掉）。

   两条不变量：
   1. 片段拼回去必须与原文逐字节相同（高亮层与透明 textarea 是逐字符
      对齐的两层，错一个字符光标就与文字对不上）。所以片段文本一律用
      src.slice(start, end) 现切，绝不拿 token.value 去 stringify——
      value 对 num 是数字（1e10 这种写法 stringify 会变成
      '10000000000'，与原文不同）、对 tpl 是 {quasis, exprs} 这样的
      对象（反引号、${}、转义序列全部丢失，压根拼不回原文），只有
      从原文切片才能保证逐字节相同。token 之间的空白（还有文件开头/
      结尾的空白）也要单独产出 plain 片段，否则拼接会漏字符。
   2. tokenize 抛错时（未闭合字符串之类）必须降级为纯文本，不能让整个
      编辑器炸掉——使用者打字打到一半，源码几乎总是暂时不合法的。这里
      选择整篇降级（把整个 src 当一个 plain 片段），而不是「高亮到出错
      位置为止、剩余部分纯文本」这种更细的降级：tokenize 是「全有全无」
      的——它出错时不会把已经切出来的 token 一并交还，想做更细的降级
      得自己在 tokenize 内部埋一份「已产出 token」的钩子，这已经超出
      本任务「只用 tokenize，不重写词法逻辑」的范围。代价很直白：一个
      引号没有闭合期间，整份文档都会短暂失去颜色，直到使用者把它闭合。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./interp.js'));
  else root.Editor = factory(root.Interp);
})(typeof self !== 'undefined' ? self : this, function (Interp) {
  'use strict';

  // token.type -> 片段的 cls。跟规格里列的八个值一一对应，plain 不是
  // token 类型，是「两个 token 之间的空白」专用的类别。
  const TYPE_TO_CLS = {
    kw: 'kw', num: 'num', str: 'str', tpl: 'tpl',
    comment: 'comment', name: 'name', punct: 'punct',
  };

  function highlight(src) {
    let tokens;
    try {
      tokens = Interp.tokenize(src);
    } catch (e) {
      // 降级路径，见文件头注释。空源码不会走到这里（tokenize('') 不抛），
      // 但非空源码抛错时，整篇当纯文本，只要非空就产出一个 plain 片段。
      return src.length ? [{ text: src, cls: 'plain' }] : [];
    }

    const segs = [];
    let pos = 0;
    for (const tok of tokens) {
      // eof 是零宽 token（start === end），tokenize('') 只产出这一个——
      // 跳过它，既不给它自己产出片段，也不用它去切空白（它切不出东西）。
      if (tok.type === 'eof') continue;
      if (tok.start > pos) segs.push({ text: src.slice(pos, tok.start), cls: 'plain' });
      segs.push({ text: src.slice(tok.start, tok.end), cls: TYPE_TO_CLS[tok.type] });
      pos = tok.end;
    }
    // 最后一个真 token 之后、到 eof 之前的尾随空白（比如源码末尾的换行）。
    if (pos < src.length) segs.push({ text: src.slice(pos, src.length), cls: 'plain' });
    return segs;
  }

  /* 每一行第一个字符在 src 里的字符下标，下标从 0 开始，行号从 1 开始
     （starts[line - 1] 就是第 line 行的起点）。只按 '\n' 断行——'\r' 被
     当成上一行末尾的一个普通字符，不产生额外的行边界。这不是随便选的
     约定：Interp.tokenize 数行号时也只在遇到 '\n' 时 line++/col=1，
     '\r' 和其它字符一样只让 col++。check() 用 lineStarts 把 (line, col)
     换算成 index，这两处「什么算换行」必须完全一致，否则 CRLF 源码里
     算出来的 index 会偏掉，波浪线画到错的字符上。 */
  function lineStarts(src) {
    const starts = [0];
    for (let i = 0; i < src.length; i++) {
      if (src[i] === '\n') starts.push(i + 1);
    }
    return starts;
  }

  /* 实时语法检查：包一层 Interp.parse，把抛出的 Error 转成 DOM 层能直接
     画波浪线、在行号槽点红点、悬停显示 message 的纯对象（规格 §2.8）。
     空源码不会走到 catch 分支（Interp.parse('') 本身就不抛），这里仍然
     显式写清楚：合法代码返回 null。

     category 原样取自 Interp 抛出的 e.category，不在这里重新按 message
     文本猜——interp.js 才是权威：它决定一段代码是「压根不是合法 JS」
     （syntax）还是「是合法 JS、只是不在这个教学子集里」（unsupported），
     这两类对使用者的意义完全不同，编辑器要用不同的措辞去讲给学习者听，
     但测哪一类是解释器的事，不是这里靠字符串匹配去猜的事。

     message 原样透传，不包一层 {zh, en}、也不做任何翻译——它是从
     interp.js 产生的，编辑器要逐字显示这句话，在这里发明一层双语会让
     措辞跟解释器本身的表述分叉。 */
  function check(src) {
    try {
      Interp.parse(src);
      return null;
    } catch (e) {
      const starts = lineStarts(src);
      const index = starts[e.line - 1] + e.col - 1;
      return { line: e.line, col: e.col, category: e.category, message: e.message, index: index };
    }
  }

  /* ---------------- 括号配对（规格 §2.8「括号配对高亮」） ----------------
     纯函数、零 DOM，node 可测。

     **同样复用 Interp.tokenize，不自己扫字符。** 这不是为了省事，是为了正确：
     裸扫字符会把字符串、模板串、注释里的括号当成真括号——`log("(")` 里的那个
     左括号会去跟真代码里的右括号配对，高亮当场指错地方。词法器已经把它们
     切成了 str/tpl/comment token，只看 punct token 就天然免疫。这与高亮层
     复用同一个词法器是同一条理由（见文件头注释）。

     光标定位约定与主流编辑器一致：**先看光标左邻的那个字符**（刚打完一个
     右括号时，人期待它立刻和它的左括号一起亮），左邻不是括号再看右邻。

     tokenize 抛错（引号没闭合之类）时返回 null，与 highlight() 的降级同一
     策略：打字打到一半源码几乎总是暂时不合法的，这时候不配对好过配错。 */
  const OPENERS = { '(': ')', '[': ']', '{': '}' };
  const CLOSERS = { ')': '(', ']': '[', '}': '{' };

  function bracketList(src) {
    let toks;
    try { toks = Interp.tokenize(src); } catch (e) { return null; }
    const out = [];
    for (let k = 0; k < toks.length; k++) {
      const tk = toks[k];
      if (tk.type !== 'punct') continue;
      const ch = src.slice(tk.start, tk.end);
      if (OPENERS[ch] || CLOSERS[ch]) out.push({ ch: ch, at: tk.start });
    }
    return out;
  }

  /* matchBracket(src, caret) → null | { open, close }，两个都是 src 里的字符下标。
     open 恒小于 close，与光标贴的是哪一头无关——调用方画两个框，不关心是谁
     找到了谁。 */
  function matchBracket(src, caret) {
    const list = bracketList(src);
    if (!list) return null;
    let idx = -1;
    for (let k = 0; k < list.length; k++) if (list[k].at === caret - 1) { idx = k; break; }
    if (idx < 0) for (let k = 0; k < list.length; k++) if (list[k].at === caret) { idx = k; break; }
    if (idx < 0) return null;

    const here = list[idx];
    if (OPENERS[here.ch]) {
      let depth = 0;
      for (let k = idx; k < list.length; k++) {
        if (OPENERS[list[k].ch]) depth++;
        else {
          depth--;
          if (depth === 0) {
            /* 深度归零时遇到的必须是**同种**的右括号；`(]` 这种交叉是配对
               失败，不是配上了——报 null 让高亮不亮，比亮在错的字符上诚实。 */
            return list[k].ch === OPENERS[here.ch] ? { open: here.at, close: list[k].at } : null;
          }
        }
      }
      return null;
    }
    let depth = 0;
    for (let k = idx; k >= 0; k--) {
      if (CLOSERS[list[k].ch]) depth++;
      else {
        depth--;
        if (depth === 0) {
          return list[k].ch === CLOSERS[here.ch] ? { open: list[k].at, close: here.at } : null;
        }
      }
    }
    return null;
  }

  /* ==================== DOM 层：透明 textarea 叠加编辑器（规格 §2.8） ====================

     以下所有代码**只在 mount() 被调用之后**才碰 document / window。模块顶层与
     上面三个纯函数一律零 DOM，node 测试套件（editor.test.js）因此照常装载得了
     这个文件。这条分界线是本模块的架构承诺：逻辑留在纯函数里，DOM 只负责画。
     不要把任何判断（高亮切片、语法检查、行起点换算）搬进这一层——它们在
     node 里可测，搬下来就再也测不了了。

     两层对齐是这套做法唯一真正会坏的地方：textarea 与 <pre> 的字体度量差一丝，
     光标就压在错误的字形上。所以两层的度量**由同一条 CSS 规则**同时声明
     （下面 `.ed-ta,.ed-hl,.ed-hl code,.ed-measure` 并列的那一条），而不是分别
     写两遍——不给「两处各写一遍、有一天只改了一处」留任何机会。

     纵向 padding 一律为 0，上下留白改由 .ed-root 自己的 padding 提供：
     textarea 的纵向 padding 会随内容一起滚走，而高亮层是靠 transform 平移内层
     <code> 的（padding 不跟着动），两者对纵向 padding 的处理天生不同，归零就
     没有这个分歧。横向 padding 两层写的是同一个值，滚动时两层的文字都压在
     padding 区上，行为一致，所以可以留。 */

  const CSS_ID = 'chess-editor-dom-css';
  /* 行高：与下面 CSS 里的 line-height 是同一个数。行号槽、行条纹、波浪线的
     定位全靠它把行号换算成像素——改 CSS 就必须同时改这里。 */
  const LINE_H = 18;
  /* 横向起点。**一个常量喂三处**：textarea 的 padding-left、高亮层的
     padding-left、以及 JS 里波浪线/括号框的 left 计算。
     字体度量已经靠"同一条 CSS 规则命中两层"做到了结构上不可能漂移，横向
     起点原来却是两处各写一遍的 `8px` 字面量——那是同一种失败（光标压在错的
     字形上），只是换了个轴。而且第三处（覆盖层的 left）当时压根没算这 8px，
     波浪线一直整体左移了一个 padding 的宽度。三处现在都从这里取。 */
  const PAD_X = 8;
  const PAD_L = '0 0 0 ' + PAD_X + 'px';
  /* 波浪线用内联 SVG data URI，不引外部图片（零依赖硬约束）。 */
  const SQUIGGLE = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='6' height='3'>" +
                   "<path d='M0 2.4 L1.5 0.6 L3 2.4 L4.5 0.6 L6 2.4' fill='none' stroke='%23f87171' stroke-width='1'/></svg>\")";

  const CSS = [
    '.ed-root{position:relative;display:flex;min-height:0;padding:6px 0;box-sizing:border-box;',
    'background:rgba(8,13,24,.72);border:1px solid rgba(148,163,184,.16);border-radius:10px;overflow:hidden}',
    /* ↓↓↓ 两层度量的唯一声明处，见上面的长注释 ↓↓↓ */
    '.ed-ta,.ed-hl,.ed-hl code,.ed-measure{',
    'font-family:ui-monospace,"SF Mono",Menlo,Consolas,"Cascadia Mono",monospace;',
    'font-size:12.5px;line-height:18px;letter-spacing:0;word-spacing:0;',
    'tab-size:2;-moz-tab-size:2;font-variant-ligatures:none;font-kerning:none;',
    'white-space:pre;overflow-wrap:normal;text-rendering:geometricPrecision}',
    /* ↑↑↑ 两层度量的唯一声明处 ↑↑↑ */
    '.ed-gutter{flex:0 0 auto;width:48px;position:relative;overflow:hidden;',
    'background:rgba(6,10,20,.55);border-right:1px solid rgba(148,163,184,.14);user-select:none}',
    '.ed-gutter-inner{position:absolute;left:0;top:0;right:0}',
    '.ed-ln{position:relative;height:18px;line-height:18px;box-sizing:border-box;',
    'font:11px/18px ui-monospace,"SF Mono",Menlo,Consolas,monospace;',
    'color:rgba(159,176,200,.42);text-align:right;padding-right:8px;cursor:pointer}',
    '.ed-ln:hover{color:#bfefff;background:rgba(45,212,234,.07)}',
    '.ed-ln.bp{color:#ffd9e0}',
    '.ed-ln.bp::before{content:"";position:absolute;left:5px;top:5px;width:8px;height:8px;border-radius:50%;',
    'background:#fb7185;box-shadow:0 0 6px rgba(251,113,133,.85)}',
    '.ed-ln.err::after{content:"";position:absolute;left:17px;top:6px;width:6px;height:6px;border-radius:50%;background:#f87171}',
    '.ed-ln.cur{color:#9be8f7;background:rgba(45,212,234,.12)}',
    '.ed-body{position:relative;flex:1 1 auto;min-width:0}',
    '.ed-lines{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0}',
    '.ed-lines-inner{position:absolute;left:0;top:0;right:0}',
    '.ed-stripe{position:absolute;left:0;right:0;height:18px}',
    '.ed-stripe.visited{background:rgba(45,212,234,.055)}',
    '.ed-stripe.frame{background:rgba(167,139,250,.14);box-shadow:inset 2px 0 0 #a78bfa}',
    '.ed-stripe.cur{background:rgba(45,212,234,.16);box-shadow:inset 2px 0 0 #2dd4ea}',
    '.ed-squiggle{position:absolute;height:18px;background-repeat:repeat-x;background-position:left bottom;',
    'background-size:6px 3px;background-image:' + SQUIGGLE + '}',
    /* 括号配对高亮：两个等宽的框，一个套开括号、一个套闭括号 */
    '.ed-bracket{position:absolute;height:18px;box-sizing:border-box;',
    'border:1px solid rgba(45,212,234,.7);border-radius:2px;background:rgba(45,212,234,.12)}',
    '.ed-hl{position:absolute;inset:0;margin:0;padding:' + PAD_L + ';box-sizing:border-box;',
    'overflow:hidden;pointer-events:none;z-index:1;color:#dbe6f5}',
    '.ed-hl code{display:block}',
    '.ed-measure{position:absolute;visibility:hidden;left:-9999px;top:0}',
    '.ed-ta{position:absolute;inset:0;z-index:2;box-sizing:border-box;width:100%;height:100%;',
    'margin:0;padding:' + PAD_L + ';border:0;outline:none;resize:none;display:block;',
    'background:transparent;color:transparent;caret-color:#7dd3fc;overflow:auto}',
    '.ed-ta::selection{background:rgba(45,212,234,.30)}',
    '.ed-ta::-webkit-scrollbar{width:8px;height:8px}',
    '.ed-ta::-webkit-scrollbar-thumb{background:rgba(148,163,184,.28);border-radius:4px}',
    /* token 配色：沿用子项目调色板（violet / orange / emerald / slate） */
    '.ed-kw{color:#a78bfa}',
    '.ed-num{color:#fb923c}',
    '.ed-str,.ed-tpl{color:#34d399}',
    '.ed-comment{color:rgba(159,176,200,.48);font-style:italic}',
    '.ed-name{color:#dbe6f5}',
    '.ed-punct{color:rgba(159,176,200,.82)}',
  ].join('');

  function ensureStyles() {
    if (document.getElementById(CSS_ID)) return;
    const st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* mount(el, { value, onChange, debounce }) → handle。

     onChange(value, err) 在**防抖之后**调用一次，err 是 check() 的原样返回值
     （合法时 null）——调用方据此禁用 Run（规格 §2.8：不会跑到一半才崩）。
     mount() 结束前会同步触发一次，这样 Run 的初始禁用态在第一次输入之前
     就是对的，而不是要等使用者先敲一个字符。

     handle 上与调试器对接的四个入口（setExecLine / setVisited / setFrameLine /
     setBreakpoints）都只改「怎么画」，不持有任何调试状态——断点的真身在
     Debugger 的 cur.breakpoints 上，这里只拿一个谓词去问它。 */
  function mount(el, opts) {
    opts = opts || {};
    ensureStyles();

    el.classList.add('ed-root');
    el.textContent = '';

    const gutter = document.createElement('div');
    gutter.className = 'ed-gutter';
    const gutterInner = document.createElement('div');
    gutterInner.className = 'ed-gutter-inner';
    gutter.appendChild(gutterInner);

    const body = document.createElement('div');
    body.className = 'ed-body';
    const lines = document.createElement('div');
    lines.className = 'ed-lines';
    const linesInner = document.createElement('div');
    linesInner.className = 'ed-lines-inner';
    lines.appendChild(linesInner);
    const pre = document.createElement('pre');
    pre.className = 'ed-hl';
    const code = document.createElement('code');
    pre.appendChild(code);
    const ta = document.createElement('textarea');
    ta.className = 'ed-ta';
    ta.spellcheck = false;
    ta.setAttribute('wrap', 'off');              // 关掉软换行：两层都必须 pre，不折行
    ta.setAttribute('autocapitalize', 'off');
    ta.setAttribute('autocomplete', 'off');
    ta.setAttribute('autocorrect', 'off');
    ta.value = opts.value == null ? '' : String(opts.value);
    body.appendChild(lines);
    body.appendChild(pre);
    body.appendChild(ta);

    el.appendChild(gutter);
    el.appendChild(body);

    let execLine = null;        // 当前执行行（调试器写）
    let frameLine = null;       // 选中的调用栈帧所在行（调试器写）
    let visited = Object.create(null);
    let hasBreak = function () { return false; };
    let gutterClick = null;
    let err = null;
    let lineCount = 0;
    let charW = 0;
    let bracket = null;         // matchBracket() 的最近一次结果

    /* 行起点缓存：refreshMarkers 与 caretLine 都要 lineStarts(ta.value)，而
       refreshMarkers 在播放时每帧都跑。源码在两次调用之间几乎从不变，缓存
       一份、按内容比对失效即可（字符串相等是一次 memcmp，比重建一个几十项
       的数组 + 分配便宜得多）。 */
    let startsText = null, startsArr = null;
    function currentStarts() {
      if (startsText !== ta.value) { startsText = ta.value; startsArr = lineStarts(startsText); }
      return startsArr;
    }

    /* 字符宽度：拿一个与高亮层度量完全相同的隐藏元素实测，而不是靠
       canvas.measureText 另建一套字体串——那样又多出一处「同一个度量写两遍」。

       **量到 0 时绝不缓存。** 面板此刻可能整个 display:none（验收页按 `\`
       折叠时就是），getBoundingClientRect 返回 0。原来的 `w || 7` 会把
       7px 这个假宽度钉死一整个会话，此后每一条波浪线、每一个括号框都错位，
       而且再也没有机会自愈。现在量不到就返回 0，调用方跳过这一次绘制，
       等面板可见时的下一次刷新自然量到真值。 */
    function measureChar() {
      const probe = document.createElement('span');
      probe.className = 'ed-measure';
      probe.textContent = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';   // 40 个
      body.appendChild(probe);
      const w = probe.getBoundingClientRect().width / 40;
      body.removeChild(probe);
      return w > 0 ? w : 0;
    }
    function ensureCharW() {
      if (charW > 0) return charW;
      const w = measureChar();
      if (w > 0) charW = w;
      return w;
    }

    /* 字符下标 → 覆盖层里的像素位置。PAD_X 必须加上：覆盖层（.ed-lines）是
       贴着 .ed-body 满铺的，而文字从 padding-left 之后才开始。 */
    function posOf(index) {
      const starts = currentStarts();
      let lo = 0, hi = starts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (starts[mid] <= index) lo = mid; else hi = mid - 1;
      }
      return { line: lo + 1, col: index - starts[lo] + 1 };
    }
    function leftPx(col) { return PAD_X + (col - 1) * charW; }

    function renderHighlight() {
      const src = ta.value;
      const segs = highlight(src);
      const frag = document.createDocumentFragment();
      for (let k = 0; k < segs.length; k++) {
        const s = segs[k];
        if (s.cls === 'plain') {
          frag.appendChild(document.createTextNode(s.text));
        } else {
          const sp = document.createElement('span');
          sp.className = 'ed-' + s.cls;
          sp.textContent = s.text;
          frag.appendChild(sp);
        }
      }
      /* 末尾补一个换行：源码最后一行为空时，<pre> 不会为它留出一行的高度，
         而 textarea 会——补上之后两层的总高度一致，滚到底不会错位。 */
      frag.appendChild(document.createTextNode('\n'));
      code.textContent = '';
      code.appendChild(frag);
    }

    function renderGutter() {
      const n = lineStarts(ta.value).length;
      if (n === lineCount) return;
      lineCount = n;
      const frag = document.createDocumentFragment();
      for (let i = 1; i <= n; i++) {
        const d = document.createElement('div');
        d.className = 'ed-ln';
        d.dataset.line = String(i);
        d.textContent = String(i);
        frag.appendChild(d);
      }
      gutterInner.textContent = '';
      gutterInner.appendChild(frag);
    }

    /* 只改标记，不重建 DOM：断点/当前行/错误行每一步都在变，重建整槽会把
       点击目标在指针按下与抬起之间换掉。 */
    function refreshMarkers() {
      const kids = gutterInner.children;
      for (let i = 0; i < kids.length; i++) {
        const ln = i + 1;
        const d = kids[i];
        d.classList.toggle('bp', !!hasBreak(ln));
        d.classList.toggle('cur', execLine === ln);
        d.classList.toggle('err', !!err && err.line === ln);
        d.title = (err && err.line === ln) ? err.message : '';
      }

      const frag = document.createDocumentFragment();
      for (const key in visited) {
        const ln = +key;
        if (ln === execLine || ln === frameLine) continue;
        const st = document.createElement('div');
        st.className = 'ed-stripe visited';
        st.style.top = ((ln - 1) * LINE_H) + 'px';
        frag.appendChild(st);
      }
      if (frameLine != null && frameLine !== execLine) {
        const st = document.createElement('div');
        st.className = 'ed-stripe frame';
        st.style.top = ((frameLine - 1) * LINE_H) + 'px';
        frag.appendChild(st);
      }
      if (execLine != null) {
        const st = document.createElement('div');
        st.className = 'ed-stripe cur';
        st.style.top = ((execLine - 1) * LINE_H) + 'px';
        frag.appendChild(st);
      }
      /* 波浪线与括号框都要按字符宽度定位。量不到宽度（面板此刻不可见）时
         **一个都不画**——画出来必然错位，等下一次可见时的刷新再补。 */
      if ((err || bracket) && ensureCharW() > 0) {
        if (err) {
          const starts = currentStarts();
          const from = err.index;
          const lineEnd = starts[err.line] != null ? starts[err.line] - 1 : ta.value.length;
          const width = Math.max(1, lineEnd - from) * charW;
          const sq = document.createElement('div');
          sq.className = 'ed-squiggle';
          sq.style.top = ((err.line - 1) * LINE_H) + 'px';
          sq.style.left = leftPx(err.col) + 'px';
          sq.style.width = width + 'px';
          frag.appendChild(sq);
        }
        if (bracket) {
          [bracket.open, bracket.close].forEach(function (ix) {
            const p = posOf(ix);
            const b = document.createElement('div');
            b.className = 'ed-bracket';
            b.style.top = ((p.line - 1) * LINE_H) + 'px';
            b.style.left = leftPx(p.col) + 'px';
            b.style.width = charW + 'px';
            frag.appendChild(b);
          });
        }
      }
      linesInner.textContent = '';
      linesInner.appendChild(frag);
    }

    /* 滚动同步：textarea 是唯一的滚动源（它拥有输入与选区），高亮层与行号槽
       都用 transform 跟随。用 transform 而不是给它们各自设 scrollTop——
       textarea 的 scrollTop 在某些浏览器上是小数，赋给另一个元素会被取整，
       一整屏文字随之上下抖半个像素。 */
    function syncScroll() {
      const x = ta.scrollLeft, y = ta.scrollTop;
      code.style.transform = 'translate(' + (-x) + 'px,' + (-y) + 'px)';
      linesInner.style.transform = 'translate(0px,' + (-y) + 'px)';
      gutterInner.style.transform = 'translate(0px,' + (-y) + 'px)';
    }

    function emit() {
      err = check(ta.value);
      renderGutter();
      refreshMarkers();
      if (typeof opts.onChange === 'function') opts.onChange(ta.value, err);
    }

    /* 光标动了就重算括号配对。返回「结果变没变」，让调用方只在真的变了时
       才重建覆盖层——方向键在一行里连按十下，配对结果一次没变，不该重画
       十次。 */
    function syncBracket() {
      const next = (ta.selectionStart === ta.selectionEnd)
        ? matchBracket(ta.value, ta.selectionStart)
        : null;                        // 有选区时不高亮配对，与主流编辑器一致
      const same = (!next && !bracket) ||
                   (!!next && !!bracket && next.open === bracket.open && next.close === bracket.close);
      bracket = next;
      return !same;
    }
    function onCaretMove() {
      if (syncBracket()) refreshMarkers();
    }

    let timer = null;
    const delay = opts.debounce == null ? 220 : opts.debounce;
    function onInput() {
      renderHighlight();
      renderGutter();
      syncBracket();
      /* 改过内容之后必须立刻重刷标记层。原来这里只调 renderGutter()，
         而行号槽的 bp/cur/err 类与条纹层都归 refreshMarkers() 管——于是
         打一个字符之后，断点圆点、当前行高亮、已执行行痕迹会整整消失
         一个防抖窗口（220 ms），等 emit() 跑完才回来。 */
      refreshMarkers();
      syncScroll();
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { timer = null; emit(); }, delay);
    }

    ta.addEventListener('input', onInput);
    ta.addEventListener('scroll', syncScroll);
    ta.addEventListener('keyup', onCaretMove);
    ta.addEventListener('click', onCaretMove);
    ta.addEventListener('focus', onCaretMove);
    ta.addEventListener('blur', function () { if (bracket) { bracket = null; refreshMarkers(); } });

    /* Tab 缩进（规格 §2.8）。优先走 execCommand('insertText')——它是唯一能
       把这次改动并进**浏览器原生撤销栈**的写法；手动改 value 会把 Ctrl+Z
       之前的历史整条抹掉，而"原生撤销"正是选透明 textarea 这套做法的理由
       之一。execCommand 已废弃但仍是各浏览器唯一可用的入口，不可用时退回
       setRangeText（撤销历史会断，但至少不吞按键）。 */
    ta.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      let ok = false;
      try { ok = document.execCommand('insertText', false, '  '); } catch (e2) { ok = false; }
      if (!ok) {
        const s = ta.selectionStart, t2 = ta.selectionEnd;
        ta.setRangeText('  ', s, t2, 'end');
      }
      onInput();
    });

    gutter.addEventListener('click', function (e) {
      const row = e.target && e.target.closest ? e.target.closest('.ed-ln') : null;
      if (!row || !gutterClick) return;
      gutterClick(+row.dataset.line);
    });

    function caretLine() { return posOf(ta.selectionStart).line; }

    function setVisitedList(list) {
      visited = Object.create(null);
      for (let k = 0; k < (list || []).length; k++) visited[list[k]] = true;
    }

    function scrollToLine(line) {
      if (line == null) return;
      const top = (line - 1) * LINE_H;
      const h = ta.clientHeight;
      if (top < ta.scrollTop + LINE_H) ta.scrollTop = Math.max(0, top - LINE_H * 2);
      else if (top > ta.scrollTop + h - LINE_H * 2) ta.scrollTop = top - h + LINE_H * 3;
      syncScroll();
    }

    renderHighlight();
    syncScroll();
    emit();                      // 建好即先报一次：Run 的初始禁用态不必等第一次输入

    return {
      root: el, textarea: ta, pre: pre, gutter: gutter,
      getValue: function () { return ta.value; },
      setValue: function (v) {
        ta.value = v == null ? '' : String(v);
        ta.scrollTop = 0; ta.scrollLeft = 0;
        visited = Object.create(null);
        execLine = null; frameLine = null;
        if (timer) { clearTimeout(timer); timer = null; }
        renderHighlight();
        lineCount = 0;                 // 强制重建行号槽（行数很可能变了）
        syncScroll();
        emit();
      },
      focus: function () { ta.focus(); },
      caretLine: caretLine,
      scrollToLine: scrollToLine,
      setExecLine: function (line) { execLine = line == null ? null : line; refreshMarkers(); },
      setFrameLine: function (line) { frameLine = line == null ? null : line; refreshMarkers(); },
      setVisited: function (list) {
        setVisitedList(list);
        refreshMarkers();
      },
      /* 三样调试状态一次性推进来，**只重建一次标记层**。调试器每走一步都要
         更新这三样，拆成三个 setter 就是三次 refreshMarkers()（每次都重建
         整块条纹层、有语法错时还各自重算一遍 lineStarts）。播放时这条路径
         每帧都走，三倍开销白付。个别 setter 保留，给只改一样的调用方。 */
      setDebugState: function (o) {
        o = o || {};
        if ('visited' in o) setVisitedList(o.visited);
        if ('execLine' in o) execLine = o.execLine == null ? null : o.execLine;
        if ('frameLine' in o) frameLine = o.frameLine == null ? null : o.frameLine;
        refreshMarkers();
        if (o.scrollTo != null) scrollToLine(o.scrollTo);
      },
      setBreakpoints: function (pred) { hasBreak = pred || function () { return false; }; refreshMarkers(); },
      onGutterClick: function (fn) { gutterClick = fn; },
      getError: function () { return err; },
      getBracket: function () { return bracket; },
      refresh: function () { renderHighlight(); renderGutter(); refreshMarkers(); syncScroll(); },
      destroy: function () {
        if (timer) clearTimeout(timer);
        el.textContent = '';
        el.classList.remove('ed-root');
      },
    };
  }

  return { highlight: highlight, check: check, lineStarts: lineStarts,
           matchBracket: matchBracket, mount: mount, LINE_H: LINE_H, PAD_X: PAD_X };
});
