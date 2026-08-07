# 阶段 8：双语算法源码与运行日志 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让工具⑤ 的七份 `chess/core/algos/*.js` 生成的算法源码——注释与 `log` 日志——跟着界面语言走，英文界面下读到的是英文源码。

**Architecture:** `HEAD` / `BODY` 从「字符串数组」变成「片段数组」：元素要么是一个**字符串**（一行，两种语言逐字相同——代码、空行、`BLANK` 指令行），要么是一个 `{ zh: [...], en: [...] }` **散文块**（两边都是行数组，且**行数必须相等**）。`source(opts)` 多吃一个必填的 `lang`，一个逐字节相同的本地 `render(parts, lang)` 把片段摊平成源码。**可执行代码在两种语言下逐字节相同、行号逐行对齐**，于是解释器轨迹与所有按行索引的状态（`Step.line` / `pristine` / `answerRange` / `judge.herSrc`）在两种语言下完全一致——切语言只换编辑器里的文本，不重跑、不重建轨道。

**Tech Stack:** 零依赖 ES5 子集 JavaScript（`node` 直跑 + 浏览器内联）；Python 3 的 `chess/scripts/check.py`；无构建、无包管理器。

## Global Constraints

**每次派发子代理都必须带上这一句：**

> 如果计划里某段代码是错的、或某个测试断言了一件事实上错误的事，停下来报告，不许改代码或改测试去迁就它。计划是记录，不是权威。

- **规格是 `docs/superpowers/specs/2026-08-02-chess-viz-suite-design.md` 的 §1.6、§7.5、§8。** 本阶段的全部裁定在 §1.6「『双语 UI』与『双语工具』不是一回事」那一小节里。
- **本阶段的基线 commit 是 `f686833`**（`Merge pull request #97`）。凡是要对照「改动前」的，一律 `git show f686833:<path>`。
- **中文一个字节都不许改。** 中文变体必须与基线逐字节相同——这是每个文案任务的收口门。真发现某句中文写错了，**停下来报告**，不许顺手改（那会让 diff 从「新增英文」变成「新增英文 + 若干看不出来的中文改动」，审查就废了）。
- **`minimax.js` 不在本阶段范围内**（工具④ 的，改它要重做那个工具的验收）。它进 `check.py` 的单语白名单。
- **英文以中文那一版的意思与语气为底本重写，不是逐句对译。** 判据是「两边各自读起来都像母语者写给一个十六岁读者的」。
- **英文不能比中文说得少或多。** 允许句式与举例不同，**教学内容必须是同一件事**。
- **约束落在「段」上，不落在「句」上**：一段 6 行的中文注释要写成 6 行英文，段内句子怎么重组都行。写不成等行数就**停下来报告**，不许塞废话或砍内容凑数。
- **本仓无构建/lint/test 工具链。** 测试 = `node chess/core/xxx.test.js`；总门 = `python3 chess/scripts/check.py`。
- **`git status --short` 之后只暂存显式路径**；禁止 `git add -A` / `git commit -a`。`.githooks/pre-commit` 会重跑 `inline_core.py` 并**再暂存**，所以钩子跑完之后要**再看一遍** `git status --short`，确认每一条都是自己的。
- 生成源码里的注释与日志是写给**没学过棋的十六岁读者**的；`algos/*.js` 文件自身的注释是写给维护者的。两套读者，两种口吻，别混。

---

## 文件结构

| 文件 | 责任 | 本阶段动作 |
|---|---|---|
| `chess/core/_test.js` | 共用测试断言器 | **加** `normalizeSource(src)`（纯函数，零依赖） |
| `chess/core/algos/queens.js` | N 皇后源码生成器（81 行源码，2 个挖空） | 双语化 + 定版 `render` 助手 |
| `chess/core/algos/knight-path.js` | 马的最短路 BFS（110 行，2 个挖空） | 双语化 |
| `chess/core/algos/tour-dfs.js` | 马周游纯回溯（91 行） | 双语化 |
| `chess/core/algos/tour-warnsdorff.js` | 马周游 Warnsdorff（125 行，1 个挖空） | 双语化 |
| `chess/core/algos/rook-cover.js` | 二分图匹配 + König（167 行） | 双语化 |
| `chess/core/algos/king-greedy.js` | 王支配集贪心（133 行） | 双语化 |
| `chess/core/algos/king-exact.js` | 王支配集精确（160 行） | 双语化 |
| `chess/core/algos/*.test.js`（5 份） | 各自的测试 | 调用点补 `lang`；加三道双语门 |
| `chess/core/exercise.test.js` | 挖空测试 | 调用点补 `lang` |
| `chess/core/exercise-blanks.test.js` | 挖空的三项断言 | 调用点补 `lang`（Task 2 发现的遗漏：6 处 `Q.source`，不补则该测试直接崩） |
| `chess/tools/chess-board-algorithms.html` | 工具⑤（`inline_core.py` 的生成物） | **每个文案任务都会被钩子重新内联**（`algos/*.js` 是内联进去的字符串）。不重新内联，`check.py` 的 ALGOS 往返门报 ERROR。所以每个文案任务的提交里都会带上它，这是**预期内的**，不是别的会话混进来的东西 |
| `chess/scripts/check.py` | 总门 | **加** `bilingual_algos_check()`（第八道门） |
| `chess/tools/chess-board-algorithms.html` | 工具⑤ | `genSource` 传 `lang`；5 个 `PROBLEMS` 声明转发 `lang`；切语言改成整份换文本 |
| `chess/chess-tools.json` / `chess/index.html` / `chess/app.html` | 三处注册镜像 | 版本 1.2.0 → 1.3.0 |

**`render(parts, lang)` 为什么在七份里各存一份、而不抽成一个模块**：`algos/*.js` 是被 `inline_core.py` 当**字符串**逐份内联进 html、再各自求值成 `AlgoXxx` 全局的，抽成模块就凭空多出一条求值顺序依赖（少一份、或顺序错了，页面上 `ALGOS['queens.js']` 是 undefined 才发作——阶段 5 建页当天撞过的正是这一类）。七份重复 + 一道字节级门，是阶段 7 `king-greedy` / `king-exact` 共用段已经用过的同一个套路。

---

## Task 1：`_test.js` 的源码归一化器

判「两种语言的可执行代码是不是同一份」不能靠人眼。这个纯函数把一份源码里的**注释抽掉、每个字符串字面量换成同一个占位符**，剩下的字节就是「代码本身」。它是 Task 2 及以后每个文案任务那三道门里第一道的地基。

放在 `_test.js` 而不是各测试文件里：五份测试文件都要用，一份实现才不会互相漂移。**保持 `_test.js` 零依赖**（不 require 解释器）——所以它只做文本归一化，不做行为判定。

**Files:**
- Modify: `chess/core/_test.js`（在 `failedCount` 之前加函数，在 `module.exports` 里加导出）
- Test: `chess/core/_test.self.test.js`（新建）

**Interfaces:**
- Produces: `normalizeSource(src: string) -> string`。抽掉 `//` 行注释与 `/* */` 块注释，把每个 `'…'` / `"…"` 字符串字面量整体替换成 `§`，行结构保留（第 n 行还是第 n 行），行尾空白抽掉。`src` 不是字符串时抛。
- Consumes: 无。

**这一份源码是 ES 子集，没有模板字面量、没有正则字面量**（`queens.js` 文件头写明了「这里用普通字符串拼，不用模板字面量」）。**七份实测确认过**：反引号 6 个、正则字面量 0 个，而那 6 个反引号全在 `king-greedy.js` 的**中文注释里**当引号用（`这里写的是 \`>\` 不是 \`>=\``），归一化时跟注释一起被抽掉。

所以一个只认 `'` / `"` / `//` / `/* */` 四种状态的扫描器**今天**是完备的——但那是运气，不是保证。**所以归一化器自己带一道守卫**：归一化之后的结果里若还剩反引号，说明代码里真有模板字面量，那时这个扫描器会把模板内容当代码扫，判出来的「代码同一」不作数——**抛，别静默给一个不作数的答案**。正则字面量没有这么便宜的守卫（`/` 的歧义要真解析才分得清），碰上了停下来报告，别硬扩这个扫描器。

**这一整个任务的实现与测试都已在计划外实跑验证过**：16 条主测试 + 3 条守卫测试全绿，七份真源码归一化后行数一行不差、残留汉字 0 个（这一条顺带证明了一件要紧的事——**七份源码里每一个汉字都在注释或字符串字面量里**，没有一个漏在裸代码里，所以「只有注释与字符串不同」这个不变式是做得到的）。

- [ ] **Step 1: 写失败的测试**

新建 `chess/core/_test.self.test.js`：

```js
'use strict';
/* _test.js 自己的测试。归一化器是阶段 8 三道双语门里第一道的地基 ——
   它判错了，七份源码的「代码没分岔」就是一句空话，所以它自己得有门。

   ⚠ 这里**不能**用 T.throws 去测 T 自己的失败计数（exercise.test.js 那次
   教训：throws() 不重抛，拿它测自己永远是真）。要测「归一化器抛了」就
   自己写 try/catch。 */
const T = require('./_test.js');
const N = T.normalizeSource;

// ---- 注释被抽掉 ----
T.eq(N('let a = 1; // 这是注释'), 'let a = 1;', '行注释被抽掉，行尾空白也抽掉');
T.eq(N('let a = 1; // a comment'), N('let a = 1; // 这是注释'),
     '同一行代码、两种语言的行注释，归一化之后相同');
T.eq(N('/* 块注释 */\nlet a = 1;'), '\nlet a = 1;', '块注释被抽掉，行数不变');
T.eq(N('/* 跨\n行 */\nlet a = 1;'), '\n\nlet a = 1;', '跨行块注释：每一行都留一个空行');

// ---- 字符串字面量被替换 ----
T.eq(N('log("第 1 个解");'), 'log(§);', '双引号字符串换成占位符');
T.eq(N("log('第 1 个解');"), 'log(§);', '单引号字符串换成占位符');
T.eq(N('log("第 " + n + " 个解");'), 'log(§ + n + §);', '拼接里每个字面量各换一次');
T.eq(N('log("A solution");'), N('log("一个解");'), '两种语言的日志，归一化之后相同');

// ---- 注释符号出现在字符串里，不许当注释 ----
T.eq(N('log("http://x");'), 'log(§);', '字符串里的 // 不是注释');
T.eq(N('log("/* 不是注释 */");'), 'log(§);', '字符串里的 /* 不是注释');
// ---- 引号出现在注释里，不许当字符串开头 ----
T.eq(N('let a = 1; // 她说"这样"\nlet b = 2;'), 'let a = 1;\nlet b = 2;',
     '注释里的引号不会把后面的代码吃掉');
// ---- 字符串里的转义引号 ----
T.eq(N('log("a\\"b");'), 'log(§);', '转义引号不结束字符串');

// ---- 真的能分出「代码分岔了」 ----
T.ok(N('for (let i = 0; i < n; i++) {} // 注释') !==
     N('for (let i = 0; i <= n - 1; i++) {} // comment'),
     'i < n 与 i <= n - 1 归一化之后不同 —— 这正是这道门要抓的');

// ---- 行数永远不变 ----
const multi = '/* 一\n二\n三 */\nlet a = 1;\nlog("x");';
T.eq(N(multi).split('\n').length, multi.split('\n').length, '归一化不改变行数');

// ---- 非字符串输入必须响 ----
let threw = null;
try { N(undefined); } catch (e) { threw = e; }
T.ok(threw !== null, 'normalizeSource(undefined) 抛了');
T.ok(threw !== null && /normalizeSource/.test(threw.message),
     '错误消息点名了 normalizeSource，不是一句裸 TypeError');

/* ---- 模板字面量必须响，注释里的反引号不许响 ----
   这个扫描器只认 ' " // /* 四种状态，模板字面量的内容会被当成代码扫 ——
   那样判出来的「代码同一」不作数，所以宁可抛。
   而反引号在中文注释里当引号用是**真实存在**的（king-greedy.js 里 6 个：
   「这里写的是 `>` 不是 `>=`」），那些必须照常通过。 */
T.eq(N('let a = 1; // 这里写的是 `>` 不是 `>=`'), 'let a = 1;',
     '注释里的反引号跟注释一起被抽掉，不触发守卫');
let tmpl = null;
try { N('log(`x`);'); } catch (e) { tmpl = e; }
T.ok(tmpl !== null, '代码里的模板字面量让 normalizeSource 抛');
T.ok(tmpl !== null && /模板字面量/.test(tmpl.message),
     '错误消息说清楚了为什么这份源码判不了');

T.report();
```

- [ ] **Step 2: 跑一遍，确认它失败**

```bash
node chess/core/_test.self.test.js
```

期望：`TypeError: T.normalizeSource is not a function`。

- [ ] **Step 3: 写实现**

在 `chess/core/_test.js` 里、`failedCount()` 之前插入：

```js
/* 把一份源码归一化成「只剩代码」：抽掉注释、每个字符串字面量整体换成 §。
   阶段 8 三道双语门里第一道的地基（规格 §7.5）—— 两种语言变体归一化之后
   必须逐字节相同，否则就是可执行代码偷偷分岔了。

   **行结构保留**：第 n 行归一化之后还是第 n 行（跨行块注释每行留一个空行）。
   因为两种语言变体是逐行对齐的（规格 §1.6），行号对不上本身就是缺陷，
   而把行号搅乱的归一化器会把这种缺陷伪装成「某一行内容不同」。

   只认四种状态：普通代码 / 单引号串 / 双引号串 / 注释。**这对 algos/*.js
   是完备的**：那些源码是 interp.js 的 ES 子集，没有模板字面量、也没有正则
   字面量（queens.js 文件头写明了「用普通字符串拼，不用模板字面量」）。
   哪天真要归一化一份带正则字面量的源码，`/` 的歧义得单独想清楚——别拿
   这个函数硬套。 */
function normalizeSource(src) {
  if (typeof src !== 'string') {
    throw new Error('normalizeSource(src) 要一个字符串，收到：' + typeof src);
  }
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '\n') { out += '\n'; i++; continue; }
    /* 字符串字面量：整体换成一个 §。转义符跳两格 —— 否则 "a\"b" 会在
       中间那个引号提前收尾，后半截代码被当成字符串外的东西，全乱。 */
    if (c === "'" || c === '"') {
      const quote = c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') i++;
        i++;
      }
      i++;                       // 吃掉收尾引号
      out += '§';
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;                  // 换行留给上面那一支
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') out += '\n';   // 跨行块注释：行数不变
        i++;
      }
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  /* 行尾空白抽掉：注释被抽走之后 `let a = 1; ` 会留一个尾空格，
     而另一种语言那一行可能不留 —— 那是归一化器自己制造的假差异。 */
  const flat = out.split('\n').map(function (l) { return l.replace(/\s+$/, ''); }).join('\n');
  /* 守卫：注释与字符串都抽干净之后还剩反引号，说明代码里有模板字面量 ——
     而上面那个四状态扫描器会把模板内容当代码扫。那种情况下判出来的
     「两种语言代码同一」**不作数**，宁可抛，不许静默给一个不作数的答案。
     （注释里的反引号不会走到这里：它们跟注释一起被抽掉了。king-greedy.js
     的中文注释里就有 6 个，实测照常通过。） */
  if (flat.indexOf('`') >= 0) {
    throw new Error('normalizeSource 在归一化之后还看到反引号 —— 这份源码里' +
                    '有模板字面量，而这个扫描器只认 \' " // 和 /* 四种状态，' +
                    '模板字面量的内容会被当成代码扫，判出来的「代码同一」不作数');
  }
  return flat;
}
```

**这份实现连同上面那份测试已经实跑过**（16 + 3 全绿），并对七份真源码各跑了一遍：行数一行不差、残留汉字 0、守卫一次误报都没有。

并把导出改成：

```js
module.exports = { eq, ok, throws, failedCount, normalizeSource, report };
```

- [ ] **Step 4: 跑测试，确认全绿**

```bash
node chess/core/_test.self.test.js
```

期望：`19 passed, 0 failed`。（16 条主测试 + 3 条模板字面量守卫。这个数字是实跑出来的，不是估的——对不上就说明有测试没被执行到。）

- [ ] **Step 5: 确认没碰坏别人**

```bash
python3 chess/scripts/check.py
```

期望：exit 0，`core/games 测试：18 个测试文件全部通过`（比阶段 7 的 17 个多一个——新加的 `_test.self.test.js` 被 `core_tests()` 的 `rglob` 自动扫到了）。**如果数字没从 17 变成 18，说明新测试根本没被跑到**，停下来查 `core_tests()` 的 glob。

- [ ] **Step 6: 提交**

```bash
git status --short
git add chess/core/_test.js chess/core/_test.self.test.js
git commit -m "test(chess): _test.js 加 normalizeSource —— 双语门的地基"
git status --short
```

---

## Task 2：`queens.js` 双语（并定版 `render` 助手）

最小的一份（81 行源码），而且带 2 个挖空——**机制、写法、行数约束三件事一次全验到**。后面六份照抄这一份的形状。

`render(parts, lang)` 在这个任务里**定版**：Task 4–7 要一字不差地复制它。

**Files:**
- Modify: `chess/core/algos/queens.js`
- Modify: `chess/core/algos/queens.test.js`
- Modify: `chess/core/exercise.test.js`（调用点补 `lang`）

**Interfaces:**
- Consumes: `T.normalizeSource(src)`（Task 1）
- Produces:
  - `AlgoQueens.source({ N: number, lang: 'zh'|'en' }) -> string`
  - `render(parts, lang)` 的**定版文本**（见 Step 3），Task 4/5/6/7 逐字节复制
  - 片段数组约定：元素是 `string`（一行，两语相同）或 `{ zh: string[], en: string[] }`（`zh.length === en.length`）

- [ ] **Step 1: 先写三道门（会失败）**

在 `chess/core/algos/queens.test.js` 末尾、`T.report()` 之前插入：

```js
/* ---- 双语三道门（规格 §7.5）----

   守的是「可执行代码没有偷偷分岔」，**不是**「英文翻得对不对」——后者
   机器判不了，是人工审查项。三道各有对方才拦得住的漏：
     ① 结构门漏掉字符串参与控制流（if (label === '皇后') 两语两条分支）
     ② 行为门漏掉等步改写（i < n → i <= n - 1，同一行、同样步数）
     ③ 行数门被①蕴含，但单独报 —— 最容易违反、也最容易一眼看懂的那条，
        混在①的「字节不同」里报等于没报。 */
for (const N of [4, 6, 8]) {
  const zh = Q.source({ N: N, lang: 'zh' });
  const en = Q.source({ N: N, lang: 'en' });

  T.eq(en.split('\n').length, zh.split('\n').length,
       'N=' + N + '：两种语言行数相同');
  T.eq(T.normalizeSource(en), T.normalizeSource(zh),
       'N=' + N + '：抽掉注释与字符串之后，两种语言逐字节相同');
  T.eq(I.run(en, { host: {} }).trace.length, I.run(zh, { host: {} }).trace.length,
       'N=' + N + '：两种语言的解释器步数相同');
}

/* 反向：英文必须真的是英文。上面三道门在「en 原样返回中文」时全绿 ——
   把 lang 接进来却没接上，长得跟接上了一模一样。 */
const zh6 = Q.source({ N: 6, lang: 'zh' });
const en6 = Q.source({ N: 6, lang: 'en' });
T.ok(zh6 !== en6, '两种语言的源码不是同一份');
T.ok(/[一-鿿]/.test(zh6), '中文那一份里有汉字');
T.ok(!/[一-鿿]/.test(E.parse(en6, 'en').clean), '英文那一份送到编辑器的文本里一个汉字都没有');
/* BLANK 指令行不翻译 —— 正着钉一次，别只写在散文里 */
const blankLines = function (src) {
  return src.split('\n').filter(function (l) { return /BLANK/.test(l); }).join('\n');
};
T.eq(blankLines(en6), blankLines(zh6), '两种语言变体里的 BLANK 指令行逐字节相同');

⚠ **「英文那一份里一个汉字都没有」不能对着 `source()` 的原文断言。** BLANK 指令行**不翻译**（它本来就带 `hint` + `hintEn`），所以带挖空的源码在英文变体里**必然**含汉字——`queens.js` 实测 114 个，全在那两行指令行上。要断言的是**送到她眼前的那一份**，也就是 `Exercise.parse(src, lang).clean`（实测 0 个汉字）。

这是我在计划里让两条自己的裁定打了架，Task 2 的实现者抓到的。带挖空的三份（`queens` 2 个、`knight-path` 2 个、`tour-warnsdorff` 1 个）都受影响；`tour-dfs` / `rook-cover` / `king-*` 没有挖空，原文断言本来也成立，但**统一都走 `clean`**，别留两种写法。

顺带把这件事**正着钉一次**（原计划只写在散文里、没有断言）：两种语言变体里那两行 BLANK 指令**逐字节相同**。

⚠ **剥指令行必须走 `Exercise.parse()`，测试里也不许自己写一条过滤。** 五个 `algos/*.test.js` 今天都没 require 过 `exercise.js`，加一行 `const E = require('../exercise.js');` 即可（两个都是仓库本地模块，「零依赖」说的是外部依赖，不受影响）。理由是规格里已经立过的那一条：**「什么算指令行」这段知识分成两份，迟早分岔**——页面不许自己写正则，测试同样不许。一份会漂移的过滤会让这道门悄悄停止检验它该检验的东西。


// ---- lang 必填，且只认两个值 ----
T.throws(function () { Q.source({ N: 6 }); }, 'queens：缺 lang 必须抛', /少了 lang/);
T.throws(function () { Q.source({ N: 6, lang: 'fr' }); }, 'queens：lang=fr 必须抛', /只认/);
T.throws(function () { Q.source({ N: 6, lang: '' }); }, 'queens：lang=空串必须抛', /只认/);
```

同时把这个文件里**所有**已有的 `Q.source({ N: … })` 调用补上 `lang: 'zh'`（`lang` 缺了会抛，一跑就知道漏了哪个）。`exercise.test.js` 里 9 处 `source(` 同样处理。

- [ ] **Step 2: 跑一遍，确认它失败**

```bash
node chess/core/algos/queens.test.js
```

期望：在 `source({ N: 6, lang: 'zh' })` 处抛 —— 现在的 `source()` 根本不认 `lang`，它会照常吐出中文，于是 `T.throws(… /少了 lang/)` 先失败。

- [ ] **Step 3: 加 `render` 助手与 `lang` 校验（定版文本，Task 4–7 逐字节复制）**

在 `queens.js` 的 `'use strict';` 之后、`N_MIN` 之前插入：

```js
  /* ================= 双语渲染（规格 §1.6 / §7.5）=================

     ⚠ **这一整段在七份 algos/*.js 里逐字节相同**，check.py 的
     bilingual_algos_check() 会核对。改这里就得七份一起改。
     不抽成共用模块，是因为这些文件是被 inline_core.py 当**字符串**逐份
     内联、再各自求值成 AlgoXxx 全局的 —— 抽出去就凭空多一条求值顺序
     依赖，而那类缺陷要到浏览器里 ALGOS['queens.js'] 是 undefined 才发作
     （阶段 5 建页当天撞过一次）。七份重复 + 一道字节级门，是阶段 7
     king-greedy / king-exact 共用段用过的同一个套路。

     `parts` 的元素只有两种：
       字符串                 —— 一行，两种语言下逐字相同
                                 （代码、空行、// >>> BLANK 指令行）
       { zh: [], en: [] }     —— 一段散文，两边都是**行数组**

     **两边行数必须相等**，不是洁癖：生成的源码是按行索引的 —— 解释器
     每一步记 line，第 4 级提示靠 pristine 与编辑器逐行对齐划出 answerRange，
     判定靠 judge.herSrc 比对。行数一差，切一次语言这四样同时指错地方。
     行数一对齐，轨迹在两种语言下逐字节相同，切语言就只是换掉编辑器里的
     文本，不重跑解释器。

     BLANK 指令行**不翻译**：它本来就同时带着 hint 与 hintEn，两种语言
     变体里那一行逐字相同，parse() 一点不用改。所以它是**字符串**片段。 */
  function render(parts, lang) {
    if (lang === undefined || lang === null) {
      throw new Error(
        'source({ lang }) 少了 lang —— 源码的注释与日志要用哪种语言没有' +
        '默认值，必须写明 "zh" 或 "en"（默认成任何一种，都是让同一个缺陷' +
        '换个地方复活）'
      );
    }
    if (lang !== 'zh' && lang !== 'en') {
      throw new Error('source({ lang }) 的 lang 只认 "zh" 或 "en"，收到：' +
                      JSON.stringify(lang));
    }
    const out = [];
    for (let i = 0; i < parts.length; i = i + 1) {
      const p = parts[i];
      if (typeof p === 'string') { out.push(p); continue; }
      if (!p || !Array.isArray(p.zh) || !Array.isArray(p.en)) {
        throw new Error('第 ' + i + ' 个片段既不是字符串、也不是 ' +
                        '{ zh: [], en: [] }');
      }
      if (p.zh.length !== p.en.length) {
        throw new Error(
          '第 ' + i + ' 个片段两种语言行数不等：zh ' + p.zh.length + ' 行 / en ' +
          p.en.length + ' 行 —— 生成的源码按行索引，行数一差，切一次语言 ' +
          'Step.line / pristine / answerRange / judge.herSrc 同时指错地方' +
          '（规格 §1.6）'
        );
      }
      const lines = p[lang];
      for (let j = 0; j < lines.length; j = j + 1) out.push(lines[j]);
    }
    return out;
  }
```

`source()` 改成（**`N` 的校验仍在前**——这样既有的 `T.throws(…, /少了 N/)` 调用点一个都不用动；`lang` 由 `render` 在最后校验）：

```js
  function source(opts) {
    const o = opts || {};
    if (o.N === undefined || o.N === null) {
      throw new Error('source({ N }) 少了 N —— 棋盘边长没有默认值，必须写明');
    }
    const N = o.N;
    if (typeof N !== 'number' || !isFinite(N) || Math.floor(N) !== N || N < 1) {
      throw new Error('N 必须是 >= 1 的整数，收到：' + N);
    }
    return render(HEAD, o.lang)
      .concat(['const N = ' + N + ';'])
      .concat(render(BODY, o.lang))
      .join('\n');
  }
```

- [ ] **Step 4: 把 `HEAD` / `BODY` 改成片段数组，中文一字不动**

**机械改写规则**：连续的注释行（以及含中文字符串字面量的 `log` 行）收拢成一个 `{ zh: [...], en: [...] }`，`zh` 那一侧**逐字节抄自今天的数组**；其余每一行原样留成字符串。

`HEAD` 的形状（`zh` 侧逐字节抄旧值，`en` 侧是要写的）：

```js
  const HEAD = [
    {
      zh: [
        '/* ============ N 皇后 ============',
        '   在 N×N 的棋盘上摆 N 个后，让它们谁也吃不到谁。',
        '   后能沿横线、竖线、两条斜线走任意远，所以「谁也吃不到谁」就是：',
        '   任意两个后不同行、不同列、也不在同一条斜线上。',
        '',
        '   格子编号：sq = 行 * N + 列，下面写成 sq = r * N + c。',
        '   第 0 行是棋盘最下面那一行，第 0 列是最左边那一列 —— 于是 0 号格',
        '   就是国际象棋里的 a1，右边棋盘上每一格都能这样对上号。',
        '   要反推回去：列 = sq % N，行 = (sq - 列) / N。',
        '',
        '   整个解法只靠一个约定：每一行只放一个后。',
        '   这样「同行」根本不可能发生，要查的就只剩列和两条斜线了。 */',
      ],
      en: [
        '/* ============ N Queens ============',
        '   Place N queens on an N×N board so that none of them attacks another.',
        '   A queen slides any distance along a row, a column or either diagonal,',
        '   so "none attacks another" means no two queens share a row, column',
        '   or diagonal.',
        '',
        '   Squares are numbered sq = row * N + column, written below as r * N + c.',
        '   Row 0 is the bottom row and column 0 is the leftmost one, so square 0',
        '   is a1 — every square on the board beside you lines up the same way.',
        '   To go back the other way: column = sq % N, row = (sq - column) / N.',
        '',
        '   The whole solution rests on one convention: one queen per row.',
        '   That makes "same row" impossible, leaving only columns and diagonals. */',
      ],
    },
    '',
    {
      zh: [
        '/* 棋盘边长。8 皇后就是 N = 8 —— 这是这道题唯一的旋钮。',
        '   往上加一，工作量大约要乘以 4.5：N=8 十五万步跑得完，N=9 七十万步',
        '   会直接撞上执行上限。回溯就是这样，不是「慢一点」，是「做不到」。 */',
      ],
      en: [
        '/* The side of the board. Eight queens means N = 8 — the only dial here.',
        '   Add one and the work multiplies by about 4.5: N=8 finishes in 150,000',
        '   steps, N=9 needs 700,000 and hits the execution limit. That is what',
        '   backtracking is: not "slower", but "out of reach". */',
      ],
    },
  ];
```

⚠ **上面两个 `en` 块的行数都不对，都会被 `render` 当场抛错**：第一段 `en` 13 行 / `zh` 12 行，第二段 `en` 4 行 / `zh` 3 行。这是**故意留在计划里的**：写英文时最常犯的就是这一下，而门会立刻抓住它。两段都压回等行数（或按写作判断重排），别靠加空行凑数。**后面六个任务的示例块同理，别信示例的行数，信 `render` 抛不抛。**

`BODY` 同法改写。**逐字节抄中文**这件事有一道机械校验，见 Step 6。

⚠ **`// >>> BLANK` 与 `// <<< BLANK` 两行是字符串片段，不进 `{zh,en}`**（它们本来就带 `hint` + `hintEn`）。**挖空体那一行代码**（如 `'  return !cols[c] && !diagDown[r + c] && !diagUp[r - c + N];'`）也是字符串片段——它是代码。

⚠ **含中文的 `log` 行进 `{zh,en}`**。`queens.js` 只有一处：

```js
    {
      zh: ['log("第 " + solutions + " 个解：" + N + " 个后都站稳了");'],
      en: ['log("Solution " + solutions + ": all " + N + " queens are safe");'],
    },
```

- [ ] **Step 5: 跑测试，确认全绿**

```bash
node chess/core/algos/queens.test.js
node chess/core/exercise.test.js
```

期望：两份都 `0 failed`，且 `queens.test.js` 的通过数比改动前多 15（三个 N × 3 道门 + 3 条反向 + 3 条 `lang` 必填）。

- [ ] **Step 6: 中文逐字节不变（本阶段的收口门）**

```bash
node -e '
const path = require("path"), cp = require("child_process"), fs = require("fs");
const base = cp.execSync("git show f686833:chess/core/algos/queens.js").toString();
fs.writeFileSync("/tmp/t2-queens-base.js", base);
const OLD = require("/tmp/t2-queens-base.js");
const NEW = require(path.resolve("chess/core/algos/queens.js"));
let bad = 0;
for (const N of [1, 4, 5, 6, 7, 8, 9]) {
  const a = OLD.source({ N: N });
  const b = NEW.source({ N: N, lang: "zh" });
  if (a !== b) { bad++; console.log("N=" + N + " 中文变体与基线不同"); }
}
console.log(bad === 0 ? "OK 中文七档逐字节不变" : "FAIL " + bad + " 档不同");
process.exit(bad ? 1 : 0);
'
```

期望：`OK 中文七档逐字节不变`。**不相同就停下来报告**，不许改基线、也不许「顺手把中文改好一点」。

- [ ] **Step 7: 英文自己读一遍**

把 `node -e 'console.log(require("./chess/core/algos/queens.js").source({N:8,lang:"en"}))'` 的输出**整份读一遍**，逐条自查：

1. 有没有翻译腔？（直译的四字结构、`so-called`、`for the sake of`、把中文的破折号原样搬过来）
2. 英文说的和中文是不是**同一件事**？有没有漏掉一个从句、或多添了一句中文没有的解释？
3. 术语用的是英文棋类/算法惯用词吗？（queen 不是 "empress"，backtracking 不是 "back-tracking"，attack / capture 用对了没有）
4. 有没有哪一行超过 ~90 列？（编辑器窄，长行要横向滚）

把这一遍的结论写进提交信息。

- [ ] **Step 8: 提交**

```bash
git status --short
git add chess/core/algos/queens.js chess/core/algos/queens.test.js chess/core/exercise.test.js
git commit -m "feat(chess): queens.js 双语 —— 并定版 render(parts, lang)"
git status --short
```

---

## Task 3：`check.py` 的双语普查门（第八道）

Task 2 之后有了第一份双语源码，这道门才咬得住东西。它守两件**各文件测试守不住**的事：

1. **普查**：`core/algos/` 下每一份非测试、非白名单的 `.js`，它的 `source()` 都必须拒绝缺 `lang`。将来有人加第八道题却忘了双语，**这道门当场响**——而不是等到英文界面上冒出一屏中文。
2. **`render` 助手七份逐字节相同**：它在七份里各存一份，没有门就必然漂移。

**Files:**
- Modify: `chess/scripts/check.py`

**Interfaces:**
- Consumes: 七份 `algos/*.js` 的 `render` 段与 `source()`（Task 2 定版，Task 4–7 逐份补齐）
- Produces: `bilingual_algos_check() -> int`（0 = 通过），接进 `__main__` 的汇总

⚠ **这道门在 Task 3 落地时只有 `queens.js` 是双语的。** 所以它必须**按白名单工作**：`MONOLINGUAL_ALGOS` 里列的是「本阶段暂不双语」的文件，Task 4–7 每完成一份就从白名单里划掉一份，Task 7 结束时白名单里只剩 `minimax.js`。**白名单必须随任务收缩**——一直留着就等于门没开。

- [ ] **Step 1: 写门（先写、先跑，看它红）**

在 `chess/scripts/check.py` 的 `core_tests()` 之前插入：

```python
# 本阶段暂未双语、或明确不在范围内的 algos 文件。
# minimax.js 是工具④ 的：改它要重做那个工具的验收，规格 §1.6 划在阶段 9。
# 其余七份随阶段 8 的任务逐个划掉 —— **这个集合必须缩到只剩 minimax.js**，
# 一直留着就等于这道门没开。
MONOLINGUAL_ALGOS = {
    'minimax.js',
    'knight-path.js', 'tour-dfs.js', 'tour-warnsdorff.js',
    'rook-cover.js', 'king-greedy.js', 'king-exact.js',
}

# render(parts, lang) 那一段在每份双语 algos 里逐字节相同（规格 §1.6）。
# 用两条锚线夹取，而不是数行数：行数会随注释改动漂移，锚线不会。
RENDER_BEGIN = '  /* ================= 双语渲染（规格 §1.6 / §7.5）'
RENDER_END = '    return out;\n  }\n'


def bilingual_algos_check() -> int:
    """双语算法源码的普查门（规格 §7.5，阶段 8）。

    各文件自己的 *.test.js 已经跑了「代码同一 / 步数同一 / 行数同一」三道门
    ——那三道要真实参数，参数只有测试文件知道，放在那里是对的。这里守的是
    那三道**够不着**的两件事：

    ① **普查**：core/algos/ 下每一份非测试、非白名单的 .js，都得**装上**
       双语机制。将来有人加第八道题却忘了双语，这道门当场响；靠各文件
       测试是守不住的 —— 新文件的新测试当然不会去测一件作者没想到的事。

    ② **render 助手七份逐字节相同**：它在每份里各存一份（不抽共用模块的
       理由见 queens.js 里那段注释），没有门就必然漂移。阶段 7 的
       king-greedy / king-exact 共用段用的是同一个套路。

    ⚠ **①「装上了」是结构判据，不是行为判据**，这一点必须说清楚：这道门
    **不**去调 source({}) 看它抛不抛。因为各份 source() 都先校验自己的参数
    （queens 是「少了 N」），一个空对象撞上的永远是那道校验，根本走不到
    lang —— 而这道门够不着每份的合法参数（那只有各自的测试知道）。
    所以①验的是两件加起来等价的结构事实：**render 段在、且逐字节相同**
    （那一段里就写着两条 lang 的抛），**并且 source() 真的调了 render**。
    「带全参数、只缺 lang 也抛」由各文件自己的 T.throws(…, /少了 lang/) 守，
    每个文案任务都写了一条。

    这道门**不判英文写得对不对** —— 机器判不了，那是人工审查项（规格 §8）。
    """
    algos = sorted(p for p in (ROOT / 'core' / 'algos').glob('*.js')
                   if not p.name.endswith('.test.js'))
    if not algos:
        print('ERROR: core/algos/ 下一个 .js 都没找到 —— 这道门本该普查，'
              '不是跑了个寂寞', file=sys.stderr)
        return 1

    stale = MONOLINGUAL_ALGOS - {p.name for p in algos}
    if stale:
        print(f'ERROR: MONOLINGUAL_ALGOS 里有已经不存在的文件：{sorted(stale)}'
              f' —— 白名单指着空气，等于把某个真文件悄悄放行了', file=sys.stderr)
        return 1

    rc = 0
    renders = {}
    checked = 0
    for p in algos:
        if p.name in MONOLINGUAL_ALGOS:
            continue
        checked += 1
        text = p.read_text(encoding='utf-8')

        # ① render 段在不在（那一段里就写着两条 lang 的抛）
        b = text.find(RENDER_BEGIN)
        e = text.find(RENDER_END, b if b >= 0 else 0)
        if b < 0 or e < 0:
            print(f'ERROR: {p.name} 里找不到 render(parts, lang) 那一段'
                  f'（锚线 {RENDER_BEGIN.strip()[:24]}…）—— 双语化没做完，'
                  f'或者锚线被改了', file=sys.stderr)
            rc = 1
            continue
        segment = text[b:e + len(RENDER_END)]
        renders[p.name] = segment

        # ② source() 真的调了 render —— 光定义不调用，等于没装。
        #    把定义段挖掉之后再数：定义里那一行 `function render(parts, lang) {`
        #    本来就含 `render(`，不挖掉的话每份都白白算一次，这道门就永远绿。
        rest = text[:b] + text[e + len(RENDER_END):]
        if 'render(' not in rest:
            print(f'ERROR: {p.name} 定义了 render(parts, lang) 却从来不调它 —— '
                  f'source() 还在吐单语源码', file=sys.stderr)
            rc = 1

    if checked == 0:
        print('ERROR: 一份双语 algos 都没有 —— MONOLINGUAL_ALGOS 是不是把'
              '所有文件都放行了？', file=sys.stderr)
        return 1

    names = sorted(renders)
    if len(names) > 1:
        first = renders[names[0]]
        for name in names[1:]:
            if renders[name] != first:
                print(f'ERROR: {name} 的 render(parts, lang) 与 {names[0]} 的'
                      f'不是逐字节相同 —— 七份里各存一份，就必须一个字节都不差',
                      file=sys.stderr)
                rc = 1

    print(f'双语 algos 普查：{checked} 份双语 / {len(algos) - checked} 份白名单，'
          f'render 助手 {len(names)} 份'
          + ('一致' if rc == 0 else '有不一致'))
    return rc
```

在 `__main__` 里加上（**不用 `or` 短路**，跟既有七道一样各自跑到底）：

```python
    rc_bilingual = bilingual_algos_check()
```

并把 `sys.exit(...)` 的条件加上 `rc_bilingual`。同时把 `__main__` 顶上那段注释里的「七道门」改成「八道门」，并写明第八道守的是什么。

- [ ] **Step 2: 跑，确认它是绿的且真的在数**

```bash
python3 chess/scripts/check.py
```

期望：exit 0，且打印 `双语 algos 普查：1 份双语 / 7 份白名单，render 助手 1 份一致`。
**如果打印的是「0 份双语」，门没在工作**——停下来查白名单。

- [ ] **Step 3: 对照实验——证明它真的会响**

三个突变，每个跑完**立刻还原**（用 `git checkout --` 还原，不要手改回去）：

```bash
# 突变 A：把 queens.js 的 RENDER_BEGIN 锚线注释改一个字
#   期望：ERROR: queens.js 里找不到 render(parts, lang) 那一段
# 突变 B：把 queens.js 的 source() 改回不调 render（直接 HEAD.concat(BODY)）
#   期望：ERROR: queens.js 定义了 render(parts, lang) 却从来不调它
# 突变 C：MONOLINGUAL_ALGOS 里临时加上 'queens.js'
#   期望：ERROR: 一份双语 algos 都没有 ……
# 突变 D：MONOLINGUAL_ALGOS 里加一个不存在的文件名 'nope.js'
#   期望：ERROR: MONOLINGUAL_ALGOS 里有已经不存在的文件 ……
git checkout -- chess/core/algos/queens.js chess/scripts/check.py
```

四个都必须让 `check.py` 退出 1。**任何一个没响，这道门在那个方向上是假的**——停下来报告。

⚠ **突变 B 特别要跑到。** 它验的是「挖掉定义段之后再数 `render(`」那一句真的挖对了——挖漏了的话每份文件都会因为定义里那行 `function render(parts, lang) {` 而白算一次，这道门就**永远是绿的**。这正是控制器写门时最容易犯、也最难看出来的那一类：一道恒真的断言，长得跟一道通过的断言一模一样。

⚠ **「七份 render 一致」这一条在只有一份双语文件时验不到**（`len(names) > 1` 不成立）。这是**已知的、会随 Task 4 自动闭合**的空档，不是漏洞——Task 4 完成时它自然开始咬合。**Task 4 的验收里要显式确认这一条真的开始比对了**（打印的「render 助手 N 份一致」里 N 要是 2）。

- [ ] **Step 4: 提交**

```bash
git status --short
git add chess/scripts/check.py
git commit -m "build(chess): check.py 第八道门 —— 双语 algos 普查与 render 助手字节一致"
git status --short
```

---

## Task 4：`knight-path.js` 双语

110 行源码、2 个挖空、2 处 `log`。第一份「照着 Task 2 的形状抄」的文件——**`render` 助手从 `queens.js` 逐字节复制**，一个字都不改。

**Files:**
- Modify: `chess/core/algos/knight-path.js`
- Modify: `chess/core/algos/knight-path.test.js`
- Modify: `chess/scripts/check.py`（从 `MONOLINGUAL_ALGOS` 划掉 `knight-path.js`）

**Interfaces:**
- Consumes: `render(parts, lang)` 的定版文本（Task 2）、`T.normalizeSource`（Task 1）
- Produces: `AlgoKnightPath.source({ W, start, target, lang }) -> string`

- [ ] **Step 1: 先写三道门（会失败）**

在 `knight-path.test.js` 末尾、`T.report()` 之前插入（参数用这个文件既有的那组，别新编）：

```js
/* ---- 双语三道门（规格 §7.5）。三道各有对方才拦得住的漏，见 queens.test.js
   里那段注释；这里不重复。 ---- */
for (const target of [10, 24]) {
  const zh = KP.source({ W: 5, start: 0, target: target, lang: 'zh' });
  const en = KP.source({ W: 5, start: 0, target: target, lang: 'en' });
  T.eq(en.split('\n').length, zh.split('\n').length,
       'target=' + target + '：两种语言行数相同');
  T.eq(T.normalizeSource(en), T.normalizeSource(zh),
       'target=' + target + '：抽掉注释与字符串之后，两种语言逐字节相同');
  T.eq(I.run(en, { host: {} }).trace.length, I.run(zh, { host: {} }).trace.length,
       'target=' + target + '：两种语言的解释器步数相同');
}
const kpZh = KP.source({ W: 5, start: 0, target: 24, lang: 'zh' });
const kpEn = KP.source({ W: 5, start: 0, target: 24, lang: 'en' });
T.ok(kpZh !== kpEn, '两种语言的源码不是同一份');
T.ok(/[一-鿿]/.test(kpZh), '中文那一份里有汉字');
T.ok(!/[一-鿿]/.test(E.parse(kpEn, 'en').clean),
     '英文那一份送到编辑器的文本里一个汉字都没有');
T.eq(kpEn.split('\n').filter(l => /BLANK/.test(l)).join('\n'),
     kpZh.split('\n').filter(l => /BLANK/.test(l)).join('\n'),
     '两种语言变体里的 BLANK 指令行逐字节相同');
T.throws(function () { KP.source({ W: 5, start: 0, target: 24 }); },
         'knight-path：缺 lang 必须抛', /少了 lang/);
T.throws(function () { KP.source({ W: 5, start: 0, target: 24, lang: 'fr' }); },
         'knight-path：lang=fr 必须抛', /只认/);
```

⚠ 上面的模块别名 `KP`、参数名与合法取值，**以这个测试文件顶部既有的写法为准**——如果它用的是别的名字或别的盘，照它的改，别照抄本计划里的字面量。

同时给这个文件里所有既有的 `source(` 调用补 `lang: 'zh'`。

- [ ] **Step 2: 跑，确认失败**

```bash
node chess/core/algos/knight-path.test.js
```

- [ ] **Step 3: 复制 `render`、改 `source()`、改写 `HEAD`/`BODY`**

```bash
# render 段逐字节复制，别手打
python3 - <<'PY'
import re, pathlib
src = pathlib.Path('chess/core/algos/queens.js').read_text(encoding='utf-8')
b = src.index('  /* ================= 双语渲染（规格 §1.6 / §7.5）')
e = src.index('    return out;\n  }\n', b) + len('    return out;\n  }\n')
print(src[b:e])
PY
```

把输出**原样**贴进 `knight-path.js` 的 `'use strict';` 之后。`source()` 的收尾从 `.join('\n')` 前面改成走 `render(HEAD, o.lang)` / `render(BODY, o.lang)`，**自身参数校验仍在最前**。

`HEAD` / `BODY` 按 Task 2 Step 4 的同一条机械规则改写：连续注释行与含中文的 `log` 行收拢成 `{zh, en}`（`zh` 侧逐字节抄旧值），其余每行留成字符串；`// >>> BLANK` / `// <<< BLANK` 与挖空体是**字符串**片段。

- [ ] **Step 4: 跑测试**

```bash
node chess/core/algos/knight-path.test.js
node chess/core/exercise.test.js
```

期望：两份 `0 failed`。

- [ ] **Step 5: 中文逐字节不变**

```bash
node -e '
const cp = require("child_process"), fs = require("fs"), path = require("path");
fs.writeFileSync("/tmp/t4-kp-base.js",
  cp.execSync("git show f686833:chess/core/algos/knight-path.js").toString());
const OLD = require("/tmp/t4-kp-base.js");
const NEW = require(path.resolve("chess/core/algos/knight-path.js"));
let bad = 0;
for (const target of [1, 7, 10, 12, 24]) {
  const a = OLD.source({ W: 5, start: 0, target: target });
  const b = NEW.source({ W: 5, start: 0, target: target, lang: "zh" });
  if (a !== b) { bad++; console.log("target=" + target + " 中文变体与基线不同"); }
}
console.log(bad === 0 ? "OK 中文逐字节不变" : "FAIL " + bad + " 档不同");
process.exit(bad ? 1 : 0);
'
```

- [ ] **Step 6: 划掉白名单，并确认「render 七份一致」这一条真的开始咬了**

从 `chess/scripts/check.py` 的 `MONOLINGUAL_ALGOS` 里删掉 `'knight-path.js'`，然后：

```bash
python3 chess/scripts/check.py
```

期望：exit 0，且打印 `双语 algos 普查：2 份双语 / 6 份白名单，render 助手 2 份一致`。
**「2 份一致」这四个字是这一步的真正产出**——Task 3 那条比对在只有一份时是空转的，到这里才第一次比到东西。

再做一次对照实验证明它真的会响：把 `knight-path.js` 的 `render` 段里任意一个空格删掉，跑 `check.py`，期望
`ERROR: knight-path.js 的 render(parts, lang) 与 queens.js 的不是逐字节相同`，然后 `git checkout -- chess/core/algos/knight-path.js` 还原并重新做完 Step 3–5。

- [ ] **Step 7: 英文自己读一遍**（同 Task 2 Step 7 的四条自查，结论写进提交信息）

- [ ] **Step 8: 提交**

```bash
git status --short
git add chess/core/algos/knight-path.js chess/core/algos/knight-path.test.js chess/scripts/check.py
git commit -m "feat(chess): knight-path.js 双语"
git status --short
```

---

## Task 5：`tour-dfs.js` + `tour-warnsdorff.js` 双语

**两份必须同一个任务**：阶段 5 立过一道门——「一份的每行按原顺序出现在另一份里」（纯回溯是 Warnsdorff 的子序列，这是这道题的教学落点）。那道门跨两份比对，一份改了另一份没改，它当场红。

`tour-dfs.js` 91 行、0 个挖空、2 处 `log`；`tour-warnsdorff.js` 125 行、1 个挖空、2 处 `log`。

**Files:**
- Modify: `chess/core/algos/tour-dfs.js`
- Modify: `chess/core/algos/tour-warnsdorff.js`
- Modify: `chess/core/algos/tour.test.js`
- Modify: `chess/scripts/check.py`（划掉两个白名单项）

**Interfaces:**
- Consumes: `render(parts, lang)` 定版文本、`T.normalizeSource`
- Produces: `source({ W, H, start, lang })` × 2

⚠ **子序列门必须在两种语言下各跑一次。** 它今天只跑中文；双语之后英文那一侧同样要成立——不然英文读者看到的两份源码之间就没有那个「多出来的一段就是 Warnsdorff」的对照关系，而那正是这道题的全部意思。

- [ ] **Step 1: 先写门（会失败）**

在 `tour.test.js` 末尾、`T.report()` 之前插入：

```js
/* ---- 双语三道门 × 两份（规格 §7.5）---- */
const TOUR_SRC = { dfs: TD, warnsdorff: TW };   // ⚠ 别名以本文件顶部既有写法为准
for (const key of Object.keys(TOUR_SRC)) {
  const mod = TOUR_SRC[key];
  const zh = mod.source({ W: 5, H: 5, start: 0, lang: 'zh' });
  const en = mod.source({ W: 5, H: 5, start: 0, lang: 'en' });
  T.eq(en.split('\n').length, zh.split('\n').length, key + '：两种语言行数相同');
  T.eq(T.normalizeSource(en), T.normalizeSource(zh),
       key + '：抽掉注释与字符串之后，两种语言逐字节相同');
  T.eq(I.run(en, { host: {} }).trace.length, I.run(zh, { host: {} }).trace.length,
       key + '：两种语言的解释器步数相同');
  T.ok(zh !== en, key + '：两种语言的源码不是同一份');
  T.ok(/[一-鿿]/.test(zh), key + '：中文那一份里有汉字');
  T.ok(!/[一-鿿]/.test(E.parse(en, 'en').clean),
       key + '：英文那一份送到编辑器的文本里一个汉字都没有');
  T.throws(function () { mod.source({ W: 5, H: 5, start: 0 }); },
           key + '：缺 lang 必须抛', /少了 lang/);
  T.throws(function () { mod.source({ W: 5, H: 5, start: 0, lang: 'fr' }); },
           key + '：lang=fr 必须抛', /只认/);
}
```

**并且**：把这个文件里既有的那道**子序列门**改成两种语言各跑一次。做法是把它现有的断言体抽成一个吃 `lang` 的函数，然后 `['zh', 'en'].forEach(...)` 调两次——**断言消息里带上 lang**，否则红了看不出是哪一侧。

同时给所有既有 `source(` 调用补 `lang: 'zh'`。

- [ ] **Step 2: 跑，确认失败**

```bash
node chess/core/algos/tour.test.js
```

- [ ] **Step 3: 两份都复制 `render`、改 `source()`、改写 `HEAD`/`BODY`**

`render` 段用 Task 4 Step 3 那段 Python 从 `queens.js` 抽出来，**两份都原样贴**。

⚠ **两份的共用文字要一起改写。** 子序列关系是靠「同一段文字在两份里逐字相同」成立的——英文那一侧同样要逐字相同。最省事也最不容易出错的做法：**先写 `tour-dfs.js` 的英文，再把 `tour-warnsdorff.js` 里与它重合的片段整块复制过去**，然后只写 Warnsdorff 多出来的那一段。

- [ ] **Step 4: 跑测试**

```bash
node chess/core/algos/tour.test.js
```

期望：`0 failed`，且子序列门在 `zh` 与 `en` 两侧**各报一次通过**。

- [ ] **Step 5: 中文逐字节不变（两份）**

```bash
node -e '
const cp = require("child_process"), fs = require("fs"), path = require("path");
let bad = 0;
for (const name of ["tour-dfs", "tour-warnsdorff"]) {
  fs.writeFileSync("/tmp/t5-" + name + "-base.js",
    cp.execSync("git show f686833:chess/core/algos/" + name + ".js").toString());
  const OLD = require("/tmp/t5-" + name + "-base.js");
  const NEW = require(path.resolve("chess/core/algos/" + name + ".js"));
  for (const s of [{W:5,H:5,start:0}, {W:5,H:5,start:12}, {W:6,H:6,start:0}]) {
    const a = OLD.source(s);
    const b = NEW.source({ W: s.W, H: s.H, start: s.start, lang: "zh" });
    if (a !== b) { bad++; console.log(name + " " + JSON.stringify(s) + " 与基线不同"); }
  }
}
console.log(bad === 0 ? "OK 两份中文逐字节不变" : "FAIL " + bad + " 档不同");
process.exit(bad ? 1 : 0);
'
```

- [ ] **Step 6: 划掉白名单并跑总门**

从 `MONOLINGUAL_ALGOS` 删掉 `'tour-dfs.js'` 与 `'tour-warnsdorff.js'`：

```bash
python3 chess/scripts/check.py
```

期望：exit 0，`双语 algos 普查：4 份双语 / 4 份白名单，render 助手 4 份一致`。

- [ ] **Step 7: 英文自己读一遍**（同 Task 2 Step 7 四条；**额外一条**：两份共用的那一段英文，读起来在两份里都自然吗？还是为了逐字相同而在某一份里显得突兀？）

- [ ] **Step 8: 提交**

```bash
git status --short
git add chess/core/algos/tour-dfs.js chess/core/algos/tour-warnsdorff.js chess/core/algos/tour.test.js chess/scripts/check.py
git commit -m "feat(chess): tour-dfs.js / tour-warnsdorff.js 双语 —— 子序列门两种语言各跑一次"
git status --short
```

---

## Task 6：`rook-cover.js` 双语

167 行源码——**最长的一份**，0 个挖空、2 处 `log`。

这一份的文案有一处**格外要小心**：阶段 7 的最终审核在这里改过题面——「最大匹配 = 最少的车数」是数学上错的（一辆车是一条**边**；König 给的是最少的**线**）。现在的中文讲的是「最多能摆几辆互相吃不到的车」与「盖住每个空格最少要点亮几条线」。**英文必须讲同样这两句，不许在重写时滑回那个错误说法**（"the fewest rooks needed" 就是那个错的说法）。

**Files:**
- Modify: `chess/core/algos/rook-cover.js`
- Modify: `chess/core/algos/rook-cover.test.js`
- Modify: `chess/scripts/check.py`

**Interfaces:**
- Consumes: `render(parts, lang)` 定版文本、`T.normalizeSource`
- Produces: `AlgoRookCover.source({ W, H, blocked, lang }) -> string`

- [ ] **Step 1: 先写门（会失败）**

在 `rook-cover.test.js` 末尾、`T.report()` 之前插入（盘用这个文件既有的那几块）：

```js
/* ---- 双语三道门（规格 §7.5）---- */
const RC_BOARDS = [
  { W: 5, H: 5, blocked: [] },
  { W: 5, H: 5, blocked: [6, 8, 12, 16, 18] },
];
for (let i = 0; i < RC_BOARDS.length; i = i + 1) {
  const b = RC_BOARDS[i];
  const zh = RC.source({ W: b.W, H: b.H, blocked: b.blocked, lang: 'zh' });
  const en = RC.source({ W: b.W, H: b.H, blocked: b.blocked, lang: 'en' });
  T.eq(en.split('\n').length, zh.split('\n').length, '盘 ' + i + '：两种语言行数相同');
  T.eq(T.normalizeSource(en), T.normalizeSource(zh),
       '盘 ' + i + '：抽掉注释与字符串之后，两种语言逐字节相同');
  T.eq(I.run(en, { host: {} }).trace.length, I.run(zh, { host: {} }).trace.length,
       '盘 ' + i + '：两种语言的解释器步数相同');
}
const rcZh = RC.source({ W: 5, H: 5, blocked: [6, 8, 12, 16, 18], lang: 'zh' });
const rcEn = RC.source({ W: 5, H: 5, blocked: [6, 8, 12, 16, 18], lang: 'en' });
T.ok(rcZh !== rcEn, '两种语言的源码不是同一份');
T.ok(/[一-鿿]/.test(rcZh), '中文那一份里有汉字');
T.ok(!/[一-鿿]/.test(E.parse(rcEn, 'en').clean),
     '英文那一份送到编辑器的文本里一个汉字都没有');
T.throws(function () { RC.source({ W: 5, H: 5, blocked: [] }); },
         'rook-cover：缺 lang 必须抛', /少了 lang/);
T.throws(function () { RC.source({ W: 5, H: 5, blocked: [], lang: 'fr' }); },
         'rook-cover：lang=fr 必须抛', /只认/);

/* ---- 题面不许在重写英文时滑回那个数学错误 ----
   一辆车是二分图的一条**边**；König 给的是最少的**线**，不是最少的车。
   阶段 7 最终审核实测：最大匹配 5/7/7/9，而最少车数 5/4/5/5 —— 三档反例。
   所以英文里不许出现「fewest rooks（needed / required）」这个说法。 */
T.ok(!/fewest\s+rooks/i.test(rcEn), '英文题面没有说 "fewest rooks"');
T.ok(!/minimum\s+number\s+of\s+rooks/i.test(rcEn),
     '英文题面没有说 "minimum number of rooks"');
T.ok(/lines?/i.test(rcEn), '英文题面讲的是「线」');
```

⚠ `RC_BOARDS` 里那两块盘、以及模块别名 `RC`，**以这个测试文件既有的写法为准**。

同时给所有既有 `source(` 调用补 `lang: 'zh'`。

- [ ] **Step 2: 跑，确认失败**

```bash
node chess/core/algos/rook-cover.test.js
```

- [ ] **Step 3: 复制 `render`、改 `source()`、改写 `HEAD`/`BODY`**（同 Task 4 Step 3 的做法）

- [ ] **Step 4: 跑测试**

```bash
node chess/core/algos/rook-cover.test.js
```

- [ ] **Step 5: 中文逐字节不变**

```bash
node -e '
const cp = require("child_process"), fs = require("fs"), path = require("path");
fs.writeFileSync("/tmp/t6-rc-base.js",
  cp.execSync("git show f686833:chess/core/algos/rook-cover.js").toString());
const OLD = require("/tmp/t6-rc-base.js");
const NEW = require(path.resolve("chess/core/algos/rook-cover.js"));
const boards = [{W:5,H:5,blocked:[]}, {W:5,H:5,blocked:[6,8,12,16,18]},
                {W:7,H:7,blocked:[16,24,32]}, {W:2,H:2,blocked:[3]}];
let bad = 0;
for (const b of boards) {
  const a = OLD.source(b);
  const c = NEW.source({ W: b.W, H: b.H, blocked: b.blocked, lang: "zh" });
  if (a !== c) { bad++; console.log(JSON.stringify(b) + " 与基线不同"); }
}
console.log(bad === 0 ? "OK 中文逐字节不变" : "FAIL " + bad + " 档不同");
process.exit(bad ? 1 : 0);
'
```

- [ ] **Step 6: 划掉白名单并跑总门**

```bash
python3 chess/scripts/check.py
```

期望：exit 0，`双语 algos 普查：5 份双语 / 3 份白名单，render 助手 5 份一致`。

- [ ] **Step 7: 英文自己读一遍**（同 Task 2 Step 7 四条；**额外一条**：题面那两句——「最多能摆几辆互相吃不到的车」与「盖住每个空格最少要点亮几条线」——英文说的是不是**恰好这两件事**？两句都恰好等于最大匹配，那才是 König。）

- [ ] **Step 8: 提交**

```bash
git status --short
git add chess/core/algos/rook-cover.js chess/core/algos/rook-cover.test.js chess/scripts/check.py
git commit -m "feat(chess): rook-cover.js 双语 —— 题面守住 König 那两句"
git status --short
```

---

## Task 7：`king-greedy.js` + `king-exact.js` 双语

**两份必须同一个任务**：阶段 7 立过一道门——两份源码里**两条横线之间那一整段逐字节相同**（`king.test.js` 约 448 行）。一份改了另一份没改，它当场红。

`king-greedy.js` 133 行、3 处 `log`；`king-exact.js` 160 行、3 处 `log`。两份都没有挖空。

这一份的文案也有一处**格外要小心**：阶段 7 的落点是「7×7 那一档精确解**撞 200,000 步上限**」——屏幕上必须说「跑不完，判不了」，**绝不许说「8 是最优」**（贪心给出 8，工具**没有证明**它最优）。英文里那句关于上限的话，要跟中文一样是**否定式或带限定**的。

**Files:**
- Modify: `chess/core/algos/king-greedy.js`
- Modify: `chess/core/algos/king-exact.js`
- Modify: `chess/core/algos/king.test.js`
- Modify: `chess/scripts/check.py`

**Interfaces:**
- Consumes: `render(parts, lang)` 定版文本、`T.normalizeSource`
- Produces: `source({ W, H, blocked, lang })` × 2

- [ ] **Step 1: 先写门（会失败）**

在 `king.test.js` 末尾、`T.report()` 之前插入：

```js
/* ---- 双语三道门 × 两份（规格 §7.5）---- */
const KING_SRC = { greedy: KG, exact: KX };   // ⚠ 别名以本文件顶部既有写法为准
const KING_BOARDS = [
  { W: 5, H: 5, blocked: [6, 8, 12] },
  { W: 6, H: 6, blocked: [6, 24, 35] },
];
for (const key of Object.keys(KING_SRC)) {
  const mod = KING_SRC[key];
  for (let i = 0; i < KING_BOARDS.length; i = i + 1) {
    const b = KING_BOARDS[i];
    const zh = mod.source({ W: b.W, H: b.H, blocked: b.blocked, lang: 'zh' });
    const en = mod.source({ W: b.W, H: b.H, blocked: b.blocked, lang: 'en' });
    T.eq(en.split('\n').length, zh.split('\n').length,
         key + ' 盘 ' + i + '：两种语言行数相同');
    T.eq(T.normalizeSource(en), T.normalizeSource(zh),
         key + ' 盘 ' + i + '：抽掉注释与字符串之后，两种语言逐字节相同');
    T.eq(I.run(en, { host: {} }).trace.length, I.run(zh, { host: {} }).trace.length,
         key + ' 盘 ' + i + '：两种语言的解释器步数相同');
  }
  const b0 = KING_BOARDS[0];
  const zh0 = mod.source({ W: b0.W, H: b0.H, blocked: b0.blocked, lang: 'zh' });
  const en0 = mod.source({ W: b0.W, H: b0.H, blocked: b0.blocked, lang: 'en' });
  T.ok(zh0 !== en0, key + '：两种语言的源码不是同一份');
  T.ok(/[一-鿿]/.test(zh0), key + '：中文那一份里有汉字');
  T.ok(!/[一-鿿]/.test(E.parse(en0, 'en').clean),
       key + '：英文那一份送到编辑器的文本里一个汉字都没有');
  T.throws(function () { mod.source({ W: 5, H: 5, blocked: [] }); },
           key + '：缺 lang 必须抛', /少了 lang/);
  T.throws(function () { mod.source({ W: 5, H: 5, blocked: [], lang: 'fr' }); },
           key + '：lang=fr 必须抛', /只认/);
}
```

**并且**：把既有那道**共用段逐字节相同**的门（约 448 行，`T.eq(cg === cx, true, …)`）改成两种语言各跑一次，断言消息里带上 lang。

同时给所有既有 `source(` 调用补 `lang: 'zh'`。

- [ ] **Step 2: 跑，确认失败**

```bash
node chess/core/algos/king.test.js
```

- [ ] **Step 3: 两份都复制 `render`、改 `source()`、改写 `HEAD`/`BODY`**

⚠ **共用段的英文要逐字相同。** 跟 Task 5 同样的省事做法：**先写 `king-greedy.js` 的英文，再把共用段整块复制进 `king-exact.js`**，然后只写精确解多出来的那一段。

⚠ **关于步数上限那一段**：中文说的是「跑不完、判不了」。英文写成 `the exact search runs out of steps before it can answer` 一类的**否定式**；**不许**写成 `so 8 is optimal` 或 `the greedy answer is confirmed`。

- [ ] **Step 4: 跑测试**

```bash
node chess/core/algos/king.test.js
```

期望：`0 failed`，共用段门在 `zh` / `en` 两侧**各报一次通过**。

- [ ] **Step 5: 中文逐字节不变（两份）**

```bash
node -e '
const cp = require("child_process"), fs = require("fs"), path = require("path");
const boards = [{W:5,H:5,blocked:[6,8,12]}, {W:6,H:6,blocked:[6,24,35]},
                {W:6,H:6,blocked:[1,4,24]}, {W:7,H:7,blocked:[16,24,32]}];
let bad = 0;
for (const name of ["king-greedy", "king-exact"]) {
  fs.writeFileSync("/tmp/t7-" + name + "-base.js",
    cp.execSync("git show f686833:chess/core/algos/" + name + ".js").toString());
  const OLD = require("/tmp/t7-" + name + "-base.js");
  const NEW = require(path.resolve("chess/core/algos/" + name + ".js"));
  for (const b of boards) {
    const a = OLD.source(b);
    const c = NEW.source({ W: b.W, H: b.H, blocked: b.blocked, lang: "zh" });
    if (a !== c) { bad++; console.log(name + " " + JSON.stringify(b) + " 与基线不同"); }
  }
}
console.log(bad === 0 ? "OK 两份中文逐字节不变" : "FAIL " + bad + " 档不同");
process.exit(bad ? 1 : 0);
'
```

- [ ] **Step 6: 白名单收到只剩 `minimax.js`**

从 `MONOLINGUAL_ALGOS` 删掉 `'king-greedy.js'` 与 `'king-exact.js'`。**删完之后集合里必须只剩 `'minimax.js'` 一项**——这是本阶段白名单收缩完成的标志。

```bash
python3 chess/scripts/check.py
```

期望：exit 0，`双语 algos 普查：7 份双语 / 1 份白名单，render 助手 7 份一致`。

- [ ] **Step 7: 英文自己读一遍**（同 Task 2 Step 7 四条；**额外两条**：共用段的英文在两份里都自然吗？关于步数上限那一段，英文是不是也**没有**声称贪心的 8 是最优？）

- [ ] **Step 8: 提交**

```bash
git status --short
git add chess/core/algos/king-greedy.js chess/core/algos/king-exact.js chess/core/algos/king.test.js chess/scripts/check.py
git commit -m "feat(chess): king-greedy.js / king-exact.js 双语 —— 七份到齐，白名单只剩 minimax"
git status --short
```

---

## Task 8：页面接上 `lang`，切语言改成整份换文本

七份源码都双语了，但页面还在用不带 `lang` 的调用——`source()` 现在会**抛**，工具⑤ 此刻是坏的（Task 7 之后、Task 8 之前，页面打不开）。这一任务把它接回去，并把 `retextNotes()` 换成简单得多的整份替换。

**Files:**
- Modify: `chess/tools/chess-board-algorithms.html`

**Interfaces:**
- Consumes: 七份 `source({ …, lang })`
- Produces: `PROBLEMS[pid].source(st, M, file, lang)`——声明面多一个第四参数 `lang`

**为什么切语言可以不重跑解释器**：两种语言变体的**可执行代码逐字节相同、行号逐行对齐**（规格 §1.6），所以同一份轨迹在两种语言下完全有效——`Step.line` 指的还是同一行。切语言要做的只有一件事：把编辑器里的文本换成新语言那一份。这比今天的 `retextNotes()`（逐行查表对换注释）**更简单**，不是更复杂。

- [ ] **Step 1: `genSource` 与五个声明传 `lang`**

`genSource`（约 8933 行）改成：

```js
  function genSource(P, pv, file) {
    try {
      return { src: P.source(pv, MODS, file, curLang()), err: null };
    } catch (e) {
      return { src: '', err: { category: 'source', file: file, line: null,
                               message: (e && e.message) ? e.message : String(e) } };
    }
  }
```

五个 `PROBLEMS` 声明的 `source` 钩子各多吃一个 `lang` 并转发，例如 `queens`（约 7952 行）：

```js
      source: function (st, M, file, lang) {
        return M[file].source({ N: st.N, lang: lang });
      },
```

其余四个（`tourKnight` 约 8044、`knightPath` 约 8134、`rookCover` 约 8199、`kingDominate` 约 8315）同法——**把 `lang: lang` 加进那个已有的 opts 字面量**，别改其它参数。

⚠ 忘了转发的那一道题会**当场抛**「少了 lang」，红字写在它自己的编辑器上方（`genSource` 的 catch 已经接住并归到 `'source'` 类）。这正是 §1.6「必填」要的效果——**别加默认值把它压下去**。

- [ ] **Step 2: `retextNotes()` 换成整份重生成**

`retextNotes()`（约 11522 行）与 `swapNoteLines` 一并删除，换成：

```js
  /* ---------------- 切语言：整份源码换成新语言那一份 ----------------

     **不重跑解释器、不重建轨道。** 两种语言变体的可执行代码逐字节相同、
     行号逐行对齐（规格 §1.6），所以手上这份轨迹在新语言下**完全有效**：
     Step.line 指的还是同一行，pristine / answerRange / judge.herSrc 的
     行号一个都不用动。要换的只有摆在她眼前的那些字。

     ⚠ **她改过的源码一个字都不动。** 判据跟 saveSrc 用的是同一个：编辑器
     里的文本若还等于「当前语言/参数下生成的那一份」，说明她只是在读，
     静默换掉；只要不等，就原样留着，并在状态栏说明为什么没换（Reset to
     original 是既有的退路）。切语言不许吃掉她写了一半的答案。

     ⚠ 走遍**所有**题目，不只当前这一道：别的题目的轨道也已经建好了，只是
     没在屏幕上；不换的话，她切过去看到的是上一种语言的源码，而且再也不会
     被刷新。（这一条是 retextNotes 就有的，照旧。） */
  function retextSources() {
    const lang = curLang();
    let swapped = 0, kept = 0;
    PIDS.forEach(function (pid) {
      const P = PROBLEMS[pid], pv = paramsOf(pid);
      tracksOf(pid).forEach(function (tk, k) {
        if (tk.lang === lang) return;
        /* 她改过没有：拿轨道当前文本跟**旧语言**那一份生成结果比。
           比不出来（源码生成抛了）就当她改过，保守留着。 */
        const g = prepareSource(P, pv, tk.file, tk.role, false);
        if (g.err) { kept++; return; }
        if (tk.src !== tk.pristineSrc) { kept++; return; }
        tk.src = g.src;
        tk.pristineSrc = g.src;
        if (tk.ex) { tk.ex.pristine = g.ex ? g.ex.pristine : tk.ex.pristine; }
        tk.lang = lang;
        swapped++;
      });
    });
    return { swapped: swapped, kept: kept };
  }
```

⚠ **上面这段是形状，不是可以照抄的成品。** `tk` 上今天有没有 `pristineSrc` / `lang` / `role` / `file` 这几个字段、`prepareSource` 的第四第五参数该传什么、`exStateOf` 生成的 `ex` 该怎么接——**都要照这一页现有的写法核对之后再落笔**。核对不上就停下来报告，别硬凑一个新字段上去。

`relabel()`（约 11559 行）里的 `retextNotes();` 改成调用 `retextSources()`，并把它的 `{swapped, kept}` 用在下一步。

- [ ] **Step 3: 状态栏说明「你改过的那份没换」**

`kept > 0` 时在状态栏写一句双语文案（进这一页既有的 `STR` 字典，跟别的文案一个写法）：

```js
    keptOnLangSwitch: {
      zh: '你改过的源码保持原样 —— 切语言不会动它。要换成英文那一版，按 Reset to original。',
      en: 'Your edited source was left as it is — switching language never touches it. Press Reset to original for the Chinese version.',
    },
```

⚠ 这两句里的「英文那一版 / the Chinese version」是**写死的反向**，而真正的目标语言是运行时才知道的。要么按 `lang` 选词、要么把那半句改成不提语言名的说法（例如「按 Reset to original 换成这个语言的那一版」/ "Press Reset to original to get this language's version."）。**照抄上面那两句是错的**——它在其中一个方向上会说反。

- [ ] **Step 4: 浏览器里验**

```bash
python3 scripts/sync_registry.py --check
```

然后开预览（`preview_start {name: "mathviz"}`，**每次浏览器调用都带显式 `tabId`**），打开 `chess/tools/chess-board-algorithms.html`，探针**先断言 `TOOL.id === 'chess-board-algorithms'`** 再取值。逐条验：

1. 五道题各切一次语言，编辑器里的源码整份变了语言，**读数与轨道步数一个都没变**。
2. 在编辑器里改一个字符，切语言 → 源码**原样留着**，状态栏出现那句说明。
3. 按 `Reset to original` → 换成当前语言那一份。
4. 练习模式下：填对一个挖空 → 绿的「对了」→ 切语言 → **还是绿的「对了」**（这是 `retextNotes()` 注释里记着的那个旧缺陷，回归验一次）。
5. 第 4 级「填进编辑器」在切语言之后仍然能对齐（`answerRange` 没错位）。
6. `?lang=en` 直接打开 → 编辑器里一开始就是英文。

每条截一张图。

- [ ] **Step 5: 提交**

```bash
git status --short
git add chess/tools/chess-board-algorithms.html
git commit -m "feat(chess): 工具⑤ 接上 lang —— 切语言整份换源码，不重跑解释器"
git status --short
```

---

## Task 9：定版 1.3.0、注册、全量门与浏览器验收

**Files:**
- Modify: `chess/tools/chess-board-algorithms.html`（`tool-version` meta + `VERSION` 常量 + 页头 changelog）
- Modify: `chess/chess-tools.json`（`version` + `changelog`）
- Modify: `chess/index.html`
- Modify: `chess/app.html`

- [ ] **Step 1: 三处版本一起改**

`tool-version` meta **与** `VERSION` 常量必须一起从 `1.2.0` 改成 `1.3.0`（阶段 5 的裁定：这两个分开改过一次，面板徽章读 meta，于是两个数字能不一致而没人发现）。页头 changelog 加一条。

```bash
grep -n "tool-version\|VERSION = '1\." chess/tools/chess-board-algorithms.html
```

- [ ] **Step 2: 三处注册镜像**

`chess/chess-tools.json` 的 `version` 改成 `1.3.0` 并加 `changelog` 条目；`chess/index.html` 与 `chess/app.html` 里工具⑤ 的版本随之更新。

```bash
python3 scripts/sync_registry.py --check
```

- [ ] **Step 3: 全量门**

```bash
python3 chess/scripts/check.py
```

期望：exit 0，**八道门都跑到底**，且 `双语 algos 普查：7 份双语 / 1 份白名单，render 助手 7 份一致`。

```bash
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' chess/tools/chess-board-algorithms.html | node --check /dev/stdin
```

- [ ] **Step 4: 阶段 5/6/7 没被碰坏**

```bash
node -e '
const cp = require("child_process"), fs = require("fs"), path = require("path");
const files = ["queens","knight-path","tour-dfs","tour-warnsdorff","rook-cover","king-greedy","king-exact"];
const params = {
  "queens": [{N:4},{N:6},{N:8},{N:9}],
  "knight-path": [{W:5,start:0,target:10},{W:5,start:0,target:24}],
  "tour-dfs": [{W:5,H:5,start:0},{W:6,H:6,start:0}],
  "tour-warnsdorff": [{W:5,H:5,start:0},{W:6,H:6,start:0}],
  "rook-cover": [{W:5,H:5,blocked:[]},{W:7,H:7,blocked:[16,24,32]}],
  "king-greedy": [{W:5,H:5,blocked:[6,8,12]},{W:7,H:7,blocked:[16,24,32]}],
  "king-exact": [{W:5,H:5,blocked:[6,8,12]},{W:6,H:6,blocked:[1,4,24]}],
};
let bad = 0, n = 0;
for (const f of files) {
  fs.writeFileSync("/tmp/t9-" + f + "-base.js",
    cp.execSync("git show f686833:chess/core/algos/" + f + ".js").toString());
  const OLD = require("/tmp/t9-" + f + "-base.js");
  const NEW = require(path.resolve("chess/core/algos/" + f + ".js"));
  for (const p of params[f]) {
    const q = Object.assign({}, p, { lang: "zh" });
    n++;
    if (OLD.source(p) !== NEW.source(q)) { bad++; console.log(f + " " + JSON.stringify(p)); }
  }
}
console.log(bad === 0 ? "OK 七份中文共 " + n + " 档全部逐字节不变"
                      : "FAIL " + bad + "/" + n + " 档与基线不同");
process.exit(bad ? 1 : 0);
'
```

再确认五个挖空原封：

```bash
node -e '
const cp = require("child_process"), fs = require("fs"), path = require("path");
const E = require("./chess/core/exercise.js");
const spec = { "queens": {N:6}, "knight-path": {W:5,start:0,target:24},
               "tour-warnsdorff": {W:5,H:5,start:0} };
let total = 0;
for (const f of Object.keys(spec)) {
  const M = require(path.resolve("chess/core/algos/" + f + ".js"));
  for (const lang of ["zh", "en"]) {
    const p = E.parse(M.source(Object.assign({}, spec[f], { lang: lang })), lang);
    console.log(f + " " + lang + "：" + p.blanks.length + " 个挖空，startLine=" +
                p.blanks.map(b => b.startLine).join(","));
    if (lang === "zh") total += p.blanks.length;
  }
}
console.log("中文侧挖空总数 " + total + "（阶段 6/7 是 5）");
'
```

期望：中文侧总数是 **5**，且**每一题两种语言的 `startLine` 完全相同**（逐行对齐不变式的直接体现）。不同就停下来报告。

- [ ] **Step 5: 浏览器正式验收（截图是验收仪式）**

`preview_start {name: "mathviz"}`，**每次调用都带显式 `tabId`**，探针**先断言 `TOOL.id === 'chess-board-algorithms'`**。逐条截图：

1. 五道题 × 两种语言 = 10 张编辑器截图，源码语言正确、**没有一处中英混排**。
2. `OUTPUT` 栏在英文下印的是英文日志（`kingDominate` 那三条最好认）。
3. 版本徽章显示 `1.3.0`。
4. 中文界面下的五道题源码与 1.2.0 **视觉上一模一样**（中文没动）。
5. `chess/index.html` 与 `chess/app.html` 里工具⑤ 的卡片版本是 1.3.0。

- [ ] **Step 6: 提交**

```bash
git status --short
git add chess/tools/chess-board-algorithms.html chess/chess-tools.json chess/index.html chess/app.html
git commit -m "feat(chess): 工具⑤ 1.3.0 —— 双语算法源码定版"
git status --short
```

- [ ] **Step 7: 开 PR，等用户在对话里确认合并**

```bash
git push -u origin claude/chess-phase8-bilingual
gh pr create --title "阶段 8：双语算法源码与运行日志 —— 工具⑤ 1.3.0" --body "…"
```

**不要自己合并。**

---

## 遗留（阶段 9 及以后，按优先级）

1. `minimax.js`（工具④）双语 —— 要重做工具④ 的验收，单独一阶段
2. 把「声明文案过长」那道**长度代理**门换成真的量版面（阶段 7 记的第一件事）
3. 给 `king-*.js` 加挖空时必须同时声明 `exerciseSources`
4. 19 条旧 `T.throws` 补 pattern
5. `king.test.js` 的随机扫描里加一块**必然截断**的盘
6. 扩展题目：`bitboard` / `pathCount` / `independent` / `fieldBFS`

---

## 自查（写完计划后对着规格过了一遍）

- **规格覆盖**：§1.6 的六条裁定 → `lang` 必填（Task 2 Step 3）、英文重写不对译（每个文案任务 Step 7）、代码逐字节相同（三道门）、BLANK 不翻译（Task 2 Step 4 的字符串片段）、逐行对齐（`render` 的行数校验 + 三道门第三条）、切语言行为（Task 8 Step 2/3）。§7.5 三道门 → 每个文案任务 Step 1。§7.5 的临时中文基线门 → 每个文案任务 Step 5 + Task 9 Step 4。§8 的两条人工审查判据 → 每个文案任务 Step 7。
- **占位符扫描**：无 TBD/TODO。Task 8 Step 2 的代码块**显式标注为「形状，不是成品」**并给了核对清单——这是诚实的不确定，不是占位符：那一页的 `tk` 字段名要照现场核对，凭空写死一个字段名才是缺陷。
- **类型一致**：`normalizeSource`（Task 1 定义 → Task 2/4/5/6/7 使用）、`render(parts, lang)`（Task 2 定版 → Task 4–7 复制 → Task 3 门核对）、`source({…, lang})`（Task 2–7 → Task 8 调用）、`bilingual_algos_check()` 与 `MONOLINGUAL_ALGOS`（Task 3 定义 → Task 4/5/6/7 收缩）——名字全对得上。
- **两处故意留在计划里的错**，都当场标注了、且都有门会抓：Task 2 Step 4 的 `en` 块比 `zh` 多一行（`render` 抛），Task 8 Step 3 的状态栏文案写死了反向语言名（照抄就说反）。留着是因为这两下是**实际写的时候最常犯的**，标注出来比藏起来有用。
