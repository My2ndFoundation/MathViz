# Cryptography 子项目第一期实现计划（脚手架 + Caesar）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建成 `cryptography/` 独立子项目的完整骨架，并用 Caesar 一个真工具把
`core → inline_core.py → tools/*.html → 注册表 → 画廊 → 导航壳 → 校验门` 端到端跑通。

**Architecture:** 镜像 `chess/` 已验证的子项目形态——`core/*.js` 是唯一编辑源，
`scripts/inline_core.py` 把它们注入 `tools/*.html` 的 GENERATED 区间，产物完全自足、
`file://` 双击可用。三套注册表（根 / chess / cryptography）互不相交。
`cryptography/` 整个目录可以搬到任何地方独立运行。

**Tech Stack:** 零依赖。浏览器端 ES5-兼容风格的 UMD 模块 + Canvas 2D；
构建与校验用 Python 3 标准库；测试用 `node <file>.test.js`（自带 15 行断言harness，无测试框架）。

设计文档：[`docs/superpowers/specs/2026-08-09-cryptography-subproject-design.md`](../specs/2026-08-09-cryptography-subproject-design.md)
上游架构规范：[`docs/superpowers/cryptography.md`](../cryptography.md)

---

## Global Constraints

每个任务的要求都隐含包含本节。

1. **零依赖、零构建。** 不引入 npm / CDN / 字体 / 图片。任何 `tools/*.html` 双击
   （`file://`）必须完整可用。
2. **不碰根项目的数学工具体系。** 根 `tools.json`、`scripts/sync_registry.py`、
   根 `app.html`、`outputs/**` **一个字节都不许改**。根仓库唯一允许的改动是
   `index.html` 的 Subprojects 卡片区（Task 9）。
3. **不碰 `chess/`。** 一个字节都不许改。要复用就复制。
4. **i18n**：存储键 `cryptography-lang` / `cryptography-nav`。
   语言优先级 `?lang=` → `localStorage` → **默认 `'en'`**（不是 zh）。
   所有面向用户的文案是 `{zh, en}` 对象，经 `t()` 渲染。缺 key 时兜底到 `en`。
5. **代码注释与文档用中文**（与本仓既有风格一致）。
6. **配色**：`--trace-cyan:#2dd4ea`、`--trace-rose:#fb7185`、`--trace-violet:#a78bfa`、
   `--trace-emerald:#34d399`、`--trace-orange:#fb923c`、`--trace-unpaired:#ff2fd0`。
   `accent` 合法值只有前五个键名。
7. **字体令牌**：
   `--font-cn:ui-sans-serif,-apple-system,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif`
   `--font-mono:ui-monospace,"SF Mono",Menlo,Consolas,"Cascadia Mono",monospace`
   `--font-math:Georgia,"Times New Roman","Songti SC","Noto Serif SC",serif`
   数学符号（含字母轮上的字母、模运算数字）一律 `--font-math` 斜体，Canvas 与 HTML 一致。
8. **背景令牌**：`--bg-deep:#05070d`、`--bg-mid:#0c1526`、`--ui-slate:#9fb0c8`、
   `--ui-bright:#e2e8f0`、`--panel-bg:rgba(13,20,36,.74)`、`--panel-line:rgba(148,163,184,.16)`。
9. **文本排版**：负号用 U+2212（−），数值默认 2 位小数，角度取整。
10. **引擎版本标识**：`crypto-1.0.0`。工具版本 `1.0.0`。
11. **生成区间禁止手改**（`/* >>> GENERATED:X */ … /* <<< GENERATED:X */`）。
12. **提交纪律**：只 `git add` 显式路径，绝不 `git add -A` / `-u` / `git commit -a`。
    钩子跑完后重读 `git status --short`，确认每一条都是自己的。
13. **`node --check` / `node -e` 一律走 stdin**，不走 argv。Linux 单个 argv 元素上限
    `MAX_ARG_STRLEN` = 131072 字节，macOS 没有——本仓因此有过连续四次 CI 假绿。

---

## File Structure

```
cryptography/
├── app.html                        Task 7   导航壳（侧栏按 chapter 分组 + iframe）
├── index.html                      Task 7   画廊（卡片按 chapter 分组），同时是壳的 home
├── cryptography-tools.json         Task 6   注册表，唯一真相
├── core/
│   ├── _test.js                    Task 1   15 行断言 harness（eq / ok / throws / report）
│   ├── crypto-core.js              Task 1   字母表、归一化、模运算
│   ├── crypto-core.test.js         Task 1
│   ├── viz-engine.js               Task 3   fork chess 引擎 + screen-space 2D 图元层
│   ├── interact.js                 Task 3   fork（指针/拖拽/hover）
│   ├── animation.js                Task 3   时间轴：play/pause/step±/慢放
│   ├── animation.test.js           Task 3
│   ├── cryptanalysis.js            Task 2   字母频率、χ²
│   ├── cryptanalysis.test.js       Task 2
│   └── algos/
│       ├── caesar.js               Task 2   encrypt / decrypt / bruteForce
│       └── caesar.test.js          Task 2
├── examples/
│   ├── examples-classical.js       Task 4   教学明文与密钥
│   ├── examples.js                 Task 4   汇总器
│   └── examples.test.js            Task 4
├── tools/
│   ├── _skeleton.html              Task 5   新工具的唯一起点
│   └── crypto-caesar.html          Task 6   三页签：字母轮 / 模 26 / 穷举
└── scripts/
    ├── inline_core.py              Task 5   core → GENERATED 区间
    └── check.py                    Task 8   校验门

根仓库（Task 9，只此四处）：
├── index.html                      Subprojects 区新增 Cryptography 卡片
├── .githooks/pre-commit            新增 cryptography 段
├── .github/workflows/registry-sync.yml   新增 cryptography gates 步骤
└── .claude/skills/crypto-viz-tool/SKILL.md   新建
```

### 依赖与并行波次

| 波次 | 任务 | 依赖 |
|---|---|---|
| A | Task 1（crypto-core + harness）、Task 3（引擎）、Task 5（skeleton + inline_core.py） | 无 |
| B | Task 2（caesar + cryptanalysis）、Task 4（examples） | Task 1 |
| C | Task 6（注册表 + Caesar 工具） | 1,2,3,4,5 |
| D | Task 7（app/index）、Task 9（仓库接线） | Task 6（Task 7 需要注册表字段） |
| E | Task 8（check.py） | 6,7 |
| F | Task 10（端到端验收 + PR） | 全部 |

同一波次内的任务文件互不相交，可并行；并行时每个执行者用独立 worktree。

---

## Task 1: 测试 harness 与 crypto-core

**Files:**
- Create: `cryptography/core/_test.js`
- Create: `cryptography/core/crypto-core.js`
- Create: `cryptography/core/crypto-core.test.js`

**Interfaces:**
- Consumes: 无
- Produces:
  - `_test.js` 导出 `{ eq, ok, throws, report }`。
    `eq(actual, expected, label)`、`ok(cond, label)`、
    `throws(fn, label, pattern)`（`pattern` 是 RegExp，**必传**）、
    `report(name)` 打印统计并在有失败时 `process.exit(1)`。
  - `crypto-core.js` 挂在 `root.CryptoCore`（浏览器）/ `module.exports`（node），导出：
    ```
    ALPHABET   : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    N          : 26
    isAlpha(ch)            -> bool          仅 A-Z / a-z
    normalize(text)        -> string        只留 A-Z，全部大写
    letters(text)          -> number[]      normalize 后每字母的 0..25 下标
    fromIndices(idx)       -> string        0..25 下标数组还原为大写字母串
    mod(a, n)              -> number        真模，结果恒 >= 0
    gcd(a, b)              -> number        非负
    egcd(a, b)             -> [g, x, y]     a*x + b*y === g
    modInverse(a, n)       -> number|null   gcd(a,n) !== 1 时返回 null
    ```

**为什么 `gcd` / `egcd` / `modInverse` 现在就建**：Caesar 本身用不到它们
（解密是 `mod(c - k, 26)`）。它们是 Chapter 1 下一个工具 Affine 的直接前置，
且是规范 §13 点名要 `crypto-core.js` 承担的"模运算"内容。带测试的、有明确
下一个消费者的代码可以先落地；没有测试的死代码不行——所以本任务给它们写全测试。

**本任务明确不建**：`toBytes` / `fromBytes` / `toBits` / `xorBytes` / 矩阵工具。
它们的第一个消费者在 Chapter 4（OTP/DES/AES）与 Hill，跟那批一起出生。

- [ ] **Step 1: 写 `_test.js`**

```javascript
'use strict';
/* 15 行级别的断言 harness——本子项目不引入任何测试框架（Global Constraint 1）。
   语义与 chess/core/_test.js 同源，但去掉了那边为解释器 BigInt 与 THROWS_AUDIT
   加的两处特化：这里没有解释器，也没有普查脚本，照抄等于带进两段永远不执行的代码。 */
let passed = 0;
const failures = [];

function serialize(v) { return JSON.stringify(v); }

function eq(actual, expected, label) {
  const a = serialize(actual), e = serialize(expected);
  if (a === e) { passed++; return; }
  failures.push(label + '\n    expected: ' + e + '\n    actual:   ' + a);
}

function ok(cond, label) {
  if (cond) { passed++; return; }
  failures.push(label + '\n    expected truthy, got: ' + cond);
}

/* pattern 必传且必须是 RegExp。chess 那边允许省略第三参，结果是一批
   "抛了就算过"的断言——它自己的第九道门后来专门去数这种退化，
   ALLOW_MISSING 一路收到 0。这里从第一天起就不给这个退化留入口。 */
function throws(fn, label, pattern) {
  if (!(pattern instanceof RegExp)) {
    failures.push(label + '\n    T.throws 第三参 pattern 必须是 RegExp');
    return;
  }
  try {
    fn();
  } catch (err) {
    const msg = String(err && err.message != null ? err.message : err);
    if (pattern.test(msg)) { passed++; return; }
    failures.push(label + '\n    threw, but message did not match ' + pattern +
                  '\n    actual:   ' + msg);
    return;
  }
  failures.push(label + '\n    expected throw, but returned normally');
}

function report(name) {
  if (failures.length === 0) {
    console.log(name + ': ' + passed + ' 条断言全部通过');
    return;
  }
  console.error(name + ': ' + failures.length + ' 条失败 / ' +
                (passed + failures.length) + ' 条断言');
  failures.forEach(function (f) { console.error('  ✗ ' + f); });
  process.exit(1);
}

module.exports = { eq, ok, throws, report };
```

- [ ] **Step 2: 写失败测试 `crypto-core.test.js`**

```javascript
'use strict';
const T = require('./_test.js');
const C = require('./crypto-core.js');

/* ---- 字母表与归一化 ---- */
T.eq(C.ALPHABET.length, 26, 'ALPHABET 有 26 个字母');
T.eq(C.N, 26, 'N === 26');
T.eq(C.normalize('Hello, World!'), 'HELLOWORLD', 'normalize 去掉标点与空格并大写');
T.eq(C.normalize(''), '', 'normalize 空串');
T.eq(C.normalize('123 —— ！'), '', 'normalize 全非字母 -> 空串');
T.eq(C.normalize('Héllo'), 'HLLO', 'normalize 丢弃非 ASCII 字母（é 不在 A-Z）');
T.ok(C.isAlpha('a') && C.isAlpha('Z'), 'isAlpha 认大小写字母');
T.ok(!C.isAlpha('1') && !C.isAlpha(' ') && !C.isAlpha('é'), 'isAlpha 拒非字母');

T.eq(C.letters('abc'), [0, 1, 2], 'letters 小写映射到 0..2');
T.eq(C.letters('XYZ'), [23, 24, 25], 'letters 大写映射到 23..25');
T.eq(C.letters('a b!c'), [0, 1, 2], 'letters 跳过非字母');
T.eq(C.fromIndices([0, 1, 25]), 'ABZ', 'fromIndices 还原');
T.eq(C.fromIndices([]), '', 'fromIndices 空数组');
/* 往返：这条比单向映射更值钱——它钉住 letters 与 fromIndices 用的是同一张表。 */
T.eq(C.fromIndices(C.letters('The Quick Brown Fox')), 'THEQUICKBROWNFOX',
     'letters/fromIndices 往返');

/* ---- 模运算 ---- */
T.eq(C.mod(5, 26), 5, 'mod 正数');
T.eq(C.mod(-1, 26), 25, 'mod 负数回到正区间（JS 的 % 在这里是 -1）');
T.eq(C.mod(-27, 26), 25, 'mod 负数跨多圈');
T.eq(C.mod(26, 26), 0, 'mod 整周为 0');
T.eq(C.mod(0, 26), 0, 'mod 零');

T.eq(C.gcd(12, 18), 6, 'gcd(12,18)');
T.eq(C.gcd(7, 26), 1, 'gcd(7,26) 互素');
T.eq(C.gcd(0, 5), 5, 'gcd(0,5)');
T.eq(C.gcd(-12, 18), 6, 'gcd 对负数取非负结果');

/* egcd 的贝祖等式对每一对都必须成立，比抽查一两个具体值更有力。 */
[[7, 26], [12, 18], [1, 1], [0, 5], [26, 7]].forEach(function (p) {
  const r = C.egcd(p[0], p[1]);
  T.eq(r[0], C.gcd(p[0], p[1]), 'egcd 首项等于 gcd：' + p);
  T.eq(p[0] * r[1] + p[1] * r[2], r[0], '贝祖等式 a*x+b*y=g：' + p);
});

/* modInverse：对 26 而言恰好有 12 个可逆元（与 26 互素的数）。 */
let invertible = 0;
for (let a = 0; a < 26; a++) {
  const inv = C.modInverse(a, 26);
  if (inv === null) { T.ok(C.gcd(a, 26) !== 1, 'modInverse 返回 null 时必不互素：a=' + a); continue; }
  invertible++;
  T.eq(C.mod(a * inv, 26), 1, 'a * a⁻¹ ≡ 1 (mod 26)：a=' + a);
  T.ok(inv >= 0 && inv < 26, 'modInverse 结果落在 [0,26)：a=' + a);
}
T.eq(invertible, 12, '模 26 恰有 12 个可逆元');

T.throws(function () { C.mod(5, 0); }, 'mod 的模数为 0 要抛', /模数/);

T.report('crypto-core');
```

- [ ] **Step 3: 跑测试确认失败**

```bash
node cryptography/core/crypto-core.test.js
```
预期：FAIL — `Cannot find module './crypto-core.js'`

- [ ] **Step 4: 写 `crypto-core.js`**

UMD 包裹（本仓所有 `core/*.js` 的统一形状，既能被 node `require`，
也能被内联进 HTML 后挂到 `window`）：

```javascript
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CryptoCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const N = 26;

  function isAlpha(ch) {
    if (typeof ch !== 'string' || ch.length !== 1) return false;
    const c = ch.charCodeAt(0);
    return (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
  }

  /* 只留 A-Z 并大写。刻意**不**做 Unicode 折叠（é → E）：这是古典密码，
     字母表就是 26 个，把 é 悄悄折进 E 会让"密文长度 = 明文字母数"这条
     使用者肉眼在数的关系对不上。丢弃比折叠诚实。 */
  function normalize(text) {
    return String(text).toUpperCase().replace(/[^A-Z]/g, '');
  }

  function letters(text) {
    const s = normalize(text);
    const out = [];
    for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) - 65);
    return out;
  }

  function fromIndices(idx) {
    let s = '';
    for (let i = 0; i < idx.length; i++) s += ALPHABET.charAt(mod(idx[i], N));
    return s;
  }

  /* JS 的 % 是取余不是取模：(-1) % 26 === -1。整个古典密码部分都建立在
     "落回 [0,n)" 上，所以这一个函数是地基，不许有人图省事直接写 %。 */
  function mod(a, n) {
    if (n === 0) throw new Error('mod 的模数不能为 0');
    return ((a % n) + n) % n;
  }

  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { const t = a % b; a = b; b = t; }
    return a;
  }

  /* 扩展欧几里得：返回 [g, x, y] 满足 a*x + b*y === g === gcd(a,b)。
     modInverse 靠它，Affine 的解密也靠它。 */
  function egcd(a, b) {
    let old_r = a, r = b;
    let old_s = 1, s = 0;
    let old_t = 0, t = 1;
    while (r !== 0) {
      const q = Math.floor(old_r / r);
      let tmp = old_r - q * r; old_r = r; r = tmp;
      tmp = old_s - q * s; old_s = s; s = tmp;
      tmp = old_t - q * t; old_t = t; t = tmp;
    }
    /* gcd 约定非负；a<0 或 b<0 时上面会得到负的 old_r，连同系数一起翻号，
       贝祖等式仍成立。 */
    if (old_r < 0) return [-old_r, -old_s, -old_t];
    return [old_r, old_s, old_t];
  }

  function modInverse(a, n) {
    const r = egcd(mod(a, n), n);
    if (r[0] !== 1) return null;      // 不互素，逆元不存在
    return mod(r[1], n);
  }

  return { ALPHABET, N, isAlpha, normalize, letters, fromIndices,
           mod, gcd, egcd, modInverse };
});
```

- [ ] **Step 5: 跑测试确认通过**

```bash
node cryptography/core/crypto-core.test.js
```
预期：PASS，打印 `crypto-core: NN 条断言全部通过`

- [ ] **Step 6: 提交**

```bash
git add cryptography/core/_test.js cryptography/core/crypto-core.js cryptography/core/crypto-core.test.js
git commit -m "feat(crypto): 测试 harness 与 crypto-core（字母表 · 归一化 · 模运算）"
```

---

## Task 2: Caesar 算法与密码分析

**Files:**
- Create: `cryptography/core/algos/caesar.js`
- Create: `cryptography/core/algos/caesar.test.js`
- Create: `cryptography/core/cryptanalysis.js`
- Create: `cryptography/core/cryptanalysis.test.js`

**Interfaces:**
- Consumes: `CryptoCore.{normalize, mod, ALPHABET, N}`（Task 1）
- Produces:
  - `root.CryptoAlgos = root.CryptoAlgos || {}; root.CryptoAlgos.caesar = {...}`，
    node 下同时 `module.exports`：
    ```
    encrypt(text, k)      -> string   保留大小写与非字母字符，字母整体位移 k
    decrypt(text, k)      -> string   === encrypt(text, -k)
    bruteForce(cipher)    -> [{ k: 0..25, text: string }]   长度恒为 26，按 k 升序
    ```
  - `root.Cryptanalysis`：
    ```
    ENGLISH_FREQ          -> number[26]   英文字母相对频率，和为 1
    letterCounts(text)    -> number[26]
    letterFrequency(text) -> number[26]   归一化；无字母时全 0
    chiSquare(text)       -> number       越小越像英文；无字母时返回 Infinity
    ```

**分工边界（规范 §14）**：`caesar.js` 只管密码本身，**不打分**；
打分是密码分析，住在 `cryptanalysis.js`。工具页把两者接起来。

- [ ] **Step 1: 写失败测试 `caesar.test.js`**

```javascript
'use strict';
const T = require('../_test.js');
const C = require('../crypto-core.js');
const caesar = require('./caesar.js');

/* ---- 教科书向量 ---- */
T.eq(caesar.encrypt('ATTACK AT DAWN', 3), 'DWWDFN DW GDZQ', 'k=3 经典向量');
T.eq(caesar.decrypt('DWWDFN DW GDZQ', 3), 'ATTACK AT DAWN', 'k=3 解密回原文');
T.eq(caesar.encrypt('HELLO', 13), 'URYYB', 'k=13 即 ROT13');
T.eq(caesar.encrypt(caesar.encrypt('HELLO', 13), 13), 'HELLO', 'ROT13 自逆');

/* ---- 大小写与非字母字符原样保留 ---- */
T.eq(caesar.encrypt('Hello, World!', 3), 'Khoor, Zruog!', '保留大小写与标点');
T.eq(caesar.encrypt('a-z A-Z', 1), 'b-a B-A', '两端都要绕回：z→a、Z→A');
T.eq(caesar.encrypt('中文 123', 5), '中文 123', '非 ASCII 与数字原样穿过');

/* ---- k 的边界与规约 ---- */
T.eq(caesar.encrypt('ABC', 0), 'ABC', 'k=0 是恒等');
T.eq(caesar.encrypt('ABC', 26), 'ABC', 'k=26 与 k=0 同一个轮子');
T.eq(caesar.encrypt('ABC', -1), caesar.encrypt('ABC', 25), 'k=-1 等于 k=25');
T.eq(caesar.encrypt('ABC', 29), caesar.encrypt('ABC', 3), 'k=29 等于 k=3');

/* ---- 性质：全 k 往返（check.py 第 12 道门也钉这一条）---- */
const SAMPLE = 'The Quick Brown Fox Jumps Over 13 Lazy Dogs! —— 中文';
for (let k = 0; k < 26; k++) {
  T.eq(caesar.decrypt(caesar.encrypt(SAMPLE, k), k), SAMPLE,
       'decrypt(encrypt(p,' + k + '),' + k + ') === p');
}

/* ---- bruteForce ---- */
const bf = caesar.bruteForce('DWWDFN');
T.eq(bf.length, 26, 'bruteForce 恒给 26 个候选');
T.eq(bf[0].k, 0, 'bruteForce 按 k 升序，首项 k=0');
T.eq(bf[25].k, 25, 'bruteForce 末项 k=25');
T.eq(bf[0].text, 'DWWDFN', 'k=0 的候选就是密文本身');
T.eq(bf[3].text, 'ATTACK', 'k=3 的候选是明文');
/* 每个候选都必须真的等于用那个 k 解出来的结果——否则 26 行里可能有一行是
   摆设，而使用者正是靠肉眼扫这 26 行得到"密钥空间才是弱点"这个结论的。 */
bf.forEach(function (c) {
  T.eq(c.text, caesar.decrypt('DWWDFN', c.k), 'bruteForce 第 ' + c.k + ' 项与 decrypt 一致');
});

T.report('caesar');
```

- [ ] **Step 2: 跑测试确认失败**

```bash
node cryptography/core/algos/caesar.test.js
```
预期：FAIL — `Cannot find module './caesar.js'`

- [ ] **Step 3: 写 `caesar.js`**

```javascript
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../crypto-core.js'));
  else {
    root.CryptoAlgos = root.CryptoAlgos || {};
    root.CryptoAlgos.caesar = factory(root.CryptoCore);
  }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* 保留大小写与非字母字符，而不是先 normalize 再加密。
     教学上这更值钱：'Hello, World!' → 'Khoor, Zruog!' 让人一眼看出
     "只有字母参与运算，标点和空格是旁观者"，而 'KHOORZRUOG' 把这件事藏起来了。
     代价是密文泄露了词长——这恰好是第三页"穷举"要讲的弱点之一。 */
  function shift(text, k) {
    k = C.mod(k, C.N);
    let out = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text.charAt(i);
      const c = text.charCodeAt(i);
      if (c >= 65 && c <= 90) out += String.fromCharCode(65 + C.mod(c - 65 + k, C.N));
      else if (c >= 97 && c <= 122) out += String.fromCharCode(97 + C.mod(c - 97 + k, C.N));
      else out += ch;
    }
    return out;
  }

  function encrypt(text, k) { return shift(String(text), k); }
  function decrypt(text, k) { return shift(String(text), -k); }

  /* 26 个候选，一个不少、按 k 升序——工具页把它们排成 26 行，
     "26 行就是全部可能"正是这一页要传达的东西，少一行都会破坏这个印象。 */
  function bruteForce(cipher) {
    const out = [];
    for (let k = 0; k < C.N; k++) out.push({ k: k, text: decrypt(cipher, k) });
    return out;
  }

  return { encrypt, decrypt, bruteForce };
});
```

- [ ] **Step 4: 跑测试确认通过**

```bash
node cryptography/core/algos/caesar.test.js
```
预期：PASS

- [ ] **Step 5: 写失败测试 `cryptanalysis.test.js`**

```javascript
'use strict';
const T = require('./_test.js');
const A = require('./cryptanalysis.js');
const caesar = require('./algos/caesar.js');

/* ---- 频率表本身 ---- */
T.eq(A.ENGLISH_FREQ.length, 26, 'ENGLISH_FREQ 有 26 项');
const sum = A.ENGLISH_FREQ.reduce(function (s, x) { return s + x; }, 0);
T.ok(Math.abs(sum - 1) < 1e-6, 'ENGLISH_FREQ 归一化到 1（实际 ' + sum + '）');
T.ok(A.ENGLISH_FREQ.every(function (x) { return x > 0; }), '每个字母频率都为正');
/* E 是英文里最常见的字母，T 次之——这条钉住表没有被抄错顺序。 */
const maxIdx = A.ENGLISH_FREQ.indexOf(Math.max.apply(null, A.ENGLISH_FREQ));
T.eq(maxIdx, 4, '最高频字母是 E（下标 4）');

/* ---- 计数与频率 ---- */
T.eq(A.letterCounts('aab')[0], 2, 'letterCounts 大小写不敏感：a 出现 2 次');
T.eq(A.letterCounts('aab')[1], 1, 'letterCounts：b 出现 1 次');
T.eq(A.letterCounts('!!!').reduce(function (s, x) { return s + x; }, 0), 0,
     'letterCounts 无字母时全 0');
T.eq(A.letterFrequency('aab')[0], 2 / 3, 'letterFrequency 归一化');
T.eq(A.letterFrequency('').reduce(function (s, x) { return s + x; }, 0), 0,
     'letterFrequency 空串全 0，不产生 NaN');

/* ---- χ² ----
   这两条**必须**用 T.ok + === 而不是 T.eq。T.eq 是 JSON.stringify 比对，
   而 JSON.stringify(Infinity)、JSON.stringify(NaN)、JSON.stringify(null)
   三者都是字符串 "null"——用 T.eq 写出来的 `eq(chiSquare(''), Infinity)`
   在实现返回 NaN 时**照样是绿的**，而返回 NaN 恰好会让 Array.sort 的比较
   全部为 false、把这个候选留在原地，第三页的高亮行就选错了。
   一条分不出 Infinity 与 NaN 的断言，守不住它唯一要守的那件事。 */
T.ok(A.chiSquare('') === Infinity, '无字母时 χ² 是 Infinity（永远排在最后）');
T.ok(A.chiSquare('!!! 123') === Infinity, '全非字母同上');
T.ok(!Number.isNaN(A.chiSquare('hello world')), '正常输入不产生 NaN');

/* 核心性质：一段真英文的 χ² 必须低于它自己的任何非零位移密文。
   这就是第三页"穷举"能自动挑出正确答案的全部依据；它若不成立，
   那一页的高亮行就是错的。 */
const PLAIN = 'The quick brown fox jumps over the lazy dog and then runs away ' +
              'into the deep forest where nobody ever finds him again';
const base = A.chiSquare(PLAIN);
for (let k = 1; k < 26; k++) {
  T.ok(base < A.chiSquare(caesar.encrypt(PLAIN, k)),
       '明文 χ²(' + base.toFixed(2) + ') 低于 k=' + k + ' 的密文');
}

/* 端到端：穷举 + χ² 排序必须把 k 选回来。 */
const CIPHER = caesar.encrypt(PLAIN, 7);
const best = A.bruteForceBest(caesar.bruteForce(CIPHER));
T.eq(best.k, 7, 'χ² 排序把 k=7 选了出来');
T.eq(best.text, PLAIN, '选出的候选就是原文');

T.report('cryptanalysis');
```

- [ ] **Step 6: 跑测试确认失败**

```bash
node cryptography/core/cryptanalysis.test.js
```
预期：FAIL — `Cannot find module './cryptanalysis.js'`

- [ ] **Step 7: 写 `cryptanalysis.js`**

`ENGLISH_FREQ` 用下列 26 个值（标准英文字母相对频率，已归一化到和为 1；
按 A..Z 顺序）。**必须逐字节使用这些值**，不要另找一套——测试里
"和为 1"与"最高频是 E"两条断言都钉着它：

```
A .08167  B .01492  C .02782  D .04253  E .12702  F .02228  G .02015
H .06094  I .06966  J .00153  K .00772  L .04025  M .02406  N .06749
O .07507  P .01929  Q .00095  R .05987  S .06327  T .09056  U .02758
V .00978  W .02360  X .00150  Y .01974  Z .00074
```

这 26 个值之和是 0.99999，不是 1。实现里**必须**在模块加载时除以实际总和
做一次归一化，否则 `|sum - 1| < 1e-6` 这条断言过不了。

```javascript
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./crypto-core.js'));
  else root.Cryptanalysis = factory(root.CryptoCore);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  const RAW = [.08167,.01492,.02782,.04253,.12702,.02228,.02015,.06094,.06966,
               .00153,.00772,.04025,.02406,.06749,.07507,.01929,.00095,.05987,
               .06327,.09056,.02758,.00978,.02360,.00150,.01974,.00074];
  /* 这张表来自公开的英文字母频率统计，26 个值之和是 0.99999 而不是 1。
     差的那 1e-5 对 χ² 排序毫无影响，但"频率表求和为 1"是一条读代码的人
     会默认成立、也确实值得成立的性质，所以在这里除一次总和把它做实。 */
  const TOTAL = RAW.reduce(function (s, x) { return s + x; }, 0);
  const ENGLISH_FREQ = RAW.map(function (x) { return x / TOTAL; });

  function letterCounts(text) {
    const counts = new Array(26).fill(0);
    const idx = C.letters(text);
    for (let i = 0; i < idx.length; i++) counts[idx[i]]++;
    return counts;
  }

  function letterFrequency(text) {
    const counts = letterCounts(text);
    const n = counts.reduce(function (s, x) { return s + x; }, 0);
    if (n === 0) return counts;            // 全 0，且不产生 NaN
    return counts.map(function (x) { return x / n; });
  }

  /* χ² = Σ (观测 − 期望)² / 期望。越小越像英文。
     没有字母时返回 Infinity 而不是 0——返回 0 会让一段空候选在排序里
     排到第一名，那正好是"最像英文"的位置，方向完全反了。 */
  function chiSquare(text) {
    const counts = letterCounts(text);
    const n = counts.reduce(function (s, x) { return s + x; }, 0);
    if (n === 0) return Infinity;
    let x2 = 0;
    for (let i = 0; i < 26; i++) {
      const expected = ENGLISH_FREQ[i] * n;
      const d = counts[i] - expected;
      x2 += d * d / expected;
    }
    return x2;
  }

  /* 给一组 { k, text } 候选打分并挑出最像英文的那个。
     返回原候选对象上补一个 score 字段的浅拷贝，不改调用方的数组。 */
  function bruteForceBest(candidates) {
    let best = null;
    for (let i = 0; i < candidates.length; i++) {
      const s = chiSquare(candidates[i].text);
      if (best === null || s < best.score) {
        best = { k: candidates[i].k, text: candidates[i].text, score: s };
      }
    }
    return best;
  }

  return { ENGLISH_FREQ, letterCounts, letterFrequency, chiSquare, bruteForceBest };
});
```

- [ ] **Step 8: 跑测试确认通过**

```bash
node cryptography/core/cryptanalysis.test.js && node cryptography/core/algos/caesar.test.js
```
预期：两个都 PASS

- [ ] **Step 9: 提交**

```bash
git add cryptography/core/algos/caesar.js cryptography/core/algos/caesar.test.js \
        cryptography/core/cryptanalysis.js cryptography/core/cryptanalysis.test.js
git commit -m "feat(crypto): Caesar 算法与 χ² 密码分析（算法与打分分居两个模块）"
```

---

## Task 3: 引擎 fork + 2D 图元层 + 动画时间轴

**Files:**
- Create: `cryptography/core/viz-engine.js`（源：`chess/core/viz-engine.js`）
- Create: `cryptography/core/interact.js`（源：`chess/core/interact.js`）
- Create: `cryptography/core/animation.js`
- Create: `cryptography/core/animation.test.js`

**Interfaces:**
- Consumes: 无
- Produces:
  - `root.VizEngine`：保留 chess 版全部导出
    （`makeCam, proj, unproject, viewInfo, withContext, strokePoly, line3, glowDot,
    solidDot, label3, arrowAt, drawAxes, drawGridXY, clamp, fmt, fmtS, t, init,
    bindOrbit, syncPresetHighlight, cam, state`），**新增**：
    ```
    mathFont(px, weight)                  -> string   `--font-math` 的 Canvas 字体串，斜体
    uiFont(px, weight)                    -> string   `--font-cn` 的 Canvas 字体串
    alphabetWheel(cx, cy, r, opts)        字母环
    cellGrid(x, y, cols, rows, cell, opts) 字母/矩阵网格
    bitBlock(x, y, bits, opts)            比特块
    barChart(x, y, w, h, values, opts)    频率柱
    flowArrow(ax, ay, bx, by, opts)       流程箭头
    chip(x, y, w, h, text, opts)          文本方块
    ```
  - `root.CryptoAnim.createTimeline(opts)`（见 Step 5）

- [ ] **Step 1: 复制两个引擎文件并改存储键**

```bash
cp chess/core/viz-engine.js cryptography/core/viz-engine.js
cp chess/core/interact.js   cryptography/core/interact.js
```

然后在 `cryptography/core/viz-engine.js` 里把
```javascript
const LANG_KEY = 'chess-lang';
```
改成
```javascript
/* 子项目自己的存储键（规范 §12）。绝不能沿用 chess-lang：两个子项目的
   语言状态是各自独立的，共享一个键会让在 chess 里切成中文的动作把
   cryptography 也一起切了，反之亦然。 */
const LANG_KEY = 'cryptography-lang';
```

在两个文件顶部各加一行来源说明：
```javascript
/* fork 自 chess/core/viz-engine.js（2026-08-09）。子项目之间不共享代码文件——
   这是"整个 cryptography/ 目录可以单独搬走"的前提，见
   docs/superpowers/specs/2026-08-09-cryptography-subproject-design.md §6.2。
   往上游同步改动时要手工搬，没有自动机制，这是这个架构自觉付的代价。 */
```

- [ ] **Step 2: 确认复制来的引擎语法无误、且没有残留的 chess 字样**

```bash
node --check cryptography/core/viz-engine.js && node --check cryptography/core/interact.js
```
预期：无输出（`node --check` 通过时静默）

```bash
grep -n "chess" cryptography/core/viz-engine.js cryptography/core/interact.js
```
预期：只剩上一步加的那行来源说明里的 `chess/core/viz-engine.js`。
若还有 `chess-lang` / `chess-nav` 出现，说明 Step 1 漏改，回去补。

- [ ] **Step 3: 在 `viz-engine.js` 的 `return {...}` 之前追加 2D 图元层**

所有图元都是**屏幕坐标**，与相机无关，直接用引擎闭包里已有的 `ctx`。
`opts` 一律可选，缺省值写在函数里。

```javascript
  /* ================= screen-space 2D 图元层 =================
     密码学工具的大多数画面是 2D：字母轮、字母网格、矩阵、比特块、频率柱。
     它们与上面那套相机/投影无关——直接在屏幕坐标里画。3D 那半边留着不是
     摆设：Bloch 球、Hill 矩阵变换、以及 Caesar 自己把模 26 抬成螺旋的顿悟
     视角都要用它。两套并存，各画各的。

     颜色一律由调用方显式传入，这一层不内嵌调色板——"一条曲线一种颜色、
     在六处复用"那条原则要求颜色的唯一真相在工具页的 SCENES 里。 */

  const FONT_MATH_STACK = 'Georgia,"Times New Roman","Songti SC","Noto Serif SC",serif';

  /* 数学符号一律 serif italic（五条原则第 4 条），Canvas 与 HTML 两侧同款。
     给它一个函数而不是让每处自己拼字符串：拼错一次就会有一个字母突然变
     无衬线，而那种差异在截图里几乎看不出来、在页面上却很刺眼。 */
  function mathFont(px, weight) { return (weight ? weight + ' ' : '') + 'italic ' + px + 'px ' + FONT_MATH_STACK; }
  function uiFont(px, weight) { return (weight ? weight + ' ' : '') + px + 'px ' + FONT_CN; }

  /* 字母环。letters 默认 A–Z；rotation 是整环旋转的弧度（Caesar 的 k 就是
     k/26 * 2π）；highlight 传下标时那一个字母用 hiColor 并加一圈辉光。 */
  function alphabetWheel(cx, cy, r, o) {
    o = o || {};
    const letters = o.letters || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const n = letters.length;
    const rot = o.rotation || 0;
    const color = o.color || '#9fb0c8';
    const size = o.fontSize || 13;

    if (o.ring !== false) {
      ctx.save();
      ctx.strokeStyle = o.ringColor || 'rgba(148,163,184,.22)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = mathFont(size, o.weight);
    for (let i = 0; i < n; i++) {
      /* -π/2 让下标 0 落在正上方（12 点钟），这样 k 的旋转在视觉上
         就是钟面的旋转，跟使用者转滑杆的方向一致。 */
      const a = -Math.PI / 2 + rot + i * TAU / n;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      const on = (o.highlight === i);
      if (on && o.hiGlow !== false) {
        const g = ctx.createRadialGradient(px, py, 0, px, py, size * 1.6);
        g.addColorStop(0, (o.hiColor || color) + 'aa');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(px, py, size * 1.6, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = on ? (o.hiColor || color) : color;
      ctx.fillText(letters.charAt(i), px, py);
      if (o.ticks) {
        ctx.save();
        ctx.strokeStyle = o.ringColor || 'rgba(148,163,184,.22)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * (r - size * 0.75), cy + Math.sin(a) * (r - size * 0.75));
        ctx.lineTo(cx + Math.cos(a) * (r - size * 1.25), cy + Math.sin(a) * (r - size * 1.25));
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  /* 网格。text(col,row) 与 fill(col,row) 都是回调，返回 null / '' 表示这一格
     不画内容 / 不填色。x,y 是左上角，cell 是每格边长（px）。 */
  function cellGrid(x, y, cols, rows, cell, o) {
    o = o || {};
    const color = o.color || '#e2e8f0';
    const stroke = o.stroke || 'rgba(148,163,184,.20)';
    const size = o.fontSize || Math.round(cell * 0.5);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = o.mono ? uiFont(size) : mathFont(size, o.weight);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = x + c * cell, py = y + r * cell;
        const f = o.fill ? o.fill(c, r) : null;
        if (f) { ctx.fillStyle = f; ctx.fillRect(px, py, cell, cell); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.strokeRect(px + .5, py + .5, cell - 1, cell - 1); }
        const s = o.text ? o.text(c, r) : null;
        if (s != null && s !== '') {
          ctx.fillStyle = (o.textColor && o.textColor(c, r)) || color;
          ctx.fillText(String(s), px + cell / 2, py + cell / 2);
        }
      }
    }
    ctx.restore();
  }

  /* 比特块：bits 是 0/1 数组，1 用 on 色实心、0 用 off 色描边。 */
  function bitBlock(x, y, bits, o) {
    o = o || {};
    const cell = o.cell || 14, gap = o.gap == null ? 2 : o.gap;
    const on = o.on || '#2dd4ea', off = o.off || 'rgba(148,163,184,.28)';
    ctx.save();
    for (let i = 0; i < bits.length; i++) {
      const px = x + i * (cell + gap);
      if (bits[i]) { ctx.fillStyle = on; ctx.fillRect(px, y, cell, cell); }
      else { ctx.strokeStyle = off; ctx.lineWidth = 1; ctx.strokeRect(px + .5, y + .5, cell - 1, cell - 1); }
    }
    ctx.restore();
  }

  /* 频率柱。values 按传入顺序画；内部按 max 归一化（传 o.max 可锁定量程，
     这在动画里很重要——不锁的话每帧最大值一变，所有柱子都会跳）。 */
  function barChart(x, y, w, h, values, o) {
    o = o || {};
    const n = values.length;
    if (!n) return;
    const max = o.max != null ? o.max : Math.max.apply(null, values) || 1;
    const gap = o.gap == null ? 2 : o.gap;
    const bw = (w - gap * (n - 1)) / n;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const bh = Math.max(0, Math.min(1, values[i] / max)) * h;
      ctx.fillStyle = (o.colorAt && o.colorAt(i)) || o.color || '#2dd4ea';
      ctx.fillRect(x + i * (bw + gap), y + h - bh, bw, bh);
    }
    if (o.labels) {
      ctx.fillStyle = o.labelColor || 'rgba(159,176,200,.75)';
      ctx.font = mathFont(o.labelSize || 10);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let i = 0; i < n; i++) {
        ctx.fillText(o.labels[i], x + i * (bw + gap) + bw / 2, y + h + 3);
      }
    }
    ctx.restore();
  }

  function flowArrow(ax, ay, bx, by, o) {
    o = o || {};
    ctx.save();
    ctx.strokeStyle = o.color || 'rgba(159,176,200,.6)';
    ctx.lineWidth = o.width || 1.4;
    if (o.dash) ctx.setLineDash(o.dash);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.setLineDash([]);
    if (o.head !== false) {
      const a = Math.atan2(by - ay, bx - ax), L = o.headLen || 8;
      ctx.fillStyle = o.color || 'rgba(159,176,200,.6)';
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - Math.cos(a - 0.4) * L, by - Math.sin(a - 0.4) * L);
      ctx.lineTo(bx - Math.cos(a + 0.4) * L, by - Math.sin(a + 0.4) * L);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function chip(x, y, w, h, text, o) {
    o = o || {};
    const rad = o.radius == null ? 5 : o.radius;
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, rad);
    else ctx.rect(x, y, w, h);
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
    if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.width || 1; ctx.stroke(); }
    if (text != null && text !== '') {
      ctx.fillStyle = o.color || '#e2e8f0';
      ctx.font = o.mono ? uiFont(o.fontSize || 12) : mathFont(o.fontSize || 12, o.weight);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(text), x + w / 2, y + h / 2);
    }
    ctx.restore();
  }
```

然后把这些名字加进文件末尾的 `return {...}`：

```javascript
    mathFont, uiFont,
    alphabetWheel, cellGrid, bitBlock, barChart, flowArrow, chip,
```

- [ ] **Step 4: 语法确认**

```bash
node --check cryptography/core/viz-engine.js
```
预期：无输出

- [ ] **Step 5: 写失败测试 `animation.test.js`**

```javascript
'use strict';
const T = require('./_test.js');
const A = require('./animation.js');

/* 每步 1 秒、共 4 步（下标 0..3）。 */
function mk(extra) {
  const seen = [];
  const tl = A.createTimeline(Object.assign({
    steps: 4, stepDuration: 1, onStep: function (i, prev) { seen.push([prev, i]); }
  }, extra || {}));
  return { tl: tl, seen: seen };
}

/* ---- 初始状态 ---- */
let m = mk();
T.eq(m.tl.index, 0, '初始 index 0');
T.eq(m.tl.progress, 0, '初始 progress 0');
T.eq(m.tl.playing, false, '初始不播放');
T.eq(m.seen, [], '构造时不触发 onStep');

/* ---- 暂停时 tick 不动 ---- */
m.tl.tick(0.5);
T.eq(m.tl.index, 0, '暂停时 tick 不推进 index');
T.eq(m.tl.progress, 0, '暂停时 tick 不推进 progress');

/* ---- 播放 ---- */
m.tl.play();
T.eq(m.tl.playing, true, 'play() 之后 playing 为 true');
m.tl.tick(0.5);
T.eq(m.tl.index, 0, '半步还在第 0 步');
T.eq(m.tl.progress, 0.5, 'progress 到 0.5');
m.tl.tick(0.5);
T.eq(m.tl.index, 1, '满一步进到第 1 步');
T.eq(m.tl.progress, 0, '跨步后 progress 归零');
T.eq(m.seen, [[0, 1]], 'onStep 收到 (prev=0, i=1)');

/* ---- 一次 tick 跨多步也要逐步回调，不能只报最后一步 ---- */
m = mk(); m.tl.play(); m.tl.tick(2.5);
T.eq(m.tl.index, 2, '2.5 秒推进到第 2 步');
T.eq(m.tl.progress, 0.5, '余下 0.5 落在 progress 上');
T.eq(m.seen, [[0, 1], [1, 2]], '跨两步要有两次 onStep');

/* ---- 到末尾停住（默认不循环）---- */
m = mk(); m.tl.play(); m.tl.tick(99);
T.eq(m.tl.index, 3, '停在最后一步 index 3');
T.eq(m.tl.progress, 0, '末尾 progress 归零');
T.eq(m.tl.playing, false, '跑到末尾自动停止播放');
T.eq(m.seen, [[0, 1], [1, 2], [2, 3]], '末尾之前每一步都回调过');

/* ---- 循环模式 ---- */
m = mk({ loop: true }); m.tl.play(); m.tl.tick(4);
T.eq(m.tl.index, 0, 'loop 模式绕回第 0 步');
T.eq(m.tl.playing, true, 'loop 模式不自动停');

/* ---- 单步与回退 ---- */
m = mk();
m.tl.step(1);
T.eq(m.tl.index, 1, 'step(+1)');
T.eq(m.seen, [[0, 1]], 'step 也触发 onStep');
m.tl.step(-1);
T.eq(m.tl.index, 0, 'step(-1) 回退');
m.tl.step(-1);
T.eq(m.tl.index, 0, '第 0 步再回退仍是 0（非 loop 时夹住）');
m.tl.seek(3); m.tl.step(1);
T.eq(m.tl.index, 3, '末步再前进仍是 3');

/* ---- seek / reset ---- */
m = mk(); m.tl.play(); m.tl.tick(0.7); m.tl.seek(2);
T.eq(m.tl.index, 2, 'seek 到 2');
T.eq(m.tl.progress, 0, 'seek 清掉 progress');
m.tl.reset();
T.eq(m.tl.index, 0, 'reset 回到 0');
T.eq(m.tl.playing, false, 'reset 停止播放');

/* ---- 慢放：rate 缩放的是时间，不是步长 ---- */
m = mk(); m.tl.play(); m.tl.setRate(0.5); m.tl.tick(1);
T.eq(m.tl.index, 0, 'rate=0.5 时 1 秒只走半步');
T.eq(m.tl.progress, 0.5, 'progress 0.5');

/* ---- 参数校验 ---- */
T.throws(function () { A.createTimeline({ steps: 0, stepDuration: 1 }); },
         'steps 必须为正', /steps/);
T.throws(function () { A.createTimeline({ steps: 3, stepDuration: 0 }); },
         'stepDuration 必须为正', /stepDuration/);

T.report('animation');
```

- [ ] **Step 6: 跑测试确认失败**

```bash
node cryptography/core/animation.test.js
```
预期：FAIL — `Cannot find module './animation.js'`

- [ ] **Step 7: 写 `animation.js`**

```javascript
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CryptoAnim = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* 统一的离散时间轴。密码学工具几乎都是"一轮一轮"的：Enigma 的每次按键、
     DES/AES 的每一轮、hash 的每个 block、BB84 的每个光子。它们共享的是
     "第几步 + 步内进度"这一对状态，而不是一条连续曲线——所以时间轴的
     基本单位是 step，不是秒。

     progress 是**步内**归一化进度（0..1），给插值用：第 i 步到第 i+1 步之间
     的中间画面靠它算。跨步时归零而不是累加，工具页因此永远不必自己取模。 */
  function createTimeline(opts) {
    opts = opts || {};
    const steps = opts.steps;
    const stepDuration = opts.stepDuration;
    if (!(steps > 0)) throw new Error('createTimeline: steps 必须是正数，收到 ' + steps);
    if (!(stepDuration > 0)) throw new Error('createTimeline: stepDuration 必须是正数，收到 ' + stepDuration);
    const loop = !!opts.loop;
    const onStep = typeof opts.onStep === 'function' ? opts.onStep : null;

    const tl = {
      index: 0,
      progress: 0,
      playing: false,
      rate: opts.rate > 0 ? opts.rate : 1,
      steps: steps
    };

    function fire(prev, next) {
      if (prev === next) return;
      tl.index = next;
      if (onStep) onStep(next, prev);
    }

    tl.play = function () { tl.playing = true; return tl; };
    tl.pause = function () { tl.playing = false; return tl; };
    tl.toggle = function () { tl.playing = !tl.playing; return tl; };
    tl.setRate = function (r) { if (r > 0) tl.rate = r; return tl; };

    tl.seek = function (i) {
      const next = loop ? ((i % steps) + steps) % steps
                        : Math.max(0, Math.min(steps - 1, i));
      const prev = tl.index;
      tl.progress = 0;
      fire(prev, next);
      return tl;
    };

    tl.step = function (d) { return tl.seek(tl.index + (d || 0)); };

    tl.reset = function () {
      tl.playing = false;
      tl.progress = 0;
      const prev = tl.index;
      tl.index = 0;
      if (onStep && prev !== 0) onStep(0, prev);
      return tl;
    };

    /* 一次 tick 可能跨过好几步（后台标签页回来、或慢机器掉帧）。
       必须**逐步**触发 onStep 而不是直接跳到最后一步：工具页的 onStep 里
       往往在累积状态（比如把这一轮的输出接到下一轮的输入上），跳步等于
       算错。这也是把"步"而不是"秒"当基本单位换来的好处——补步是精确的。 */
    tl.tick = function (dt) {
      if (!tl.playing || !(dt > 0)) return tl;
      let p = tl.progress + dt * tl.rate / stepDuration;
      while (p >= 1) {
        p -= 1;
        if (!loop && tl.index >= steps - 1) {
          tl.progress = 0;
          tl.playing = false;
          return tl;
        }
        const prev = tl.index;
        const next = loop ? (tl.index + 1) % steps : tl.index + 1;
        fire(prev, next);
      }
      tl.progress = p;
      return tl;
    };

    return tl;
  }

  return { createTimeline };
});
```

- [ ] **Step 8: 跑测试确认通过**

```bash
node cryptography/core/animation.test.js
```
预期：PASS

- [ ] **Step 9: 提交**

```bash
git add cryptography/core/viz-engine.js cryptography/core/interact.js \
        cryptography/core/animation.js cryptography/core/animation.test.js
git commit -m "feat(crypto): 引擎 fork（保留 3D）+ screen-space 2D 图元层 + 离散时间轴"
```

---

## Task 4: examples 教学数据层

**Files:**
- Create: `cryptography/examples/examples-classical.js`
- Create: `cryptography/examples/examples.js`
- Create: `cryptography/examples/examples.test.js`

**Interfaces:**
- Consumes: 无（纯数据）
- Produces:
  - `root.CryptoExamplesParts = root.CryptoExamplesParts || {}`；
    `examples-classical.js` 往上面挂 `.classical`；
    `examples.js` 读 `root.CryptoExamplesParts` 汇总成 `root.CryptoExamples`。
    **加载顺序：分组文件在前，汇总器在后**（`inline_core.py` 的 `EXAMPLES_PARTS` 写死这个顺序）。
  - `CryptoExamples.classical.plaintexts` -> `[{ id, text: {zh,en}, note: {zh,en} }]`
  - `CryptoExamples.classical.caesar` -> `[{ id, k, cipher, label: {zh,en} }]`

**规范 §15 的边界**：`examples/` 只放 CryptoViz 自己的教学数据。
**不要**把 Cipher Challenge 之类网站的比赛正文整段抄进来。

- [ ] **Step 1: 写 `examples-classical.js`**

```javascript
(function (root, factory) {
  const data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  else {
    root.CryptoExamplesParts = root.CryptoExamplesParts || {};
    root.CryptoExamplesParts.classical = data;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* 教学明文。挑选标准有三条，缺一不可：
     ① 长度够让字母频率有统计意义（≥ 60 个字母），否则第三页的 χ² 排序
        会因为样本太小而选错，使用者看到的就是一个"自动破解失败"的演示；
     ② 都是无版权顾虑的自造句或已进入公有领域的历史句子；
     ③ 至少有一条包含全部 26 个字母（pangram），好让字母轮上没有空位。 */
  const plaintexts = [
    {
      id: 'pangram',
      text: {
        en: 'The quick brown fox jumps over the lazy dog and then runs away into the deep forest where nobody ever finds him again',
        zh: 'The quick brown fox jumps over the lazy dog and then runs away into the deep forest where nobody ever finds him again'
      },
      note: {
        en: 'A pangram, extended so letter statistics mean something.',
        zh: '全字母句，特意加长到字母统计有意义的长度。'
      }
    },
    {
      id: 'attack',
      text: { en: 'ATTACK AT DAWN', zh: 'ATTACK AT DAWN' },
      note: {
        en: 'Short on purpose — watch chi-square pick the wrong shift here.',
        zh: '故意很短——正好看 χ² 在这里选错，样本太小时统计不成立。'
      }
    },
    {
      id: 'caesar-quote',
      text: {
        en: 'I came I saw I conquered and the whole of Gaul is now divided into three parts each of them quite unhappy about it',
        zh: 'I came I saw I conquered and the whole of Gaul is now divided into three parts each of them quite unhappy about it'
      },
      note: {
        en: 'Caesar would have used a shift of three.',
        zh: '凯撒本人用的位移是 3。'
      }
    }
  ];

  /* 预置密文：id 指向上面的明文，k 是用来加密它的位移。
     cipher 字段**故意留空**由工具页现算——把密文抄死在数据里，
     一旦 caesar.js 的行为改了（比如某天不再保留标点），
     这里就会静静地对不上，而没有任何东西会报警。 */
  const caesar = [
    { id: 'attack', k: 3, label: { en: 'The textbook shift', zh: '教科书上的那个位移' } },
    { id: 'pangram', k: 13, label: { en: 'ROT13 — its own inverse', zh: 'ROT13 —— 自己是自己的逆' } },
    { id: 'caesar-quote', k: 7, label: { en: 'Nothing special about 7', zh: '7 没有任何特别之处' } }
  ];

  return { plaintexts, caesar };
});
```

- [ ] **Step 2: 写 `examples.js`（汇总器）**

```javascript
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory({ classical: require('./examples-classical.js') });
  } else {
    root.CryptoExamples = factory(root.CryptoExamplesParts || {});
  }
})(typeof self !== 'undefined' ? self : this, function (parts) {
  'use strict';

  /* 汇总器。浏览器里读的是 root.CryptoExamplesParts——那份对象由每个分组
     文件自己挂上去，所以**分组文件必须先于本文件加载**。
     inline_core.py 的 EXAMPLES_PARTS 显式写死了这个顺序，不靠文件名排序
     碰巧成立（chess 的 games.js 在同一处踩过这个点）。 */
  function get(name) {
    const d = parts[name];
    if (!d) throw new Error('CryptoExamples: 分组 "' + name + '" 未加载——检查内联顺序');
    return d;
  }

  /* 按 id 取一条明文，取不到当场抛：一个拼错的 id 应该立刻炸，
     而不是让工具页拿着 undefined 往下走、最后画出一片空白。 */
  function plaintext(id) {
    const list = get('classical').plaintexts;
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    throw new Error('CryptoExamples: 找不到明文 id "' + id + '"');
  }

  return { classical: get('classical'), plaintext };
});
```

- [ ] **Step 3: 写测试 `examples.test.js`**

注意 `_test.js` 在 `core/` 下、不在 `examples/` 下，所以 require 路径要跨一层目录。
（这是 Task 8 的出站引用门唯一放行 `*.test.js` 的原因——测试文件永远不进 html。）

```javascript
'use strict';
const T = require('../core/_test.js');
const E = require('./examples.js');
const C = require('../core/crypto-core.js');

const P = E.classical.plaintexts;
T.ok(P.length >= 3, '至少 3 条教学明文');

const ids = {};
P.forEach(function (p) {
  T.ok(!ids[p.id], '明文 id 不重复：' + p.id);
  ids[p.id] = 1;
  T.ok(p.text && p.text.en && p.text.zh, p.id + ' 有双语 text');
  T.ok(p.note && p.note.en && p.note.zh, p.id + ' 有双语 note');
});

/* pangram 必须真的是全字母句——它的用途就是"字母轮上没有空位"，
   这条性质如果不成立，那一页会缺几个字母而没人发现。 */
const pan = E.plaintext('pangram');
T.eq(new Set(C.letters(pan.text.en)).size, 26, 'pangram 覆盖全部 26 个字母');
T.ok(C.letters(pan.text.en).length >= 60, 'pangram 长度够做频率统计');

/* caesar 预置项引用的 id 必须存在，k 必须在 [0,26)。 */
E.classical.caesar.forEach(function (c) {
  T.ok(!!E.plaintext(c.id), 'caesar 预置项引用了存在的明文：' + c.id);
  T.ok(c.k >= 0 && c.k < 26, 'k 落在 [0,26)：' + c.id);
  T.ok(c.label && c.label.en && c.label.zh, c.id + ' 有双语 label');
  T.ok(c.cipher === undefined, c.id + ' 不把密文抄死在数据里');
});

T.throws(function () { E.plaintext('no-such-id'); },
         '取不存在的明文 id 要抛', /找不到明文/);

T.report('examples');
```

- [ ] **Step 4: 跑测试确认通过**

```bash
node cryptography/examples/examples.test.js
```
预期：PASS

- [ ] **Step 5: 提交**

```bash
git add cryptography/examples/examples-classical.js cryptography/examples/examples.js \
        cryptography/examples/examples.test.js
git commit -m "feat(crypto): examples 教学数据层（明文不抄死密文，由工具现算）"
```

---

## Task 5: `inline_core.py` 与工具骨架

**Files:**
- Create: `cryptography/scripts/inline_core.py`
- Create: `cryptography/tools/_skeleton.html`

**Interfaces:**
- Consumes: `core/*.js`、`core/algos/*.js`、`examples/*.js`（Task 1–4）
- Produces:
  - CLI：`python3 cryptography/scripts/inline_core.py [--check] [--print-changed]`
  - 可被 `check.py` `import inline_core` 并调用 `main(check_only=True)`
  - 标记语法：
    ```
    /* >>> GENERATED:VIZ-ENGINE */   … /* <<< GENERATED:VIZ-ENGINE */
    /* >>> GENERATED:CRYPTO-CORE */  … /* <<< GENERATED:CRYPTO-CORE */
    /* >>> GENERATED:INTERACT */     … /* <<< GENERATED:INTERACT */
    /* >>> GENERATED:ANIMATION */    … /* <<< GENERATED:ANIMATION */
    /* >>> GENERATED:CRYPTANALYSIS */… /* <<< GENERATED:CRYPTANALYSIS */
    /* >>> GENERATED:EXAMPLES */     … /* <<< GENERATED:EXAMPLES */
    /* >>> GENERATED:ALGOS caesar.js */ … /* <<< GENERATED:ALGOS */
    ```

**与 chess 的一处刻意分歧——ALGOS 内联成代码，不是字符串。**
chess 把 `algos/*.js` 当**字符串**内联，因为它的解释器要执行、编辑器要显示
那份源码，"读到的字符串"必须逐字节等于"会被跑的源码"。CryptoViz 没有解释器：
Caesar 页面直接调 `CryptoAlgos.caesar.encrypt(...)`。所以这里内联成**活代码**，
`js_string_literal()` 那一整套转义（`</script`、`<!--`、U+2028）连同它守护的
风险一起不存在。**将来若真的加了"显示算法源码"的工具，必须回到字符串方案，
并把 chess 的那三条转义规则一起搬过来**——那份注释里记着实测过的事故。

- [ ] **Step 1: 写 `inline_core.py`**

```python
#!/usr/bin/env python3
"""把 cryptography/core/*.js 与 examples/*.js 注入 tools/*.html 的 GENERATED 区间。

core/ 与 examples/ 是唯一编辑源；每个 html 运行时完全自足，file:// 双击可用。
纪律照抄 chess/scripts/inline_core.py：生成区间禁止手改。

与 chess 的一处分歧：ALGOS 在这里内联成**代码**而不是字符串。chess 那边要把
算法源码交给解释器执行、交给编辑器显示，所以必须保住字节级保真，为此有一整套
`</script` / `<!--` / U+2028 转义。CryptoViz 的工具直接调用算法函数，没有那个
需求，也就不引入那套转义。若将来新增"显示算法源码"的工具，要回到字符串方案，
并连同 chess 那三条转义规则一起搬过来——不要只搬一半。
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ALGOS_DIR = ROOT / 'core' / 'algos'
EXAMPLES_DIR = ROOT / 'examples'

# 分组文件先注入、汇总器最后——examples.js 在浏览器里读的是
# root.CryptoExamplesParts，那份对象由每个分组文件自己挂上去。靠文件名排序
# 碰巧成立不算依据，这里显式写死顺序（chess 的 GAMES_PARTS 同理）。
EXAMPLES_PARTS = ['examples-classical.js', 'examples.js']

SOURCES = {
    'VIZ-ENGINE': ROOT / 'core' / 'viz-engine.js',
    'CRYPTO-CORE': ROOT / 'core' / 'crypto-core.js',
    'INTERACT': ROOT / 'core' / 'interact.js',
    'ANIMATION': ROOT / 'core' / 'animation.js',
    'CRYPTANALYSIS': ROOT / 'core' / 'cryptanalysis.js',
}

# 只有部分工具有这些标记区；其余 html 缺它们是正常的，不该 WARN。
# CRYPTANALYSIS 只有带破解页的工具要；EXAMPLES / ALGOS 逐页按需。
# VIZ-ENGINE 与 CRYPTO-CORE 不在此列——每个工具都必须有这两块。
OPTIONAL_TAGS = {'INTERACT', 'ANIMATION', 'CRYPTANALYSIS', 'EXAMPLES', 'ALGOS'}


def block(tag: str, body: str) -> str:
    return (f'/* >>> GENERATED:{tag} */\n'
            f'{body.rstrip()}\n'
            f'/* <<< GENERATED:{tag} */')


def pattern(tag: str) -> re.Pattern:
    return re.compile(
        r'/\* >>> GENERATED:' + re.escape(tag) + r' \*/.*?'
        r'/\* <<< GENERATED:' + re.escape(tag) + r' \*/',
        re.DOTALL)


# ALGOS 的开始标记要携带一份逐页清单：`GENERATED:ALGOS caesar.js`。
# group(1) 捕获 "ALGOS" 和收尾 " */" 之间的原文，两处都要用：校验时 strip()
# 取干净清单，重建标记时用**原文、不 strip()**——这样清单前后没有多余空格时
# 重建结果与原文逐字节相同，不会每次跑脚本都因空白抖动而显得"内容变了"。
#
# ⚠ 区间体不能要求非空。两条标记贴在一起的空区间是"新建页面时先写标记、
# 内容交给脚本填"的唯一来源，也就是每一页的第一次。chess 那边这条正则曾要求
# 非空，后果不是报错而是三样都没发生：没内联、missing 里也没有它（ALGOS 是
# 可选标记）、门也扫不到——新页带着空 ALGOS 块全绿上线，在浏览器里当场死。
# 收尾 `\n` 收进区间体自己，空区间照样匹配、照样被填。
ALGOS_MARK_RE = re.compile(
    r'/\* >>> GENERATED:ALGOS(.*?) \*/\n(.*?)/\* <<< GENERATED:ALGOS \*/',
    re.DOTALL)


def render(text: str) -> tuple[str, list[str]]:
    """返回注入后的文本与本文件缺失的必需标记列表。"""
    missing = []
    for tag, src in SOURCES.items():
        pat = pattern(tag)
        if not pat.search(text):
            if tag not in OPTIONAL_TAGS:
                missing.append(tag)
            continue
        body = src.read_text(encoding='utf-8')
        text = pat.sub(lambda _m: block(tag, body), text, count=1)

    pat = pattern('EXAMPLES')
    if pat.search(text):
        parts = []
        for name in EXAMPLES_PARTS:
            p = EXAMPLES_DIR / name
            if not p.exists():
                raise SystemExit(f'ERROR: 缺少教学数据源 {p.relative_to(ROOT.parent)}')
            parts.append(p.read_text(encoding='utf-8').rstrip())
        text = pat.sub(lambda _m: block('EXAMPLES', '\n'.join(parts)), text, count=1)

    m = ALGOS_MARK_RE.search(text)
    if m:
        # 清单从标记行本身来，不扫目录——一页只内联它真正会调用的算法。
        # 扫目录的做法会让每个页面都带上十几份它永远不会跑的算法：体积白涨，
        # 读到的人也会疑惑"这些是干嘛的"。
        raw_list = m.group(1).strip()
        if not raw_list:
            raise SystemExit(
                'ERROR: GENERATED:ALGOS 标记缺少清单——语法是逐页显式列出文件名'
                '（例如 GENERATED:ALGOS caesar.js），不会自动内联整个 '
                'core/algos/ 目录，请在标记行里补上清单')
        names = [n.strip() for n in raw_list.split(',')]
        if any(not n for n in names):
            # 多余的逗号 split 出来是空字符串。清单本身已经写错了，当场报错，
            # 不要悄悄丢弃这个空位。
            raise SystemExit(
                f'ERROR: GENERATED:ALGOS 清单里有空文件名（多余的逗号？）：{raw_list!r}')
        bodies = []
        for name in names:
            src = ALGOS_DIR / name
            if not src.exists():
                # 拼错一个字符就该在这里炸掉，而不是让页面带着一个悄悄少一份的
                # CryptoAlgos 上线，等运行到 CryptoAlgos.caesar 才发现是 undefined。
                raise SystemExit(
                    f'ERROR: GENERATED:ALGOS 清单里的 {name!r} 在 '
                    f'{ALGOS_DIR.relative_to(ROOT.parent)}/ 下不存在')
            bodies.append(src.read_text(encoding='utf-8').rstrip())
        # 开始标记原样重建（用未 strip 的 group(1)），收尾标记是固定字符串。
        replacement = (f'/* >>> GENERATED:ALGOS{m.group(1)} */\n'
                       + '\n'.join(bodies) + '\n'
                       + '/* <<< GENERATED:ALGOS */')
        text = ALGOS_MARK_RE.sub(lambda _m: replacement, text, count=1)

    return text, missing


def main(check_only: bool = False, print_changed: bool = False) -> int:
    for src in SOURCES.values():
        if not src.exists():
            print(f'ERROR: 缺少编辑源 {src.relative_to(ROOT.parent)}', file=sys.stderr)
            return 1

    tools = sorted((ROOT / 'tools').glob('*.html'))
    if not tools:
        if not print_changed:
            print('WARN: cryptography/tools/ 下没有 html，本次无事可做', file=sys.stderr)
        return 0

    # WARN 一律走 stderr：--print-changed 模式下 stdout 是给 pre-commit 钩子
    # 机读的路径列表，混进一行诊断文字就会喂给 `git add` 一个不存在的路径。
    stale = []
    for path in tools:
        original = path.read_text(encoding='utf-8')
        updated, missing = render(original)
        if missing:
            print(f'WARN: {path.name} 缺少标记区间：{", ".join(missing)}', file=sys.stderr)
        if updated == original:
            continue
        stale.append(path)
        if not check_only:
            path.write_text(updated, encoding='utf-8')

    if check_only and stale:
        print('ERROR: 以下文件的内联副本与编辑源不一致：', file=sys.stderr)
        for path in stale:
            print(f'  - {path.name}', file=sys.stderr)
        print('修复：python3 cryptography/scripts/inline_core.py', file=sys.stderr)
        return 1

    if print_changed:
        for path in stale:
            print(path)
        return 0

    if stale:
        print(f'已更新 {len(stale)} 个文件：{", ".join(p.name for p in stale)}')
    else:
        print(f'{len(tools)} 个文件已是最新')
    return 0


if __name__ == '__main__':
    sys.exit(main(check_only='--check' in sys.argv,
                  print_changed='--print-changed' in sys.argv))
```

- [ ] **Step 2: 写 `tools/_skeleton.html`**

骨架必须内置（规范 §20）：CryptoViz 视觉令牌、i18n、canvas、页签系统、
动画时钟与 Play/Pause/Step/Back/Reset、响应式布局、独立语言开关、生成区间标记。

结构要求：

1. `<head>`：`<meta name="tool-version" content="1.0.0">`、
   `<meta name="tool-engine" content="crypto-1.0.0">`、
   `<title>`、changelog 注释块、Global Constraints 第 6/7/8 条的全部 CSS 变量。
2. **第一个 `<script>` 块**只含生成区间，按此顺序（依赖在前）：
   ```
   /* >>> GENERATED:CRYPTO-CORE */  /* <<< GENERATED:CRYPTO-CORE */
   /* >>> GENERATED:CRYPTANALYSIS */ /* <<< GENERATED:CRYPTANALYSIS */
   /* >>> GENERATED:ALGOS  */       /* <<< GENERATED:ALGOS */
   /* >>> GENERATED:EXAMPLES */     /* <<< GENERATED:EXAMPLES */
   /* >>> GENERATED:VIZ-ENGINE */   /* <<< GENERATED:VIZ-ENGINE */
   /* >>> GENERATED:INTERACT */     /* <<< GENERATED:INTERACT */
   /* >>> GENERATED:ANIMATION */    /* <<< GENERATED:ANIMATION */
   ```
   骨架的 ALGOS 清单**留空**（`GENERATED:ALGOS  */`），并在紧邻处写一行注释：
   ```javascript
   /* ↑ 从骨架建新工具时，把这一页真正会调用的算法文件名填进 ALGOS 标记行，
      例如 `GENERATED:ALGOS caesar.js`。留空会让 inline_core.py 当场报错——
      这是有意的：一个空的 ALGOS 块会让页面在浏览器里 CryptoAlgos undefined。 */
   ```
3. **第二个 `<script>` 块**是手写区：`TOOL`、`PARAMS`、`SCENES`、
   `pushSample()`（如需要）、`VizEngine.init(...)`。
4. 页面 DOM：全屏 `<canvas id="c">`、浮在其上的 `.panel`（参数与读数）、
   `.tabs`、`.transport`（⏵ ⏸ ⏮ ⏭ ⟲）、`#btnLang`、版本徽章（读 meta）。
5. **canvas 是主角**：面板 `position:fixed` 浮在 canvas 之上，
   绝不切分 canvas（五条原则第 2 条）。

- [ ] **Step 3: 验证骨架能被脚本处理，且脚本对空 ALGOS 清单会报错**

```bash
python3 cryptography/scripts/inline_core.py
```
预期：FAIL，stderr 含
`ERROR: GENERATED:ALGOS 标记缺少清单`

这是**期望行为**——它证明 Step 1 里那条"空清单必须炸"的规则真的生效了。
临时把骨架的标记行改成 `GENERATED:ALGOS caesar.js` 再跑一次：

```bash
python3 cryptography/scripts/inline_core.py && python3 cryptography/scripts/inline_core.py --check
```
预期：第一次打印 `已更新 1 个文件：_skeleton.html`，第二次打印 `1 个文件已是最新`

- [ ] **Step 4: 验证内联后的骨架语法正确**

```bash
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' cryptography/tools/_skeleton.html > /tmp/skel.js && node --check /tmp/skel.js && rm /tmp/skel.js
```
预期：无输出

- [ ] **Step 5: 把骨架的 ALGOS 清单改回空**

骨架是模板不是工具，它不该绑定 `caesar.js`。改回 `/* >>> GENERATED:ALGOS  */`
并清空区间体。这会让 `inline_core.py` 对它报错——因此
**`_skeleton.html` 必须被 `inline_core.py` 与 `check.py` 的 glob 排除**。
在 `inline_core.py` 的 `main()` 里，把
```python
tools = sorted((ROOT / 'tools').glob('*.html'))
```
改成
```python
    # 下划线开头的是模板与预览页，不是工具：_skeleton.html 的 ALGOS 清单
    # 故意留空（它是模板，不绑定任何具体算法），而空清单在 render() 里是
    # 硬错误。把它们排除在外，"模板留空"与"清单必填"这两条规则才能共存。
    tools = sorted(p for p in (ROOT / 'tools').glob('*.html')
                   if not p.name.startswith('_'))
```

- [ ] **Step 6: 确认排除生效**

```bash
python3 cryptography/scripts/inline_core.py
```
预期：`WARN: cryptography/tools/ 下没有 html，本次无事可做`（此刻只有 `_skeleton.html`，已被排除）

- [ ] **Step 7: 提交**

```bash
git add cryptography/scripts/inline_core.py cryptography/tools/_skeleton.html
git commit -m "feat(crypto): inline_core.py 与工具骨架（ALGOS 内联成代码，模板不参与内联）"
```

---

## Task 6: 注册表与 Caesar 工具

**Files:**
- Create: `cryptography/cryptography-tools.json`
- Create: `cryptography/tools/crypto-caesar.html`（从 `_skeleton.html` 复制）

**Interfaces:**
- Consumes: Task 1–5 全部
- Produces: 注册表条目 `crypto-caesar`，供 Task 7 的 app/index 与 Task 8 的 check.py 消费

- [ ] **Step 1: 写 `cryptography-tools.json`**

```json
{
  "schemaVersion": 1,
  "tools": [
    {
      "id": "crypto-caesar",
      "file": "tools/crypto-caesar.html",
      "accent": "cyan",
      "chapter": 1,
      "kicker": { "en": "Classical Cryptography", "zh": "古典密码" },
      "title": { "en": "Caesar Cipher", "zh": "凯撒密码" },
      "desc": {
        "en": "Three views of one shift. The wheel shows the cipher is literally a rotation — k=0 and k=26 are the same wheel. Lift 0…25 into a helix and \"wrapping around\" becomes one visible turn, which is all that mod 26 ever meant. Then lay out all 26 shifts at once and score each against English letter frequency: the winning row lights up on its own. The weakness was never the algorithm; it is that the key space has 26 elements and you can read all of them at a glance.",
        "zh": "同一个位移的三种看法。字母轮告诉你这个密码就是一次旋转——k=0 与 k=26 是同一个轮子。把 0…25 抬成一条螺旋，「绕回去」就成了肉眼可见的一整圈，而模 26 从头到尾就只是这个意思。最后把 26 个位移一次全摊开，各自与英文字母频率打分，正确的那一行自己亮起来。弱点从来不是算法，是密钥空间只有 26 个元素、一眼就能扫完。"
      },
      "tag": {
        "en": "alphabet wheel · modulo 26 · brute force · chi-square",
        "zh": "字母轮 · 模 26 · 穷举 · 卡方"
      },
      "version": "1.0.0",
      "engine": "crypto-1.0.0",
      "changelog": []
    }
  ]
}
```

- [ ] **Step 2: 从骨架建工具页**

```bash
cp cryptography/tools/_skeleton.html cryptography/tools/crypto-caesar.html
```

把 ALGOS 标记行改成 `/* >>> GENERATED:ALGOS caesar.js */`，
并填好 `<title>`、`tool-version`、changelog 注释块。

- [ ] **Step 3: 写三个页签**

`TOOL` 与共享 state：

```javascript
var TOOL = {
  id: 'crypto-caesar',
  title: { en: 'Caesar Cipher', zh: '凯撒密码' },
  h1: { en: 'Caesar Cipher', zh: '凯撒密码' }
};
```

`PARAMS`（滑杆自动生成）：

```javascript
var PARAMS = [
  { key: 'k', label: '<i>k</i>', min: 0, max: 25, step: 1, value: 3, fmt: 0 }
];
```

明文由一个文本输入框驱动（不是滑杆），预置项来自 `CryptoExamples.classical.plaintexts`。

三个 SCENES，**第一个 view 必须是 `iso`**（双击回正的 home）：

| key | label | 画什么 |
|---|---|---|
| `wheel` | 字母轮 / Alphabet Wheel | 外环明文字母（静止）、内环密文字母（整体转 `k/26·2π`），当前字母高亮；中心写 `c ≡ p + k (mod 26)`。用 `alphabetWheel()` 画两次。 |
| `modulo` | 模 26 / Modulo 26 | **顿悟视角**：0…25 沿 z 轴抬成一条螺旋（一圈 = 26），每个字母一个点；`+k` 让点沿螺旋滑动，绕回起点时正好走完一整圈。用 3D 的 `strokePoly / solidDot / label3` 画。 |
| `break` | 穷举 / Brute Force | 26 行候选，每行 `k` + 解出的文本 + χ² 条；最优行用 accent 色发光。用 `cellGrid` / `barChart` / `chip` 画。 |

**颜色纪律**：一条曲线一种颜色，在六处复用（图例点、曲线本体、投影虚线、
头部辉光点、读数粗体值、公式标签）。曲线启用顺序固定 rose → violet → emerald → orange。

**`tips` 文案**：每个页签一条，只讲一个顿悟，并指向具体的视角或开关。

- [ ] **Step 4: 内联并检查语法**

```bash
python3 cryptography/scripts/inline_core.py && python3 cryptography/scripts/inline_core.py --check
```
预期：先 `已更新 1 个文件：crypto-caesar.html`，再 `1 个文件已是最新`

```bash
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' cryptography/tools/crypto-caesar.html > /tmp/caesar.js && node --check /tmp/caesar.js && rm /tmp/caesar.js
```
预期：无输出

- [ ] **Step 5: 浏览器验证（`file://`，三个页签都要看）**

用 preview_start 打开
`file:///Users/nickma/Develop/My2ndBrain/MathViz/cryptography/tools/crypto-caesar.html`，
逐条确认：

1. 三个页签都能画出内容，没有空白 canvas
2. 拖 `k` 滑杆，字母轮的内环跟着转，读数跟着变
3. `k=0` 与 `k=26`（滑到 25 再回 0）画面一致
4. 穷举页高亮的那一行确实是正确的 `k`
5. 点 `#btnLang` 中英切换，Canvas 里的文字与 HTML 面板同时切换
6. `read_console_messages` 无报错

**必须传显式 `tabId`**（CLAUDE.md 并行纪律第 3 条），并在探针里先断言
`TOOL.id === 'crypto-caesar'` 再信任任何测量值。

- [ ] **Step 6: 提交**

```bash
git add cryptography/cryptography-tools.json cryptography/tools/crypto-caesar.html
git commit -m "feat(crypto): Caesar 工具三页签（字母轮 · 模 26 螺旋 · χ² 穷举）与注册表首条"
```

---

## Task 7: 导航壳与画廊

**Files:**
- Create: `cryptography/app.html`（源：`chess/app.html`）
- Create: `cryptography/index.html`（源：`chess/index.html`）

**Interfaces:**
- Consumes: `cryptography-tools.json`（Task 6）
- Produces: 两页各含一份 `FALLBACK`（供 Task 8 的 `fallback_check()` 比对）
  与一个 `PARENT_HOME` 常量（供 Task 8 的 `outbound_ref_check()` 比对）

- [ ] **Step 1: 复制并改名**

```bash
cp chess/app.html   cryptography/app.html
cp chess/index.html cryptography/index.html
```

- [ ] **Step 2: 两页共同的改动**

1. 存储键：`chess-lang` → `cryptography-lang`，`chess-nav` → `cryptography-nav`
2. `fetch('chess-tools.json')` → `fetch('cryptography-tools.json')`
3. 分组字段 `phase` → `chapter`；`PHASE_LABELS` → `CHAPTER_LABELS`；
   `phaseLabel(n)` → `chapterLabel(n)`。**两页的 `CHAPTER_LABELS` 必须逐条同源**：

```javascript
/* 章节标签。app.html 与 index.html 各存一份、必须逐条相同——分组不是
   "开发阶段"而是真正的知识章节，两页共用同一套排序（规范 §10）。
   五章是固定的，不像 chess 的阶段那样会往后长，所以这里不写兜底分支：
   一个越界的 chapter 应该被 check.py 在提交前拦住，而不是在页面上
   长出一个叫"章节 7"的无名栏目。 */
var CHAPTER_LABELS = {
  1: { en: 'Chapter 1 · Classical Cryptography', zh: '第 1 章 · 古典密码' },
  2: { en: 'Chapter 2 · Mechanical Cryptography', zh: '第 2 章 · 机械密码' },
  3: { en: 'Chapter 3 · Cryptanalysis', zh: '第 3 章 · 密码分析' },
  4: { en: 'Chapter 4 · Modern Cryptography', zh: '第 4 章 · 现代密码学' },
  5: { en: 'Chapter 5 · Quantum-Era Cryptography', zh: '第 5 章 · 量子时代密码学' }
};
function chapterLabel(n) { return CHAPTER_LABELS[n] || { en: 'Chapter ' + n, zh: '第 ' + n + ' 章' }; }
```

4. `FALLBACK` 换成 cryptography 的一条（两页各一份，字段
   `id / file / accent / chapter / kicker / title / tag`）：

```javascript
var FALLBACK = [
  {
    id: 'crypto-caesar', file: 'tools/crypto-caesar.html', accent: 'cyan', chapter: 1,
    kicker: { en: 'Classical Cryptography', zh: '古典密码' },
    title: { en: 'Caesar Cipher', zh: '凯撒密码' },
    tag: { en: 'alphabet wheel · modulo 26 · brute force · chi-square',
           zh: '字母轮 · 模 26 · 穷举 · 卡方' }
  }
];
```

5. 品牌与标题文案换成 Cryptography（`L.title` / `L.brand` / `L.eyebrow` / `L.h1` / `L.lead`）
6. `ACCENTS` / `safeAccent()` **原样保留**，连同 chess 那两段注释一起搬——
   它们记录的是真实事故，不是装饰。把注释里指向 `chess/app.html` /
   `chess/index.html` 的互指关系改成指向本子项目的两页。
7. **删掉 chess/index.html 独有的 "阶段 2 ghost 卡片" 那一段**
   （`if (phases.indexOf(2) < 0) {...}` 及 `L.soonKicker` / `L.soonDesc`）：
   那是 chess 阶段 2 未落地时的临时占位，搬过来会在 cryptography 上凭空
   长出一张"第 2 章 敬请期待"的卡片，而第 2–5 章全都还没落地——要么五张
   ghost 全有、要么一张都没有，一张单独的更像 bug。这里选一张都没有。

- [ ] **Step 3: `PARENT_HOME` —— 唯一的出站引用，且自愈**

两页各自在脚本顶部声明**恰好一次**：

```javascript
/* ================= 唯一的出站引用 =================
   这是整个 cryptography/ 子树里唯一一处指向父目录的路径。它的存在是为了
   "返回 MathViz"这一个按钮；除它之外，core/、tools/、examples/ 里不许出现
   任何 `..`+`/` 形式的相对路径——check.py 的 outbound_ref_check() 逐文件
   数着这件事。

   为什么要数：设计约束是"把 cryptography/ 整个目录复制到任何别处仍可用"。
   一条随手写下的 ../outputs/foo.js 会在**别人搬走目录的那一刻**才失效，
   而那时没有任何东西会报警。把它变成一条提交前就会响的断言。

   自愈：http(s) 下对这个 URL 发一次 HEAD 探测，404/网络失败就把按钮藏掉。
   file:// 下 fetch 探测本来就会失败（同源限制），无法区分"文件不在"与
   "协议不让探"，所以那种情况保持显示——file:// 的使用者基本都在仓库里。 */
var PARENT_HOME = '../index.html';

function wireParentLink(el) {
  if (!el) return;
  el.href = PARENT_HOME + '?lang=' + LANG;
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  try {
    fetch(PARENT_HOME, { method: 'HEAD' }).then(function (r) {
      if (!r.ok) el.style.display = 'none';
    })['catch'](function () { el.style.display = 'none'; });
  } catch (e) { el.style.display = 'none'; }
}
```

- `app.html`：把 `<a class="brand" id="brandLink" href="../index.html">` 的静态
  `href` 改成 `href="#"`（这一页 100% 靠 JS 驱动，无 JS 兜底本就不成立），
  `renderChrome()` 里那行 `brandLink.href = '../index.html?lang=' + LANG`
  改成 `wireParentLink(document.getElementById('brandLink'))`。
- `index.html`：同样处理 `#backLink`。

改完后 `../` 在每页恰好出现一次（都在 `PARENT_HOME` 的声明行上）。

- [ ] **Step 4: 语法检查**

```bash
for f in cryptography/app.html cryptography/index.html; do
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' "$f" > /tmp/p.js && node --check /tmp/p.js && echo "OK $f"
done; rm -f /tmp/p.js
```
预期：两行 `OK`

- [ ] **Step 5: 确认没有 chess 残留**

```bash
grep -rn "chess" cryptography/ --include=*.html --include=*.json
```
预期：只剩 fork 来源说明注释里的路径；**不许**出现 `chess-lang` / `chess-nav` /
`chess-tools.json` / `phase`。

- [ ] **Step 6: 浏览器验证**

用 preview_start 打开 `cryptography/app.html`，逐条确认：
1. 侧栏出现 `第 1 章 · 古典密码` 分组，下面一个 Caesar 项
2. 点 home 项，iframe 载入 `index.html` 画廊，卡片按章节分组
3. `?tool=crypto-caesar&lang=zh` 直达且是中文
4. 后退键回到 home，前进键回到工具
5. `Ctrl+B` 折叠侧栏，刷新后保持折叠
6. 语言开关：壳与 iframe 同时切换

- [ ] **Step 7: 提交**

```bash
git add cryptography/app.html cryptography/index.html
git commit -m "feat(crypto): 导航壳与画廊（按 chapter 分组，出站引用收敛到 PARENT_HOME 且自愈）"
```

---

## Task 8: 校验门 `check.py`

**Files:**
- Create: `cryptography/scripts/check.py`

**Interfaces:**
- Consumes: `inline_core`（Task 5）、注册表（Task 6）、两页 FALLBACK（Task 7）
- Produces: CLI `python3 cryptography/scripts/check.py`，全绿 exit 0

八道门，**全部无条件跑到底**，最后按"任一失败则整体失败"汇总退出码——
不许用 `or` 短路。chess 的 `__main__` 注释记着理由：短路会让最有分量的那道门
被前面一个语法错误悄悄跳过。

| # | 函数 | 守什么 |
|---|---|---|
| 1 | `inline_core.main(check_only=True)` | 内联副本与编辑源一致 |
| 2 | `node_check()` | 每个 html 每个 `<script>` 块语法（含 app/index 两个根级页） |
| 3 | `core_tests()` | `core/**/*.test.js` + `examples/**/*.test.js` 全绿 |
| 4 | `registry_check()` | id/file/accent/chapter/version/engine/双语/重复/双向存在 |
| 5 | `fallback_check()` | 两页 FALLBACK 的 id 集合 == 注册表 id 集合 |
| 6 | `version_meta_check()` | 注册表 `version` == html 的 `tool-version` meta |
| 7 | `algos_gate()` | 内联的 ALGOS 块能跑，且 Caesar 全 k 往返成立 |
| 8 | `outbound_ref_check()` | `../` 只出现在 app/index 各一次，其余目录零次 |
| 9 | `inline_order_check()` | `CRYPTO-CORE` 的标记必须排在 `CRYPTANALYSIS` / `ALGOS` 之前 |

**门 9 是实测出来的，不是想出来的。** `caesar.js` 与 `cryptanalysis.js` 的浏览器
分支都写 `factory(root.CryptoCore)`。若 `crypto-core.js` 被内联到它们**之后**，
页面加载时**什么都不会发生**——`C` 捕获成 `undefined`，模块照常挂上去，直到
使用者敲第一个键才炸在 `Cannot read properties of undefined (reading 'mod')`。
标记顺序是页面里的物理顺序（`render()` 是就地替换，不是按 `SOURCES` 的字典序
拼接），所以一次手滑调换两行标记就能造出这个洞，而语法门、内联门、算法门
三道都看不见它。

- [ ] **Step 1: 写 `run_node()` 与常量**

```python
#!/usr/bin/env python3
"""cryptography 子项目校验门（设计文档 §5）。

八道门全部无条件跑到底，最后汇总退出码。
"""
import json
import pathlib
import re
import subprocess
import sys
import tempfile

import inline_core

ROOT = pathlib.Path(__file__).resolve().parent.parent
REGISTRY = ROOT / 'cryptography-tools.json'
SCRIPT_RE = re.compile(r'<script>(.*?)</script>', re.DOTALL)
FALLBACK_ID_RE = re.compile(r"id:\s*'([\w-]+)'")
META_VERSION_RE = re.compile(r'<meta\s+name="tool-version"\s+content="([^"]+)"')
STDIN_LINE_RE = re.compile(r'^\[stdin\]:(\d+)$', re.MULTILINE)
ALGOS_BLOCK_RE = re.compile(
    r'/\* >>> GENERATED:ALGOS(.*?) \*/\n(.*?)/\* <<< GENERATED:ALGOS \*/', re.DOTALL)

CHAPTERS = {1, 2, 3, 4, 5}
ACCENTS = {'cyan', 'rose', 'violet', 'emerald', 'orange'}
BILINGUAL_FIELDS = ('kicker', 'title', 'desc', 'tag')

# Linux 的 execve 对**单个 argv 元素**有 MAX_ARG_STRLEN = 32 页 = 131072 字节的
# 上限（跟 ARG_MAX 那个总量上限是两回事），超了直接 E2BIG。**macOS 没有这个
# 单参数上限。** 根 CLAUDE.md 记录了本仓因此连续四次合并 CI 假绿的事故：
# 一个 225 KB 的内联块当 `node -e` 参数传出去，所有人本地全绿、CI 一直红而
# 没人看。所以脚本一律走 stdin；真需要 stdin 送数据时，在这里当场断言脚本
# 够小——把一个只在 Linux 上出现的失败，变成开发机上就会响的失败。
MAX_ARG_STRLEN = 128 * 1024


def run_node(script: str, stdin_data: str = None):
    if stdin_data is None:
        return subprocess.run(['node'], input=script, capture_output=True, text=True)
    size = len(script.encode('utf-8'))
    if size >= MAX_ARG_STRLEN:
        raise AssertionError(
            f'要走 argv 的 node 脚本有 {size:,} 字节，超过 Linux 的单参数上限 '
            f'{MAX_ARG_STRLEN:,}——在 macOS 上跑得动、到 CI 上就是 '
            f'"Argument list too long"。把大的那一头挪到 stdin 或磁盘。')
    return subprocess.run(['node', '-e', script], input=stdin_data,
                          capture_output=True, text=True)


def load_registry() -> dict:
    return json.loads(REGISTRY.read_text(encoding='utf-8'))


def tool_pages() -> list:
    """tools/ 下的真工具页，排除下划线开头的模板与预览页。

    与 inline_core.main() 的 glob 保持同一条排除规则——两处若不一致，
    就会出现"内联脚本跳过了它、校验门却要求它已被内联"这种自相矛盾的红。
    """
    return sorted(p for p in (ROOT / 'tools').glob('*.html')
                  if not p.name.startswith('_'))


def root_pages() -> list:
    """cryptography/ 根目录下的 html：index.html 与 app.html。

    chess 的同名函数注释里记着为什么要单列它们：它的 node_check() 只
    glob('tools/*.html')，而 CI 的语法门只扫主站文件，两边合起来的结果是
    chess/index.html 从来没有被任何语法门覆盖过——一个纯 JS 驱动的导航页，
    语法错了就是整页白屏，而所有门都报绿。这里从第一天就把它们纳入。
    """
    return sorted(ROOT.glob('*.html'))
```

- [ ] **Step 2: 写门 2–3（语法与测试）**

```python
ROOT_PAGE_MIN = 2      # index.html + app.html


def node_check() -> int:
    """逐个 <script> 块跑 node --check，并把报错行号换算回原文件真实行号。

    不把多个块拼起来再检查一次：工具页有两个 script 块（一个生成、一个手写），
    拼接会把报错行号错报到人手写的那块代码上。
    """
    pages = root_pages()
    if len(pages) < ROOT_PAGE_MIN:
        print(f'ERROR: cryptography/ 根级页面只找到 {len(pages)} 个，至少要 '
              f'{ROOT_PAGE_MIN} 个（index.html 与 app.html）——glob 漏了或文件被挪走了',
              file=sys.stderr)
        return 1
    tools = tool_pages()
    if not tools:
        print('ERROR: cryptography/tools/ 下一个工具页都没有——这道门本该检查语法，'
              '不是跑了个寂寞', file=sys.stderr)
        return 1

    failed = []
    total_blocks = 0
    for path in tools + pages:
        text = path.read_text(encoding='utf-8')
        matches = list(SCRIPT_RE.finditer(text))
        if not matches:
            print(f'WARN: {path.name} 里没有内联 <script>', file=sys.stderr)
            continue
        for m in matches:
            total_blocks += 1
            start_line = text.count('\n', 0, m.start(1)) + 1
            proc = subprocess.run(['node', '--check', '-'],
                                  input=m.group(1), text=True, capture_output=True)
            if proc.returncode != 0:
                def fix_line(mm, base=start_line):
                    return '[stdin]:' + str(int(mm.group(1)) + base - 1)
                failed.append((path.name, STDIN_LINE_RE.sub(fix_line, proc.stderr.strip())))

    for name, err in failed:
        print(f'ERROR: {name} 语法检查失败\n{err}', file=sys.stderr)
    if not failed:
        print(f'node --check：{len(tools) + len(pages)} 个文件、{total_blocks} 个脚本块通过')
    return 1 if failed else 0


def core_tests() -> int:
    """跑 core/ 与 examples/ 下的全部 *.test.js（**含子目录**）。

    用 rglob 而不是 glob：core/algos/caesar.test.js 在子目录里，glob 不下钻。
    chess 在这一点上栽过——algos/minimax.test.js 整个落在门外，本地手跑是绿的，
    这道门却一次都没跑到它。
    """
    tests = (sorted((ROOT / 'core').rglob('*.test.js'))
             + sorted((ROOT / 'examples').rglob('*.test.js')))
    # 一个测试都没找到必须是失败，不是通过——空列表下循环一次都不转、
    # rc 保持 0，这道门就会"因为什么都没找到"而通过。
    if not tests:
        print('ERROR: core/ 与 examples/ 下一个 *.test.js 都没找到 —— '
              '这道门本该跑测试，不是跑了个寂寞', file=sys.stderr)
        return 1
    rc = 0
    for test in tests:
        if subprocess.run(['node', str(test)]).returncode != 0:
            print(f'ERROR: {test.relative_to(ROOT)} 未通过', file=sys.stderr)
            rc = 1
    print(f'core/examples 测试：{len(tests)} 个测试文件'
          + ('全部通过' if rc == 0 else '有未通过的'))
    return rc
```

- [ ] **Step 3: 写门 4–6（注册表 / FALLBACK / 版本）**

```python
def registry_check() -> int:
    """注册表自洽 + 与磁盘双向一致。

    双向很重要：只查"注册表里的文件存在"会漏掉反方向——一个写完但忘了注册的
    工具页会悄悄躺在 tools/ 里进不了任何导航。根仓库真出过这事（main 上
    61 个 output 文件对 60 条注册）。
    """
    reg = load_registry()
    rc = 0
    if reg.get('schemaVersion') != 1:
        print(f'ERROR: schemaVersion 应为 1，实际 {reg.get("schemaVersion")!r}', file=sys.stderr)
        rc = 1
    tools = reg.get('tools') or []
    if not tools:
        print('ERROR: 注册表里一个工具都没有', file=sys.stderr)
        return 1

    seen_ids, seen_files = {}, {}
    for d in tools:
        tid = d.get('id')
        if not tid:
            print('ERROR: 有条目缺 id', file=sys.stderr); rc = 1; continue
        if tid in seen_ids:
            print(f'ERROR: 重复的 id：{tid}', file=sys.stderr); rc = 1
        seen_ids[tid] = 1

        f = d.get('file', '')
        if f in seen_files:
            print(f'ERROR: 重复的 file：{f}', file=sys.stderr); rc = 1
        seen_files[f] = 1
        if not f.startswith('tools/'):
            print(f'ERROR: {tid} 的 file 必须在 tools/ 下，实际 {f!r}', file=sys.stderr); rc = 1
        # 硬边界（规范 §8）：本注册表只管 cryptography/tools/*.html。
        # 一条指向 ../outputs/ 的路径既越了注册表边界，也毁了可搬迁性。
        if '..' + '/' in f:
            print(f'ERROR: {tid} 的 file 指向了子项目之外：{f!r}', file=sys.stderr); rc = 1
        if not (ROOT / f).exists():
            print(f'ERROR: {tid} 的 file 不存在：{f}', file=sys.stderr); rc = 1

        if d.get('chapter') not in CHAPTERS:
            print(f'ERROR: {tid} 的 chapter 必须是 1–5，实际 {d.get("chapter")!r}',
                  file=sys.stderr); rc = 1
        if d.get('accent') not in ACCENTS:
            print(f'ERROR: {tid} 的 accent 必须是 {sorted(ACCENTS)} 之一，'
                  f'实际 {d.get("accent")!r}', file=sys.stderr); rc = 1
        if not re.fullmatch(r'\d+\.\d+\.\d+', str(d.get('version', ''))):
            print(f'ERROR: {tid} 的 version 不是 semver：{d.get("version")!r}',
                  file=sys.stderr); rc = 1
        if not str(d.get('engine', '')).startswith('crypto-'):
            print(f'ERROR: {tid} 的 engine 应形如 crypto-x.y.z，'
                  f'实际 {d.get("engine")!r}', file=sys.stderr); rc = 1
        if not isinstance(d.get('changelog'), list):
            print(f'ERROR: {tid} 的 changelog 必须是数组', file=sys.stderr); rc = 1

        for field in BILINGUAL_FIELDS:
            v = d.get(field)
            if not isinstance(v, dict) or not v.get('en') or not v.get('zh'):
                print(f'ERROR: {tid} 的 {field} 必须同时有非空的 zh 与 en',
                      file=sys.stderr); rc = 1

    # 反方向：磁盘上有、注册表里没有
    registered = set(seen_files)
    for p in tool_pages():
        rel = 'tools/' + p.name
        if rel not in registered:
            print(f'ERROR: {rel} 在磁盘上但没进注册表——它进不了任何导航',
                  file=sys.stderr); rc = 1

    if rc == 0:
        print(f'注册表：{len(tools)} 个工具，字段与磁盘双向一致')
    return rc


def fallback_check() -> int:
    """两页内嵌的 FALLBACK 与注册表的 id 集合必须完全相同。

    FALLBACK 是 file:// 下唯一的数据来源（fetch 会因同源限制失败）。它一旦
    落后于注册表，本地双击打开的画廊就会少工具，而线上是全的——一个只在
    离线时出现的差异，没有这道门就只能靠人撞见。
    """
    reg_ids = set(d['id'] for d in load_registry()['tools'])
    rc = 0
    for name in ('app.html', 'index.html'):
        path = ROOT / name
        text = path.read_text(encoding='utf-8')
        m = re.search(r'var FALLBACK = \[(.*?)\n\];', text, re.DOTALL)
        if not m:
            print(f'ERROR: {name} 里找不到 FALLBACK 数组', file=sys.stderr); rc = 1; continue
        ids = set(FALLBACK_ID_RE.findall(m.group(1)))
        if ids != reg_ids:
            print(f'ERROR: {name} 的 FALLBACK 与注册表不一致\n'
                  f'    只在 FALLBACK：{sorted(ids - reg_ids)}\n'
                  f'    只在注册表：  {sorted(reg_ids - ids)}', file=sys.stderr)
            rc = 1
    if rc == 0:
        print(f'FALLBACK：两页各 {len(reg_ids)} 条，与注册表一致')
    return rc


def version_meta_check() -> int:
    """注册表的 version 必须等于工具页 <meta name="tool-version"> 的值。

    版本号在这个仓库不只是标签，还是**缓存键**：app.html 与画廊都把它拼进
    iframe/卡片的 URL（?v=<version>）。两处不一致时，一次已发布的升级会
    躲在浏览器的旧副本后面，直到使用者清缓存——根 CLAUDE.md 记着这事真发生过。
    """
    rc = 0
    for d in load_registry()['tools']:
        path = ROOT / d['file']
        if not path.exists():
            continue                       # 缺文件由 registry_check 报，不重复报
        m = META_VERSION_RE.search(path.read_text(encoding='utf-8'))
        if not m:
            print(f'ERROR: {d["file"]} 缺 <meta name="tool-version">', file=sys.stderr)
            rc = 1; continue
        if m.group(1) != d['version']:
            print(f'ERROR: {d["id"]} 版本不一致——注册表 {d["version"]}、'
                  f'html meta {m.group(1)}', file=sys.stderr)
            rc = 1
    if rc == 0:
        print('版本元数据：注册表与 html meta 一致')
    return rc
```

- [ ] **Step 4: 写门 7–8（ALGOS 与出站引用）**

```python
def algos_gate() -> int:
    """内联进 html 的 ALGOS 块必须真的能跑，且 Caesar 的往返性质成立。

    inline_core --check 只保证"内联副本与源文件字节相同"。它答不了另一个问题：
    这段代码在浏览器那个没有 module/require 的环境里跑起来会怎样。ALGOS 的
    UMD 分支在 node 下走 module.exports、在页面里走 root.CryptoAlgos——两条
    分支只有一条会被 core 测试覆盖到。这道门跑的是**另一条**。
    """
    rc = 0
    checked = 0
    for path in tool_pages():
        text = path.read_text(encoding='utf-8')
        m = ALGOS_BLOCK_RE.search(text)
        if not m:
            continue
        names = [n.strip() for n in m.group(1).strip().split(',') if n.strip()]
        if 'caesar.js' not in names:
            continue
        core = (ROOT / 'core' / 'crypto-core.js').read_text(encoding='utf-8')
        # ⚠ **不能用 `const self = globalThis;` 加直接执行来模拟浏览器。**
        # node -e 与 node-读-stdin **都**定义了 module 与 require（实测：
        # `typeof module === 'object'`、`typeof require === 'function'`），
        # 于是 UMD 头部会走**node 分支**——这道门就变成了在测 core 测试已经
        # 覆盖过的那条路，同时看起来一切正常。一道测错分支的门比没有门更坏：
        # 它会让人以为浏览器分支被覆盖了。
        #
        # 正确做法是 vm + 一个**裸上下文**（没有 module / require），让 UMD
        # 只能走 root.CryptoAlgos 那条分支。源码经临时文件送进去而不是拼进
        # 脚本字符串：省掉一整套 JS 字面量转义，也更接近浏览器真实的
        # "读文件内容、在全局上下文里执行"。
        with tempfile.TemporaryDirectory() as td:
            core_f = pathlib.Path(td) / 'core.js'
            algos_f = pathlib.Path(td) / 'algos.js'
            core_f.write_text(core, encoding='utf-8')
            algos_f.write_text(m.group(2), encoding='utf-8')
            script = (
                'const vm = require("vm"), fs = require("fs");\n'
                'const sandbox = {}; sandbox.self = sandbox;\n'
                'sandbox.console = console;\n'
                'vm.createContext(sandbox);\n'
                f'vm.runInContext(fs.readFileSync({json.dumps(str(core_f))}, "utf8"), sandbox);\n'
                f'vm.runInContext(fs.readFileSync({json.dumps(str(algos_f))}, "utf8"), sandbox);\n'
                'if (typeof sandbox.module !== "undefined" || typeof sandbox.require !== "undefined") {\n'
                '  console.error("沙箱不干净：module/require 泄漏进来了，测的还是 node 分支");\n'
                '  process.exit(1);\n'
                '}\n'
                'const c = sandbox.CryptoAlgos && sandbox.CryptoAlgos.caesar;\n'
                'if (!c) { console.error("CryptoAlgos.caesar 未挂上 root"); process.exit(1); }\n'
                'const P = "The Quick Brown Fox! 123";\n'
                'for (let k = 0; k < 26; k++) {\n'
                '  if (c.decrypt(c.encrypt(P, k), k) !== P) {\n'
                '    console.error("往返失败 k=" + k); process.exit(1);\n'
                '  }\n'
                '}\n'
                'if (c.bruteForce("DWWDFN").length !== 26) {\n'
                '  console.error("bruteForce 不是 26 个候选"); process.exit(1);\n'
                '}\n'
                'if (c.encrypt("ATTACK AT DAWN", 3) !== "DWWDFN DW GDZQ") {\n'
                '  console.error("教科书向量对不上"); process.exit(1);\n'
                '}\n')
            # 脚本走 stdin（见 run_node 顶上的注释）。临时文件必须在 run_node
            # **之内**还活着，所以这一句留在 with 块里。
            proc = run_node(script)
        if proc.returncode != 0:
            print(f'ERROR: {path.name} 的内联 ALGOS 块求值失败\n'
                  f'{proc.stderr.strip()}', file=sys.stderr)
            rc = 1
        checked += 1
    if checked == 0:
        print('ERROR: 没有任何工具页含 caesar.js 的 ALGOS 块——这道门扫空了',
              file=sys.stderr)
        return 1
    if rc == 0:
        print(f'ALGOS 求值门：{checked} 个页面的内联算法在浏览器分支下可用')
    return rc


# 允许出现出站引用的文件与次数。除这两处外，整个子树必须是零。
# 数值是 1 而不是"随便几次"：两页都已经把这条路径收敛到唯一的 PARENT_HOME
# 常量上，多出来的一次就意味着有人绕过了那个常量。
OUTBOUND_ALLOW = {'app.html': 1, 'index.html': 1}


def outbound_ref_check() -> int:
    """整个 cryptography/ 子树的父目录引用普查。

    设计约束：把 cryptography/ 整个目录复制到任何别处，双击 app.html 仍然
    完整可用。这条约束的敌人不是某一次错误，而是**熵**——第 N 个工具随手写
    一条 ../outputs/foo.js，在别人搬走目录的那一刻才失效，而那时没有任何
    东西会报警。这道门把它变成提交前就会响的断言。

    只扫会被浏览器加载的文件（html / js / json）。scripts/ 下的 Python 不扫：
    它们是构建工具，不解析成 URL；而且这个文件自己就得写出那个字符串。
    needle 拼出来而不是写成字面量，让这段代码即便被扫也不会自己踩雷。
    """
    needle = '..' + '/'
    rc = 0
    total = 0
    for path in sorted(ROOT.rglob('*')):
        if not path.is_file():
            continue
        if path.suffix not in ('.html', '.js', '.json'):
            continue
        rel = path.relative_to(ROOT)
        if rel.parts[0] == 'scripts':
            continue
        n = path.read_text(encoding='utf-8').count(needle)
        total += n
        allowed = OUTBOUND_ALLOW.get(str(rel), 0)
        if n != allowed:
            print(f'ERROR: {rel} 里的父目录引用有 {n} 处，允许 {allowed} 处。\n'
                  f'       cryptography/ 必须能被整体搬走后独立运行；除 app.html 与\n'
                  f'       index.html 各自的 PARENT_HOME 常量外，任何文件都不许指向\n'
                  f'       子项目之外。', file=sys.stderr)
            rc = 1
    if rc == 0:
        print(f'出站引用：全子树共 {total} 处，全部在 PARENT_HOME 上')
    return rc
```

**注意**：`core/*.js` 会被内联进 `tools/*.html`。若某个 core 文件里出现了
父目录引用（例如 UMD 头部的 `require('../crypto-core.js')`），它会被这道门
抓住。`algos/caesar.js` 的 node 分支确实写着 `require('../crypto-core.js')`
——所以 **`core/algos/*.js` 的 require 路径必须改写**，见下一步。

- [ ] **Step 5: 修掉 `caesar.js` 的父目录 require**

Task 2 写的 `caesar.js` UMD 头部有 `require('../crypto-core.js')`，
它会被 `outbound_ref_check()` 判红——而这是对的：那个字符串确实会被内联进
每个工具页。改成不含父目录路径的写法：

```javascript
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    /* node 下取兄弟目录的 crypto-core：路径用 path.join 拼，不写字面的父目录
       相对路径。理由不是风格——那个字符串会被 inline_core.py 原样内联进每个
       工具页，而 check.py 的 outbound_ref_check() 正在数整个子树里的父目录
       引用，用它守住"cryptography/ 可以整体搬走"这条约束。浏览器分支根本走
       不到这一行，为它留一条会触发普查的字面量不划算。 */
    module.exports = factory(require(require('path').join(__dirname, '..', 'crypto-core.js')));
  } else {
    root.CryptoAlgos = root.CryptoAlgos || {};
    root.CryptoAlgos.caesar = factory(root.CryptoCore);
  }
})(typeof self !== 'undefined' ? self : this, function (C) {
```

同样检查 `cryptanalysis.js` 与 `examples/examples.js`：
- `cryptanalysis.js` 用的是 `require('./crypto-core.js')`——同级，无父目录，不用改。
- `examples/examples.js` 用的是 `require('./examples-classical.js')`——同级，不用改。
- `examples/examples.test.js` 用了 `require('../core/_test.js')`——**测试文件不会被内联**，
  但它是 `.js` 且在扫描范围内。把 `OUTBOUND_ALLOW` 改成同时排除 `*.test.js`：

```python
        if rel.parts[0] == 'scripts' or path.name.endswith('.test.js'):
            continue
```

并在注释里说明：测试文件永远不进 html，也不随页面被浏览器加载，
它们跨目录 require 是正常的。

改完后重跑：

```bash
node cryptography/core/algos/caesar.test.js
```
预期：PASS（改的是 require 路径写法，行为不变）

- [ ] **Step 5b: 写门 9（内联顺序）**

```python
# 依赖在前：这两个模块的浏览器分支都是 factory(root.CryptoCore)，
# crypto-core 必须已经跑过。顺序错了页面**加载时毫无征兆**。
INLINE_ORDER_AFTER_CORE = ('CRYPTANALYSIS', 'ALGOS')


def inline_order_check() -> int:
    """CRYPTO-CORE 的标记必须排在依赖它的模块之前。

    这道门守的是一个**静默**失败：caesar.js 与 cryptanalysis.js 的浏览器分支
    都写 factory(root.CryptoCore)。若 crypto-core.js 内联在它们之后，页面加载
    时什么都不会发生——C 捕获成 undefined，模块照常挂上 root，直到使用者敲
    第一个键才炸在 "Cannot read properties of undefined (reading 'mod')"。
    建这个子项目时在 vm 沙箱里复现过。

    标记顺序就是页面里的物理顺序（render() 是就地替换，不是按 SOURCES 的
    字典序拼接），所以调换两行标记即可造出这个洞，而语法门、内联门、算法门
    三道都看不见它——它们各自的前提都是"模块已经正确加载"。
    """
    rc = 0
    for path in tool_pages():
        text = path.read_text(encoding='utf-8')
        core_at = text.find('/* >>> GENERATED:CRYPTO-CORE */')
        if core_at < 0:
            print(f'ERROR: {path.name} 没有 CRYPTO-CORE 标记区间——每个工具页都必须有',
                  file=sys.stderr)
            rc = 1
            continue
        for tag in INLINE_ORDER_AFTER_CORE:
            at = text.find(f'/* >>> GENERATED:{tag}')
            if at < 0:
                continue                   # 这一页不用这个模块，正常
            if at < core_at:
                print(f'ERROR: {path.name} 的 {tag} 标记排在 CRYPTO-CORE 之前。\n'
                      f'       该模块的浏览器分支是 factory(root.CryptoCore)，'
                      f'加载顺序错了不会报错，\n'
                      f'       只会在第一次调用时炸。把 CRYPTO-CORE 移到它前面。',
                      file=sys.stderr)
                rc = 1
    if rc == 0:
        print('内联顺序：CRYPTO-CORE 均排在依赖它的模块之前')
    return rc
```

- [ ] **Step 6: 写 `__main__`**

```python
if __name__ == '__main__':
    # 八道门都要跑到底、都要报——**不能用 `or` 短路**。`a() or b() or c()`
    # 一旦 a() 非零就跳过后面的，意味着一份过期的内联副本（或任何语法错误）
    # 会让整个 core_tests() 门根本不执行，问题只报出第一个，最有分量的那道门
    # 被悄悄跳过了。chess 的同一处注释记着这个教训。
    rc = [
        inline_core.main(check_only=True),
        node_check(),
        core_tests(),
        registry_check(),
        fallback_check(),
        version_meta_check(),
        algos_gate(),
        outbound_ref_check(),
    ]
    sys.exit(1 if any(rc) else 0)
```

- [ ] **Step 7: 全绿验证**

```bash
python3 cryptography/scripts/check.py
```
预期：exit 0，八行通过信息

- [ ] **Step 8: 验证门真的会红（**不可跳过**）**

一道从未见过红色的门不算门。逐条制造故障、确认它报红、再还原：

```bash
# 门 8：往 core 里塞一条父目录引用
printf '\n/* ..%s */\n' '/outputs/x.js' >> cryptography/core/crypto-core.js
python3 cryptography/scripts/inline_core.py >/dev/null
python3 cryptography/scripts/check.py; echo "退出码应为 1，实际 $?"
git checkout cryptography/core/crypto-core.js
python3 cryptography/scripts/inline_core.py >/dev/null
```

```bash
# 门 6：把注册表版本改掉
python3 - <<'PY'
import json, pathlib
p = pathlib.Path('cryptography/cryptography-tools.json')
d = json.loads(p.read_text()); d['tools'][0]['version'] = '9.9.9'
p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
PY
python3 cryptography/scripts/check.py; echo "退出码应为 1，实际 $?"
git checkout cryptography/cryptography-tools.json
```

```bash
# 门 1：手改一次生成区间
python3 - <<'PY'
import pathlib
p = pathlib.Path('cryptography/tools/crypto-caesar.html')
t = p.read_text()
p.write_text(t.replace('/* <<< GENERATED:CRYPTO-CORE */',
                       '/* 手改一行 */\n/* <<< GENERATED:CRYPTO-CORE */', 1))
PY
python3 cryptography/scripts/check.py; echo "退出码应为 1，实际 $?"
python3 cryptography/scripts/inline_core.py
```

三次都必须打印"退出码应为 1，实际 1"。最后确认还原干净：

```bash
python3 cryptography/scripts/check.py && git status --short
```
预期：exit 0，且 `git status --short` 里没有意外的改动

- [ ] **Step 9: 提交**

```bash
git add cryptography/scripts/check.py cryptography/core/algos/caesar.js
git commit -m "feat(crypto): 八道校验门（含出站引用普查——可搬迁性的执法者）"
```

---

## Task 9: 仓库接线

**Files:**
- Modify: `index.html`（Subprojects 卡片区 + `L` 文案 + `renderPage()`）
- Modify: `.githooks/pre-commit`
- Modify: `.github/workflows/registry-sync.yml`
- Create: `.claude/skills/crypto-viz-tool/SKILL.md`

**Interfaces:**
- Consumes: `cryptography/app.html` / `index.html`（Task 7）、`check.py`（Task 8）
- Produces: 无（终点）

**边界重申**：本任务**不许**碰 `tools.json`、`scripts/sync_registry.py`、
根 `app.html`、`outputs/**`、`chess/**`。

- [ ] **Step 1: 根 `index.html` —— 新增卡片 DOM**

在 [`index.html:173`](index.html) 的 `</a>` 之后、`</div>` 之前插入：

```html
    <a class="card" style="--c:var(--trace-violet)" href="cryptography/app.html" id="cryptoCard">
      <div class="k"><span class="dot"></span><span class="kicker" id="cryptoKicker">Cryptography · 密码学</span></div>
      <h2 id="cryptoTitle">Cryptography Lab</h2>
      <p id="cryptoDesc">An interactive cryptography lab, from the Caesar wheel to quantum key distribution — its own core modules and registry, a self-contained subproject.</p>
      <div class="foot"><span class="tag" id="cryptoTag">independent subproject · 独立子项目</span><span class="open" id="cryptoOpen">Open<span class="arw">→</span></span></div>
    </a>
```

accent 用 `violet`：chess 卡片已经占了 `cyan`，两张并排的卡片同色会让
"独立子项目"这个分组看起来像一个东西的两半。

- [ ] **Step 2: 根 `index.html` —— 新增 `L` 文案**

在 [`index.html:975`](index.html) 的 `chessTag: {...}` 之后加逗号并追加：

```javascript
  cryptoKicker: { zh: '密码学 · Cryptography', en: 'Cryptography' },
  cryptoTitle: { zh: '密码学可视化实验室', en: 'Cryptography Lab' },
  /* 工具数**不写进这段文案**。chessDesc 上面那条注释记着教训：阶段 4 加了
     工具④之后根页面还写着「两个」，因为可数的事实被抄进了文案。密码学子项目
     计划里有 25 个工具、分五章陆续落地，把数字写进来就是给自己排了 25 次
     忘记更新的机会。这里只描述范围（从凯撒轮到量子密钥分发），不数数。 */
  cryptoDesc: { zh: '一个可交互的密码学实验室：从凯撒的字母轮一路到量子密钥分发，古典密码、机械密码、密码分析、现代密码与量子时代各成一章——它有自己的一套核心模块与注册表，是一个独立子项目。',
                en: 'An interactive cryptography lab, from the Caesar wheel all the way to quantum key distribution — classical, mechanical, cryptanalysis, modern and quantum-era each get their own chapter. It has its own core modules and registry, a self-contained subproject.' },
  cryptoTag: { zh: '独立子项目 · 自带注册表', en: 'independent subproject · own registry' }
```

- [ ] **Step 3: 根 `index.html` —— 新增渲染与 `IN_SHELL` 判断**

在 [`index.html:1003`](index.html) 的 chess `href` 赋值之后追加：

```javascript
  document.getElementById('cryptoKicker').textContent = t(L.cryptoKicker);
  document.getElementById('cryptoTitle').textContent = t(L.cryptoTitle);
  document.getElementById('cryptoDesc').textContent = t(L.cryptoDesc);
  document.getElementById('cryptoTag').textContent = t(L.cryptoTag);
  document.getElementById('cryptoOpen').innerHTML = t(L.open) + '<span class="arw">→</span>';
  /* 与 Chess 卡片同一条规则：顶层打开时指向 cryptography 自己的导航壳；
     本页正被主站 app.html 的 iframe 载入时，指向那张扁平画廊——否则壳里再
     套一层壳，屏幕上会同时出现两条侧边栏（规范 §7：No shell inside shell）。
     HTML 里那个静态 href 保持 cryptography/app.html：它只对无 JS 与爬虫生效，
     而那类访问按定义就是顶层。 */
  document.getElementById('cryptoCard').href = IN_SHELL
    ? 'cryptography/index.html?lang=' + LANG
    : 'cryptography/app.html?lang=' + LANG;
```

- [ ] **Step 4: 确认根注册表未受影响**

```bash
python3 scripts/sync_registry.py --check && git diff --stat tools.json app.html
```
预期：`--check` exit 0；`git diff --stat` **无输出**（这两个文件一个字节都没动）

```bash
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' index.html > /tmp/root.js && node --check /tmp/root.js && rm /tmp/root.js
```
预期：无输出

- [ ] **Step 5: `.githooks/pre-commit` —— 新增 cryptography 段**

在 [`.githooks/pre-commit:71`](.githooks/pre-commit) 的 chess 段 `fi` 之后、
`exit 0` 之前插入：

```sh
# ---- cryptography 子项目 ----
# 与 chess 段同构。只暂存 inline_core.py 这次实际改写过的文件
# （--print-changed 一行一个路径），不要 `git add cryptography/tools/*.html`
# 这种整体 glob——那会把其他并行会话半写的文件一起卷进本次提交
# （CLAUDE.md「并行开工纪律」第 2 条记过这次事故）。
if git diff --cached --name-only | grep -qE '^cryptography/(core|examples|tools|scripts)/'; then
  CRYPTO_CHANGED=$(python3 cryptography/scripts/inline_core.py --print-changed)
  if [ $? -ne 0 ]; then
    echo "cryptography: inline_core.py 失败，提交中止" >&2
    exit 1
  fi
  if [ -n "$CRYPTO_CHANGED" ]; then
    echo "$CRYPTO_CHANGED" | while IFS= read -r f; do
      [ -n "$f" ] && git add "$f"
    done
  fi
  if ! python3 cryptography/scripts/check.py; then
    echo "cryptography: check.py 未通过，提交中止" >&2
    exit 1
  fi
fi
```

同时把文件第 11 行的提示补上子项目名：
```
  echo "pre-commit: 未找到 python3，跳过注册表同步检查与 chess / cryptography 子项目校验" >&2
```

- [ ] **Step 6: `.github/workflows/registry-sync.yml` —— 新增 gates 步骤**

在文件末尾 `chess subproject gates` 步骤之后追加：

```yaml
      - name: cryptography subproject gates
        run: |
          python3 cryptography/scripts/check.py
```

**注意**（根 CLAUDE.md 记录的教训）：GitHub Actions 用的是**分支自己的**
workflow 文件。这一步在本分支加上之后才会在本分支的 PR 上跑；
一个在本步骤加入之前切出的分支不会跑它。

- [ ] **Step 7: 写 `.claude/skills/crypto-viz-tool/SKILL.md`**

frontmatter 必须有 `name` 与 `description`。正文至少写清：

```markdown
---
name: crypto-viz-tool
description: Build or upgrade a single-file, zero-dependency interactive cryptography visualisation in the cryptography/ subproject. Use whenever the developer wants to create, add, make, or build a visualisation / teaching tool / 可视化 for any cryptography or cryptanalysis concept — 凯撒 / 维吉尼亚 / Playfair / Hill / Enigma / DES / AES / RSA / Diffie-Hellman / 哈希 / BB84 / 量子密钥分发 — and also when improving, adjusting, upgrading, or 改进/升级 an existing tool under cryptography/tools/. Do NOT use it for the maths tools in outputs/ (use math-viz-tool) or for chess/.
---
```

正文必须包含的**作用域声明**（规范 §21）：

```
Target root:  cryptography/
Tool output:  cryptography/tools/
Registry:     cryptography/cryptography-tools.json
Core:         cryptography/core/
Examples:     cryptography/examples/
Validation:   cryptography/scripts/check.py
Skeleton:     cryptography/tools/_skeleton.html
```

以及这条硬规则，单独成段：

> **Never register a CryptoViz tool in `/tools.json`.**
> 根注册表只管 `/outputs/*.html`。三套注册表互不相交（规范 §8）。

还要写明：
- 新工具必须从 `_skeleton.html` 复制，不许从零发明 tool shell
- 生成区间禁止手改；改算法改 `core/`，然后跑 `inline_core.py`
- 章节 1–5 的固定含义；accent 只能从五个键里选
- 版本三处同步：注册表 `version` + html `tool-version` meta + 面板徽章（读 meta）
- 两页 `FALLBACK` 要跟着注册表加条目，否则 `file://` 下画廊会缺工具
- 不许写任何指向 `cryptography/` 之外的相对路径（可搬迁性）
- 验收：`python3 cryptography/scripts/check.py` 必须 exit 0

- [ ] **Step 8: 端到端确认钩子与门都动**

```bash
python3 cryptography/scripts/check.py && python3 scripts/sync_registry.py --check
```
预期：两个都 exit 0

- [ ] **Step 9: 提交**

```bash
git add index.html .githooks/pre-commit .github/workflows/registry-sync.yml \
        .claude/skills/crypto-viz-tool/SKILL.md
git commit -m "feat(crypto): 仓库接线（根卡片 · pre-commit · CI 门 · crypto-viz-tool skill）"
```

提交后**必须**重读 `git status --short`，逐条确认每个路径都是本任务的
——钩子会在你 `git add` 之后再暂存更多文件（CLAUDE.md 并行纪律第 5 条）。

---

## Task 10: 端到端验收与 PR

**Files:** 无新增

- [ ] **Step 1: 三道门全绿**

```bash
python3 cryptography/scripts/inline_core.py --check && \
python3 cryptography/scripts/check.py && \
python3 scripts/sync_registry.py --check && \
python3 chess/scripts/check.py
```
预期：四个都 exit 0（chess 那道证明没有误伤到它）

- [ ] **Step 2: 可搬迁性实测（设计文档 §7 第 7 条）**

```bash
D="/private/tmp/claude-501/-Users-nickma-Develop-My2ndBrain-MathViz/1fba843e-40f1-4d15-9bd3-15abb6a93a7e/scratchpad/portability-test"
rm -rf "$D" && mkdir -p "$D" && cp -R cryptography "$D/" && ls "$D/cryptography"
```

然后用 preview_start 打开 `file://$D/cryptography/app.html`：
1. 侧栏、画廊、Caesar 三个页签全部正常
2. `read_console_messages` 无报错（尤其没有 404）

再用 http 打开同一份拷贝，确认"返回 MathViz"按钮**自动消失**：

```bash
python3 -m http.server 8899 --directory "$D" >/dev/null 2>&1 &
```
访问 `http://localhost:8899/cryptography/app.html`，确认品牌链接被隐藏。
测完杀掉服务器并删掉临时目录。

- [ ] **Step 3: 根页面卡片两种形态**

1. 顶层打开 `index.html` → Cryptography 卡片指向 `cryptography/app.html`
2. 打开 `app.html`（主站壳）→ 里面的 `index.html` 的卡片指向 `cryptography/index.html`

- [ ] **Step 4: 推分支、开 PR**

```bash
git push -u origin claude/cryptography-scaffold
```

PR 正文必须写清：本期交付范围、与 chess 的两处刻意分歧
（ALGOS 内联成代码；无 ghost 占位卡片）、可搬迁性约束及其执法者、
以及后续五章的批次计划。结尾加：

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

- [ ] **Step 5: 读 CI 结论（**不可跳过**）**

```bash
gh pr checks <PR#>
```

本机绿不是绿。根 CLAUDE.md 记录了 `registry-sync.yml` 连续四次把红色报进
虚空的事故：大家都在 macOS 上开发，CI 跑 Linux，两者在 `MAX_ARG_STRLEN`
上的分歧本地永远看不见。**必须**读到 CI 的实际结论再报告完成。

- [ ] **Step 6: 等用户确认合并**

绝不自行合并。等用户在对话里说"合并"。

---

## Self-Review

**Spec coverage**（对照设计文档逐节）：

| 设计文档 | 覆盖它的任务 |
|---|---|
| §1.1 建什么/不建什么 | File Structure 表 + Task 1 的"明确不建"段 |
| §2.1 引擎 fork 与改动 | Task 3 Step 1–2 |
| §2.2 为什么保留 3D | Task 3 Step 3 注释 + Task 6 的 modulo 页 |
| §2.3 2D 图元层 | Task 3 Step 3（六个图元全部给了实现） |
| §2.4 配色 | Global Constraint 6 + Task 7 Step 2 第 6 条 |
| §3.1 注册表 | Task 6 Step 1 |
| §3.2 app.html | Task 7 Step 2–3 |
| §3.3 index.html | Task 7 Step 2–3 |
| §3.4 语言 | Global Constraint 4 + Task 3 Step 1 + Task 7 Step 2 |
| §4 Caesar 三页签 | Task 6 Step 3 |
| §5 八道门 | Task 8 全部 |
| §5.1 钩子与 CI 接线 | Task 9 Step 5–6 |
| §6.1 注册表隔离 | Global Constraint 2 + Task 9 Step 4 |
| §6.2 可搬迁 | Task 8 Step 4–5（执法）+ Task 10 Step 2（实测） |
| §6.3 Claude Skill | Task 9 Step 7 |
| §7 验收 8 条 | Task 10 Step 1–5 |

**发现并已就地修掉的三处问题：**

1. `caesar.js` 的 UMD 头部原本写 `require('../crypto-core.js')`，会被
   Task 8 的出站引用门判红——而那个字符串确实会被内联进工具页。
   Task 8 Step 5 改成 `path.join(__dirname, '..', 'crypto-core.js')`。
2. `_skeleton.html` 的 ALGOS 清单必须留空（它是模板），但空清单在
   `render()` 里是硬错误。Task 5 Step 5 用"排除下划线开头的文件"化解，
   并在 Task 8 的 `tool_pages()` 里用**同一条**排除规则，避免两处不一致
   导致自相矛盾的红。
3. `examples/examples.test.js` 跨目录 `require('../core/_test.js')` 也会被
   出站引用门抓住。Task 8 Step 5 排除 `*.test.js`——测试文件永远不进 html。

**Type consistency**：`chapterLabel` / `CHAPTER_LABELS` / `PARENT_HOME` /
`wireParentLink` / `tool_pages()` / `OUTBOUND_ALLOW` 在定义处与使用处名称一致；
`CryptoCore` / `CryptoAlgos.caesar` / `Cryptanalysis` / `CryptoExamples` /
`CryptoAnim` 五个全局名在 Task 1–4 定义、在 Task 6 与 Task 8 消费，拼写一致。
