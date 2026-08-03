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
      adv(); // 跳过开始引号
      while (i < src.length && src[i] !== quote) {
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
      body.push(parseStatement(state));
    }
    expect(state, '}');
    return { type: 'Block', body: body, line: t0.line, col: t0.col };
  }

  /* let/const 声明。解构（let [a,b]=xs / let {a,b}=obj）不在子集内——
     声明名之后如果不是 name 而是 '[' 或 '{'，直接报 unsupported，而不是
     让它继续走进「expected identifier」这个不知所云的 syntax 错误。 */
  function parseVarDecl(state) {
    const t0 = cur(state); // 'let' 或 'const'
    const kind = t0.value;
    state.i++;
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
    return { type: 'VarDecl', kind: kind, name: name, init: init, line: t0.line, col: t0.col };
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
     只有 let/const 打头时才可能是 for…of/for…in，所以先探一下声明名
     之后紧跟的词：'of' → ForOf；'in' → 专门的报错（点名该改用 for…of，
     不能只说「in 不支持」，使用者不知道该换成什么）；其它 → 当成普通
     三段式的初始化部分继续解析。 */
  function parseFor(state) {
    const t0 = cur(state);
    state.i++;
    expect(state, '(');

    if (at(state, 'kw', 'let') || at(state, 'kw', 'const')) {
      const kindTok = cur(state);
      const kind = kindTok.value;
      state.i++;
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

      if (at(state, 'kw', 'of')) {
        state.i++;
        const iterable = parseExpr(state);
        expect(state, ')');
        const body = parseStatement(state);
        return { type: 'ForOf', kind: kind, name: name, iterable: iterable, body: body,
                 line: t0.line, col: t0.col };
      }
      if (at(state, 'name', 'in')) {
        const inTok = cur(state);
        throw err('Unsupported syntax: for...in (line ' + inTok.line + '). ' +
                   'This interpreter supports for...of but not for...in — there is no ' +
                   'prototype chain in this subset. Use for...of instead.',
                   inTok.line, inTok.col, 'unsupported');
      }

      let varInit = null;
      if (eat(state, '=')) varInit = parseAssign(state);
      const init = { type: 'VarDecl', kind: kind, name: name, init: varInit,
                     line: kindTok.line, col: kindTok.col };
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
      const d = parseVarDecl(state);
      semi(state);
      return d;
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
      body.push(parseStatement(state));
    }
    return { type: 'Program', body: body };
  }

  return { tokenize: tokenize, KEYWORDS: KEYWORDS, parseExpression: parseExpression, parse: parse };
});
