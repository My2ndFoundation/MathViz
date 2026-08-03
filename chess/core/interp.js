/* 可单步的 JavaScript 子集解释器（规格 §2.6）。
   零依赖、零 DOM；node 与浏览器双用。编辑源，运行时被内联进 tools/*.html。

   三层：tokenize（词法）→ parse（递归下降）→ run（生成器求值 + 轨迹记录）。

   词法器是公开导出的，因为阶段 3b 的编辑器要用**同一份 token 流**做语法高亮
   （规格 §2.8）——高亮与执行看到的是同一个词法器，就不会出现「高亮说这是
   关键字、解释器说不是」这种分歧。这也是注释要产出 token 的原因：高亮层需要
   它们，解析器自己跳过。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Interp = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* 子集内的关键字。不在这张表里的保留字（class / async / await / try /
     catch / this / new / delete / typeof …）走 name 通道进解析器，由解析器
     在语法位置上报 unsupported —— 报错要说「不支持 class 声明」而不是
     「意外的标识符 class」，后者对使用者毫无帮助。 */
  const KEYWORDS = ['let', 'const', 'if', 'else', 'for', 'of', 'while',
                    'break', 'continue', 'function', 'return', 'true', 'false', 'null'];

  /* 多字符运算符按长度倒序排，保证 '===' 先于 '==' 先于 '=' 被匹配到。
     顺序错了会把 '!==' 切成 '!=' + '='，而那个错误只在特定表达式上暴露。 */
  const PUNCT = ['===', '!==', '**=', '...', '=>', '==', '!=', '<=', '>=', '&&', '||',
                 '++', '--', '+=', '-=', '*=', '/=', '%=', '**',
                 '{', '}', '(', ')', '[', ']', ';', ',', '.', ':', '?',
                 '+', '-', '*', '/', '%', '<', '>', '=', '!'];

  function err(msg, line, col, category) {
    const e = new Error(msg);
    e.line = line; e.col = col; e.category = category || 'syntax';
    return e;
  }

  const ESCAPES = {
    n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"', '`': '`', '0': '\0',
    /* 反斜杠紧跟一个真实换行符是「续行」：原生里这两个字符整体消失，
       不是把换行符原样并进字符串——这跟下面 C1 的「裸换行必须报错」是
       两回事：那里说的是没有反斜杠打头的裸换行，这里是转义过的。 */
    '\n': '',
  };

  function tokenize(src) {
    const out = [];
    let i = 0, line = 1, col = 1;
    const peek = (k) => src[i + (k || 0)];
    function adv(n) {
      for (let k = 0; k < (n || 1); k++) {
        if (src[i] === '\n') { line++; col = 1; } else { col++; }
        i++;
      }
    }
    function push(type, value, start, sl, sc) {
      out.push({ type: type, value: value, line: sl, col: sc, start: start, end: i });
    }

    /* 转义序列的换算统一交给原生的 parseInt / String.fromCodePoint，不
       自己写码位转换表——自己实现只会多一处可能和原生分歧的地方（这正
       是 C3 出问题的原因：那时压根没做进制转换，1e10 被词法器当成数字 1
       后面跟着标识符 e10）。调用时 i 已经跳过反斜杠，停在紧跟反斜杠的
       第一个字符上。 */
    function readEscape(sl, sc) {
      if (i >= src.length) return '';
      const c2 = src[i];
      if (c2 === 'u') return readUnicodeEscape(sl, sc);
      if (c2 === 'x') return readHexEscape(sl, sc);
      const mapped = ESCAPES[c2];
      const out2 = mapped !== undefined ? mapped : c2;
      adv();
      return out2;
    }
    function readHexEscape(sl, sc) {
      adv(); // 跳过 'x'
      const hs = i;
      for (let k = 0; k < 2 && i < src.length && /[0-9a-fA-F]/.test(src[i]); k++) adv();
      const hex = src.slice(hs, i);
      if (hex.length !== 2) throw err('Invalid hexadecimal escape sequence', sl, sc);
      return String.fromCodePoint(parseInt(hex, 16));
    }
    function readUnicodeEscape(sl, sc) {
      adv(); // 跳过 'u'
      if (src[i] === '{') {
        adv();
        const hs = i;
        while (i < src.length && /[0-9a-fA-F]/.test(src[i])) adv();
        const hex = src.slice(hs, i);
        if (hex.length === 0 || src[i] !== '}') throw err('Invalid Unicode escape sequence', sl, sc);
        const code = parseInt(hex, 16);
        if (code > 0x10FFFF) throw err('Undefined Unicode code-point', sl, sc);
        adv(); // 跳过 '}'
        return String.fromCodePoint(code);
      }
      const hs = i;
      for (let k = 0; k < 4 && i < src.length && /[0-9a-fA-F]/.test(src[i]); k++) adv();
      const hex = src.slice(hs, i);
      if (hex.length !== 4) throw err('Invalid Unicode escape sequence', sl, sc);
      return String.fromCodePoint(parseInt(hex, 16));
    }

    /* 供 ${...} 花括号计深使用：只管把游标越过一段字符串/嵌套模板串，
       不提取内容——它们内部的 { / } 不该被算进外层表达式的花括号深度。
       嵌套模板串会递归调用 skipNestedTemplate 处理它自己的 ${...}
       （同样需要跳过其中的字符串），支持任意层嵌套。 */
    function skipNestedString(quote, sl, sc) {
      /* 单/双引号在这里也不能裸换行——跟主循环里字符串分支的 C1 检查
         是同一条规则，必须重复一遍而不是指望"反正后面 parseExpression
         会再 tokenize 一次、到时候会抓到"：这个词法器是公开导出的，
         阶段 3b 编辑器的语法高亮直接调 tokenize()，不会走到"第二遍"，
         漏掉这里就是漏掉了高亮能看到的那一份检查（规格 §2.8）。反引号
         模板串本身允许跨行，所以这条检查只在这个函数里，不在
         skipNestedTemplate 的外层循环里。 */
      adv(); // 跳过开始引号
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\n') throw err('Unterminated string: raw newline not allowed', sl, sc);
        if (src[i] === '\\') { adv(); if (i < src.length) adv(); }
        else adv();
      }
      if (i >= src.length) throw err('Unterminated string inside template expression', sl, sc);
      adv(); // 跳过结束引号
    }
    function skipNestedTemplate(sl, sc) {
      adv(); // 跳过开始反引号
      while (i < src.length && src[i] !== '`') {
        if (src[i] === '\\') { adv(); if (i < src.length) adv(); }
        else if (src[i] === '$' && peek(1) === '{') {
          adv(2);
          let depth = 1;
          while (i < src.length && depth > 0) {
            if (src[i] === '{') { depth++; adv(); }
            else if (src[i] === '}') { depth--; if (depth > 0) adv(); }
            else if (src[i] === "'" || src[i] === '"') { skipNestedString(src[i], sl, sc); }
            else if (src[i] === '`') { skipNestedTemplate(sl, sc); }
            else adv();
          }
          if (i >= src.length) throw err('Unterminated template expression', sl, sc);
          adv(); // 跳过匹配的 '}'
        } else adv();
      }
      if (i >= src.length) throw err('Unterminated template string inside template expression', sl, sc);
      adv(); // 跳过结束反引号
    }

    /* 数字字面量后面紧跟一个十进制数字或标识符起始字符，原生一律是硬
       报错（5g / 0x1Fg / 0o19 / 1e10x 都属此类）——统一在这一处堵死，
       不必对每种数字形态（十进制/十六进制/科学计数法…）各写一次同样
       的检查，也不会漏掉某个分支忘记检查。 */
    function checkNumTail(sl, sc) {
      if (i < src.length) {
        const nc = src[i];
        if ((nc >= '0' && nc <= '9') || /[A-Za-z_$]/.test(nc)) {
          throw err('Invalid number: a numeric literal cannot be immediately followed by ' +
                     JSON.stringify(nc), sl, sc);
        }
      }
    }

    while (i < src.length) {
      const c = src[i], sl = line, sc = col, start = i;

      if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { adv(); continue; }

      if (c === '/' && peek(1) === '/') {
        while (i < src.length && src[i] !== '\n') adv();
        push('comment', src.slice(start, i), start, sl, sc);
        continue;
      }
      if (c === '/' && peek(1) === '*') {
        adv(2);
        while (i < src.length && !(src[i] === '*' && peek(1) === '/')) adv();
        if (i >= src.length) throw err('Unterminated block comment', sl, sc);
        adv(2);
        push('comment', src.slice(start, i), start, sl, sc);
        continue;
      }

      if ((c >= '0' && c <= '9') || (c === '.' && peek(1) >= '0' && peek(1) <= '9')) {
        /* 数字字面量：十进制（含小数、科学计数法）/ 十六进制 / 八进制 /
           二进制 / 前导小数点。 */
        if (c === '0' && (peek(1) === 'x' || peek(1) === 'X')) {
          adv(2);
          const hs = i;
          while (i < src.length && /[0-9a-fA-F]/.test(src[i])) adv();
          if (i === hs) throw err('Invalid number: expected hex digits after 0x', sl, sc);
          checkNumTail(sl, sc);
          push('num', parseInt(src.slice(hs, i), 16), start, sl, sc);
          continue;
        }
        if (c === '0' && (peek(1) === 'o' || peek(1) === 'O')) {
          adv(2);
          const os = i;
          while (i < src.length && src[i] >= '0' && src[i] <= '7') adv();
          if (i === os) throw err('Invalid number: expected octal digits after 0o', sl, sc);
          checkNumTail(sl, sc);
          push('num', parseInt(src.slice(os, i), 8), start, sl, sc);
          continue;
        }
        if (c === '0' && (peek(1) === 'b' || peek(1) === 'B')) {
          adv(2);
          const bs = i;
          while (i < src.length && (src[i] === '0' || src[i] === '1')) adv();
          if (i === bs) throw err('Invalid number: expected binary digits after 0b', sl, sc);
          checkNumTail(sl, sc);
          push('num', parseInt(src.slice(bs, i), 2), start, sl, sc);
          continue;
        }
        /* 0 打头紧跟另一个十进制数字（017 / 08 这类旧式八进制 / 前导零
           写法）是一个静默陷阱：非严格模式下原生会悄悄给出旧式八进制值
           或者一个更怪的十进制退让值，两种都是历史包袱，且都不是这个
           教学子集要照搬的语义——明确拒绝，好过面值和后面的数字粘在一起
           时静默给出一个两不像的结果（这恰恰是之前的真实行为）。 */
        if (c === '0' && src[i + 1] >= '0' && src[i + 1] <= '9') {
          throw err('Invalid number: numbers cannot have a leading zero (legacy octal is not supported)', sl, sc);
        }

        while (i < src.length && src[i] >= '0' && src[i] <= '9') adv();

        /* 至多吃一个小数点然后停——不管点后面有没有紧跟数字。这一条同时
           是 I1（5..toFixed(2) 不能被词法器提前判死刑：第一个点在这里被
           数字吃掉，第二个点留给外层主循环重新判断，会变成一个干净的
           成员访问符）与「1.2.3 该在哪一层报错」的关键：第二个点因为
           后面紧跟数字 3，会被主循环的前导小数点分支当成一个新数字
           0.3——于是 1.2.3 词法成两个挨在一起的数字，跟原生「Unexpected
           number」的报错本质（两个数字字面量之间缺一个运算符）完全对应，
           而不是虚构一个「点后面必须是属性名」的场景。 */
        if (i < src.length && src[i] === '.') {
          adv();
          while (i < src.length && src[i] >= '0' && src[i] <= '9') adv();
        }

        /* 科学计数法：e/E 一旦出现就是承诺——原生对 1e / 1e+ / 1ex 这些
           「指数标记后面没有数字」的输入统统是 SyntaxError，不能读到一半
           发现没数字就假装无事发生、把 e 退回去当标识符开头。 */
        if (i < src.length && (src[i] === 'e' || src[i] === 'E')) {
          adv();
          if (i < src.length && (src[i] === '+' || src[i] === '-')) adv();
          const ds = i;
          while (i < src.length && src[i] >= '0' && src[i] <= '9') adv();
          if (i === ds) throw err('Invalid number: missing exponent digits', sl, sc);
        }

        checkNumTail(sl, sc);
        push('num', parseFloat(src.slice(start, i)), start, sl, sc);
        continue;
      }

      if (c === "'" || c === '"') {
        adv();
        let s = '';
        while (i < src.length && src[i] !== c) {
          /* 单/双引号字符串不能跨行——裸换行（没有反斜杠续行）在原生里
             直接 SyntaxError，我们不能悄悄把它读成一个跨行的字符串然后
             继续吞源码直到误配上下一个引号（那样报出的错误、指向的位置
             都会跟真正的问题背道而驰）。行列指向字符串开始的位置，因为
             使用者要找的是那个没关上的引号，不是这一行里换行符的位置。 */
          if (src[i] === '\n') throw err('Unterminated string: raw newline not allowed', sl, sc);
          if (src[i] === '\\') {
            adv();
            s += readEscape(sl, sc);
          } else { s += src[i]; adv(); }
        }
        if (i >= src.length) throw err('Unterminated string', sl, sc);
        adv();
        push('str', s, start, sl, sc);
        continue;
      }

      if (c === '`') {
        /* 模板串在词法阶段只切成「静态段 + 表达式源码片段」，不递归调用
           解析器 —— 词法器不该知道表达式长什么样。解析器拿到 exprs 里的
           源码片段之后再各自 parse 一次。quasis 恒比 exprs 多一个。
           反引号字符串本身允许裸换行（这正是它存在的意义），跟上面单/
           双引号字符串的规则不同，不在这里报错。 */
        adv();
        const quasis = [], exprs = [];
        let cur = '';
        while (i < src.length && src[i] !== '`') {
          if (src[i] === '\\') {
            adv();
            cur += readEscape(sl, sc);
          } else if (src[i] === '$' && peek(1) === '{') {
            quasis.push(cur); cur = '';
            adv(2);
            /* 花括号计深必须识别字符串边界——`${ "}" }` 这种表达式里，
               字符串内恰好出现的 { / } 不能被当成真正的花括号，否则要么
               提前把表达式截断（字符串里的 } 被当成收尾），要么让计数
               失衡、一路找到源码末尾才报「未闭合」。遇到引号就整段跳过
               （含转义），遇到反引号就递归跳过一层嵌套模板（它可能自带
               ${...}，同样要跳过其中的字符串）。 */
            let depth = 1, es = i;
            while (i < src.length && depth > 0) {
              if (src[i] === '{') { depth++; adv(); }
              else if (src[i] === '}') { depth--; if (depth > 0) adv(); }
              else if (src[i] === "'" || src[i] === '"') { skipNestedString(src[i], sl, sc); }
              else if (src[i] === '`') { skipNestedTemplate(sl, sc); }
              else adv();
            }
            if (i >= src.length) throw err('Unterminated template expression', sl, sc);
            exprs.push(src.slice(es, i));
            adv();
          } else { cur += src[i]; adv(); }
        }
        if (i >= src.length) throw err('Unterminated template string', sl, sc);
        adv();
        quasis.push(cur);
        push('tpl', { quasis: quasis, exprs: exprs }, start, sl, sc);
        continue;
      }

      if (/[A-Za-z_$]/.test(c)) {
        while (i < src.length && /[A-Za-z0-9_$]/.test(src[i])) adv();
        const w = src.slice(start, i);
        push(KEYWORDS.indexOf(w) >= 0 ? 'kw' : 'name', w, start, sl, sc);
        continue;
      }

      let hit = null;
      for (let k = 0; k < PUNCT.length; k++) {
        if (src.startsWith(PUNCT[k], i)) { hit = PUNCT[k]; break; }
      }
      if (!hit) throw err('Unexpected character ' + JSON.stringify(c), sl, sc);
      adv(hit.length);
      push('punct', hit, start, sl, sc);
    }

    out.push({ type: 'eof', value: null, line: line, col: col, start: i, end: i });
    return out;
  }

  /* ---- 解析器：token 流 → 表达式 AST（规格 §2.6 的节点形状表，见任务简报） ----
     不做「每个优先级一个 parseXxx」的十层嵌套：二元运算符走表驱动的
     precedence climbing（见 BINOP），层次是
       赋值（右结合，单独一层）→ 表驱动二元 → 一元/前缀 → 后缀/调用/成员 → 基本单元。
     十层手写函数最容易在中间某一层把结合性写反，而那种错误只在特定
     表达式上暴露（a - b - c 对了不代表 a / b / c 对）。 */

  /* 二元运算优先级：数字越大结合得越紧。全部列出的都是左结合；右结合的
     只有赋值，它在 parseAssign 里单独处理，不走这张表。 */
  const BINOP = {
    '||': 1, '&&': 2,
    '===': 3, '!==': 3, '==': 3, '!=': 3,
    '<': 4, '>': 4, '<=': 4, '>=': 4,
    '+': 5, '-': 5,
    '*': 6, '/': 6, '%': 6,
  };
  const LOGICAL_OPS = { '&&': true, '||': true };

  /* 子集边界之外的保留字：走 name 通道进词法器（KEYWORDS 表里没有它们），
     解析器在语法位置上直接拒绝，报错要说清楚是哪个词、为什么不支持——
     「意外的标识符 class」对使用者毫无帮助。集中放在一张表里（而不是散落
     在各个语法位置各写一条 if），是为了让「新增一个不支持的词」只需要
     改一行。值是给使用者看的人话描述，配合 unsupported() 拼进统一格式的
     消息（规格 §2.8：Unsupported syntax: X (line N). This interpreter
     supports a subset of JavaScript.）。
     'in' / 'instanceof' 放进来是因为它们是 for…in 与原型链的入口，而
     规格明确不支持原型链；'var' 额外在描述里给出替代方案，因为它和
     let/const 语义差异使用者未必知道该换成什么。 */
  const UNSUPPORTED_WORDS = {
    'class': 'class declaration', 'this': 'this', 'new': 'the new operator',
    'async': 'async functions', 'await': 'await', 'try': 'try/catch',
    'catch': 'try/catch', 'throw': 'throw', 'typeof': 'typeof',
    'delete': 'delete', 'in': 'the in operator', 'instanceof': 'instanceof',
    'var': 'var (use let or const)', 'switch': 'switch', 'do': 'do…while',
    'yield': 'yield', 'super': 'super', 'export': 'export', 'import': 'import',
  };

  /* 不支持语法的消息在这一处统一拼装——阶段 3b 的编辑器要用 line/col 画
     波浪线、在行号槽点红点、悬停显示 message（规格 §2.8），category 恒为
     'unsupported'：这是「合法 JS，但不在这个解释器的子集里」，要说清楚
     「本解释器只支持 JS 的一个子集」，而不是让使用者以为自己写错了
     （那是 'syntax' 类别的意思，两者对使用者的意义完全不同）。 */
  function unsupported(what, t) {
    return err('Unsupported syntax: ' + what + ' (line ' + t.line + '). ' +
               'This interpreter supports a subset of JavaScript.',
               t.line, t.col, 'unsupported');
  }

  function cur(state) { return state.toks[state.i]; }
  function at(state, type, value) {
    const t = cur(state);
    if (t.type !== type) return false;
    return value === undefined || t.value === value;
  }
  /* eat：只对 punct/kw 这类「值即身份」的 token 有意义，按 value 匹配。 */
  function eat(state, value) {
    const t = cur(state);
    if ((t.type === 'punct' || t.type === 'kw') && t.value === value) { state.i++; return true; }
    return false;
  }
  function expect(state, value) {
    if (!eat(state, value)) {
      const t = cur(state);
      throw err('Unexpected token: expected ' + JSON.stringify(value) + ' but got ' +
                 JSON.stringify(t.value), t.line, t.col);
    }
  }
  /* 在任意表达式起始位置检查「这个词/符号是不是子集之外的东西」——
     class / this / new / typeof / delete / async / await / try / catch / throw
     等走 name 通道进来，... 与 ? 走 punct 通道，都要在这里拦下来，而不是
     让它们继续往下走然后在基本单元里报一个不知所云的 syntax 错误。
     '/' 单独检查：正则字面量不在子集内，词法器把 /ab+/ 切成了
     '/' 'ab' '+' '/' 四个 token（词法器不认识正则语法），如果不在这里
     拦截，'/' 会一路走到 parsePrimary 末尾的 catch-all，报出一个跟正则
     毫无关系的「Unexpected token」。这个检查只在**期待操作数**的位置
     生效（parsePrimary 入口），不会误伤 a / b 这种除法——除法的 '/' 是
     在 parseBinary 里作为中缀运算符被消费掉的，永远不会成为 parsePrimary
     看到的「当前 token」。 */
  function checkUnsupported(state) {
    const t = cur(state);
    if (t.type === 'name' && UNSUPPORTED_WORDS.hasOwnProperty(t.value)) {
      throw unsupported(UNSUPPORTED_WORDS[t.value], t);
    }
    if (t.type === 'punct' && t.value === '...') {
      throw unsupported('the spread operator', t);
    }
    if (t.type === 'punct' && t.value === '?') {
      throw unsupported('the ternary operator', t);
    }
    if (t.type === 'punct' && t.value === '/') {
      throw unsupported('regular expressions', t);
    }
  }

  /* 赋值：右结合，单独一层，不走 BINOP 表（表里全是左结合）。
     先按「二元优先级链」解析左手边，如果紧跟着赋值符号，再整体回收成
     Assign 节点——这样 a = b = c 这种右结合链靠递归调用 parseAssign
     自然得到，不需要额外的结合性判断。 */
  const ASSIGN_OPS = ['=', '+=', '-=', '*=', '/=', '%='];
  function parseAssign(state) {
    const t0 = cur(state);
    const left = parseBinary(state, 1);
    /* 三元 ?: 不在子集内。它在真实 JS 语法里紧跟在「条件部分」
       （大致相当于我们这里刚解析完的 parseBinary 结果）之后，且这个
       位置不会被 parsePrimary 看到（'?' 不能开始一个表达式）——所以
       只能在这里、左手边刚解析完的地方拦截，才能报出 unsupported
       而不是「expected ')' but got '?'」这种不知所云的 syntax 错误。 */
    if (at(state, 'punct', '?')) {
      throw unsupported('the ternary operator', cur(state));
    }
    const t = cur(state);
    if (t.type === 'punct' && ASSIGN_OPS.indexOf(t.value) >= 0) {
      state.i++;
      const value = parseAssign(state);
      return { type: 'Assign', op: t.value, target: left, value: value, line: t0.line, col: t0.col };
    }
    return left;
  }

  /* 表驱动 precedence climbing：minPrec 是「当前允许结合的最低优先级」。
     每次吃掉一个运算符后，右手边用 prec+1 递归——这就是左结合的做法：
     同级运算符不会被塞进右子树，而是留在下一轮循环里挂到左子树上。 */
  function parseBinary(state, minPrec) {
    const t0 = cur(state);
    let left = parseUnary(state);
    for (;;) {
      const t = cur(state);
      /* 'in' / 'instanceof' 是中缀运算符但走 name 通道（KEYWORDS 表里没有
         它们），不在 BINOP 表里、也从不会成为 parsePrimary 看到的「当前
         token」（它们前面总有一个已经解析完的左操作数）——如果不在这里
         单独拦一次，`x in obj` 会一路解析到调用方期待的下一个符号处，
         报出一个不知所云的「expected ')' but got 'in'」syntax 错误，
         而不是「in 不支持」。for…in 有专门更友好的报错（见 parseFor），
         这里兜底的是 in/instanceof 出现在其他任意表达式位置的情况。 */
      if (t.type === 'name' && (t.value === 'in' || t.value === 'instanceof')) {
        throw unsupported(UNSUPPORTED_WORDS[t.value], t);
      }
      if (t.type !== 'punct') break;
      const prec = BINOP[t.value];
      if (prec === undefined || prec < minPrec) break;
      state.i++;
      const right = parseBinary(state, prec + 1);
      left = {
        type: LOGICAL_OPS[t.value] ? 'Logical' : 'Binary',
        op: t.value, left: left, right: right,
        line: t0.line, col: t0.col,
      };
    }
    return left;
  }

  const UNARY_OPS = { '-': true, '+': true, '!': true };
  function parseUnary(state) {
    const t0 = cur(state);
    if (t0.type === 'punct' && UNARY_OPS[t0.value]) {
      state.i++;
      const arg = parseUnary(state);
      return { type: 'Unary', op: t0.value, arg: arg, line: t0.line, col: t0.col };
    }
    if (t0.type === 'punct' && (t0.value === '++' || t0.value === '--')) {
      state.i++;
      const arg = parseUnary(state);
      return { type: 'Update', op: t0.value, arg: arg, prefix: true, line: t0.line, col: t0.col };
    }
    return parsePostfix(state);
  }

  /* 后缀/调用/成员链：a.b[0](x) 要能无限链下去，谁在左边就继续绕圈，
     直到看不到 . [ ( ++ -- 中的任何一个为止。 */
  function parsePostfix(state) {
    const t0 = cur(state);
    let node = parsePrimary(state);
    for (;;) {
      const t = cur(state);
      if (t.type === 'punct' && t.value === '.') {
        state.i++;
        const nameTok = cur(state);
        if (nameTok.type !== 'name' && nameTok.type !== 'kw') {
          throw err('Unexpected token: expected property name', nameTok.line, nameTok.col);
        }
        state.i++;
        node = { type: 'Member', obj: node, prop: nameTok.value, computed: false, line: t0.line, col: t0.col };
        continue;
      }
      if (t.type === 'punct' && t.value === '[') {
        state.i++;
        const prop = parseExpr(state);
        expect(state, ']');
        node = { type: 'Member', obj: node, prop: prop, computed: true, line: t0.line, col: t0.col };
        continue;
      }
      if (t.type === 'punct' && t.value === '(') {
        state.i++;
        const args = [];
        if (!at(state, 'punct', ')')) {
          args.push(parseAssign(state));
          while (eat(state, ',')) args.push(parseAssign(state));
        }
        expect(state, ')');
        node = { type: 'Call', callee: node, args: args, line: t0.line, col: t0.col };
        continue;
      }
      if (t.type === 'punct' && (t.value === '++' || t.value === '--')) {
        state.i++;
        node = { type: 'Update', op: t.value, arg: node, prefix: false, line: t0.line, col: t0.col };
        continue;
      }
      break;
    }
    return node;
  }

  /* 箭头函数的形参表与括号表达式共用同一个左括号，只能往前探探看：
     扫描到匹配的 ')' 之后如果紧跟着 '=>' 就是箭头函数，否则回退当括号
     表达式处理。这里不做逐字符回溯，而是先假设是形参表——用逗号分隔
     的裸标识符列表——扫描失败再退回普通括号表达式，两者语法在「只有
     标识符」这一形状上是共同前缀，靠向前看一个 token（=>）消歧。 */
  function tryParseArrowParams(state) {
    const save = state.i;
    const t0 = cur(state);
    if (at(state, 'name')) {
      // 单参数不带括号：x => x
      const name = cur(state).value;
      const save2 = state.i;
      state.i++;
      if (at(state, 'punct', '=>')) return { params: [name], t0: t0 };
      state.i = save2;
      return null;
    }
    if (!at(state, 'punct', '(')) return null;
    state.i++;
    const params = [];
    let ok = true;
    if (!at(state, 'punct', ')')) {
      for (;;) {
        if (!at(state, 'name')) { ok = false; break; }
        params.push(cur(state).value);
        state.i++;
        if (eat(state, ',')) continue;
        break;
      }
    }
    if (ok && eat(state, ')') && at(state, 'punct', '=>')) {
      return { params: params, t0: t0 };
    }
    state.i = save;
    return null;
  }

  function parsePrimary(state) {
    checkUnsupported(state);
    const t0 = cur(state);

    const arrowAttempt = tryParseArrowParams(state);
    if (arrowAttempt) {
      expect(state, '=>');
      /* 块体箭头函数 (a) => { ... }：上一个任务（表达式解析）暂时把这里
         报成 unsupported，理由是当时还没有 Block 节点可用。现在语句解析
         已经落地（parseBlock 见下），这里接上真正的支持——
         expression: false 时 body 是一个 Block 节点，与表达式体
         （expression: true，body 是表达式节点）区分开，供求值层
         （下一层任务）分派。 */
      if (at(state, 'punct', '{')) {
        const blockBody = parseBlock(state);
        return { type: 'Arrow', params: arrowAttempt.params, body: blockBody, expression: false,
                 line: arrowAttempt.t0.line, col: arrowAttempt.t0.col };
      }
      const body = parseAssign(state);
      return { type: 'Arrow', params: arrowAttempt.params, body: body, expression: true,
               line: arrowAttempt.t0.line, col: arrowAttempt.t0.col };
    }

    if (t0.type === 'num') { state.i++; return { type: 'Num', value: t0.value, line: t0.line, col: t0.col }; }
    if (t0.type === 'str') { state.i++; return { type: 'Str', value: t0.value, line: t0.line, col: t0.col }; }
    if (t0.type === 'tpl') {
      state.i++;
      const exprs = t0.value.exprs.map(function (src) { return parseExpression(src); });
      return { type: 'Tpl', quasis: t0.value.quasis, exprs: exprs, line: t0.line, col: t0.col };
    }
    if (t0.type === 'kw' && t0.value === 'true') { state.i++; return { type: 'Bool', value: true, line: t0.line, col: t0.col }; }
    if (t0.type === 'kw' && t0.value === 'false') { state.i++; return { type: 'Bool', value: false, line: t0.line, col: t0.col }; }
    if (t0.type === 'kw' && t0.value === 'null') { state.i++; return { type: 'Null', line: t0.line, col: t0.col }; }
    if (t0.type === 'name') { state.i++; return { type: 'Ident', name: t0.value, line: t0.line, col: t0.col }; }

    if (t0.type === 'punct' && t0.value === '(') {
      state.i++;
      const e = parseExpr(state);
      expect(state, ')');
      return e;
    }

    if (t0.type === 'punct' && t0.value === '[') {
      state.i++;
      const elements = [];
      if (!at(state, 'punct', ']')) {
        elements.push(parseAssign(state));
        while (eat(state, ',')) {
          if (at(state, 'punct', ']')) break; // 允许尾随逗号
          elements.push(parseAssign(state));
        }
      }
      expect(state, ']');
      return { type: 'Array', elements: elements, line: t0.line, col: t0.col };
    }

    if (t0.type === 'punct' && t0.value === '{') {
      state.i++;
      const props = [];
      if (!at(state, 'punct', '}')) {
        for (;;) {
          const keyTok = cur(state);
          let key;
          if (keyTok.type === 'name' || keyTok.type === 'kw') key = keyTok.value;
          else if (keyTok.type === 'str') key = keyTok.value;
          else throw err('Unexpected token: expected property key', keyTok.line, keyTok.col);
          state.i++;
          expect(state, ':');
          const value = parseAssign(state);
          props.push({ key: key, value: value });
          if (eat(state, ',')) {
            if (at(state, 'punct', '}')) break; // 尾随逗号
            continue;
          }
          break;
        }
      }
      expect(state, '}');
      return { type: 'Object', props: props, line: t0.line, col: t0.col };
    }

    throw err('Unexpected token: ' + JSON.stringify(t0.value), t0.line, t0.col);
  }

  function parseExpr(state) { return parseAssign(state); }

  /* 供测试与阶段 3b 的表达式求值使用：从源码字符串直接解析出一个表达式
     节点，断言之后紧跟 eof（防止 '1 2' 这种「解析到一半就丢下剩余源码」
     的情况悄悄通过）。 */
  function parseExpression(src) {
    const toks = tokenize(src).filter(function (t) { return t.type !== 'comment'; });
    const state = { toks: toks, i: 0 };
    const node = parseExpr(state);
    if (!at(state, 'eof')) {
      const t = cur(state);
      throw err('Unexpected token: ' + JSON.stringify(t.value), t.line, t.col);
    }
    return node;
  }

  /* ---- 解析器：token 流 → 语句 AST（任务简报的语句节点形状表） ----
     不支持的语法在**解析阶段**就报，而不是运行到一半崩（规格 §2.6）。
     报错必须带行、列、类别——阶段 3b 的编辑器要用它画波浪线、在行号槽
     点红点、悬停显示消息（规格 §2.8），§7.3 为此专设了一组定位测试。
     category 分两类：'unsupported' 是「合法 JS，但不在这个子集里」，
     'syntax' 是「根本不是合法 JS」。两者对使用者的意义完全不同——
     前者要说「这个解释器只支持 JS 的一个子集」，后者要说「你这里写错了」。 */

  /* 极简版 ASI：分号可省，只在「下一个 token 换行了」或「紧跟 } / eof」
     时允许——不做完整 ECMA-262 的 ASI 规则（那套规则连报错恢复都要考虑）。
     换行信息不需要专门的换行 token：直接比较「上一个已消费 token」和
     「当前 token」的 line 是否不同即可，词法器已经把每个 token 的行号
     记下来了。 */
  function semi(state) {
    if (eat(state, ';')) return;
    const t = cur(state);
    if (t.type === 'eof' || (t.type === 'punct' && t.value === '}')) return;
    const prevTok = state.toks[state.i - 1];
    if (prevTok && t.line > prevTok.line) return;
    throw err('Unexpected token: expected ";" but got ' + JSON.stringify(t.value), t.line, t.col);
  }

  function parseBlock(state) {
    const t0 = cur(state);
    expect(state, '{');
    const body = [];
    while (!at(state, 'punct', '}') && !at(state, 'eof')) {
      pushStmt(body, parseStatement(state));
    }
    expect(state, '}');
    return { type: 'Block', body: body, line: t0.line, col: t0.col };
  }

  /* let/const 声明，含逗号分隔的多声明（let a = 1, b = 2;——两指针类算法
     的常见写法，Task 4 的差分测试 `const r = 3, c = 5; ...` 就用了它，
     一跑原生就露出这里以前只认单个声明名的缺口）。解构（let [a,b]=xs /
     let {a,b}=obj）仍然不在子集内——声明名之后如果不是 name 而是 '[' 或
     '{'，直接报 unsupported，而不是让它继续走进「expected identifier」
     这个不知所云的 syntax 错误。
     返回值恒为数组（哪怕只有一个声明），逗号越多数组越长；VarDecl 节点
     本身的形状不变（仍是单声明 {kind,name,init}），「一条源码语句可能
     展开成多条语句」这件事只在调用方里发生，且两个调用方摊平的方式不同：
     普通语句位置（parseBlock / parse 的顶层循环）经 pushStmt 摊平成多条
     独立的 VarDecl 语句；for 循环头部（parseFor，Task 5 起复用这个函数
     解析 for (let i = 0, j = 3; ...) 的逗号多声明）则把整个数组包进一个
     VarDeclList 壳节点里，因为 for-init 位置只能是一个节点，摊不开——
     evalStmt 里 VarDeclList 的 case 就是为了消化这唯一的落地点。 */
  function parseVarDecl(state) {
    const t0 = cur(state); // 'let' 或 'const'
    const kind = t0.value;
    state.i++;
    const decls = [];
    for (;;) {
      const nameTok = cur(state);
      if (nameTok.type === 'punct' && (nameTok.value === '[' || nameTok.value === '{')) {
        throw unsupported('destructuring', nameTok);
      }
      if (nameTok.type !== 'name') {
        throw err('Unexpected token: expected identifier but got ' + JSON.stringify(nameTok.value),
                   nameTok.line, nameTok.col);
      }
      const name = nameTok.value;
      state.i++;
      let init = null;
      if (eat(state, '=')) init = parseAssign(state);
      decls.push({ type: 'VarDecl', kind: kind, name: name, init: init, line: t0.line, col: t0.col });
      if (!eat(state, ',')) break;
    }
    return decls;
  }

  /* parseStatement 的整体契约是「一次调用产出一个语句节点」（if/while/for
     的单语句 body 位置全靠这个契约）——但一条 `let a=1, b=2;` 源码要展开
     成两个独立的 VarDecl 语句。折中：parseStatement 在遇到多声明时把它们
     包进一个轻量的 VarDeclList 壳节点里返回（仍然是「一个节点」，契约不
     破），块/顶层位置的展开只在 parseBlock / parse 的循环里发生——那里
     会把语句摊平进一个数组，pushStmt 就是做这件事的。
     VarDeclList 在这条路径上确实永远不会被求值器看到；但 Task 5 之后多
     了第二条产出 VarDeclList 的路径——parseFor 的 for 头部逗号多声明
     （for (let i=0, j=3; ...)）——那里没有「摊平进语句数组」这个位置可用
     （for-init 只能是一个节点），VarDeclList 会原样留到 evalStmt，由那边
     专门的 case 逐条求值。两条路径产出的是同一种节点形状，但只有一条会
     真正被求值器看到。 */
  function pushStmt(body, stmt) {
    if (stmt.type === 'VarDeclList') {
      for (let i = 0; i < stmt.decls.length; i++) body.push(stmt.decls[i]);
    } else {
      body.push(stmt);
    }
  }

  function parseIf(state) {
    const t0 = cur(state);
    state.i++;
    expect(state, '(');
    const test = parseExpr(state);
    expect(state, ')');
    const cons = parseStatement(state);
    let alt = null;
    if (eat(state, 'else')) alt = parseStatement(state);
    return { type: 'If', test: test, cons: cons, alt: alt, line: t0.line, col: t0.col };
  }

  function parseWhile(state) {
    const t0 = cur(state);
    state.i++;
    expect(state, '(');
    const test = parseExpr(state);
    expect(state, ')');
    const body = parseStatement(state);
    return { type: 'While', test: test, body: body, line: t0.line, col: t0.col };
  }

  /* for 的三种形态共用一个左括号：普通三段式 for(init;test;update)，
     for…of（子集支持），for…in（子集明确不支持——它是原型链的入口）。
     只有 let/const 打头时才可能是 for…of/for…in，所以先复用 parseVarDecl
     解析出声明列表（这一步顺带接上了 for 头部的逗号多声明——
     for (let i = 0, j = 3; ...) 双指针类算法的常见写法，Task 5 之前这里
     是内联的单声明专用逻辑，不认逗号，一遇到 ',' 就在 expect(';') 处报
     「expected ";" but got ","」）：
       - 声明列表恰好一条 且紧跟 'of' → ForOf；
       - 声明列表恰好一条 且紧跟 'in' → 专门的报错（点名该改用 for…of，
         不能只说「in 不支持」，使用者不知道该换成什么）；
       - 其它情况（含声明列表不止一条——for…of/for…in 语法上只允许恰好
         一个绑定，不可能出现多声明）→ 当成普通三段式的初始化部分。 */
  function parseFor(state) {
    const t0 = cur(state);
    state.i++;
    expect(state, '(');

    if (at(state, 'kw', 'let') || at(state, 'kw', 'const')) {
      const kindTok = cur(state);
      const decls = parseVarDecl(state);

      if (decls.length === 1 && at(state, 'kw', 'of')) {
        state.i++;
        const iterable = parseExpr(state);
        expect(state, ')');
        const body = parseStatement(state);
        return { type: 'ForOf', kind: decls[0].kind, name: decls[0].name, iterable: iterable, body: body,
                 line: t0.line, col: t0.col };
      }
      if (decls.length === 1 && at(state, 'name', 'in')) {
        const inTok = cur(state);
        throw err('Unsupported syntax: for...in (line ' + inTok.line + '). ' +
                   'This interpreter supports for...of but not for...in — there is no ' +
                   'prototype chain in this subset. Use for...of instead.',
                   inTok.line, inTok.col, 'unsupported');
      }

      const init = decls.length === 1 ? decls[0]
        : { type: 'VarDeclList', decls: decls, line: kindTok.line, col: kindTok.col };
      expect(state, ';');
      const test = at(state, 'punct', ';') ? null : parseExpr(state);
      expect(state, ';');
      const update = at(state, 'punct', ')') ? null : parseExpr(state);
      expect(state, ')');
      const body = parseStatement(state);
      return { type: 'For', init: init, test: test, update: update, body: body,
               line: t0.line, col: t0.col };
    }

    // 没有 let/const 打头：普通三段式，init 部分（若有）是一条表达式语句
    let init = null;
    if (!at(state, 'punct', ';')) {
      const e0 = cur(state);
      init = { type: 'ExprStmt', expr: parseExpr(state), line: e0.line, col: e0.col };
    }
    expect(state, ';');
    const test = at(state, 'punct', ';') ? null : parseExpr(state);
    expect(state, ';');
    const update = at(state, 'punct', ')') ? null : parseExpr(state);
    expect(state, ')');
    const body = parseStatement(state);
    return { type: 'For', init: init, test: test, update: update, body: body,
             line: t0.line, col: t0.col };
  }

  function parseFuncDecl(state) {
    const t0 = cur(state);
    state.i++;
    const nameTok = cur(state);
    if (nameTok.type !== 'name') {
      throw err('Unexpected token: expected function name', nameTok.line, nameTok.col);
    }
    const name = nameTok.value;
    state.i++;
    expect(state, '(');
    const params = [];
    if (!at(state, 'punct', ')')) {
      for (;;) {
        const p = cur(state);
        if (p.type !== 'name') throw err('Unexpected token: expected parameter name', p.line, p.col);
        params.push(p.value);
        state.i++;
        if (eat(state, ',')) continue;
        break;
      }
    }
    expect(state, ')');
    const body = parseBlock(state);
    return { type: 'FuncDecl', name: name, params: params, body: body, line: t0.line, col: t0.col };
  }

  /* 按首 token 分派。不支持的保留字（class/this/var/switch/do/... ）走
     name 通道到这里，在语句的最外层就被拦下——这样 `this.x = 1;` 这种
     一开始就没救的语句不会先走进表达式解析器兜一圈才报错。 */
  function parseStatement(state) {
    const t0 = cur(state);

    if (t0.type === 'name' && UNSUPPORTED_WORDS.hasOwnProperty(t0.value)) {
      throw unsupported(UNSUPPORTED_WORDS[t0.value], t0);
    }

    if (t0.type === 'punct' && t0.value === '{') return parseBlock(state);

    if (t0.type === 'kw' && (t0.value === 'let' || t0.value === 'const')) {
      const decls = parseVarDecl(state);
      semi(state);
      return decls.length === 1 ? decls[0]
        : { type: 'VarDeclList', decls: decls, line: t0.line, col: t0.col };
    }
    if (t0.type === 'kw' && t0.value === 'if') return parseIf(state);
    if (t0.type === 'kw' && t0.value === 'for') return parseFor(state);
    if (t0.type === 'kw' && t0.value === 'while') return parseWhile(state);
    if (t0.type === 'kw' && t0.value === 'function') return parseFuncDecl(state);
    if (t0.type === 'kw' && t0.value === 'break') {
      state.i++; semi(state);
      return { type: 'Break', line: t0.line, col: t0.col };
    }
    if (t0.type === 'kw' && t0.value === 'continue') {
      state.i++; semi(state);
      return { type: 'Continue', line: t0.line, col: t0.col };
    }
    if (t0.type === 'kw' && t0.value === 'return') {
      state.i++;
      let arg = null;
      if (!(at(state, 'punct', ';') || at(state, 'punct', '}') || at(state, 'eof'))) {
        arg = parseExpr(state);
      }
      semi(state);
      return { type: 'Return', arg: arg, line: t0.line, col: t0.col };
    }

    // 其余情况：表达式语句（赋值、调用、自增自减……）
    const expr = parseExpr(state);
    semi(state);
    return { type: 'ExprStmt', expr: expr, line: t0.line, col: t0.col };
  }

  /* 顶层入口：token 流 → { type: 'Program', body: Stmt[] }。注释先过滤掉——
     它们是词法层暴露给阶段 3b 编辑器高亮用的，解析器不关心。 */
  function parse(src) {
    const toks = tokenize(src).filter(function (t) { return t.type !== 'comment'; });
    const state = { toks: toks, i: 0 };
    const body = [];
    while (!at(state, 'eof')) {
      pushStmt(body, parseStatement(state));
    }
    return { type: 'Program', body: body };
  }

  /* ---- 求值器（规格 §2.6/§7.3） ----

     求值器用 JS 生成器写：function* evalX(...) + yield*，每到语句边界
     yield 一次。这样递归下降的写法天然可以在任意点暂停，代码量比手写
     显式栈机小得多。

     注意：生成器「能在任意点暂停」这个能力**只在录制期用到**。回放期
     （单步/后退/拖时间轴）走的是已记录好的轨迹数组，不再驱动生成器——
     因为「后退」只有先跑完再回放才做得到（规格 §2.7）。本任务（Task 4）
     只把生成器一次性驱动到底（run() 里的 while 循环），完全不利用这个
     暂停点；Task 7 加轨迹记录时才会真正用上「在 yield 处采样状态」。

     Task 4 的范围是表达式 + 变量 + 顶层顺序执行 + return；Task 5（本任务）
     补上 if/for/for…of/while/break/continue 与块作用域。函数声明/调用/
     递归仍是 Task 6 的事——evalStmt/evalExpr 的 switch 分派结构留着位置
     （一个 case 一行），届时只需要往里加 case，不需要改这里的驱动逻辑。

     运行时值直接用真实的 JS 类型表示（number/string/boolean/null/
     undefined/Array/plain Object），运算符也直接用 JS 自己的运算符
     （+ - * / % < > === ...）——这样绝大多数运行时报错信息（TypeError/
     RangeError 的具体文案）会跟 §7.3 差分测试里的原生参照实现天然一致，
     因为两边跑的都是同一个 V8。这也是为什么这道差分测试骨架这么可信：
     我们不是在「模拟」JS 的语义，很多时候就是在直接执行它。 */

  /* 作用域：链式环境 {vars: Map, parent}。lookup 沿链向上找到声明它的那
     一层；declare 只作用于当前层；assign 找到声明它的那一层再改，找不到
     就是「未声明就赋值」（报 ReferenceError，跟原生严格模式一致）。
     const 重新赋值抛 "Assignment to constant variable."——这一字不差的
     文案是用 node 亲自问原生 `new Function(...)` 对出来的（不是凭印象
     写的），差分测试会拿它对账。 */
  /* callDepth：一个在整条环境链上共享的可变计数器（同一个对象引用，从
     根环境一路传下去），供 MAX_DEPTH 检查用。挂在 env 上而不是额外给
     每个求值函数加一个参数——那样要改遍 evalExpr/evalStmt/evalBlockBody
     的每一个调用点，改动面积远大于「env 多带一个字段」。子环境从
     parent 继承同一个计数器对象（不是拷贝一份新的），这样无论调用嵌套
     多深，callInterpreted 里 `fn.closure.callDepth` 拿到的都是同一个
     计数器——「当前在第几层调用栈」这件事因此对任意一层求值代码都是
     可读的，这正是 Task 8（步数/调用栈记录）需要的钩子。

     rec：同样是「整条环境链共享同一个对象」的模式，这次载的是 Task 7 的
     轨迹记录器（trace 数组 + 棋盘影子状态 + 当前语句正在累积的 pending）。
     根环境创建时先不挂它（makeEnv(null) 走这里的 parent?...:null 分支，
     结果是 null）——run() 会在**声明完 log/mark/place/clear/attacked/Math
     这五个根绑定之后**才把 env.rec 补上，这样那五个声明本身（它们不是
     用户源码的一部分，用户永远看不到、也不该出现在轨迹里）不会被
     declareVar 误记成第一条用户语句的 varDelta。子环境一律继承
     parent.rec（同一个对象，不是拷贝），这跟 callDepth 是同一个理由：
     一次 run() 只有一个记录器，无论调用嵌套多深，大家记的都是同一份
     trace。 */
  function makeEnv(parent) {
    return {
      vars: new Map(),
      parent: parent || null,
      callDepth: parent ? parent.callDepth : { n: 0 },
      rec: parent ? parent.rec : null,
    };
  }

  /* 深拷贝一个运行时值，供写进轨迹用（决定③：轨迹存的是"某一刻的快照"，
     不是活引用）。不深拷贝的后果很隐蔽：数组 board 在第 10 步被 push、
     第 200 步被 pop，如果轨迹里存的是同一个数组引用，回放到第 10 步时
     看到的会是第 200 步的内容——轨迹会随着程序继续运行「悄悄改写历史」。
     函数值（无论是解释出来的 __fn 对象还是原生函数，比如宿主桥接函数、
     Array.prototype.push、Math.abs）不可深拷贝，对调试显示也没有价值，
     统一渲染成 'ƒ name' 字符串。 */
  function snap(v) {
    if (Array.isArray(v)) return v.map(snap);
    if (v && typeof v === 'object') {
      if (v.__fn === true) return 'ƒ ' + (v.name || '(anonymous)');
      const out = {};
      for (const k in v) {
        if (Object.prototype.hasOwnProperty.call(v, k)) out[k] = snap(v[k]);
      }
      return out;
    }
    if (typeof v === 'function') return 'ƒ ' + (v.name || '(anonymous)');
    return v; // 数字/字符串/布尔/null/undefined：原样返回
  }

  /* 一条变量改动记录，供 declareVar/assignVar 共用。from/to 在压进
     pending 之前就已经是 snap() 过的快照——调用方不需要、也不应该自己
     再想着「要不要拷贝」。env.rec 为 null 时（当前不在某次 run() 的求值
     过程里，或者是 run() 声明根绑定的那一小段窗口期）什么都不做，这不是
     兜底容错，而是刻意的「没有记录器就不记录」。 */
  function recordVarDelta(env, name, from, to) {
    if (env.rec) env.rec.pending.varDelta.push({ name: name, from: from, to: to });
  }

  /* 同一层环境内重复 let/const 声明是原生 SyntaxError（"Identifier 'a'
     has already been declared"，用 node 亲自问过原生 new Function 对出来
     的一字不差文案）——Task 4 遗留的真缺口（差分测试实测到我们静默通过）。
     只查「当前层」的 Map，不沿 parent 链查：不同作用域的遮蔽（let a = 1;
     { let a = 2; }）是合法的，块作用域每层都是独立的 Map，天然不会误伤。
     node 用来报行列——调用方永远是解析期就带着源码位置的 AST 节点。 */
  function declareVar(env, kind, name, value, node) {
    if (env.vars.has(name)) {
      throw err("Identifier '" + name + "' has already been declared", node.line, node.col, 'syntax');
    }
    env.vars.set(name, { kind: kind, value: value });
    // from: undefined 表示「此前不存在」——声明是这个变量名第一次出现。
    recordVarDelta(env, name, undefined, snap(value));
  }

  function findEnv(env, name) {
    let e = env;
    while (e) { if (e.vars.has(name)) return e; e = e.parent; }
    return null;
  }

  function lookupVar(env, name, node) {
    const e = findEnv(env, name);
    if (!e) throw err(name + ' is not defined', node.line, node.col, 'runtime');
    return e.vars.get(name).value;
  }

  function assignVar(env, name, value, node) {
    const e = findEnv(env, name);
    if (!e) throw err(name + ' is not defined', node.line, node.col, 'runtime');
    const binding = e.vars.get(name);
    if (binding.kind === 'const') {
      throw err('Assignment to constant variable.', node.line, node.col, 'runtime');
    }
    // 记旧值必须在覆盖之前——反放（后退）全靠这个 from 值撤销这一步。
    const oldValue = binding.value;
    binding.value = value;
    recordVarDelta(env, name, snap(oldValue), snap(value));
    return value;
  }

  /* 数组/对象的属性读写只开一道小口子（规格 §2.8：没有原型链、没有
     class/new/instanceof）——对象只读写「自有属性」（hasOwnProperty
     把关），从不沿原型链走下去；这不是随手加的限制，是防住
     `o.constructor.constructor("...")()` 这种经典沙箱逃逸的关键一环：
     真实对象的 constructor / __proto__ 都不是自有属性，hasOwnProperty
     一律为 false，天然被挡在外面，不需要单独列一张黑名单。数组只放行
     length 与数字下标，字符串同理——这两类值的「方法」（push/pop 之类）
     不走这条读属性的路径，走下面 resolveCallable 单独把关的调用路径。 */
  function getProp(obj, prop, node) {
    if (Array.isArray(obj)) {
      if (prop === 'length') return obj.length;
      if (typeof prop === 'number') return obj[prop];
      throw err('Unsupported array property: ' + prop, node.line, node.col, 'runtime');
    }
    if (typeof obj === 'string') {
      if (prop === 'length') return obj.length;
      if (typeof prop === 'number') return obj[prop];
      throw err('Unsupported string property: ' + prop, node.line, node.col, 'runtime');
    }
    if (obj && typeof obj === 'object') {
      if (Object.prototype.hasOwnProperty.call(obj, prop)) return obj[prop];
      return undefined; // 只读自有属性，不走原型链
    }
    throw err('Cannot read properties of ' + String(obj) + ' (reading ' + JSON.stringify(prop) + ')',
               node.line, node.col, 'runtime');
  }

  function setProp(obj, prop, value, node) {
    if (Array.isArray(obj)) {
      if (typeof prop === 'number') { obj[prop] = value; return value; }
      throw err('Unsupported array property assignment: ' + prop, node.line, node.col, 'runtime');
    }
    if (obj && typeof obj === 'object') {
      /* 写路径同样挡住 __proto__ / constructor / prototype——防的是靠
         赋值做原型污染，跟上面读路径挡沙箱逃逸是同一件事的另一面。 */
      if (prop === '__proto__' || prop === 'constructor' || prop === 'prototype') {
        throw err('Cannot set unsafe property: ' + prop, node.line, node.col, 'runtime');
      }
      obj[prop] = value;
      return value;
    }
    throw err('Cannot set properties of ' + String(obj), node.line, node.col, 'runtime');
  }

  /* 内建函数的表面积刻意开得小而准（规格 §2.8 + 任务简报）：数组只有
     push/pop，宿主的五个桥接函数（log/mark/place/clear/attacked）与
     Math 的四个函数（abs/max/min/floor）之外一律拒绝。数组方法不是自有
     属性（来自 Array.prototype），所以在这里单独列白名单，不能跟
     getProp 共用同一条「hasOwnProperty 自有属性」的路——那条路本来就是
     故意设计成读不到 Array.prototype.push 的。Math 命名空间对象自己只
     长了这四个自有属性（见下面 MATH_NS 的定义），所以它走的是跟普通
     对象一样的 hasOwnProperty 通道，不需要单独列一次名字。

     Task 6 补一道口子：数字下标（fs[0]()）与对象属性（o.f()）里存的
     可能不是「方法名」而是一个普通存进去的函数值——闭包数组
     `const fs = []; fs.push(() => i); fs[0]();` 正是差分测试骨架
     验证「for 每轮新环境」时要用到的形状。这跟 push/pop 那种「原生方法、
     需要 this 绑定」的调用完全是两回事，所以数字下标与自有属性里查到的
     可调用值（原生函数或解释出来的 __fn 函数对象）都直接放行，不需要
     进白名单——白名单挡的是「凭空调用数组/对象根本没有的方法」，不是
     挡「用户自己存进去、自己取出来调用的函数值」。 */
  function isCallableValue(v) {
    return typeof v === 'function' || (v !== null && typeof v === 'object' && v.__fn === true);
  }
  function resolveCallable(obj, prop, node) {
    if (Array.isArray(obj)) {
      if (prop === 'push') return Array.prototype.push;
      if (prop === 'pop') return Array.prototype.pop;
      if (typeof prop === 'number') {
        const v = obj[prop];
        if (isCallableValue(v)) return v;
        throw err('Value is not callable', node.line, node.col, 'runtime');
      }
      throw err('Unsupported array method: ' + prop + ' (this subset only has push/pop)',
                 node.line, node.col, 'runtime');
    }
    if (obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, prop) &&
        isCallableValue(obj[prop])) {
      return obj[prop];
    }
    throw err((typeof prop === 'string' ? prop : String(prop)) + ' is not a function',
               node.line, node.col, 'runtime');
  }

  /* ---- 函数值 / 调用 / 闭包 / 递归（Task 6） ----

     函数值统一表示成 { __fn, params, body, closure, name, expression }：
       - params：形参名字符串数组；
       - body：函数声明与块体箭头函数是 Block 节点，表达式体箭头函数是
         表达式节点（expression: true 时）；
       - closure：函数「定义时」所在的环境，不是「调用时」的环境——调用
         新建的环境 parent 指向它而不是调用点，这就是闭包；
       - name：具名函数声明的名字（供将来报错/调试用），箭头函数是 null；
       - expression：body 是表达式节点（true）还是 Block 节点（false）。
     它不是真的 JS function（typeof 是 'object'），isCallableValue 与
     resolveCallable 因此都要专门认这个形状，才能把它和 Math.abs 那类
     真·原生函数用同一条调用路径分派开（callInterpreted vs fn.apply）。 */
  function makeFunction(params, body, closureEnv, name, expression) {
    return { __fn: true, params: params, body: body, closure: closureEnv,
             name: name || null, expression: !!expression };
  }

  /* 调用深度上限：JS 引擎自己的栈溢出会抛一个对使用者毫无意义的
     RangeError，而且 yield* 的嵌套会让真实可用深度比裸递归浅得多。
     这里主动在一个可解释的深度上停下并报清楚，胜过让引擎崩。

     500 这个数字是**实测出来的，不是拍的**（最初的计划稿写的是 1000，
     任务报告记录了完整的排查过程，这里只留结论和复现方法）。

     实测方法：用「递归调用包在算术表达式里」这种最贴近教学代码真实
     写法的形状（`if (基准情形) { return ...; } return 1 + f(k - 1);`——
     回溯类算法把递归调用嵌进 `+=`/`+` 之类表达式里是常态，比纯尾调用
     更能代表真实使用），对调用深度做二分探测，分别测「冷启动」（每次
     全新 node 进程，只跑这一段代码）与「预热后」（跟在这个文件其余
     diff() 测试后面跑，让 evalStmt/evalExpr/callInterpreted 这条热路径
     先被 JIT 摸过一遍）两种状态：
       冷启动：depth=650 正常返回，depth=700 起原生 RangeError（裸栈溢出，
               不是我们的报错）——真实上限在 650～700 之间。
       预热后：depth=900 正常返回，depth=1000 起原生 RangeError——真实
               上限在 900～1000 之间，比冷启动更深，但方向不总是这样
              （另一种递归形状实测中预热反而更容易撞早——即真实上限本身
               随 JIT 优化状态漂移，不是一个固定值，不能指望"腾出一点
               余量"就稳。见任务报告）。
     取两种状态里**更差**的那个（冷启动的 650～700）作为安全上限的参照，
     500 在它之下留了至少 150～200 层、约 25%～30% 的余量，不是贴着悬崖走。

     教学规模的真实需求核对：N 皇后 N=12 → 递归深度 12；骑士巡游 8×8 →
     最深 64；BFS 类算法本身不递归（深度约 1）；minimax 常见限制深度
     ≤4。500 是这些需求里最深一个（64）的将近 8 倍，留有巨大冗余——
     调低到 500 不会挤压任何已知的教学场景。

     以后如果想再调这个数字：重新按上面的方法二分探测（记得两种状态都
     测，且形状要用"递归调用嵌在表达式里"这种更贴近真实算法的写法，
     不要只用纯尾调用去测——纯尾调用的真实上限明显更高，会给出过于
     乐观的假象），而不是凭感觉调大。 */
  const MAX_DEPTH = 500;

  /* 调用一个解释出来的函数：新环境的 parent 是 fn.closure（闭包，见上），
     不是调用点的 env——递归函数的每次调用因此各自拿到一份独立的形参
     绑定，互不干扰，这正是递归能工作的基础。深度检查必须在「创建新环境
     之前」就做，且必须在真正触发原生栈溢出之前生效——所以这里第一件事
     就是检查计数器，不是等做完一堆工作才发现太深了。

     两处刻意的「反直觉」写法，都是为同一个目标让路——把每一层解释出来
     的递归调用在真实 JS 调用栈上占用的帧数压到最低，理由见下面第二条
     注释里记录的实测数字：

     1) 没有 try/finally 包住 depth.n--：正常返回时手动在两个 return
        分支各减一次；出错时**不**做任何清理。这是安全的，不是偷懒——
        一旦抛出（无论是 MAX_DEPTH 自己的错，还是任何运行时错误），
        整条求值链会一路向上抛穿 run()，run() 不捕获、调用方拿到的就是
        一次性报废的执行——这个 env/callDepth 计数器不会再被第二次使用，
        「用完就扔」的东西不需要保证回滚到干净状态。try/finally 本身在
        生成器里会占用额外一截栈帧（V8 要为异常处理路径多留出记账
        空间），实测去掉它能让真实可用递归深度多出约 15%——这在下面
        第二条要争取的裕度里不是可以随便让出的零头。

     2) 块体不写成 `yield* evalBlockBody(fn.body.body, callEnv)`，而是
        把 evalBlockBody「提升 + 顺序求值」的逻辑摊平直接写在这里（不足
        十行的重复，用重复换一层生成器委托）：素朴地转发给 evalBlockBody
        时，真实可用的递归深度会比现在浅一截，让「多省一层生成器委托」
        的余量白白流失——这正是 MAX_DEPTH 注释里"yield* 的嵌套会让真实
        可用深度比裸递归浅得多"这句话的字面兑现：每多一层生成器委托都
        会把这个系数再拉大一截。

     即便叠加这两处优化，真实可用深度依然远小于「裸递归」的天真估算
     （详见 MAX_DEPTH 常量旁边记录的实测数字与方法）——500 是量出来、
     在最差实测状态下仍留有余量的数字，不是拍脑袋定的，也不是为了让
     某条测试凑巧通过才反推出来的。形参与函数体顶层声明共享同一个
     callEnv，跟原生「参数与函数体顶层同属一个函数作用域」的简化模型
     对得上，也让提升扫描能覆盖到函数体自己内部声明的函数（互递归的
     内层函数场景）。 */
  function* callInterpreted(fn, args, node) {
    const depth = fn.closure.callDepth;
    if (depth.n >= MAX_DEPTH) {
      /* 文案要覆盖两种成因，不能只怪使用者：在 500 这个上限上，触发它
         的既可能是真的忘了写基准情形的失控递归，也可能是一段完全写对、
         但对一个几百元素以上的数据结构做递归处理、天然就比这个解释器
         能安全承受的深度更深的合法代码——只说「是不是忘了终止条件」会
         把后一种使用者引向错误的方向。同时给一条可行的出路（改写成
         循环），而不是让她卡在一个「我不知道该怎么办」的死胡同。 */
      throw err('Maximum call depth exceeded (' + MAX_DEPTH + '). Either this recursion is ' +
                 'missing its base case, or it simply nests deeper than this interpreter ' +
                 'supports — try rewriting it as a loop.',
                 node.line, node.col, 'runtime');
    }
    depth.n++;
    const callEnv = makeEnv(fn.closure);
    // 形参绑定：多出的实参丢弃、缺失的实参补 undefined——与原生一致。
    // 用 'let' 而不是 'const'：形参在函数体内是可以被重新赋值的
    // （function f(a) { a = a + 1; return a; } 是合法 JS）。
    for (let idx = 0; idx < fn.params.length; idx++) {
      declareVar(callEnv, 'let', fn.params[idx], idx < args.length ? args[idx] : undefined, node);
    }
    /* 进帧/出帧标记（frameOp）是调试器「调用栈帧列表」的原始数据。push
       记在参数绑定之后、hoistFunctionDecls 之前——这样 push 这条 Step 的
       varDelta 恰好是这次调用的形参绑定（"进入 f，参数 x=5"），而函数体
       内部提升声明的嵌套函数则跟 Program 顶层的提升同一个待遇：滚进函数
       体第一条语句自己的 stepBoundary，不需要在这里特殊处理。
       push/pop 都记在调用点（node，即 Call 表达式）的行号上，而不是函数
       定义的行号——两者都发生在「调用序列」的时间线上，用调用点的行更
       容易跟外层代码对上；这是本任务的一个实现选择，brief 没有对 push/
       pop 的具体行号做断言。 */
    const frameName = fn.name || '(anonymous)';
    stepBoundary(callEnv, node, 'push', frameName);
    if (fn.expression) {
      const v = yield* evalExpr(fn.body, callEnv);
      stepBoundary(callEnv, node, 'pop', frameName);
      depth.n--;
      return v;
    }
    const stmts = fn.body.body;
    hoistFunctionDecls(stmts, callEnv);
    let completion = null;
    for (let idx = 0; idx < stmts.length; idx++) {
      completion = yield* evalStmt(stmts[idx], callEnv);
      stepBoundary(callEnv, stmts[idx]); // 同 evalBlockBody：哪怕提前 return 也要记这一步
      if (completion) break;
      yield;
    }
    stepBoundary(callEnv, node, 'pop', frameName);
    depth.n--;
    return (completion && completion.signal === 'return') ? completion.value : undefined;
  }

  /* 二元/复合赋值共用的运算实现：直接用 JS 自己的运算符，理由见文件顶
     的求值器说明——这样不会有第二套跟原生分歧的算术/比较语义。 */
  function applyBinary(op, l, r) {
    switch (op) {
      case '+': return l + r;
      case '-': return l - r;
      case '*': return l * r;
      case '/': return l / r;
      case '%': return l % r;
      case '<': return l < r;
      case '>': return l > r;
      case '<=': return l <= r;
      case '>=': return l >= r;
      case '===': return l === r;
      case '!==': return l !== r;
      case '==': return l == r;
      case '!=': return l != r;
      default: throw new Error('applyBinary: unknown operator ' + op);
    }
  }

  /* Assign / Update 的公共读写口：先把「目标是谁」（变量名，或对象+属性）
     解析成一对 get/set 闭包，obj/prop 只求值一次——这跟原生的赋值运算符
     语义（ECMA-262 13.15.3：先求出引用，再求值右手边，最后 PutValue）
     对得上，`a[i()] += 1` 这种目标里带副作用的表达式不会被求值两次。 */
  function* evalRef(node, env) {
    if (node.type === 'Ident') {
      return {
        get: function () { return lookupVar(env, node.name, node); },
        set: function (v) { return assignVar(env, node.name, v, node); },
      };
    }
    if (node.type === 'Member') {
      const obj = yield* evalExpr(node.obj, env);
      const prop = node.computed ? yield* evalExpr(node.prop, env) : node.prop;
      return {
        get: function () { return getProp(obj, prop, node); },
        set: function (v) { return setProp(obj, prop, v, node); },
      };
    }
    throw err('Invalid assignment target', node.line, node.col, 'runtime');
  }

  function* evalExpr(node, env) {
    switch (node.type) {
      case 'Num': return node.value;
      case 'Str': return node.value;
      case 'Bool': return node.value;
      case 'Null': return null;
      case 'Ident': return lookupVar(env, node.name, node);

      case 'Tpl': {
        let s = node.quasis[0];
        for (let idx = 0; idx < node.exprs.length; idx++) {
          const v = yield* evalExpr(node.exprs[idx], env);
          s += String(v) + node.quasis[idx + 1];
        }
        return s;
      }

      case 'Array': {
        const arr = [];
        for (let idx = 0; idx < node.elements.length; idx++) {
          arr.push(yield* evalExpr(node.elements[idx], env));
        }
        return arr;
      }

      case 'Object': {
        const obj = {};
        for (let idx = 0; idx < node.props.length; idx++) {
          const p = node.props[idx];
          obj[p.key] = yield* evalExpr(p.value, env);
        }
        return obj;
      }

      case 'Member': {
        const obj = yield* evalExpr(node.obj, env);
        const prop = node.computed ? yield* evalExpr(node.prop, env) : node.prop;
        return getProp(obj, prop, node);
      }

      case 'Call': {
        /* 求值顺序要跟原生对齐：被调用者（含成员表达式的对象与属性）
           先求值，参数再按从左到右的顺序求值——原生是「先求出被调函数
           的引用，再求值参数列表」，反过来会在「对象/属性求值有副作用」
           时被差分测试的宿主调用序列当场揪出来（见任务报告）。

           Task 6 起被调用者可能是解释出来的函数值（__fn，见 makeFunction）
           而不是真的 JS function——两条分支（Member callee / 裸标识符
           callee）取到 fn 之后都要认这第二种「可调用」的形状，走
           callInterpreted（生成器）而不是 fn.apply。 */
        let thisArg, fn;
        if (node.callee.type === 'Member') {
          thisArg = yield* evalExpr(node.callee.obj, env);
          const prop = node.callee.computed ? yield* evalExpr(node.callee.prop, env) : node.callee.prop;
          fn = resolveCallable(thisArg, prop, node);
        } else {
          thisArg = undefined;
          fn = yield* evalExpr(node.callee, env);
          if (!isCallableValue(fn)) {
            throw err('Value is not callable', node.line, node.col, 'runtime');
          }
        }
        const args = [];
        for (let idx = 0; idx < node.args.length; idx++) {
          args.push(yield* evalExpr(node.args[idx], env));
        }
        if (fn && typeof fn === 'object' && fn.__fn) return yield* callInterpreted(fn, args, node);
        return fn.apply(thisArg, args);
      }

      case 'Unary': {
        const v = yield* evalExpr(node.arg, env);
        if (node.op === '-') return -v;
        if (node.op === '+') return +v;
        return !v; // '!'
      }

      case 'Update': {
        const ref = yield* evalRef(node.arg, env);
        const old = ref.get();
        const next = node.op === '++' ? old + 1 : old - 1;
        ref.set(next);
        return node.prefix ? next : old;
      }

      case 'Binary': {
        const l = yield* evalExpr(node.left, env);
        const r = yield* evalExpr(node.right, env);
        return applyBinary(node.op, l, r);
      }

      case 'Logical': {
        /* 真短路：假分支的右操作数节点根本不会被 yield* 求值——不是求值
           完两边再挑一个。差分测试拿宿主调用序列验证过这一点（见任务
           报告：`false && log("no")` 里 log 一次都不会被调用）。 */
        const l = yield* evalExpr(node.left, env);
        if (node.op === '&&') return l ? (yield* evalExpr(node.right, env)) : l;
        return l ? l : (yield* evalExpr(node.right, env)); // '||'
      }

      case 'Assign': {
        const ref = yield* evalRef(node.target, env);
        if (node.op === '=') {
          const v = yield* evalExpr(node.value, env);
          ref.set(v);
          return v;
        }
        // 复合赋值（+= -= *= /= %=）：先读旧值，再求值右手边，顺序对应
        // ECMA-262 13.15.3。
        const old = ref.get();
        const rhs = yield* evalExpr(node.value, env);
        const v = applyBinary(node.op.slice(0, -1), old, rhs); // '+=' -> '+'
        ref.set(v);
        return v;
      }

      case 'Arrow': {
        /* 箭头函数在求值到此处的一刻捕获当前环境——env 就是它的
           closure，这正是闭包的实现：函数值携带的不是「调用点」的环境，
           而是「定义点」的环境。node.expression 区分表达式体（body 是
           表达式节点，调用时直接 evalExpr）与块体（body 是 Block 节点，
           调用时跑 evalBlockBody 并取 Return 完成信号）。 */
        return makeFunction(node.params, node.body, env, null, node.expression);
      }

      default:
        throw err('Not yet implemented in this task: ' + node.type + ' expressions ' +
                   '(control flow and function calls land in later tasks)',
                   node.line, node.col, 'runtime');
    }
  }

  /* break/continue/return 用哨兵对象逐层向上传，而不是 throw。
     用 throw 也能工作，但会与「真正的运行时错误」混在同一条通道上，
     调试器要区分「程序正常返回」和「程序崩了」时就得靠异常类型判断——
     哨兵让这两件事从一开始就是两回事。三种信号统一走 `signal` 字段
     （取代 Task 4 里 Return 专用的 `{type:'return', value}` 形状），
     这样 evalStmt/evalBlockBody/run 只需要认一种形状。 */
  const BREAK = { signal: 'break' }, CONTINUE = { signal: 'continue' };
  function ret(v) { return { signal: 'return', value: v }; }

  /* ---- 轨迹记录（Task 7） ----

     策略是「先跑完、记全轨迹、再回放」——因为「后退」只有这样才做得到
     （生成器「能在任意点暂停」这个能力只在录制期用到，回放期不再驱动
     生成器）。这里的 pending 是「自上一次 flush 以来累积的变量改动/
     棋盘操作/日志」，在语句边界（stepBoundary）打包成一条 Step 压进
     trace，然后清空供下一段累积。 */
  function newPending() { return { varDelta: [], boardOps: [], out: null }; }

  function createRecorder() {
    return { trace: [], shadowBoard: {}, pending: newPending() };
  }

  /* 语句边界：把 env.rec.pending 打包成一条 Step，压进 trace，然后清空
     pending。line/depth 取自传入的 node 与 env——depth 读的是
     env.callDepth.n，这是整条环境链共享的同一个计数器，因此天然反映
     「记录这一刻时，调用栈有多深」（决定①：depth 是调试器实现步入/
     步过/步出的唯一依据：步过 = 前进到 depth <= 当前；步入 = 前进一步；
     步出 = 前进到 depth < 当前）。
     frameOp/frameName 默认 null（绝大多数语句边界不是函数调用的进出
     帧事件），只有 callInterpreted 记录调用/返回时才传非空值。
     env.rec 为 null 时什么都不做——不是兜底容错，是刻意的「没有记录器
     就不记录」（呼应 recordVarDelta 的同一条设计）。 */
  function stepBoundary(env, node, frameOp, frameName) {
    const rec = env.rec;
    if (!rec) return;
    const p = rec.pending;
    rec.trace.push({
      line: node.line,
      depth: env.callDepth.n,
      frameOp: frameOp || null,
      frameName: frameName || null,
      varDelta: p.varDelta,
      boardOps: p.boardOps,
      out: p.out,
    });
    rec.pending = newPending();
  }

  /* 语句求值：返回值是「完成信号」——undefined/null 表示正常完成，非空
     则是上面三种哨兵之一，沿着 evalBlockBody / 各循环体的调用链一路
     return 出去，直到遇到能消化它的地方为止：break/continue 被最近的
     一层循环消化，return 一路传到 run() 的顶层驱动循环才被消化。 */
  function* evalStmt(node, env) {
    switch (node.type) {
      case 'VarDecl': {
        const value = node.init ? yield* evalExpr(node.init, env) : undefined;
        declareVar(env, node.kind, node.name, value, node);
        return null;
      }
      /* 只有 for 循环头部的逗号多声明会产生这个节点（parseFor 复用了
         parseVarDecl 的多声明解析路径，见该函数与 parseFor 的注释）——
         块/顶层语句里的多声明在 pushStmt 阶段就已经摊平成独立的 VarDecl
         语句，永远不会以 VarDeclList 的形状走到这里。逐条按声明顺序求值
         （let a = 1, b = a + 1 这种「后一个初始化式引用前一个」的写法
         要能工作），全部正常完成后返回 null。 */
      case 'VarDeclList': {
        for (let idx = 0; idx < node.decls.length; idx++) {
          yield* evalStmt(node.decls[idx], env);
        }
        return null;
      }
      case 'ExprStmt': {
        yield* evalExpr(node.expr, env);
        return null;
      }
      case 'Return': {
        const value = node.arg ? yield* evalExpr(node.arg, env) : undefined;
        return ret(value);
      }
      case 'Block': {
        const child = makeEnv(env);
        return yield* evalBlockBody(node.body, child);
      }
      case 'If': {
        const test = yield* evalExpr(node.test, env);
        if (test) return yield* evalStmt(node.cons, env);
        if (node.alt) return yield* evalStmt(node.alt, env);
        return null;
      }
      case 'Break': return BREAK;
      case 'Continue': return CONTINUE;
      case 'While': {
        /* while 的循环头没有声明，不需要每轮新建环境（跟 for 不同）——
           body 如果是 Block，自己的 evalStmt 分支已经会新建一层块作用域。
           每轮迭代末尾显式 yield 一次，标记「循环体跑完一轮」这个语句
           边界——哪怕 body 是单条非 Block 语句（while (x) i++;），
           单步调试也要能在每一轮停下来，不能只靠 body 内部（如果有
           Block）自己的语句边界。 */
        for (;;) {
          const test = yield* evalExpr(node.test, env);
          if (!test) break;
          const completion = yield* evalStmt(node.body, env);
          if (completion) {
            /* stepBoundary 必须在 break/return 两条早退路径上也调用一次——
               不这样做的话，body 求值期间累积的 pending（比如 body 是单条
               非 Block 语句时它自己的变量改动）会跟着这次提前退出一起
               丢掉，永远进不了 trace。正常路径（下面循环末尾）跟这两条
               早退路径合起来，保证每一轮迭代无论怎么结束都恰好 flush
               一次——不会漏、也不会在同一轮里重复计入。 */
            if (completion.signal === 'break') { stepBoundary(env, node); break; }
            if (completion.signal !== 'continue') { stepBoundary(env, node); return completion; } // return：继续向上传
          }
          stepBoundary(env, node);
          yield;
        }
        return null;
      }
      case 'For': {
        /* for 的每轮迭代要新建一层环境并把循环变量拷进去（ECMA-262
           14.7.4.3 CreatePerIterationEnvironment）——否则闭包捕获会跟
           原生 let 语义不一致：
             const fs = []; for (let i=0;i<3;i++) fs.push(()=>i);
             fs[0]()+fs[1]()+fs[2]() 原生是 0+1+2=3；如果三轮共享同一个
             绑定，i 循环结束时已经是 3，三个闭包会全部读到同一个值。
           函数调用是 Task 6 才实现，这里还测不了闭包捕获本身，但语义要
           从一开始就按这个规则写，不然 Task 6 会拿到一个隐蔽的坑。
           规格里这个过程分两步：
             1) 进入循环之前，把 init 声明的绑定拷进第一轮的环境；
             2) 每轮循环体跑完之后（continue 落到这里也一样）、下一轮
                test 之前，再拷一层新的——update 表达式在这个新环境里
                求值，于是「这一轮的 body/update」用同一份绑定，
                「下一轮」则是全新的一份。 */
        const declEnv = makeEnv(env);
        if (node.init) {
          if (node.init.type === 'VarDecl' || node.init.type === 'VarDeclList') {
            yield* evalStmt(node.init, declEnv);
          } else {
            // 没有 let/const 打头：init 是一条 ExprStmt，不声明新变量，
            // 直接在 declEnv 里求值（等价于在外层求值——declEnv 此时
            // 是空的，assignVar 会沿 parent 链找到外层已声明的变量）。
            yield* evalExpr(node.init.expr, declEnv);
          }
        }
        function copyIterEnv(base) {
          const e = makeEnv(env);
          base.vars.forEach(function (binding, name) {
            e.vars.set(name, { kind: binding.kind, value: binding.value });
          });
          return e;
        }
        let iterEnv = copyIterEnv(declEnv);
        for (;;) {
          if (node.test) {
            const test = yield* evalExpr(node.test, iterEnv);
            if (!test) break;
          }
          const completion = yield* evalStmt(node.body, iterEnv);
          if (completion) {
            // 早退（break/return）没有 update 可跑，直接在这里 flush 一次；
            // 见 While 分支同一处的注释。
            if (completion.signal === 'break') { stepBoundary(env, node); break; }
            if (completion.signal !== 'continue') { stepBoundary(env, node); return completion; } // return：继续向上传
          }
          const nextEnv = copyIterEnv(iterEnv);
          if (node.update) yield* evalExpr(node.update, nextEnv);
          iterEnv = nextEnv;
          // 正常路径（含 continue 落下来的情况）在 update 求值之后才 flush，
          // 这样 update 表达式自身的改动（最典型的 i++）跟这一轮 body 的
          // 改动一起进同一条 Step，而不是被孤立地丢给下一轮。
          stepBoundary(env, node);
          yield;
        }
        return null;
      }
      case 'ForOf': {
        /* 可迭代对象只开数组与字符串两道口子（跟 getProp/resolveCallable
           的「表面积刻意开得小而准」是同一条原则）——字符串按码元逐个
           迭代（split('') 是 UTF-16 code unit 粒度，跟原生 for...of
           字符串的 code point 粒度在 BMP 内一致，代理对不在这个教学
           子集的关注范围）。
           同 For：每轮迭代新建一层环境装循环变量，跟原生 for...of 对
           let/const 都是「每轮独立绑定」的语义对齐。 */
        const iterable = yield* evalExpr(node.iterable, env);
        let items;
        if (Array.isArray(iterable)) items = iterable;
        else if (typeof iterable === 'string') items = iterable.split('');
        else throw err('Value is not iterable', node.line, node.col, 'runtime');

        for (let idx = 0; idx < items.length; idx++) {
          const iterEnv = makeEnv(env);
          declareVar(iterEnv, node.kind, node.name, items[idx], node);
          const completion = yield* evalStmt(node.body, iterEnv);
          if (completion) {
            if (completion.signal === 'break') { stepBoundary(iterEnv, node); break; }
            if (completion.signal !== 'continue') { stepBoundary(iterEnv, node); return completion; } // return：继续向上传
          }
          stepBoundary(iterEnv, node);
          yield;
        }
        return null;
      }
      /* FuncDecl：真正的声明（把名字绑定成一个函数值）发生在
         evalBlockBody 开头的提升扫描里，不在这里——真实执行流程走到
         这条语句时，绑定早已存在（这正是「提升」的意义：函数在它出现
         的位置之前就已经可调用）。这里因此是纯粹的 no-op。 */
      case 'FuncDecl': return null;
      default:
        throw err('Not yet implemented in this task: ' + node.type + ' statements ' +
                   '(function declarations land in a later task)',
                   node.line, node.col, 'runtime');
    }
  }

  /* 函数声明提升（ECMA-262 §14.2.2 / Annex B 的简化版）：进入任意一个块
     （Program 顶层、普通 {} 块、函数体）之前，先扫一遍这一层的语句数组，
     把里面**直接**出现的 FuncDecl（不递归进 if/for/嵌套块内部——那些是
     另一层块自己的提升范围）全部声明好，再按顺序执行语句。
     这就是差分测试「函数声明提升」（`return f(); function f(){...}`）
     与「互递归」（两个 function 互相调用，谁写在前面不重要）背后的机制：
     调用点在源码顺序上出现在声明之前也无所谓，因为绑定在语句真正开始
     顺序执行之前就已经就位。
     绑定用 'let'（而不是 'const'）——原生里 `function f(){}` 之后
     `f = 5;` 是合法的，重新赋值不该被当成「给 const 赋值」拒绝。
     closure 捕获的是这一层块自己的 env（当前调用），不是全局——这样
     嵌套在某次函数调用内部的具名函数声明，每次调用都会拿到一份闭包
     指向那一次调用自己的环境，不会跨调用互相串。 */
  function hoistFunctionDecls(stmts, env) {
    for (let idx = 0; idx < stmts.length; idx++) {
      const s = stmts[idx];
      if (s.type === 'FuncDecl') {
        declareVar(env, 'let', s.name, makeFunction(s.params, s.body, env, s.name, false), s);
      }
    }
  }

  /* 顺序执行一组语句；每条语句执行完 yield 一次，标记「语句边界」——
     单步执行（阶段 3b）与轨迹记录（Task 7）都靠这个暂停点，本任务的
     run() 只是简单地把生成器一次性驱动到底，不利用它。
     这里也是唯一需要跑函数声明提升扫描的地方——Program 顶层、Block、
     函数调用（callInterpreted 直接把函数体的语句数组喂给这里）全部
     经过这一个函数，提升逻辑因此只需要写一遍。 */
  function* evalBlockBody(stmts, env) {
    hoistFunctionDecls(stmts, env);
    for (let idx = 0; idx < stmts.length; idx++) {
      const completion = yield* evalStmt(stmts[idx], env);
      /* stepBoundary 无条件调用（在 completion 检查之前）——哪怕这条语句
         是 return/break/continue，它本身也确确实实执行了一次，必须进
         trace；跳过它只会在「函数提前 return」这种最常见的场景里丢一步。 */
      stepBoundary(env, stmts[idx]);
      if (completion) return completion;
      yield;
    }
    return null;
  }

  /* Math 命名空间只长这四个自有属性——resolveCallable/getProp 走的都是
     「hasOwnProperty 自有属性」通道，所以这里没暴露的方法（Math.random
     等）天然调不到，不需要另外维护一张排除名单。 */
  const MATH_NS = { abs: Math.abs, max: Math.max, min: Math.min, floor: Math.floor };

  /* opts.host 里没给的函数补成空操作，而不是让它变成 undefined 然后在
     调用点抛「x is not a function」。理由是这五个函数是**算法与棋盘之间
     唯一的接口**（规格 §2.6）：算法源码里永远写着它们，而调用方有时并
     不需要棋盘（node 里跑纯逻辑测试、编辑器里只做语法检查）。缺席时静静
     不做事，比强迫每个调用方都传五个空函数干净。
     注意：**空操作不影响轨迹记录** —— boardOps 照记，因为轨迹记的是
     「算法要求棋盘做什么」，不是「棋盘真的做了什么」。
     attacked 的缺省返回 false——它是唯一有返回值的宿主函数，返回
     undefined 会让算法里的 if (attacked(sq)) 行为与真实宿主下不同。 */
  const NOOP_HOST = {
    log: function () {}, mark: function () {}, place: function () {},
    clear: function () {}, attacked: function () { return false; },
  };

  function resolveHost(host) {
    const h = host || {};
    return {
      log: h.log || NOOP_HOST.log,
      mark: h.mark || NOOP_HOST.mark,
      place: h.place || NOOP_HOST.place,
      clear: h.clear || NOOP_HOST.clear,
      attacked: h.attacked || NOOP_HOST.attacked,
    };
  }

  /* 给已经补完 NOOP 默认值的五个宿主函数再包一层轨迹记录。无论调用方
     有没有传真正的棋盘实现，包出来的这一层在「记轨迹」这件事上表现
     完全一致——轨迹记的是"算法要求棋盘做什么"，不是"棋盘真的做了
     什么"（任务简报的上下文 5）。真正的宿主实现（或 NOOP）仍然照常被
     调用（return resolvedHost.xxx(...)），包装只是在旁边多做一次记录，
     不改变返回值或调用时机。
     mark/place/clear 的 from 取自解释器自己维护的「棋盘影子状态」
     （rec.shadowBoard: { [sq]: kind }），不去问宿主——宿主未必肯回答
     "这一格之前是什么"（上下文 6）。影子状态只为算出撤销信息服务，
     不参与任何求值，这是它在整个解释器里唯一被读写的地方。
     attacked 只读、不产生任何棋盘变化，boardOps 的 kind 枚举里也没有
     它的位置，所以只转发调用，不记录。 */
  function wrapHostForTrace(resolvedHost, rec) {
    function shadowFrom(sq) {
      return Object.prototype.hasOwnProperty.call(rec.shadowBoard, sq) ? rec.shadowBoard[sq] : null;
    }
    return {
      log: function (msg) {
        const r = resolvedHost.log(msg);
        // 同一步里连续多次 log 的场景没有测试覆盖，也不常见（brief 的
        // Step.out 定义是单个字符串/null）；选择拼接而不是覆盖，避免
        // 静默丢掉更早的一条日志。
        rec.pending.out = rec.pending.out === null ? String(msg) : rec.pending.out + '\n' + String(msg);
        return r;
      },
      mark: function (sq, kind) {
        rec.pending.boardOps.push({ kind: 'mark', sq: sq, to: kind, from: shadowFrom(sq) });
        rec.shadowBoard[sq] = kind;
        return resolvedHost.mark(sq, kind);
      },
      place: function (sq, piece) {
        rec.pending.boardOps.push({ kind: 'place', sq: sq, to: piece, from: shadowFrom(sq) });
        rec.shadowBoard[sq] = piece;
        return resolvedHost.place(sq, piece);
      },
      clear: function (sq) {
        rec.pending.boardOps.push({ kind: 'clear', sq: sq, to: null, from: shadowFrom(sq) });
        delete rec.shadowBoard[sq];
        return resolvedHost.clear(sq);
      },
      attacked: function (sq) { return resolvedHost.attacked(sq); },
    };
  }

  /* 根环境的五个宿主桥接名 + Math 恒是全新 Map 上的第一次声明，不可能触发
     上面新加的重复声明检查——node 参数只在报错时才用得到，这里传一个
     line:0/col:0 的占位节点即可（没有源码位置可指，也用不上）。 */
  const ROOT_NODE = { line: 0, col: 0 };
  function makeRootEnv(resolvedHost) {
    const env = makeEnv(null);
    declareVar(env, 'const', 'log', resolvedHost.log, ROOT_NODE);
    declareVar(env, 'const', 'mark', resolvedHost.mark, ROOT_NODE);
    declareVar(env, 'const', 'place', resolvedHost.place, ROOT_NODE);
    declareVar(env, 'const', 'clear', resolvedHost.clear, ROOT_NODE);
    declareVar(env, 'const', 'attacked', resolvedHost.attacked, ROOT_NODE);
    declareVar(env, 'const', 'Math', MATH_NS, ROOT_NODE);
    return env;
  }

  /* run(src, opts) → { result, trace, host }：parse → 建根环境（注入
     opts.host 的五个函数，缺席的补 NOOP_HOST，再包一层轨迹记录）→ 把
     求值生成器一次性驱动到底 → 取顶层 Return 完成信号（signal:'return'）
     的值当 result。
     trace 是这一次 run() 全程录下的 Step[]（Task 7）——录制策略是「先
     跑完、记全轨迹、再回放」：生成器一次性驱动到底，state 变化全部靠
     declareVar/assignVar/宿主桥接调用这些"事件点"的副作用写进 rec，
     stepBoundary 在每个语句边界把它们打包成一条 Step。
     host 是补完 NOOP 默认值之后、实际语义上的那五个函数（不含轨迹记录
     这层包装）——调用方拿它检查"棋盘接口最终是谁"用的是这个，不该看到
     内部的记录层，也不该在 run() 结束之后还去调用它、误以为能追加轨迹
     （trace 数组是这次 run() 私有的，run() 返回之后 rec 再也不会被写）。
     opts.limit：接口签名里留的位置，给循环步数上限用——本任务（控制流）
     引入了 for/while 之后，写死循环在语法上已经可能（while (true) {} 不
     带 break），但加步数上限不在本任务的差分测试范围内，留给需要它的
     调用方（比如阶段 3b 的编辑器跑用户代码）在后面接上，这里先不做任何事。 */
  function run(src, opts) {
    opts = opts || {};
    const program = parse(src);
    const resolvedHost = resolveHost(opts.host);
    const rec = createRecorder();
    const tracedHost = wrapHostForTrace(resolvedHost, rec);
    const env = makeRootEnv(tracedHost);
    /* env.rec 必须在 makeRootEnv 声明完 log/mark/place/clear/attacked/Math
       这六个根绑定之后才挂上——这六个 declareVar 调用不是用户源码的一
       部分，用户永远看不到、也不该出现在第一条用户语句的 varDelta 里。
       makeEnv(null) 里 rec 的默认值就是 null，这里显式补上。 */
    env.rec = rec;
    const gen = evalBlockBody(program.body, env);
    let step = gen.next();
    while (!step.done) step = gen.next();
    const completion = step.value;
    const result = completion && completion.signal === 'return' ? completion.value : undefined;
    return { result: result, trace: rec.trace, host: resolvedHost };
  }

  return { tokenize: tokenize, KEYWORDS: KEYWORDS, parseExpression: parseExpression, parse: parse, run: run };
});
