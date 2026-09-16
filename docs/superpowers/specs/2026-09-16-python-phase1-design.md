# Python 子项目 · 第 1 期设计

> 状态：分节评审已通过，待用户审阅本文件后出实施计划。
> 日期：2026-09-16
>
> 上游：
> - 主规格 `docs/superpowers/specs/2026-09-16-python-subproject-design.md`（下称「主规格」）
> - 账本 `docs/superpowers/handoffs/2026-09-16-python-phase0-deferred.md`（下称「账本」）
> - 裁决 `docs/superpowers/handoffs/2026-09-16-python-phase0-rulings.md`（R1–R60）
> - 契约 `docs/superpowers/subproject-nav-contract.md`（v2.0）
>
> **与主规格冲突时以主规格为准，本文 §12.3 列出的几处除外**——那几处是本期有意改写的规则，
> 收尾时会回写进主规格。

---

## 0. 本期做什么

主规格 §9 的第 1 期：**M1 剩余四页 + M2 四页，共 8 页、96 个新程序**。连同 ch01 的 10 个，
全库 106 个，越过下限 100。

但内容页开工之前，先还账本 §一 的三件事，外加分节评审中发现、本期内容**一定会撞上**的几处缺口。
理由与账本 §一 相同：后面 8 页会把现状照抄 8 遍，现在修最便宜。

---

## 1. 决策记录

分节评审时逐条问过、由用户拍板的决定。

| # | 问题 | 决定 | 理由 |
|---|---|---|---|
| D1 | 地基 PR 的范围 | 账本 §一 三件 + 本期必撞的几项；账本其余条目不动 | 只修会被 8 页照抄或被本期内容触发的东西 |
| D2 | 挖空密度 | **每个程序 ≥ 1 个空**，加门；ch01 补空，py-basics 升 1.1.0 | ch01 十个程序里七个零挖空，挖空模式下整页无事可做且不说明 |
| D3 | 提示分级分隔符 | 换成唯一显式标记 ` \|\| ` | 本期约 500 条提示串；旧的三分隔符链让「；」「; 」不能当标点用。全库只有 3 条待迁移，现在最便宜 |
| D4 | 程序清单谁定 | 本文列出完整清单，用户审完再开工；构建者可上报替换建议，不擅自替换 | 8 页并行，相邻页主题天然重叠 |
| D5 | FALLBACK 带不带 `desc` | 只在 `index.html` 带 | 画廊是唯一显示简介的地方；离线与线上从此一致 |
| D6 | 铺开节奏 | 两波：M1 四页 → 复盘 → M2 四页 | 第 0 期实现者 18 次指出简报有错；第一波暴露的问题先修进简报模板 |
| D7 | 行注锚点能否落在挖空体内 | **解禁**，第二道防线改为结构门 | 「每程序 ≥ 1 空」之后，ch01 待补空的 7 个程序里有 5 个的行注恰好挂在最该挖的那一行 |
| D8 | 程序元数据展示 | 说明面板顶部显示 kind / level / boards / tags 等 | 用户在评审中提出：目前只在左侧列表显示 kind 与 level |

---

## 2. 开工前核实出的事实

按本仓「documented, believed, and false」的纪律逐条记下证据。

1. **accent 分配表早已存在**：主规格 §6.1 写着 `M1 cyan · M2 violet · M3 emerald · M4 rose ·
   M5 orange · M6 cyan · M7 violet · M8 emerald`，满足相邻异色、八个模块排满不撞色。账本 §一.3
   说它「要定下来」不准确；真正的缺口是**没有门强制注册表照这张表来**
   ——`accent_module_check()` 只查同模块同色、相邻异色。
2. **镜像值不止账本说的 350 个**：每个工具页 `TOOL` 块的 `id` / `accent` / `title`、以及
   `tool-engine` meta 与注册表 `engine`，全部无门。`TOOL.id` 全页**零读者**，只有一句注释说它
   「必须与 python-tools.json 里的 id 一致」。
3. **R19 写「CI 里 pin 一个版本」，没有落地**：`registry-sync.yml` 无 `setup-python`；CI 日志
   （run 35070993151）显示 `lex_vs_cpython_check 跑在 CPython 3.12.3 上`，那是 ubuntu-latest 的
   系统 Python；本机 3.12.9。
4. **挖空模式对零挖空程序无任何处理**：`interact.js` 的 `renderBlank()` 照常逐行渲染，没有输入框、
   没有说明。
5. **`KINDS` / `BOARDS` / `LEVELS` 是 `mount()` 里的局部变量**，与 `gates/library.py` 的闭集是
   一对无门的镜像；左侧列表把 `kind` 原样显示成英文枚举值。
6. **`_blank_body_lines()` 只有一个调用者**——正是 D7 要拆掉的那条判据。拆掉后它成为死代码，
   删掉它顺带消掉账本 §三.1 那句「宁可多圈几行也不要漏圈」的假话。
7. **property 比对是严格的**：`algorithm_property_check` 用 `got != want or type(got) is not
   type(want)`，所以参照实现的返回类型也必须一致。

---

## 3. 总体结构

```
PR-A  地基·机械   scripts / gates / CI —— 不碰 core、不碰内容             34 → 36 道门
PR-B  地基·规则   core 改动 · 挖空下限 · 锚点门 · ch01 补空 · 元数据面板 · 作者须知   36 → 39 道门
波 1  M1 四页     py-strings · py-functions · py-oop · py-files-errors
      └ 波间复盘：修订简报模板与作者须知；量 .git 增速
波 2  M2 四页     py-conditionals · py-loops · py-comprehensions · py-recursion
收尾  第 1 期账本 + 裁决记录 + 根 CLAUDE.md + 主规格回写
```

PR-A 与 PR-B **串行**：B 改 core、重生成 `py-basics.html`、迁移提示格式，A 完全不碰这些；
两边都要改 `check.py`，串行就不冲突。

门数只在本文里作为「计划时点的事实」出现；代码与散文里**不写死门数**（见 A6）。

---

## 4. PR-A · 地基·机械

### A1 · `python/scripts/sync_fallback.py`

**做法：GENERATED 区段整块重写，`json.dumps` 编码。** 否决过的两条路：就地改写手写 JS 字面量
（正则改带引号的正文太脆，加条目仍要手写）；只把门扩到全字段（门能报错，加页仍要手抄两份）。

- 两个导航页各包一个 `/* >>> GENERATED:FALLBACK */ … /* <<< GENERATED:FALLBACK */`，区段内是
  `var FALLBACK = [...];`。区段之外的 `var TOOLS = FALLBACK;` 不动。
- 输出字段（按注册表顺序逐条）：
  - `app.html`：`id / file / accent / module / version / kicker / title / tag`
  - `index.html`：上面全部 + `desc`
- 编码：`json.dumps(..., ensure_ascii=False, indent=2)`，然后**额外转义**
  U+2028 / U+2029（R41：不是语法错，但在旧引擎与工具链里当换行、肉眼不可见）与 `<`
  （写成 `\u003c`，防正文里出现 `</script>` 或 `<!--`）。
- 用法与根 `scripts/sync_registry.py` 同形：无参重写；`--check` 只查，不同步则退出 1 并点名页面。
- 接线：
  - `check.py` 的 `GATES` 加一项 `sync_fallback --check`（经 `_guard`）。
  - `.githooks/pre-commit` 的 python 段：暂存区命中 `python/python-tools.json` 或两个导航页时
    重新生成并重新暂存。**触发正则按 R53 拆成独立的顶层分支**（本机 ugrep 会静默漏匹配）。
  - CI 经 `check.py` 覆盖，无需单独加步骤。
- 现有两道门换测量方式：`fallback_check` / `fallback_version_check` 从正则改成
  **`json.loads` 解析区段、逐字段与注册表比对**。它们与 `--check` 的逐字节比对是
  **两次独立测量**：一个比字节，一个比语义。
- 删掉两页 FALLBACK 上方已成假话的注释（「tools/py-basics.html 还不存在」）。

| 负控制 | 期望 |
|---|---|
| 改 `app.html` 区段里 py-basics 的 `accent` | `sync_fallback --check` 红；`fallback_check` 红并点名字段 |
| 只改注册表的 `title`，不重新生成 | 两道都红；重新生成后两道都绿 |
| 临时注册表副本里放一条 desc，含 `</script>`、`<!--` 与 U+2028 | 输出文本里无裸 `<`、无裸 U+2028；node `vm` 求值后逐字节等于原文 |

### A2 · accent 表变成门

- `gates/__init__.py` 加 `MODULE_ACCENTS = {1:'cyan', 2:'violet', 3:'emerald', 4:'rose',
  5:'orange', 6:'cyan', 7:'violet', 8:'emerald'}`，注释引主规格 §6.1。
- `accent_module_check()` 改为断言**注册表 accent == `MODULE_ACCENTS[module]`**
  （它蕴含同模块同色），另加一条**对表本身的静态自检**：`MODULE_ACCENTS[n] != MODULE_ACCENTS[n+1]`，
  防止有人改表改出撞色。原「今天无事可做」的打印随之消失——这条断言从此在真实数据上执行。

| 负控制 | 期望 |
|---|---|
| 注册表里 py-basics 的 accent 改成 `violet` | 红，点名期望 `cyan` |
| 表里把 M6 改成 `orange`（与 M5 相同） | 红，点名 5/6 |

### A3 · 新门 `page_mirror_check`

对每个**已注册**的工具页：

- `TOOL.id == 注册表 id`、`TOOL.accent == accent`、`TOOL.title == title`（en / zh 都比）
- `<meta name="tool-engine">` == 注册表 `engine`
- 注册表里**所有工具的 `engine` 相同**，且等于 `_skeleton.html` 的 `tool-engine`
  （它们内联的是同一份 core；骨架不一致时，下一个复制它的新页会在这里当场红）

`TOOL` 块在 node `vm` 里求值取对象，**不用正则抠字段**。

| 负控制 | 期望 |
|---|---|
| 逐一改坏 `TOOL.id` / `TOOL.accent` / `TOOL.title.zh` / `tool-engine` meta | 四次都红，各自点名字段 |
| 骨架的 `tool-engine` 改成别的版本 | 红 |

### A4 · property 参考实现按章拆文件

8 个并行构建者都往 `properties.REFERENCES` 一个字典里加条目，堆叠分支变基时必然冲突。

- 新目录 `python/scripts/gates/refs/`，每章一个文件：`ch01_basics.py` ↔ `programs/ch01-basics/`
  （连字符换下划线）。每个文件导出 `REFERENCES`。
- `properties.py` 保留 `SAMPLES` / `SEED`，负责汇总各章文件；公共实参生成器放在
  `refs/_gen.py`，不放 `properties.py`——放这里是为了避免 refs 反向导入
  properties 形成循环（properties 已经要 `from .refs import load_references`）。
  它的文件头那段「举例子要举能被观察到的那一种」原样保留，这是本期构建者最需要读的
  一段。
- 硬错误：同一个 id 出现在两个章文件里；章文件对不上任何章目录；
  **某条参照所指的 id 在该章里不存在或没有 `check.property`**（悬空的参照是一道守着空气的门）。

| 负控制 | 期望 |
|---|---|
| 两个章文件放同一个 id | 红 |
| 新建 `refs/ch99_nothing.py` | 红 |
| 章文件里多一条指向不存在 id 的参照 | 红 |

### A5 · CI pin Python

`registry-sync.yml` 在第一道 Python 步骤之前加 `actions/setup-python@v5`，`python-version: '3.12'`。

本机无法做负控制。验证：该 PR 的 CI 日志里 `lex_vs_cpython_check 跑在 CPython 3.12.x 上` 的版本号
应由 3.12.3（系统 Python）变为 setup-python 安装的版本；**不变就说明 pin 没生效**。

### A6 · `check.py` 不再写死门数

- docstring 删去所有手写数字（「34 个返回码」「（7）」等），保留分组表格本身。
- `GATES` 每项加组标签 `(组, 名, 函数)`；运行结束时按组打印**自己数出来的**数目与总数。

负控制：临时加一道恒绿的假门 → 汇总行的组计数与总数随之变化，docstring 无处可漂。

---

## 5. PR-B · 地基·规则

### B1 · 提示分级标记改为 ` || `

- `core/interact.js`：`hintAt()` 只按 `' || '` 切。`；` 与 `; ` 回归普通标点。
- `gates/library.py`：`_hint_parts()` 同法；`blank_directive_check()` 增一条：出现 `||` 但不是
  「两侧各一个空格」的形状时报「疑似写错的分级标记」。
- `core/interact.test.js`：分级断言改写，并**新增**「正文含 `；` 的一级提示整条给出」。
- 迁移 ch01 现有 3 条提示（中英各一，共 6 串）。

| 负控制 | 期望 |
|---|---|
| **正控制**：`level=1` 的 hint 正文里写「；」 | 绿（改之前是红） |
| `level=2` 但没有 ` \|\| ` | 红 |
| 写成 `a\|\|b` | 红，报「疑似写错的分级标记」 |
| 只把 `interact.js` 改回旧分隔符链、门不动 | `interact.test.js` 红（core_tests 红） |

### B2 · 装饰器配色，按「一类」修

- `core/py-lex.js` 导出闭集 `TYPES`。
- `core/interact.js` 的样式表补 `.tok-decorator`（颜色与现有八种 token 色可辨，
  建议 rose 系如 `#fda4af`，由实现者对比 `--bg` 定）。
- 新测试：用一份覆盖全部语法结构的语料（含 `@property` / `@dataclass`、`a @ b`、f-string、
  软关键字）跑词法器，断言
  ① 每个吐出的 token 类型 ∈ `TYPES`；
  ② `TYPES` 的每一项要么在样式表里有 `.tok-<type>` 规则，要么在**显式的不上色名单**里
  （名单每项带一句理由，如 `ws` / `nl`）。

| 负控制 | 期望 |
|---|---|
| 删掉 `.tok-decorator` | 红 |
| 让词法器吐一个未登记的类型 | 红 |

### B3 · 新门 `blank_presence_check`

每个程序至少一个 BLANK，**无豁免**。报错点名程序 id 与文件。

负控制：删掉某程序唯一的挖空对 → 红并点名。

### B4 · ch01 补空，py-basics 1.1.0

- 零挖空的 7 个程序（`hello-name` `celsius-to-fahrenheit` `number-formatting`
  `max-of-three-builtin` `int-float-str` `swap-two-temp` `swap-two-tuple`）各补 1–3 个空，
  遵守 §6.2。受补空影响的讲解与行注同步修订。
- py-basics `1.0.0 → 1.1.0`：注册表 `version` + `changelog`、`tool-version` meta。
- core 在 B1 / B2 / B7 有改动：**全部工具与 `_skeleton.html` 的 `engine` 升到 `py-1.1.0`**
  （A3 的门强制它们一致）。
- 由一个构建子代理完成，经两轮评审（§8.3）。

### B5 · 作者须知 `.claude/skills/python-drill-tool/SKILL.md`

沿用主规格 §9.2 的名字。**在 B1–B4、B6、B7 落地之后写**，写下的是已经存在的规则。

规矩：每条硬约束注明**哪道门守、门报什么错**；没有门的规则明确标「靠人」。
`description` 写明不用于 `outputs/`、`chess/`、`cryptography/`。

大纲：

1. 范围与路径；作者碰什么、不碰什么（注册表与 FALLBACK 由中央登记 / 脚本生成）
2. 三种作业：新增一页（复制骨架、改 6 处、建章目录、refs 文件）· 已有页加程序 ·
   升级一页（版本三处、engine 何时升）
3. 源码规则（§6.1）
4. 挖空与提示（§6.2）
5. 锚点：整行原文、存在且唯一、`clean()` 后仍唯一；可以落在挖空体内（D7）
6. `run.expect` 必须是真实输出的粘贴，并给出生成命令
7. property（§6.3）
8. 变体组、元数据闭集、双语文案
9. 上报纪律（R28）与负控制纪律（§8.2 第 6 条）

### B6 · 锚点解禁 + 结构门 `line_note_reader_check`

- `anchor_check()` 删去「行注不许锚在挖空体内」一条；`_blank_body_lines()` 随之成为死代码，删除
  （顺带消掉账本 §三.1）。门的其余判据不变。
- 新门 `line_note_reader_check`：在 `core/*.js`（不含 `*.test.js`）里，**先剥注释**（R47），
  `.lineNotes` 或 `['lineNotes']` 形式的属性读取只允许出现在 `panelLineNotes` 与 `noteLineIndex`
  两个函数体内。i18n 键 `lineNotes:` 与 `t('lineNotes', …)` 不是属性读取，不算。
  - 这把「数据里不许这样写」换成「代码里只有两处能读」：第一道防线仍是 `panelLineNotes`
    的模式白名单（4 条单元测试），第二道从数据层移到了读取点。

| 负控制 | 期望 |
|---|---|
| 在 `renderBlank()` 里加一行读 `p.lineNotes` | 红，点名函数 |
| 同一句只写在注释里 | **绿**（R47：裸 grep 会误报） |
| 把一条 ch01 行注的锚放进挖空体 | 绿（D7 的正控制） |

### B7 · 说明面板顶部显示程序元数据

```
┌ 说明面板 ──────────────────────────────┐
│ 难度 L2 · 惯用模式 · 23 行 · 2 个空        │
│ 考试局   AQA  OCR  Edexcel  CIE           │
│ 标签     selection  if-elif-else          │
│ ─────────────────────────────────────── │
│ 标题 / 简介 / 讲解 / 行注（仅读模式）       │
└──────────────────────────────────────┘
```

- **字段**：难度（标作「难度 L2」，与提示分级区分）、类型、行数、空数、考试局、标签；
  `runtime` 仅在非 `cpython` 时显示；`pip install` 仍只在底栏。
  - 考试局为空显式写「未标注 / Not tagged」，不留空行。
  - 标签是英文标识符，等宽字体原样显示。
  - 空数由 `Exercise.parse` 数出，不另存。
- **三种模式都显示**：元数据不泄题。
- 模块级纯函数 `panelMeta(program, lang) → [{key, label, value}]`，`renderPanel()` 只负责渲染
  （与 `panelLineNotes` 同样的「决策可测」结构）。
- `kind` 与 `runtime` 做双语标签：语法 syntax · 惯用模式 pattern · 算法 algorithm ·
  项目 project · 嵌入式 embedded。**左侧列表改用同一套标签。**
- `LEVELS` / `KINDS` / `BOARDS` 提到模块级并导出，另加 `RUNTIMES`。
  新门 `closed_set_mirror_check`：在 `vm` 裸 context 里走浏览器分支取出这四个值，与
  `library.py` 的闭集比对。

| 负控制 | 期望 |
|---|---|
| 只在 `library.py` 的 `KINDS` 里加一个值 | 门红 |
| 删掉 `project` 的中文标签 | `interact.test.js` 红 |
| `panelMeta` 收到 `boards: []` | 测试断言显示「未标注」而不是空值 |

目测验收：`file://` 打开 py-basics，中英 × 三种模式 × 窄屏各截图。

---

## 6. 内容标准

### 6.1 程序

- 一行模块 docstring · 一个或多个入口函数 · `if __name__ == "__main__":` 演示块。
- 输出确定：**不用 `random`、不读时间**；写文件只写当前目录（门在全新临时目录里跑）；
  数据文件放 `_fixtures/`；需要输入时用 `run.stdin`。
- 整个程序约 10–40 行（不含 BLANK 指令行；这是取向，不是门）。本期**不用 `chunks`**（账本 §二「第一个带 chunks 的程序」触发条件保持未触发）。
- 源码纯 ASCII（BLANK 指令行的 `hint=` 除外）、无非 BMP 字符、4 空格缩进、LF、行尾无空白、英文注释。
- `kind` / `level` 的一般取向：`syntax` L1–L2 · `pattern` L2–L3 · `algorithm` L3–L4。由构建者定，评审核对。
- `boards`：只有**确知**某考纲不含该内容时才去掉；拿不准的上报，不猜。

### 6.2 挖空与提示

- 每个程序 ≥ 1 个空，一般 2–3 个；挖整行。
- **只挖写法唯一的行。** 判定严格比较引号风格、数字写法、相对缩进；一行若有同样好的另一种写法，
  使用者写出更好的答案会被判错（R27 的 divmod 那次）。
- 提示分级用 ` || `，段数 == `level`（1–3）；**逐级更具体，任何一级都不许给出答案原文**（靠人）。
- `hint` 中文、`hintEn` 英文，两种语言对等。

### 6.3 property 检查

- 只在参照来得自然处加：纯函数、返回值可比。**不强求**。
- 参照按程序 id 逐条写进 `gates/refs/chNN_*.py`；**机制必须与被测程序不同**；返回类型一致。
- 文件头或注释里举例说明「它守什么」时，**举的变异必须先跑一遍、真让门变红**。
- 慢的程序（如朴素递归）在 `cases` 生成器里收紧实参范围，并注明理由。

### 6.4 变体组

每页至少一个变体组；组内标题互不相同；变体之间差别要能**看出来**（并排对照时差异行有底色）。

### 6.5 页面边界

一个知识点只在一页**讲**；其他页可以**用**，但讲解与行注不展开。

| 知识点 | 归属 |
|---|---|
| f-string 格式说明符 | py-basics（已有） |
| `enumerate` `zip` `map` `filter` `any` `all` `sorted(key=)` | py-comprehensions |
| `try` / `except` / `raise` | py-files-errors（py-oop 里的 `raise` 只作预告） |
| 标志位、`for…else`、双指针 | py-loops |
| 递归 | 只在 py-recursion |
| 列表/字典作为数据结构（增删改查、拷贝陷阱）；查找、排序算法 | M3 / M4（本期只当容器用） |
| 带持久化的银行系统 | M5 py-systems（py-oop 只做最小的类） |
| 自己写过的问题 | 不跨页重复：三数取大、交换、数元音已在 ch01 |

---

## 7. 程序清单

「组」= `problem` 变体组；「P」列写参照实现（空 = 无 property 检查）。
「教什么」是这个程序存在的理由，构建者不得偏离；觉得有更经典的替换，**上报，不擅自换**。

### 7.1 py-strings · `ch02-strings` · M1 · 12

| id | 组 | 教什么 | P |
|---|---|---|---|
| `index-and-slice` | | 正负索引、切片三参数；越界切片不报错而越界索引报 IndexError | |
| `strings-are-immutable` | | 给 `s[0]` 赋值抛 TypeError；用切片与 `replace` 造新串 | |
| `string-method-tour` | | strip / lower / upper / title / startswith / endswith / find 与 index 之别 / replace / count / isdigit / isalpha | |
| `split-and-join` | | `split()` 与 `split(',')` 之别、`maxsplit`、`join` 的调用方向、倒转词序 | |
| `escapes-and-raw-strings` | | `\n` `\t` `\\` `\"`、`r""`、`repr()` 看转义、`len` 数的是转义后的字符 | |
| `reverse-string-slice` | reverse-string | `s[::-1]` | `''.join(reversed(s))` |
| `reverse-string-loop` | reverse-string | 逐字符前插累加 | `''.join(reversed(s))` |
| `palindrome-cleaned` | | 循环 + `isalnum` / `lower` 规整后与切片反转比较 | 规整后下标镜像比较 |
| `caesar-shift` | | `ord` / `chr` / `% 26`，保留大小写与非字母 | `str.maketrans` + `translate` |
| `binary-to-denary-loop` | binary-to-denary | 从左到右 `value = value * 2 + bit` | `int(s, 2)` |
| `binary-to-denary-builtin` | binary-to-denary | `int(s, 2)` 与 `bin()` 反向 | 按位权求和 |
| `password-rules` | | 标志位逐条检查，返回未通过的规则列表 | 每条规则一个 `re.search` |

### 7.2 py-functions · `ch03-functions` · M1 · 12

| id | 组 | 教什么 | P |
|---|---|---|---|
| `define-call-return` | | 形参与实参；`return` 与 `print` 之别；没有 return 得到 None | |
| `positional-keyword-default` | | 默认值、关键字实参、位置实参必须在前 | |
| `mutable-default-trap` | append-to-list | 默认值 `[]` 跨调用共享——输出里亲眼看它累积 | |
| `mutable-default-none` | append-to-list | `None` 哨兵修法 | |
| `args-and-kwargs` | | `*args` / `**kwargs`；调用处 `*` / `**` 解包 | |
| `return-several-values` | | 返回元组并解包：最小、最大、均值 | 排序取两端 + `statistics.fmean` |
| `local-and-global-scope` | | 局部遮蔽、`global`、UnboundLocalError（捕获并打印） | |
| `functions-as-values` | | 函数当实参、返回函数（闭包）、`lambda` | |
| `docstrings-and-type-hints` | | 文档串、`__doc__`、注解；注解不强制 | |
| `is-prime-trial-division` | | 提前 return；只试到 `math.isqrt(n)` | 埃氏筛 |
| `readings-report` | | 自顶向下分解：解析 / 汇总 / 格式化三个函数 + `main()` | |
| `mutate-vs-return` | | 实参传的是对象引用：原地改列表 vs 返回新列表 | |

### 7.3 py-oop · `ch04-oop` · M1 · 12

| id | 组 | 教什么 | P |
|---|---|---|---|
| `class-and-instance` | | 类、`__init__`、`self`、实例各自独立 | |
| `str-and-repr` | | `__str__` 给人看、`__repr__` 给开发者看；容器里显示 repr | |
| `class-vs-instance-attributes` | | 类属性计数器；可变类属性被所有实例共享的陷阱 | |
| `bank-account-encapsulation` | | `_balance` 约定、`@property` 只读、存取款校验 | |
| `inheritance-and-super` | | 基类/子类、覆盖、`super().__init__` | |
| `polymorphism-and-duck-typing` | | 同一调用不同行为；不继承也能鸭子类型 | |
| `composition-has-a` | | has-a 与 is-a；委托 | |
| `point-plain-class` | point-class | 手写 `__init__` / `__repr__` / `__eq__` | |
| `point-dataclass` | point-class | `@dataclass` 生成同样三件 | |
| `operator-overloading-vector` | | `__add__` `__mul__` `__eq__` `__abs__` | |
| `staticmethod-classmethod` | | `@classmethod` 备用构造器、`@staticmethod` 校验辅助 | |
| `abstract-base-class` | | `ABC`、`@abstractmethod`；实例化抽象类抛 TypeError | |

本页不设 property：程序以类为主，实参不是可随机生成的简单值；由 `program_run_check` 比对输出。

### 7.4 py-files-errors · `ch05-files-errors` · M1 · 12

| id | 组 | 教什么 | P |
|---|---|---|---|
| `write-and-read-text` | | `with open`、写、`read` / `readlines` / 逐行迭代、`'a'` 追加、去行尾换行 | |
| `read-csv-split` | read-csv | 手工 `split(',')`；讲解说明带引号的逗号为何会坏 | |
| `read-csv-module` | read-csv | `csv.reader`；同一份 `_fixtures/scores.csv` 同一输出 | |
| `write-csv-dictwriter` | | `DictWriter` / `DictReader`、`newline=''` | |
| `try-except-else-finally` | | 四个子句的执行顺序（打印出来） | |
| `multiple-except-clauses` | | 具体异常在前、`as e`；ValueError / ZeroDivisionError / TypeError | |
| `raise-for-invalid-input` | | 函数里 `raise ValueError(...)`，调用方处理 | |
| `custom-exception-class` | | 自定义异常类、带属性、异常层次 | |
| `missing-file-eafp` | missing-file | `try` / `except FileNotFoundError` | |
| `missing-file-lbyl` | missing-file | `pathlib.Path.exists()` 先看再做 | |
| `input-validation-loop` | | `while True` + `int(input())` + 范围检查；stdin 喂坏输入 | |
| `imports-and-main-guard` | | `import` 的三种写法；`__name__` 与 `__main__` | |

本页不设 property：读写文件的程序实参不是简单值。

### 7.5 py-conditionals · `ch06-conditionals` · M2 · 12

| id | 组 | 教什么 | P |
|---|---|---|---|
| `truthiness` | | 各类值的真假；`if items:`；`'0'` 与 `' '` 为真 | |
| `short-circuit-and-ternary` | | `and` / `or` 返回操作数；短路做守卫；条件表达式 | |
| `grade-boundaries-descending` | grade-boundaries | `elif` 链从高到低，正确性**依赖书写顺序** | `bisect` 查表 |
| `grade-boundaries-ranges` | grade-boundaries | 链式比较 `70 <= m < 80`，**与顺序无关** | `bisect` 查表 |
| `leap-year-nested` | leap-year | 嵌套 if | `calendar.isleap` |
| `leap-year-one-expression` | leap-year | 一个布尔表达式 | `calendar.isleap` |
| `ticket-price-nested` | ticket-price | 嵌套条件 | refs 里另写的查表实现 |
| `ticket-price-guard-clauses` | ticket-price | 守卫子句提前 return，扁平 | refs 里另写的查表实现 |
| `rps-winner` | | 取模判胜负 | 9 种结果的字典 |
| `triangle-classifier` | | 三角不等式守卫 + 等边 / 等腰 / 不等边 | 排序后判不等式 + `len(set(...))` |
| `de-morgan-truth-table` | | 打印真值表验证德摩根律（AQA 布尔逻辑） | |
| `match-case-commands` | | 结构模式匹配解析简单命令（顺带验证软关键字高亮） | |

### 7.6 py-loops · `ch07-loops` · M2 · 12

| id | 组 | 教什么 | P |
|---|---|---|---|
| `range-forms` | | 一 / 二 / 三参数、负步长、`range` 惰性、`len(range)` | |
| `sentinel-running-total` | | `while` + 哨兵，从 stdin 读到 `done`，累加、计数、求均值 | |
| `break-and-continue` | | 跳过空行与注释、遇 `END` 停 | |
| `find-max-and-index` | | 极值初值取第一个元素而不是 0；同时记下标 | `(max(xs), xs.index(max(xs)))` |
| `has-negative-flag` | has-negative | 标志位 | `any(x < 0 for x in xs)` |
| `has-negative-for-else` | has-negative | `for…else` 与 `break` | `any(x < 0 for x in xs)` |
| `digit-sum-modulo` | digit-sum | `% 10` 与 `//= 10` | 逐位字符求和 |
| `digit-sum-string` | digit-sum | 转字符串逐位 | refs 里的取模循环 |
| `pair-sum-nested-loops` | pair-sum | O(n²) 两重循环 | 集合查补数 |
| `pair-sum-two-pointers` | pair-sum | 有序数组双指针 O(n) | 集合查补数 |
| `guess-number-attempts` | | 次数上限 + `while…else`；stdin 喂猜测 | |
| `fizzbuzz` | | 条件顺序：15 必须先判 | `(n%3==0, n%5==0)` 元组查表 |

### 7.7 py-comprehensions · `ch08-comprehensions` · M2 · 12

| id | 组 | 教什么 | P |
|---|---|---|---|
| `squares-append-loop` | squares | `append` 循环 | `list(map(lambda x: x * x, xs))` |
| `squares-comprehension` | squares | 列表推导式 | `list(map(lambda x: x * x, xs))` |
| `evens-comprehension` | keep-evens | 推导式 + `if` | refs 里的普通循环 |
| `evens-filter` | keep-evens | `filter` + `lambda` | refs 里的普通循环 |
| `enumerate-and-zip` | | `enumerate(start=1)` 取代 `range(len())`；`zip` 并行遍历、`dict(zip())` | |
| `dict-and-set-comprehensions` | | 反转字典、词长表、集合推导去重 | 循环建字典 |
| `flatten-and-transpose` | | 嵌套推导：展平与转置 | `itertools.chain.from_iterable` / `zip(*m)` |
| `generator-sum-any-all` | | 生成器表达式不建列表；`sum` / `any` / `all` | refs 里的显式循环 |
| `map-split-input` | | `map(int, input().split())` 读一行整数 | |
| `sorted-min-max-with-key` | | `key=`、元组多关键字、排序稳定性 | refs 里手写的插入排序 |
| `if-placement-in-comprehension` | | `[a if c else b for …]`（改写每项）vs `[x for … if c]`（筛掉项） | refs 里的显式循环 |
| `comprehension-or-loop` | | 何时推导式反而难读：带副作用、三层嵌套 | |

### 7.8 py-recursion · `ch09-recursion` · M2 · 12

| id | 组 | 教什么 | P |
|---|---|---|---|
| `factorial-recursive` | factorial | 基例与递归步 | `math.factorial` |
| `factorial-iterative` | factorial | 同一问题的循环写法 | `math.factorial` |
| `fibonacci-naive` | fibonacci | 照定义递归；打印调用次数 | 快速倍增法；实参 n ≤ 18 |
| `fibonacci-memo-dict` | fibonacci | 手写字典记忆化 | 快速倍增法 |
| `fibonacci-lru-cache` | fibonacci | `@functools.lru_cache` | 快速倍增法 |
| `fibonacci-iterative` | fibonacci | 两个变量滚动 | 快速倍增法 |
| `call-stack-unwinding` | | 按深度缩进打印进栈 / 出栈；RecursionError | |
| `power-linear` | power | `x * power(x, n - 1)`，n 次调用 | `pow` |
| `power-by-squaring` | power | 折半，log n 次调用 | `pow` |
| `towers-of-hanoi` | | 返回移动序列 | 迭代版汉诺塔；n ≤ 8 |
| `permutations-recursive` | | 取一个、递归排剩下的 | `itertools.permutations`（输出顺序约定由构建者实测后写进报告） |
| `flatten-nested` | | 任意深度嵌套列表，`isinstance` 判断 | 显式栈 |

### 7.9 合计

| | 程序 | 变体组 | 带 P |
|---|---|---|---|
| M1 四页 | 48 | 6 | 9 |
| M2 四页 | 48 | 11 | 36 |
| **本期** | **96** | **17** | **45** |
| 全库（含 ch01） | 106 | | |

---

## 8. 构建协议

### 8.1 职责边界（每页一个构建子代理，`isolation: "worktree"`，opus）

- **负责**：`programs/chNN-<slug>/`（`.py`、`chapter.json`、`_fixtures/`）、
  `gates/refs/chNN_<slug>.py`、从骨架复制的工具页（改 6 处）。在自己的 worktree 里**按显式路径提交**。
- **不碰**：`python-tools.json`、两个导航页、`core/`、`gates/` 的门逻辑。
  注册表文案（`desc` / `tag` / `changelog` 中英）写进报告，由控制方集中登记并跑 `sync_fallback.py`。

### 8.2 简报必含条款

1. 开工第一步 `git merge --ff-only <基线分支>`，报告实测 `merge-base`（R8：worktree 基线不保证是派发时的 HEAD）。
2. 所有命令用绝对路径或 `git -C`。
3. 临时文件放 scratchpad，**文件名前缀为页名**（根 CLAUDE.md 并行纪律第 4 条）。
4. 读 `.claude/skills/python-drill-tool/SKILL.md` 与本文 §6、§7 对应小节。
5. **「我的做法与简报不一致、而我的做法更对」本身就是上报项。**（R28）
6. 报告「门变红」时附上变红那一行错误输出，并说明是**断言失败**还是**脚本崩溃**——
   「红得没有理由」与有效的负控制长得一模一样。
7. 测试或简报里的断言若事实上错了，停下上报，**不要改测试去迁就实现**。

### 8.3 报告与评审

构建者报告必须包含：

- 每个 P 程序实际跑过的一个变异，以及门在哪组实参上变红
- 每个 `run.expect` 的生成命令
- 偏离清单、简报错误、拿不准的 `boards`
- 注册表文案草稿

每页两轮评审：

1. **对规格**（sonnet）：清单一致、页面边界、每程序 ≥ 1 空、变体组、元数据闭集。
2. **对内容**（opus）：挖的行写法是否唯一；提示逐级更具体且不给答案；中英讲解准确且对等；
   A-level 学生读得懂。

评审包的 BASE 一律用 `git merge-base` 实测（R44）。

### 8.4 控制方亲自做的验证（不转述子代理结论）

1. 全量验收命令重跑（§10）。
2. 每页至少抽一个 P 程序，自己变异、看到门红，**从内存原字节恢复**，并带基线（先绿）。
3. `file://` 打开，**显式 `tabId`**，探针断言 `TOOL.id`：
   - 三种模式 × 中英；元数据面板；
   - 临摹模式在三种缩放下三层不错位（主规格 §9.1 第 6 条，靠看）。
4. 随机抽 3 个程序，从页面取出三种模式各自的复制内容，`python3` 真跑。这是「粘进 PyCharm」的
   机械等价；**真在 PyCharm 里跑（主规格 §9.1 第 5 条）由用户完成**，控制方不代为声称。
5. 开 PR 后实际读 `gh pr checks`。

---

## 9. 分支、合并与波间复盘

| 阶段 | 分支 |
|---|---|
| 本规格与实施计划 | `claude/python-phase1-design`，随 PR-A 提交 |
| PR-A | 同上分支 |
| PR-B | PR-A 合并后从 main 切 |
| 波 1 | `claude/py-strings` → `claude/py-functions` → `claude/py-oop` → `claude/py-files-errors`，依次堆叠 |
| 波 2 | `claude/py-conditionals` → `claude/py-loops` → `claude/py-comprehensions` → `claude/py-recursion`，依次堆叠 |

- 同一波的四个构建者并行；控制方按上表顺序逐个集成进堆叠分支。注册表条目按模块内顺序追加，
  FALLBACK 由脚本重新生成，不手工解冲突。
- 所有 PR 以 main 为基底，合并顺序写进 PR 描述。
- **每个 PR 等用户在对话里说合并才动手**；合并前读 `gh pr checks`。合并后 `pull --ff-only`，
  删本地与远程分支。

**波间复盘**（波 1 全部合并后、波 2 派发前）：

- 汇总构建者与评审员指出的简报错误，修订简报模板与作者须知。
- 波 1 前后各跑一次 `git count-objects -vH`，记下增速（账本 §五）。

---

## 10. 验收

每个 PR：

```bash
python3 python/scripts/check.py
python3 scripts/check_nav_contract.py
python3 scripts/sync_registry.py --check
python3 scripts/apply_branding.py --check
python3 scripts/apply_footer.py --check
python3 chess/scripts/check.py
python3 cryptography/scripts/check.py
python3 python/scripts/inline_core.py --check
python3 python/scripts/build_programs.py --check
python3 python/scripts/sync_fallback.py --check      # PR-A 起
for f in python/core/*.test.js; do node "$f"; done
```

外加：

- 本 PR 新增或改动的每道门都当场做过负控制、见过红（§4、§5 的表）。
- §8.4 的浏览器与复制运行验证（内容 PR、PR-B）。
- `gh pr checks <PR#>` 实读；PR-A 另核 CI 日志里的 Python 版本（A5）。

本期结束时：全库 ≥ 100 个程序；8 个新页面都在两个导航页出现（线上与 `file://` 各看一次）。

---

## 11. 本期不做（留在账本）

| 条目 | 为什么不做 |
|---|---|
| `chunks` 相关（账本 §二） | 本期不用 chunks，触发条件未满足 |
| `SCHEMA_VERSION` 迁移分支（账本 §二） | 本期不升 schema |
| chess `check.py` 门数门、三个子项目畸形注册表 traceback（账本 §四 仓级） | 不在 python 子项目内；本期 A6 只修 python 自己 |
| 账本 §三.2 / §三.3 | 不影响本期内容；§三.1 随 B6 顺带消掉 |
| 账本 §四 其余 minor | `.tok-decorator` 与 `hintAt` 两条已由 B1 / B2 处理；其余不被本期触发 |
| 按模式拆 core 区段减体积（R49） | 只测量（§9 波间复盘），不动 |

---

## 12. 收尾

### 12.1 文档

- `docs/superpowers/handoffs/YYYY-MM-DD-python-phase1-deferred.md`：本期账本，格式照第 0 期；文件名日期取收尾当天。
- `docs/superpowers/handoffs/YYYY-MM-DD-python-phase1-rulings.md`：本期裁决记录，格式照第 0 期；日期同上。

### 12.2 根 `CLAUDE.md` 的 python 段

写入：第三个生成脚本 `sync_fallback.py`、提示标记 ` || `、每程序 ≥ 1 空、锚点规则变化、
作者须知的位置。**不写门数。**

### 12.3 主规格回写

本期有意改写、收尾时回写进主规格的规则（改写处注明出自本文）：

| 主规格位置 | 改为 |
|---|---|
| §2.3 锚点 | 行注锚点可以落在挖空体内；泄题由读取点结构门防（B6） |
| §3.1 / §3.3 面板与提示 | 面板顶部显示元数据（B7）；提示分级标记为 ` \|\| `（B1） |
| §4.7 编辑模型 | 第三个生成脚本 `sync_fallback.py`（A1） |
| §7.1 门表 | 新增五道门：`sync_fallback --check` · `page_mirror_check` · `blank_presence_check` · `line_note_reader_check` · `closed_set_mirror_check` |
