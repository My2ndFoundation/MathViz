/* 挖空练习（规格 §2.9）的**解析器**：把一段带 `// >>> BLANK … // <<< BLANK`
   指令的算法源码，解析成挖空清单 + 一份把每个挖空体替换成占位块的「占位版」源码。

   零依赖；node 与浏览器双用。跟 `algos/*.js` 里各道题自己的生成器是同一个
   UMD 包装形状。

   ---- 为什么参考答案就是这份正在跑的源码本身 ----

   `algos/*.js` 生成的算法源码里，将来会直接嵌着 `// >>> BLANK … // <<< BLANK`
   包起来的一段代码。**正常模式下**，那一段就是被 `Interp.run` 真正执行、
   被使用者读到的代码——它就是标准答案。**练习模式下**，`parse()` 把同一段
   源码里的挖空体摘掉、换成一段占位注释加 `fill`（一个能让程序跑完但很可能
   答错的占位实现），使用者在编辑器里把占位那一行改写成自己的答案。

   两条路径读的是**同一份文件**：出题者不需要另外维护一份「标准答案」，
   因为标准答案从来就没有和源码分开过——它就是源码里挖空体的原文
   （`Blank.body`）。这就杜绝了「参考答案」和「实际运行的代码」互相漂移
   的可能：没有第二份东西可以漂移。

   判定（Task 2 的 `judge`）因此也不比较文本，而是比较**行为**：用使用者的
   版本跑一遍、用 `Blank.body`（也就是这份源码本身）跑一遍，看两次的
   trace 在哪一步第一次分道扬镳。这个模块只管解析——它跟 `PROBLEMS` 注册表
   一样不认识任何一道具体题目，题目只活在调用方传进来的源码字符串里、
   只在页面层的声明里被点名。

   ---- 指令格式 ----

   一个挖空是相邻的两行指令夹着中间的挖空体：

     // >>> BLANK id=<裸值> level=<裸值 1|2|3> fill="<双引号串>" hint="<双引号串>" hintEn="<双引号串>"
     <挖空体：一行或多行原始代码>
     // <<< BLANK

   `id=` / `level=` 是裸值（读到下一个空白为止），`fill=` / `hint=` /
   `hintEn=` 是双引号包起来的字符串。属性顺序不作要求，但五个都必须出现。

   ---- 占位块的形状 ----

     <indent>/ * 在这里写：<hint.zh>  （第 <level> 级；Check 会跑你的版本和参考版本，比行为不比写法） * /
     <indent><fill>

   `indent` 取挖空体第一行的前导空白，两行占位都用它，这样占位版在编辑器
   里缩进跟原文一致。注释行只写中文——英文由 UI 层在 `lang=en` 时按同一份
   `Blank.hint.en` 重新渲染那一行文字，不重新生成占位源码、不重跑解释器
   （规格 §2.9 / 计划 Task 7）。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Exercise = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const OPEN_PREFIX = '// >>> BLANK';
  const CLOSE_LINE = '// <<< BLANK';

  /* 属性扫描器：不用一条大正则扫整行，逐个 key 去找。
     阶段 5 的教训：`[\w\-.,]*` 这类字符类不含空格，一份写成
     "a.js, b.js" 的清单会被静默截断——这里的做法是每种取值方式
     （裸值 vs 双引号串）各自扫描到明确的终止符，找不到就抛，不猜。

     修复轮 1 的教训：光靠 `line.indexOf('id=')` 找子串不够——如果某个
     引号值内部恰好含有 `id=` 这样的文字（比如中文提示写「设 id=5 的
     场景」），`indexOf` 会先命中引号**内部**那个 `id=`，把提示文案的一
     截读成 id 的值，不抛也不报。加一条「前面必须是空白」的边界挡不住
     这个反例：引号内那个 `id=` 前面恰好也是空白（自然的中文断句空格）。
     真正的边界不是字符，是「引号内 / 引号外」——所以先按引号把整行切成
     token（`key="…"` 整段算一个不可分的 token，token 之间以引号外的
     空白分隔），再只在 token **起始处**匹配 `key=`。 */

  /* 把一行按「引号外的空白」切成 token；`key="…"` 这类带引号的属性会被
     整段吞成一个 token（哪怕引号内部有空白也不会被切开）。 */
  function tokenize(line) {
    const tokens = [];
    let i = 0;
    while (i < line.length) {
      while (i < line.length && /\s/.test(line[i])) i++;
      if (i >= line.length) break;
      const start = i;
      while (i < line.length && !/\s/.test(line[i])) {
        if (line[i] === '"') {
          i++;
          while (i < line.length && line[i] !== '"') i++;
          if (i < line.length) i++; // 吞掉闭合引号
        } else {
          i++;
        }
      }
      tokens.push(line.slice(start, i));
    }
    return tokens;
  }

  /* 找到以 'key=' 开头的那个 token，读裸值：token 里 'key=' 之后的全部
     内容（token 本身已经是「到下一个引号外空白为止」，无需再截断）。
     找不到这样的 token，或值是空字符串，返回 undefined。 */
  function scanBare(line, key) {
    const marker = key + '=';
    const tokens = tokenize(line);
    for (let t = 0; t < tokens.length; t++) {
      if (tokens[t].indexOf(marker) === 0) {
        const value = tokens[t].slice(marker.length);
        return value === '' ? undefined : value;
      }
    }
    return undefined;
  }

  /* 找到以 'key="' 开头的那个 token，读引号内的内容（不支持转义——这些
     指令是源码作者手写的注释，不是任意用户输入）。找不到这样的 token，
     或 token 没有以闭合引号收尾（说明这条指令本身写坏了），返回
     undefined。 */
  function scanQuoted(line, key) {
    const marker = key + '="';
    const tokens = tokenize(line);
    for (let t = 0; t < tokens.length; t++) {
      const tok = tokens[t];
      if (tok.indexOf(marker) === 0 && tok.length > marker.length && tok[tok.length - 1] === '"') {
        return tok.slice(marker.length, tok.length - 1);
      }
    }
    return undefined;
  }

  /* 解析一行 `// >>> BLANK ...` 指令，返回属性对象；任何一条缺失都抛。
     lineNo 是这一行的 1-based 行号，raw 是这一行的原文——都是为了让
     报错能一眼定位。 */
  function parseOpenLine(line, lineNo, raw) {
    const id = scanBare(line, 'id');
    if (id === undefined) {
      throw new Error('第 ' + lineNo + ' 行：BLANK 指令缺 id=\n  ' + raw);
    }
    const levelStr = scanBare(line, 'level');
    if (levelStr === undefined) {
      throw new Error('第 ' + lineNo + ' 行：BLANK 指令缺 level=\n  ' + raw);
    }
    const level = Number(levelStr);
    if (!(level === 1 || level === 2 || level === 3)) {
      throw new Error(
        '第 ' + lineNo + ' 行：level 必须是 1、2 或 3，收到 "' + levelStr + '"\n  ' + raw
      );
    }
    const fill = scanQuoted(line, 'fill');
    if (fill === undefined) {
      throw new Error('第 ' + lineNo + ' 行：BLANK 指令缺 fill="..."\n  ' + raw);
    }
    const hintZh = scanQuoted(line, 'hint');
    if (hintZh === undefined) {
      throw new Error('第 ' + lineNo + ' 行：BLANK 指令缺 hint="..."\n  ' + raw);
    }
    const hintEn = scanQuoted(line, 'hintEn');
    if (hintEn === undefined) {
      throw new Error(
        '第 ' + lineNo + ' 行：BLANK 指令缺 hintEn="..."' +
        '（英文是默认语言，缺了比缺中文提示更严重）\n  ' + raw
      );
    }
    return { id: id, level: level, fill: fill, hint: { zh: hintZh, en: hintEn } };
  }

  /* parse(source) → { blanks: Blank[], placeholder: string }
     source 必须是字符串，缺了或类型不对直接抛（约束 6：省略参数不许
     默默变成什么都不做）。 */
  function parse(source) {
    if (typeof source !== 'string') {
      throw new Error('parse(source) 少了 source，或者 source 不是字符串，收到：' + typeof source);
    }

    const rawLines = source.split('\n');
    const blanks = [];
    const seenIds = Object.create(null);

    // 输出行的缓冲区：普通行原样进来，挖空段落被替换成占位块。
    const outLines = [];

    let i = 0; // 0-based 索引，行号 = i + 1
    let openAt = -1; // 若非 -1，表示当前正处在一个挖空体内部，值是 >>> 指令行的 0-based 索引

    while (i < rawLines.length) {
      const raw = rawLines[i];
      const trimmed = raw.trim();
      const lineNo = i + 1;

      if (trimmed.indexOf(OPEN_PREFIX) === 0) {
        if (openAt !== -1) {
          throw new Error(
            '第 ' + lineNo + ' 行：BLANK 指令嵌套 —— 上一个 >>> BLANK（第 ' +
            (openAt + 1) + ' 行）还没有对应的 <<< BLANK\n  ' + raw
          );
        }
        openAt = i;
        i++;
        continue;
      }

      if (trimmed === CLOSE_LINE) {
        if (openAt === -1) {
          throw new Error('第 ' + lineNo + ' 行：<<< BLANK 没有对应的 >>> BLANK\n  ' + raw);
        }
        const openLineRaw = rawLines[openAt];
        const attrs = parseOpenLine(openLineRaw.trim(), openAt + 1, openLineRaw);

        if (seenIds[attrs.id]) {
          throw new Error(
            '第 ' + (openAt + 1) + ' 行：重复的 id="' + attrs.id + '"' +
            '（localStorage 的键靠它区分挖空，撞了会互相覆盖）\n  ' + openLineRaw
          );
        }
        seenIds[attrs.id] = true;

        const bodyStart = openAt + 1; // 0-based
        const bodyEnd = i; // 0-based，指向 <<< 那一行，不含
        if (bodyEnd === bodyStart) {
          throw new Error(
            '第 ' + (openAt + 1) + ' 行到第 ' + lineNo + ' 行：挖空体是空的' +
            '（>>> BLANK 和 <<< BLANK 之间没有任何代码）\n  ' + openLineRaw
          );
        }
        const bodyRawLines = rawLines.slice(bodyStart, bodyEnd);
        const body = bodyRawLines.join('\n');
        const indentMatch = /^[ \t]*/.exec(bodyRawLines[0]);
        const indent = indentMatch ? indentMatch[0] : '';

        blanks.push({
          id: attrs.id,
          level: attrs.level,
          fill: attrs.fill,
          hint: attrs.hint,
          body: body,
          indent: indent,
          startLine: bodyStart + 1, // 1-based
          endLine: bodyEnd, // bodyEnd 是 0-based 指向 <<< 行，即挖空体最后一行的 1-based 行号
        });

        outLines.push(indent + '/* 在这里写：' + attrs.hint.zh +
          '  （第 ' + attrs.level + ' 级；Check 会跑你的版本和参考版本，比行为不比写法） */');
        outLines.push(indent + attrs.fill);

        openAt = -1;
        i++;
        continue;
      }

      // 普通行：若在挖空体内部，跳过（不进入占位版，也不单独判 body 是否为空——
      // 已经在 <<< 处按整段校验过了）；否则原样进入占位版。
      if (openAt === -1) {
        outLines.push(raw);
      }
      i++;
    }

    if (openAt !== -1) {
      const openLineRaw = rawLines[openAt];
      throw new Error(
        '第 ' + (openAt + 1) + ' 行：>>> BLANK 没有对应的 <<< BLANK\n  ' + openLineRaw
      );
    }

    return { blanks: blanks, placeholder: outLines.join('\n') };
  }

  return { parse: parse };
});
