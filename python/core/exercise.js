/* 「挖空填空」（Python 子项目习题模式）的解析器：把一段带
   `# >>> BLANK … # <<< BLANK` 指令的教学 Python 源码，解析成挖空清单 +
   一份把每个挖空体换成占位符（`___`）的「占位版」源码；`merge()` 反过来把
   使用者填的答案（或缺省时的原文）拼回一份可运行的完整源码。

   零依赖；node 与浏览器双用。跟 `chess/core/exercise.js`（同一套设计的
   棋类版本，977 行）是同一职责、同一 UMD 外壳形状——**先读那一份**，
   它的文件头详细写了这套设计从哪里来、踩过哪些坑。这里的版本是它的
   简化版：Python 子项目没有解释器（`Interp.run` 那一层根本不存在），
   所以不需要 chess 那套「占位实现 `fill` 让程序仍能跑完」的机制——
   这里的占位符就是字面的 `___`，页面级的校验门直接跑使用者填好之后的
   完整源码、比对真实输出，不需要一个能让半成品程序不崩溃的假答案。

   ---- 为什么参考答案就是这份正在跑的源码本身 ----

   指令是 **Python 注释**（`#` 开头），所以带着标准答案的那个 `.py` 文件
   本身仍然能跑、能被校验门真跑真比对输出。参考答案与正在运行的源码
   从来没有分开过，也就没有第二份可以漂——出题者不需要另外维护一份
   「标准答案」，因为标准答案就是源码里挖空体的原文（`Blank.body`）。
   `merge()` 缺答案时兜底用的正是这同一份 `body`，同一个理由。

   ---- 指令格式 ----

     # >>> BLANK id=<裸值> level=<裸值 1|2|3> hint="<双引号串>" hintEn="<双引号串>"
     <挖空体：一行或多行原始代码>
     # <<< BLANK

   `id=` / `level=` 是裸值（读到下一个空白为止），`hint=` / `hintEn=` 是
   双引号包起来的字符串。属性顺序不作要求，但四个都必须出现——缺任何
   一个都当场抛，消息里点名缺的是哪一个（不猜、不悄悄放过）。

   属性解析顺序上有一个具体陷阱：**必须先测 `hintEn` 再测 `hint`**。
   `hint="..."` 和 `hintEn="..."` 是两个独立且各自锚定到闭引号的正则，
   顺序颠倒目前构造不出真实的误判用例，但这是上一份设计（`chess`）里
   留下来的明确告诫，成本为零、收益是以防万一，所以照做。

   ---- 三种必须抛错的形状 ----

   缺任何一个属性、挖空体为空（两条指令行贴在一起）、同一份源码里 id
   重复：这三种都是手滑最常见的形状。挖空体为空尤其值得强调——**空正是
   疏漏呈现出来的形状**（新建一道题时先写两行指令占位、内容留着以后填，
   如果不抛，这道半成品题会一直悄悄地留在注册表里，直到使用者点开那一页
   才发现挖的是一片空白）。id 重复要抛是因为 UI（提示面板、答案定位、
   `localStorage` 的键）全部拿 id 当锚点，两个空共用一个 id 会互相顶掉。

   ---- `parse()` 与 `merge()` 共享同一次扫描 ----

   两者都要回答「源码里哪几段是挖空块、每一块的属性和体是什么」这同一个
   问题，所以这个判断只写一次（`scanBlocks`），parse 和 merge 各自只管
   拿到手的结果分别怎么拼。这跟 chess 版本"`clean` 与 `placeholder` 在
   同一趟扫描里各填各的缓冲区"是同一个理由：判断分成两份，迟早分岔。

   ---- `stripped` / `lineMap` 是给编辑器用的 ----

   `stripped` 是练习模式该显示的源码：挖空体（含两行指令）整体塌成一行
   `indent + '___'`。`lineMap` 与 `stripped.split('\n')` 逐行一一对应，
   每行标 `{ kind: 'code' | 'blank', ... }`；`kind:'blank'` 那行带
   `blankId`，供编辑器把使用者的输入定位回对应的挖空。两者都带 `srcLine`
   （原文的 1-based 行号），给错误信息 / 高亮跳转用。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Exercise = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var OPEN_PREFIX = '# >>> BLANK';
  var CLOSE_LINE = '# <<< BLANK';

  /* 解析一行 `# >>> BLANK ...` 指令，返回 { id, level, hint, hintEn }；
     四个属性缺任何一个都抛，消息里点名缺的是哪一个。
     line 是已 trim 过的指令行文本；lineNo 是它的 1-based 行号；raw 是
     这一行未 trim 的原文——两者只为了让报错能一眼定位。 */
  function parseAttrs(line, lineNo, raw) {
    var idM = /\bid=(\S+)/.exec(line);
    if (!idM) {
      throw new Error('第 ' + lineNo + ' 行：BLANK 指令缺 id=\n  ' + raw);
    }
    var id = idM[1];

    var levelM = /\blevel=(\S+)/.exec(line);
    if (!levelM) {
      throw new Error('第 ' + lineNo + ' 行：BLANK 指令缺 level=\n  ' + raw);
    }
    var level = Number(levelM[1]);
    if (!(level === 1 || level === 2 || level === 3)) {
      throw new Error(
        '第 ' + lineNo + ' 行：level 必须是 1、2 或 3，收到 "' + levelM[1] + '"\n  ' + raw
      );
    }

    // 必须先测 hintEn 再测 hint：否则 \bhint= 会先咬到 hintEn= 的前半段。
    var hintEnM = /\bhintEn="((?:[^"\\]|\\.)*)"/.exec(line);
    if (!hintEnM) {
      throw new Error('第 ' + lineNo + ' 行：BLANK 指令缺 hintEn="..."\n  ' + raw);
    }
    var hintEn = hintEnM[1];

    var hintM = /\bhint="((?:[^"\\]|\\.)*)"/.exec(line);
    if (!hintM) {
      throw new Error('第 ' + lineNo + ' 行：BLANK 指令缺 hint="..."\n  ' + raw);
    }
    var hint = hintM[1];

    return { id: id, level: level, hint: hint, hintEn: hintEn };
  }

  /* 逐行扫描 source，收集每个挖空块的位置 + 属性 + body。
     parse() 与 merge() 都基于它——「什么算一个挖空块」只判一次。

     返回 { rawLines, blocks }：
       rawLines  source.split('\n')，调用方各自决定怎么拼输出
       blocks    按出现顺序排列，每个 { id, level, hint, hintEn, body,
                 indent, openLine, closeLine, srcLine }
                 openLine / closeLine 是 0-based 行索引（分别指向
                 `# >>> BLANK` 和 `# <<< BLANK` 那两行本身）；
                 srcLine 是 openLine 的 1-based 版本，给报错用。 */
  function scanBlocks(source) {
    if (typeof source !== 'string') {
      throw new Error('parse(source) / merge(source, answers) 的 source 必须是字符串，收到：' + typeof source);
    }

    var rawLines = source.split('\n');
    var blocks = [];
    var seenIds = Object.create(null);
    var openAt = -1; // 非 -1 时，表示当前正处在一个挖空体内部，值是 >>> 指令行的 0-based 索引

    for (var i = 0; i < rawLines.length; i++) {
      var raw = rawLines[i];
      var trimmed = raw.trim();
      var lineNo = i + 1;

      if (trimmed.indexOf(OPEN_PREFIX) === 0) {
        if (openAt !== -1) {
          throw new Error(
            '第 ' + lineNo + ' 行：BLANK 指令嵌套——上一个 >>> BLANK（第 ' +
            (openAt + 1) + ' 行）还没有对应的 <<< BLANK\n  ' + raw
          );
        }
        openAt = i;
        continue;
      }

      if (trimmed === CLOSE_LINE) {
        if (openAt === -1) {
          throw new Error('第 ' + lineNo + ' 行：<<< BLANK 没有对应的 >>> BLANK\n  ' + raw);
        }

        var openLineRaw = rawLines[openAt];
        var attrs = parseAttrs(openLineRaw.trim(), openAt + 1, openLineRaw);

        if (seenIds[attrs.id]) {
          throw new Error(
            '第 ' + (openAt + 1) + ' 行：重复的 id="' + attrs.id + '"' +
            '（id 是编辑器和提示面板的锚点，重复会互相顶掉）\n  ' + openLineRaw
          );
        }
        seenIds[attrs.id] = true;

        var bodyStart = openAt + 1; // 0-based
        var bodyEnd = i; // 0-based，指向 <<< 那一行，不含
        if (bodyEnd === bodyStart) {
          throw new Error(
            '第 ' + (openAt + 1) + ' 行到第 ' + lineNo + ' 行：挖空体是空的' +
            '（>>> BLANK 和 <<< BLANK 之间没有任何代码）\n  ' + openLineRaw
          );
        }

        var bodyRawLines = rawLines.slice(bodyStart, bodyEnd);
        var body = bodyRawLines.join('\n');
        var indentMatch = /^[ \t]*/.exec(bodyRawLines[0]);
        var indent = indentMatch ? indentMatch[0] : '';

        blocks.push({
          id: attrs.id,
          level: attrs.level,
          hint: attrs.hint,
          hintEn: attrs.hintEn,
          body: body,
          indent: indent,
          openLine: openAt,
          closeLine: i,
          srcLine: openAt + 1
        });

        openAt = -1;
        continue;
      }
    }

    if (openAt !== -1) {
      throw new Error(
        '第 ' + (openAt + 1) + ' 行：>>> BLANK 未闭合——到文件结束都没有找到对应的 <<< BLANK\n  ' +
        rawLines[openAt]
      );
    }

    return { rawLines: rawLines, blocks: blocks };
  }

  /* parse(source) → { blanks, stripped, lineMap }

       blanks     挖空清单，按源码里出现的顺序排列：
                  { id, level, hint, hintEn, body, indent }
       stripped   练习模式该显示的源码：每个挖空块（两行指令 + 挖空体）
                  整体塌成一行 `indent + '___'`，别的行原样保留
       lineMap    与 stripped.split('\n') 逐行一一对应：
                  { kind: 'code', srcLine } 或
                  { kind: 'blank', blankId, srcLine }（srcLine 是原文里
                  `# >>> BLANK` 那一行的 1-based 行号） */
  function parse(source) {
    var scanned = scanBlocks(source);
    var rawLines = scanned.rawLines;
    var blocks = scanned.blocks;

    var outLines = [];
    var lineMap = [];
    var blockIdx = 0;
    var i = 0;

    while (i < rawLines.length) {
      var block = blocks[blockIdx];
      if (block && i === block.openLine) {
        outLines.push(block.indent + '___');
        lineMap.push({ kind: 'blank', blankId: block.id, srcLine: block.srcLine });
        i = block.closeLine + 1;
        blockIdx++;
        continue;
      }
      outLines.push(rawLines[i]);
      lineMap.push({ kind: 'code', srcLine: i + 1 });
      i++;
    }

    var blanks = blocks.map(function (b) {
      return { id: b.id, level: b.level, hint: b.hint, hintEn: b.hintEn, body: b.body, indent: b.indent };
    });

    return { blanks: blanks, stripped: outLines.join('\n'), lineMap: lineMap };
  }

  /* merge(source, answers) → string

     重新扫描一遍 source，把每一个「开标记 + 体 + 闭标记」整体替换成
     `answers[id]`（`answers` 里没有这个 id，或值是 null/undefined，则
     用这个挖空的原 body 兜底——同一句"参考答案就是源码本身"，用在这里
     就是"没交答案就当她原样保留了标准答案"）。别的行一律原样保留。
     返回值以原文的换行风格结尾：源码末尾有没有换行，这里就有没有——
     实现上从不额外拼接或丢弃 `source.split('\n')` 的末尾空字符串。

     `answers` 允许省略（undefined/null 当作 `{}`）：那样每个挖空都会
     退回自己的原 body，等价于「不挖空、原样还原」。 */
  function merge(source, answers) {
    var scanned = scanBlocks(source);
    var rawLines = scanned.rawLines;
    var blocks = scanned.blocks;
    var ans = (answers && typeof answers === 'object') ? answers : {};

    var outLines = [];
    var blockIdx = 0;
    var i = 0;

    while (i < rawLines.length) {
      var block = blocks[blockIdx];
      if (block && i === block.openLine) {
        var has = Object.prototype.hasOwnProperty.call(ans, block.id) && ans[block.id] != null;
        outLines.push(has ? ans[block.id] : block.body);
        i = block.closeLine + 1;
        blockIdx++;
        continue;
      }
      outLines.push(rawLines[i]);
      i++;
    }

    return outLines.join('\n');
  }

  return { parse: parse, merge: merge };
});
