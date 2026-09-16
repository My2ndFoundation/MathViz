/* 「挖空填空」（Python 子项目习题模式）的解析器：把一段带
   `# >>> BLANK … # <<< BLANK` 指令的教学 Python 源码，解析成挖空清单 +
   一份把每个挖空体换成占位符（`___`）的「占位版」源码；`merge()` 反过来把
   使用者填的答案（或缺省时的原文）拼回一份可运行的完整源码；`clean()`
   剥掉两条指令行、保留挖空体原文，给读模式 / 临摹模式 / 复制导出用。

   ---- 三个产出，分别对应三种模式，别混 ----

   同一份带指令的源码，三个函数各自回答一种「该给使用者看到什么」：

     stripped  （parse 的一部分）挖空体换成 `<indent>___`——挖空模式用，
               这是唯一一个「藏起答案」的产出。
     clean     （独立函数）指令行整条消失，挖空体原文原样保留——读模式
               直接显示的、临摹模式要她逐字敲的、"复制到 PyCharm 里跑"
               导出的都是它。**不剥指令行就直接拿裸 source 给这几个模式用
               是一个真实的缺口**：出题标记 `# >>> BLANK id=… hint="…"`
               会被摆在学习者眼前，读模式变成了读元数据，临摹模式还要她
               把中文提示原样敲一遍。
     merge     使用者填的答案（缺的 id 用原 body 兜底）替换指令块——挖空
               模式交卷时把答案拼回完整程序用。

   `clean` 不对指令行的内容做任何校验（比如 `hint=` 是不是纯 ASCII）——
   那是校验门（`source_ascii_check()`）的事：**它跳过指令行**，前提正是
   这里保证指令行永远不会流到任何渲染层。`clean` 只负责把整条指令行
   （连同它可能带的中文 `hint="..."`）一起删掉，从不检查、不改写留下来
   的挖空体或别的代码行——哪怕挖空体本身写了非 ASCII 字符，那也不是这个
   函数的判断范围。

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

   属性解析顺序上有两层陷阱，都在 `parseAttrs` 里体现为「先取带引号的两个
   属性、并把它们从这一行里摘掉，再在剩下的文本上取裸值属性」这个顺序：

   1. **必须先测 `hintEn` 再测 `hint`**：两个正则各自锚定到自己的闭引号，
      顺序颠倒目前构造不出真实的误判用例，但这是上一份设计（`chess`）里
      留下来的明确告诫，成本为零、收益是以防万一，所以照做。
   2. **裸值正则会从引号文本里咬到东西——这个是真的会发生**（初版实现在
      评审里被抓到）：`id=` / `level=` 用 `\S+` 读到下一个空白为止，
      不认识引号。如果直接对整行跑 `/\bid=(\S+)/`，而某条 `hint="..."` 的
      提示文案里恰好写了「参考 id=5 的场景」这种话，且 `hint=` 排在真正
      的 `id=` 前面，正则会先在引号内部找到那个假的 `id=5`，把提示文案
      的一截读成 id 的值——不抛、不报，静默地把错误的 id 灌进挖空清单。
      属性顺序在这套指令格式里本就不作要求，所以「id 排在 hint 后面」是
      合法输入，不能指望「id 总在前面所以先扫到真的」这种侥幸。
      解法不是「找 `hint=` 之前的部分」（那在 id 排在 hint 后面时直接找
      不到 id），而是**先把两段带引号的文本从行里整体摘掉，再在干净的
      剩余文本上找裸值**——摘掉之后，裸值正则不可能再看到任何引号内部的
      文字，跟属性顺序无关。

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
   （原文的 1-based 行号），给错误信息 / 高亮跳转用。`blanks[].line` 是
   同一件事的另一半：那个挖空在 `stripped.split('\n')` 里占的 0-based
   行号——`lineMap` 是「拿一行去问它是谁」，`line` 是反过来「拿一个挖空
   去问它在哪一行」，两个方向的锚点都得有，不然编辑器只能自己再扫一遍
   `lineMap` 去反查，等于把这个模块该做的事又做了一遍。

   ---- `DIRECTIVE_OPEN` / `DIRECTIVE_CLOSE` 是导出的公开成员 ----

   两个正则常量导出为 `Exercise.DIRECTIVE_OPEN` / `Exercise.DIRECTIVE_CLOSE`
   ——不是内部实现细节，是接口总表点名的公开成员（T12/T14 会直接用它们
   识别一行是不是指令行，不经过 `parse()`）。**扫描逻辑必须真的调用这两个
   正则去匹配**，不能内部另开一份字符串前缀判断——那样导出的正则会变成
   一份跟实际匹配行为不一致的假文档：字面量前缀判断只认恰好一个空格的
   `"# >>> BLANK"`，而 `DIRECTIVE_OPEN` 允许 `#`、`>>>`、`BLANK` 之间有
   任意空白（`\s*`），两者不是同一个判断，必须只留一份。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Exercise = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* 公开导出（接口总表），扫描逻辑也真的用它们匹配——见文件头
     "DIRECTIVE_OPEN / DIRECTIVE_CLOSE 是导出的公开成员" 一节。
     DIRECTIVE_OPEN 的捕获组 1 是 "BLANK" 之后、这一行剩下的全部文本
     （即四个属性所在的那一段），scanBlocks 直接把它交给 parseAttrs。 */
  var DIRECTIVE_OPEN = /^\s*#\s*>>>\s*BLANK\s+(.*)$/;
  var DIRECTIVE_CLOSE = /^\s*#\s*<<<\s*BLANK\s*$/;

  /* 解析一条 BLANK 指令的属性段（`DIRECTIVE_OPEN` 捕获组 1，即 "BLANK"
     之后的文本），返回 { id, level, hint, hintEn }；四个属性缺任何一个
     都抛，消息里点名缺的是哪一个。
     attrText 是待解析的属性文本；lineNo 是指令所在行的 1-based 行号；
     raw 是该行未处理的原文——后两者只为了让报错能一眼定位。

     顺序：先取 hintEn，从文本里摘掉；再取 hint，从摘掉 hintEn 之后的
     文本里摘掉；最后在两段引号文本都摘干净的剩余文本上取 id / level 的
     裸值。这个顺序不是随便挑的——见文件头"属性解析顺序上有两层陷阱"。 */
  function parseAttrs(attrText, lineNo, raw) {
    var hintEnM = /\bhintEn="((?:[^"\\]|\\.)*)"/.exec(attrText);
    if (!hintEnM) {
      throw new Error('第 ' + lineNo + ' 行：BLANK 指令缺 hintEn="..."\n  ' + raw);
    }
    var hintEn = hintEnM[1];
    var afterHintEn = attrText.slice(0, hintEnM.index) + attrText.slice(hintEnM.index + hintEnM[0].length);

    var hintM = /\bhint="((?:[^"\\]|\\.)*)"/.exec(afterHintEn);
    if (!hintM) {
      throw new Error('第 ' + lineNo + ' 行：BLANK 指令缺 hint="..."\n  ' + raw);
    }
    var hint = hintM[1];
    var bareText = afterHintEn.slice(0, hintM.index) + afterHintEn.slice(hintM.index + hintM[0].length);

    var idM = /\bid=(\S+)/.exec(bareText);
    if (!idM) {
      throw new Error('第 ' + lineNo + ' 行：BLANK 指令缺 id=\n  ' + raw);
    }
    var id = idM[1];

    var levelM = /\blevel=(\S+)/.exec(bareText);
    if (!levelM) {
      throw new Error('第 ' + lineNo + ' 行：BLANK 指令缺 level=\n  ' + raw);
    }
    var level = Number(levelM[1]);
    if (!(level === 1 || level === 2 || level === 3)) {
      throw new Error(
        '第 ' + lineNo + ' 行：level 必须是 1、2 或 3，收到 "' + levelM[1] + '"\n  ' + raw
      );
    }

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
      var lineNo = i + 1;
      var openMatch = DIRECTIVE_OPEN.exec(raw);

      if (openMatch) {
        if (openAt !== -1) {
          throw new Error(
            '第 ' + lineNo + ' 行：BLANK 指令嵌套——上一个 >>> BLANK（第 ' +
            (openAt + 1) + ' 行）还没有对应的 <<< BLANK\n  ' + raw
          );
        }
        openAt = i;
        continue;
      }

      if (DIRECTIVE_CLOSE.test(raw)) {
        if (openAt === -1) {
          throw new Error('第 ' + lineNo + ' 行：<<< BLANK 没有对应的 >>> BLANK\n  ' + raw);
        }

        var openLineRaw = rawLines[openAt];
        var openAttrText = DIRECTIVE_OPEN.exec(openLineRaw)[1];
        var attrs = parseAttrs(openAttrText, openAt + 1, openLineRaw);

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
                  { id, level, hint, hintEn, body, indent, line }
                  line = 该空在 stripped 里占的行号（0-based）——
                  跟 lineMap 是反过来的两个方向：lineMap 拿一行去问它是
                  哪个空，line 拿一个空去问它在哪一行
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
    var blockLines = []; // blockLines[k] = blocks[k] 在 outLines 里落脚的 0-based 行号
    var blockIdx = 0;
    var i = 0;

    while (i < rawLines.length) {
      var block = blocks[blockIdx];
      if (block && i === block.openLine) {
        blockLines.push(outLines.length);
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

    var blanks = blocks.map(function (b, idx) {
      return {
        id: b.id, level: b.level, hint: b.hint, hintEn: b.hintEn,
        body: b.body, indent: b.indent, line: blockLines[idx]
      };
    });

    return { blanks: blanks, stripped: outLines.join('\n'), lineMap: lineMap };
  }

  /* clean(source) → string

     剥掉两种 BLANK 指令行（`# >>> BLANK ...` 与 `# <<< BLANK`），挖空体
     原文照抄，别的行一律照抄——读模式 / 临摹模式 / "复制出去跑" 用的都是
     这份。跟 `stripped`（挖空体换成占位符）互为对照：那个藏答案，这个
     只藏出题标记本身。

     基于同一个 `scanBlocks`：一个块只贡献它的 `openLine` 和 `closeLine`
     两个行号需要跳过，块内的 body 行既不是 `openLine` 也不是
     `closeLine`，自然落进"别的行一律照抄"那一支，不需要专门再处理一次
     ——不必、也不该为 `clean` 另起一个扫描器（同一段"什么算指令行"的
     判断分成两份，迟早分岔，`parse`/`merge` 已经吃过一次这个教训）。

     没有指令的源码：`blocks` 是空数组，循环里 `block` 恒为 `undefined`，
     每一行原样收进 `outLines`——等价于 `outLines === rawLines`，
     `clean(source) === source` 逐字节成立，跟 `parse().stripped` 在同样
     输入下的行为完全对称。 */
  function clean(source) {
    var scanned = scanBlocks(source);
    var rawLines = scanned.rawLines;
    var blocks = scanned.blocks;

    var outLines = [];
    var blockIdx = 0;
    var i = 0;

    while (i < rawLines.length) {
      var block = blocks[blockIdx];
      if (block && i === block.openLine) {
        i++; // 跳过 >>> 那一行本身，块内的 body 行紧接着照常收进 outLines
        continue;
      }
      if (block && i === block.closeLine) {
        blockIdx++; // 跳过 <<< 那一行本身，切到下一个块
        i++;
        continue;
      }
      outLines.push(rawLines[i]);
      i++;
    }

    return outLines.join('\n');
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

  return {
    parse: parse,
    merge: merge,
    clean: clean,
    DIRECTIVE_OPEN: DIRECTIVE_OPEN,
    DIRECTIVE_CLOSE: DIRECTIVE_CLOSE
  };
});
