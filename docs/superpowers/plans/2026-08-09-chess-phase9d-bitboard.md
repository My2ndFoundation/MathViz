# 阶段 9d：`bitboard`（马的走法生成，8×8 真 64 位）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给工具⑤ 加**第七道题** `bitboard`：把整块 8×8 盘当**一个** 64 位 BigInt，左右移位八次、每次配一张掉线掩码，一次算出一枚马的全部攻击格。教学落点是**文件回绕** —— 移位不认识棋盘的边。

**Architecture:** 入口 `addDir(k)` **按方向递归**（末尾调 `addDir(k + 1)`），于是调用深度 = 第几个方向，**深度塔恰好八层 = 马的八个走法**，第三根轴不需要任何额外声明（与 9c 的 `fillLayer(d)`、`knightPath` 的 `expand(frontier, d)` 同构）。掩码写在源码里、是完整正确的一份；`tips` 叫她**亲手删掉再 Run 一次**，看盘上冒出来的幽灵格 —— 零额外机制，源码不带人造开关。

**Tech Stack:** 零依赖 ES 子集 JavaScript（`node` 直跑 + 浏览器内联）；BigInt 与 `& | ^ ~ << >>`（9b 加的）；Python 3 的 `chess/scripts/check.py`（九道门）与 `chess/scripts/inline_core.py`；无构建、无包管理器。

## Global Constraints

**每次派发子代理都必须带上这一句：**

> 如果计划里某段代码是错的、或某个测试断言了一件事实上错误的事，停下来报告，不许改代码或改测试去迁就它。计划是记录，不是权威。

⚠ **本计划的作者在阶段 9c 写错过四处**（`Math.round(L.cell * 0.34)` 恒等于 0、`a.row()` 不存在、「两处版本号」实为三处、`m.text` 应为 `info.text`）。**凡是本计划引用既有函数、字段、常量或项目规矩的地方，动手前自己 grep 一次再用。** 下面每一条我标了「已核」的都是我实测过的，没标的请自己查。

### 工作目录

**`/private/tmp/claude-501/-Users-nickma-Develop-My2ndBrain-MathViz/bdf18d2b-3526-445e-b42f-283159e0818b/scratchpad/wt-9d`**（worktree，分支 `claude/chess-phase9d`）。

**每个任务第一件事**：

```bash
git rev-parse --abbrev-ref HEAD   # 必须是 claude/chess-phase9d
git status --short                # 必须是空的
```

对不上就停下来报告。⚠ **主工作树 `/Users/nickma/Develop/My2ndBrain/MathViz` 是别的 session 的活，一个字都不要动。**（9c 执行途中它被切走过一次，验收因此差点作废。）

### 规格

`docs/superpowers/specs/2026-08-02-chess-viz-suite-design.md`，本阶段相关的是 **§4⑤**（含「9d 开工前定下的（2026-08-09）」五条 + 「四道题的裁定」+ 可扩展性架构要求 + 声明层三条硬约束）、**§2.4**、**§5.3**、**§7**。

### 硬约束

- **格子编号 `sq = r * 8 + c`**，`r=0` 是棋盘**最下面**一行、`c=0` 最左，0 号格 = a1。**别在中间翻上下。**（已核：`kpSqName` 用的是 `f = sq % W; r = (sq - f) / W`。）
- **`render(parts, lang)` 那一整段在所有 algos 里逐字节相同**，`check.py` 的 `bilingual_algos_check()` 逐字节核对。**原样抄，一个字节都不许改**（已核：九份的该段 md5 全同）。
- **两种语言的行数必须逐段相等**（规格 §1.6）。写不成等行数**停下来报告**，不许塞废话或砍内容凑数。
- **`source(opts)` 的 `lang` 必填、无默认值**。
- **生成出来的教学源码，读者是一个没学过棋、正在学算法的十六岁学生。**
- **生成源码受 ES 子集约束**（不约束 `bitboard.js` 自身）：**没有模板字面量、没有正则字面量、没有 `for…in`、没有 `try/catch`**，字符串用 `+` 拼。可用 `let`/`const`、数组与索引、对象字面量、`if/else`、`for`、`for…of`、`while`、函数与递归、箭头函数、**BigInt 字面量 `123n` 与 `BigInt(x)`**、`& | ^ ~ << >>`。
- **宿主桥接只有五个**（`mark` / `place` / `clear` / `log` / `attacked`），**不许加第六个**。
- **`T.throws(fn, label, pattern)` 的 pattern 必须含一段守卫自己的固定文案**（阶段 9a 第九道门）。
- **`git status --short` 之后只暂存显式路径**；禁止 `git add -A` / `git commit -a`。**commit 跑完要再看一遍。**
- ⚠ **不要在 commit 之前手工跑 `inline_core.py`**：钩子跑的是 `--print-changed`，**只在它自己真的改了文件时才补暂存**；你先跑过它就判「无变化」，内联镜像会悬空没进 commit。（9b 踩过两次。）要么让钩子自己来，要么在 `git add` 里**显式列上那三份 HTML**。
- ⚠ **突变实验前把文件拷进 scratchpad（带任务前缀），备份拷在突变的前一刻**。**绝不要用 `git checkout --` 还原**，用 `cp`。
- ⚠ **只看 `check.py` 的退出码会误判** —— 要在输出里找到你想验的**那道门自己那一行**。⚠ **实现者在跑的时候不要跑门**（工作树不是静止的，那一刻的读数不作数）。
- **浏览器环境有个坑**：Browser pane 里 `document.hidden` **恒为 true**、`requestAnimationFrame` 停摆。9c 的实现者用 devtools 临时补丁绕过（没碰仓库文件），另有一位用「scratchpad 里另拷一份 `chess/` 做隔离验证」。每次浏览器调用带**显式 `tabId`**。
- ⚠ **本地绿 ≠ CI 绿**。开 PR 后 `gh pr checks <PR#>`。

---

## 这道题的数（**实测**，不是估的）

马的八个偏移量与它们的文件差（`node` 实跑）：

| 偏移 | 合法时的文件差 | **回绕时的文件差** |
|---|---|---|
| ±15 / ±17 | **1** | **7** |
| ±6 / ±10 | **2** | **6** |

所以要防**两类**回绕：跨一条线的（±15/±17）与跨两条线的（±6/±10）。掩码因此要分四张：`NOT_A` / `NOT_AB` / `NOT_H` / `NOT_GH`。

几个可以拿来当判据的答案（实测）：

| 马的位置 | 攻击格 | 个数 |
|---|---|---|
| **a1**（`sq=0`，角） | c2 b3 | **2** |
| **d4**（`sq=27`，中心） | — | **8** |
| **a4**（`sq=24`，a 线） | — | **4** |
| **h8**（`sq=63`，角） | — | **2** |

⚠ **上表只有 a1 那一行我列了具体格子。** 其余三行**只给了个数** —— 实施时**自己用宿主侧参照实现算出来对拍**，别信我列的个数（这一条是本阶段第五次提醒：**没核对就写**是这份计划作者的惯犯错误）。

---

## 文件结构

| 文件 | 责任 | 本阶段动作 |
|---|---|---|
| `chess/core/algos/bitboard.js` | 第七道题的**算法源码生成器**（吐字符串，不算走法） | **新建**（双语） |
| `chess/core/algos/bitboard.test.js` | 它的测试（宿主侧参照对拍 + 三道双语门 + 回绕反证） | **新建** |
| `chess/tools/chess-board-algorithms.html` | 工具⑤ | 声明 `PROBLEMS.bitboard`、标记行加名字、**BigInt 读数不走 `fmtInt`**、双语文案、定版 1.5.0 |
| `chess/chess-tools.json` | 工具注册表 | 1.4.0 → 1.5.0，`version` / `changelog` / `desc` / `tag` |

**只有两个新文件。** 规格 §4⑤ 的可扩展性要求是「新增一道题 = 加一个键 + 一个 `algos/*.js` + 标记行一个名字」。**本阶段额外要动的只有一处**：BigInt 的读数格式化（规格 §4⑤⑤ 裁定的那条）。**报告里要把这一处与「这道题的开销」分开讲** —— 它是 BigInt 进读数这件事的债，不是 `bitboard` 特有的（9e/9f 若有 BigInt 结果同样受益）。

⚠ 参照 9c 的实测：`PROBLEMS` 一道题实际还带一个文案对象、一个参数表、可能一个护栏函数、可能一个颜色常量 —— **`rookCover`/`kingDominate`/`pathCount` 三道都是这个形状**，所以「三处」那句话对既有各题早就是简写。**不要因为多了这几样就以为架构破了**；要报的是「除此之外还改了渲染/tab/滑杆/图例/相机吗」。

**9d 明确不做**（规格 §4⑤「9d 不做」那一条）：

- **车/象的滑行攻击** —— 要占据位图与 magic bitboard，量级完全不同，也不在 A-level 范围；
- **挖空练习**（§2.9）—— opt-in，不在本阶段；
- **两份源码对照** —— 那是 `kingDominate` 的形状，这道题没有两个算法可比。

三条都不许「顺手做一点」。

---

## 并行编排

| 轮 | 并行 | 依据 |
|---|---|---|
| 1 | **Task 1 单独** | 生成器与测试是后面所有任务的输入 |
| 2 | **Task 2 → 3 → 4 串行** | 三个都改 `chess-board-algorithms.html` |
| 3 | **Task 5 单独** | 浏览器验收，要前面全部落地 |
| 4 | **Task 6 单独** | 定版收尾 |

⚠ Task 1 与 Task 2 **不能并** —— Task 2 的 `source()` 要调 Task 1 产出的 `bitboard.js`。

---

## Task 1：`bitboard.js` 双语生成器 + 它的测试

**Files:**
- Create: `chess/core/algos/bitboard.js`
- Create: `chess/core/algos/bitboard.test.js`

**Interfaces:**
- Consumes: 无
- Produces: `require('./bitboard.js').source({ sq, lang })` → 一段源码字符串。`sq`（马的位置，0–63）与 `lang` 均必填。入口函数名 **`addDir`**，顶层 `addDir(0); return atk;`（`atk` 是攻击位盘 BigInt）。

- [ ] **Step 1: 抄那段逐字节相同的双语渲染助手**

```bash
sed -n '/^  \/\* ================= 双语渲染/,/^  }$/p' chess/core/algos/path-count.js > /tmp/9d-render.txt
wc -l /tmp/9d-render.txt
```

把这一整段（注释 + `function render(parts, lang) { … }`）**逐字节**抄进新文件。**一个字节都不许改。**

- [ ] **Step 2: 写会失败的测试**

新建 `chess/core/algos/bitboard.test.js`：

```js
'use strict';
const T = require('../_test.js');
const I = require('../interp.js');
const B = require('./bitboard.js');

/* 宿主侧的独立参照 —— 不是写死期望值，是另写一份实现来对拍。
   规格 §7.3：判据是「跟另一份实现一致」。这一份**不用位运算**，
   走的是最朴素的「一格一格加偏移、判边界」——两份实现的思路完全
   不同，同时错成一样的可能性远低于我把某个数抄错。 */
const DF = [1, 2, 2, 1, -1, -2, -2, -1];   // 文件方向
const DR = [2, 1, -1, -2, -2, -1, 1, 2];   // 行方向
function hostAttacks(sq) {
  const f = sq % 8, r = (sq - f) / 8;
  const out = [];
  for (let k = 0; k < 8; k++) {
    const nf = f + DF[k], nr = r + DR[k];
    if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) out.push(nr * 8 + nf);
  }
  return out.sort(function (a, b) { return a - b; });
}
function hostBB(sq) {
  let b = 0n;
  const a = hostAttacks(sq);
  for (let i = 0; i < a.length; i++) b = b | (1n << BigInt(a[i]));
  return b;
}
function sqName(s) { const f = s % 8; return String.fromCharCode(97 + f) + ((s - f) / 8 + 1); }

/* 六十四格全跑一遍。位盘这道题的全部风险都在边线上，抽样会漏。 */
let n = 0;
for (let sq = 0; sq < 64; sq++) {
  const r = I.run(B.source({ sq: sq, lang: 'zh' }), { host: {} });
  T.ok(!r.trace.truncated, sqName(sq) + ' —— 没撞步数上限');
  T.eq(r.result, hostBB(sq), sqName(sq) + ' —— 攻击位盘与宿主侧参照一致');
  n++;
}
T.eq(n, 64, '六十四格全跑过');

/* 四个写死的锚点。上面那组比的是「两份实现一致」，这四条钉的是
   「那个一致的答案就是棋盘上真的那几格」—— 两份实现同时错成同一个
   数，只有这四条拦得住。a1 与 h8 是角（各 2 个），d4 是中心（8 个），
   a4 在 a 线上（4 个，正是掩码在干活的那一档）。 */
T.eq(hostAttacks(0).map(sqName).join(' '), 'c2 b3', 'a1 的马：两个走法');
T.eq(hostAttacks(63).length, 2, 'h8 的马：两个走法');
T.eq(hostAttacks(27).length, 8, 'd4 的马：八个走法');
T.eq(hostAttacks(24).length, 4, 'a4 的马：四个走法');

/* ---- 回绕的反证：把掩码拿掉，a 线上的马必然跑到 h 线 ----
   这一条不测被测源码，它测的是**这道题值不值得存在**：若不加掩码
   也碰巧对，那这道题就没有那一课了。所以它算的是「裸移位」的结果，
   与生成器无关。 */
function nakedShift(sq) {
  let b = 0n;
  const OFF = [6, 10, 15, 17, -6, -10, -15, -17];
  for (let i = 0; i < OFF.length; i++) {
    const t = sq + OFF[i];
    if (t >= 0 && t < 64) b = b | (1n << BigInt(t));
  }
  return b;
}
T.ok(nakedShift(24) !== hostBB(24),
     '裸移位与正确答案不同 —— a4 的马不加掩码会跑到别的线上（这道题的那一课）');

/* ---- mark 通道：这道题按方向逐个标出攻击格 ---- */
const marks = [];
I.run(B.source({ sq: 27, lang: 'zh' }), { host: {
  mark: function (s, kind) { marks.push([s, kind]); },
} });
T.ok(marks.length >= 8, 'd4 的八个攻击格都标了（' + marks.length + ' 次）');

/* ---- 三道双语门（规格 §7.5）---- */
const zh = B.source({ sq: 27, lang: 'zh' });
const en = B.source({ sq: 27, lang: 'en' });
T.ok(zh !== en, '两种语言真的不一样');
T.eq(zh.split('\n').length, en.split('\n').length, '① 行数同一（规格 §1.6 的逐行对齐）');
T.eq(I.run(zh, { host: {} }).trace.length, I.run(en, { host: {} }).trace.length,
     '② 步数同一（注释不产生步）');
T.ok(!/[一-鿿㐀-䶿　-〿＀-￯]/.test(en.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')),
     '③ 英文变体抽掉注释后没有汉字');

T.throws(function () { B.source({ sq: 0 }); }, 'lang 缺席当场抛',
         'source({ lang }) 少了 lang');
T.throws(function () { B.source({ lang: 'zh' }); }, 'sq 缺席当场抛',
         'source({ sq }) 少了 sq');

T.report();
```

- [ ] **Step 3: 跑一遍，确认它失败**

```bash
node chess/core/algos/bitboard.test.js
```

期望：`Cannot find module './bitboard.js'`。

- [ ] **Step 4: 写生成器的可执行骨架**

UMD 包装与 `render()` 照抄 `path-count.js`（Step 1 已抄）。**生成出来的源码，可执行部分逐字如下** —— 注释与散文由你写（Step 5），这些代码行是定的：

```js
'const NOT_A  = 0xfefefefefefefefen;',
'const NOT_AB = 0xfcfcfcfcfcfcfcfcn;',
'const NOT_H  = 0x7f7f7f7f7f7f7f7fn;',
'const NOT_GH = 0x3f3f3f3f3f3f3f3fn;',
'',
'const one = 1n << BigInt(SQ);',
'let atk = 0n;',
'',
'function addDir(k) {',
'  if (k >= 8) { return; }',
'  let b = 0n;',
'  if (k === 0) { b = (one << 17n) & NOT_A;  }',
'  if (k === 1) { b = (one << 15n) & NOT_H;  }',
'  if (k === 2) { b = (one << 10n) & NOT_AB; }',
'  if (k === 3) { b = (one <<  6n) & NOT_GH; }',
'  if (k === 4) { b = (one >> 17n) & NOT_H;  }',
'  if (k === 5) { b = (one >> 15n) & NOT_A;  }',
'  if (k === 6) { b = (one >> 10n) & NOT_GH; }',
'  if (k === 7) { b = (one >>  6n) & NOT_AB; }',
'  b = b & FULL;',
'  atk = atk | b;',
'  if (b !== 0n) {',
'    let t = b;',
'    while (t !== 0n) {',
'      mark(lowBit(t), "ok");',
'      t = t & (t - 1n);',
'    }',
'  }',
'  addDir(k + 1);',
'}',
'',
'addDir(0);',
'return atk;',
```

还需要两个辅助（同样是生成源码的一部分）。⚠ **它们必须排在 `addDir` 之前** —— `FULL` 与 `lowBit` 都被 `addDir` 用到，而这个解释器是顺序求值的，`const` 不提升：

```js
'const FULL = (1n << 64n) - 1n;',
'',
'function lowBit(b) {',
'  let i = 0;',
'  let t = b;',
'  while ((t & 1n) === 0n) { t = t >> 1n; i = i + 1; }',
'  return i;',
'}',
```

**所以生成源码的整体顺序是**：四张掩码 → `FULL` → `lowBit` → `const SQ = …`（由 `source()` 插入）→ `one` / `atk` → `addDir` → `addDir(0); return atk;`。

⚠ **`const SQ` 由 `source()` 插在 `render(HEAD)` 与 `render(BODY)` 之间**（照 `path-count.js` 的形状），所以 `one = 1n << BigInt(SQ)` 必须在 `BODY` 里、不能在 `HEAD` 里。**自己确认这个切分点。**

⚠ **四处必须自己验、不许照抄我的**：

1. **八个方向与掩码的配对**（哪个偏移配哪张掩码）。我上面写的配对**是推的**。**动手前用 `node` 把 64 格全跑一遍对拍 `hostBB`** —— 配错了某一档会静默给出错误答案（它仍然是个合法的 BigInt）。**对不上就以实测为准并在报告里写明我配错了哪一处。**
2. **四张掩码的十六进制常量**。`NOT_A` 应当是「除 a 线外全 1」。**自己算一遍**（`node -e` 打印 `0xfefe…n.toString(2)` 数一数）。
3. **`>>` 对负数/高位的行为**：`one >> 17n` 在 BigInt 上是算术右移，`one` 恒为正所以没问题；但 `b & FULL` 那一步**是必须的还是多余的**，自己判断并在注释里说明理由（BigInt 没有 64 位宽度，左移会越过第 63 位）。
4. **`lowBit` 的写法**在 ES 子集里跑得通吗（`while` + `&` + `>>` 都在子集里，已核）。但它对 `b === 0n` 会**死循环** —— 上面的调用点用 `while (t !== 0n)` 挡住了，**确认这个保护充分**。

`source(opts)`：

```js
  function source(opts) {
    const o = opts || {};
    if (o.sq === undefined || o.sq === null) {
      throw new Error('source({ sq }) 少了 sq —— 马站在哪一格没有默认值，必须写明');
    }
    const sq = o.sq;
    if (typeof sq !== 'number' || !isFinite(sq) || Math.floor(sq) !== sq ||
        sq < 0 || sq > 63) {
      throw new Error('sq 必须是 0 到 63 之间的整数（8×8 的格子编号），收到：' + sq);
    }
    return render(HEAD, o.lang)
      .concat(['const SQ = ' + sq + ';'])
      .concat(render(BODY, o.lang))
      .join('\n');
  }

  return { source: source };
```

- [ ] **Step 5: 写双语散文**

`{ zh: [], en: [] }`，**两边行数必须相等**。要讲到的四件事：

1. **「一个数就是一整块盘」** —— 64 个格子对应 64 个二进制位，`sq` 号格就是第 `sq` 位。`1n << BigInt(SQ)` 就是「把马放上去」。
2. **移位就是整块盘一起挪** —— `one << 17n` 的意思是「所有子同时往那个方向走一步」。这是位盘比一格一格循环快的全部原因。
3. **⚠ 移位不认识棋盘的边** —— 这是这道题的那一课。a 线上的马左移一下就落到 h 线去了，**而且不报任何错**。掩码（`NOT_A` 等四张）就是用来把跑过界的位抹掉的。**这一段要写得让她读完就想去删掉试试。**
4. **`b & (b - 1n)` 是「关掉最低的那个 1」** —— 用它逐个取出攻击格，比从 0 数到 63 快得多。

**英文以中文为底本重写，不是逐句对译。** 写不成等行数**停下来报告**。

- [ ] **Step 6: 跑一遍，确认它通过**

```bash
node chess/core/algos/bitboard.test.js
```

期望：全绿。**特别看那四条写死的锚点**（a1 的 `c2 b3`、h8/d4/a4 的个数）与**回绕反证**那一条。

- [ ] **Step 7: 突变验证 —— 掩码真的在承重吗**

把 `if (k === 0) { b = (one << 17n) & NOT_A; }` 里的 `& NOT_A` 删掉，跑：

```bash
node chess/core/algos/bitboard.test.js
```

**期望：至少有一格（h 线上的马）变红。** 若六十四格全绿，说明那张掩码没起作用 —— **停下来报告**。验完从 scratchpad 备份还原。

- [ ] **Step 8: 突变验证 —— 递归改成循环（期望仍然全绿）**

把 `addDir` 末尾的 `addDir(k + 1)` 删掉，改成在 `addDir(0);` 外面套 `for (let k = 0; k < 8; k = k + 1) { addDir(k); }`，跑测试。

**期望：仍然全绿。** 这不是失败 —— 要你**亲眼看到**：结果正确性测不出「递归还是循环」，而第三根轴（八层塔）完全依赖它。**这一条只能靠 Task 5 的浏览器验收守，报告里要写明。**（9c 的同一个缺口实测过一次，结论相同。）验完还原。

- [ ] **Step 9: Commit**

```bash
git status --short
git add chess/core/algos/bitboard.js chess/core/algos/bitboard.test.js
git commit -m "feat(chess): bitboard.js —— 第七道题的双语算法源码生成器"
git status --short
```

---

## Task 2：声明 `PROBLEMS.bitboard`

**Files:**
- Modify: `chess/tools/chess-board-algorithms.html`

**Interfaces:**
- Consumes: Task 1 的 `bitboard.js`
- Produces: 工具⑤ 的第七个 tab

- [ ] **Step 1: `GENERATED:ALGOS` 标记行加名字**

```bash
grep -n "GENERATED:ALGOS " chess/tools/chess-board-algorithms.html
```

在那一行末尾加 `,bitboard.js`。**不要手改下面那个块**（由 `inline_core.py` 生成）。

- [ ] **Step 2: 写声明**

照 `pathCount` 的形状（它是最近的一道，最干净）：

```js
    bitboard: {
      label: BB.tab, brand: BB.brand, tips: BB.tips,
      /* 滑杆选马站在哪一格。照 knightPath 的形状：fmt 收到的是拖拽中的
         实时值，原地夹回合法区间只用来出这一帧的显示文字。 */
      params: [{ key: 'sq', label: BB.paramSq, min: 0, max: 63, step: 1, value: 27,
                 fmt: function (v) {
                   return bbSqName(Math.max(0, Math.min(63, Math.round(v))));
                 } }],
      sources: ['bitboard.js'],
      /* 入口是**递归**那一个：addDir(k) 处理第 k 个方向、末尾调 addDir(k + 1)。
         于是调用深度 = 第几个方向，深度塔恰好八层 = 马的八个走法，第三根轴
         不需要任何额外声明 —— 跟 pathCount 的 fillLayer(d) 同构。 */
      entry: 'addDir',
      source: function (st, M, file, lang) {
        return M[file].source({ sq: Math.round(st.sq), lang: lang });
      },
      check: { result: true, boardOps: true, counters: [] },
      board: function () { return { files: 8, ranks: 8 }; },
      zLabel: { zh: '第几个方向（八个走法）', en: 'Direction index (of the eight)' },
      kinds: ['ok'],
      onMark: function (kind) {
        if (kind === 'ok') return { color: C_OK, label: BB.kOk };
        return null;
      },
      exportName: function (st) { return 'bitboard-' + bbSqName(Math.round(st.sq)) + '.js'; },
      readout: function (a, st) { /* Task 3 写 */ return ''; },
    },
```

并加一个方格名助手（**`kpSqName` 绑在 `KP_W` 上，不能直接用** —— 已核）：

```js
  /* 8×8 专用的格名。kpSqName 绑的是 KP_W（最短路那题的盘宽），这一题恒 8。 */
  function bbSqName(sq) {
    const f = sq % 8, r = (sq - f) / 8;
    return BR.fileLabel(f) + (r + 1);
  }
```

⚠ **两条要自己确认的**：

1. **马要不要 `place` 上去？** 规格说这套工具「摆的是真正的棋子」。若要摆，教学源码里得调 `place(SQ, "wN")`，而页面层有 `PIECE_CODE = { wN: 2, … }`（`:7394`，已核）负责把字符串换成数字 code。**但那会多一次宿主调用、也多一行源码** —— 自己判断值不值，并在报告里说明。**若决定摆，Task 1 的生成器要跟着改，那属于回头动上一个任务，先停下来报告。**
2. **`kinds` 只有 `'ok'` 一种够吗？** 这道题没有回溯、没有剪枝。图例只有一行是**信息**（跟 `knightPath` 少一行「回溯」是同一个道理）—— 但确认 `validateDecl` 不要求至少两种。

- [ ] **Step 3: 跑门**

```bash
python3 chess/scripts/check.py 2>&1 | tail -12
```

期望：exit 0；`ALGOS 往返校验` 从 9 变 **10**、`双语 algos 普查` 从 `9 份双语` 变 **`10 份双语`**。

- [ ] **Step 4: 数一遍「动了几处」**

```bash
git diff --stat
```

**期望**：只有 `chess/tools/chess-board-algorithms.html`（加上钩子带进来的内联镜像）。里面的改动应当是：标记行、`bbSqName`、`PROBLEMS.bitboard`（外加 `BB` 文案常量占位）。

**如果为了让这道题跑起来还得改渲染、tab、滑杆、图例、相机里的任何一处 —— 停下来报告。**

- [ ] **Step 5: Commit**

```bash
git status --short
git add chess/tools/chess-board-algorithms.html
git commit -m "feat(chess): 工具⑤ 第七道题 bitboard —— 加一个键 + 一份 algos + 标记行一个名字"
git status --short
```

---

## Task 3：BigInt 读数 —— **不许走 `fmtInt`**

这是规格 §4⑤⑤ 裁定的那条，也是本阶段唯一一处「付账」性质的改动。

**Files:**
- Modify: `chess/tools/chess-board-algorithms.html`

**Interfaces:**
- Consumes: Task 2 的声明骨架（`readout` 占位）
- Produces: 一个 BigInt 的十六进制格式化函数，供本题与将来任何 BigInt 结果用

- [ ] **Step 1: 先复现那个坑**

```bash
node -e '
function fmtInt(n){ if (n == null || typeof n !== "number" || !isFinite(n)) return "—";
  return (n<0?"−":"") + Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
console.log("fmtInt(3432) =", fmtInt(3432));
console.log("fmtInt(5n)   =", fmtInt(5n), "  ← BigInt 被当成「不知道」");
'
```

期望：`fmtInt(5n)` 打出 `—`。**把这段输出贴进报告** —— 它是这条改动存在的理由。

（已核：`fmtInt` 的第一行是 `if (n == null || typeof n !== 'number' || !isFinite(n)) return '—';`。）

- [ ] **Step 2: 写十六进制格式化**

在 `fmtInt` 旁边加：

```js
  /* 位盘（BigInt）的读数格式化。**不能走 fmtInt** —— 它的守卫是
     `typeof n !== 'number' → return '—'`，而 '—' 在这一页的规矩里
     是「不知道」。把一个算得好好的位盘印成「不知道」，跟 pathCount
     那条「0 不能被印成『—』」是同一类谎话（规格 §4⑤⑤）。

     用十六进制而不是十进制：一个 64 位位盘的十进制是 20 位数字、读不出
     结构；十六进制正好 16 个字符，**每 2 个字符是一整行棋盘**。 */
  function fmtBB(b) {
    if (typeof b !== 'bigint') return '—';
    let s = b.toString(16);
    while (s.length < 16) s = '0' + s;
    return '0x' + s;
  }
```

⚠ **自己验一次**：`fmtBB(0n)` 应当给 `0x0000000000000000`（**不是 `—`**）—— 一枚马**没有**攻击格是不可能的（最少 2 个），但 `0n` 仍是一个合法的位盘值，**「0 不是不知道」这条规矩在这里同样成立**。

- [ ] **Step 3: 写 `readout`**

照 `knightPath` / `pathCount` 的形状（**已核：`a.row(...)` 不存在，用 `dimt(...) + ' ' + bval(...)`**）：

```js
      readout: function (a, st) {
        const m = a.main, lines = [];
        if (!m) return '';
        /* 三种结局三种写法。⚠ 位盘走 fmtBB 不走 fmtInt（见 fmtBB 的注释）；
           攻击格数是普通数字，走 fmtInt。 */
        if (m.truncated || m.result === null || m.result === undefined) {
          lines.push(dimt(BB.roBoard) + ' ' + bval('—', C_DIM));
          lines.push(dimt(BB.roCount) + ' ' + bval('—', C_DIM));
        } else {
          let c = 0, t = m.result;
          while (t !== 0n) { t = t & (t - 1n); c = c + 1; }
          lines.push(dimt(BB.roBoard) + ' ' + bval(fmtBB(m.result), C_OK));
          lines.push(dimt(BB.roCount) + ' ' + bval(fmtInt(c), C_OK));
        }
        return lines.join('<br>');
      },
```

⚠ **`m.result` 真的是 BigInt 吗？** 自己在浏览器里验一次（`typeof`）。若它在中途被转成了别的类型（比如经过某个 JSON 序列化），**停下来报告** —— 那是比这个 readout 更根本的问题。

- [ ] **Step 4: 跑门 + 浏览器实测**

```bash
python3 chess/scripts/check.py 2>&1 | tail -8
```

浏览器里把滑杆拖到 **d4**，读数区应当出现一个 `0x…` 的十六进制串与 `8`；拖到 **a1**，个数变 `2`。**截图存证。**

- [ ] **Step 5: Commit**

```bash
git status --short
git add chess/tools/chess-board-algorithms.html
git commit -m "feat(chess): 位盘读数走 fmtBB —— BigInt 不能被 fmtInt 印成「不知道」"
git status --short
```

---

## Task 4：双语文案与 `tips`

**Files:**
- Modify: `chess/tools/chess-board-algorithms.html`

**Interfaces:**
- Consumes: Task 2/3 用到的 `BB.*` 键
- Produces: 无

- [ ] **Step 1: 写文案常量**

加一个 `BB` 文案对象，每条都是 `{zh, en}`：`tab` / `brand` / `paramSq` / `kOk` / `roBoard` / `roCount` / `tips`。

⚠ **图例标签显示宽度 ≤ 72**（CJK 算 2），`trackLabel()` 的 ≤ 26。

- [ ] **Step 2: `tips` —— 这道题的顿悟**

**`tips` 只讲一个顿悟并指向一个具体的开关**（全仓规矩）。这道题的顿悟是**移位不认识棋盘的边**，而它只有在她**亲手删掉掩码**之后才看得见。

必须写到的三样：

1. **「一个数就是一整块盘」** —— 读数区那个 `0x…` 十六进制串就是整块盘，16 个字符、每 2 个字符一行。
2. **⚠ 那个实验，要说到能照着做** —— 规格 §4⑤② 的原话是「`tips` 里必须点名到『删哪几行』而不是含糊的『删掉掩码』，她要能照着做」。所以：**把滑杆拖到 a 线上的某一格**（比如 a4），**删掉源码里 `& NOT_A` 与 `& NOT_AB` 那几处**，Run 一次，**看 h 线上冒出来的幽灵格**。
3. **按 `3` 切侧视** —— 塔八层 = 马的八个走法；而删掉掩码之后，**错落在具体某一层上**，一眼看出是哪个方向漏了。

- [ ] **Step 3: 跑门**

```bash
python3 chess/scripts/check.py 2>&1 | tail -6
```

- [ ] **Step 4: Commit**

```bash
git status --short
git add chess/tools/chess-board-algorithms.html
git commit -m "feat(chess): bitboard 的双语文案 —— tips 把「删哪几行」说到能照着做"
git status --short
```

---

## Task 5：浏览器验收

**这一条是 Task 1 Step 8 那个缺口唯一的守卫**（结果正确性测不出「递归还是循环」，而八层塔完全依赖它）。**不改任何代码。**

- [ ] **Step 1: 起预览**

`preview_start {name:"mathviz"}`，之后每次调用带**显式 `tabId`**。⚠ `document.hidden` 恒 true 那个坑见 Global Constraints。

- [ ] **Step 2: 逐条勾（每条截图或读数存证）**

1. **d4（滑杆 27）Run 完，盘上八个攻击格亮起**，读数写 `8` 与一个 `0x…` 串。
2. **⚠ 深度塔八层** —— 按 `3` 切侧视。**塔必须是八层，不是一层。** 若是平的，说明 `addDir` 被写成了循环 —— **这是本任务最重要的一条，报告里要点名**（调用栈面板若能看到 `addDir()` 逐层嵌套，那是更硬的证据，一并记）。
3. **a1（滑杆 0）只有两个攻击格**，且是 **c2 与 b3**。
4. **a4（滑杆 24）四个攻击格，全都在 b/c 线上** —— **h 线上一个都没有**。这一条就是掩码在干活的证据。
5. **亲手做一遍那个实验** —— 按 `tips` 说的把掩码删掉、Run，**确认 h 线上真的冒出幽灵格**；再按 `3` 看**错落在哪一层**。**做完把源码 Reset 回去。**
6. **切语言** —— 中英各看一次，图例、`tips`、读数两行都通顺。
7. **既有六道题没被误伤** —— 七个 tab 逐个 Run 一次，没有一处抛红色状态牌。

- [ ] **Step 3: 报告**

八条逐条「过 / 不过 / 未验 + 证据」。**不许写「应该没问题」。** 若某条因环境限制验不了，**如实写「未验 + 原因」**。

---

## Task 6：工具⑤ 定版 1.5.0 + 注册表

**Files:**
- Modify: `chess/tools/chess-board-algorithms.html`（**三处**）
- Modify: `chess/chess-tools.json`

- [ ] **Step 1: 三处版本号一起改**

⚠ **是三处，不是两处**（CLAUDE.md §10；9c 的计划漏过一次）：

```bash
grep -n 'tool-version' chess/tools/chess-board-algorithms.html      # meta
grep -n 'const VERSION' chess/tools/chess-board-algorithms.html     # 角标读的是它
grep -n '1\.4\.0' chess/tools/chess-board-algorithms.html | head    # 头部 changelog 块
```

三处都从 `1.4.0` 改成 `1.5.0`；头部 changelog 块**加一条 1.5.0**，**照既有几条的形状与深度写**（既有条目不只说「加了什么」，还说「为什么值得记」与「代价/边界在哪」）。

- [ ] **Step 2: `chess-tools.json`**

`version` → `1.5.0`；`changelog` 加一条；**`desc` 与 `tag` 都要补上第七道题**（双语，英文以中文为底本重写）。

⚠ **`tag` 在两份 FALLBACK 镜像里也有**（`chess/app.html`、`chess/index.html`）—— 9c 实测发现 `check.py` 的 FALLBACK 门**只抓 `id` 字段**，`tag` 无人看守、上次就漂了。**这次三处一起改，并自己 diff 一次确认逐字对齐**（别目测）。

- [ ] **Step 3: 根注册表要不要动**

⚠ 9c 复核过：根目录 `tools.json` / `app.html` / `index.html` **不带 chess 工具**（`index.html` 明写 chess 有自己的注册表）。**自己再核一次并在报告里写明你核过**，不许沿用结论。

- [ ] **Step 4: 跑全量门 + 角标实测**

```bash
python3 chess/scripts/check.py
python3 scripts/sync_registry.py --check
```

浏览器看右上角角标是 `v1.5.0`。**截图存证。**

- [ ] **Step 5: Commit**

```bash
git status --short
git add chess/tools/chess-board-algorithms.html chess/chess-tools.json chess/app.html chess/index.html
git commit -m "feat(chess): 工具⑤ 1.5.0 —— 第七道题 bitboard"
git status --short
```

---

## 收尾（每次派发都要核）

在**干净树**上跑：

```bash
git status --short          # 先确认是空的，下面的读数才作数
node chess/core/algos/bitboard.test.js
python3 chess/scripts/check.py
python3 scripts/sync_registry.py --check
```

期望：测试无 FAIL；`check.py` exit 0 且九道门各自那一行都在，其中 **`双语 algos 普查：10 份双语`**、**`ALGOS 往返校验：… 10 份算法源码`**。

开 PR 之后 `gh pr checks <PR#>`。**本地绿 ≠ CI 绿。** 不要自己合并，用户在对话里确认。
