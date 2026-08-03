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

  const ESCAPES = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"', '`': '`', '0': '\0' };

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

      if (c >= '0' && c <= '9') {
        while (i < src.length && ((src[i] >= '0' && src[i] <= '9') || src[i] === '.')) adv();
        push('num', parseFloat(src.slice(start, i)), start, sl, sc);
        continue;
      }

      if (c === "'" || c === '"') {
        adv();
        let s = '';
        while (i < src.length && src[i] !== c) {
          if (src[i] === '\\') {
            adv();
            if (i >= src.length) break;
            s += (ESCAPES[src[i]] !== undefined ? ESCAPES[src[i]] : src[i]);
            adv();
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
           源码片段之后再各自 parse 一次。quasis 恒比 exprs 多一个。 */
        adv();
        const quasis = [], exprs = [];
        let cur = '';
        while (i < src.length && src[i] !== '`') {
          if (src[i] === '\\') {
            adv();
            if (i >= src.length) break;
            cur += (ESCAPES[src[i]] !== undefined ? ESCAPES[src[i]] : src[i]);
            adv();
          } else if (src[i] === '$' && peek(1) === '{') {
            quasis.push(cur); cur = '';
            adv(2);
            let depth = 1, es = i;
            while (i < src.length && depth > 0) {
              if (src[i] === '{') depth++;
              else if (src[i] === '}') depth--;
              if (depth > 0) adv();
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

  return { tokenize: tokenize, KEYWORDS: KEYWORDS };
});
