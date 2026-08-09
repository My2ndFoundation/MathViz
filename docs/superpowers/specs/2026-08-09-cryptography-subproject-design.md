# Cryptography 子项目 · 第一期设计（脚手架 + Caesar）

- 日期：2026-08-09
- 分支：`claude/cryptography-scaffold`
- 上游规范：[`docs/superpowers/cryptography.md`](../cryptography.md) v2.1（架构由它决定，本文只写它没有决定的部分）
- 状态：已获用户确认，进入实现计划

---

## 0. 本文的定位

`docs/superpowers/cryptography.md` 已经把**架构**钉死了：目录布局、注册表隔离、
章节划分、i18n 键、生成区间模式、`inline_core.py` / `check.py` 的职责。那些不在
本文重复，本文只写三件规范没写的事：

1. **第一期交付到哪一步**（规范列了 25 个工具，那不是一个分支的量）；
2. **引擎怎么建**（规范说 `viz-engine.js` 负责 canvas/tabs/i18n/动画时钟，但没说
   它从哪来、2D 还是 3D）；
3. **"单独移走也能跑"这条约束如何被强制**（规范只说工具要 standalone，没说整个
   子目录要可搬迁）。

规范与本文冲突时以规范为准；规范沉默处以本文为准。

---

## 1. 第一期范围

**交付：完整脚手架 + 一个真工具（Caesar）。**

理由是负面的那种：只建脚手架而不建工具，等于交付一条**从未被跑通过的管线**。
`core → inline_core.py → tools/*.html → 注册表 → 画廊 → 导航壳 → 门`
这条链上每一处接口都要等第一个工具才会暴露问题，而那时脚手架已经被当成
"已完成"引用了。Caesar 是最便宜的真工具：算法三行，但它同样要走完
GENERATED 区间、注册表双向校验、双语文案、章节分组、版本三处同步。

**不交付**：Chapter 2–5 的任何工具；Chapter 1 的其余 12 个工具。它们按批次在
后续分支上加，每批一个 PR。

### 1.1 建，与不建

```
cryptography/
├── app.html                     ★ 建
├── index.html                   ★ 建
├── cryptography-tools.json      ★ 建（一条记录）
│
├── core/
│   ├── viz-engine.js            ★ 建（fork + 2D 图元层，见 §2）
│   ├── crypto-core.js           ★ 建
│   ├── interact.js              ★ 建（fork）
│   ├── animation.js             ★ 建
│   ├── cryptanalysis.js         ★ 建（Caesar 的破解页要用 χ²）
│   ├── quantum-sim.js           ✗ 不建 —— Chapter 5 才有消费者
│   └── algos/
│       ├── caesar.js            ★ 建
│       └── (其余 13 个)          ✗ 不建
│
├── examples/
│   ├── examples-classical.js    ★ 建
│   ├── examples.js              ★ 建（汇总器）
│   └── (analysis/modern/quantum) ✗ 不建
│
├── tools/
│   ├── _skeleton.html           ★ 建
│   ├── crypto-caesar.html       ★ 建
│   └── (其余 24 个)              ✗ 不建
│
└── scripts/
    ├── inline_core.py           ★ 建
    └── check.py                 ★ 建
```

**为什么不建空占位文件。** 规范 §13 列出的 `quantum-sim.js` 等文件，如果现在
建成空壳，`inline_core.py` 的 `SOURCES` 就得收录它们、`check.py` 就得为
"这个源文件是空的、没有任何页面引用它"专门开豁免。一条只为占位而存在的豁免
规则，比一个还不存在的文件更容易在半年后被误读成"这里本来就不检查"。
文件跟着它的第一个消费者一起出生。

`cryptanalysis.js` 是例外：Caesar 的第三页要把 26 个候选按英文字母频率排序，
那是货真价实的密码分析，写进工具页里就是规范 §13 明令禁止的重复。它现在
只需要 `letterFrequency` / `chiSquare` / `englishFitness` 三个函数。

---

## 2. 引擎：fork chess + 增补 2D 图元层

### 2.1 决策

`cryptography/core/viz-engine.js` 从 `chess/core/viz-engine.js` **复制**而来，
不是引用。子项目之间不共享代码文件——这是规范 §22"不共享 domain core"的直接
后果，也是"整个 cryptography/ 目录可以单独搬走"的前提。

改动：

- `LANG_KEY` 由 `'chess-lang'` 改为 `'cryptography-lang'`（规范 §12）；
- 引擎版本标识为 `crypto-1.0.0`。

保留（原样继承，已在 chess 上验证过）：轨道相机与球面参数、透视投影与近裁剪、
`strokePoly / line3 / glowDot / solidDot / label3 / arrowAt`、`drawAxes / drawGridXY`、
页签系统、PARAMS 滑杆与 toggles 的自动 UI、`RELABEL` 语言切换回调、
`resize` / 键盘绑定、`autoLoop` 开关。

### 2.2 为什么保留 3D

密码学工具的**大多数**是 2D：字母轮、字母网格、矩阵、比特块、频率柱、流程箭头。
但有三处 3D 不是装饰：

- Chapter 5 的 Bloch 球与光子偏振——量子态本来就住在球面上，压成 2D 就没了；
- Hill 密码的矩阵变换——线性映射在三维里才看得见"体积"；
- Caesar 自己的模 26 页（见 §4）——把 0…25 沿 z 轴抬成螺旋，"绕回去"变成
  肉眼可见的一整圈。

保留一套已验证的 3D 子系统，比将来临时补一套相机便宜。

### 2.3 新增：screen-space 2D 图元层

与相机无关的一组屏幕坐标图元，密码学专用：

| 图元 | 用途 |
|---|---|
| `alphabetWheel(cx, cy, r, letters, opts)` | 字母环（Caesar / Vigenère / 转子） |
| `cellGrid(x, y, cols, rows, cell, opts)` | 字母表格、矩阵、Playfair 方阵、S-box |
| `bitBlock(x, y, bits, opts)` | 比特/字节块（XOR、DES、AES、hash） |
| `barChart(x, y, w, h, values, opts)` | 频率分布、χ² 得分 |
| `flowArrow(from, to, opts)` | 轮函数、密钥流程 |
| `chip(x, y, text, opts)` | 单个字母/令牌方块 |

全部接受显式颜色参数（不内嵌调色板），数学符号一律 serif italic
（`--font-math`），与 Canvas / HTML 两侧一致（五条原则第 4 条）。

### 2.4 配色

沿用既有的五色轨迹变量，`cryptography/index.html` 与 `app.html` 各自在
`:root` 声明，Canvas 内复用同一批字面值：

```
--trace-cyan:#2dd4ea  --trace-rose:#fb7185  --trace-violet:#a78bfa
--trace-emerald:#34d399  --trace-orange:#fb923c
```

一条曲线 = 一种颜色，在六处复用（五条原则第 3 条）。

---

## 3. 注册表、导航壳、画廊

### 3.1 `cryptography-tools.json`

结构按规范 §9，分组字段是 `chapter`（不是 chess 的 `phase`）。第一期一条记录：

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
      "title":  { "en": "Caesar Cipher", "zh": "凯撒密码" },
      "desc":   { "en": "…", "zh": "…" },
      "tag":    { "en": "…", "zh": "…" },
      "version": "1.0.0",
      "engine": "crypto-1.0.0",
      "changelog": []
    }
  ]
}
```

### 3.2 `app.html`

从 `chess/app.html` fork。改动：

- 存储键 `cryptography-lang` / `cryptography-nav`（规范 §12）；
- 侧栏按 `tool.chapter` 分组，标签取自 `CHAPTER_LABELS`（五章，规范 §10）；
- 工具栏四项：语言 / 收起侧栏 / 独立打开 / 返回 MathViz；
- `tool == null` 时 iframe 载入 `index.html`（规范 §5）；
- iframe URL 形如 `tools/<file>?lang=<l>&v=<version>`，版本号即缓存键
  （根项目 CLAUDE.md 记录过 GitHub Pages 陈旧缓存吃掉已发布升级的事故）；
- 深链接 `?tool=<id>&lang=<l>`、浏览器前进/后退、侧栏开合状态持久化。

`app.html` 自己不是工具，不得出现在注册表里（规范 §4）。

### 3.3 `index.html`

从 `chess/index.html` fork。运行时优先 `fetch('cryptography-tools.json')`，
`file://` 下 fetch 必然失败，静默回落到页面内嵌的 `FALLBACK` 数组（规范 §11）。
卡片按 `chapter` 分组，与侧栏同源同序——不维护两套排序（规范 §10）。

`accent` 经白名单过滤后才拼进 `style="--c:var(--trace-<accent>)"`，
照抄 chess 版的 `safeAccent()`：属性值逃逸是这一处的真实风险。

### 3.4 语言

优先级：`?lang=` → `localStorage['cryptography-lang']` → **默认 en**
（规范 §12；与 chess 一致，与根 MathViz 的 zh 默认**不同**，这是有意的）。
壳 / 画廊 / 工具三层同源，靠 `storage` 事件同步。

---

## 4. Caesar 工具

`tools/crypto-caesar.html`，三个页签共享同一份 state（`plaintext`、位移 `k`）。
"同一个运动，不同的测量"——沿用根项目的页签哲学。

| 页签 | 画什么 | 顿悟 |
|---|---|---|
| **Wheel · 字母轮** | 两个同心字母环，外圈明文、内圈密文，内圈整体旋转 `k` | 这个密码**就是**一次旋转；`k=0` 与 `k=26` 是同一个轮子 |
| **Modulo · 模 26** | 0…25 沿 z 轴抬成螺旋，每个字母是一个点，`+k` 让它滑动 | "绕回去"是肉眼可见的**一整圈**——本工具的顿悟视角 |
| **Break · 穷举** | 26 个位移各一行，每行按 χ² 与英文字母频率打分，最优行发光 | 26 是个很小的数；弱点是**密钥空间**，不是算法 |

- `core/algos/caesar.js` 只定义 `encrypt()` / `decrypt()` / `bruteForce()`；
  怎么画轮子、怎么动画、怎么解释模 26，全在 HTML 里（规范 §14）。
- 页面双击可开、iframe 可载、离线可用、双语。
- 版本三处同步：注册表 `version`、HTML 的 `tool-version` meta、面板版本徽章
  （徽章读 meta，不单独维护）。

---

## 5. 校验门 `cryptography/scripts/check.py`

规范 §19 列出的检查项中，第一期有消费者的全部实现：

1. `inline_core.py --check`：生成区间与编辑源一致
2. 工具 HTML 内联脚本语法（`node --check`）
3. 注册表 ↔ `tools/*.html` **双向**存在性
4. `app.html` FALLBACK ↔ 注册表一致
5. `index.html` FALLBACK ↔ 注册表一致
6. 重复 `id` / 重复 `file`
7. `chapter ∈ {1,2,3,4,5}`
8. `accent ∈ {cyan, rose, violet, emerald, orange}`
9. 注册表 `version` == HTML `tool-version` meta；`engine` 非空
10. `kicker/title/desc/tag` 四项都同时有 `zh` 与 `en`
11. ALGOS 往返：内联进 HTML 的算法字符串能被执行，且与 `core/algos/` 源一致
12. Caesar 性质：对全部 `k ∈ [0,26)`，`decrypt(encrypt(p,k),k) == p`
13. `../` 出站引用唯一性（见 §6）

**推迟**：量子相关的四项（概率 ∈ [0,1]、态归一化、种子确定性、BB84 统计行为）
——它们随 Chapter 5 一起加。现在写等于校验一个不存在的模块。

**`node --check` 必须走 stdin。** 根 CLAUDE.md 记录了连续四次合并的 CI 假绿：
Linux 对**单个 argv 元素**有 `MAX_ARG_STRLEN` = 128 KiB 的上限（与 `ARG_MAX`
不是一回事），macOS 没有，于是 `node -e <225KB>` 在本机全绿、在 CI 全红而
没人看。`check.py` 的 `run_node()` 一律把脚本喂给 stdin，并且在**本机**就对
超大 argv 明确报错。

### 5.1 接线

- `.githooks/pre-commit`：新增 cryptography 段，触发条件
  `^cryptography/(core|examples|tools|scripts)/`，先跑
  `inline_core.py --print-changed` 并只 `git add` 它实际改写过的路径
  （绝不 `git add cryptography/tools/*.html`——根 CLAUDE.md「并行开工纪律」
  第 2 条记过这次事故），再跑 `check.py`。
- `.github/workflows/registry-sync.yml`：在 chess 那步之后新增
  `cryptography subproject gates`，跑 `python3 cryptography/scripts/check.py`。

---

## 6. 隔离与可搬迁

### 6.1 注册表隔离（规范 §8，硬边界）

根 `tools.json`、`scripts/sync_registry.py`、根 `app.html` **一个字节都不改**。
根仓库唯一的改动是 `index.html` 的 Subprojects 区新增一张 Cryptography 卡片。

卡片沿用 Chess 那条"壳里不能再套壳"的判断：

```javascript
document.getElementById('cryptoCard').href = IN_SHELL
  ? 'cryptography/index.html?lang=' + LANG
  : 'cryptography/app.html?lang=' + LANG;
```

### 6.2 可搬迁（用户约束，规范未覆盖）

**目标：把 `cryptography/` 整个目录复制到任何别处，双击 `app.html` 仍然完整可用。**

因此：

- `core/` 是 fork 而非引用，`cryptography/` 内没有任何指向 `../chess/` 或
  `../design-system/` 的运行时依赖；
- 零外部资源：不加载字体、CDN、图片；
- 唯一的出站引用是工具栏那颗"返回 MathViz"按钮，指向 `../index.html`。
  它**自愈**：在 http(s) 下对该 URL 发一次 `HEAD` 探测，失败就把按钮隐藏；
  `file://` 下无法探测，保持显示（`file://` 的使用者基本都在仓库里）。
- `check.py` 第 13 项断言：整个 `cryptography/` 子树里 `../` 出站引用**有且
  只有这一处**。这条断言是这个保证的执法者——没有它，第 N 个工具随手写一条
  `../outputs/foo.js` 就会悄悄毁掉可搬迁性，而没有任何东西会报警。

### 6.3 Claude Skill

`.claude/skills/crypto-viz-tool/SKILL.md`（仓库级，不放 `cryptography/.claude/`，
规范 §21）。必须写明作用域：产物 `cryptography/tools/`、注册表
`cryptography/cryptography-tools.json`、核心 `cryptography/core/`、校验
`cryptography/scripts/check.py`，以及那条硬规则：

> Never register a CryptoViz tool in `/tools.json`.

---

## 7. 验收

第一期在下列全部成立时算完成：

1. `python3 cryptography/scripts/inline_core.py --check` 退出码 0
2. `python3 cryptography/scripts/check.py` 退出码 0
3. `python3 scripts/sync_registry.py --check` 退出码 0（证明根注册表未被波及）
4. 浏览器里双击 `cryptography/tools/crypto-caesar.html`（`file://`）三个页签
   都能画、都能交互、中英切换生效
5. `cryptography/app.html` 侧栏按章节分组，深链接
   `?tool=crypto-caesar&lang=zh` 直达，前进/后退可用
6. 根 `index.html` 的 Cryptography 卡片在顶层打开时进 `app.html`、在主站壳的
   iframe 里打开时进 `index.html`
7. 把 `cryptography/` 复制到仓库外的临时目录，`app.html` 仍可用，
   "返回 MathViz" 按钮在 http(s) 下自动消失
8. `gh pr checks <PR#>` 读到绿 —— 不是本机绿（根 CLAUDE.md 记过四次假绿）

---

## 8. 后续批次（不在本分支）

Chapter 1 余下 12 个工具 → Chapter 2 机械密码 → Chapter 3 密码分析 →
Chapter 4 现代密码 → Chapter 5 量子时代（同时补 `quantum-sim.js` 与量子校验门）。
每批一个分支、一个 PR，合并由用户在对话里确认。
