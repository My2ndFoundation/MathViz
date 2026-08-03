# 国际象棋子项目 · 阶段 3a（可单步的 JS 子集解释器）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 `chess/core/interp.js`——一个零依赖、可由 node 直接加载与测试的 JavaScript 子集解释器：词法分析、递归下降解析、生成器驱动的求值，以及一条**可正放可反放的执行轨迹**。它是工具 ④⑤ 的核心，本阶段不产出可见工具。

**Architecture:** 三层加两件附属物。词法器（同时供阶段 3b 的编辑器做语法高亮，**同一份 token 流**）→ 递归下降解析器（不支持的语法在**解析阶段**就带行列报错）→ `function* evalNode(node)` 生成器求值器（每到语句边界 `yield` 一次）。附属物是**宿主桥接**（`mark`/`place`/`clear`/`log`/`attacked`，算法与棋盘之间唯一的接口）与**轨迹记录器**（增量、可反放、50,000 步上限）。

**Tech Stack:** 纯 ES2015、零依赖、零构建。node 直接跑测试。

---

## Global Constraints

- **零依赖**：不得引入任何 npm 包、CDN 资源、外部字体或图片。
- **UMD 双导出**：`core/*.js` 既支持 `module.exports`（node 测试），也挂到 `window`。
- **模块顶层不得触碰 DOM**：`document` / `window` / `localStorage` / `location` 只能在函数体内出现。本模块**整体不碰 DOM**——它是纯逻辑。
- **子集是硬边界**（规格 §9）：`§2.6` 列出的语法就是全部范围。不支持的语法**在解析阶段明确报错**，不做"尽力而为"的部分支持——半懂不懂的解释器比明确拒绝更危险。**要扩子集必须先补差分测试。**
- **代码注释用中文**，写「为什么」不写「是什么」。读一下 `chess/core/replay.js` 与 `chess/core/interact.js` 的注释语气再动手。
- **只暂存显式路径，禁止 `git add -A` / `git commit -a`。**
- **规格来源**：`docs/superpowers/specs/2026-08-02-chess-viz-suite-design.md` §2.6、§2.7（轨迹策略）、§2.8（词法器复用）、§7.3（验收门）、§9（YAGNI 边界）。

### 给每一位执行者的硬性要求

> **如果本计划里某段代码是错的、或某个测试断言了一件事实上错误的事，停下来报告，不许改代码或改测试去迁就它。计划是记录，不是权威。**

这条在阶段 0–2 抓出了十几处真实的计划缺陷，其中两处是自相矛盾的测试 fixture。本阶段尤其适用：**差分测试的期望值来自 JavaScript 自己**，所以如果解释器与原生 JS 不一致，**默认是解释器错了**——但也请核实一遍测试程序本身是不是在依赖子集之外的语法。

---

## 本阶段 owns 的六个决定（已定，不再讨论）

### 决定 1：一步 = 一次语句边界的 `yield`

规格 §2.6 说「每到一个语句边界 `yield` 一次」。**一条轨迹记录 = 一次 yield**。表达式内部不产生步（否则 `a + b * c` 会拆成三步，调试时噪音远大于信息）。

### 决定 2：步入 / 步过 / 步出是在**已记录的轨迹**上做的，不是驱动生成器

规格 §2.7 的策略是「**先跑完、记全轨迹、再回放**」，因为「后退」只有这样才做得到。所以：

- 生成器的"能在任意点暂停"这个能力，**只在录制期用到**；
- 回放期（单步 / 后退 / 拖时间轴 / 步入步过步出）全部是在轨迹数组上移动下标。

**因此每条轨迹记录必须带 `depth`（调用栈深度）**，阶段 3b 的调试器才能实现：步过 = 前进到 `depth <= 当前`；步入 = 前进一步；步出 = 前进到 `depth < 当前`。

> 这条必须写死在计划里，否则实现者很可能建一个"边跑边停"的设计——那种设计做得出单步，**做不出后退**，而后退是这套调试器最贵的功能。

### 决定 3：轨迹存的是**显示用的深拷贝值**，不是活引用

回放**从不重新执行程序**，它只是把 UI 沿着记录好的状态移动。所以 `varDelta` 里存的是"当时那一刻该显示成什么"的**普通值深拷贝**，不是解释器环境里的活对象。

不这么做会有一个隐蔽的错：数组 `board` 在第 10 步被 push、第 200 步被 pop，若轨迹里存的是同一个数组引用，回放到第 10 步时看到的是第 200 步的内容——**轨迹会随程序继续运行而"变了历史"**。

深拷贝的代价在教学规模（N 皇后 N≤12、骑士巡游 8×8）上可以接受，且 50,000 步上限本身就是它的护栏。

### 决定 4：`varDelta` 与 `boardOps` 都必须**自带撤销所需的信息**

规格 §2.6 说「回放时正放前进、反放撤销」。要撤销，就得知道改之前是什么：

- 变量：`{ name, from, to }`（`from` 为 `undefined` 表示这一步之前它不存在）
- 棋盘：每个 op 记下被覆盖的旧值，例如 `{ kind: 'mark', sq, to: 'trying', from: null }`

这让前进与后退都是 O(1)，不需要"从头重放到第 k 步"那套快照 + 重算。

### 决定 5：50,000 步上限**同时是执行上限**，且不谎报"省略了 N 步"

规格 §2.6 写的是「超限则停止记录，并在读数区显式写明"已达上限，省略 N 步"」，而 §2.8 写的是「50,000 步轨迹上限同时充当执行上限，超限则停止并明确提示」。

**这两句互相冲突**：如果按 §2.8 停止执行，我们**根本不知道 N 是多少**；而要知道 N 就得继续跑完——可上限的另一个身份正是死循环保护，"继续跑完"在死循环下永远不会返回。

**决定：按 §2.8 执行——到达上限即停止执行**，轨迹上标 `{ truncated: true, limit: 50000 }`，读数区文案写「已达 50,000 步上限，执行已停止（可能是死循环，也可能这道题就是这么大）」。**不编造一个我们不知道的 N。**

> 这是规格的一处内部冲突，本阶段裁定并记录在案。规格 §2.6 那半句要跟着改。

### 决定 6：三元 `?:` 不在子集内，`++`/`--`/`+=` 在

规格 §2.6 的支持清单里没有三元运算符。按 §9「子集清单是硬边界」，**不支持，解析阶段明确报 unsupported**。

而 `++` / `--` / `+=` 这类**没有单独列出，但被明确列出的 `for` 循环与"赋值"所蕴含**（`for (let i = 0; i < n; i++)` 是清单里 `for` 的标准形态）——**支持**，并在实现注释里写明这条推理。

> 预判：阶段 5 写六道算法题时，最可能第一个撞上的就是三元运算符。届时要么改写算法用 `if/else`，要么按 §9 的规矩「先补差分测试再扩子集」。**不要在本阶段提前扩。**

---

## 已有的内核接口（本阶段只参考风格，不消费）

```js
// chess/core/_test.js —— 测试助手
eq(actual, expected, label)   // JSON.stringify 比较
ok(cond, label)
throws(fn, label)
report()                      // 打印并 process.exit(失败数 ? 1 : 0)

// chess/core/replay.js —— UMD 包装与注释风格的参照
// chess/scripts/inline_core.py —— SOURCES 字典 + OPTIONAL_TAGS 集合
// chess/scripts/check.py —— 自动收 core/*.test.js 与 games/*.test.js
```

---

## File Structure

| 文件 | 责任 |
|---|---|
| `chess/core/interp.js` | ★ 唯一编辑源：词法器 + 解析器 + 求值器 + 宿主桥接 + 轨迹记录器 |
| `chess/core/interp.test.js` | 差分测试（拿原生 JS 当参照）+ 语法错误定位测试 + 轨迹结构测试 |
| `chess/scripts/inline_core.py` | 加 `INTERP` 源并列入 `OPTIONAL_TAGS` |

**为什么解释器只有一个文件**：规格 §2 的目录树列的就是单个 `interp.js`，而且三层之间共享 token / 节点 / 位置信息的定义，拆开会制造三处需要同步的边界。仓库里 `chess-core.js` 761 行、`viz-engine.js` 约 1290 行，900 行在既有量级之内。

### 任务依赖

```
Task 1 词法器 → Task 2 表达式解析 → Task 3 语句解析 + 不支持语法
                                        ↓
Task 4 求值：字面量与运算 → Task 5 控制流 → Task 6 函数与递归
                                        ↓
Task 7 宿主桥接 + 轨迹记录 → Task 8 两道上限 → Task 9 算法级差分 + 内联接线
```

全部串行（同一个文件层层叠加），**不要并行派发**。

---

## Task 1: 词法器

**Files:**
- Create: `chess/core/interp.js`
- Test: `chess/core/interp.test.js`

**Interfaces:**
- Produces: `Interp.tokenize(src)` → `Token[]`；`Token = { type, value, line, col, start, end }`；`type ∈ 'num'|'str'|'tpl'|'name'|'kw'|'punct'|'eof'`

词法器**同时是阶段 3b 编辑器的语法高亮数据源**（规格 §2.8：「高亮看到的 token 流与执行看到的是同一份——不存在'高亮说这是关键字、解释器说不是'的分歧」）。所以：

- **每个 token 必须带位置**（`line` / `col` 从 1 起算，`start` / `end` 是字符下标），高亮要靠它给 token 上色、语法检查要靠它画波浪线。
- **注释也要产出 token**（`type: 'comment'`），否则高亮层会漏掉注释。解析器自己跳过它们。

- [ ] **Step 1: 写失败的测试**

Create `chess/core/interp.test.js`：

```js
'use strict';
const T = require('./_test.js');
const I = require('./interp.js');

function types(src) { return I.tokenize(src).map(t => t.type); }
function values(src) { return I.tokenize(src).filter(t => t.type !== 'eof').map(t => t.value); }

// ---- 基本类别 ----
T.eq(values('let x = 1'), ['let', 'x', '=', 1], '关键字/标识符/符号/数字');
T.eq(types('let x = 1'), ['kw', 'name', 'punct', 'num', 'eof'], '类别正确');
T.eq(values('x >= 10 && y !== 2'), ['x', '>=', 10, '&&', 'y', '!==', 2], '多字符运算符不被拆开');
T.eq(values('a.b[0]'), ['a', '.', 'b', '[', 0, ']'], '成员访问与下标');

// ---- 数字与字符串 ----
T.eq(values('1 2.5 0.75'), [1, 2.5, 0.75], '整数与小数');
T.eq(values("'hi' \"there\""), ['hi', 'there'], '两种引号');
T.eq(values("'a\\nb'"), ['a\nb'], '转义序列在词法阶段就解掉');

// ---- 模板字符串 ----
const tpl = I.tokenize('`try ${r},${c}`').filter(t => t.type !== 'eof');
T.eq(tpl.length, 1, '模板串是一个 token');
T.eq(tpl[0].type, 'tpl', '类别是 tpl');
T.eq(tpl[0].value.quasis, ['try ', ',', ''], '静态段（比表达式多一个）');
T.eq(tpl[0].value.exprs.map(s => s.trim()), ['r', 'c'], '内嵌表达式以源码片段保留，留给解析器');

// ---- 注释：产出 token 供高亮，解析器自己跳过 ----
T.eq(types('// hi\nlet x = 1'), ['comment', 'kw', 'name', 'punct', 'num', 'eof'], '行注释是 token');
T.eq(types('/* a */ let'), ['comment', 'kw', 'eof'], '块注释是 token');

// ---- 位置信息（编辑器画波浪线全靠它）----
const pos = I.tokenize('let x = 1\nlet yy = 2');
const yy = pos.find(t => t.value === 'yy');
T.eq(yy.line, 2, '第二行');
T.eq(yy.col, 5, '第 5 列（1 起算）');
T.eq('let x = 1\nlet yy = 2'.slice(yy.start, yy.end), 'yy', 'start/end 能切回原文');
T.eq(pos[0].line, 1, '第一个 token 在第 1 行');
T.eq(pos[0].col, 1, '第一个 token 在第 1 列');

// ---- 坏输入：未闭合 ----
T.throws(() => I.tokenize("'abc"), '未闭合的字符串报错');
T.throws(() => I.tokenize('`abc'), '未闭合的模板串报错');
T.throws(() => I.tokenize('/* abc'), '未闭合的块注释报错');

T.report();
```

- [ ] **Step 2: 运行确认失败**

Run: `node chess/core/interp.test.js`
Expected: FAIL —— `Cannot find module './interp.js'`

- [ ] **Step 3: 写实现**

Create `chess/core/interp.js`：

```js
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
```

- [ ] **Step 4: 运行确认通过**

Run: `node chess/core/interp.test.js`
Expected: PASS，`0 failed`

- [ ] **Step 5: 提交**

```bash
git add chess/core/interp.js chess/core/interp.test.js
git commit -m "feat(chess): 解释器词法器 —— 带位置的 token 流，编辑器高亮与执行共用同一份"
```

---

## Task 2: 表达式解析

**Files:**
- Modify: `chess/core/interp.js`
- Test: `chess/core/interp.test.js`

**Interfaces:**
- Consumes: Task 1 的 `tokenize`
- Produces: `Interp.parseExpression(src)` → AST 节点（**仅供测试与阶段 3b 的表达式求值**）；内部的 `parseExpr(state)`

AST 节点形状（**后续所有任务都按这份写，不要自创**）：

```js
{ type: 'Num',  value }            { type: 'Str', value }
{ type: 'Bool', value }            { type: 'Null' }
{ type: 'Tpl',  quasis, exprs }    // exprs 已经是解析好的节点
{ type: 'Ident', name }
{ type: 'Array', elements }
{ type: 'Object', props: [{ key, value }] }      // key 是字符串
{ type: 'Member', obj, prop, computed }          // computed=true → a[b]；false → a.b（prop 是字符串）
{ type: 'Call', callee, args }
{ type: 'Unary', op, arg }                       // op ∈ '-' '+' '!'
{ type: 'Update', op, arg, prefix }              // op ∈ '++' '--'
{ type: 'Binary', op, left, right }
{ type: 'Logical', op, left, right }             // op ∈ '&&' '||'
{ type: 'Assign', op, target, value }            // op ∈ '=' '+=' '-=' '*=' '/=' '%='
{ type: 'Arrow', params, body, expression }      // expression=true → body 是表达式
```

**每个节点都要带 `line` / `col`**（取该节点第一个 token 的位置）——运行时报错与调试器高亮全靠它。

优先级用一张表驱动，**不要靠一层层手写函数去凑**——手写十层最容易在中间某一层把结合性写反，而那种错误只在特定表达式上暴露（`a - b - c` 对了不代表 `a / b / c` 对）：

```js
  /* 二元运算优先级：数字越大结合得越紧。用表驱动的 precedence climbing，
     而不是「每个优先级一个 parseXxx 函数」那种十层嵌套 —— 十层里只要有
     一层把左结合写成右结合，就会得到一个大多数表达式都对、少数表达式
     悄悄算错的解析器，而「大多数都对」正是最难发现的那种错。
     全部列出的都是左结合；右结合的只有赋值，它在 parseAssign 里单独处理。 */
  const BINOP = {
    '||': 1, '&&': 2,
    '===': 3, '!==': 3, '==': 3, '!=': 3,
    '<': 4, '>': 4, '<=': 4, '>=': 4,
    '+': 5, '-': 5,
    '*': 6, '/': 6, '%': 6,
  };
```

`&&` / `||` 产出 `Logical` 节点（求值时要短路），其余产出 `Binary`。层次：赋值（右结合，单独一层）→ 表驱动的二元 → 一元/前缀 → 后缀/调用/成员 → 基本单元。

- [ ] **Step 1: 写失败的测试**

追加到 `interp.test.js`（`T.report()` 之前）：

```js
// ---- 表达式解析：结构 ----
function P(src) { return I.parseExpression(src); }

T.eq(P('1').type, 'Num', '数字字面量');
T.eq(P('x').type, 'Ident', '标识符');
T.eq(P('true').value, true, 'true 是布尔不是标识符');
T.eq(P('null').type, 'Null', 'null 有自己的节点类型');

// 优先级：a + b * c 必须是 a + (b * c)
const prec = P('a + b * c');
T.eq(prec.op, '+', '顶层是加法');
T.eq(prec.right.op, '*', '乘法在右子树 —— 优先级正确');

// 左结合：a - b - c 必须是 (a - b) - c
const assoc = P('a - b - c');
T.eq(assoc.left.op, '-', '减法左结合');

// 逻辑运算与关系运算的相对优先级
const mix = P('a < b && c > d');
T.eq(mix.type, 'Logical', '顶层是逻辑与');
T.eq(mix.left.op, '<', '关系运算优先于逻辑运算');

// 成员、下标、调用可以链起来
const chain = P('a.b[0](x)');
T.eq(chain.type, 'Call', '最外层是调用');
T.eq(chain.callee.type, 'Member', '被调用的是成员表达式');
T.eq(chain.callee.computed, true, '最内一层是下标');
T.eq(chain.callee.obj.type, 'Member', '再里面是点访问');
T.eq(chain.callee.obj.computed, false, '点访问 computed=false');
T.eq(chain.callee.obj.prop, 'b', '点访问的属性名是字符串');

// 数组与对象
T.eq(P('[1, 2]').elements.length, 2, '数组字面量');
T.eq(P('{ a: 1, b: 2 }').props.map(p => p.key), ['a', 'b'], '对象字面量的键');

// 箭头函数
const arrow = P('(a, b) => a + b');
T.eq(arrow.type, 'Arrow', '箭头函数');
T.eq(arrow.params, ['a', 'b'], '参数名');
T.eq(arrow.expression, true, '表达式体');
T.eq(P('x => x').params, ['x'], '单参数可以不带括号');

// 前缀与后缀
T.eq(P('i++').type, 'Update', '后缀自增');
T.eq(P('i++').prefix, false, '后缀');
T.eq(P('!ok').type, 'Unary', '逻辑非');
T.eq(P('-n').op, '-', '一元负号');

// 赋值是右结合的表达式
T.eq(P('a = b').type, 'Assign', '赋值');
T.eq(P('a += 1').op, '+=', '复合赋值');

// 位置信息
const posn = I.parseExpression('a +\n  bbb');
T.eq(posn.right.line, 2, '右操作数在第 2 行');
T.eq(posn.right.col, 3, '右操作数在第 3 列');

// 三元不在子集内（规格 §2.6 的清单没有它；§9 说清单是硬边界）
try { P('a ? b : c'); T.ok(false, '三元运算符应当被拒绝'); }
catch (e) { T.eq(e.category, 'unsupported', '三元报的是 unsupported 而不是 syntax'); }
```

- [ ] **Step 2: 运行确认失败**

Run: `node chess/core/interp.test.js`
Expected: FAIL —— `I.parseExpression is not a function`

- [ ] **Step 3: 写实现**

在 `interp.js` 的 `return` 之前插入解析器状态与表达式解析。要点：

- `state = { toks, i }`，`toks` 已过滤掉 `comment`。
- `at(type, value)` 判断当前 token；`eat(value)` 匹配则前进并返回 true；`expect(value)` 不匹配则 `throw err(...)`。
- **不支持的语法在这里就要报**：遇到 `name` 为 `class`/`this`/`new`/`typeof`/`delete`/`async`/`await`/`try`/`catch`/`throw` 时，抛 `err('Unsupported syntax: ' + w + ' is outside this interpreter\'s JavaScript subset', line, col, 'unsupported')`。遇到 `punct` 为 `...` 抛 spread 的 unsupported；遇到 `?` 抛三元的 unsupported。
- 每个 `parseX` 在进入时记下 `const t0 = cur(state)`，构造节点时带上 `line: t0.line, col: t0.col`。
- 模板串 token 的 `value.exprs` 是源码片段，用 `parseExpression(片段)` 递归解析成节点后放进 `Tpl.exprs`。

导出 `parseExpression(src)`：`tokenize` → 过滤 comment → `parseExpr` → 断言其后是 `eof`（否则报 `Unexpected token`）。

- [ ] **Step 4: 运行确认通过**

Run: `node chess/core/interp.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add chess/core/interp.js chess/core/interp.test.js
git commit -m "feat(chess): 表达式解析 —— 优先级、结合性、链式访问、箭头函数"
```

---

## Task 3: 语句解析与「不支持的语法」定位报错

**Files:**
- Modify: `chess/core/interp.js`
- Test: `chess/core/interp.test.js`

**Interfaces:**
- Consumes: Task 2
- Produces: `Interp.parse(src)` → `{ type: 'Program', body: Stmt[] }`；抛出的错误带 `{ message, line, col, category }`，`category ∈ 'syntax' | 'unsupported'`

语句节点：

```js
{ type: 'VarDecl', kind, name, init }        { type: 'ExprStmt', expr }
{ type: 'If', test, cons, alt }              { type: 'Block', body }
{ type: 'For', init, test, update, body }    { type: 'ForOf', kind, name, iterable, body }
{ type: 'While', test, body }                { type: 'Break' }  { type: 'Continue' }
{ type: 'Return', arg }                      { type: 'FuncDecl', name, params, body }
```

规格 §2.8 要求编辑器的实时检查能报出 `Unsupported syntax: class declaration (line 12). This interpreter supports a subset of JavaScript.`——**行、列、类别三样都是阶段 3b 画波浪线与红点的依据**，§7.3 专门为此设了一组测试。

- [ ] **Step 1: 写失败的测试**

追加到 `interp.test.js`：

```js
// ---- 语句解析 ----
function S(src) { return I.parse(src).body; }

T.eq(S('let x = 1;')[0].type, 'VarDecl', '变量声明');
T.eq(S('let x = 1;')[0].kind, 'let', 'kind 区分 let/const');
T.eq(S('x = 2;')[0].type, 'ExprStmt', '表达式语句');
T.eq(S('if (a) b(); else c();')[0].type, 'If', 'if/else');
T.ok(S('if (a) b();')[0].alt === null, '没有 else 时 alt 为 null');
T.eq(S('for (let i = 0; i < 3; i++) {}')[0].type, 'For', 'for');
T.eq(S('for (const v of xs) {}')[0].type, 'ForOf', 'for…of');
T.eq(S('for (const v of xs) {}')[0].name, 'v', 'for…of 的绑定名');
T.eq(S('while (a) {}')[0].type, 'While', 'while');
T.eq(S('function f(a, b) { return a; }')[0].type, 'FuncDecl', '函数声明');
T.eq(S('function f(a, b) { return a; }')[0].params, ['a', 'b'], '形参');
T.eq(S('{ let a = 1; }')[0].type, 'Block', '块语句');

// 分号可省（ASI 的极简版：换行或 } 处结束）
T.eq(S('let a = 1\nlet b = 2').length, 2, '不写分号也能解析出两条语句');

// ---- 不支持的语法：行、列、类别（阶段 3b 的波浪线全靠这三样）----
function bad(src) {
  try { I.parse(src); return null; }
  catch (e) { return { line: e.line, col: e.col, category: e.category, message: e.message }; }
}

const cls = bad('let a = 1;\nclass Foo {}');
T.eq(cls.category, 'unsupported', 'class 是 unsupported 不是 syntax');
T.eq(cls.line, 2, '报在第 2 行');
T.eq(cls.col, 1, '报在第 1 列');
T.ok(/class/.test(cls.message), '消息里点名了 class：' + cls.message);

T.eq(bad('try { a(); } catch (e) {}').category, 'unsupported', 'try/catch 不支持');
T.eq(bad('async function f() {}').category, 'unsupported', 'async 不支持');
T.eq(bad('const [a, b] = xs;').category, 'unsupported', '解构不支持');
T.eq(bad('f(...xs);').category, 'unsupported', '展开运算符不支持');
T.eq(bad('this.x = 1;').category, 'unsupported', 'this 不支持');
T.eq(bad('const r = /ab+/;').category, 'unsupported', '正则不支持');

// 真正的语法错误报 syntax
T.eq(bad('let x = ;').category, 'syntax', '缺少表达式是 syntax');
T.eq(bad('if (a { }').category, 'syntax', '缺少右括号是 syntax');

// 好代码不报错
T.eq(bad('let x = 1;'), null, '合法代码不抛');
```

- [ ] **Step 2: 运行确认失败**

Run: `node chess/core/interp.test.js`
Expected: FAIL —— `I.parse is not a function`

- [ ] **Step 3: 写实现**

`parseStatement(state)` 按首 token 分派；`parse(src)` 循环到 `eof`。

**不支持语法的检测集中在一处**（一个 `UNSUPPORTED_WORDS` 表 + 几处专门检查），不要散落：

```js
  /* 不支持的语法在**解析阶段**就报，而不是运行到一半崩（规格 §2.6）。
     报错必须带行、列、类别 —— 阶段 3b 的编辑器要用它画波浪线、在行号槽
     点红点、悬停显示消息（规格 §2.8），§7.3 为此专设了一组定位测试。
     category 分两类：'unsupported' 是「合法 JS，但不在这个子集里」，
     'syntax' 是「根本不是合法 JS」。两者对使用者的意义完全不同——
     前者要说「这个解释器只支持 JS 的一个子集」，后者要说「你这里写错了」。 */
  const UNSUPPORTED_WORDS = {
    'class': 'class declaration', 'this': 'this', 'new': 'the new operator',
    'async': 'async functions', 'await': 'await', 'try': 'try/catch',
    'catch': 'try/catch', 'throw': 'throw', 'typeof': 'typeof',
    'delete': 'delete', 'in': 'the in operator', 'instanceof': 'instanceof',
    'var': 'var (use let or const)', 'switch': 'switch', 'do': 'do…while',
    'yield': 'yield', 'super': 'super', 'export': 'export', 'import': 'import',
  };

  function unsupported(what, t) {
    return err('Unsupported syntax: ' + what + ' (line ' + t.line + '). ' +
               'This interpreter supports a subset of JavaScript.',
               t.line, t.col, 'unsupported');
  }
```

解构与正则需要专门判断：`let` / `const` 之后若不是 `name`（而是 `[` 或 `{`）→ 解构 unsupported；表达式位置上出现 `/` 且上下文期待操作数 → 正则 unsupported。

> **`in` 与 `instanceof` 放进不支持表的理由**：它们是 `for…in` 与原型链的入口，而规格明确不支持原型链。`for…of` 支持、`for…in` 不支持——这个区别要在报错文案里说清楚，否则使用者只会看到「in 不支持」而不知道该用什么。

- [ ] **Step 4: 运行确认通过**

Run: `node chess/core/interp.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add chess/core/interp.js chess/core/interp.test.js
git commit -m "feat(chess): 语句解析与不支持语法的行列定位报错"
```

---

## Task 4: 求值 —— 字面量、运算与差分测试骨架

**Files:**
- Modify: `chess/core/interp.js`
- Test: `chess/core/interp.test.js`

**Interfaces:**
- Consumes: Task 3 的 `parse`
- Produces: `Interp.run(src, opts)` → `{ result, trace, host }`；`opts = { host, limit }`

**这一步同时立起 §7.3 的差分测试骨架**——往后每一个求值特性都用它验证，不再手写期望值。

差分测试的做法：**同一份源码**交给自写解释器与原生 `Function(...)`，两边都注入同一组宿主函数（记录到数组里），比对**返回值**与**宿主调用序列**。

- [ ] **Step 1: 写失败的测试**

追加到 `interp.test.js`：

```js
// ============ §7.3 差分测试骨架 ============
/* 参照实现就是 JavaScript 自己：同一份源码交给自写解释器和原生 Function，
   比对返回值与宿主调用序列。任何不一致即失败。这是本阶段最强的一道门——
   不需要人工写期望值，也就不会出现「期望值本身写错了」这种事。 */
function diff(src, label) {
  const ops = [];
  const hostFor = (sink) => ({
    log: (m) => { sink.push(['log', m]); },
    mark: (sq, kind) => { sink.push(['mark', sq, kind]); },
    place: (sq, p) => { sink.push(['place', sq, p]); },
    clear: (sq) => { sink.push(['clear', sq]); },
    attacked: (sq) => { sink.push(['attacked', sq]); return false; },
  });

  const nativeOps = [];
  const nh = hostFor(nativeOps);
  let nativeVal, nativeErr = null;
  try {
    nativeVal = new Function('log', 'mark', 'place', 'clear', 'attacked',
      '"use strict";' + src)(nh.log, nh.mark, nh.place, nh.clear, nh.attacked);
  } catch (e) { nativeErr = String(e.message); }

  const interpOps = [];
  const ih = hostFor(interpOps);
  let interpVal, interpErr = null;
  try { interpVal = I.run(src, { host: ih }).result; }
  catch (e) { interpErr = String(e.message); }

  T.eq(interpErr, nativeErr, label + ' —— 抛错行为一致');
  T.eq(interpVal, nativeVal, label + ' —— 返回值一致');
  T.eq(interpOps, nativeOps, label + ' —— 宿主调用序列一致');
}

// ---- 算术与比较 ----
diff('return 1 + 2 * 3;', '运算优先级');
diff('return (1 + 2) * 3;', '括号');
diff('return 7 % 3;', '取模');
diff('return 7 / 2;', '除法保留小数');
diff('return -5 + 3;', '一元负号');
diff('return 1 < 2;', '小于');
diff('return 2 === 2;', '严格相等');
diff('return 2 !== 3;', '严格不等');
diff('return "a" + "b";', '字符串拼接');
diff('return "a" + 1;', '字符串与数字相加');

// ---- 短路求值：必须真的短路（宿主序列会暴露有没有多算）----
diff('return false && log("no");', '&& 短路：右侧不该被求值');
diff('return true || log("no");', '|| 短路：右侧不该被求值');
diff('log("a"); return true && log("b");', '&& 不短路时右侧要求值');
diff('return null;', 'null');
diff('return !0;', '逻辑非');

// ---- 变量 ----
diff('let a = 1; a = a + 1; return a;', '赋值');
diff('let a = 1; a += 5; return a;', '复合赋值');
diff('let i = 0; i++; return i;', '后缀自增');
diff('let i = 0; return i++;', '后缀自增返回旧值');
diff('let i = 0; return ++i;', '前缀自增返回新值');
diff('const c = 3; return c * 2;', 'const');

// ---- 数组与对象 ----
diff('const a = [1, 2, 3]; return a[1];', '数组下标');
diff('const a = [1, 2, 3]; a[0] = 9; return a[0];', '数组下标赋值');
diff('const a = [1, 2, 3]; return a.length;', '数组 length');
diff('const o = { x: 1 }; return o.x;', '对象属性');
diff('const o = { x: 1 }; o.y = 2; return o.y;', '对象属性赋值');
diff('const o = { x: 1 }; return o["x"];', '对象下标访问');

// ---- 模板串 ----
diff('const r = 3, c = 5; return `try (${r},${c})`;', '模板串插值');
diff('return `plain`;', '无插值的模板串');

// ---- 宿主桥接 ----
diff('log("hello"); return 1;', '宿主 log');
diff('mark(12, "trying"); clear(12); return 0;', '宿主 mark/clear');
diff('return attacked(9);', '宿主 attacked 的返回值');
```

- [ ] **Step 2: 运行确认失败**

Run: `node chess/core/interp.test.js`
Expected: FAIL —— `I.run is not a function`

- [ ] **Step 3: 写实现**

求值器用生成器写（规格 §2.6）：

```js
  /* 求值器用 JS 生成器写：function* evalX(...) + yield*，每到语句边界
     yield 一次。这样递归下降的写法天然可以在任意点暂停，代码量比手写
     显式栈机小得多。

     注意：生成器「能在任意点暂停」这个能力**只在录制期用到**。回放期
     （单步/后退/拖时间轴）走的是已记录好的轨迹数组，不再驱动生成器——
     因为「后退」只有先跑完再回放才做得到（规格 §2.7）。 */
```

作用域用链式环境：`{ vars: Map, parent }`。`lookup` 沿链向上；`declare` 只在当前层；`assign` 找到声明它的那一层。`const` 重新赋值抛错（差分测试会拿原生 JS 的报错行为对账）。

`run(src, opts)`：`parse` → 建根环境（注入 `opts.host` 的五个函数）→ 驱动生成器到底 → 返回 `{ result, trace, host }`。本任务先不记录轨迹（Task 7 加），`trace` 给空数组。

**宿主函数缺席时补空操作**（Task 7 的测试会用 `{ host: {} }` 跑含 `mark` / `log` 的程序）：

```js
  /* opts.host 里没给的函数补成空操作，而不是让它变成 undefined 然后在
     调用点抛「x is not a function」。理由是这五个函数是**算法与棋盘之间
     唯一的接口**（规格 §2.6）：算法源码里永远写着它们，而调用方有时并
     不需要棋盘（node 里跑纯逻辑测试、编辑器里只做语法检查）。缺席时静静
     不做事，比强迫每个调用方都传五个空函数干净。
     注意：**空操作不影响轨迹记录** —— boardOps 照记，因为轨迹记的是
     「算法要求棋盘做什么」，不是「棋盘真的做了什么」。 */
  const NOOP_HOST = {
    log: function () {}, mark: function () {}, place: function () {},
    clear: function () {}, attacked: function () { return false; },
  };
```

`attacked` 的缺省返回 `false`——它是唯一有返回值的宿主函数，返回 `undefined` 会让算法里的 `if (attacked(sq))` 行为与真实宿主下不同。

**内建的最小面**：`Array.prototype.length`、`push`/`pop`、`Math.abs`/`Math.max`/`Math.min`/`Math.floor`。**只加算法题真的需要的**，每加一个都要有对应的差分测试。

- [ ] **Step 4: 运行确认通过**

Run: `node chess/core/interp.test.js`
Expected: PASS。**任何一条 diff 失败，先看是不是测试程序用了子集之外的语法**；不是的话就是解释器错了。

- [ ] **Step 5: 提交**

```bash
git add chess/core/interp.js chess/core/interp.test.js
git commit -m "feat(chess): 生成器求值器与 §7.3 差分测试骨架 —— 拿 JS 自己当参照实现"
```

---

## Task 5: 控制流

**Files:**
- Modify: `chess/core/interp.js`
- Test: `chess/core/interp.test.js`

**Interfaces:**
- Consumes: Task 4 的 `run`
- Produces: `if/else`、`for`、`for…of`、`while`、`break`、`continue`、块作用域

- [ ] **Step 1: 写失败的测试**

追加到 `interp.test.js`：

```js
// ---- 控制流（全部走差分）----
diff('if (1 < 2) { log("y"); } else { log("n"); } return 0;', 'if 走 then 分支');
diff('if (1 > 2) { log("y"); } else { log("n"); } return 0;', 'if 走 else 分支');
diff('if (0) log("y"); return 1;', '无 else 的 if');
diff('let s = 0; for (let i = 0; i < 5; i++) { s += i; } return s;', 'for 累加');
diff('for (let i = 0; i < 3; i++) log(i); return 0;', 'for 的宿主序列');
diff('let s = 0; for (const v of [1,2,3]) { s += v; } return s;', 'for…of 数组');
diff('for (const c of "abc") log(c); return 0;', 'for…of 字符串');
diff('let i = 0; while (i < 3) { log(i); i++; } return i;', 'while');
diff('for (let i = 0; i < 5; i++) { if (i === 2) break; log(i); } return 0;', 'break');
diff('for (let i = 0; i < 5; i++) { if (i === 2) continue; log(i); } return 0;', 'continue');
diff('let i = 0; while (true) { i++; if (i > 3) break; } return i;', 'while(true) + break');
diff('for (const v of [1,2,3]) { if (v === 2) continue; log(v); } return 0;', 'for…of 里 continue');

// 嵌套循环里的 break 只跳出内层
diff('let n = 0; for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) { if (j === 1) break; n++; } } return n;',
     '嵌套 break 只跳内层');

// 块作用域：内层的 let 不该泄漏到外层
diff('let a = 1; { let a = 2; log(a); } log(a); return a;', '块作用域遮蔽');
diff('for (let i = 0; i < 2; i++) {} let i = 9; return i;', 'for 的 i 不泄漏到外层');
```

- [ ] **Step 2: 运行确认失败**

Run: `node chess/core/interp.test.js`
Expected: FAIL —— `if` / `for` 等语句求值未实现

- [ ] **Step 3: 写实现**

`break` / `continue` / `return` 用**哨兵对象**在生成器之间向上传播，不用异常：

```js
  /* break/continue/return 用哨兵对象逐层向上传，而不是 throw。
     用 throw 也能工作，但会与「真正的运行时错误」混在同一条通道上，
     调试器要区分「程序正常返回」和「程序崩了」时就得靠异常类型判断——
     哨兵让这两件事从一开始就是两回事。 */
  const BREAK = { signal: 'break' }, CONTINUE = { signal: 'continue' };
  function ret(v) { return { signal: 'return', value: v }; }
```

每个语句求值器返回 `undefined`（正常）或一个哨兵；循环体拿到 `BREAK` 就跳出、拿到 `CONTINUE` 就继续、拿到 `return` 哨兵就继续往上传。

**`for` 的每轮迭代要新建一层环境**并把循环变量拷进去——否则闭包捕获会与原生 JS 的 `let` 语义不一致（差分测试里那条"i 不泄漏"会抓到它，但闭包捕获的差异要等 Task 6 才暴露，先按 `let` 的正确语义写）。

- [ ] **Step 4: 运行确认通过**

Run: `node chess/core/interp.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add chess/core/interp.js chess/core/interp.test.js
git commit -m "feat(chess): 控制流 —— if/for/for-of/while 与 break/continue 的哨兵传播"
```

---

## Task 6: 函数、闭包与递归

**Files:**
- Modify: `chess/core/interp.js`
- Test: `chess/core/interp.test.js`

**Interfaces:**
- Consumes: Task 5
- Produces: 函数声明与调用、箭头函数、闭包、**递归**（回溯算法的核心）

- [ ] **Step 1: 写失败的测试**

追加到 `interp.test.js`：

```js
// ---- 函数 ----
diff('function f(a, b) { return a + b; } return f(1, 2);', '函数声明与调用');
diff('function f() { } return f();', '无返回值的函数返回 undefined');
diff('function f(a) { if (a) { return 1; } return 2; } return f(0);', '提前 return');
diff('const g = (a) => a * 2; return g(4);', '箭头函数表达式体');
diff('const g = (a) => { return a * 2; }; return g(4);', '箭头函数块体');
diff('const g = x => x + 1; return g(1);', '单参数箭头函数');

// 函数声明提升：调用写在声明之前也要能跑（原生 JS 会提升）
diff('return f(); function f() { return 42; }', '函数声明提升');

// 闭包
diff('function mk(n) { return () => n; } const a = mk(1), b = mk(2); return a() + b();', '闭包各自捕获');
diff('let c = 0; function inc() { c++; } inc(); inc(); return c;', '闭包写外层变量');

// 递归 —— 回溯算法的核心
diff('function fact(n) { if (n <= 1) { return 1; } return n * fact(n - 1); } return fact(6);', '阶乘');
diff('function fib(n) { if (n < 2) { return n; } return fib(n-1) + fib(n-2); } return fib(12);', '斐波那契（深递归）');

// 互递归
diff('function ev(n) { if (n === 0) { return true; } return od(n-1); } ' +
     'function od(n) { if (n === 0) { return false; } return ev(n-1); } return ev(10);', '互递归');

// 数组作为参数按引用传递（与原生一致）
diff('function push2(a) { a.push(2); } const xs = [1]; push2(xs); return xs.length;', '数组按引用传');

// 回溯的形状：递归 + 撤销
diff('function go(d, acc) { if (d === 0) { log(acc.length); return; } acc.push(d); go(d-1, acc); acc.pop(); } ' +
     'go(3, []); return 0;', '回溯：进入时 push、返回后 pop');
```

- [ ] **Step 2: 运行确认失败**

Run: `node chess/core/interp.test.js`
Expected: FAIL —— 函数调用未实现

- [ ] **Step 3: 写实现**

函数值：`{ __fn: true, params, body, closure, name, expression }`。调用时新建环境（`parent` 是 `closure` 而不是调用点——这就是闭包）。

**函数声明提升**：进入一个块时先扫一遍 `body`，把所有 `FuncDecl` 先声明好，再顺序执行。差分测试里那条"调用写在声明之前"会抓它。

**调用深度上限**（防止爆栈）：

```js
  /* 调用深度上限：JS 引擎自己的栈溢出会抛一个对使用者毫无意义的
     RangeError，而且 yield* 的嵌套会让真实可用深度比裸递归浅得多。
     这里主动在一个可解释的深度上停下并报清楚，胜过让引擎崩。
     1000 远大于教学规模所需（N 皇后 N≤12 的递归深度是 12）。 */
  const MAX_DEPTH = 1000;
```

超限抛 `err('Maximum call depth exceeded (1000). Is this recursion missing its base case?', line, col, 'runtime')`。

- [ ] **Step 4: 运行确认通过**

Run: `node chess/core/interp.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add chess/core/interp.js chess/core/interp.test.js
git commit -m "feat(chess): 函数、闭包、递归与调用深度上限"
```

---

## Task 7: 宿主桥接与可反放的轨迹

**Files:**
- Modify: `chess/core/interp.js`
- Test: `chess/core/interp.test.js`

**Interfaces:**
- Consumes: Task 6
- Produces: `run(src, opts).trace` → `Step[]`

```js
Step = {
  line,                 // 当前语句所在行（调试器高亮它）
  depth,                // 调用栈深度 —— 步入/步过/步出全靠它（见「决定 2」）
  frameOp,              // 'push' | 'pop' | null —— 这一步是否进出了一个函数帧
  frameName,            // frameOp 非空时的函数名
  varDelta: [ { name, from, to } ],   // from 为 undefined 表示此前不存在
  boardOps: [ { kind, sq, to, from } ],  // kind ∈ 'mark'|'place'|'clear'
  out,                  // 这一步产生的日志行（字符串）或 null
}
```

- [ ] **Step 1: 写失败的测试**

追加到 `interp.test.js`：

```js
// ---- 轨迹结构 ----
const tr1 = I.run('let a = 1;\nlet b = 2;\na = 3;', { host: {} }).trace;
T.ok(tr1.length >= 3, '三条语句至少三步');
T.eq(tr1.map(s => s.line).slice(0, 3), [1, 2, 3], '每步记下它所在的行');
T.eq(tr1[0].varDelta, [{ name: 'a', from: undefined, to: 1 }], '声明记为 from=undefined');
T.eq(tr1[2].varDelta, [{ name: 'a', from: 1, to: 3 }], '赋值记下旧值 —— 反放要靠它撤销');

// depth：步入/步过/步出的唯一依据
const tr2 = I.run('function f() { return 1; }\nf();', { host: {} }).trace;
T.ok(tr2.some(s => s.depth > 0), '进入函数后 depth 增大');
T.ok(tr2.some(s => s.frameOp === 'push'), '有入帧标记');
T.ok(tr2.some(s => s.frameOp === 'pop'), '有出帧标记');
T.eq(tr2[tr2.length - 1].depth, 0, '跑完回到深度 0');

// 宿主 op 自带撤销信息
const ops = I.run('mark(5, "trying");\nmark(5, "confirmed");', { host: {} }).trace
  .filter(s => s.boardOps.length).map(s => s.boardOps[0]);
T.eq(ops[0], { kind: 'mark', sq: 5, to: 'trying', from: null }, '首次标记 from=null');
T.eq(ops[1], { kind: 'mark', sq: 5, to: 'confirmed', from: 'trying' }, '再次标记记下旧值');

// 日志进 out
const outs = I.run('log("a");\nlog("b");', { host: {} }).trace.filter(s => s.out).map(s => s.out);
T.eq(outs, ['a', 'b'], '日志逐步记进 out');

// ---- 决定 3：轨迹存深拷贝，不存活引用 ----
/* 这条是本任务最容易做错、也最难在别处发现的地方：如果 varDelta 里存的是
   同一个数组引用，那么程序后续对它的修改会「改写历史」—— 回放到第 2 步时
   看到的是第 4 步的内容。 */
const alias = I.run('const xs = [];\nxs.push(1);\nxs.push(2);', { host: {} }).trace;
const firstXs = alias[0].varDelta.find(d => d.name === 'xs');
T.eq(firstXs.to, [], '第 1 步记下的 xs 必须仍然是空数组（不能被后续 push 改写）');

// ---- 反放：沿轨迹倒着撤销，能回到初始状态 ----
/* 这是「后退」功能的正确性判据。用一个纯函数模拟调试器的做法：
   正放时应用 to，反放时应用 from。 */
function replayVars(trace, upto) {
  const env = {};
  for (let i = 0; i < upto; i++) for (const d of trace[i].varDelta) env[d.name] = d.to;
  return env;
}
function rewindVars(trace, from, to) {
  const env = replayVars(trace, from);
  for (let i = from - 1; i >= to; i--) {
    for (const d of trace[i].varDelta) {
      if (d.from === undefined) delete env[d.name]; else env[d.name] = d.from;
    }
  }
  return env;
}
const rw = I.run('let a = 1;\na = 2;\na = 3;', { host: {} }).trace;
T.eq(replayVars(rw, 3).a, 3, '正放到第 3 步 a=3');
T.eq(rewindVars(rw, 3, 1).a, 1, '从第 3 步反放回第 1 步，a 回到 1');
T.eq(rewindVars(rw, 3, 0).a, undefined, '反放到第 0 步，a 不存在');
```

- [ ] **Step 2: 运行确认失败**

Run: `node chess/core/interp.test.js`
Expected: FAIL —— `trace` 为空数组

- [ ] **Step 3: 写实现**

在语句求值的 `yield` 点上记录一条 `Step`。深拷贝用一个本地 `snap(v)`（递归拷贝数组与普通对象，函数值渲染成 `'ƒ name'` 字符串——函数不可深拷贝，也没有显示价值）。

宿主 op 的 `from` 需要解释器自己维护一份"棋盘影子状态"（`{ [sq]: kind }`），因为宿主未必肯回答"这一格之前是什么"。影子状态只为记录撤销信息而存在，**不参与求值**。

- [ ] **Step 4: 运行确认通过**

Run: `node chess/core/interp.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add chess/core/interp.js chess/core/interp.test.js
git commit -m "feat(chess): 可反放的执行轨迹 —— 增量、带深度、自带撤销信息"
```

---

## Task 8: 两道上限

**Files:**
- Modify: `chess/core/interp.js`
- Test: `chess/core/interp.test.js`

**Interfaces:**
- Consumes: Task 7
- Produces: `run(src, { limit })`；`trace.truncated` / `trace.limit`；`Interp.STEP_LIMIT = 50000`

按**决定 5**：50,000 步上限**同时是执行上限**，到顶即停止执行，**不谎报"省略 N 步"**。

- [ ] **Step 1: 写失败的测试**

追加到 `interp.test.js`：

```js
// ---- 步数上限：同时是死循环保护（规格 §2.8）----
T.eq(I.STEP_LIMIT, 50000, '默认上限 50,000 步');

const loop = I.run('let i = 0;\nwhile (true) { i++; }', { host: {}, limit: 500 });
T.eq(loop.trace.truncated, true, '死循环被上限截住，不是卡死');
T.eq(loop.trace.limit, 500, '记下当时生效的上限');
T.ok(loop.trace.length <= 500, '轨迹不超过上限');

/* 不编造「省略了 N 步」：到达上限时执行已经停止，我们并不知道还剩多少步，
   而要知道就得跑完 —— 可上限的另一个身份正是死循环保护。规格 §2.6 那句
   「省略 N 步」与 §2.8 的「执行上限」互相冲突，本阶段按 §2.8 裁定。 */
T.eq(loop.trace.omitted, undefined, '不报一个我们不知道的数字');

// 正常结束的程序不该被标 truncated
const fine = I.run('let s = 0; for (let i = 0; i < 10; i++) { s += i; } return s;', { host: {} });
T.eq(fine.trace.truncated, false, '正常结束不标截断');
T.eq(fine.result, 45, '正常结束返回正确结果');

// 调用深度上限（Task 6）在这里一并回归
let depthErr = null;
try { I.run('function f() { return f(); } return f();', { host: {} }); }
catch (e) { depthErr = e; }
T.ok(depthErr, '无穷递归被拦住');
T.eq(depthErr.category, 'runtime', '类别是 runtime');
T.ok(/depth/i.test(depthErr.message), '消息提到深度：' + (depthErr && depthErr.message));
```

- [ ] **Step 2: 运行确认失败**

Run: `node chess/core/interp.test.js`
Expected: FAIL —— `I.STEP_LIMIT` 未定义 / 死循环测试挂起

> **如果这一步真的挂住了**（终端不返回），说明上限还没实现，用 `Ctrl+C` 中断即可——这正是本任务要修的问题。**不要因此把测试改小或删掉。**

- [ ] **Step 3: 写实现**

计步器放在 `yield` 点上；到顶时把 `truncated` 置 true 并让驱动循环停止（不是抛异常——抛异常会让"程序跑到一半被截断"和"程序出错了"混在一起）。

- [ ] **Step 4: 运行确认通过**

Run: `node chess/core/interp.test.js`
Expected: PASS，且**整个测试文件在数秒内跑完**（死循环那条不会挂住）

- [ ] **Step 5: 提交**

```bash
git add chess/core/interp.js chess/core/interp.test.js
git commit -m "feat(chess): 步数上限兼死循环保护，不谎报省略步数"
```

---

## Task 9: 算法级差分测试与内联接线

**Files:**
- Modify: `chess/core/interp.test.js`
- Modify: `chess/scripts/inline_core.py`

**Interfaces:**
- Consumes: Task 8
- Produces: `inline_core.py` 认识 `INTERP` 源；六道算法题形状的差分测试

规格 §7.3 要求测试集覆盖「**六道算法题的完整运行结果**」。阶段 5 才写那六道题，但**它们的形状现在就能测**——用同样范式的小规模版本。这是在为阶段 5 排雷：如果 N 皇后的写法现在跑不通，等到阶段 5 才发现就晚了。

- [ ] **Step 1: 写失败的测试**

追加到 `interp.test.js`（`T.report()` 之前）：

```js
// ============ 六道算法题的形状（为阶段 5 排雷）============
/* 阶段 5 才写真正的六道题，但它们的**范式**现在就能验：回溯、贪心启发式、
   BFS、匹配、支配集。如果某个范式现在在这个子集里写不出来，等到阶段 5
   才发现就晚了 —— 那时要改的是解释器，而解释器已经被四个工具内联了。 */

// ① N 皇后（回溯 + 剪枝）—— tourDFS/queens/independent 共用这个范式
diff([
  'function solve(N) {',
  '  const cols = [], d1 = [], d2 = [];',
  '  let count = 0;',
  '  function place(r) {',
  '    if (r === N) { count++; return; }',
  '    for (let c = 0; c < N; c++) {',
  '      if (cols[c] || d1[r + c] || d2[r - c + N]) { continue; }',
  '      cols[c] = 1; d1[r + c] = 1; d2[r - c + N] = 1;',
  '      mark(r * N + c, "trying");',
  '      place(r + 1);',
  '      cols[c] = 0; d1[r + c] = 0; d2[r - c + N] = 0;',
  '      clear(r * N + c);',
  '    }',
  '  }',
  '  place(0);',
  '  return count;',
  '}',
  'return solve(6);',
].join('\n'), '① N 皇后 N=6（解数应为 4，由原生 JS 自己算）');

// ② 骑士巡游 · Warnsdorff（贪心启发式）
diff([
  'const DX = [1,2,2,1,-1,-2,-2,-1], DY = [2,1,-1,-2,-2,-1,1,2];',
  'function tour(n, sr, sc) {',
  '  const seen = [];',
  '  for (let i = 0; i < n * n; i++) { seen.push(0); }',
  '  function deg(r, c) {',
  '    let d = 0;',
  '    for (let k = 0; k < 8; k++) {',
  '      const nr = r + DY[k], nc = c + DX[k];',
  '      if (nr >= 0 && nr < n && nc >= 0 && nc < n && !seen[nr * n + nc]) { d++; }',
  '    }',
  '    return d;',
  '  }',
  '  let r = sr, c = sc, steps = 1;',
  '  seen[r * n + c] = 1;',
  '  place(r * n + c, "N");',
  '  for (let s = 1; s < n * n; s++) {',
  '    let best = -1, bd = 9, br = -1, bc = -1;',
  '    for (let k = 0; k < 8; k++) {',
  '      const nr = r + DY[k], nc = c + DX[k];',
  '      if (nr < 0 || nr >= n || nc < 0 || nc >= n) { continue; }',
  '      if (seen[nr * n + nc]) { continue; }',
  '      const d = deg(nr, nc);',
  '      if (d < bd) { bd = d; br = nr; bc = nc; best = k; }',
  '    }',
  '    if (best < 0) { break; }',
  '    r = br; c = bc; seen[r * n + c] = 1; steps++;',
  '    place(r * n + c, "N");',
  '  }',
  '  return steps;',
  '}',
  'return tour(5, 0, 0);',
].join('\n'), '② 骑士巡游 Warnsdorff 5×5');

// ③ 马的最短路（BFS）
diff([
  'const DX = [1,2,2,1,-1,-2,-2,-1], DY = [2,1,-1,-2,-2,-1,1,2];',
  'function bfs(n, sr, sc, tr, tc) {',
  '  const dist = [];',
  '  for (let i = 0; i < n * n; i++) { dist.push(-1); }',
  '  let q = [sr * n + sc];',
  '  dist[sr * n + sc] = 0;',
  '  while (q.length > 0) {',
  '    const nq = [];',
  '    for (const cell of q) {',
  '      const r = (cell - cell % n) / n, c = cell % n;',
  '      if (r === tr && c === tc) { return dist[cell]; }',
  '      for (let k = 0; k < 8; k++) {',
  '        const nr = r + DY[k], nc = c + DX[k];',
  '        if (nr < 0 || nr >= n || nc < 0 || nc >= n) { continue; }',
  '        if (dist[nr * n + nc] >= 0) { continue; }',
  '        dist[nr * n + nc] = dist[cell] + 1;',
  '        mark(nr * n + nc, "frontier");',
  '        nq.push(nr * n + nc);',
  '      }',
  '    }',
  '    q = nq;',
  '  }',
  '  return -1;',
  '}',
  'return bfs(8, 0, 0, 7, 7);',
].join('\n'), '③ 马的最短路 a1→h8（原生 JS 会算出 6）');

// ④ 二分图匹配的增广路（rookCover 的范式）
diff([
  'function match(n, adj) {',
  '  const to = [];',
  '  for (let i = 0; i < n; i++) { to.push(-1); }',
  '  function aug(u, seen) {',
  '    for (const v of adj[u]) {',
  '      if (seen[v]) { continue; }',
  '      seen[v] = 1;',
  '      if (to[v] < 0) { to[v] = u; return true; }',
  '      if (aug(to[v], seen)) { to[v] = u; return true; }',
  '    }',
  '    return false;',
  '  }',
  '  let m = 0;',
  '  for (let u = 0; u < n; u++) {',
  '    const seen = [];',
  '    for (let i = 0; i < n; i++) { seen.push(0); }',
  '    if (aug(u, seen)) { m++; log("matched " + u); }',
  '  }',
  '  return m;',
  '}',
  'return match(3, [[0,1],[0],[1,2]]);',
].join('\n'), '④ 二分图匹配增广路');

// ⑤ 贪心支配集（kingDominate 的范式）
diff([
  'function greedy(n, sets) {',
  '  const covered = [];',
  '  for (let i = 0; i < n; i++) { covered.push(0); }',
  '  let picked = 0, left = n;',
  '  while (left > 0) {',
  '    let best = -1, bestGain = 0;',
  '    for (let s = 0; s < sets.length; s++) {',
  '      let gain = 0;',
  '      for (const v of sets[s]) { if (!covered[v]) { gain++; } }',
  '      if (gain > bestGain) { bestGain = gain; best = s; }',
  '    }',
  '    if (best < 0) { break; }',
  '    for (const v of sets[best]) { if (!covered[v]) { covered[v] = 1; left--; } }',
  '    picked++;',
  '    mark(best, "confirmed");',
  '  }',
  '  return picked;',
  '}',
  'return greedy(6, [[0,1,2],[2,3],[3,4,5],[1,4]]);',
].join('\n'), '⑤ 贪心集合覆盖');

// ⑥ 极小博弈树 + α-β（工具④ 的范式）
diff([
  'const LEAF = [3,5,6,9,1,2,0,-1];',
  'let visited = 0;',
  'function ab(i, d, a, b, maxing) {',
  '  visited++;',
  '  if (d === 0) { return LEAF[i]; }',
  '  if (maxing) {',
  '    let best = -999;',
  '    for (let k = 0; k < 2; k++) {',
  '      const v = ab(i * 2 + k, d - 1, a, b, false);',
  '      if (v > best) { best = v; }',
  '      if (best > a) { a = best; }',
  '      if (b <= a) { log("prune"); break; }',
  '    }',
  '    return best;',
  '  }',
  '  let best = 999;',
  '  for (let k = 0; k < 2; k++) {',
  '    const v = ab(i * 2 + k, d - 1, a, b, true);',
  '    if (v < best) { best = v; }',
  '    if (best < b) { b = best; }',
  '    if (b <= a) { log("prune"); break; }',
  '  }',
  '  return best;',
  '}',
  'const r = ab(0, 3, -999, 999, true);',
  'log("visited " + visited);',
  'return r;',
].join('\n'), '⑥ α-β 剪枝（剪枝序列必须与原生逐条一致）');
```

- [ ] **Step 2: 运行确认失败或通过**

Run: `node chess/core/interp.test.js`

**这一步的预期不同于前面的任务**：如果前八个任务做对了，这六条**可能直接就通过**。那是好事，不是"测试没生效"。

**但如果有任何一条失败**：先确认失败原因是「解释器与原生 JS 不一致」而不是「测试程序用了子集之外的语法」。前者修解释器；后者**停下来报告**——那意味着这个范式在当前子集里写不出来，是一个需要我裁定的规格问题（扩子集要按 §9 先补差分测试）。

- [ ] **Step 3: `inline_core.py` 加 `INTERP` 源**

```python
SOURCES = {
    'VIZ-ENGINE': ROOT / 'core' / 'viz-engine.js',
    'CHESS-CORE': ROOT / 'core' / 'chess-core.js',
    'INTERACT': ROOT / 'core' / 'interact.js',
    'BOARD-RENDER': ROOT / 'core' / 'board-render.js',
    'REPLAY': ROOT / 'core' / 'replay.js',
    'INTERP': ROOT / 'core' / 'interp.js',
}

# 只有部分工具有这些标记区；其余 html 缺它们是正常的，不该 WARN。
OPTIONAL_TAGS = {'REPLAY', 'GAMES', 'INTERP'}
```

现在还没有任何 html 带 `GENERATED:INTERP` 标记，**这是正常的**——阶段 3b 的验收页与阶段 4 的工具④ 才会加。你要保证的是「加了标记的文件能被正确注入、没加的不报噪音」。

- [ ] **Step 4: 全量验收**

```bash
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py;            echo "chess gate exit=$?"
python3 scripts/sync_registry.py --check;  echo "main registry exit=$?"
node chess/core/interp.test.js
git status --short
```
Expected: 两个门都 exit 0；`interp.test.js` 全绿；**WARN 里没有关于 `INTERP` 的行**。

- [ ] **Step 5: 提交**

```bash
git add chess/core/interp.test.js chess/scripts/inline_core.py
git commit -m "test(chess): 六道算法范式的差分测试；内联认识 INTERP 源"
```

---

## 阶段 3a 完成标准

- [ ] `node chess/core/interp.test.js` 全绿，且**整个文件在数秒内跑完**（死循环那条不会挂住）
- [ ] `python3 chess/scripts/check.py` exit 0
- [ ] `python3 scripts/sync_registry.py --check` exit 0
- [ ] 差分测试覆盖规格 §7.3 点名的全部类别：算术与短路求值、数组操作、`for`/`for…of`/`while` 与 `break`/`continue`、函数与闭包、深递归、六道算法题的范式
- [ ] 语法错误定位测试覆盖行、列、类别三样（阶段 3b 的波浪线依赖它）
- [ ] 不支持的语法**在解析阶段**报错，消息里点名是什么语法，类别为 `'unsupported'`
- [ ] 轨迹可反放：`varDelta` 带 `from`、`boardOps` 带 `from`、每步带 `depth`
- [ ] 轨迹存的是深拷贝，**后续修改不会改写历史**（有专门断言）
- [ ] 50,000 步上限同时是执行上限，**不谎报"省略 N 步"**
- [ ] `interp.js` 零依赖、零 DOM、UMD 双导出、node 可直接加载

**下一阶段**：3b（`debugger.js` + `editor.js` + `chess/tools/_debugger-preview.html` 验收页）。它消费本阶段的 `tokenize`（语法高亮）、`parse`（实时语法检查）、`run().trace`（单步/后退/步入步过步出）。
