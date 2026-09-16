# Python 子项目设计 · `python/`

> 状态：已评审通过，待出实施计划。
> 日期：2026-09-16

---

## 0. 本文的定位

MathViz 仓库里的**第三个子项目**，与 `chess/` 和 `cryptography/` 平级：共享仓库、部署、
设计哲学与「单文件 / 双语 / `file://` 可开」三条铁律，**不共享任何代码文件**。

它与前两个子项目有一处根本差异，值得写在最前面：

> **没有 canvas，没有运行时。** 主角是**代码本身**——展示它、挖空它、临摹它。
> 不做可视化动画，不在浏览器里执行 Python。

这条差异不是妥协，是定位。这套东西要解决的是一件很具体的事：**把 Python 3 的语法和
经典算法的标准写法练成肌肉记忆。** 使用者是一名在读 A-level Computer Science
（AQA 考试局）的学生，但内容**不受任何考纲约束**——目标是系统掌握这门语言与 CS
的经典算法问题，考试局只作为每道题上的**标签**（筛选维度），不是边界。

---

## 1. 目标与硬约束

### 1.1 要做的三件事

| 模式 | 做什么 |
|---|---|
| **读** | 带行号与语法高亮的只读展示；行注；同一问题多种写法的并排对照 |
| **挖空** | 源码里挖掉关键片段，逐空填写、逐空判定、分级提示 |
| **影子临摹** | 标准程序垫在底层（透明度可调，直到全透明 = 盲打），上面覆一层实时高亮的输入层，跟着打 |

三种模式外加一件贯穿的事：**一键复制**，把她打出来的（或原始的）程序原样送进剪贴板，
粘到 PyCharm 里直接能跑。

### 1.2 硬约束

1. **单文件、零依赖、`file://` 可开。** 每个 `tools/*.html` 是一个完整的页面，双击即用。
2. **整个 `python/` 目录被搬走后仍能独立运行。** 全目录只有一处父目录相对路径：
   `PARENT_HOME = '../app.html'`（`app.html` / `index.html` 各一份）。
3. **注册表隔离。** `python/python-tools.json` 只指向 `python/tools/*.html`；
   **绝不**把 Python 工具注册进根 `tools.json`，也绝不让本注册表指向 `../outputs/`。
4. **不提供运行时。** 浏览器里不执行 Python，不提供编辑并运行的环境。
5. **默认英文**（子项目惯例，契约 C7），中文随时可切。

### 1.3 「无运行时」的连锁后果

- **判定只能比写法。** 这是**有意选择的严格**，不是退让——练的就是肌肉记忆。
  Python 的多写法不靠放宽判定来容纳，而是**同一问题提供多个写法变体**，
  每个变体都是一个独立的、可读可挖空可临摹的程序。
- **第三方库反而不是问题。** numpy / pandas / matplotlib / pygame / MicroPython
  本来就跑不进浏览器；而她真正要练的正是把这些 API 一字不差地敲出来。
- **验证不在浏览器里做，在构建期做。** 见 §5：程序是真的 `.py` 文件，
  由门在 CI 上真跑、真比对输出。

---

## 2. 内容架构

### 2.1 八个模块（分组轴 `module`，闭集）

契约 §3 允许每个子项目有自己的分组轴：chess 用 `phase`，cryptography 用 `chapter`，
**python 用 `module`**，八个，由浅入深。

| # | 模块 | 工具页 |
|---|---|---|
| 1 | 语言基础 | `py-basics` `py-strings` `py-functions` `py-oop` `py-files-errors` |
| 2 | 控制逻辑 | `py-conditionals` `py-loops` `py-comprehensions` `py-recursion` |
| 3 | 数据结构 | `py-lists` `py-dicts-sets` `py-stack-queue` `py-linked-list` `py-trees-heaps` |
| 4 | 算法分析 | `py-searching` `py-sorting` `py-graphs` `py-dp-greedy` `py-complexity` |
| 5 | 综合运用 | `py-text-data` `py-simulation` `py-games` `py-systems` |
| 6 | 科学计算与数理统计 | `py-numpy-basics` `py-numpy-linalg` `py-pandas` `py-matplotlib` `py-statistics` |
| 7 | 图形与游戏 | `py-pygame-basics` `py-pygame-sprites` `py-pygame-motion` `py-pygame-games` |
| 8 | 嵌入式 Python | `py-microbit` `py-pico` `py-embedded-patterns` |

**35 页，每页 8–12 个程序，全库目标约 375 个。** 「精选」的意思是宁可一页只放 6 个
真正经典的，也不凑数——数量是结果，不是指标。下限 100 在第 1 期结束时越过（§9）。

各页要覆盖的内容见 §2.2 的清单。

### 2.2 各页内容清单

**M1 语言基础**

- `py-basics` — 变量、数值、类型转换、输入输出、f-string、运算符优先级
- `py-strings` — 索引切片、不可变性、方法族、`split`/`join`、格式化、转义
- `py-functions` — `def`、默认参数、`*args`/`**kwargs`、多返回值、作用域、`lambda`、文档串
- `py-oop` — `class`、`__init__`、方法与属性、`__str__`/`__repr__`、继承、多态、封装、组合、`dataclass`
- `py-files-errors` — `with open`、读写、CSV、`try/except/else/finally`、`raise`、自定义异常、`import`、`__main__`

**M2 控制逻辑**

- `py-conditionals` — `if/elif/else`、真值、短路、`and/or/not`、嵌套 vs 扁平、守卫子句
- `py-loops` — `while`/`for`/`range`、`break`/`continue`、`for...else`、累加/计数/极值/标志位/双指针
- `py-comprehensions` — 列表/字典/集合推导式、生成器表达式、`enumerate`/`zip`/`map`/`filter`/`sorted(key=)`
- `py-recursion` — 阶乘、斐波那契、汉诺塔、调用栈展开、递归 vs 迭代、记忆化

**M3 数据结构**

- `py-lists` — 列表操作、切片赋值、浅拷贝陷阱、二维表、矩阵
- `py-dicts-sets` — 字典 CRUD、计数、分组、查找表、集合运算、去重
- `py-stack-queue` — 栈、队列、循环队列、双端队列、括号匹配、逆波兰
- `py-linked-list` — 单链表、双链表、插入删除反转、与列表的对比
- `py-trees-heaps` — 二叉树、BST 增删查、三种遍历、堆、优先队列

**M4 算法分析**

- `py-searching` — 线性、二分（迭代/递归）、哨兵、哈希查找、复杂度
- `py-sorting` — 冒泡、选择、插入、归并、快排、计数、希尔、稳定性与复杂度对照
- `py-graphs` — 邻接表/矩阵、BFS、DFS、Dijkstra、A*、拓扑排序、MST
- `py-dp-greedy` — 记忆化、自底向上、背包、LCS、编辑距离、找零、活动选择、Huffman
- `py-complexity` — 同一问题的 O(n²) 与 O(n log n) 并列、插桩计数版、大 O 实证

**M5 综合运用**

- `py-text-data` — 词频、文本清洗、CSV/JSON 读写、简易解析器、正则入门
- `py-simulation` — 蒙特卡洛、随机游走、排队模拟、生命游戏
- `py-games` — 井字棋、猜数、Hangman、2048 核心、扫雷布雷
- `py-systems` — 成绩管理、库存、银行账户（OOP + 文件持久化 + 查找排序的综合体）

**M6 科学计算与数理统计**

- `py-numpy-basics` — ndarray、形状、索引切片、广播、向量化 vs 循环
- `py-numpy-linalg` — 矩阵运算、点积、解线性方程组、特征值、随机数生成器
- `py-pandas` — Series/DataFrame、读 CSV、筛选、分组聚合、缺失值、合并、排序
- `py-matplotlib` — 折线/散点/柱/直方、子图、标注、样式、保存
- `py-statistics` — 均值中位数方差、标准差、相关系数、线性回归、分布抽样、假设检验入门

**M7 图形与游戏**

- `py-pygame-basics` — 窗口、主循环、事件、帧率、绘图图元、颜色
- `py-pygame-sprites` — Sprite/Group、图像加载、动画帧、碰撞检测
- `py-pygame-motion` — 键鼠输入、向量运动、重力、反弹、摩擦
- `py-pygame-games` — Pong、贪吃蛇、打砖块、太空侵略者（分段可读）

**M8 嵌入式 Python**

- `py-microbit` — micro:bit MicroPython：点阵、按钮、加速度计、无线电
- `py-pico` — Raspberry Pi Pico：GPIO、PWM、ADC、中断、定时器
- `py-embedded-patterns` — 非阻塞主循环、按键去抖、环形缓冲、有限状态机、传感器滤波

### 2.3 一个程序的数据形状

元数据住在 `chapter.json`，源码住在同目录的 `.py` 文件里（§5）。

```json
{ "id": "bubble-sort", "file": "bubble-sort.py",
  "problem": "sort",
  "kind": "algorithm",
  "level": 2,
  "boards": ["AQA", "OCR", "Edexcel", "CIE"],
  "tags": ["sort", "quadratic"],
  "requires": [],
  "runtime": "cpython",
  "entry": "bubble_sort",
  "title":  { "en": "Bubble Sort", "zh": "冒泡排序" },
  "blurb":  { "en": "…", "zh": "…" },
  "notes":  { "en": ["段落一", "段落二"], "zh": ["…"] },
  "lineNotes": [ { "at": "        if items[j] > items[j + 1]:", "en": "…", "zh": "…" } ],
  "chunks": [ { "title": {"en":"…","zh":"…"}, "from": "def main():", "to": "    pygame.quit()" } ],
  "run":   { "stdin": "", "expect": "[1, 2, 5, 8]\n", "timeout": 5 },
  "check": { "property": "sort" } }
```

闭集约定：

- `kind ∈ { syntax, pattern, algorithm, project, embedded }`
- `level ∈ 1..5`
- `boards ⊆ { AQA, OCR, Edexcel, CIE }`
- `runtime ∈ { cpython, micropython-microbit, micropython-pico }`
- `requires` 取自白名单 `{ numpy, pandas, matplotlib, scipy, pygame }`
- `check.property` 取自一个**登记在 `python/scripts/properties.py` 里的闭集**，
  首批为 `{ sort, search, structure, pure }`。新增一个 property 必须**同时写出它的参考实现**
  （用 Python 标准库或一段显然正确的朴素实现），否则这道门就退化成「拿自己验自己」。
  `entry` 指名要被调用的那个函数；没有 `check` 的程序只受 `program_run_check` 约束。

派生字段**一律不手写**：`lines` 由脚本从 `.py` 数出来，注册表的 `programs` / `lines`
同理（§6.1）。手写的派生字段必然漂移——根 `CLAUDE.md` 已经为此付过一次学费
（62 条里 48 条静默漂了）。

`notes` 是**段落数组**而不是带 `\n` 的长字符串：JSON 里写中文散文只有这样才读得下去。

`lineNotes` 与 `chunks` **用整行原文当锚，不用行号**。行号会在编辑上方任何一行时
静默错位；行文本找不到或不唯一时，构建**当场失败**——失败得响亮，好过把注解挂到错的行上。

### 2.4 变体：同一问题的多种写法

`problem` 字段把同一问题的不同写法串起来（`binary-search-iterative` /
`binary-search-recursive` / `binary-search-bisect`）。读模式下它们在顶部排成一行标签，
可单看，也可**并排对照**（两栏同步滚动，差异行加底色）。

「Python 一个意思好几种写法」这件事，与其在判题时放宽，不如在这里正面教。

### 2.5 三条硬规矩

1. **参考答案就是源码本身。** 挖空体（`# >>> BLANK … # <<< BLANK` 之间那几行）在读模式下
   是正文、在挖空模式下是标准答案。不存第二份，也就没有第二份可以漂。
   因为 BLANK 指令是 Python 注释，**带着标准答案的那个 `.py` 文件本身就能跑、能被门验**。
2. **源码必须是纯 ASCII，注释一律英文。** 临摹是三层逐字符对齐，一个全角字符就让整行错位；
   而且 A-level 卷面本来就是英文。中文讲解走 `notes` / `lineNotes`，渲染在代码**旁边**
   而不是代码**里面**。这条有门（`source_ascii_check`）。
3. **缩进只用 4 个空格，源码里不许出现制表符，行尾 LF。** 复制粘贴进 PyCharm 必须原样能跑。
   这条有门（`source_indent_check`），运行时的另一半是编辑器的 Tab 键永远插 4 个空格。

---

## 3. 三种模式的交互

### 3.1 页面骨架

代码是主角（对应设计系统「canvas 是主角」那一条）：代码舞台铺满，所有面板浮在其上。

```
┌ 程序选择器（浮层，可收起） ┬────────── 代码舞台 ──────────┬ 讲解／提示／统计（浮层）┐
│ 筛选：难度 类型 考试局 长度 │  行号槽 │ 高亮代码区          │ blurb / notes           │
│ ○ binary-search · 迭代 L3  │         │                     │ 行注（点行号锚定）      │
│ ○ binary-search · 递归 L3  │         │                     │                         │
└────────────────────────────┴─────────┴─────────────────────┴─────────────────────────┘
          底栏：[读] [挖空] [临摹]      pip install numpy      [复制]
```

新增 token `--font-code`（`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`），
是 python 子项目自己的 token，不从数学设计系统借 `--font-math`。三层必须共用它。

### 3.2 模式一 · 读

行号 + 语法高亮，只读。有行注的行号旁点一颗小圆点，点行号讲解面板锚过去。
变体标签与并排对照见 §2.4。

### 3.3 模式二 · 挖空

指令形状（Python 注释，沿用 chess `exercise.js` 的语义）：

```python
# >>> BLANK id=mid level=2 hint="…" hintEn="…"
        mid = (lo + hi) // 2
# <<< BLANK
```

挖空体永远是**整行整行**的（两条指令行夹住中间），所以每个空渲染成一个占若干行的
**块级内联输入区**：左边行号槽显示 ①②③ 序号徽章，缩进由左侧固定前缀撑出，
输入区从缩进处开始、随打字长高。

- **逐空判定**，不是整篇判定。错了只报「第几个 token 起开始不同：期待 X，你写了 Y」
  并把光标送过去，**不给答案**。
- **分级提示**：每个空自带 `level`（1 给形状 / 2 给思路 / 3 只给一句路标），点一次展开一级，
  用了几级记进统计。
- **「填进去」**：放弃某个空，标准答案灰着填入，不计完成。
- Tab 在空与空之间跳；`Cmd/Ctrl+Enter` = Check 当前空。
- 完成后「复制我的完整程序」——把她填的合回整篇。

### 3.4 模式三 · 影子临摹

三层，共用同一字体、`line-height`、`padding`、`tab-size`：

```
层 3（顶）  透明 textarea      —— 收键盘，caret 可见，文字 color:transparent
层 2（中）  她打的内容的高亮   —— 逐字符对照，错处标红
层 1（底）  标准程序的高亮     —— opacity = α
```

- **α 滑块**：`描红 100%` → `淡影 35%` → `盲打 0%`，三个预设 + 连续滑块。
- **错字反馈三档**：`宽松`（行尾才结算）／`标红`（打错标红但放行，**默认**）／
  `硬拦截`（打错不接受这个字符）。
- **比对以行为同步单位、行内按位置对齐。** 纯位置对齐会让一行打错后面全红；
  每到行首重新对齐，错误就不跨行传染。
- **统计**：字符正确率（首次输入即正确的字符数 ÷ 参考总字符数）、速度（正确字符/分钟——
  Python 按词算没意义）、用时、退格次数、**逐行耗时热力**。
  计时在首次按键开始；失焦超过 10 秒暂停（否则她去倒杯水就把速度污染了）。
- **Python 专属的两件事**：
  - **Tab 键永远插 4 个空格**，绝不插制表符。
  - **Enter 自动缩进**：默认沿用上一行缩进，`:` 结尾再 +4。另有「跟随影子」开关
    （Enter 直接跳到标准程序下一行的缩进位）——缩进正是最该练的，所以**默认关**。
- **长程序分段临摹**：程序可声明 `chunks`（§2.3），临摹按段推进、逐段结算。
  缺省不分段；读模式不受影响。一个一百多行的贪吃蛇一口气盲打是惩罚不是练习。
- 「重打这一行」／「从这一行继续」。

### 3.5 贯穿三个模式

**一键复制**：读 = 原程序，挖空 = 合并后的完整程序，临摹 = 她打的缓冲区。
走 `navigator.clipboard`，失败降级到隐藏 textarea + `execCommand`
（`file://` 下 clipboard API 会被拒，这个降级是必须的）。成功给一个短暂 toast。

**剪贴板里只有纯源码。** `pip install …` 那行显示在按钮旁边，不进剪贴板——
粘进 PyCharm 必须直接能跑。

**键盘**：`1/2/3` 切模式，`[` `]` 上下一个程序，`Cmd/Ctrl+Enter` = Check，`Esc` 退焦点。

---

## 4. core 模块与编辑模型

### 4.1 模块清单

```
python/core/
  py-lex.js     Python 词法器 —— 高亮与判定共用同一份 token 流    ~500 行
  editor.js     三层编辑器：片段化高亮、行号槽、Tab/Enter、滚动同步  ~450
  exercise.js   `# >>> BLANK` 指令解析 → 挖空清单 + 占位版源码       ~300
  judge.js      token 级严格比对 + 第一处分岔定位                    ~250
  trace.js      影子临摹：逐字符比对、α、统计                        ~400
  store.js      localStorage：边输边存、进度、三级清空、配额兜底      ~350
  interact.js   页面装配：模式切换、选择器、筛选、快捷键、复制、toast  ~700
  _test.js      微型断言器（照 chess / cryptography）
```

全部是 UMD，node 与浏览器双用，`core/*.test.js` 配套。

### 4.2 `py-lex.js` —— 全覆盖、不抛错的词法器

唯一真正的新东西，也是整套的地基。比 chess 的 `interp.js`（2544 行，要真执行）小一个
量级，因为**只切词，不做语法分析，不维护 INDENT/DEDENT 栈**——高亮和判定都不需要。

要处理的 Python 细节：三引号字符串（跨行）、字符串前缀 `f`/`r`/`b`/`u` 及 `rb`/`fr`
组合与大小写、f-string 里的 `{expr}`、数字字面量（`0x` `0o` `0b` `1_000_000` `1e10` `1.5j`）、
`//` `**` `:=` `->` `@=` 一类多字符运算符、`#` 注释、反斜杠续行、装饰器、
软关键字（`match` `case` `type` `_`）。

**两条设计选择，都是为了三层结构：**

1. **词法器不抛错，且 token 区间无缝覆盖 `[0, len)`。** 遇到未闭合的三引号就一直吃到文件尾，
   遇到孤立反斜杠就当一个 op。这样「片段拼回去逐字节等于原文」这条不变量是**构造性成立**的，
   不是靠测试兜住的。
   chess 的 `editor.js` 走的是另一条路——tokenize 抛错就整篇降级成纯文本，代价写在它自己
   的注释里：「一个引号没有闭合期间，整份文档都会短暂失去颜色」。她打字打到一半源码几乎
   总是暂时不合法，那个代价会一直付。这里从设计上绕开它。
2. **高亮与判定读同一份 token 流。** 不另写一套正则高亮器——否则会出现「高亮说这是关键字、
   判定说不是」的分歧。

### 4.3 三层对齐的不变量

**片段拼回去必须与原文逐字节相同。** 片段文本一律用 `src.slice(start, end)` 现切，
绝不拿 token 的 `value` 去 stringify（`1e10` 会变成 `10000000000`，三层就错位一个字符，
caret 从此与文字对不上）。token 之间的空白也要单独产出片段。
门：`lex_roundtrip_check()`。

配套的 CSS 纪律：

- **必须关掉软换行**（`white-space: pre` + 横向滚动）。软换行让视觉行与行号脱钩，
  三层各自的换行位置还可能不同。
- 三层同步滚动由顶层 textarea 的 `scroll` 驱动，另外两层用 `transform: translate()`，
  不用 `scrollTop`——后者有子像素抖动。
- `font-variant-ligatures: none`。连字会把 `!=` 合成一个字形，和底层影子对不齐。
- 字体、`line-height`、`padding`、`tab-size` 三层逐字相同，由同一个 CSS 类提供。

### 4.4 `judge.js` —— 严格到什么程度，写死

| 归一化时吞掉 | 参与比对（不吞） |
|---|---|
| token 之间的空白 | 引号风格 `'a'` ≠ `"a"` |
| 注释 | 数字写法 `1e10` ≠ `10000000000` |
| | **空内部各行的相对缩进** |

最后一条是特意留下的：挖空体总是整行的，左侧缩进由占位块的前缀撑出，但空**内部**多行
之间的相对缩进由她打——而缩进正是 Python 最该练的东西。

token 化不是为了放宽，是为了**报错报得有意义**：能说「第 4 个 token 起不同：期待 `//`，
你写了 `/`」，而不是「第 37 个字符不对」。

### 4.5 `store.js` —— 边输边存与三级清空

键空间（全部 `python-` 前缀）：

```
python-lang                     'zh' | 'en'            ← 契约 C7
python-nav                      上次所在的工具 id       ← 契约 C7
python-store-v                  schema 版本号（将来迁移或安全丢弃）
python-prefs                    { alpha, strictness, followShadow, filters }
python-draft:<progId>:blank     她填的每个空
python-draft:<progId>:trace     她打的缓冲区
python-progress:<progId>        { blank:{done,hintsUsed,at}, trace:{bestAcc,bestCpm,at} }
```

**边输边存**：`input` 事件 → 防抖 400 ms 落盘；另在 `visibilitychange` 与 `pagehide`
立即 flush（切标签页、关窗口不丢）。

**三级清空**，每一级都二次确认且显示「将清除 N 条记录」：

| 粒度 | 入口 | 清掉 |
|---|---|---|
| 单题 | 程序选择器该项的 ⋯ 菜单 | 该题的 `draft:*`（可只清 blank 或只清 trace） |
| 整个模块 | 工具页顶栏 | 本模块所有页、所有题的 draft |
| 整个子项目 | 画廊/壳的设置 | 全部 `draft:*` + `progress:*`；语言与偏好保留。另有一个分开的「全部重置」连 prefs 一起清 |

> `store.js` **不认识任何一道题，也不认识模块**——清空 API 收一个 id 列表，
> 由调用方从程序库拿。这是 chess `exercise.js`「题目只活在调用方传进来的字符串里」
> 的同一条纪律。

**两个必须处理的失败面，否则就是静默的坏：**

- `QuotaExceededError`：写失败时降级到内存，并在顶部挂一条**持久横幅**——
  「浏览器存储已满，这次的输入不会被保存」。她以为存住了而其实没有，是这套东西最坏的失败方式。
- `file://` 下 localStorage 在部分浏览器禁用或每文件独立（Safari 尤其古怪）。
  每一次读写都包 try/catch，不可用时明说，不装作正常。

容量粗算：375 程序 × 2 模式 × ~1.5 KB ≈ 1.1 MB，对 5 MB 配额安全。

### 4.6 依赖惰性取（取代顺序门）

**全部模块惰性取依赖**：`factory(function () { return root.PyLex; })`，
而不是 `factory(root.PyLex)`。

理由取自两个子项目的对照：cryptography 用 `inline_order_check()` 强制
`CRYPTO-CORE` 排在依赖它的模块之前，因为那些模块在工厂里就抓 `root.CryptoCore`——
顺序错了页面加载干净、使用者第一次交互才死。chess 的 `editor.js` 把依赖改成惰性取，
那个坏从根上不存在。

随之而来的门也换了目标：**不查顺序，查有没有人在工厂参数里直接抓 `root.X`**——
那才是真实的坏，而且负控制一行就能造出来（`lazy_dep_check()`）。

### 4.7 编辑模型与内联

`python/core/**` 与 `python/programs/**` 是唯二编辑源。两个生成脚本写工具页的不同标记族：

| 脚本 | 写的区段 |
|---|---|
| `python/scripts/inline_core.py` | `GENERATED:PY-LEX` `EDITOR` `EXERCISE` `JUDGE` `TRACE` `STORE` `INTERACT` |
| `python/scripts/build_programs.py` | `GENERATED:PROGRAMS`（只注入本页那一章） |
| `scripts/apply_branding.py`（根） | `GENERATED:FAVICON`，以及导航页的 `GENERATED:BRAND-LOGO` |

**绝不手改 GENERATED 区段。** `python/tools/_skeleton.html` 参与内联，
**空的 `PROGRAMS` 列表是硬错误**（照 cryptography 的规矩：空正是疏漏呈现的形状）。

---

## 5. 程序库：真的 `.py` 文件

### 5.1 为什么

程序以真正的 `.py` 文件为编辑源，而不是嵌在 JS 字符串里。三个理由，第一个是决定性的：

1. **能真跑、能真验。** 「我挑的这段程序对不对、输出符不符合预期」从**我说了算**
   变成 **CPython 说了算**。这是根 `CLAUDE.md` 那条规矩的直接应用：
   拿独立实现去验，别拿自己验自己。
2. BLANK 指令是注释，所以**带着标准答案的文件本身就能跑**——§2.5 第 1 条从一句纪律
   变成字面事实。
3. 真文件有真的编辑器支持；而且没有「把 Python 源码塞进 JS 字符串」的转义地狱。

### 5.2 目录布局与管线

`.py` **不能在运行时读**——`fetch('bubble-sort.py')` 在 `file://` 下必然失败。
所以它是**构建期输入**，地位与 `core/*.js` 完全相同：

```
python/programs/ch04-sorting/
    chapter.json          ← 元数据（编辑源）
    bubble-sort.py        ← 程序（编辑源，真能跑）
    merge-sort.py
    _fixtures/scores.csv  ← 程序运行需要的数据文件
         ↓ build_programs.py   （写 GENERATED:PROGRAMS 区段）
python/tools/py-sorting.html
         ↓ inline_core.py      （写 core 的各个区段）
```

**不设中间的 `_generated/*.js`**：少一层生成物就少一处会漂的东西。
需要遍历全部源码的门（词法往返、ASCII、缩进、判定样例）**直接读 `.py`**——
读真源比读生成物更诚实。

章目录命名 `ch<NN>-<slug>`，其 `chapter.json` 的 `"tool"` 指向唯一一个工具页
（`ch04-sorting` ↔ `py-sorting`），`"module"` 必须与注册表里那一条的 `module` 一致。

`chapter.json` 的形状见 §2.3。`chapter_manifest_check()` 守三件事：
清单里点名的 `.py` 文件必须在；目录里的 `.py` 必须被点名；
**章目录与注册表工具页一一对应**（既不许有没人认领的章目录，也不许有没有程序的工具页）。

### 5.3 嵌入的转义与往返

`build_programs.py` 把源码按 JSON 字符串语义编码进 JS。两个必须处理的陷阱：

- 源码里若出现 `<` + `script` + `>` 字面序列（比如一段打印 HTML 的程序），
  生成的 JS 必须把它拆开或转义——否则 HTML 分词器会当场断页。
- 反斜杠、引号、换行一律走 JSON 编码，不自己手写转义规则。

门：`program_embed_roundtrip_check()`——从 HTML 里抠出 `GENERATED:PROGRAMS`，
用 `vm` 裸 context 解码，每一段 `source` 与磁盘上的 `.py` **逐字节比对**。

### 5.4 三层运行策略与具名豁免

不是每段程序都能在 CI 上跑。分三层：

| 层 | 覆盖 | 怎么处理 |
|---|---|---|
| **stdlib** | M1–M5，约 265 段 | 每次都真跑，本地与 CI 都跑 |
| **scipy-stack** | M6，约 45 段 | CI 里 `pip install numpy pandas matplotlib`，`MPLBACKEND=Agg`；本地缺库则跳过，并**打印跳过了几段** |
| **不可运行** | M7 pygame（要显示器 + 主循环不终止）、M8 MicroPython（要硬件），约 65 段 | 只过 `compile()` |

运行时的沙箱纪律：全新临时目录当 cwd（`_fixtures/` 先拷进去）、`PYTHONHASHSEED=0`、
喂 `stdin`（缺省空串，这样裸 `input()` 会 EOFError 而不是挂死）、5 秒超时、无网络。

**豁免分两类，只有第二类需要具名。** 单一阈值在这里是自相矛盾的：M7/M8 几乎整章都跑不了，
任何「一章里 compile-only 超过 N% 就红」的规则都会永远红。所以按**原因是否已经写在数据里**来分：

| 类别 | 判据 | 要求 |
|---|---|---|
| **结构性豁免** | `runtime != cpython`，或 `requires` 含 `pygame` | 自动、无需 `why`——原因已经在 `runtime` / `requires` 字段里，再抄一遍只会漂 |
| **例外豁免** | 一个普通的 `cpython` 程序仍标了 `compile-only` | **必须带 `why`**；每页至多 2 个；门每次运行都把全部例外**逐条打印出来**，不许它们安静地积累 |

理由和 cryptography 让空 `ALGOS` 列表当硬错误是同一条——**疏漏呈现出来的形状
就是「空着」和「默认豁免」**，所以第二类不能是无声的默认。

pygame 那一层还能再往前一步：程序按「逻辑函数 + `if __name__ == "__main__":` 里的主循环」
来写，门就可以 `import` 它（`SDL_VIDEODRIVER=dummy`）而不触发主循环，
再对纯逻辑函数（碰撞检测、贪吃蛇前进一步）做 property 检查。
这同时也是更好的教学代码结构。

### 5.5 `compile` 而从不 `import`（第三方库不必安装）

`compile(src, id, 'exec')` 不执行 import 语句，所以 `import numpy` /
`from microbit import *` 在编译门里**不需要装任何第三方库或 MicroPython 运行时**。
这是「无运行时」这条约束反过来送的礼物。
只有真跑的那两层才需要依赖，而且依赖被限制在 scipy-stack 那一层。

---

## 6. 注册表、导航壳、画廊

### 6.1 `python/python-tools.json`

```json
{ "schemaVersion": 1,
  "tools": [
    { "id": "py-sorting",
      "file": "tools/py-sorting.html",
      "accent": "rose",
      "module": 4,
      "kicker":  { "en": "Algorithms & Analysis", "zh": "算法分析" },
      "title":   { "en": "Sorting", "zh": "排序算法" },
      "desc":    { "en": "…", "zh": "…" },
      "tag":     { "en": "…", "zh": "…" },
      "version": "1.0.0",
      "engine":  "py-1.0.0",
      "programs": 14,
      "lines":    412,
      "changelog": [ { "version": "1.0.0", "date": "2026-…", "en": "…", "zh": "…" } ] } ] }
```

`programs` / `lines` **由脚本从 `programs/ch-*/` 数出来并写回**，绝不手写
（`program_count_check()`）。它们值得存在——画廊卡片上「14 个程序 · 412 行」是挑页面时
真正会看的信息——但**印一个错的数字比不印更糟**，所以必须有门。

`MODULE_LABELS` 是八个模块的闭集，`app.html` 与 `index.html` 两份必须逐字节相同
（对应 cryptography 的 `CHAPTER_LABELS`）。

accent 按**模块**固定，同模块同色、相邻模块异色：
M1 cyan · M2 violet · M3 emerald · M4 rose · M5 orange · M6 cyan · M7 violet · M8 emerald。
仍是契约 C6 的五色闭集，退路仍是 `--trace-unpaired`。

### 6.2 八条契约的落地

| 条款 | python 这边的做法 |
|---|---|
| **C1** 版本即缓存键 | `srcFor(id)`、`#btnAlone`、画廊 iframe（`regFingerprint()` 指纹）、每张卡片，四处全带 `?v=`。运行时 `tools.json` 映射里**必须抄 `d.version`** |
| **C2** FALLBACK 带 `version` | `minimal()` 必须吐 `version`；**第一天就上 `fallback_version_check()`** |
| **C3** 出站引用唯一 | 全目录只有一处 `../`：`PARENT_HOME = '../app.html'`；`wireParentLink()` 与既有四份逐字节相同 |
| **C4** 返回链接 `target="_top"` | 同上 |
| **C5** 画廊撑满舞台 | `.wrap{max-width:min(2600px,96vw)}` + 简介 4 行钳位 + 眉题/tag 省略号 |
| **C6** accent 闭集 | `ACCENTS` / `safeAccent()` 与既有四份逐字相同，退路 `unpaired` |
| **C7** i18n 两页同源 | `python-lang` / `python-nav`，`resolveLang()` 与 `t()` 兜底 **`en`**；壳听 `storage` 但绝不 `setFrame()` |
| **C8** 历史与 iframe | `contentWindow.location.replace()`；只有换工具 `pushState`；点当前项不出手，判断放在点击路径 |

> C2 那条是有前科的：规则同时写在根 `CLAUDE.md` 和 cryptography 自己的源码注释里，
> 而 54 条 FALLBACK 一个 `version` 都没有，直到 `fallback_version_check()` 落地才暴露。
> **文档写着「已修复」不等于修复了。**

---

## 7. 校验门

### 7.1 `python/scripts/check.py`

**A · 注册表与镜像**

| 门 | 守什么 |
|---|---|
| `registry_check()` | `schemaVersion`、字段齐全、semver 形状、`module ∈ 1..8`、`accent` 在五色闭集、id 唯一、**注册表与磁盘双向存在**（`_skeleton.html` 除外） |
| `fallback_check()` | 两个导航页的 FALLBACK id 集合 == 注册表 |
| `fallback_version_check()` | 每条 FALLBACK 都带 `version` 且与注册表一致 |
| `version_meta_check()` | 注册表 `version` == 页面 `tool-version` meta |
| `program_count_check()` | 注册表的 `programs` / `lines` == 从 `programs/ch-*/` 真数出来的 |
| `module_label_check()` | `MODULE_LABELS` 两页逐字节相同，且 1..8 一个不缺 |
| `accent_module_check()` | 同模块同色、相邻模块异色 |

**B · 可搬迁与卫生**

| 门 | 守什么 |
|---|---|
| `outbound_ref_check()` | `core/` `programs/` `tools/` 里零个父目录相对路径；两个导航页各恰好一处 `PARENT_HOME` |
| `script_literal_check()` | `.js` 里不许出现 `<` + `script` + `>` 字面序列（包括注释里）——`awk` 抽取会静默吞行 |
| `control_byte_check()` | 无 BOM、无 CRLF、无杂散控制字节 |
| `inline_check()` | `GENERATED:*` 区段与编辑源逐字节一致 |
| `lazy_dep_check()` | 没有任何模块在 UMD 工厂参数里直接抓 `root.X`（§4.6） |

**C · 语法与执行**

| 门 | 守什么 |
|---|---|
| `node_check()` | 每个 `tools/*.html` 抽出内联脚本过 `node --check`。`run_node()` **走 stdin**，并在 argv 过大时当场响亮拒绝——把 `MAX_ARG_STRLEN` 那个坑提前拦在本机 |
| `core_tests()` | 跑 `core/*.test.js` |
| `browser_branch_check()` | 用 `vm` + 裸 context 跑 UMD 的**浏览器分支**。`node -e` 和 stdin 都会定义 `module`/`require`，UMD 会走 node 分支——那样的门是在检查浏览器里根本不执行的代码 |

**D · Python 程序库（本子项目独有，价值最高）**

| 门 | 守什么 |
|---|---|
| **`program_run_check()`** | 全新临时目录里 `python3 <file>`，`PYTHONHASHSEED=0`，喂 `stdin`，5 秒超时，**比对 stdout 与 `expect`**；`_fixtures/` 先拷进去 |
| **`algorithm_property_check()`** | 把程序当模块导入，取 `entry` 函数，200 组随机输入，与 **Python 自己的 `sorted`/`bisect`/`heapq`** 对照 |
| **`lex_vs_cpython_check()`** | `py-lex.js` 的切词结果与 **CPython `tokenize` 模块**比对关键类别（NAME/NUMBER/STRING/COMMENT/OP）的起止位置 |
| `lex_roundtrip_check()` | `highlight(src).map(f=>f.text).join('') === src`，跑遍全库 + 一个畸形语料（未闭合三引号、孤立反斜杠、孤立引号、嵌套 f-string、BOM） |
| `program_embed_roundtrip_check()` | HTML 里的 `source` 解码后与磁盘 `.py` 逐字节相同（§5.3） |
| `chapter_manifest_check()` | 磁盘 `.py` 与 `chapter.json` 双向存在 |
| `anchor_check()` | `lineNotes` / `chunks` 的行文本锚在源码里**存在且唯一** |
| `exemption_check()` | **例外豁免**（普通 cpython 程序却标 `compile-only`）必须带 `why`，每页 ≤ 2，且每次运行逐条打印；**结构性豁免**（`runtime != cpython` 或依赖 pygame）自动放行（§5.4） |
| `source_ascii_check()` | 源码纯 ASCII（§2.5 规矩 2） |
| `source_indent_check()` | 无制表符、缩进是 4 的倍数、行尾无多余空白、LF 结尾（§2.5 规矩 3） |
| `blank_directive_check()` | BLANK 指令成对、`id/level/hint/hintEn` 齐全、id 页内唯一、`level ∈ 1..3`、挖空体非空 |
| `program_meta_check()` | id 全库唯一；`kind`/`level`/`boards`/`runtime` 在闭集；双语字段齐全；`requires` 在白名单 |
| `variant_check()` | 同一个 `problem` 的变体 ≥ 2 且标题互不相同 |
| `judge_strictness_check()` | 判定器正负样例：换空白/换注释 → 判同；换引号风格、换数字写法、改相对缩进 → 判异 |

### 7.2 两道「拿 CPython 当独立裁判」的门

`program_run_check` 与 `lex_vs_cpython_check` 是整套设计里最重要的两件事，
理由是同一条：**不要拿自己去验自己。**

- `program_run_check()` 证明程序跑得起来、输出稳定。**但它证明不了那个输出是对的**——
  一个写错的冒泡排序照样稳定地吐出一个错误答案，门还是绿的。
  所以算法类必须再叠一道 `algorithm_property_check()`：`bubble_sort(x) == sorted(x)`，
  200 组随机数据，用 Python 标准库当独立实现。
- `lex_vs_cpython_check()` —— 验证一个自己写的词法器，最坏的方式是用自己写的测试用例。
  CPython 的 `tokenize` 模块就是这里的「免费 OpenSSL」（根 `CLAUDE.md` 拿 node 的 `crypto`
  当独立实现，同一条规矩）。两边对 f-string 内部和空白片段的处理必然不同，
  所以门比的是**关键类别的边界**，需要一张**显式的类别映射表**——
  这张表本身要可读，因为它就是「我的词法器与标准的差别在哪」的完整清单。

### 7.3 负控制

本仓最硬的一条规矩：**「零问题」在负控制变红之前不是证据。**

每道门都要配一个具体的破坏动作，且必须**从内存里的原字节恢复**、绝不用 `git checkout`
（那会顺手抹掉别的会话未提交的工作）。每个负控制都要有**基线**：破坏之前先跑一次确认是绿的，
否则「红」可能是它本来就红。

| 门 | 破坏动作 | 期望 |
|---|---|---|
| `program_run_check` | 某程序里删掉一个冒号 | 红，且指名是哪个 `id` |
| `algorithm_property_check` | 把冒泡排序的比较方向反过来 | 红，报出反例输入 |
| `lex_vs_cpython_check` | 把 `py-lex` 的 `//` 切成两个 `/` | 红，报出位置分歧 |
| `lex_roundtrip_check` | 让词法器丢掉 token 间的空白片段 | 红 |
| `program_embed_roundtrip_check` | 手改 HTML 里某段 `source` 一个字符 | 红 |
| `anchor_check` | 把某条 `lineNotes` 的锚文本改掉一个空格 | 红 |
| `exemption_check` | 删掉某个**例外豁免**的 `why` | 红 |
| `source_ascii_check` | 往某段源码注释里塞一个中文字 | 红 |
| `source_indent_check` | 把某行的 4 个空格换成一个 Tab | 红 |
| `lazy_dep_check` | 把一个模块改成 `factory(root.PyLex)` | 红 |
| `fallback_version_check` | 删掉一条 FALLBACK 的 `version` | 红 |
| `check_nav_contract` | 把某一页的 `target="_top"` 删掉 | 红 |

---

## 8. 与根仓的接线

### 8.1 五个接线点

1. **根 `index.html`** 加第三张子项目卡片 → `python/app.html`，`target="_top"`，
   `href` 带 `?lang=`，accent 取 **emerald**（cyan/violet 已被 chess/crypto 占）。
   ⚠️ `sync_registry.py` **不管这三张卡片**（根注册表里没有它们的 id），今天没有门——
   所以纳入 §8.2 的新门。
2. **根 `CLAUDE.md`** 的「Subprojects」一节从两个子项目改成三个，写清 python 的特殊之处
   （无 canvas、无运行时、`.py` 是第二类编辑源、两个生成脚本）。
3. **`.githooks/pre-commit`** 与 **`.github/workflows/registry-sync.yml`** 各加
   `python3 python/scripts/check.py`。
4. **`scripts/apply_branding.py`**：它扫的是 `git ls-files '*.html'`——
   **新增的 37 个页面（35 工具 + 2 导航）不打品牌就会在 CI 上红**，
   而且是「本地全绿、CI 全红」那一类。两个导航页还要有 `GENERATED:BRAND-LOGO` 区段。
   这一步必须写进实施计划，不能靠想起来。
5. **`docs/superpowers/subproject-nav-contract.md`** 升到 v2.0：三个子项目、六个导航页、
   新的门与真实状态表。

### 8.2 还一笔债：根级 `scripts/check_nav_contract.py`

> **状态：已还清（契约 v2.0 / Task 15）。** 下面这段写于计划期，用的是当时的现在时。
> 保留原文是为了留下「这笔债当时长什么样」，但**它描述的已经不再是现状**——
> C4–C8 现在都有门，见 `docs/superpowers/subproject-nav-contract.md` §2。
> 一段用现在时断言「无机械门」的规划文本放着不管，正是契约文档 §4 记的那个形状：
> documented, believed, and false。

契约文档第 2 节那张表，**C4–C8 五条全是 ❌「无机械门」**（写计划时的状态），
理由写着「它们是行为，不是能用正则数出来的字段」。加第三个子项目正是这笔债变贵的时刻：
`wireParentLink()` 从四份变六份，`ACCENTS` 从四份变六份。

实测下来，C4–C8 里至少四条是能静态扫出来的：

| 条款 | 可扫的形状 |
|---|---|
| C3 / C6 「六份逐字相同」 | 抽出 `wireParentLink` / `ACCENTS` / `safeAccent` 三块，跨六页比 sha |
| C4 | 父链接那个 `<a>` 上有没有 `target="_top"` |
| C5 | `.wrap` 的 `max-width` 是不是 `min(2600px,96vw)` |
| C7 | `resolveLang` / `t` 的兜底字面量是不是 `'en'`；存储键前缀 |
| C8 | 有没有 `contentWindow.location.replace`；**`frame.src =` 出现在哪里**（实施时订正：不是「有没有出现」——四个壳里各有恰好一处，都是 `setFrame()` 里 `contentWindow` 为假值时的设计内退路；门查的是「全页恰好一次且在 `setFrame()` 体内、排在 `location.replace` 之后」） |

再加一条：根 `index.html` 的三张子项目卡片齐全且都带 `target="_top"`。

接进 `.githooks/pre-commit` 与 `registry-sync.yml`，并把契约表里的 ❌ 改成真实的 ✅。
**每条都要有负控制**——按本仓规矩，一道门在你把它守的东西改坏、看到它变红之前不算数。

### 8.3 顺手补 chess 的 `registry_check()`

chess 至今没有这道门（契约表里另一格 ❌）。我们正要给 python 写一个同形的，
顺手补给 chess：校验 semver 形状、字段齐全、**注册表里的 `file` 路径在磁盘上真的存在**。
chess 现在要到运行时才暴露一个写错的路径。

---

## 9. 分期交付与验收

| 期 | 内容 | 页 | 程序 |
|---|---|---|---|
| **第 0 期 · 地基** | `python/` 骨架、七个 core 模块 + 测试、三个脚本、全部门 + 全部负控制、根级 `check_nav_contract.py`、补给 chess 的 `registry_check()`、根 `index.html` 第三张卡、根 `CLAUDE.md`、契约文档 v2.0、`apply_branding.py` 跑一遍；外加**一个真页面 `py-basics`** 当活体验收 | 1 | ~10 |
| 第 1 期 | M1 剩余 + M2 | 8 | ~95 |
| 第 2 期 | M3 + M4 | 10 | ~120 |
| 第 3 期 | M5 综合运用 | 4 | ~40 |
| 第 4 期 | M6 科学计算与数理统计 | 5 | ~45 |
| 第 5 期 | M7 pygame | 4 | ~35 |
| 第 6 期 | M8 嵌入式 Python | 3 | ~30 |

程序数是**目标区间不是配额**：宁可一页 6 个真正经典的，也不凑到 12 个。
下限 100 在第 1 期结束时越过。

**第 0 期是唯一不能拆的一期**——门和负控制必须在第一个内容页之前就位，
否则后面每一页都是在没有网的高空作业。

每一页是一个 PR、由一个带独立 worktree 的子代理来建（`isolation: "worktree"`），中央注册。
并发纪律照根 `CLAUDE.md`「Parallel work discipline」五条执行，其中两条在这里特别相关：

- **不要 `git add -A`**，显式列路径。
- **`.githooks/pre-commit` 会重跑 `build_programs.py` 和 `inline_core.py`，它们从磁盘读
  `.py` 与 `.js`**——别的会话未提交的改动会被卷进你的提交。hook 跑完后要读一遍
  `git status --short` 的**每一行**，不是只在跑之前读。

### 9.1 每一期的验收

1. `python3 python/scripts/check.py` 全绿——**且这一期新加的每一道门都当场做过负控制、见过红**
2. `python3 scripts/check_nav_contract.py`、`python3 scripts/sync_registry.py --check`、
   `python3 scripts/apply_branding.py --check` 全绿
3. `gh pr checks <PR#>` **实际读一遍**——本机绿不算绿
4. `file://` 直接双击打开每一个新页面：三种模式都能用，`localStorage` 三级清空都生效
5. 随机抽三段程序，**点复制、粘进 PyCharm、真的跑一遍**——这是整套东西存在的理由，
   不能只靠门代劳
6. 临摹模式在三种缩放下三层不错位（这条没有机械门，靠看）

### 9.2 配套文档与 skill

- `docs/superpowers/python.md` —— 架构文档（对应 `cryptography.md`）
- `docs/superpowers/prompts/python-handoff.md` —— 交接文档：API 签名、易踩的坑、
  每一次实测发现的错误
- `.claude/skills/python-drill-tool/SKILL.md` —— 新增一页 / 新增一个程序 / 升级一页的作业流程
- `python/tools/_skeleton.html` —— 模板，参与内联，空 `PROGRAMS` 列表是硬错误

---

## 10. 明确不做的事（YAGNI）

| 不做 | 为什么 |
|---|---|
| 浏览器里执行 Python（Pyodide / Skulpt / 自写解释器） | 用户明确排除；且它会吃掉本该用来写程序库的全部预算 |
| 算法可视化 / canvas 动画 | 用户明确排除。这是本子项目与 chess/cryptography 的根本差异 |
| 「多套答案都算对」的宽松判定 | 严格比对正是肌肉记忆训练的手段；多写法靠**变体**容纳，不靠放宽判定 |
| 跨设备同步进度 / 账号 | `localStorage` 够用，且零后端是这个仓库的前提 |
| 自动出题 / AI 讲解 | 程序是精选的，不是生成的 |
| 代码格式化器 / linter 依赖（black、ruff） | `source_indent_check` + `program_run_check` 已经覆盖house rules，多一个依赖多一处 CI 差异 |

---

## 附：与前两个子项目的对照

| | chess | cryptography | **python** |
|---|---|---|---|
| 主角 | canvas 棋盘 | canvas 可视化 | **代码本身** |
| 分组轴 | `phase` | `chapter`（5，闭集） | **`module`（8，闭集）** |
| 默认语言 | en | en | en |
| 编辑源 | `core/**/*.js` | `core/**/*.js` | **`core/**/*.js` + `programs/**/*.py`** |
| 生成脚本 | `inline_core.py` | `inline_core.py` | **`inline_core.py` + `build_programs.py`** |
| 有无运行时 | 有（JS 子集解释器） | 有（算法实现） | **无** |
| 独立裁判 | — | node `crypto`（OpenSSL） | **CPython 本身：`compile` / `tokenize` / `sorted`** |
