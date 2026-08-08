# 阶段 9b：解释器加 BigInt 与位运算 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 `chess/core/interp.js` 加上 BigInt（`123n` 字面量 + `BigInt(x)` 内建）与 `& | ^ ~ << >>` 六个位运算符，并以一段**真的位盘代码探针**收尾——它要回答「9d 写位盘时这个子集够不够用」，而不是停在「六个运算符能跑」。

**Architecture:** 六个运算符**直接借原生实现**（`case '&': return l & r;`），ToInt32、`>>` 符号位、BigInt 任意精度、混用当场抛全部白送，也不会跟差分测试的参照实现分岔。因此这一段真正承重的不是「运算语义」，而是**词法与解析有没有把 token 送到正确位置**：`BINOP` 表是**重排**（位运算夹在 `&&` 与相等之间、移位夹在关系与加减之间，六层变十层），会动到已有表达式的解析结果。判据一律是 §7.3 的差分测试——同一份源码交给自写解释器和原生 `Function`，比对返回值、抛错文字与宿主调用序列。

**Tech Stack:** 零依赖 ES 子集 JavaScript（`node` 直跑 + 浏览器内联）；Python 3 的 `chess/scripts/check.py`（九道门）与 `chess/scripts/inline_core.py`；无构建、无包管理器。

## Global Constraints

**每次派发子代理都必须带上这一句：**

> 如果计划里某段代码是错的、或某个测试断言了一件事实上错误的事，停下来报告，不许改代码或改测试去迁就它。计划是记录，不是权威。

- **规格**是 `docs/superpowers/specs/2026-08-02-chess-viz-suite-design.md`，本阶段相关的是 **§7.7**（含「9b 开工前定下的（2026-08-08）」七条）、**§7.3**（差分测试）、**§2.6**（子集边界）。
- **本阶段的基线 commit 是 `afb4cb0`**，分支 `claude/chess-phase9b`。要对照「改动前」的一律 `git show afb4cb0:<path>`。
- **判据是差分，不是写死的期望值。** 新增行为一律优先走 `interp.test.js` 里已有的 `diff(src, label)` / `sameAsNative(src, label)` / `nativeRejects(src, label, pattern)` 三个助手；只有在**原生支持而我们故意不支持**时才写死断言（那种情况下必须写明「这是子集边界，不是缺陷」）。
- **`T.throws(fn, label, pattern)` 的 pattern 必须含一段守卫自己的固定文案**，不许只锚测试自己喂进去、又被回显出来的值（阶段 9a 第九道门 + `chess/scripts/throws_swap_census.py`）。补完跑一次 `python3 chess/scripts/check.py`，看**第九道门自己那一行**。
- **`_test.js` 是全仓地基**：改它要跑全部 18 个测试文件，不是只跑 `interp.test.js`。
- ES 子集（只约束 `algos/*.js` **生成出来的**教学源码，不约束 `interp.js` 自身）：没有模板字面量、没有正则字面量，字符串用 `+` 拼。
- 本仓无构建/lint/测试工具链。单测 = `node chess/core/xxx.test.js`；总门 = `python3 chess/scripts/check.py`（exit 0 + 九道门各自那一行）。
- **`git status --short` 之后只暂存显式路径**；禁止 `git add -A` / `git commit -a`。`.githooks/pre-commit` 会重跑 `inline_core.py` 并**再暂存**（它读**磁盘**上的 `chess/core/**/*.js`），**钩子跑完要再看一遍 `git status --short`**。
- ⚠ **突变实验前先把文件拷进 scratchpad（带任务前缀，如 `t3-interp.js.bak`），绝不要用 `git checkout --` 还原**——那会把整个文件退回 HEAD，本任务的活全没。
- ⚠ **只看 `check.py` 的退出码会误判**——必须在输出里找到你想验的**那道门自己那一行**。
- ⚠ **本地绿 ≠ CI 绿**。开 PR 后 `gh pr checks <PR#>`。

---

## 文件结构

| 文件 | 责任 | 本阶段动作 |
|---|---|---|
| `chess/core/_test.js` | 全仓共用断言器 | `eq` 加 BigInt replacer（Task 1） |
| `chess/core/_test.self.test.js` | 断言器自测 | 加编码撞车断言（Task 1） |
| `chess/core/interp.js` | 解释器 | 词法（Task 2）、`BINOP` 重排 + 五个二元位运算符（Task 3）、一元 `~`（Task 4）、`Update` 类型分支（Task 5）、`BigInt` 内建（Task 6） |
| `chess/core/interp.test.js` | 解释器测试 | 每个任务各自补；差分矩阵（Task 7）；9a 那笔债（Task 8）；位盘探针（Task 10） |
| `chess/core/debugger.js` | ④⑤ 共用调试器 | `fmtVal` 加 `bigint` 分支（Task 9） |
| `chess/core/debugger.test.js` | 调试器测试 | `fmtVal` 已有单测区（`:1013-1019`），加三条（Task 9） |
| `chess/tools/chess-search-minimax.html`<br>`chess/tools/chess-board-algorithms.html`<br>`chess/tools/_debugger-preview.html` | 内联镜像 | Task 9 由 `inline_core.py` 重新生成，**不手改** |

**`interp.js` 里会被碰到的六处**（行号是基线 `afb4cb0` 的，实施时以 `grep` 为准，别信行号）：

| 位置 | 现状 | 任务 |
|---|---|---|
| `:162` `checkNumTail` | 见到 `n` 会当成「数字后跟标识符字符」毙掉 | Task 2 |
| `:190-260` 四条数字通道 | 十进制 / `0x` / `0o` / `0b` | Task 2 |
| `:499-505` `BINOP` | 六层 | Task 3（**重排成十层**） |
| `:514-522` `UNSUPPORTED_BINOP` | 七条（`**` `??` + 五个位运算符） | Task 3（删五条，留两条） |
| `:450-456` `checkUnsupported` 的 `~` 分支 | 抛 `the ~ operator (bitwise not)` | Task 4（删） |
| `:536` `UNARY_OPS` | `{ '-': true, '+': true, '!': true }` | Task 4 |
| `:1639-1656` `applyBinary` | 十三个 case | Task 3（加五个） |
| `:1750-1755` `Unary` case | `-` / `+` / `!` | Task 4 |
| `:1757-1770` `Update` case | `Number(old) + 1` | Task 5 |
| `:2231` `MATH_NS` / `:2323-2331` `makeRootEnv` | 注入 `log`/`mark`/`place`/`clear`/`attacked`/`Math` | Task 6 |

---

## 并行编排

| 轮 | 并行 | 依据 |
|---|---|---|
| 1 | **Task 1 单独** | `eq` 的 BigInt replacer 是地基：Task 2 起每个任务的 `sameAsNative` / `diff` 都要它，没有它 `JSON.stringify(1n)` 当场抛 |
| 2 | **Task 2 → 3 → 4 → 5 → 6 串行** ∥ **Task 9（独立 worktree）** | 2–6 全在 `interp.js` 同一个文件里，并行只会制造合并冲突；Task 9 只碰 `debugger.js` + `debugger.test.js`，文件与判据都不相交 |
| 3 | **Task 7 单独** | 差分矩阵要 2–6 全落地才有得测 |
| 4 | **Task 8 ∥ Task 10** | Task 8 只改 `interp.test.js` 的 `nativeRejects` 那一段（`:160-176`），Task 10 只在文件末尾追加探针段——同文件但不相邻，派 worktree 后合并冲突面小；**若实施时觉得不稳，改成串行，别硬并** |

⚠ **派 worktree 任务必须写「先核实基建到位」的命令**——`isolation:"worktree"` 的基线不一定是当前分支，而失败是**安静的**（进程正常退出、测试全绿、只是什么都没生成）。Task 9 的核实命令写在它自己的 Step 0。

---

## Task 1：`_test.js` 的 `eq` 认 BigInt

`JSON.stringify(1n)` 抛 `Do not know how to serialize a BigInt`（实测）。`eq` 两边都走 `JSON.stringify`，所以在这条修好之前，**后面每一个任务的第一条测试都会以引擎异常的形式炸掉**，而不是以「断言失败」的形式。这是地基，单独一轮。

编码不能跟字符串撞：编成 `"5"` 就跟字面字符串 `"5"` 撞、编成 `"5n"` 就跟字面字符串 `"5n"` 撞，**一撞就是「真不一致却判相等」的静默漏**（规格 §7.7 第 ⑥ 条）。用一个不可能与真实值重合的形状，并且**把这条区分写成断言**——没有断言守着的编码选择等于没选。

**Files:**
- Modify: `chess/core/_test.js`（`eq`，`:5-9`）
- Test: `chess/core/_test.self.test.js`

**Interfaces:**
- Produces: `T.eq(a, b, label)` 在 `a`/`b`（或它们内部任意深度）含 BigInt 时不再抛，且 BigInt 只与同值 BigInt 相等
- Consumes: 无

- [ ] **Step 1: 写会失败的测试**

在 `chess/core/_test.self.test.js` 里、`/* ---- 审计模式（阶段 9a）---- */` 那一段**之前**插入：

```js
/* ---- eq 认 BigInt（阶段 9b，规格 §7.7 ⑥）----
   JSON.stringify(1n) 抛 `Do not know how to serialize a BigInt`，而 eq 两边
   都走 JSON.stringify —— 不修的话，9b 之后任何一条比较 BigInt 的断言都会
   以「引擎异常炸掉整个测试文件」的形式失败，而不是以「断言失败」的形式。

   编码必须跟字符串区分得开：编成 "5" 就跟字面字符串 "5" 撞、编成 "5n" 就
   跟字面字符串 "5n" 撞。撞了的后果不是报错，是**真不一致却判相等** —— eq
   是全仓 18 个测试文件的地基，这种漏是静默的。下面四条里，前两条验「同值
   相等」，后两条验「不跟字符串撞」，**后两条才是这条设计的守卫**。 */
let bigOk = null;
try { T.eq(5n, 5n, 'eq：同值 BigInt 相等'); bigOk = 'no-throw'; }
catch (e) { bigOk = e.message; }
T.eq(bigOk, 'no-throw', 'eq 比较 BigInt 时不再抛引擎异常');
T.ok(!T.wouldPass(5n, '5'), 'eq：BigInt 5n 与字符串 "5" 必须判不等');
T.ok(!T.wouldPass(5n, '5n'), 'eq：BigInt 5n 与字符串 "5n" 必须判不等');
T.ok(!T.wouldPass(5n, 5), 'eq：BigInt 5n 与数字 5 必须判不等');
T.ok(T.wouldPass([1n, { a: 2n }], [1n, { a: 2n }]), 'eq：嵌套在数组/对象里的 BigInt 也认');
```

`wouldPass(a, b)` 是这一步要新加的旁路：直接调 `eq` 会把「判不等」记成一条真失败。它必须**跟 `eq` 共用同一套比较逻辑**，不能各写一份（两份逻辑迟早分岔，那时这四条断言守的就不是 `eq` 了）。

- [ ] **Step 2: 跑一遍，确认它失败**

```bash
node chess/core/_test.self.test.js
```

期望：`TypeError: T.wouldPass is not a function`。

- [ ] **Step 3: 改 `_test.js`**

把 `chess/core/_test.js:5-9` 的 `eq` 改成（**共用一个 `ser`，`wouldPass` 与 `eq` 不各写一份**）：

```js
/* JSON.stringify 遇到 BigInt 直接抛（`Do not know how to serialize a BigInt`），
   而阶段 9b 起解释器会产出 BigInt 值（规格 §7.7）。replacer 把它换成一个
   **不可能与任何真实值重合**的形状：字符串 "5" 会跟字面字符串 "5" 撞、
   "5n" 会跟字面字符串 "5n" 撞，撞了就是「真不一致却判相等」，而 eq 是全仓
   18 个测试文件的地基 —— 这种漏是静默的。`__bigint__` 这个键名要撞上，得有
   人恰好构造出 { __bigint__: "5" } 这个对象来跟一个 BigInt 比较。
   _test.self.test.js 里有四条断言钉着这件事，别把编码改成字符串。 */
function serialize(v) {
  return JSON.stringify(v, function (k, val) {
    return typeof val === 'bigint' ? { __bigint__: val.toString() } : val;
  });
}

function eq(actual, expected, label) {
  const a = serialize(actual), e = serialize(expected);
  if (a === e) { passed++; return; }
  failures.push(label + '\n    expected: ' + e + '\n    actual:   ' + a);
}

/* 只回答「这两个值在 eq 眼里相不相等」，不记账、不产生失败 —— 供
   _test.self.test.js 验证 eq 自己的判定，不然「验证 eq 判不等」这件事
   本身会被记成一条真失败。跟 eq 共用 serialize，不另写一套比较逻辑。 */
function wouldPass(actual, expected) {
  return serialize(actual) === serialize(expected);
}
```

并在 `_test.js` 末尾的导出对象里加上 `wouldPass: wouldPass`（`eq` 旁边）。

- [ ] **Step 4: 跑一遍，确认它通过**

```bash
node chess/core/_test.self.test.js
```

期望：**30 passed, 0 failed**。算法：基线 24，本步加 6 条——`try` 里那条 `T.eq(5n, 5n, …)` 自己记一条、`T.eq(bigOk, …)` 一条、四条 `T.ok`。**数字对不上就停下来查为什么，别改期望值去迁就。**

- [ ] **Step 5: 突变验证——编码撞车必须被抓**

把 `serialize` 的 replacer 改成 `return typeof val === 'bigint' ? val.toString() + 'n' : val;`（编成字符串 `"5n"`），再跑：

```bash
node chess/core/_test.self.test.js
```

期望：`eq：BigInt 5n 与字符串 "5n" 必须判不等` **FAIL**。**这是判据**——如果它仍然全绿，说明那四条断言没有守住任何东西，停下来报告。验完从 scratchpad 的备份还原（`cp` 回来，**不要 `git checkout --`**）。

- [ ] **Step 6: 跑全仓，确认地基没被动坏**

```bash
python3 chess/scripts/check.py
```

期望：exit 0，九道门全过。`eq` 是 18 个测试文件共用的，这一步不是形式主义。

- [ ] **Step 7: Commit**

```bash
git add chess/core/_test.js chess/core/_test.self.test.js
git commit -m "test(chess): _test.js 的 eq 认 BigInt —— 编码不跟字符串撞，且这条区分有断言守着"
```

---

## Task 2：词法器认 `123n`

**Files:**
- Modify: `chess/core/interp.js`（`checkNumTail` `:162`；四条数字通道 `:190-260`）
- Test: `chess/core/interp.test.js`（`sameAsNative` / `nativeRejects` 那一段，`:125-176`）

**Interfaces:**
- Consumes: Task 1 的 `T.eq` BigInt 支持（`sameAsNative` 内部就是 `T.eq(lexValue(src), nativeValue(src))`）
- Produces: `I.tokenize('1n')` 得到一个 `{type:'num', value: 1n}` 的 token；`parsePrimary` 一个字不用改（它只是把 `t.value` 塞进 `Num` 节点）

**原生实测（`node -e` 跑过，不是记忆）**：`0x1Fn`→`31n`、`0o17n`→`15n`、`0b101n`→`5n` **全部合法**；`1.5n` / `1e3n` / `01n` 是 `SyntaxError: Invalid or unexpected token`。

- [ ] **Step 1: 写会失败的测试**

在 `chess/core/interp.test.js` 的 `sameAsNative('0B101', '二进制（大写 B）');` 那一行**之后**插入：

```js
/* ---- BigInt 字面量（阶段 9b，规格 §7.7 ①）----
   四条数字通道各自吃一个可选的 n。原生实测：0x1Fn / 0o17n / 0b101n 合法，
   1.5n / 1e3n / 01n 是 SyntaxError —— 也就是说 n 后缀只跟**整数**形态相容，
   带小数点或指数的一律拒绝。这里不写死期望值，照旧问原生要答案。 */
sameAsNative('1n', 'BigInt 十进制');
sameAsNative('0n', 'BigInt 零');
sameAsNative('123456789012345678901234567890n', 'BigInt 超出 Number 安全整数范围');
sameAsNative('0x1Fn', 'BigInt 十六进制');
sameAsNative('0o17n', 'BigInt 八进制');
sameAsNative('0b101n', 'BigInt 二进制');

nativeRejects('1.5n', '小数不能加 n 后缀',
              'Invalid number: a numeric literal cannot be immediately followed by "n"');
nativeRejects('1e3n', '科学计数法不能加 n 后缀',
              'Invalid number: a numeric literal cannot be immediately followed by "n"');
```

`01n` 不用单独写：`01` 已经先撞上 `:255` 那条 leading-zero 守卫，跟 `n` 没关系。

**数字分隔符 `1_000n` 不加**（规格 §7.7 末句）：原生支持它，但本子集连 `1_000` 都不支持——9b 不在这儿扩边界。**不要顺手加**，也不要为它写测试（写了就等于承诺）。

- [ ] **Step 2: 跑一遍，确认它失败**

```bash
node chess/core/interp.test.js
```

期望：`BigInt 十进制 —— 与原生一致：1n` **FAIL**（我们抛 `a numeric literal cannot be immediately followed by "n"`，而原生给 `1n`）。

- [ ] **Step 3: 改词法器**

`checkNumTail` 上方补一句注释、签名加一个「已经吃掉 n 了吗」的开关不是必要的——更简单的做法是**在调用 `checkNumTail` 之前把可选的 `n` 吃掉**，这样 `checkNumTail` 本身一个字不用改，它的语义仍然是「数字字面量之后不许紧跟数字或标识符起始字符」，而 `n` 已经不在「之后」了。

三条前缀通道（`0x` / `0o` / `0b`）各自改成这个形状（以 `0x` 为例，另外两条同理，**把 16/8/2 与 `hs`/`os`/`bs` 换成各自的**）：

```js
        if (c === '0' && (peek(1) === 'x' || peek(1) === 'X')) {
          adv(2);
          const hs = i;
          while (i < src.length && /[0-9a-fA-F]/.test(src[i])) adv();
          if (i === hs) throw err('Invalid number: expected hex digits after 0x', sl, sc);
          const hd = src.slice(hs, i);
          /* BigInt 后缀（阶段 9b，规格 §7.7 ①）：n 必须在 checkNumTail 之前
             吃掉，否则它会把 n 当成「数字后面紧跟标识符起始字符」毙掉。吃掉
             之后 checkNumTail 的语义一个字没变，仍然是「1nx / 1n5 要报错」。 */
          if (i < src.length && src[i] === 'n') {
            adv();
            checkNumTail(sl, sc);
            push('num', BigInt('0x' + hd), start, sl, sc);
            continue;
          }
          checkNumTail(sl, sc);
          push('num', parseInt(hd, 16), start, sl, sc);
          continue;
        }
```

（`0o` 用 `BigInt('0o' + os_digits)`，`0b` 用 `BigInt('0b' + bs_digits)`——`BigInt()` 本身认这三种前缀，不必自己换算。）

十进制通道要多一个条件：**只有整数形态才允许 `n`**。在 `:246` 吃完整数位、`:250` 那个可选小数点与 `:258` 那个可选指数**之前**，先记一个标记：

```js
        const intEnd = i;   // 整数位到此为止；下面若吃了小数点或指数，就不再是整数形态
        if (i < src.length && src[i] === '.') { …原样… }
        if (i < src.length && (src[i] === 'e' || src[i] === 'E')) { …原样… }

        /* n 后缀只跟整数形态相容 —— 原生实测 1.5n / 1e3n 都是 SyntaxError。
           `i === intEnd` 就是「小数点与指数两段都一个字符没吃」的意思；不成立
           时不吃 n，让 checkNumTail 照常把它报成「数字后面紧跟 n」，跟原生
           一样拒绝（消息措辞不同，但两边都拒绝，nativeRejects 只要求这个）。 */
        if (i === intEnd && i < src.length && src[i] === 'n') {
          adv();
          checkNumTail(sl, sc);
          push('num', BigInt(src.slice(start, intEnd)), start, sl, sc);
          continue;
        }

        checkNumTail(sl, sc);
        push('num', parseFloat(src.slice(start, i)), start, sl, sc);
        continue;
```

- [ ] **Step 4: 跑一遍，确认它通过**

```bash
node chess/core/interp.test.js
```

期望：新加的 8 条全过，其余一条不动。**记下这个文件改前改后的通过数**（基线 `667`），下一步要用。

- [ ] **Step 5: 突变验证——`n` 吃早了会被抓**

把十进制通道那个 `i === intEnd &&` 条件删掉（也就是允许 `1.5n`），跑：

```bash
node chess/core/interp.test.js
```

期望：`小数不能加 n 后缀` **FAIL**（我们不再拒绝，原生仍然拒绝）。验完从 scratchpad 备份还原。

- [ ] **Step 6: Commit**

```bash
git add chess/core/interp.js chess/core/interp.test.js
git commit -m "feat(chess): 词法器认 BigInt 字面量 —— 四条数字通道各吃一个可选的 n"
```

---

## Task 3：五个二元位运算符（`BINOP` 重排 + `applyBinary`）

⚠ **这一条是重排不是追加。** JS 真实优先级里位运算夹在 `&&` 与相等之间、移位夹在关系与加减之间，所以整张表要从六层变十层。**重排会动到已有表达式的解析结果**——差分必须专门覆盖混合优先级，而不只覆盖新运算符自己。

**Files:**
- Modify: `chess/core/interp.js`（`BINOP` `:499-505`；`UNSUPPORTED_BINOP` `:514-522`；`applyBinary` `:1639-1656`）
- Modify: `chess/core/interp.test.js`（删 `:1069-1071` `:1073-1074` 五条拒绝测试；加差分）

**Interfaces:**
- Consumes: Task 2 的 BigInt 字面量（差分里要写 `5n & 3n`）
- Produces: `I.run('return 5 & 3;').result === 1`；`applyBinary` 认 `& | ^ << >>`

- [ ] **Step 1: 写会失败的测试**

在 `chess/core/interp.test.js` 的差分段里（`// ---- 算术与比较 ----` 那一族之后）插入：

```js
// ---- 位运算：二元五个（阶段 9b，规格 §7.7 ⑤）----
/* 借原生实现，所以「Number×Number」这一档基本是形式上的 —— 真正承重的是
   下面的**混合优先级**与「混用」那一档。列在这里是为了矩阵完整、一眼能看出
   哪一格没覆盖，不是因为它们各自有多大风险（规格 §7.7 ⑤ 写明了这一点）。 */
diff('return 5 & 3;', '按位与');
diff('return 5 | 3;', '按位或');
diff('return 5 ^ 3;', '按位异或');
diff('return 5 << 2;', '左移');
diff('return -20 >> 2;', '右移（负数，验符号位）');

/* 混合优先级：这五条是**这个任务真正的判据**。BINOP 是重排不是追加，
   排错一层就会静默改变已有表达式的解析结果。每一条都挑了在两种排法下
   **算出不同答案**的形状 —— 换句话说，把 BINOP 里任意两层对调，下面至少
   有一条会红。挑不出区分力的形状（比如 `1 | 2 & 3`，两种排法都得 3）
   放进来等于装饰，那正是阶段 9a 那道门要治的病。 */
diff('return 1 | 2 & 2;', '优先级：& 紧于 |');
diff('return 3 ^ 1 | 2;', '优先级：^ 紧于 |');
diff('return 1 & 3 ^ 2;', '优先级：& 紧于 ^');
diff('return 1 & 2 === 2;', '优先级：=== 紧于 &');
diff('return 1 << 2 + 3;', '优先级：+ 紧于 <<');
diff('return 8 >> 1 + 1;', '优先级：+ 紧于 >>');

// ---- 位运算 × BigInt / 混用（规格 §7.7 开头：混用那一档是重点）----
diff('return 5n & 3n;', 'BigInt 按位与');
diff('return 5n | 3n;', 'BigInt 按位或');
diff('return 5n ^ 3n;', 'BigInt 按位异或');
diff('return 5n << 2n;', 'BigInt 左移');
diff('return -5n >> 1n;', 'BigInt 右移（负数）');
diff('return 5n & 3;', '混用：& —— 原生抛 Cannot mix BigInt');
diff('return 5n | 3;', '混用：|');
diff('return 5n ^ 3;', '混用：^');
diff('return 5n << 2;', '混用：<<');
diff('return 5n >> 1;', '混用：>>');

/* `>>>` 明确不加（规格 §7.7）：它对 BigInt 在 JS 里本来就抛，位盘也用不着。
   但它现在的**拒绝路径变了**，要钉一条：`PUNCT` 表里没有 `>>>`，改之前
   `1 >>> 2` 词法成 `>>` + `>`，而 `>>` 是 UNSUPPORTED_BINOP、当场报「不支持
   右移」；改之后 `>>` 合法了，于是走到 `>` 上，报的是一句 syntax 错误。
   两种都拒绝，但**消息完全不同** —— 不钉住的话，将来谁把 `>>>` 加进 PUNCT
   都不会有测试拦他。pattern 锚的是 parsePrimary 自己那句固定文案。 */
T.throws(function () { I.parse('return 1 >>> 2;'); },
         '`>>>` 不在子集里（规格 §7.7 明确不加）',
         'Unexpected token: ">"');
```

推演：`1 >>> 2` 词法成 `1` / `>>` / `>` / `2`，`parseBinary` 吃掉 `>>` 之后右手边落到 `parsePrimary`，它对一个裸 `>` 抛 `interp.js:739` 那句 `Unexpected token: ">"`。**这是推的，不是跑出来的——第一次跑到这条时把真实消息抄下来核对，对不上就以真实消息为准并在报告里说明。**

同时**删掉** `chess/core/interp.test.js` 里这五条（`:1069-1071` 与 `:1073-1074`）：

```js
unsupportedCheck('return 1 & 2;', '&', 'B5: 位运算 &（原来词法器直接报 Unexpected character）');
unsupportedCheck('return 1 | 2;', '|', 'B5: 位运算 |');
unsupportedCheck('return 1 ^ 2;', '^', 'B5: 位运算 ^');
unsupportedCheck('return 1 << 2;', '<<', 'B5: 左移 <<');
unsupportedCheck('return 1 >> 2;', '>>', 'B5: 右移 >>');
```

并在它们原来的位置留一条注释（规格 §7.7 要求写明是「边界移动」而不是「测试挡路」）：

```js
/* 五条位运算符的「不支持」断言在阶段 9b 删掉了 —— **子集边界移动了**
   （规格 §2.6 与 §7.7），不是测试挡路。`~` 那一条在 Task 4 一起删。
   删掉之后它们的正当性由上面那一批 diff() 接管：`return 5 & 3;` 现在
   要跟原生算出同一个答案，比「它必须报错」是强得多的断言。 */
```

- [ ] **Step 2: 跑一遍，确认它失败**

```bash
node chess/core/interp.test.js
```

期望：`按位与 —— 抛错行为一致` **FAIL**（我们抛 `Unsupported syntax: the & operator (bitwise and)`，原生给 `1`）。

- [ ] **Step 3: 改 `BINOP`（重排）与 `UNSUPPORTED_BINOP`（删五条）**

`chess/core/interp.js:499-505` 整段换成：

```js
  /* 二元运算优先级：数字越大结合得越紧。全部列出的都是左结合；右结合的
     只有赋值，它在 parseAssign 里单独处理，不走这张表。

     ⚠ 阶段 9b 加位运算时这张表是**重排**，不是往表尾追加五行：JS 真实
     优先级里 `|` `^` `&` 夹在 `&&` 与相等之间、`<<` `>>` 夹在关系与加减
     之间，所以原来的六层整体下移成十层。重排会动到**已有表达式**的解析
     结果，不只是新运算符自己 —— interp.test.js 里那六条「混合优先级」
     diff 就是钉这件事的，每一条都挑了在两种排法下算出不同答案的形状。
     改这张表之前先读那六条。 */
  const BINOP = {
    '||': 1, '&&': 2,
    '|': 3, '^': 4, '&': 5,
    '===': 6, '!==': 6, '==': 6, '!=': 6,
    '<': 7, '>': 7, '<=': 7, '>=': 7,
    '<<': 8, '>>': 8,
    '+': 9, '-': 9,
    '*': 10, '/': 10, '%': 10,
  };
```

`UNSUPPORTED_BINOP`（`:514-522`）删掉五个位运算符，只留两条：

```js
  const UNSUPPORTED_BINOP = {
    '**': 'the ** operator (use repeated multiplication instead)',
    '??': 'the ?? operator (nullish coalescing)',
  };
```

- [ ] **Step 4: 改 `applyBinary`**

在 `chess/core/interp.js:1653`（`case '!=': return l != r;`）之后、`default:` 之前插入：

```js
      /* 位运算五个（阶段 9b）：直接借原生运算符。ToInt32、>> 的符号位、
         BigInt 任意精度、「混用当场抛」（连报错文字都跟原生逐字相同）
         全部白送，也不会跟差分测试的参照实现分岔 —— 规格 §7.7 ⑤ 写明了
         代价：这五格差分**必然通过**，它在这里验的不是运算语义，而是
         词法与解析有没有把 token 送到正确位置。 */
      case '&': return l & r;
      case '|': return l | r;
      case '^': return l ^ r;
      case '<<': return l << r;
      case '>>': return l >> r;
```

- [ ] **Step 5: 跑一遍，确认它通过**

```bash
node chess/core/interp.test.js
```

期望：新加的 21 条差分全过（每条 `diff()` 记 3 个断言），删掉的五条 `unsupportedCheck` 各带走 3 个断言。**通过数会同时增减，别用总数当判据——看有没有 FAIL。**

- [ ] **Step 6: 突变验证——优先级排错必须被抓**

把 `BINOP` 里 `'|': 3` 与 `'&': 5` 两个数字对调（`'|': 5, '&': 3`），跑：

```bash
node chess/core/interp.test.js
```

期望：`优先级：& 紧于 |` 与 `优先级：^ 紧于 |` **变红**。**这是判据**——若六条混合优先级 diff 一条都不红，说明它们没有区分力，停下来报告（那正是阶段 9a 那道门要治的病）。验完从 scratchpad 备份还原。

- [ ] **Step 7: Commit**

```bash
git add chess/core/interp.js chess/core/interp.test.js
git commit -m "feat(chess): 五个二元位运算符 —— BINOP 重排成十层，六条混合优先级 diff 钉住"
```

---

## Task 4：一元 `~`

**Files:**
- Modify: `chess/core/interp.js`（`checkUnsupported` 的 `~` 分支 `:450-456`；`UNARY_OPS` `:536`；`Unary` case `:1750-1755`）
- Modify: `chess/core/interp.test.js`（删 `:1072` 那条；加差分）

**Interfaces:**
- Consumes: Task 2 的 BigInt 字面量
- Produces: `I.run('return ~5;').result === -6`

- [ ] **Step 1: 写会失败的测试**

在 Task 3 那批 diff 之后插入：

```js
// ---- 位运算：一元 ~（阶段 9b）----
diff('return ~5;', '按位取反');
diff('return ~0;', '按位取反：0');
diff('return ~5n;', 'BigInt 按位取反');
diff('return ~~5.9;', '双重取反（原生的截断惯用法）');
diff('return -~5;', '取反后取负 —— 两个一元运算符连用');
```

并删掉 `chess/core/interp.test.js:1072`：

```js
unsupportedCheck('return ~1;', '~', 'B5: 按位取反 ~');
```

（Task 3 已经在那个位置留了「边界移动」的注释，这一条并进去即可，不必再写第二段。）

- [ ] **Step 2: 跑一遍，确认它失败**

```bash
node chess/core/interp.test.js
```

期望：`按位取反 —— 抛错行为一致` **FAIL**（我们抛 `Unsupported syntax: the ~ operator (bitwise not)`）。

- [ ] **Step 3: 删 `checkUnsupported` 的 `~` 分支**

删掉 `chess/core/interp.js:450-456` 整段（含它上面那段注释）：

```js
    /* '~'（按位取反）只会以「一元前缀运算符」的形状出现在期待操作数的
       位置——跟 '-'/'+'/'!' 是同一类，但它不在这个教学子集里（复审 I4：
       改之前词法器压根不认识这个字符，报的是 `Unexpected character "~"`，
       跟"不支持"毫无关系）。 */
    if (t.type === 'punct' && t.value === '~') {
      throw unsupported('the ~ operator (bitwise not)', t);
    }
```

- [ ] **Step 4: 加进 `UNARY_OPS` 与 `Unary` case**

`chess/core/interp.js:536`：

```js
  const UNARY_OPS = { '-': true, '+': true, '!': true, '~': true };
```

`Unary` case（`:1750-1755`）改成：

```js
      case 'Unary': {
        const v = yield* evalExpr(node.arg, env);
        if (node.op === '-') return -v;
        if (node.op === '+') return +v;
        if (node.op === '~') return ~v;   // 阶段 9b；BigInt 上原生同样有定义（~5n === -6n）
        return !v; // '!'
      }
```

- [ ] **Step 5: 跑一遍，确认它通过**

```bash
node chess/core/interp.test.js
```

期望：五条新差分全过，无 FAIL。

- [ ] **Step 6: 突变验证——`~` 落错分支必须被抓**

把 `Unary` 里 `if (node.op === '~') return ~v;` 改成 `return -v;`，跑：

```bash
node chess/core/interp.test.js
```

期望：`按位取反`（`~5` 应得 `-6`，突变后得 `-5`）与 `双重取反` **变红**。验完从 scratchpad 备份还原。

- [ ] **Step 7: Commit**

```bash
git add chess/core/interp.js chess/core/interp.test.js
git commit -m "feat(chess): 一元 ~ —— 子集边界移动，六条不支持断言至此全部删完"
```

---

## Task 5：`Update`（`++`/`--`）的 BigInt 分支

⚠ **这一条是静默的。** `interp.js` 的 `Update` 分支写的是 `Number(old) + 1`，而**`Number(1n)` 不抛、返回 `1`**——于是 `let x = 1n; x++` 得到 Number `2`，原生是 `2n`。两边都「跑通了」，只是类型不再是同一个类型。

那一行上方那句注释——「这里用 Number(old) 补一个子集版的 ToNumeric（**本子集没有 BigInt，不需要分支**）」——同时作废。**一条声称「不需要」的注释留在需要它的代码旁边，比没有注释更坏**，要一起改掉。

**Files:**
- Modify: `chess/core/interp.js`（`Update` case `:1757-1770`，含上方注释）
- Modify: `chess/core/interp.test.js`

**Interfaces:**
- Consumes: Task 2 的 BigInt 字面量
- Produces: `I.run('let x = 1n; x++; return x;').result === 2n`（`typeof` 是 `bigint`，不是 `number`）

- [ ] **Step 1: 写会失败的测试**

```js
// ---- ++/-- 在 BigInt 上不许漂类型（阶段 9b，规格 §7.7 ④）----
/* Number(1n) 不抛、返回 1 —— 所以改之前 `let x = 1n; x++` 得到的是 Number 2，
   而原生是 2n。两边都「跑通了」，只是类型不再是同一个类型，差分是唯一
   看得见它的东西（T.eq 的 BigInt 编码跟数字编码不同，见 Task 1）。 */
diff('let x = 1n; x++; return x;', 'BigInt 后缀自增');
diff('let x = 1n; ++x; return x;', 'BigInt 前缀自增');
diff('let x = 1n; x--; return x;', 'BigInt 后缀自减');
diff('let x = 1n; return x++;', 'BigInt 后缀自增的表达式值');
diff('let x = 1n; return ++x;', 'BigInt 前缀自增的表达式值');
diff('let x = "5"; x++; return x;', '字符串自增仍走 ToNumeric（旧行为不许被这次改动带跑）');
```

- [ ] **Step 2: 跑一遍，确认它失败**

```bash
node chess/core/interp.test.js
```

期望：`BigInt 后缀自增 —— 返回值一致` **FAIL**（`expected: {"__bigint__":"2"}` / `actual: 2`）。**注意这条失败的形状**：它不是抛错，是**类型悄悄变了**——这正是规格 §7.7 ④ 说的那种作废方式。

- [ ] **Step 3: 改 `Update`**

`chess/core/interp.js:1757-1770` 整段（含注释）换成：

```js
      case 'Update': {
        /* ECMA-262 13.4.4/13.4.5：两者第一步都是 ToNumeric(oldValue)——
           '--' 侥幸正确是因为一元 '-' 本身就强制转数字，'++' 原来直接
           `old + 1` 对字符串是拼接，不是加法（复审 C1：`let x="5"; x++;`
           原生得 6，改前我们得 "51"）。后缀形式返回的也是转换后的数字
           （原生 `let x="5"; x++;` 的表达式值是数字 5，不是字符串 "5"），
           所以前缀/后缀都读转换后的值，不再读未转换的 old。

           ⚠ 阶段 9b：**BigInt 必须单独分支**。ToNumeric 对 BigInt 的结果
           仍是 BigInt，而 `Number(1n)` 不抛、返回 1 —— 走 Number 那条路的
           后果不是报错，是 `let x = 1n; x++` 静静地得到 Number 2 而原生是
           2n。这一行以前的注释写着「本子集没有 BigInt，不需要分支」，那句
           话在 9b 作废了。加一的那个 1 也要跟着分支：`1n + 1` 原生抛。 */
        const ref = yield* evalRef(node.arg, env);
        const old = ref.get();
        const num = typeof old === 'bigint' ? old : Number(old);
        const one = typeof num === 'bigint' ? 1n : 1;
        const next = node.op === '++' ? num + one : num - one;
        ref.set(next);
        return node.prefix ? next : num;
      }
```

- [ ] **Step 4: 跑一遍，确认它通过**

```bash
node chess/core/interp.test.js
```

期望：六条新差分全过，`字符串自增仍走 ToNumeric` 也过（旧行为没被带跑）。

- [ ] **Step 5: 突变验证——漂类型必须被抓**

把 `const one = typeof num === 'bigint' ? 1n : 1;` 改回 `const one = 1;`，跑：

```bash
node chess/core/interp.test.js
```

期望：五条 BigInt 自增/自减差分**变红**，而 `字符串自增` 仍绿。（这个突变下我们抛 `Cannot mix BigInt and other types` 而原生正常返回——**报错行为不一致**也是差分抓得到的。）验完从 scratchpad 备份还原。

- [ ] **Step 6: Commit**

```bash
git add chess/core/interp.js chess/core/interp.test.js
git commit -m "fix(chess): ++/-- 在 BigInt 上不再静默漂成 Number —— 那句「不需要分支」的注释同时作废"
```

---

## Task 6：内建 `BigInt()`

**Files:**
- Modify: `chess/core/interp.js`（`makeRootEnv` `:2323-2331`）
- Modify: `chess/core/interp.test.js`

**Interfaces:**
- Consumes: 无（`BigInt` 是宿主全局，不依赖前面的任务）
- Produces: 解释器根环境里有一个 `const BigInt`，`BigInt(5)` → `5n`

`BigInt` 是真·原生函数（`typeof BigInt === 'function'`），所以走的是 `Ident` 查找 → `fn.apply(thisArg, args)` 那条既有路径，`isCallableValue` / `resolveCallable` 一个字都不用改。实测 `BigInt.apply(null, [5])` 与 `BigInt.apply(undefined, [5])` 都得 `5n`。

- [ ] **Step 1: 写会失败的测试**

```js
// ---- 内建 BigInt()（阶段 9b，规格 §7.7 ①）----
/* 位盘里 sq 是数组下标、必然是 Number，要移位就得 BigInt(sq) 转一次 ——
   「必须显式转」正是这一课要让她撞上的东西。BigInt(1.5) 原生抛，借原生
   实现意味着这条也白送。 */
diff('return BigInt(5);', 'BigInt() 把数字转成 BigInt');
diff('return BigInt("42");', 'BigInt() 把字符串转成 BigInt');
diff('return BigInt(0);', 'BigInt(0)');
diff('return 1n << BigInt(3);', 'BigInt() 的结果可以直接当移位数 —— 位盘的核心写法');
diff('return BigInt(1.5);', 'BigInt(1.5) 原生抛，我们也要抛');
```

- [ ] **Step 2: 跑一遍，确认它失败**

```bash
node chess/core/interp.test.js
```

期望：`BigInt() 把数字转成 BigInt —— 抛错行为一致` **FAIL**（我们抛 `Undefined variable: BigInt` 之类，原生给 `5n`）。以实际输出为准。

- [ ] **Step 3: 注入根环境**

`chess/core/interp.js` 的 `makeRootEnv`（`:2323-2331`），在 `declareVar(env, 'const', 'Math', MATH_NS, ROOT_NODE);` 之后加一行：

```js
    /* BigInt（阶段 9b，规格 §7.7 ①）：位盘的 sq 是数组下标、必然是 Number，
       要移位就得显式转一次。它是真·原生函数，所以走的是跟 Math.abs 同一条
       `fn.apply(thisArg, args)` 路径，isCallableValue / resolveCallable 一个字
       都不用改（实测 BigInt.apply(null,[5]) === 5n）。BigInt(1.5) 原生抛
       `cannot be converted to a BigInt because it is not an integer`，借原生
       实现意味着这条错误行为也是白送的。 */
    declareVar(env, 'const', 'BigInt', BigInt, ROOT_NODE);
```

并把上方那段注释里的「根环境的五个宿主桥接名 + Math」改成「五个宿主桥接名 + Math + BigInt」——**那句话现在是错的，不改它就是留一条会骗人的注释。**

- [ ] **Step 4: 跑一遍，确认它通过**

```bash
node chess/core/interp.test.js
```

期望：五条新差分全过。

- [ ] **Step 5: 跑一次全量门**

```bash
python3 chess/scripts/check.py
```

期望：exit 0，九道门全过。到这一步 `interp.js` 的改动全部落地，内联镜像会被第一道门检查（`chess-board-algorithms.html` / `chess-search-minimax.html` 里都有 `interp.js` 的副本）——**如果第一道门红了，是因为镜像还没重生成，不是回归。**

⚠ **但不要为此在提交之前手工跑 `inline_core.py`。**（2026-08-08 实测订正，同一个坑 Task 9 与 Task 6 各踩了一次。）`.githooks/pre-commit` 跑的是 `inline_core.py --print-changed`，它**只在自己真的改了文件时才补暂存**。你若先手工跑过，磁盘已是最新，钩子就判「无变化」而不再暂存——三份镜像会**悬空在工作树里、没进 commit**，只能另开一条 `chore` 补。

正确做法二选一：

- **推荐**：这一步先跳过全量门，直接进 Step 6 提交，让钩子自己生成并暂存镜像；提交完再跑 `check.py`（那时树是干净的，读数才作数）。
- 或者：确实要先跑 `inline_core.py` 看门，那就在 Step 6 里**显式 `git add` 那三份镜像**，别指望钩子。

无论哪条，**commit 之后都要再看一遍 `git status --short`**。

- [ ] **Step 6: Commit**

```bash
git add chess/core/interp.js chess/core/interp.test.js
git status --short
git commit -m "feat(chess): 内建 BigInt() —— 位盘的 sq 必须显式转，这是这一课的一半"
```

⚠ 钩子会重跑 `inline_core.py` 并**再暂存**内联镜像。**commit 之后再看一遍 `git status --short`**，确认被带进来的只有 `chess/tools/*.html` 这几份镜像，没有别的 session 的半成品。

---

## Task 7：差分矩阵（表驱动）

Task 3–6 的差分是**逐条手写**的，覆盖到哪儿全看当时想到什么。这一条把它变成一张**表**：一眼能看出哪一格没覆盖，而且以后加运算符只需要往数组里加一个字符串。

规格 §7.7 的原话是「每个运算符 ×（Number, BigInt, 混用）三种操作数」。手写 18 条必漏一格。

**Files:**
- Modify: `chess/core/interp.test.js`

**Interfaces:**
- Consumes: Task 3–6 全部落地；`diff(src, label)`
- Produces: 无（纯测试）

- [ ] **Step 1: 写矩阵**

在 Task 3–6 那批手写差分**之后**插入：

```js
/* ---- 位运算差分矩阵（阶段 9b，规格 §7.7）----
   上面那些是逐条手写的，覆盖到哪儿全看当时想到什么。这张表让「哪一格没
   覆盖」一眼可见：六个运算符 ×（Number, BigInt, 混用）三档。混用那一档
   原生一律抛 `Cannot mix BigInt and other types`，diff() 比的是抛错文字，
   所以「该抛的必须同样抛」是免费得到的（规格 §7.7 开头的要求）。

   ⚠ 这张表**不覆盖优先级**：它每条只有一个运算符，排错一层它一条都不会红。
   优先级由上面那六条混合优先级 diff 守（Task 3），两者不互相替代。 */
const BIT_BINOPS = ['&', '|', '^', '<<', '>>'];
const BIT_OPERANDS = [
  { l: '5', r: '3', tag: 'Number×Number' },
  { l: '5n', r: '3n', tag: 'BigInt×BigInt' },
  { l: '5n', r: '3', tag: '混用（原生抛）' },
  { l: '5', r: '3n', tag: '混用（反向，原生也抛）' },
];
for (let bi = 0; bi < BIT_BINOPS.length; bi++) {
  for (let oi = 0; oi < BIT_OPERANDS.length; oi++) {
    const op = BIT_BINOPS[bi], o = BIT_OPERANDS[oi];
    diff('return ' + o.l + ' ' + op + ' ' + o.r + ';',
         '矩阵 ' + o.l + ' ' + op + ' ' + o.r + '（' + o.tag + '）');
  }
}
/* 一元 ~ 只有一个操作数，单独两格。 */
diff('return ~5;', '矩阵 ~5（Number）');
diff('return ~5n;', '矩阵 ~5n（BigInt）');

/* 边界几格：原生对这些有明确规定，我们借原生所以也该一致。 */
diff('return 1 << 31;', '矩阵边界：Number 左移到符号位（ToInt32 的边）');
diff('return 1 << 32;', '矩阵边界：Number 移位数取模 32');
diff('return 1n << 100n;', '矩阵边界：BigInt 任意精度，不取模');
diff('return -1 >> 31;', '矩阵边界：Number 算术右移补符号位');
diff('return 0n & 1n;', '矩阵边界：0n 参与运算');
diff('if (0n) { return "truthy"; } return "falsy";', '矩阵边界：0n 的真假值');
```

- [ ] **Step 2: 跑一遍**

```bash
node chess/core/interp.test.js
```

期望：全绿。**这一步跟前面几个任务不同——它不该先红。** 矩阵是把已经实现的东西系统地铺一遍，如果哪一格红了，那是 Task 3–6 漏了一格，**停下来报告并回去补，不要在这里就地修补**。

- [ ] **Step 3: 突变验证——矩阵真的能抓到缺格**

把 `applyBinary` 里 `case '^': return l ^ r;` 改成 `case '^': return l | r;`，跑：

```bash
node chess/core/interp.test.js
```

期望：`矩阵 5 ^ 3（Number×Number）` 与 `矩阵 5n ^ 3n（BigInt×BigInt）` **变红**（`5^3=6`、`5|3=7`）。验完从 scratchpad 备份还原。

- [ ] **Step 4: 跑全量门 + 第九道门**

```bash
python3 chess/scripts/check.py
```

期望：exit 0；输出里找到 `T.throws 判别力普查：` 那一行，**缺第三参 0 条、无判别力 0 条**。本任务没加 `T.throws`，但 Task 2 加了两条 `nativeRejects`（内部是 `T.throws`），这一行会涨——确认它们没被判钝。

- [ ] **Step 5: Commit**

```bash
git add chess/core/interp.test.js
git commit -m "test(chess): 位运算差分矩阵 —— 表驱动，哪一格没覆盖一眼可见"
```

---

## Task 8：付 9a 留下的 `checkNumTail` 那笔债

阶段 9a 的账本记着：`interp.test.js` 里三条 `nativeRejects` 共用同一个 pattern `'a numeric literal cannot be immediately followed by'`，而它**主动排除了唯一有区分力的回显字符**——完整消息是 `… followed by "9"` / `"2"` / `"g"`，pattern 恰好停在引号之前。

9a 还预告了一件事：**补裸 `0o`/`0b` 用例的那一刻，任何被放宽到该形状的 pattern 会突然被第九道门判钝——那是预期，不是回归。**

**Files:**
- Modify: `chess/core/interp.test.js`（`:165-176` 那一族 `nativeRejects`）

**Interfaces:**
- Consumes: Task 2（`n` 后缀那两条 `nativeRejects` 也在这一族里）
- Produces: 无（纯测试）

- [ ] **Step 1: 先记下改之前的门读数**

```bash
python3 chess/scripts/check.py 2>&1 | grep '判别力普查'
```

把这一行抄下来。改完要对照。

- [ ] **Step 2: 把三条 pattern 各自锚回回显字符**

`chess/core/interp.test.js:167` / `:169` / `:175` 三处 pattern 各自补上被排除的那个字符：

```js
nativeRejects('0o19', '八进制里出现非法数字 9',
              'a numeric literal cannot be immediately followed by "9"');
nativeRejects('0b12', '二进制里出现非法数字 2',
              'a numeric literal cannot be immediately followed by "2"');
nativeRejects('5g', '数字字面量后面紧跟标识符字符',
              'a numeric literal cannot be immediately followed by "g"');
```

并在这一族上方补一句注释：

```js
/* 三条共用前缀、各自锚不同的回显字符（阶段 9b 收紧，9a 账本记的那笔债）：
   守卫只有一条、消息只有一种结构，所以共用前缀过得了第九道门；但**过门不
   等于 pattern 对** —— 只锚前缀的话，`0o19` 与 `5g` 这两条互相都能匹中，
   谁挂了都看不出是谁。回显字符是这里唯一的区分度，把它排除在 pattern 之外
   是主动扔掉判别力。 */
```

- [ ] **Step 3: 补裸 `0o` / `0b` 用例**

在同一族末尾加：

```js
/* 裸 `0o` / `0b`（后面一个数字都没有）—— 9a 的账本预告过这两条：补上它们
   的那一刻，任何被放宽到「expected … digits after …」这个形状的 pattern 会
   突然被第九道门判钝。**那是预期，不是回归**：门自纠的时机本来就取决于
   别人何时补测试。这里三条 pattern 都写完整消息，没有敞口。 */
nativeRejects('0o', '0o 后面一个合法八进制数字都没有',
              'Invalid number: expected octal digits after 0o');
nativeRejects('0b', '0b 后面一个合法二进制数字都没有',
              'Invalid number: expected binary digits after 0b');
```

- [ ] **Step 4: 跑测试与门**

```bash
node chess/core/interp.test.js
python3 chess/scripts/check.py
```

期望：`interp.test.js` 全绿；`check.py` exit 0，`判别力普查` 那一行的**总条数比 Step 1 涨了 2**，缺第三参 0、无判别力 0。

**如果「无判别力」不是 0**：读那条 ERROR 点名的是哪个 pattern。若它是被裸 `0o`/`0b` 新引入的形状撞钝的，那正是 9a 预告的情形——**把那条 pattern 也写成完整消息**，不要放宽判据、更不要给它开豁免。

- [ ] **Step 5: 突变验证——三条现在互相分得开**

把 `interp.js` 的 `checkNumTail` 里 `JSON.stringify(nc)` 改成 `'"g"'`（写死成 `g`，模拟「回显了错的字符」），跑：

```bash
node chess/core/interp.test.js
```

期望：`0o19` 与 `0b12` 两条**变红**，`5g` 那条**仍绿**——三条至此互相分得开。改之前这个突变一条都不会红。验完从 scratchpad 备份还原。

- [ ] **Step 6: Commit**

```bash
git add chess/core/interp.test.js
git commit -m "test(chess): 付 9a 留下的 checkNumTail 那笔债 —— 三条 pattern 各锚自己的回显字符，补裸 0o/0b"
```

---

## Task 9：`debugger.js` 的 `fmtVal` 认 BigInt

⚠ **这条改动让 9b 不再是「纯基建、零浏览器验收」，是明知故犯**（规格 §7.7 ⑦）。

`fmtVal` 今天没有 `bigint` 分支：一个 BigInt 会掉到末尾的 `String(v)`，于是 **`5n` 在变量面板上显示成 `5`，跟数字 5 一个样**——而 BigInt 在位盘里的全部意义就是「它不是 Number」。

**好消息**：`fmtVal` 是导出的（`chess/core/debugger.js:1206`），`debugger.test.js:1013-1019` 已经有它的单测区。所以这条修复**有常驻回归测试**，不像 9a Task 6 的 `relabelEmptyOut()` 那样只能靠人工勾选。

**Files:**
- Modify: `chess/core/debugger.js`（`fmtVal` `:642-665`）
- Modify: `chess/core/debugger.test.js`（`:1013-1019` 那个 `③ fmtVal` 区）
- Regenerate（**不手改**）：`chess/tools/chess-search-minimax.html`、`chess/tools/chess-board-algorithms.html`、`chess/tools/_debugger-preview.html`

**Interfaces:**
- Consumes: 无（不依赖 `interp.js` 的任何改动——BigInt 是宿主类型，`fmtVal` 直接就能收到）
- Produces: `D.fmtVal(5n) === '5n'`

- [ ] **Step 0: 先核实基建到位（worktree 任务必做）**

```bash
git merge-base --is-ancestor afb4cb0 HEAD && echo "基线在" || echo "基线不在 —— 停下来报告"
grep -c 'fmtVal' chess/core/debugger.js
```

期望：`基线在`；`fmtVal` 出现 **6** 次。`isolation:"worktree"` 的基线**不一定**是当前分支，而失败是**安静的**（进程正常退出、测试全绿、只是什么都没生成）。不对就停下来报告，**不要自己 merge**（那是权限动作）。

- [ ] **Step 1: 写会失败的测试**

在 `chess/core/debugger.test.js:1019` 之后插入：

```js
/* BigInt（阶段 9b，规格 §7.7 ⑦）：fmtVal 改之前没有 bigint 分支，一个 BigInt
   会掉到函数末尾的 String(v)，于是 5n 显示成 `5` —— 跟数字 5 在面板上**一个
   字都不差**。而 BigInt 在位盘里的全部意义就是「它不是 Number」，这个显示
   等于把唯一要看的信息抹掉了。第三条是这三条里的判据：它钉的是「两者显示
   得**不一样**」，前两条各自单独看都可能被一个错的实现同时满足。 */
T.eq(D.fmtVal(5n), '5n', 'fmtVal：BigInt 带 n 后缀，跟数字区分得开');
T.eq(D.fmtVal(0n), '0n', 'fmtVal：0n 也带后缀');
T.ok(D.fmtVal(5n) !== D.fmtVal(5), 'fmtVal：BigInt 5n 与数字 5 在面板上必须显示成不同的东西');
T.eq(D.fmtVal([1n, 2]), '[1n, 2]', 'fmtVal：数组里的 BigInt 与数字并排时也分得开');
```

- [ ] **Step 2: 跑一遍，确认它失败**

```bash
node chess/core/debugger.test.js
```

期望：四条全 FAIL（`expected: "5n"` / `actual: "5"`）。

- [ ] **Step 3: 改 `fmtVal`**

`chess/core/debugger.js:646`（`if (typeof v === 'number' || typeof v === 'boolean') return String(v);`）**之后**插入：

```js
    /* BigInt（阶段 9b）：不加这一条它会掉到函数末尾的 String(v)，显示成 `5`
       ——跟数字 5 一个字都不差。位盘里 BigInt 的全部意义就是「它不是
       Number」，抹掉这个区别等于抹掉唯一要看的信息。后缀 n 跟源码里写
       `5n` 的样子一致，不另发明记法。 */
    if (typeof v === 'bigint') return String(v) + 'n';
```

- [ ] **Step 4: 跑一遍，确认它通过**

```bash
node chess/core/debugger.test.js
```

期望：`497 + 4 = 501 passed, 0 failed`（基线 497；**以实际输出为准**）。

- [ ] **Step 5: 重新生成内联镜像**

```bash
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py
```

期望：`check.py` exit 0；输出里 `8 个文件已是最新`、`node --check：10 个文件、18 个脚本块通过` 都在。

⚠ **手工跑过 `inline_core.py` 之后，Step 7 提交时钩子就不会再补暂存那三份镜像了**（2026-08-08 实测订正，同一个坑 Task 9 与 Task 6 各踩了一次）。`.githooks/pre-commit` 跑的是 `--print-changed`，**只在自己真的改了文件时才暂存**；磁盘已是最新，它就判「无变化」，镜像**悬空在工作树里、没进 commit**。

所以 Step 7 的 `git add` 里**必须显式列上那三份 HTML**，别指望钩子。另一条路是这一步干脆不先跑 `inline_core.py`，让钩子在提交时自己生成——但本任务需要它的输出来核验第一道门，所以这里走显式 `git add`。

- [ ] **Step 6: 浏览器验收（这条改动唯一的活人判据在这儿之外，但仍要跑）**

```bash
# 用 preview_start {name:"mathviz"}，每次调用带显式 tabId
```

打开工具⑤ `chess/tools/chess-board-algorithms.html`，在编辑器里把某一行改成 `const probe = 5n;`（或任一能让 BigInt 进到 locals 的写法），Run 之后看**变量面板**：

- 期望：显示 `probe = 5n`，**不是** `probe = 5`。
- ⚠ 标签不在前台时 `rAF` 完全不跑，**换页签不夹截图就不会重建**；`TOOL` **不是**页面全局。

- [ ] **Step 7: Commit**

```bash
git status --short
git add chess/core/debugger.js chess/core/debugger.test.js
git commit -m "fix(chess): 调试器 fmtVal 认 BigInt —— 5n 不再显示成 5"
git status --short
```

⚠ 钩子会重跑 `inline_core.py` 并**再暂存**那三份 HTML 镜像。**commit 之后再看一遍 `git status --short`**，逐条确认列出来的路径都是你的。

---

## Task 10：位盘可行性探针

**这是 9b 的收尾，也是它存在的理由。** 9b 唯一的客户是 9d，而「加完六个运算符、到 9d 才发现子集还差点什么」是这一段最贵的失败模式（同阶段 8 拿 `queens.js` 先验「逐段等行数写不写得成」）。

探针**不落成工具、不进注册表**，就是 `interp.test.js` 末尾的一段差分测试。

它要回答**两个明确的问题**，两个都**先跑再定，不预先裁**：

1. **`&=` `|=` `^=` `<<=` `>>=` 五个复合赋值要不要进 9b？** 词法器今天没有它们（`PUNCT` 表里只有 `+= -= *= /= %=`），§7.7 只点了六个运算符，YAGNI 说别加。但若位盘代码满屏 `b = b & (b - 1n)` 难读，那就是加的理由。
2. **`b.toString(2)` 要不要支持？** **已实测：今天不支持。** `resolveCallable`（`interp.js:1374-1392`）只认数组的 `push`/`pop` 与对象的自有属性，BigInt 两条都不是，会抛 `toString is not a function`。而原生支持——所以这是一处**真实的子集边界**，探针要把它钉成断言，然后由人决定补不补。

**Files:**
- Modify: `chess/core/interp.test.js`（末尾追加）

**Interfaces:**
- Consumes: Task 2–7 全部落地
- Produces: 无（纯测试 + 两条待裁定的结论）

- [ ] **Step 1: 写探针**

在 `chess/core/interp.test.js` 末尾、`T.report()` 之前插入：

```js
/* ============ 位盘可行性探针（阶段 9b 收尾，规格 §7.7）============
   9b 唯一的客户是 9d 的 bitboard。这一段不是「再多测几个运算符」，是拿
   **真的位盘代码**问一句：这个子集够不够写它。停在「六个运算符能跑」而
   不跑这一段，就是把「子集还差点什么」这个发现推迟到 9d ——那时它会以
   「写到一半发现写不下去」的形式出现，代价高得多。
   探针不落成工具、不进注册表，就是下面这几条 diff。 */

// 位盘的四个核心写法，逐个走差分
diff('const sq = 3; return 1n << BigInt(sq);', '探针：置位 —— 1n << BigInt(sq)');
diff('let b = 22n; return b & (b - 1n);', '探针：清掉最低位的 1 —— b & (b - 1n)');
diff('let b = 22n; let n = 0; while (b !== 0n) { b = b & (b - 1n); n = n + 1; } return n;',
     '探针：popcount 循环（0n 当循环条件）');
diff('const sq = 5; const b = 1n << BigInt(sq); return (b >> BigInt(sq)) & 1n;',
     '探针：取位 —— 移回来再与 1n');
diff('let b = 0n; for (let sq = 0; sq < 8; sq = sq + 1) { b = b | (1n << BigInt(sq)); } return b;',
     '探针：循环建一整行的掩码');
diff('let b = 0n; for (let sq = 0; sq < 64; sq = sq + 1) { b = b | (1n << BigInt(sq)); } return b;',
     '探针：64 位铺满 —— 这是 9d 真正要跑的规模，验任意精度没在中途退化');
diff('const b = 22n; log("bitboard = " + b); return 0;',
     '探针：BigInt 进 log() —— 字符串拼接的行为要跟原生一致');

/* 轨迹：规格 §7.7 说 `deepCopy` 不用动（`snap()` 是手写递归、不走 JSON，
   BigInt 作为原始值直接过）。那是**读代码读出来的结论**，这里跑一遍证实它
   —— 一个 BigInt 局部变量必须完整地活到 trace 里，既不被转成 Number、也不
   把 snap() 打崩。9b 之后 Task 9 的变量面板读的就是这份快照。 */
const probeRun = I.run('let bb = 22n; bb = bb & (bb - 1n); return bb;');
T.eq(probeRun.result, 20n, '探针：BigInt 能原样当 run() 的返回值');
T.ok(probeRun.trace.length > 0, '探针：带 BigInt 的程序照常录出轨迹（snap 没被打崩）');

/* ---- 探针问出来的两条子集边界 ---- */

/* ① 复合赋值：词法器今天的 PUNCT 表里只有 `+= -= *= /= %=`，五个位运算的
   复合形式一个都没有。下面这条钉住**今天的**行为；要不要加进子集，看上面
   那几条 diff 写出来的位盘代码读起来累不累 —— 判断写在任务报告里交给裁定，
   **不要在这个任务里顺手加**（§7.7 只点了六个运算符，加是扩边界）。 */
T.throws(function () { I.parse('let b = 3n; b &= 1n; return b;'); },
         '探针：&= 今天不在子集里（钉住现状，等裁定）',
         'Unexpected token: "="');

/* ② `b.toString(2)`：原生支持，我们不支持 —— resolveCallable 只认数组的
   push/pop 与对象的自有属性，BigInt 两条都不是。这是**真实的子集边界**，
   不是缺陷：位盘要打印成二进制串的话，今天只能自己写循环。pattern 锚的是
   resolveCallable 自己那句 `is not a function`，不是回显的方法名。 */
T.throws(function () { I.run('const b = 5n; return b.toString(2);'); },
         '探针：BigInt 上的 toString 今天不在子集里（钉住现状，等裁定）',
         'toString is not a function');
```

- [ ] **Step 2: 跑一遍**

```bash
node chess/core/interp.test.js
```

期望：七条 diff 全绿，两条 `T.throws` 全绿。

**如果哪一条 diff 红了，那就是探针发现了真东西——停下来报告，不要就地改测试去迁就。** 报告里要写清楚：红的是「返回值不一致」「抛错行为不一致」还是「宿主调用序列不一致」，以及两边各自是什么。

- [ ] **Step 3: 回答那两个问题（写进任务报告，不是写进代码）**

把 Step 1 里那七条位盘写法**当成真的教学源码读一遍**，回答：

1. `b = b & (b - 1n)` 这类写法在一段完整的 popcount / 遍历里出现几次？读起来累不累？→ 给出「建议加 / 建议不加」与**理由**，不要只给结论。
2. 打印位盘需不需要 `toString(2)`？自己写循环要多几行？→ 同上。

**这两个问题的答案不在这个任务里落地**——它们是给最终审查与 9d 的输入。**不许顺手扩子集边界。**

- [ ] **Step 4: 跑全量门**

```bash
python3 chess/scripts/check.py
```

期望：exit 0，九道门全过。特别看两行：
- `core/games 测试：18 个测试文件全部通过`
- `T.throws 判别力普查：… 条，缺第三参 0 条（允许 0），无判别力 0 条`

- [ ] **Step 5: Commit**

```bash
git add chess/core/interp.test.js
git commit -m "test(chess): 位盘可行性探针 —— 9b 以「子集够不够写 bitboard」收尾，不以「六个运算符能跑」收尾"
```

---

## 收尾（不是一个 Task，是每次派发都要核的）

全部十个任务落地后：

```bash
node chess/core/interp.test.js
node chess/core/_test.self.test.js
node chess/core/debugger.test.js
python3 chess/scripts/check.py
python3 scripts/sync_registry.py --check
```

期望：四份测试无 FAIL；`check.py` exit 0 且九道门各自那一行都在；`sync_registry --check` 已同步。

**9b 不动 `chess-tools.json` 与任何工具版本**——它没有可见工具，`debugger.js` 的改动是共用引擎的内部修复，不构成工具④⑤ 的功能变更。若最终审查认为面板显示 `5n` 算功能变更，那是一次版本裁定，**在审查里定，不在这个计划里预先定**。

开 PR 之后：

```bash
gh pr checks <PR#>
```

**本地绿 ≠ CI 绿。** 不要自己合并，用户在对话里确认。
