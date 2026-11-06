'use strict';
/* 「挖空填空」模式的判定器：拿使用者填的答案跟参考答案（挖空体原文）逐 token 比对。
   零依赖；node 与浏览器双用。

   ---- 严格是有意的，不是偷懒 ----

   这套东西练的是肌肉记忆。Python 允许同一件事写出好几种等价写法，但这里不靠
   「放宽判定」去容纳它们——多写法由「同一问题给多个变体程序」在题库层面容纳。
   判定器只吞两样东西：token 之间的空白、注释（整块的绝对缩进另由调用方查，
   见下）。除此之外一律参与比对，包括：

     · 引号风格   'a'  ≠  "a"
     · 数字写法   10000000000  ≠  1e10
     · 空内部各行的相对缩进（空内部多行之间谁比谁多缩进、少缩进，而缩进
       正是 Python 最该练的东西——所以单独参与比对，见 normalize() 的 rel）

   这三样能被判定器"顺手"保留，是因为 normalize() 从不重写 token 的文字——
   每个 token 的 text 都是从原始源码里 slice 出来的原文切片，不经过任何
   语义层面的归一化（不把数字算出数值、不把字符串统一成一种引号）。
   正因为这样，负控制①（故意在 normalize 里把字符串引号改写成双引号）
   才会真的让"引号风格参与比对"变红——这条判定不是靠一段额外的比对逻辑
   撑住的，是靠"从不改写原文"这条设计本身撑住的，改写一下就会看见它塌。

   **整块的绝对缩进不归这里管。** 挖空框里的整段文字——包括第一行行首的
   缩进——都是她的答案：框的缺省值是这个空的缩进本身（interact.js 的
   blankBox），但她可以删改它，Exercise.merge 会把整段原样替换回源码。
   本判定器只比「每条有效行相对第一条有效行」的缩进差，所以单行空 `    x = 1`
   与 `x = 1` 在这里判同；第一行的绝对缩进由 PyInteract.blankFeedback 在调
   compare() 之前自己比（kind 'lead-indent'）。

   ---- token 化不是为了放宽，是为了报错报得有意义 ----

   直接比对源码字符串，报错只能说"第 37 个字符不对"；token 化之后，
   compare() 能定位到"第几个 token"，说出"期待 // 你写了 /"。

   ---- 依赖惰性取 ----

   `factory(function () { return root.PyLex; })`，不是 `factory(root.PyLex)`：
   python/scripts/inline_core.py 按标记块就地替换，不保证 PY-LEX 一定排在
   JUDGE 前面。取值推迟到真正调用的那一刻，块的先后顺序就不再重要
   （spec §4.6，与 chess/core/editor.js 对 Interp 的处理同一条纪律）。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(function () { return require('./py-lex.js'); });
  } else {
    root.Judge = factory(function () { return root.PyLex; });
  }
})(typeof self !== 'undefined' ? self : this, function (getPyLex) {
  'use strict';

  /* 取 PyLex 并当场校验，未装载时响亮地抛——不要安静地退化成"永远判同/永远判异"。 */
  function pyLex() {
    var L = getPyLex();
    if (!L || typeof L.tokenize !== 'function' || typeof L.significant !== 'function') {
      throw new Error('Judge needs PyLex (python/core/py-lex.js) loaded first: ' +
                      'the PY-LEX inline block must come before the JUDGE one.');
    }
    return L;
  }

  /* 每一行的前导空白（空格、制表符）字符数，不管制表宽度——判定器只关心
     "谁比谁多缩进"，不关心缩进真实占几列。 */
  function leadingWidth(line) {
    var m = /^[ \t]*/.exec(line);
    return m[0].length;
  }

  /* 每一条**有效行**相对第一条有效行的缩进差，无效行整条跳过（不占数组里的一格）。
     这样整块的绝对缩进被吞掉（它由 blankFeedback 另查，见文件头），行间的
     相对缩进保留。
     relLines 与 rel 一一对应，记的是每一项在源码里的**物理行号（0 起）**——
     跳过无效行之后 rel 数组的下标就不再等于物理行号了，UI 拿 index 去放光标，
     指错行是静默的坏（裁决 R31），所以必须把物理行号单独带出来。

     "有效行"的判据是 sigLines：**这一行有没有落着至少一个有效 token**（由
     normalize() 从已经切好的 toks 反推），而不是拿一条空白正则去猜"这行
     是不是空的"。裁决 R35(a)：一整行独立注释也没有有效 token，判据必须
     跟 significant() 走同一件事，否则一行注释会被当成"有内容"，让两边
     有效行条数错误地不相等——这正是评审抓到的 Critical bug①的根因
     （旧写法只测字面空白，测不出"这行只有注释"）。 */
  function relativeIndent(src, sigLines) {
    var lines = src.split('\n');
    var leads = [];
    var relLines = [];
    for (var i = 0; i < lines.length; i++) {
      if (!sigLines[i]) { continue; } /* 这一行没有有效 token：跳过，不计入 */
      leads.push(leadingWidth(lines[i]));
      relLines.push(i);
    }
    if (leads.length === 0) { return { rel: [], relLines: [] }; }
    var base = leads[0]; /* 第一条**有效行**，不是字面第一行（裁决 R36：契约措辞有歧义，已按此订正） */
    return { rel: leads.map(function (w) { return w - base; }), relLines: relLines };
  }

  /* src 里每一个字符偏移量所在的行起始偏移量表：starts[k] 是第 k 行（0 起）
     第一个字符的偏移量。token 的 start 递增地落进这张表，用一个不回退的
     指针线性扫描即可，不需要为每个 token 各扫一遍全表。 */
  function lineStarts(src) {
    var starts = [0];
    for (var i = 0; i < src.length; i++) {
      if (src.charAt(i) === '\n') { starts.push(i + 1); }
    }
    return starts;
  }

  /* normalize(src) -> { toks: [{text, line, col}], rel: number[], relLines: number[] }
     toks     ：滤掉 ws/nl/comment 之后，每个 token 的原文切片 + 行列号（1 起行号，
                0 起列号，对齐 CPython tokenize 的记号习惯）。
     rel      ：见 relativeIndent——每条有效行相对第一条有效行的缩进差。
     relLines ：与 rel 一一对应的物理行号（0 起）。 */
  function normalize(src) {
    var L = pyLex();
    var tokens = L.significant(L.tokenize(src));
    var starts = lineStarts(src);
    var lineIdx = 0;
    var toks = tokens.map(function (t) {
      /* tokens 按 start 递增排列（py-lex 的构造性保证之一），指针只前进不回退 */
      while (lineIdx + 1 < starts.length && starts[lineIdx + 1] <= t.start) { lineIdx++; }
      return {
        text: src.slice(t.start, t.end),
        line: lineIdx + 1,
        col: t.start - starts[lineIdx]
      };
    });
    /* sigLines：从已经切好的 toks 反推"第几行落着有效 token"，rel 的有效行
       判据直接问这张表，不再另起一条与 tokenize 无关的空白正则（裁决 R35a）。 */
    var sigLines = Object.create(null);
    for (var i = 0; i < toks.length; i++) { sigLines[toks[i].line - 1] = true; }
    var ind = relativeIndent(src, sigLines);
    return { toks: toks, rel: ind.rel, relLines: ind.relLines };
  }

  /* ---- 块层级：两边有效行条数不同时才用（清理波，phase1-deferred §一.3） ----

     有效行条数相同时，compare() 照旧按相对缩进**宽度**严比（rel）。条数不同的
     合法写法只有两种：单行复合语句（`if x: y` 对两行写法）与括号内断行。以前这时
     完全不比缩进，于是 `if a:\n    if b: c()\nd()` 判等于 `d()` 缩进在外层 if
     里的那四行——语义变了也判对。

     这里把源码切成**逻辑行**（括号深度 > 0、或上一个有效 token 是反斜杠续行
     `\`、或上一个 token 是跨行的三引号字符串时，并入上一逻辑行），用一个缩进栈
     把每条逻辑行映射成**块层级**（第一条逻辑行为 0）；复合语句头（行首是
     COMPOUND 里的关键字，括号深度 0 的第一个 `:`）后面同一行的体算深一层。
     compare() 再逐 token 比层级：原文相同、层级不同 → kind 'block'。

     CPython 会拒绝的三种缩进：
       · unexpected indent（上一逻辑行不是以 `:` 结尾的语句头，这一行却变深）：
         「变深」时层级取上一逻辑行**最深处**加一——`if a: b` 之后多缩进一行，它比 b
         还深、不与 b 同层——所以它的层级按构造就比合法的参考多一层；
       · expected an indented block（以 `:` 结尾的语句头之后没有变深）：参考是合法
         Python，同一串 token 在参考里语句头之后的那个 token 必在深一层，作答不深，
         层级按构造就不同；
       · unindent does not match any outer indentation level（退缩进到栈里没有的
         宽度）：层级可能碰巧等于参考，只有这一种记成 bad，不论层级等不等都判错。
     前两种另记 bad 是冗余的：负控制实测，另记的 bad 删掉，测试与门全绿，所以不留。 */
  var COMPOUND = { 'if': 1, 'elif': 1, 'else': 1, 'for': 1, 'while': 1, 'try': 1,
                   'except': 1, 'finally': 1, 'with': 1, 'def': 1, 'class': 1 };
  var OPENERS = { '(': 1, '[': 1, '{': 1 };
  var CLOSERS = { ')': 1, ']': 1, '}': 1 };

  function countNewlines(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) { if (s.charAt(i) === '\n') { n++; } }
    return n;
  }

  /* blockLevels(toks) -> { lvl: number[], bad: boolean[] }，与 toks 一一对应。 */
  function blockLevels(toks) {
    var lvl = new Array(toks.length);
    var bad = new Array(toks.length);
    if (toks.length === 0) { return { lvl: lvl, bad: bad }; }

    /* 1. 切逻辑行：每项是 toks 的下标区间 [from, to) */
    var logical = [];
    var depth = 0, from = 0;
    for (var i = 0; i < toks.length; i++) {
      if (i > 0) {
        var prev = toks[i - 1];
        var prevEnd = prev.line + countNewlines(prev.text);
        if (depth === 0 && toks[i].line > prevEnd && prev.text !== '\\') {
          logical.push([from, i]);
          from = i;
        }
      }
      var tx = toks[i].text;
      if (OPENERS[tx]) { depth++; } else if (CLOSERS[tx] && depth > 0) { depth--; }
    }
    logical.push([from, toks.length]);

    /* 2. 缩进栈 */
    var stack = null;           /* [{ w, lvl }] */
    var prevDeepest = 0;        /* 上一逻辑行最深的层级 */
    for (var k = 0; k < logical.length; k++) {
      var a = logical[k][0], b = logical[k][1];
      var w = toks[a].col;
      var level, isBad = false;
      if (stack === null) {
        stack = [{ w: w, lvl: 0 }];
        level = 0;
      } else {
        var top = stack[stack.length - 1];
        if (w > top.w) {
          level = prevDeepest + 1;
          stack.push({ w: w, lvl: level });
        } else if (w === top.w) {
          level = top.lvl;
        } else {
          var popped = null;
          while (stack.length && stack[stack.length - 1].w > w) { popped = stack.pop(); }
          if (stack.length === 0) {
            /* 空的片段可以退到第一行之外（一个空从函数体末尾跨到模块顶层）：
               记成比被弹掉的最外层浅一层的新栈底，不算不合法。 */
            level = popped.lvl - 1;
            stack.push({ w: w, lvl: level });
          } else if (stack[stack.length - 1].w === w) {
            level = stack[stack.length - 1].lvl;
          } else {
            level = stack[stack.length - 1].lvl + 1;
            isBad = true;
            stack.push({ w: w, lvl: level });
          }
        }
      }

      /* 3. 复合语句头：括号深度 0 的第一个 `:`，其后同一逻辑行的 token 深一层 */
      var head = toks[a].text;
      var isHeader = !!COMPOUND[head] ||
        (head === 'async' && a + 1 < b && /^(def|for|with)$/.test(toks[a + 1].text));
      var colon = -1;
      if (isHeader) {
        var d = 0;
        for (var j = a; j < b; j++) {
          var t = toks[j].text;
          if (OPENERS[t]) { d++; } else if (CLOSERS[t] && d > 0) { d--; }
          else if (t === ':' && d === 0) { colon = j; break; }
        }
      }
      for (var m = a; m < b; m++) {
        lvl[m] = (colon !== -1 && m > colon) ? level + 1 : level;
        bad[m] = isBad;
      }
      /* 一行写法：体在同一行，这一逻辑行最深处深一层 */
      prevDeepest = (colon !== -1 && colon < b - 1) ? level + 1 : level;
    }
    return { lvl: lvl, bad: bad };
  }

  /* 两个数组第一处不同的下标；一个是另一个的前缀时，下标取较短那个的长度；
     完全相同返回 -1。 */
  function firstDiffIndex(a, b) {
    var n = Math.min(a.length, b.length);
    for (var i = 0; i < n; i++) {
      if (a[i] !== b[i]) { return i; }
    }
    if (a.length !== b.length) { return n; }
    return -1;
  }

  /* compare(answer, reference) -> { ok, index, expected, got, kind }
     kind ∈ 'equal' | 'different' | 'missing' | 'extra' | 'indent' | 'block'

     'block'（清理波）：两边有效行条数不同、token 原文到此处都相同、而块层级不同
     （或答案这一逻辑行的缩进 CPython 会拒绝）——见 blockLevels。index 与 'indent'
     同语义（答案侧物理行号，0 起），expected/got 是块层级数字。

     顺序：先比 rel，**但只有两边有效行条数相同时**，值不同才归类 'indent'；
     rel 相同、或有效行条数本身就不同，都落到逐 token 比原文，短的一方先到头
     分类成 missing / extra。

     裁决 R35(b)：有效行条数不同是"少写/多写了一整行"，不是"缩进不对"——
     把它也归进 indent 正是评审抓到的 Critical bug②的根因：旧写法只要 rel
     长度不等就无条件返回 indent，`missing`/`extra` 该管的情形被 indent
     抢先接住，还顺带把 got/expected 逼出 null（违反 R30）。现在只有两边
     长度相同时才会走进 indent 分支，此时 relIdx（若不是 -1）必然同时是
     na.rel/nr.rel/na.relLines/nr.relLines 四个数组的合法下标——不再需要
     任何 null 兜底。

     'indent' 分支的 expected/got/index（裁决 R30/R31）：
       expected = 参考在该处的相对缩进数值，got = 答案在该处的相对缩进数值——
       两者都是数字，不是 null：UI 要说得出"第 N 行缩进应为 8，你写了 4"。
       index 是**物理行号（0 起）**，取答案自己的 relLines（长度相同时
       na.relLines[relIdx] 与 nr.relLines[relIdx] 未必相等——两边有效行
       物理位置可以不同，比如挖空体内部空行数量相同但位置不同——但都合法，
       这里选答案侧，因为 UI 是在她打的文本里放光标）。 */
  function compare(answer, reference) {
    var na = normalize(answer);
    var nr = normalize(reference);

    if (na.rel.length === nr.rel.length) {
      var relIdx = firstDiffIndex(na.rel, nr.rel);
      if (relIdx !== -1) {
        return {
          ok: false,
          index: na.relLines[relIdx],
          expected: nr.rel[relIdx],
          got: na.rel[relIdx],
          kind: 'indent'
        };
      }
    }

    var at = na.toks, rt = nr.toks;
    /* 有效行条数不同：相对缩进宽度没法逐行对，改比块层级（见 blockLevels）。
       条数相同时上面已经按宽度严比过，这里不再重复。 */
    var la = null, lr = null;
    if (na.rel.length !== nr.rel.length) {
      la = blockLevels(at);
      lr = blockLevels(rt);
    }
    var n = Math.min(at.length, rt.length);
    for (var i = 0; i < n; i++) {
      if (at[i].text !== rt[i].text) {
        return { ok: false, index: i, expected: rt[i].text, got: at[i].text, kind: 'different' };
      }
      if (la && (la.bad[i] || la.lvl[i] !== lr.lvl[i])) {
        /* 'block'：与 'indent' 同一套 index 语义（答案侧**物理行号**，0 起），
           expected/got 是块层级（相对第一条逻辑行，数字）。从不涉及字面量原文。 */
        return { ok: false, index: at[i].line - 1, expected: lr.lvl[i], got: la.lvl[i], kind: 'block' };
      }
    }
    if (at.length < rt.length) {
      return { ok: false, index: at.length, expected: rt[at.length].text, got: null, kind: 'missing' };
    }
    if (at.length > rt.length) {
      return { ok: false, index: rt.length, expected: null, got: at[rt.length].text, kind: 'extra' };
    }
    return { ok: true, index: -1, expected: null, got: null, kind: 'equal' };
  }

  return { normalize: normalize, compare: compare };
});
