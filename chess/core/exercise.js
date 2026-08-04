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

     **这条哨兵只挡得住 C 形**：字面引号后面没有空白，整段被 `tokenize`
     吞成一个 token，值里残留着字面引号，靠上面那个 `indexOf('"')` 检查抓。
     字面引号后面紧跟空白、且该属性恰好是行内最后一个的那一形（A 形，
     `… hint="他说" 你好的场景"`），token 会在那个引号处收尾，后面那截变成
     一个没人认领的 token——提取出来的值是「他说」，一个引号都没有，这条
     哨兵看不见它。A 形由下面的 `assertKnownTokens` 关上：那个没人认领的
     token 不是任何已知属性名开头，会在那里被当场抓住。两条哨兵互补、各管
     一形，缺一形就漏——完整对照见 `assertKnownTokens` 自己的注释。 */
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

  /* 指令行上允许出现的全部属性名。它同时是下面那条白名单哨兵的依据。 */
  const KNOWN_KEYS = ['id', 'level', 'fill', 'hint', 'hintEn'];

  /* 白名单哨兵：`// >>> BLANK` 之后的每个 token 都必须是 `<已知属性名>=…`
     的形状，否则抛。

     这是跟 `scanQuoted` 那条哨兵**互补**的另一半，两条都必须留着：

       · `scanQuoted` 那条管「token 里残留字面双引号」——引号后面没有空白，
         整段被吞成一个 token，值里带着引号。
       · 这一条管「引号后面紧跟空白」——token 在那个引号处收尾，后面那截
         变成一个没人认领的 token。值里一个引号都没有，那条看不见它；
         而这里看得见：多出来的那个 token 不是任何一个已知属性名开头。
         `… hint="他说" 你好的场景"` 正是这一形，从前会被无声截断成
         「他说」，现在当场抛。

     不会误伤合法输入：带引号的属性哪怕值里全是空白和符号，`tokenize` 也会
     整段吞成一个 token（`fill="for (let i = 0; i < n; i++) {}"` 验过）；
     `hintEn=` 与 `hint=` 也不会前缀互撞——`hintEn="X"` 的开头是 `hintEn=`，
     不是 `hint=`。 */
  function assertKnownTokens(line, lineNo, raw) {
    const tokens = tokenize(line.slice(OPEN_PREFIX.length));
    for (let t = 0; t < tokens.length; t++) {
      let known = false;
      for (let k = 0; k < KNOWN_KEYS.length; k++) {
        if (tokens[t].indexOf(KNOWN_KEYS[k] + '=') === 0) { known = true; break; }
      }
      if (!known) {
        throw new Error(
          '第 ' + lineNo + ' 行：BLANK 指令里有一段认不出来的内容 "' + tokens[t] + '"' +
          '\n  指令行上只允许 ' + KNOWN_KEYS.join('= / ') + '= 这五个属性。' +
          '最常见的原因是某个引号值里写了字面双引号，把那一段切断了。\n  ' + raw
        );
      }
    }
  }

  /* 解析一行 `// >>> BLANK ...` 指令，返回属性对象；任何一条缺失都抛。
     lineNo 是这一行的 1-based 行号，raw 是这一行的原文——都是为了让
     报错能一眼定位。 */
  function parseOpenLine(line, lineNo, raw) {
    assertKnownTokens(line, lineNo, raw);
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
     事：把两条轨道各自的步号一起报出来，让调试器能直接跳过去两边并排显示。
     她看到的是「跑到第 47 步为止你和参考完全一致，第 48 步参考认为这一格被
     攻击、你的版本认为它安全」，而不是一个红叉。

     **「分歧的第一步」这句话只对 `kind === 'boardOps'` 成立**，别把它当成三种
     分歧的共同承诺——`counters` 和 `result` 比的是**末值**，本来就没有「第一步」
     可言，它们的 `refStep`/`herStep` 是「能跳过去的合理位置」而不是「分道扬镳
     的位置」。逐 kind 的精确定义写在 `judge` 自己的注释里，UI 上的措辞要照那份
     写，别一律说成「分歧的那一步」。

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
     只带 kind / sq / to 三个字段进来比。**丢掉 `from` 的理由是它提供不出
     任何新信息**，不是「它会造成假分歧」：`from` 完全由解释器的影子盘决定，
     而影子盘是「初始空盘 + 前缀 (kind, sq, to) 序列」的纯函数——前缀相同则
     `from` 必然相同，所以在逐条对齐比较里它永远只会跟着 `(kind, sq, to)` 一起
     相等或一起不等。把它带进来只会让比较变慢、让并排显示多一列噪声。
     （实测：参考版与等价改写版把 `from` 一起比，599 条仍逐条一致。）
     step 只用来报位置，不参与比较。 */
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
     返回 `{ found, value, step }`。

     **`found` 必须跟 `value === null` 分开**：从头到尾没出现过 → `found:false`、
     `value:null`，而 null 说的是「不知道」，不是 0（0 说的是「数出来是零」，
     把前者写成后者就是在编造事实）。两边都 `found:false` 时**绝不能判成相等**
     ——那会让一个名字打错的计数器变成「永远判对」，比 check 三项全关还糟：
     全关至少是显式写下来的，打错字是静默的。谁来管这件事见 judge。 */
  function lastCounter(trace, name) {
    let found = false;
    let value = null;
    let step = null;
    for (let i = 0; i < trace.length; i++) {
      const deltas = trace[i] && trace[i].varDelta;
      if (!deltas) continue;
      for (let j = 0; j < deltas.length; j++) {
        if (deltas[j].name === name) { found = true; value = deltas[j].to; step = i; }
      }
    }
    return { found: found, value: value, step: step };
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
         opIndex 展平后的棋盘事件序号（kind === 'boardOps' 时是数字，否则 null）

       `refStep` / `herStep` 永远是两条轨迹**各自**的 0-based 步号（同一件事她
       可能发生在第 60 步、参考在第 48 步，所以两个都报；调用方要用它们把两条
       轨道**各自**定位，而不是拿一个游标同时推两条）。某一侧根本没有对应位置
       时是 null。

       **但这两个步号「是什么」逐 kind 不同，UI 措辞必须跟着分**：

         kind        refStep / herStep 的含义            能不能说成「分歧的那一步」
         ----------  -----------------------------------  ------------------------
         'boardOps'  两边第一条对不上的棋盘事件所在的步    **能** —— 这是真正的第一处分歧
         'counters'  两边**最后一次给该计数器赋值**的步    **不能** —— 比的是末值，没有
                                                           「第一步」；这只是「她最后一次
                                                           数数的地方 / 参考最后一次数数的
                                                           地方」，两边并排看得通
         'result'    两边各自的**末步**（trace.length-1）  **不能** —— 只是「能跳过去的
                                                           位置」，返回值不发生在某一步

       想要 counters 也给出真正的第一处分歧，得改成比取值序列而不是末值——
       那是另一件事（会把「在不同位置累加、末值相同」的合法等价改写判错），
       没有做。**在做出来之前，别在 UI 上把 counters/result 的步号说成
       「分歧的那一步」。**

         ref / her 那一处两边的取值，供 UI 并排显示：
                   boardOps → { step, kind, sq, to }（某一侧没有就是 null）
                   counters → { name, value }（她那边从没出现过这个名字时 value 是 null）
                   result   → 返回值本身 */
  function judge(refRun, herRun, check) {
    assertRun(refRun, 'refRun');
    assertRun(herRun, 'herRun');
    assertCheck(check);

    const refTrunc = refRun.trace.truncated === true;
    const herTrunc = herRun.trace.truncated === true;
    const anyTrunc = refTrunc || herTrunc;

    /* ---- 0. 计数器名字先对着参考轨迹核一遍（参考侧是权威）

       名字在参考轨迹里从未出现，就不是「两边都不知道，算相等」——那是**出题
       配置错误**：这条判定不管比什么都会判对，等于没判，而且方向比 check 三项
       全关更糟（全关是显式写下来的，打错一个字母是静默的）。按约束 6 大声失败。

       放在所有比较**之前**，不放在 counters 那一段里：配置错误不应该因为
       boardOps 恰好先分歧了就被吞掉。参考侧自己被截断时不查——那时候「没出现
       过」也可能只是还没跑到，分不清就不下结论。 */
    if (!refTrunc) {
      for (let i = 0; i < check.counters.length; i++) {
        if (!lastCounter(refRun.trace, check.counters[i]).found) {
          throw new Error(
            'check.counters 里的 "' + check.counters[i] + '" 在参考轨迹里从未出现过。' +
            '\n  参考侧是权威：它没有这个变量名，说明这一题的判定配置写错了' +
            '（多半是拼错）。放着不管的话，这条判定会永远判对。'
          );
        }
      }
    }

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
        /* 参考里有、她那边一次都没出现（多半是把变量改名了）：这是一处**真
           分歧**，不是「两边都不知道，算相等」。她那一侧没有可跳过去的位置，
           herStep 与 value 都是 null。 */
        if (!h.found || !sameValue(r.value, h.value)) {
          return {
            status: 'fail',
            divergence: divergence(
              'counters', r.step, h.step, null,
              { name: name, value: r.value },
              { name: name, value: h.found ? h.value : null }
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

  /* ================= hintAt：分级提示，逐级给，不一次给完 =================

     规格 §2.9：文字提示 → 点名涉及了哪几个变量 → 参考答案的结构骨架（保留
     控制流、挖掉表达式）→ 完整答案。**任何时候都可以直接跳到第 4 级看
     答案**——这是自学工具，不是考试，卡住而推进不了只会让人把页面关掉。

     `level` 是提示阶梯（1..4），跟 `Blank.level` 那个 1..3 的**难度**不是
     同一件事——同一个挖空可以是难度 1、但提示已经要到第 4 级；调用方自己
     记着「这道题现在点到第几级」，这里不替它记。

     第 3 级的骨架是**机械生成**的，不是另写一份简化答案：跟「参考答案
     就是源码本身」是同一条纪律——另写一份就会有第二份东西可以跟源码漂移
     （Task 1 的执行者就在自己头注释里踩过这条线，见文件头）。生成规则：
     把 `if (…)` / `while (…)` / `for (…)` 括号里的内容、以及 `return` 和
     `=` 右边的表达式，全部换成 `…`，其余原样保留——缩进、大括号、分号都
     不动，控制流的形状还在，只有「算出什么」被挖掉了。

     第 3 级和第 4 级的**正文是源码**，中英两侧的正文完全相同，两侧唯一的
     差别是正文前面那句说明用的语言。第 1 级直接读 `blank.hint.{zh,en}`——
     那本来就是出题者分别写好的两句话，不需要也不应该合成一份。第 2 级的
     变量清单是从代码里扫出来的标识符，本身也不是要翻译的文本，中英只是
     前面的引导句不同。 */

  const HINT_L2_KEYWORDS = [
    'if', 'else', 'for', 'while', 'return', 'const', 'let', 'function',
    'true', 'false', 'null',
  ];

  /* 把字符串/模板字面量的引号和内容整段换成等长空格，其余字符原样保留
     （保留原始下标和总长度，只是不需要靠它定位什么，只是图个简单）。
     `variablesIn` 靠它把标识符正则挡在字符串外——`mark(sq, "back")` 的
     `"back"` 是传给宿主的一个字面量字符串，不是代码里的名字，混进变量
     清单会把「这段代码用到了 back 这个变量」这种假象喂给使用者。跟
     `matchParen`/`skeletonOf` 里跳引号的写法同一个思路（遇到引号找下一个
     同符号收尾），不单独另起一套转义规则——这些挖空体都是算法源码，不会
     有转义引号。 */
  function blankOutQuoted(str) {
    let out = '';
    let i = 0;
    while (i < str.length) {
      const c = str[i];
      if (c === '"' || c === "'" || c === '`') {
        const quote = c;
        out += ' ';
        i++;
        while (i < str.length && str[i] !== quote) { out += ' '; i++; }
        if (i < str.length) { out += ' '; i++; }
        continue;
      }
      out += c;
      i++;
    }
    return out;
  }

  /* 第 2 级：挖空体里出现过的变量名——扫出所有标识符，去掉 ES 关键字表，
     去重，保留首次出现的顺序（顺序本身是线索：先出现的往往是先读到的
     那一个）。扫描前先用 `blankOutQuoted` 把字符串字面量的内容挖掉，
     不然 `mark(sq, "back")` 这类调用会把宿主桥接用的状态字符串
     （"back"/"cut"/"ok"……）当成变量列出来——那不是代码里的名字，是传给
     宿主的一个字面量。不区分「这是个变量」还是「这是个函数名/属性名」——
     分级提示只是引导使用者去读代码里的哪几个名字，不是做静态类型分析。 */
  function variablesIn(body) {
    const seen = Object.create(null);
    const names = [];
    const re = /[A-Za-z_$][A-Za-z0-9_$]*/g;
    const scanned = blankOutQuoted(body);
    let m;
    while ((m = re.exec(scanned)) !== null) {
      const name = m[0];
      if (HINT_L2_KEYWORDS.indexOf(name) !== -1) continue;
      if (seen[name]) continue;
      seen[name] = true;
      names.push(name);
    }
    return names;
  }

  /* 找 `str[openIdx]`（必须是 '('）对应的那个 ')'，跳过字符串字面量内部的
     括号（挖空体是算法源码，字符串里不会有转义引号，遇到引号就找下一个
     同符号收尾即可）。找不到配对返回 -1——正常来自 `parse()` 的挖空体
     语法完整，不会走到这条分支，这里只是不让畸形输入死循环。 */
  function matchParen(str, openIdx) {
    let depth = 0;
    for (let i = openIdx; i < str.length; i++) {
      const c = str[i];
      if (c === '"' || c === "'" || c === '`') {
        const quote = c;
        i++;
        while (i < str.length && str[i] !== quote) i++;
        continue;
      }
      if (c === '(') depth++;
      else if (c === ')') {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  /* 从 idx 开始找这条语句结束的分号——跳过嵌套的 `(` `[` `{`，因为它们内部
     可能藏着别的分号（比如数组字面量里的一个匿名函数）。找不到分号收尾
     就到字符串末尾（比如挖空体最后一行没写分号）。 */
  function statementEnd(str, idx) {
    let depth = 0;
    for (let i = idx; i < str.length; i++) {
      const c = str[i];
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') { if (depth > 0) depth--; }
      else if (c === ';' && depth === 0) return i;
    }
    return str.length;
  }

  /* 第 3 级：结构骨架，逐字符扫过挖空体机械生成——不调用任何解析器，只是
     一台「认得几个关键字」的抄写机：遇到 `if`/`while`/`for` 就把它后面那对
     括号里的内容整体换成 `…`；遇到 `return`，或者一个真正表示赋值的 `=`
     （排除 `==` `===` `!=` `<=` `>=` `=>`，也排除 `+=` 这类复合赋值的第二
     个字符——那不是这里要认的「裸 =」），就把它右边到语句结尾的内容换成
     `…`；其余字符原样照抄。

     之所以逐字符扫而不是几条正则拼起来：`if (…)` 的括号可能嵌套
     （`if (a(b))`），正则处理不了任意深度的嵌套括号，手写的
     `matchParen`/`statementEnd` 用深度计数就能正确处理。 */
  function skeletonOf(body) {
    let out = '';
    let i = 0;
    const n = body.length;
    const idRe = /^[A-Za-z_$][A-Za-z0-9_$]*/;

    while (i < n) {
      const idMatch = idRe.exec(body.slice(i));

      if (idMatch && (idMatch[0] === 'if' || idMatch[0] === 'while' || idMatch[0] === 'for')) {
        out += idMatch[0];
        i += idMatch[0].length;
        let j = i;
        while (j < n && /\s/.test(body[j])) j++;
        out += body.slice(i, j);
        i = j;
        if (body[i] === '(') {
          const close = matchParen(body, i);
          if (close === -1) { out += body.slice(i); i = n; break; }
          out += '(…)';
          i = close + 1;
        }
        continue;
      }

      if (idMatch && idMatch[0] === 'return') {
        out += 'return';
        i += 'return'.length;
        const end = statementEnd(body, i);
        const rhs = body.slice(i, end);
        out += rhs.trim() === '' ? rhs : ' …';
        i = end;
        continue;
      }

      if (body[i] === '=') {
        const prevCh = out.length ? out[out.length - 1] : '';
        const nextCh = body[i + 1];
        const isPartOfWiderOperator = /[=!<>+\-*/%&|^]/.test(prevCh) || nextCh === '=' || nextCh === '>';
        if (!isPartOfWiderOperator) {
          out += '=';
          i += 1;
          let j = i;
          while (j < n && /[ \t]/.test(body[j])) j++;
          out += body.slice(i, j) || ' ';
          i = j;
          const end = statementEnd(body, i);
          const rhs = body.slice(i, end);
          out += rhs.trim() === '' ? rhs : '…';
          i = end;
          continue;
        }
      }

      out += body[i];
      i++;
    }
    return out;
  }

  /* hintAt(blank, level) → { zh, en }
     `blank` 必须是 `parse()` 产出的挖空对象（要有 `body` 和
     `hint.{zh,en}`），`level` 必须是 1..4 的整数。两个参数缺一个、或
     `level` 越界（含 0、5、非整数），都按约束 6 大声抛——分级提示也是
     「找不到就抛，不猜」的场景：猜一个默认级别只会让人以为自己看到的是
     完整提示。 */
  function hintAt(blank, level) {
    if (!blank || typeof blank !== 'object' || typeof blank.body !== 'string' ||
        !blank.hint || typeof blank.hint.zh !== 'string' || typeof blank.hint.en !== 'string') {
      throw new Error(
        'hintAt(blank, level) 少了 blank，或者它不是 parse() 产出的挖空对象' +
        '（要有 body 和 hint.{zh,en}），收到：' +
        (blank === null || blank === undefined ? String(blank) : typeof blank)
      );
    }
    if (level === undefined) {
      throw new Error('hintAt(blank, level) 少了 level（1..4 的提示阶梯）');
    }
    if (!(level === 1 || level === 2 || level === 3 || level === 4)) {
      throw new Error(
        'hintAt 的 level 必须是 1、2、3 或 4，收到：' + JSON.stringify(level) +
        '\n  （这是提示阶梯，不是 blank.level 那个 1..3 的难度——两者不是一回事）'
      );
    }

    if (level === 1) {
      return { zh: blank.hint.zh, en: blank.hint.en };
    }

    if (level === 2) {
      const vars = variablesIn(blank.body);
      const zhList = vars.length ? vars.join('、') : '（这段代码里没有普通变量名）';
      const enList = vars.length ? vars.join(', ') : '(no plain variable names in this snippet)';
      return {
        zh: '涉及的变量：' + zhList,
        en: 'Variables involved: ' + enList,
      };
    }

    const body = level === 3 ? skeletonOf(blank.body) : blank.body;
    const zhLabel = level === 3
      ? '参考答案的结构骨架（控制流保留，把算出什么的部分挖成 …）：'
      : '完整答案：';
    const enLabel = level === 3
      ? 'Structural skeleton of the reference answer (control flow kept, expressions blanked as …):'
      : 'The full answer:';
    return {
      zh: zhLabel + '\n' + body,
      en: enLabel + '\n' + body,
    };
  }

  return { parse: parse, judge: judge, hintAt: hintAt };
});
