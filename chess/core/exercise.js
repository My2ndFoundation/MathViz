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
     undefined。

     「不支持转义」有两种落法，差别很大：静默截断，或者当场抛。**这里选
     抛**——文件头写的是「找不到就抛，不猜」，一段少了半句的提示文案属于
     「猜」的一种，而且是最难发现的那一种（页面上只是少几个字，不报错）。
     所以：如果提取出来的值里**还留着**字面双引号，说明这一行的引号配对
     跟作者想的不是一回事，当场抛，让作者自己把引号去掉。

     **已知缺口（本轮裁定范围之外，见 task-2-report.md）**：这条哨兵只挡得住
     「字面引号后面没有空白」那一形。如果字面引号后面紧跟空白、而且这个属性
     恰好是行内最后一个（`… hint="他说" 你好的场景"`），token 会在那个引号处
     收尾，后面那截变成一个没人认领的 token 被丢掉——提取出来的值是「他说」，
     里面一个引号都没有，哨兵看不见它。真正封住它需要另一条规则：
     `>>> BLANK` 之后的每个 token 都必须是已知的 `key=` 形状，否则抛。
     `exercise.test.js` 里有一条断言把这个现状钉住了。 */
  function scanQuoted(line, key) {
    const marker = key + '="';
    const tokens = tokenize(line);
    for (let t = 0; t < tokens.length; t++) {
      const tok = tokens[t];
      if (tok.indexOf(marker) === 0 && tok.length > marker.length && tok[tok.length - 1] === '"') {
        const value = tok.slice(marker.length, tok.length - 1);
        if (value.indexOf('"') !== -1) {
          throw new Error(
            key + '="..." 的值里出现了字面双引号，而这里不支持转义：' +
            '"' + value + '"\n  引号配对跟你想的不是一回事——把文案里的英文引号' +
            '换成别的符号（比如「」），或者拆成两句。'
          );
        }
        return value;
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

  /* ================= judge：比行为，不比文本 =================

     「错了」是没用的反馈。两个版本的完整轨迹都在手上，所以这里做的是别的
     事：找出她的版本和参考版本**行为分歧的第一步**，把两条轨道各自的步号
     一起报出来，让调试器能直接跳过去两边并排显示。她看到的是「跑到第 47
     步为止你和参考完全一致，第 48 步参考认为这一格被攻击、你的版本认为它
     安全」，而不是一个红叉。

     ---- 比什么 ----

     三种可观测行为，按「反馈有多有用」排序，先命中的先报：

       1. boardOps —— 展平成一条棋盘事件流，逐条对齐比。它能给出步号，
          所以放在最前面。
       2. counters —— 指定的几个变量的**末值**。
       3. result   —— 整个程序的返回值。

     源码文本一个字都不比：等价改写（把 `a && b` 拆成两条 if）步数会不同，
     但棋盘事件、计数器、返回值一模一样，这必须判对。实测：拆成三条 if 的
     版本 3,014 步 vs 参考 2,621 步，棋盘事件两边都是 599 条且逐条相同。

     ---- 三个开关必须逐题显式声明 ----

     `check` 的 result / boardOps / counters 三个键一个都不许有默认值。
     一个默认成 false 的开关会把该抓的分歧放过去，一个默认成 true 的开关会
     把一道根本不产生棋盘事件的题判成永远错——两种都是「悄悄地」出错。
     三项全关也抛：那样的判定永远判对，等于没判。

     ---- 截断：null 不许变成布尔值 ----

     步数上限撞到了，就不是「跑完了」，是「不知道」。所以：

       · 已经在**比过的那一段**里发现的分歧，照常判 fail —— 截断不能把
         已经发生的分歧变没。
       · counters 和 result 是**末值**，任一边截断了，它们就根本不是末值
         （实测：限 200 步时 solutions 是 1、result 是 undefined，跟参考的
         10 差得远，但这不是分歧，只是还没跑到）。所以一旦有截断，这两项
         直接不比。
       · 棋盘事件流长度不同，只有在**短的那一边没被截断**时才算分歧；短的
         那一边被截断了，说明它只是还没写到，不能算。
       · 没找到分歧、又有任一边截断 → `unknown`。

     `unknown` 不是 `fail`。调用方要把它显示成「跑不完，没法判」，绝不能
     显示成「错」。 */

  /* 把整条 trace 的 boardOps 展平成一条事件流。
     只带 kind / sq / to 三个字段进来比 —— `from` 是解释器用影子盘算出来的
     前值，是派生量：同一串操作在不同执行路径下算出的 from 可能不同，拿它
     判定会把行为相同的两个版本判成不同。step 只用来报位置，不参与比较。 */
  function flattenBoardOps(trace) {
    const flat = [];
    for (let i = 0; i < trace.length; i++) {
      const ops = trace[i] && trace[i].boardOps;
      if (!ops) continue;
      for (let j = 0; j < ops.length; j++) {
        flat.push({ step: i, kind: ops[j].kind, sq: ops[j].sq, to: ops[j].to });
      }
    }
    return flat;
  }

  function sameBoardOp(a, b) {
    return a.kind === b.kind && a.sq === b.sq && a.to === b.to;
  }

  /* 某个变量的末值：遍历 trace 的 varDelta，取这个名字最后一次的 `to`。
     从头到尾没出现过 → `{ value: null, step: null }`，**不是 0** —— null 说的
     是「不知道」，0 说的是「数出来是零」，把前者写成后者就是在编造事实。 */
  function lastCounter(trace, name) {
    let value = null;
    let step = null;
    for (let i = 0; i < trace.length; i++) {
      const deltas = trace[i] && trace[i].varDelta;
      if (!deltas) continue;
      for (let j = 0; j < deltas.length; j++) {
        if (deltas[j].name === name) { value = deltas[j].to; step = i; }
      }
    }
    return { value: value, step: step };
  }

  /* 结构化相等。计数器和返回值大多是数字，但没道理假设它一定是——数组和
     对象按逐项比，别的按 === 比（NaN 跟 NaN 算相等：两边都「不是数」）。 */
  function sameValue(a, b) {
    if (a === b) return true;
    if (typeof a === 'number' && typeof b === 'number' && a !== a && b !== b) return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    const aIsArr = Array.isArray(a), bIsArr = Array.isArray(b);
    if (aIsArr !== bIsArr) return false;
    if (aIsArr) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (!sameValue(a[i], b[i])) return false;
      return true;
    }
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (let i = 0; i < ka.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(b, ka[i])) return false;
      if (!sameValue(a[ka[i]], b[ka[i]])) return false;
    }
    return true;
  }

  /* 最后一步的 0-based 步号；空轨迹给 null（没有可跳过去的地方）。 */
  function lastStep(trace) {
    return trace.length ? trace.length - 1 : null;
  }

  function assertRun(run, which) {
    if (!run || typeof run !== 'object' || !Array.isArray(run.trace)) {
      throw new Error(
        'judge(refRun, herRun, check) 的 ' + which + ' 不是一次 Interp.run() 的返回值' +
        '（要有 trace 数组），收到：' + (run === null ? 'null' : typeof run)
      );
    }
  }

  function assertCheck(check) {
    if (!check || typeof check !== 'object' || Array.isArray(check)) {
      throw new Error(
        'judge(refRun, herRun, check) 少了 check —— 比哪几样东西没有默认值，' +
        '必须逐题写明 { result, boardOps, counters }'
      );
    }
    if (typeof check.result !== 'boolean') {
      throw new Error(
        'check.result 必须显式写成 true 或 false（不接受「真值」），收到：' +
        JSON.stringify(check.result) + '\n  没有默认值：默认开会把不该比的题判错，' +
        '默认关会把该抓的分歧放过去。'
      );
    }
    if (typeof check.boardOps !== 'boolean') {
      throw new Error(
        'check.boardOps 必须显式写成 true 或 false（不接受「真值」），收到：' +
        JSON.stringify(check.boardOps)
      );
    }
    if (!Array.isArray(check.counters)) {
      throw new Error(
        'check.counters 必须是一个数组（不比任何计数器就写 []），收到：' +
        JSON.stringify(check.counters)
      );
    }
    for (let i = 0; i < check.counters.length; i++) {
      const name = check.counters[i];
      if (typeof name !== 'string' || name === '') {
        throw new Error(
          'check.counters[' + i + '] 不是一个非空的变量名，收到：' + JSON.stringify(name)
        );
      }
    }
    if (check.result === false && check.boardOps === false && check.counters.length === 0) {
      throw new Error(
        'check 三项全关 —— 这样的判定永远判对，等于没判。' +
        '至少要比 result / boardOps / counters 里的一样。'
      );
    }
  }

  function divergence(kind, refStep, herStep, opIndex, ref, her) {
    return { kind: kind, refStep: refStep, herStep: herStep, opIndex: opIndex, ref: ref, her: her };
  }

  /* judge(refRun, herRun, check) → { status, divergence }

       status ∈ 'pass' | 'fail' | 'unknown'
       divergence = null（pass / unknown）或 { kind, refStep, herStep, opIndex, ref, her }
         kind    ∈ 'boardOps' | 'counters' | 'result'
         refStep / herStep  两条轨迹**各自**的 0-based 步号（同一件事她可能
                            发生在第 60 步、参考在第 48 步，所以两个都报；
                            调用方要用它们把两条轨道各自定位，而不是拿一个
                            游标同时推两条）。某一侧根本没有对应位置时是 null。
         opIndex 展平后的棋盘事件序号（kind === 'boardOps' 时是数字，否则 null）
         ref / her 那一处两边的取值，供 UI 并排显示：
                   boardOps → { step, kind, sq, to }（某一侧没有就是 null）
                   counters → { name, value }
                   result   → 返回值本身 */
  function judge(refRun, herRun, check) {
    assertRun(refRun, 'refRun');
    assertRun(herRun, 'herRun');
    assertCheck(check);

    const refTrunc = refRun.trace.truncated === true;
    const herTrunc = herRun.trace.truncated === true;
    const anyTrunc = refTrunc || herTrunc;

    // ---- 1. 棋盘事件（最先比：它能给出步号，反馈最有用）
    if (check.boardOps) {
      const refOps = flattenBoardOps(refRun.trace);
      const herOps = flattenBoardOps(herRun.trace);
      const common = Math.min(refOps.length, herOps.length);
      for (let i = 0; i < common; i++) {
        if (!sameBoardOp(refOps[i], herOps[i])) {
          return {
            status: 'fail',
            divergence: divergence('boardOps', refOps[i].step, herOps[i].step, i, refOps[i], herOps[i]),
          };
        }
      }
      /* 长度不同：只有当**短的那一边跑完了**才是分歧。短的一边被截断，
         说明它只是还没写到，不能拿来判。 */
      if (refOps.length !== herOps.length) {
        const shortIsRef = refOps.length < herOps.length;
        const shortTrunc = shortIsRef ? refTrunc : herTrunc;
        if (!shortTrunc) {
          const r = refOps.length > common ? refOps[common] : null;
          const h = herOps.length > common ? herOps[common] : null;
          return {
            status: 'fail',
            divergence: divergence(
              'boardOps', r ? r.step : null, h ? h.step : null, common, r, h
            ),
          };
        }
      }
    }

    // ---- 2. 计数器末值（截断时根本不是末值，整项不比）
    if (!anyTrunc) {
      for (let i = 0; i < check.counters.length; i++) {
        const name = check.counters[i];
        const r = lastCounter(refRun.trace, name);
        const h = lastCounter(herRun.trace, name);
        if (!sameValue(r.value, h.value)) {
          return {
            status: 'fail',
            divergence: divergence(
              'counters', r.step, h.step, null,
              { name: name, value: r.value }, { name: name, value: h.value }
            ),
          };
        }
      }
    }

    // ---- 3. 返回值（同上，截断时不比）
    if (check.result && !anyTrunc) {
      if (!sameValue(refRun.result, herRun.result)) {
        return {
          status: 'fail',
          divergence: divergence(
            'result', lastStep(refRun.trace), lastStep(herRun.trace), null,
            refRun.result, herRun.result
          ),
        };
      }
    }

    /* 没找到分歧。任一边没跑完 → 'unknown'：不知道就是不知道，不许
       悄悄变成「对」，更不许变成「错」。 */
    if (anyTrunc) return { status: 'unknown', divergence: null };
    return { status: 'pass', divergence: null };
  }

  return { parse: parse, judge: judge };
});
