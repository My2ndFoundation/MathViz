# Python Subproject Architecture

## MathViz · Python / Python 编程练习子项目架构

这份文档讲 `python/` **现在是怎么搭起来的、为什么这样搭**。它与另外几份文件分工如下，内容不重复：

| 文件 | 管什么 |
|---|---|
| `docs/superpowers/specs/2026-09-16-python-subproject-design.md`（下称**主规格**） | 设计与裁决的原文；本文按节号指过去，不逐节抄 |
| `docs/superpowers/prompts/python-handoff.md`（交接文档） | 带数字的快照表与重算命令（§1.1，本文不抄数字）、容易绊人的 API 签名、已知坑、「怎么把每道门弄红」、各期裁决入口、仍由人做的验收 |
| `.claude/skills/python-drill-tool/SKILL.md` | 作者须知：怎么写一个程序、挖一个空、加一页、升一页 |
| `.claude/skills/python-content-wave/SKILL.md` | 控制方作业：一波页面从清单到合并 |
| `docs/superpowers/subproject-nav-contract.md` | 三个子项目六个导航页的契约（v2.1，九条） |

**行号基准。** 本文所有 `文件:行` 引用以提交 `e342ba2`（#201 合并后的 `main`）为准；
文件改动之后行号会漂，以函数名为准去找。

**数字不写进这份文档。** 页数、程序数、行数、门数、core 断言数、engine 版本、运行层分布、property / chunks / fixture 的条数、
`boards` 的现状——这些会随每一波内容变化的数字，只在交接文档 §1.1 的「快照 · 写于 e342ba2」表里出现一次，附重算命令（编号 ①–⑥，
在交接文档里唯一）。本文正文只写结构与规则；需要数字时去那张表，或直接跑那几条命令。
门在本地缺库时的跳过数随机器而变，严格模式的含义见 §11.3。

---

## 1. 定位

`python/` 是 MathViz 的第三个独立子项目，与 `chess/`、`cryptography/` 平级（根 `CLAUDE.md`
「Subprojects」一节）。使用者是**一名**在读 A-level Computer Science 的学生；目标是把 Python 3
的语法与经典算法的标准写法练成肌肉记忆。考试局只是每个程序上的标签，不是内容边界（主规格 §0）。

### 1.1 三种模式

| 模式 | 做什么 |
|---|---|
| 读 | 带行号与语法高亮的只读程序；逐行讲解（`lineNotes`）；同一问题的多个写法可以并排对照 |
| 挖空 | 程序里挖掉若干整行，逐空填写、逐空判定、分级提示 |
| 影子临摹 | 标准程序垫在底层（透明度可调到全透明 = 盲打），她在上面逐字符照打；长程序可以分段 |

三种模式外加一件贯穿的事：一键复制。复制出去的永远是**纯源码**——`pip install …` 那一行显示在按钮旁边、
不进剪贴板，因为她复制完是要直接粘进 PyCharm 跑的（`core/interact.js` 文件头；`copyPayload` / `requirementLine`）。

### 1.2 没有运行时，以及它的连锁后果

**浏览器里不执行 Python。** 没有 Pyodide、没有解释器、没有 canvas 动画（主规格 §1.2 第 4 条、§10）。
这不是退让而是定位，它直接决定了整套架构的形状：

1. **判定只能比写法。** 她填的答案与标准答案逐 token 比对（§8），不跑、不比输出。
   Python 的「同一件事几种写法」不靠放宽判定来容纳，而是在题库层面给同一问题配多个**变体程序**（§4.3）。
2. **程序的正确性在构建期由 CPython 裁定。** 程序是磁盘上真的 `.py` 文件，门在 CI 上真跑它、
   逐字节比对 stdout 与 `run.expect`，对算法类再用一个机制不同的参照实现做 200 组随机比对（§11.2）。
   这是把「我挑的程序对不对」从作者说了算变成 CPython 说了算——也是程序必须是真文件、不能嵌在 JS 字符串里的决定性理由（主规格 §5.1）。
3. **第三方库不成问题。** numpy / pandas / matplotlib / pygame / MicroPython 本来就跑不进浏览器；
   她要练的正是把这些 API 一字不差地敲出来。门里要真跑的那几层才需要装库（§4.4）。
4. **页面从不显示程序的输出。** `run.expect` **只给门用**，任何模式都不渲染它。
   这是用户的定论（第 1 期波 1 终审提出，此后各期照此执行，第 5 期由用户确认为定论）。
   连锁到写作规则上：讲解与提示不能说「看输出」；挖空行里的字面量文字若只能从输出得知，
   就必须在最后一级提示里给出（主规格 §3.3；`python-drill-tool`「硬规矩与守门」）。这条**没有门**，只能靠作者与终审。

---

## 2. 目录结构与生成物

```text
python/
├── app.html                 导航壳（侧栏 + iframe）
├── index.html               画廊
├── python-tools.json        注册表（编辑源；programs / lines 两个字段由脚本回写）
├── core/                    七个 UMD 模块 + 各自的 *.test.js + _test.js 微型断言器
├── programs/
│   └── chNN-<slug>/
│       ├── chapter.json     本章元数据（编辑源）
│       ├── <program>.py     程序（编辑源，真能跑）
│       └── _fixtures/       程序要读的数据文件（按需）
├── tools/
│   ├── _skeleton.html       新页的复制源；参与内联，PROGRAMS 标记写 none
│   └── py-<name>.html       工具页，一页对应一个章目录
└── scripts/
    ├── inline_core.py       core → 工具页
    ├── build_programs.py    programs → 工具页 + 注册表计数
    ├── sync_fallback.py     注册表 → 两个导航页的 FALLBACK
    ├── check.py             门的运行器
    └── gates/               五个门模块（registry / hygiene / syntax / library / lexer）
                             + properties.py（property 参照的汇总器：收拢 refs/ 的登记，定 SAMPLES / SEED）
                             + __init__.py（公共常量与工具：路径、闭集、MODULE_ACCENTS、run_node()）
                             + refs/（property 参照，按章一个文件）
```

章目录与工具页一一对应：`chapter.json` 顶层只有 `module`、`tool`、`programs` 三个键，
`tool` 指名唯一一个 `tools/<tool>.html`（`ch16-sorting` ↔ `py-sorting`）。
`build_programs.py` 两个方向都查：章点名的页不存在是硬错误；页没有任何章点名它、又没写 `none` 哨兵，也是硬错误。

注册表冲突的合并配方是一个脚本，但它不在 `python/` 里，而在
`.claude/skills/python-content-wave/resolve-registry-conflict.py`——它属于控制方作业，用法见 `python-drill-tool`「三种作业」。

### 2.1 编辑源有两类

chess 与 cryptography 只有一类编辑源（`core/**/*.js`）。python 有两类，外加注册表：

| 编辑源 | 改完跑 |
|---|---|
| `python/core/*.js` | `inline_core.py` |
| `python/programs/ch*/`（`chapter.json` 与 `.py`、`_fixtures/`） | `build_programs.py` |
| `python/python-tools.json` | `sync_fallback.py`（以及 `build_programs.py` 会回写它的两个字段） |

**绝不手改任何 `GENERATED` 区段。**

### 2.2 谁写哪个区段

| 区段 | 出现在 | 谁写 | 谁验 |
|---|---|---|---|
| `PY-LEX` `STORE` `EXERCISE` `EDITOR` `JUDGE` `TRACE` `INTERACT` | 每个工具页（含骨架） | `python/scripts/inline_core.py` | `inline_core --check` |
| `PROGRAMS` | 每个工具页（骨架写 `none`） | `python/scripts/build_programs.py` | `build_programs --check`、`program_embed_roundtrip_check` |
| `FALLBACK` | `app.html`、`index.html` | `python/scripts/sync_fallback.py` | `sync_fallback --check`、`fallback_check`、`fallback_version_check` |
| `FAVICON` | 全部页面 | 根 `scripts/apply_branding.py` | 同脚本 `--check`（根 CI） |
| `BRAND-LOGO` | 两个导航页 | 根 `scripts/apply_branding.py` | 同上 |
| `GALLERY-BG` | `index.html` | 根 `scripts/apply_gallery_bg.py` | 同脚本 `--check`（根 CI） |
| `COPYRIGHT` / `ANALYTICS` | `COPYRIGHT`：工具页与 `index.html`；`ANALYTICS`：两个导航页 | 根 `scripts/apply_footer.py` | 同脚本 `--check`（根 CI） |

后四类不归 `python/scripts/check.py` 管，由根级脚本与根 CI 守（§12）。

core 的七个区段**全部必需**，没有逐页选装清单：`inline_core.py` 的 `OPTIONAL_TAGS` 是空集。
它的区间正则允许空区间体——两条标记贴在一起正是新页第一次被填的形状；chess 那边曾要求非空，
后果是新页带着空块全绿上线（`inline_core.py` 的 `pattern()` 注释）。

### 2.3 `PROGRAMS` 区段的编码

`build_programs.py` 把本页那一章的每个程序（`chapter.json` 条目原样，外加派生的 `source` 与 `lines`）
编成 `var PyPrograms = {module, tool, programs};`。三条编码要求写在 `encode_payload()`：

1. 一律 `json.dumps(ensure_ascii=True)`，不手写转义；它顺带把 U+2028 / U+2029 转义掉。
   这两个码位原样出现在 JS 字符串字面量里，自 ES2019 起不是语法错（第 0 期 R41 实测），
   但旧引擎与工具链把它当换行、肉眼又看不见，所以仍然转义。
2. 编码后把整串文本里的 `<` 换成 JSON 的 unicode 转义（反斜杠、字母 u、`003c`）：
   一段打印 HTML 的教学程序里若有 `<` + `/script`，HTML 分词器会当场断页；`<` 在 JSON 里只会出现在字符串值内部，整串替换不破坏结构。
3. 往返由 `program_embed_roundtrip_check` 在 node 裸 `vm` 里解码、与磁盘 `.py` 逐字节比。

`sync_fallback.py` 对两个导航页的 `FALLBACK` 做同样的事（`<`、U+2028、U+2029 三种字符转义）。

---

## 3. 与 chess / cryptography 的异同

| | chess | cryptography | python |
|---|---|---|---|
| 主角 | canvas 棋盘 | canvas 可视化 | 代码本身，没有 canvas |
| 浏览器里有没有运行时 | 有（JS 子集解释器） | 有（算法实现） | **没有** |
| 分组轴 | `phase` | `chapter`（5，闭集） | `module`（8，闭集） |
| 编辑源 | `core/**/*.js` | `core/**/*.js` | `core/*.js` + `programs/ch*/`（`.py` 是第二类编辑源） |
| 生成脚本 | `inline_core.py` | `inline_core.py` | `inline_core.py` + `build_programs.py` + `sync_fallback.py` |
| FALLBACK | 手写 | 手写 | **生成**（第 1 期起） |
| 模块装载顺序 | — | `CRYPTO-CORE` 必须在前，有顺序门 | **无所谓**：全部惰性取依赖，门查的是「有没有人在工厂实参里直接抓 `root.X`」（§6.2） |
| 骨架哨兵 | — | `GENERATED:ALGOS none` | `GENERATED:PROGRAMS none` |
| 默认语言 | en | en | en |
| 独立裁判 | — | node `crypto`（OpenSSL） | CPython 本身：真跑、`tokenize`、机制不同的纯 Python 参照 |

相同的部分：单文件、零依赖、`file://` 可开；整个子目录搬走仍能独立运行；注册表隔离（`python-tools.json`
只指向 `python/tools/*.html`，绝不进根 `tools.json`）；accent 取同一个五色闭集；六个导航页共守一份契约。

对照 cryptography 的一处设计分歧值得记住：cryptography 用 `inline_order_check()` 守装载顺序，
因为它的模块在工厂里就抓 `root.CryptoCore`；python 从第 0 期起走惰性取值，那一类坏从根上不存在，
所以门守的也是另一件事（`inline_core.py` 文件头第 2 条）。

---

## 4. 内容模型

### 4.1 一个程序的数据形状

元数据在 `chapter.json` 的 `programs` 数组里，源码在同目录的 `.py` 里。以 e342ba2 全库实际出现的键为准：

| 字段 | 必需 | 说明 | 谁校验 |
|---|---|---|---|
| `id` | 是 | 全库唯一 | `program_meta_check` |
| `file` | 是 | 同目录的 `.py` 文件名 | `chapter_manifest_check`（双向点名） |
| `problem` | 是 | 变体分组键：同一问题的不同写法共用它 | `program_meta_check`、`variant_check` |
| `kind` | 是 | `syntax / pattern / algorithm / project / embedded` | `program_meta_check`、`closed_set_mirror_check` |
| `level` | 是 | 程序难度 1–5（与 BLANK 的 `level` 1–3 不是一回事） | 同上 |
| `boards` | 是 | `AQA / OCR / Edexcel / CIE` 的子集，不重复，**可以为空**（考纲外），见 §4.5 | `program_meta_check` |
| `tags` | 是（实践上） | 自由标签 | 无门 |
| `requires` | 是 | 白名单 `numpy / pandas / matplotlib / scipy / pygame` 的子集，可以为空 | `program_meta_check` |
| `runtime` | 否（缺省 `cpython`；全库实践上都写） | `cpython / micropython-microbit / micropython-pico` | `program_meta_check` |
| `entry` | 是 | 要被调用的函数名；挂 property 时门调它 | `program_meta_check`、`algorithm_property_check` |
| `title` / `blurb` | 是 | `{en, zh}`，都非空 | `program_meta_check` |
| `notes` | 是 | `{en: [段落…], zh: [段落…]}`，**段落数组**，不是带换行的长串 | `program_meta_check` |
| `lineNotes` | 是（实践上） | `[{at: 整行原文, en, zh}]` | `anchor_check` |
| `chunks` | 否 | 分段临摹，见 §7.3 | `anchor_check`、`chunks_check` |
| `run` | 可运行层必需 | `{stdin, expect, timeout}` | `program_run_check` |
| `check` | 否 | `{property: sort / search / structure / pure}` | `program_meta_check`、`algorithm_property_check` |
| `tier` + `why` | 否 | 例外豁免，见 §4.4；e342ba2 全库没有一条（交接文档 §1.1） | `exemption_check` |

两条设计上的讲究（主规格 §2.3）：

- **锚用整行原文，不用行号。** `lineNotes[].at` 与 `chunks[].from / to` 都是一整行源码；
  行号会在编辑上方任何一行时静默错位，而原文找不到或不唯一时门**当场红**（`anchor_check`：在源码里、
  在 `clean()` 之后都要存在且唯一）。行注锚点**可以**落在挖空体内——防泄题的防线在读取点（§6.3），不在锚的位置。
- **派生字段一律不手写。** `lines` 与 `source` 不许出现在 `chapter.json`（`program_meta_check` 的 `DERIVED_FIELDS`）；
  注册表的 `programs` / `lines` 由 `build_programs.py` 回写，`program_count_check` 独立重算。
  `lines` 的定义：源码按 `\n` 切、去掉文件末尾换行产生的空尾巴、**去掉 BLANK 指令行**——正是读 / 临摹模式里她看到的行数，
  选择器「不超过 20 / 40 / 80 行」按它筛。只认 `\n`，不认 U+0085 / U+2028 / U+2029，因为页面的 `clean()` 是 `split('\n')`
  （`build_programs.py` 文件头；第 1 期地基终审 G3）。

### 4.2 源码的三条硬规矩

1. **参考答案就是源码本身。** 挖空体在读模式下是正文、在挖空模式下是标准答案，不存第二份。
   BLANK 指令是 Python 注释，所以带着标准答案的 `.py` 本身就能跑、能被门验（主规格 §2.5）。
2. **程序体纯 ASCII，注释一律英文。** 临摹是三层逐字符对齐，一个全角字符就让整行错位。
   中文走 `notes` / `lineNotes`，渲染在代码旁边。BLANK 指令行豁免（提示可以写中文），
   因为 `clean()` 保证指令行永远不流进任何渲染层（`source_ascii_check`；`.py` 读写一律显式 `utf-8`，裁决 R21）。
3. **4 空格缩进、无制表符、无行尾空白、LF 结尾。** 复制进 PyCharm 必须原样能跑（`source_indent_check`）。
   另有 `source_bmp_check`：不许出现 BMP 之外的字符——CPython 给字符偏移、JS 给 UTF-16 码元偏移，两边会对不上；
   `js_parser_parity_check` 另禁 U+2028 / U+2029 / U+0085（§11.2）。

### 4.3 变体

`problem` 相同的几个程序是同一问题的不同写法（`binary-search` 的迭代 / 递归 / `bisect`）。
读模式顶部排成一行标签，可以单看，也可以两栏并排对照（`PyInteract.variantsOf`）。
`variant_check` 只对**成员数 > 1** 的组要求 `title.en` 互不相同（并排时两栏得分得清），
外加一条全库断言：至少存在一个多变体组——没有它，这道门在一个全是单例的库上永远绿。
代码不要求每组 ≥ 2；单例组是大多数（主规格 §7.1 已照此改写）。

### 4.4 三层运行策略与具名豁免

分层看 `requires` 与 `runtime`，不看模块（`gates/library.py` 的 `_tier()`）：

| 层 | 判据 | `program_run_check` 怎么处理 |
|---|---|---|
| stdlib | `runtime: cpython` 且 `requires` 为空 | 每次都真跑，比 stdout |
| scipy-stack | `requires` 含 numpy / pandas / matplotlib（不含 pygame） | 真跑；缺库时本地跳过并计数，严格模式下红 |
| compile-only（结构性） | `runtime != cpython`，或 `requires` 含 `pygame` | 只过 `compile()`，无需 `why` |
| compile-only（例外） | 普通 cpython 程序却写了 `"tier": "compile-only"` | 只过 `compile()`；**必须带非空 `why`，每页至多 2 条，每次运行逐条打印** |

真跑的沙箱纪律（`program_run_check` 的 docstring）：`.py` 与 `_fixtures/` 先拷进一个全新临时目录当 cwd、
`PYTHONHASHSEED=0`、`PYTHONIOENCODING=utf-8`、`MPLBACKEND=Agg`、喂 `run.stdin`（缺省空串，裸 `input()` 会 EOFError 而不是挂死）、
`run.timeout` 秒超时（缺省 5）。**没有网络隔离**：门不断网，程序不访问网络目前只靠评审（主规格 §5.4 已照此改写）。

**豁免为什么分两类。** M7 / M8 几乎整章都跑不了，任何「一章 compile-only 超过 N% 就红」的阈值都会永远红；
所以按「原因是否已经写在数据里」来分：结构性的原因已在 `runtime` / `requires` 里，再抄一遍 `why` 只会漂；
例外的原因不在任何字段里，只能靠人写下来，而且不许安静地积累（主规格 §5.4）。

**`compile` 而从不 `import`。** `compile(src, id, 'exec')` 不执行 import，所以编译门不需要装任何第三方库或 MicroPython 运行时（主规格 §5.5）。
调用一律带 `dont_inherit=True`：门模块自己有 `from __future__ import annotations`，不加这个参数它会被继承给被测程序（#188）。

**pygame 与 MicroPython 的程序结构。** 两层都整段跑不了（主循环不终止 / 要硬件），但可以只导入、对纯逻辑函数挂 property。
前提是程序写成「纯逻辑函数 + `main()` + 恰好一个 `if __name__ == "__main__":`」，模块顶层只许 import / def / class / docstring / 常量赋值：

- pygame（#196 起）：顶层调用只许 `pygame.Color / Rect / Vector2` 这类纯值构造；由 `pygame_main_guard_check` 守。
  导入前设无头 SDL（`SDL_VIDEODRIVER=dummy` 等），导入限时 `IMPORT_TIMEOUT`。结构门之所以必要：
  顶层的 `pygame.init()`、`set_mode(...)` 在无头 SDL 下照样导入成功、property 照样绿，只有结构门看得见（主规格 §5.4）。
- MicroPython（#201 起）：导入前把 `microbit` / `machine` / `utime` 等装成**硬件桩**——取属性得到另一个桩，**调用即抛**
  `HardwareStubCalled`；`const()` 是恒等函数，`Image(...)` 是纯值构造；比完即卸桩。顶层规则同上，调用只许 `const` / `Image`，
  由 `micropython_main_guard_check` 守。e342ba2 全库还没有 MicroPython 程序（交接文档 §1.1），这两处只在负控制里被执行过（门的输出如实这样说）。

property 的入口一律交回**内置类型**：`np.int64` / `ndarray` 要 `int()` / `.tolist()`，`pygame.Rect` / `Vector2` 要转 `tuple`，
因为门逐层比「值相等且类型相同」（§11.2）。

### 4.5 `boards`：只写考纲点名了的考试局

**规则（用户裁决 2026-09-30，boards PR 落地）**：一个考试局只在它的 A-level 考纲**点名了这个程序的核心教学点**时才写；
**不在考纲就不写，四家都不含就写 `[]`（合法）**。`[]` 的程序在说明面板上显示「不在考纲 / Not on the syllabus」，
按任何考试局筛选时都不出现。`program_meta_check` 只要求 `boards` 是列表、元素在四家闭集内、不重复——**允许空**。

判定依据、判定原则 R1–R6、全库逐程序的判定表与按概念组的一致性自查，都在
`docs/superpowers/specs/2026-09-30-python-boards-syllabus-map.md`；新程序照它判，依据写进构建报告。
全库的计数随内容变化，只在交接文档 §1.1 的快照表里出现（本文不写数字）。

---

## 5. BLANK 指令与分级提示

### 5.1 语法

```python
# >>> BLANK id=mid level=2 hint="第一级 || 第二级" hintEn="Tier one || Tier two"
        mid = (lo + hi) // 2
# <<< BLANK
```

- 挖空体永远是**整行整行**的，夹在两条指令行之间；渲染成一个占若干行的块级输入区，缺省值是这个空的缩进本身——缩进是她答案的一部分，不是框外的固定前缀（主规格 §3.3；绝对缩进见 §8.2）。
- 四个属性 `id` / `level` / `hint` / `hintEn` 必须齐全；`id` 页内唯一；`level ∈ 1..3`；挖空体非空；指令成对（`blank_directive_check`）。
- **每个程序至少一个空**，无豁免（`blank_presence_check`）。挖空是三种模式里唯一带判定的一种，零个空不是合法的内容形状。
- 解析顺序：先摘 `hintEn`、再摘 `hint`、最后在裸文本上取 `id` / `level`——否则 `hint="…"` 的正则会先吃掉 `hintEn` 的值。
  页面侧是 `core/exercise.js` 的 `parse`，门侧是 `gates/library.py` 里**独立重写**的一份（`_split_attrs`）：
  门守的是数据，不能拿被守护的模块去解析它；两份独立解析器给出同样结论才是证据。
  再由 `js_parser_parity_check` 在裸 `vm` 里跑页面那份，比对两边的挖空 id 列表与 `clean()` 行数——
  地基终审往 `swap-two-tuple` 的提示里放一个 U+2028 实测：`clean()` 抛错、三种模式全坏，而当时 39 道门全绿
  （第 1 期地基终审 G3 的注入实验，不是上线事故；`gates/syntax.py:288–291`，第 1 期 R2，#173）。

`core/exercise.js` 对同一份源码给出三个产出，对应三种模式，不能混用：

| 产出 | 内容 | 谁用 |
|---|---|---|
| `parse(src).stripped` | 挖空体换成 `<indent>___` | 挖空模式（唯一藏答案的产出） |
| `clean(src)` | 指令行整条删掉、挖空体原文保留 | 读模式、临摹模式、读模式的复制 |
| `merge(src, answers)` | 她的答案替换指令块，缺的空用原文兜底 | 挖空模式的复制 |

**读 / 临摹 / 复制一律走 `clean()`，不是裸 `program.source`**：否则出题标记与中文提示会摆在她眼前，临摹时还要她把中文提示逐字敲一遍（裁决 R16）。

### 5.2 分级提示

`hint` / `hintEn` 用**唯一的显式标记 ` || `**（两侧各一个空格）切成若干级，段数必须**恰好等于** `level`，两种语言都要：

- 段数 < `level`：`hintAt()` 的 `cap = min(level, parts)` 钳到段数，按钮上印着「(L2)」，点第二下什么都不变；
- 段数 > `level`：多出的段永远读不到。

门还拦「写错形状的标记」（两侧空白不是恰好一个、或落在开头结尾），因为那种写法数出来的段数可能照样对得上（`_stray_marks`）。
分隔符曾经是 ` · ` / `；` / `; ` 三选一，正文里一个分号就会把一级提示静默截断；第 1 期改成 ` || `（Python 没有这个运算符），
分号回归普通标点（主规格 §3.3，第 1 期设计 B1）。页面把展开的几级用 ` · ` 连接显示。

写作规则——逐级更具体、任何一级都不给整行答案、推不出来的字面量在某一级给出——在 `python-drill-tool`「硬规矩与守门」，不在这里重复。

### 5.3 等价写法的「钉法」

判定器只认一种写法（§8）。一行若有同样好的另一种写法（`half ** 2` 对 `half * half`，`round(d)` 对 `int(round(d))`），
她写出另一种会被判错。规则是：要么别挖这一行，要么**在第 1 级提示里把形式钉死**；只有钉法本身等于念出整行时才挪到最后一级。
多行空只挖同一层的两三行，因为判定器在两边行数不同时不比缩进（§8.2）。这些都是**靠人**的规矩，没有门；
细则、已知的存量缺口与例子见 `python-drill-tool` 与各期 deferred 文件。

---

## 6. core：七个模块

### 6.1 职责与导出

| 模块（全局名） | 职责 | 主要导出 | 依赖 |
|---|---|---|---|
| `py-lex.js`（`PyLex`） | Python 词法器；高亮与判定共用同一份 token 流 | `tokenize` `significant` 与关键字表 | 无 |
| `exercise.js`（`Exercise`） | BLANK 指令解析、占位版、合并、剥指令 | `parse` `merge` `clean` | 无 |
| `editor.js`（`Editor`） | 片段化高亮、行首偏移、Tab / Enter 行为 | `highlight` `lineStarts` `indentOf` `applyTab` `applyEnter` | PyLex |
| `judge.js`（`Judge`） | 逐 token 严格比对 + 第一处分岔定位 | `normalize` `compare` | PyLex |
| `trace.js`（`Trace`） | 影子临摹的逐字符比对与统计，不碰 DOM | `create` `alignLines` `IDLE_PAUSE_MS` `_useClock` | 无 |
| `store.js`（`Store`） | localStorage：边输边存、进度、三级清空、失败通知 | 见 §9 | 无 |
| `interact.js`（`PyInteract`） | 页面装配：三模式、选择器、筛选、快捷键、复制、分段临摹 | `mount` 与一批纯决策函数 | 以上六个 |

`interact.js` 有 DOM，但**决策逻辑不该有**：凡是「该拿哪份文本、该筛掉谁、该报什么错、光标落在哪」的判断，
一律抽成纯函数导出，在 node 下由 `interact.test.js` 直接测（`filterPrograms` `copyPayload` `hintAt` `panelLineNotes`
`clearScope` `blankFeedback` `chunkSegments` 等，完整清单在它的文件头）；DOM 那一半只负责把结果画出来。
唯一带 DOM 的导出是 `mount()`。各函数的签名与调用约定属于交接文档。

### 6.2 依赖惰性取与 UMD 的两个分支

每个模块都是 UMD：node 下 `module.exports = factory(...)`，浏览器下 `root.X = factory(...)`。有依赖的模块**惰性取**：

```js
root.Judge = factory(function () { return root.PyLex; });   // 对
root.Judge = factory(root.PyLex);                            // 错：装载时抓死 undefined
```

`inline_core.py` 就地替换每一对标记，**不保证**区段的先后顺序；直接抓的写法在装载时拿到 `undefined`，
页面加载毫无征兆、到第一次交互才死。两道门从两个方向守这一条：

- `lazy_dep_check`（B 组）：**先剥注释**再扫每个 `factory(...)` 调用的实参，出现裸 `root.X` 即红
  （`editor.js` 与 `judge.js` 的注释里都拿 `factory(root.PyLex)` 当反面教材，裸 grep 会误报，裁决 R47）。
- `browser_branch_check`（C 组）：在 node `vm` 的**裸 context** 里（先断言沙箱里没有 `module` / `require`）
  按依赖的**反序**装载七个模块——`interact` 最先、`py-lex` 最后——再真调一遍。谁直接抓了 `root.X`，这里当场抓死。

为什么非要裸 `vm`：`node -e` 与从 stdin 读脚本的 `node` 都定义了 `module` 和 `require`，UMD 会走 **node 分支**，
那样的门测的是浏览器里根本不执行的代码（根 `CLAUDE.md` cryptography 一节）。`core_tests` 跑的 `*.test.js` 只覆盖 node 分支，
所以浏览器分支必须另有门。同一个裸 `vm` 手法也用在 `closed_set_mirror_check`、`js_parser_parity_check`、`program_embed_roundtrip_check`、`chunks_check`。

### 6.3 `py-lex.js`：全覆盖、永不抛错

只切词，不做语法分析、不维护 INDENT / DEDENT 栈（主规格 §4.2）。两条设计选择都是为了三层对齐：

1. **对任何输入都不抛错，且 token 区间无缝覆盖 `[0, len)`。** 主循环每一轮必须推进且必须产出一个 token，
   未闭合的三引号吃到文件尾，孤立反斜杠与任何落单的非法字符各算一个 op。「切片拼回去逐字节等于原文」因此是**构造性**成立的。
   chess 的 `editor.js` 走另一条路（tokenize 抛错就整篇降级为纯文本），代价是她打字打到一半时整篇没颜色——这里从设计上绕开。
2. **高亮与判定读同一份 token 流。** 不另写一套正则高亮器，免得「高亮说是关键字、判定说不是」。

与 CPython 的关系写在 `py-lex.js` 文件头（裁决 R23）：**CPython 有答案就对齐，CPython 抛错就自己选。**
`lex_vs_cpython_check` 拿 CPython 的 `tokenize` 当独立裁判，比 NAME / NUMBER / STRING / COMMENT / OP 五类的起止区间；
f-string 与装饰器只比合并后的整体区间；**任何既不在映射表里、也不在忽略表里的 CPython 类别都会让门变红**——
新版本 CPython 加一个 token 类型，门不会安静地少比一批（`gates/lexer.py` 的 `TOKEN_MAP` / `IGNORED_CPYTHON`）。
CPython 自己就拒绝的畸形语料跳过比对，由 `lex_never_throws_check` 与 `lex_roundtrip_check` 守。

### 6.4 行注的泄题防线

面板会把 `lineNotes[].at` 的整行原文印出来，而锚可以落在挖空体内。所以**只有读模式给行注**：
`panelLineNotes(program, mode)` 的判据写成 `mode === 'read'`（白名单），不是 `!== 'blank'`（黑名单）——
黑名单在加第四个模式时默认放行；临摹模式的盲打档同样会泄，所以也挡掉。
`line_note_reader_check`（B 组）把 `core/` 里 `lineNotes` 这个词（剥注释后）的出现位置限定为三种：
`panelLineNotes` / `noteLineIndex` 两个函数体内、STR 键表里那一行声明、独立的 `t('lineNotes', …)` 调用。
它是文本扫描，防的是日常写法里意外多出的一条读取路径，不防蓄意混淆（它的 docstring 逐条列了盲区）。

锚可以落在挖空体内（第 1 期拆掉了第 0 期的禁令，主规格 §2.3）；泄题的两道防线都在读取侧：`panelLineNotes` 的模式白名单与 `line_note_reader_check`。

---

## 7. 三层对齐与影子临摹

### 7.1 三层

```
层 3（顶）  透明 textarea     —— 收键盘，caret 可见，文字 color:transparent
层 2（中）  她打的内容的高亮  —— 逐字符对照，错处标红
层 1（底）  标准程序的高亮    —— opacity = α
```

三层共用同一字体（python 自己的 `--font-code` 令牌）、`line-height`、`padding`、`tab-size`。不变量只有一条：
**片段拼回去与原文逐字节相同**（`highlight(src).map(f => f.text).join('') === src`）。片段文本一律 `src.slice(start, end)` 现切，
PyLex 的 token 干脆不带 `value` 字段——`1e10` 被 stringify 成 `10000000000`、三层从那个字符起全部错位这类错误因此无从写起（`editor.js` 文件头）。

配套的 CSS 纪律写在 `interact.js` 的样式表里：代码区 `white-space: pre`（绝不软换行，否则视觉行与行号脱钩）、
`font-variant-ligatures: none` 并关掉 `liga` / `clig` / `calt`（连字会把 `!=` 合成一个字形）。
对齐没有机械门；每期验收由控制方在三档缩放下用 `Range` 量同一字符在影子层与输入层的矩形，要求 dx = dy = 0，
并用一次负控制证明这个测量看得见错位（主规格 §9.1 第 6 条）。

### 7.2 `trace.js` 的比对与统计

- **以行为同步单位、行内按位置对齐**：两边先按 `\n` 切行再逐行比，一行打错不会把后面所有行拖红；换行符本身也占一个可比较的位置。
- **正确率按「首次输入即正确」算**：内部记 `firstWrong` 与 `seen`，一个位置第一次被打时就错了，之后改对也不移除；返回给 UI 的 `marks[].state` 是当前对错，两者刻意分开。
- **时钟外部注入**（`Trace._useClock`），统计才测得了。空闲剔除是**定长**规则，不按一次新增的字符数缩放——
  否则一次粘贴会把一段真实的走神算进打字速度（裁决 R34，`trace.js` 文件头）。
- Python 专属：Tab 永远插 4 个空格；Enter 自动缩进（沿用上一行，`:` 结尾再 +4）；「跟随影子」开关默认关——缩进正是最该练的（主规格 §3.4）。

### 7.3 分段临摹（`chunks`，#198，engine `py-1.2.0`）

长程序可以声明 `chunks: [{title: {en, zh}, from, to}, …]`。设计在 `docs/superpowers/specs/2026-09-30-python-phase5-chunks-design.md`，要点：

- **段 = clean 文本里从本段 `from` 那一行起、到下一段 `from` 之前为止的全部行**；第一段从偏移 0 起，最后一段到文本末尾。
  `to` 只用来让作者写清到哪为止、让门核对「段与段之间只有空行」，**不参与切分**。这样段首尾相接、覆盖全文、拼回去逐字节等于 clean 文本——
  §7.1 那条不变量在段这一层的版本。闭区间 `from…to` 会让段间空行不属于任何段，复制出去的程序与原文不同。
- **一段 = 一个 reference = 一个 Trace session，`trace.js` 一行不改。** 影子层与输入层只显示当前段，三层坐标系从段首起算。
- 段打完不自动跳，给「下一段」按钮；「重来」只重来当前段；段参考以空行收尾时，她打完最后一个非空行按下 Enter，
  `chunkTailFill` 把缓冲补成完整段参考（否则她打不到「段完成」）。
- progress 的 schema 不变：只有 N 段都在干净的 run 里打完时，才按全程汇总写一次 `{bestAcc, bestCpm, at}`；
  任何一段是接着草稿打的（resumed），全程成绩不记，并且统计行会说出来（`chunkResumedAny`）。
- 分段程序的临摹草稿仍存在 `(id, 'trace')` 键下，值是 JSON `{"v":1,"seg":k,"typed":[…]}`；不分段程序的草稿仍是纯字符串，一字不变。
  读到对不上的草稿（旧纯字符串、段数变了）一律当作「没有分段草稿」，旧字符串在她打下第一个字之前不被覆盖（`decodeChunkDraft`）。
- 已知限制（设计 §7，不修）：分段草稿格式是单向的。以后去掉某个程序的 `chunks`，或缓存里的旧版页面读到新草稿，
  那段 JSON 会原样出现在临摹输入框里；去掉 `chunks` 时要么让她清掉这一题的草稿，要么先改不分段的读取路径（要单独评审）。

门：`anchor_check` 验锚；`chunks_check`（D·库）验形状（至少 2 段、标题双语非空）、顺序、相接（缝里只许空行、第一段 `from`
就是 clean 文本的第一个非空行），并在裸 `vm` 里调**页面内联的** `PyInteract.chunkSegments`，与门用 Python 独立算出的起止偏移逐段比——
「门验的与 UI 用的不是同一个解析」是第 0 期付过的代价。每段行数只是取向，不进门。读模式与挖空模式不受分段影响。

---

## 8. 判定

### 8.1 严格到什么程度

| 归一化时吞掉 | 参与比对 |
|---|---|
| token 之间的空白 | 引号风格 `'a'` ≠ `"a"` |
| 注释 | 数字写法 `1e10` ≠ `10000000000` |
| | 空内部各行的**相对**缩进 |

这三样能被保留，是因为 `Judge.normalize()` **从不改写 token 的文字**——每个 token 都是原文切片，不算数值、不统一引号（`judge.js` 文件头）。
token 化不是为了放宽，是为了报错报得有意义：「第 4 个 token 起不同：期待 `//`，你写了 `/`」，而不是「第 37 个字符不对」。
`judge_strictness_check`（D·词法）用一组正负样例守住上表：换空白 / 换注释判同，换引号、换数字写法、改相对缩进判异。

### 8.2 判定器看不见的两处，以及怎么补

- **整块的绝对缩进。** `compare` 只比行与行之间的相对缩进，单行空 `    x = 1` 与 `x = 1` 在它眼里相等；
  但 `merge` 是把她的原文替换回源码的，少四格就是 `IndentationError`。所以 `PyInteract.blankFeedback` 在调 `compare` 之前
  先自己比第一行的绝对缩进，不同即报 `lead-indent`。
- **行数不同时不比缩进。** `compare` 只在两边有效行条数相同时比相对缩进（行数不同属于少写 / 多写了一整行，归 missing / extra，裁决 R35）。
  代价是：一个跨嵌套块的多行空，写成改变语义的缩进也可能判对。补法是写作规矩——多行空只挖同一层（§5.3，`python-drill-tool`）。

### 8.3 反馈不泄露字面量

PyLex 把一整个字符串或 f-string 切成**一个** token，「期待的 token 原文」对字面量来说就是答案本身。
所以期待的 token 是字符串 / f-string 时，`blankFeedback` 只报它的类别与「第几个字符起不同」，绝不印出标准答案的字面量原文；
她自己写的那一份可以照常复述（Task 11b，主规格 §3.3）。其余情形只报第一处分岔与光标位置，**不回整段答案**。

---

## 9. 存储

### 9.1 键空间

全部 `python-` 前缀（`store.js` 开头的常量；`python-lang` / `python-nav` 由导航页与工具页的 i18n 使用，属契约 C7）：

```
python-lang                  'zh' | 'en'
python-nav                   上次所在的工具 id
python-store-v               schema 版本号（当前 SCHEMA_VERSION = 1）
python-prefs                 偏好（浅合并写入）
python-draft:<progId>:blank  挖空草稿
python-draft:<progId>:trace  临摹草稿（分段程序是 JSON，见 §7.3）
python-progress:<progId>     { blank: {…}, trace: { bestAcc, bestCpm, at } }
```

边输边存：`scheduleDraft` 防抖 400 ms（`DEBOUNCE_MS`）；页面在 `visibilitychange` 与 `pagehide` 时 `flush()`。
`patchProgress` / `setPrefs` 是浅合并、整值替换，不递归深合并——深合并会让「删掉一个字段」无法表达（第 0 期裁决）。

### 9.2 schema：安全丢弃优于错误迁移

第一次真正碰存储时读 `python-store-v`；版本不等就把 `python-draft:` 与 `python-progress:` 两个前缀下的键全部清掉、写入新版本，
并通知页面「数据格式升级，旧草稿已清空」。不尝试把旧格式转成新格式——转错了比丢掉更难查。
检查延迟到第一次读写（`ensureSchema()`），好让 `_useStorage()` 本身是纯状态切换、调用方来得及先挂监听器。

### 9.3 失败面

这个模块最坏的失败方式是静默地骗人：她以为存住了，关掉标签页才发现代码没了。所以：

- 每一次真正的读写各自包 try/catch，不去猜「存储是不是可用」的形状（`file://` 下部分浏览器禁用或每文件独立；
  Node 25 的实验性 `localStorage` 甚至 `typeof` 是 `'object'`、`setItem` 却不存在）。
- 所有状态先写进内存里的影子层 `memory` 再写 storage；storage 抛错时本次会话无缝降级到内存。
- 失败统一走 `onUnavailable(cb)`，原因分 `quota` / `migrated` / 不可用三种，页面挂**持久横幅**；一段连续失败只通知一次。
- `store.js` **不认识任何一道题，也不认识模块**：清空 API 收 id 列表，由调用方从程序库取（同 chess `exercise.js` 的纪律）。
  `_useStorage` / `_storage` 是只给测试用的注入口。

### 9.4 三级清空——代码的实际形状

| 入口（都在工具页的程序选择器里） | 清掉 | 二次确认里的数字 |
|---|---|---|
| 每项的「⋯」 | 该题的两份 draft | `countRecords` 的真实条数 |
| 「清空本页」 | 本页全部程序的 draft（`clearScope('page', PROGRAMS)`；页面只内嵌本页那一章） | 同上 |
| 「清空全部」 | 全部 `draft:*` + `progress:*`（`Store.clearAll()` 按前缀扫）；语言与偏好保留 | 只数得出本页的那部分，文案明说「其他页的记录也会一并清除」 |

进度不随前两级连坐（「她已经会了」的记录）。清空前先 `flush()`，否则 400 ms 后排队中的那次防抖写会把草稿送回来（`clearRecords`）。
只有清到当前这一题时才重读草稿、作废当前这一遍临摹（`clearHitsCurrent`）。

画廊与壳上没有清空入口。`Store.clearAll({prefs: true})`（连 `python-prefs` 一起清）API 支持，目前没有任何 UI 调用它。
中间一级在 py-1.3.1 之前叫「清空本模块 / Clear this module」、scope 名 `'module'`，而它从来只清本页——
文案、确认框与 scope 名都已改成「本页 / page」，`interact.test.js` 钉着措辞（主规格 §4.5 同步改写）。

---

## 10. 注册表与导航壳

### 10.1 `python/python-tools.json`

`{schemaVersion: 1, tools: [...]}`，每条：`id` / `file`（必须在 `tools/` 下、不许含父目录）/ `accent` / `module`（整数 1–8，
`type(...) is int`，挡住 `true`）/ `kicker` `title` `desc` `tag`（都是非空的 `{en, zh}`）/ `version`（semver）/ `engine`（`py-x.y.z`）/
`programs` / `lines`（脚本回写）/ `changelog`（非空数组，最新在前）。`registry_check` 还做磁盘与注册表的**双向**普查：
写完却忘了注册的页会被抓出来（根仓库出过 61 个 output 文件对 60 条注册），`_` 开头的模板页不参与。

**版本三处同步**：注册表 `version` + `changelog`、页面 `tool-version` meta、页面头部版本记录注释。版本号同时是缓存键——不升，线上用户会一直看到旧页面。
**engine 全库唯一**：改了 `core/` 就把所有工具与 `_skeleton.html` 的 `engine` 一起升（`page_mirror_check`）；
四次：`py-1.1.0`（#173，第 1 期规则）、`py-1.2.0`（#198，分段临摹）、`py-1.3.0`（boards PR：空考试局的占位改为「不在考纲」）、`py-1.3.1`（一致性清理：「清空本模块」改为与行为一致的「清空本页」，外加三处 core 注释订正；只动文案与注释，各页 `version` 不升）。

### 10.2 模块闭集与配色

`MODULE_LABELS` 是八个模块的闭集，`app.html` 与 `index.html` 两份必须逐字节相同、1–8 一个不缺（`module_label_check`）。
accent 按**模块**事先定死：M1 cyan · M2 violet · M3 emerald · M4 rose · M5 orange · M6 cyan · M7 violet · M8 emerald——
八个模块五种颜色，临场挑「相邻异色」到第六个模块一定撞色（`gates/__init__.py` 的 `MODULE_ACCENTS` 注释）。
`accent_module_check` 同时校验表本身相邻异色。M8 在 e342ba2 还没有页，标签与配色已经在表里。

### 10.3 FALLBACK 是生成的

`file://` 下 `fetch('python-tools.json')` 必然失败，两个导航页内嵌的 `FALLBACK` 是那时唯一的数据来源。
第 0 期它是手抄的，门只比 id 集合与 version——把 accent 改成 orange、module 改成 7，当时的门全绿。
第 1 期起改由 `sync_fallback.py` 生成（照根 `scripts/sync_registry.py` 的形状）：`app.html` 带
`id file accent module version kicker title tag`，`index.html` 再加 `desc`；FALLBACK 不带 `programs` / `lines`。
验证是两次互不依赖的测量：`sync_fallback --check` 比字节；`fallback_check` 用 `json.loads` 读回来比语义（字段集恰好等于规格、除 version 外逐字段值与类型相等），
其字段表**故意不从生成器导入**——两边共用一份表时，删掉一个字段两边会一起「同意」。

### 10.4 导航契约 v2.1 在 python 这边的落点

契约全文与「谁在守每一条」的表在 `docs/superpowers/subproject-nav-contract.md`，这里只列 python 的具体落点：

| 条款 | python 的做法 | 门 |
|---|---|---|
| C1 版本即缓存键 | 每个出站地址带 `?v=`；运行时从 `python-tools.json` 映射时抄 `d.version` | `version_meta_check`；根 `check_nav_contract.py` |
| C2 FALLBACK 带 `version`，求值后绑定非空 | FALLBACK 由脚本生成，天然带 `version` | `fallback_version_check`；`check_nav_contract.py` |
| C3 出站引用收敛成一个常量 | `PARENT_HOME = '../app.html'`，两页各一份；父项目不在时链接自己隐藏 | `outbound_ref_check`；`check_nav_contract.py` |
| C4 返回链接 `target="_top"` | 同左 | `check_nav_contract.py` |
| C5 画廊撑满舞台 | 同左 | `check_nav_contract.py` |
| C6 accent 闭集 | 同左；模块配色见 §10.2 | `registry_check`；`check_nav_contract.py` |
| C7 i18n 两页同源 | 键 `python-lang` / `python-nav`，兜底 `en` | `check_nav_contract.py` |
| C8 历史与 iframe | 同左 | `check_nav_contract.py` |
| C9 画廊背景四页同源 | `index.html` 的 `GALLERY-BG` 区段 | 根 `apply_gallery_bg.py --check` |

`outbound_ref_check` 对两个导航页各允许 **2** 处父目录引用：`PARENT_HOME` 加上同意横幅里的 `../privacy.html`（`hygiene.py` 的 `OUTBOUND_ALLOW`，
与 cryptography 同一个原因）；`core/` `programs/` `tools/` 与注册表里一处都不许有（主规格 §1.2 / §6.2 / §7.1 已照此改写）。

---

## 11. 校验门

### 11.1 运行器

`python3 python/scripts/check.py`。门按组登记在 `GATES` 表里，末行按组自数——**门数不写进散文**（`chess/check.py` 的同类数字漂出过三个答案）。
运行器的两条铁律写在它的文件头：

1. **全部门无条件跑到底**，最后汇总；绝不用 `or` 短路——那样一份过期的内联副本会让后面最有分量的门根本不执行。
2. **一道门抛异常不许带走别的门**：每一项都过 `_guard()`，非零的 `SystemExit` 与任何异常都被就地翻成「这道门红了」（`SystemExit(0)` / `SystemExit(None)` 算绿），
   门返回 `None` 也算红。`build_programs.py` 的硬错误全是 `raise SystemExit(...)`，不这样接，一个拼错的 `file` 字段会让后面的门一道都不跑。

`gates/__init__.py` 的 `run_node()` 逐字照抄 cryptography：脚本走 stdin，真要走 argv 时断言小于 Linux 的 `MAX_ARG_STRLEN`
（128 KiB）——本仓为这个上限 CI 假绿过四次合并。

### 11.2 门表（按 `check.py` 的 `GATES` 顺序抄入）

**生成**（生成物与编辑源一致）

| 门 | 守什么 |
|---|---|
| `inline_core --check` | 工具页的七个 core 区段与 `core/*.js` 逐字节一致 |
| `build_programs --check` | 工具页的 `PROGRAMS` 与章目录一致；注册表 `programs` / `lines` 与真数一致 |
| `sync_fallback --check` | 两个导航页的 `FALLBACK` 与注册表逐字节一致 |

**A · 注册表与镜像**（`gates/registry.py`）

| 门 | 守什么 |
|---|---|
| `registry_check` | 字段齐全、类型与闭集、semver、id / file 唯一、注册表与磁盘双向存在 |
| `fallback_check` | 两页 FALLBACK 与注册表：id 顺序相同、字段集恰为规格、逐字段值与类型相等 |
| `fallback_version_check` | 每条 FALLBACK 都带 `version` 且与注册表同值 |
| `version_meta_check` | 注册表 `version` == 页面 `tool-version` meta |
| `program_count_check` | 注册表 `programs` / `lines` == 从章目录独立重算的数 |
| `module_label_check` | `MODULE_LABELS` 两页逐字节相同、1–8 齐全 |
| `accent_module_check` | 每页 accent 等于模块配色表；表本身覆盖 1–8、取值在闭集、相邻异色 |
| `page_mirror_check` | 每页 `TOOL.id` / `accent` / `title` 与 `tool-engine` 等于注册表；engine 全库唯一且等于骨架 |

**B · 可搬迁与卫生**（`gates/hygiene.py`）

| 门 | 守什么 |
|---|---|
| `outbound_ref_check` | 父目录引用普查（§10.4） |
| `script_literal_check` | `.js` 里没有 `<` + `script` + `>` 字面序列（含注释）——`awk` 抽取配方会静默吞行 |
| `control_byte_check` | 无 BOM、无 CRLF、无杂散 C0 控制字节 |
| `lazy_dep_check` | 工厂实参里没有裸 `root.X`（§6.2） |
| `skeleton_sentinel_check` | 骨架的 `PROGRAMS` 标记写 `none`，真工具页都不写 |
| `skeleton_leak_check` | 已注册页不带骨架的 description 原文或 `none` 哨兵 |
| `line_note_reader_check` | `core/` 里读 `lineNotes` 只在三种位置（§6.4） |

**C · 语法与执行**（`gates/syntax.py`）

| 门 | 守什么 |
|---|---|
| `node_check` | 全部工具页（含骨架）与两个导航页的内联脚本过 `node --check` |
| `core_tests` | 跑 `core/*.test.js`（node 分支） |
| `browser_branch_check` | 裸 `vm` 里按依赖反序装载七个模块并真调（§6.2） |
| `closed_set_mirror_check` | `interact.js` 的 `LEVELS` / `KINDS` / `BOARDS` / `RUNTIMES` / `HINT_MARK` 与门的规格常量逐项相同 |
| `js_parser_parity_check` | 页面自己的 `Exercise.parse` / `clean` 在裸 `vm` 里跑遍全库：不抛、挖空 id 与门一致、行数与 `lines` 一致；`.py` 里无 U+2028 / U+2029 / U+0085 |

**D·库 · 程序库**（`gates/library.py`）

| 门 | 守什么 |
|---|---|
| `program_run_check` | 可运行层真跑，stdout 逐字节等于 `run.expect`；compile-only 层过 `compile()`（§4.4） |
| `algorithm_property_check` | 挂 `check.property` 的程序：导入、取 `entry`，固定种子 200 组实参，与 `gates/refs/` 里按程序 id 登记、**机制不同**的参照比（下文） |
| `program_embed_roundtrip_check` | 页面里每段 `source` 在裸 `vm` 里解码后与磁盘 `.py` 逐字节相同 |
| `chapter_manifest_check` | `.py` 与 `chapter.json` 双向点名；章目录与注册表工具页一一对应 |
| `anchor_check` | `lineNotes` / `chunks` 的锚在源码里、在 `clean()` 之后都存在且唯一 |
| `chunks_check` | 分段的形状、顺序、相接，以及页面 JS 与门切得一样（§7.3） |
| `exemption_check` | 例外豁免带 `why`、每页 ≤ 2、逐条打印（§4.4） |
| `source_ascii_check` | 程序体纯 ASCII（指令行豁免） |
| `source_bmp_check` | 无 BMP 之外的字符 |
| `source_indent_check` | 无制表符、缩进 4 的倍数、无行尾空白、单 LF 收尾（用 `tokenize` 认出多行字符串，不误报） |
| `blank_presence_check` | 每个程序至少一个空 |
| `blank_directive_check` | 指令成对、四属性齐全、id 页内唯一、`level ∈ 1..3`、挖空体非空、提示段数 == `level`（§5） |
| `program_meta_check` | id 全库唯一、闭集、白名单、双语、`problem` / `entry` 非空、没有手写派生字段 |
| `variant_check` | 多变体组内 `title.en` 互不相同；全库至少一个多变体组（§4.3） |
| `fixture_notes_check` | 源码引用 `_fixtures/<名>` 的程序，`notes` 中英两边都写出文件名并逐行手抄文件内容（复制按钮不带数据文件，#187） |
| `pygame_main_guard_check` | pygame 程序的顶层结构（§4.4） |
| `micropython_main_guard_check` | MicroPython 程序的顶层结构（§4.4） |

**D·词法**（`gates/lexer.py`）

| 门 | 守什么 |
|---|---|
| `lex_roundtrip_check` | 全库 + 畸形语料：token 无缝全覆盖，拼回去逐字节等于原文 |
| `lex_vs_cpython_check` | 与 CPython `tokenize` 比五类区间（§6.3） |
| `judge_strictness_check` | 判定器正负样例（§8.1） |
| `lex_never_throws_check` | 畸形语料全部平安通过 `PyLex.tokenize` |

**`algorithm_property_check` 的四条讲究**（`gates/library.py`、`gates/properties.py`、`gates/refs/__init__.py` 的文件头）：

1. **参照按程序 id 登记，按章一个文件**（`gates/refs/chNN_<slug>.py`，连字符换下划线）。同一 property 族名下两个机制不同的程序，参照也必须不同；
   「挂了 property 却没登记参照」是红不是跳过；登记了参照却没有对应程序也是红——那种参照一次都不执行，却让覆盖看起来更宽。
   参照必须与被测程序**机制不同**：标准库函数不自动算「不同」，要看源码（主规格 §2.3、裁决 R26）。
2. **逐层比值与类型**（#192，`_deep_mismatch`）：list / tuple 按位置、dict 按键、set 比元素类型，叶子比 type 与值——
   `[np.int64(3)]` 对 `[3]`、`[3.0]` 对 `[3]`、`(True,)` 对 `(1,)` 都红。
3. **被测与参照各拿一份实参的深拷贝**（#181）：被测函数就地改了实参时，参照不再看到被改过的对象。
4. **每次调用限时**（`PROPERTY_CALL_TIMEOUT`，#183）：SIGALRM 打断死循环，把它变成一条具名的红；导入另有 `IMPORT_TIMEOUT`。

`gates/refs/__init__.py` 的 `load_references()` **绝不抛**：`library.py` 导入期就读它，一抛，`check.py` 连 import 都过不去、零道门运行；
错误收进 `REF_ERRORS`，由门报红。

### 11.3 严格模式 `PYTHON_GATES_REQUIRE_SCIPY=1`

本地缺 numpy / pandas / matplotlib 时，scipy-stack 层程序跳过并计数，门保持绿——为的是不逼人人装库。
CI（`registry-sync.yml`）装**钉死版本**的 `numpy==2.3.1 pandas==2.3.0 matplotlib==3.10.3 pygame==2.6.1`，并设这个变量：
缺 `requires` 里任何一个库都**具名报红**。否则这些程序在任何地方都没跑过，门照样全绿（`_scipy_strict()` 的 docstring）。
变量名是历史原因，#196 起它也管 pygame。它作用在两道门上：

- `program_run_check`：只影响 scipy-stack 层（pygame 程序在这道门里本就只过 `compile()`，不会出现在跳过计数里）；
- `algorithm_property_check`：scipy-stack 与 pygame 两层；本地跳过时计数出现在「性质比对」那一行的末尾。

版本钉死是因为 numpy / pandas 的打印格式随版本变，`run.expect` 是在这组版本上生成的；升版本是一个单独的 PR、全层重生成。
`scipy` 在白名单里但 CI 不装它：要用，就在同一个 PR 里把它加进钉版本的安装步骤（主规格 §5.4）。
本地想看 CI 的判决，就设上这个变量再跑。

### 11.4 负控制

本仓最硬的一条规矩：「全绿」在负控制变红之前不是证据。每道门都要配一个具体的破坏动作，破坏前先跑基线确认是绿的，
从内存里的原字节复原、绝不 `git checkout`（主规格 §7.3）；负控制一律串行、只做保证终止的变异（第 2 期裁决 / #183，写进了 `python-drill-tool`「上报与负控制」）。
逐道门的「怎么把它弄红、红的形态是断言还是崩溃」在交接文档里。

---

## 12. 与根仓的接线

根 `CLAUDE.md` 列了「加一个子项目要碰的五个接线点」。python 在 e342ba2 的落点：

| 接线点 | python 的落点 |
|---|---|
| `scripts/apply_branding.py` | `BRAND_PAGES` 含 `python/index.html`、`python/app.html`；全部 python 页面带 `FAVICON` |
| `scripts/apply_footer.py` | `LANG_CFG` 有 `'python': ('python-lang', "'en'", '../privacy.html')`；`SUBPROJECTS` 由 `LANG_CFG` 的键派生 |
| 根 `index.html` | 第三张子项目卡片（`pythonCard`，accent `emerald`），由 `scripts/check_nav_contract.py` 的 `card_check` 守 |
| `.githooks/pre-commit` | python 段：暂存区碰到 `python/{core,programs,tools,scripts}/`、`python/python-tools.json` 或两个导航页时触发（见下） |
| `.github/workflows/registry-sync.yml` | 「python scipy-stack 与 pygame（钉版本）」装库一步 + 「python subproject gates」一步（设严格模式与无头 SDL / Agg）；python 的导航页与工具页也在根级内联脚本语法循环里 |

另外两道根级门也覆盖 python：`scripts/check_nav_contract.py`（六个导航页）、`scripts/apply_gallery_bg.py --check`（四个画廊）。

**钩子里 python 段做什么**：先记下两个导航页此刻是否已有未暂存改动；依次跑 `inline_core.py`、`build_programs.py`、`sync_fallback.py`
（都带 `--print-changed`），**只暂存它们打印出来的路径**；只有当 `sync_fallback.py` 重新生成了某个导航页、而那一页在钩子开始前就有未暂存改动时，
才不代为暂存那一页并中止提交请人核对（`.githooks/pre-commit` 的 `PY_FALLBACK_ABORT`）——导航页脏但 FALLBACK 没变，不中止；最后跑 `check.py`。
两点要知道：

- 生成脚本从**磁盘**读 `core/*.js`、`.py` 与注册表，不从暂存区读——别的会话未提交的改动会被卷进你的提交。钩子跑完要读 `git status --short` 的每一行（根 `CLAUDE.md`「Parallel work discipline」第 5 条）。
- 本仓共享的 git 配置里 `core.hooksPath` 是指向**主工作区** `.githooks` 的绝对路径，所以在 worktree 里提交时跑的是主工作区当前那份钩子脚本，
  它操作的却是提交所在 worktree 的文件。细节与后果见交接文档；是否改成相对路径待用户决定。

---

## 13. 作业方式

内容按**波**交付：一波（通常一个模块的几页）每页一个带独立 worktree 的构建子代理，构建者自己在注册表里追加本页条目并提交重新生成的导航页；
控制方把各页逐个合进一条集成分支，注册表与 FALLBACK 的冲突一律「取基线版本 + 补回本页条目 + 重跑生成脚本」，不手工合并；
亲验之后**整波终审一次、修复一轮、一波一个 PR**（主规格 §9）。开工前先有经用户审过的程序清单；每期结束有一个收尾 PR，
把本期的裁决与未决事项写进 `docs/superpowers/handoffs/` 下的 rulings / deferred 两个文件。

两个 skill 分工，本文不复制它们的内容：

| skill | 读者 | 内容 |
|---|---|---|
| `python-drill-tool` | 写程序、写页面的人（构建者、修复者、终审） | 碰什么不碰什么、每条硬规矩由哪道门守、没有门的规矩、生成 `run.expect`、写 property、三种作业（新页 / 加程序 / 升级）、负控制纪律 |
| `python-content-wave` | 控制方 | 集成 worktree、程序清单与原型、派发构建、集成、验收命令、浏览器验收、终审与修复、PR 与收尾 |

**skill 从哪里读**：`python-content-wave` 要求控制方开完集成 worktree 后用 Read 读 worktree 里的 skill 文件，而不是用 Skill 工具——
后者加载的是主工作区那份（该 skill「0. 开工准备」）。主工作区按用户 2026-09-30 的裁决跟 main：合并后在它干净时由期控制方 `merge --ff-only` 快进，
其余 git 操作仍不在主工作区做（用户裁决，由期 5 收尾 PR 记入）。所以它只会落后于未合并的分支、以及它不干净而没能快进的那段时间——
你自己分支上的 skill 改动，Skill 工具要等合并、快进之后才读得到。

各期规格在 `docs/superpowers/specs/2026-09-*-python-*.md`，各期裁决在 `docs/superpowers/handoffs/2026-09-*-python-phase*-{rulings,deferred}.md`
（第 0–4 期已在仓库）。第 5 期的两份按既有命名应为 `2026-09-30-python-phase5-rulings.md` / `-deferred.md`，由第 5 期收尾 PR 引入，
e342ba2 尚未进 `main`。每期的摘要与「最值得记住的一条」在交接文档。

---

## 14. 明确不做的事

主规格 §10 的六条仍然有效：浏览器里执行 Python；算法可视化 / canvas 动画；「多套答案都算对」的宽松判定；跨设备同步 / 账号；
自动出题 / AI 讲解；black / ruff 一类的格式化器与 linter 依赖。理由见主规格原表。

各期裁决里新增的、影响架构或内容边界的「不做」（出处在对应的 rulings 文件）：

| 不做 | 出处 | 说明 |
|---|---|---|
| 页面显示程序输出 | 第 1 期波 1 终审；第 5 期用户定论 | `run.expect` 只给门用；讲解与提示照「看不到输出」写（§1.2） |
| 为「复制进 PyCharm 缺 `_fixtures/`」做结构方案 | 第 1 期裁决 | 改为在讲解末段手抄文件名与内容，由 `fixture_notes_check` 守（#187） |
| 堆排序 | 第 2 期裁决 P11 B1 | 第 2 期定为不做，M3、M4 都不加；此后各期没有重开（至 e342ba2 全库没有堆排序程序） |
| t 分布的 p 值 | 第 4 期规格 / 裁决 | 检验入门的 p 值只用 `statistics.NormalDist`（z 检验）；t 检验只算统计量并与给定临界值比 |
| `boards` 写满「凑数」 | 用户裁决（boards PR 落地） | 不在考纲就不写、空列表合法（§4.5） |
| 分段的每段行数进门 | 第 5 期 chunks 设计 C8 | 只是取向；硬拆一个完整的 `main()` 更糟 |
| 为「照抄空」写门 | `python-drill-tool` | 至 e342ba2 靠作者自扫与终审；做成门的建议记在第 2 期账本 |

「不做」不等于「做不到」：它们都是有理由、有代价的取舍，理由与代价写在出处里。想推翻其中一条，先读出处，再在新的裁决里写清为什么现在不同了。
