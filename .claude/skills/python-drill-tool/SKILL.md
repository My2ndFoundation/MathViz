---
name: python-drill-tool
description: >-
  Add, extend or upgrade a Python practice page in the `python/` subproject of MathViz — a
  single-file page where a student reads worked programs, fills in blanks and shadow-traces them.
  Use this skill WHENEVER the developer wants to add a new `python/tools/py-*.html` page, add or
  change programs under `python/programs/ch*/`, write BLANK directives or hints, add a property
  check, or bump a python tool's version — even if they only say "加一页 Python 练习",
  "add programs for loops", "给 py-strings 加个程序" or "升级 py-basics". Do NOT use it for
  engine work in `python/core/*.js`, for the maths tools in `outputs/` (math-viz-tool), for
  `cryptography/` (crypto-viz-tool), or for `chess/`.
---

# Python 练习页 · 作者须知

`python/` 是 MathViz 的第三个子项目：**没有 canvas，没有运行时**。页面展示程序、挖掉几行让人填、
垫一层影子让人逐字临摹；浏览器里不执行 Python。程序是真的 `.py` 文件，**CPython 在构建期替你验**。

规格：`docs/superpowers/specs/2026-09-16-python-subproject-design.md`（主规格）、
`docs/superpowers/specs/2026-09-16-python-phase1-design.md`（第 1 期）。

## 你碰什么、不碰什么

| 你写 | 生成，**不要手改**（但重新生成的结果**要一起提交**） |
|---|---|
| `python/programs/chNN-<slug>/chapter.json` 与其中点名的 `.py` | `tools/*.html` 里的全部 `GENERATED:*` 区段 |
| `python/programs/chNN-<slug>/_fixtures/`（程序要读的数据文件） | `python/app.html` / `index.html` 的 `GENERATED:FALLBACK` |
| `python/scripts/gates/refs/chNN_<slug>.py`（property 参照） | `python-tools.json` 的 `programs` / `lines` |
| 新工具页：从 `tools/_skeleton.html` 复制后改那 6 处 | |
| 新工具页的注册表条目：自己追加进 `python/python-tools.json`（`desc` / `tag` / `changelog` 可以是草稿，控制方集成时审改） | |

生成脚本：`inline_core.py`（core → 页面）、`build_programs.py`（程序 → 页面 + 注册表计数）、
`sync_fallback.py`（注册表 → 两个导航页）。钩子（`core.hooksPath` 是指向主工作区 `.githooks` 的绝对路径）
在提交涉及 `python/` 时，会在**提交所在的 worktree** 上把三个生成脚本都跑一遍并代为暂存——但钩子脚本本身是主工作区当前分支那一份，可能是旧的，
所以提交前自己跑三个生成脚本与 `check.py`，提交后读 `git status --short` 的每一行。

为什么注册表条目由你自己加（第 1 期地基终审改；原先写的是「写进报告、由中央登记」，工具链上跑不通）：
`build_programs.py` 在工具页没有注册表条目时**硬错误退出**（`python-tools.json 里没有 id='py-…' 的条目，
无法回写 programs/lines`），`page_mirror_check` / `registry_check` 也要求条目存在——不先加条目，你一道门都跑不绿。

`lines`（选择器「不超过 20/40/80 行」筛的就是它，面板顶部也显示它）是源码按 `\n` 切、**去掉 BLANK 指令行**、
**不含文件末尾换行产生的那个空尾巴**之后的行数（Task 11c）——这是读模式/临摹模式里她真正看到的程序的长度，
挖多一个空不会让它变长。读模式的行号栏会因为文件末尾的换行多显示一个空行号，`lines` 不数它。

只要碰 `python/core/*.js`：`lineNotes` 这个词（剥掉注释之后）在 `core/` 里只放行三种位置——
① `panelLineNotes` / `noteLineIndex` **这两个函数的函数体内**（白名单读取点，体内出现几次都行）；
② STR 键表里 `lineNotes: { zh:…` 那**一行**声明；③ `t('lineNotes', …)` 这个独立调用。
落在这三种位置之外的任何一处都会被 `line_note_reader_check`（B 组）拦下。

## 硬规矩与守门

| 规矩 | 守门 | 门报红时说什么 |
|---|---|---|
| 程序能跑，stdout 逐字节等于 `run.expect` | `program_run_check` | `stdout 与 run.expect 不符`，附期望与实际 |
| 每个程序至少 1 个空 | `blank_presence_check` | `一个挖空都没有` |
| BLANK 成对；`id` / `level` / `hint` / `hintEn` 齐全；`level ∈ 1..3`；挖空体非空；`id` 在程序内唯一 | `blank_directive_check` | `缺 hintEn=`、`level=… 必须是 1、2 或 3` 等 |
| `hint` 与 `hintEn` 按 ` \|\| ` 切出的段数**都等于** `level` | `blank_directive_check` | `切出 N 段，但 level=M` |
| `\|\|` 必须写成两侧各一个空格的 ` \|\| `；标记落在整条提示的最前或最后，或两侧空白不止一个，同样算写错 | `blank_directive_check` | `疑似写错的分级标记` |
| 源码纯 ASCII（BLANK 指令行的 `hint=` 除外） | `source_ascii_check` | 点名行号与字符 |
| 整份 `.py` 不许出现非 BMP 字符（含提示里的 emoji） | `source_bmp_check` | 点名码位 |
| 4 空格缩进、无 Tab、行尾无空白、文件以单个换行结尾 | `source_indent_check` | 点名行号 |
| 无 BOM、无 CRLF、无杂散 C0 控制字节（`.py` / `chapter.json`、`core/`、`tools/`、两个导航页、注册表）——`source_indent_check` 读文件走通用换行，**看不见 CRLF**，这一条归它 | `control_byte_check`（B 组） | `以 UTF-8 BOM 开头` / `含 CR（CRLF 行尾）` / `含 C0 控制字符` |
| `.py` 里不许出现 U+2028 / U+2029 / U+0085（Python 与页面的 JS 对它们是不是换行意见不一）；页面自己的 `Exercise.parse` / `clean` 吃得下每个程序，挖空 id 与门的解析一致，`clean()` 行数与 `lines` 一致 | `js_parser_parity_check`（C 组） | `有 U+2028 …` / `Exercise.parse() 抛错` / `挖空 id 两边解析得不一样` / `嵌入页面的 lines=…` |
| `lineNotes.at` / `chunks.from/to` 是**整行原文**、存在且唯一、`clean()` 之后仍唯一 | `anchor_check` | `找不到` / `出现 N 次` / `在 clean() 后消失了` |
| `kind` / `level` / `boards` / `runtime` 在闭集；`title` `blurb` 双语；`notes` 是段落数组；`problem` `entry` 非空；不手写 `lines` / `source` | `program_meta_check` | 点名字段 |
| `requires` 是白名单 `numpy` / `pandas` / `matplotlib` / `scipy` / `pygame` 的子集（可以是空数组） | `program_meta_check` | `requires=… 必须是 … 的子集` |
| `"tier": "compile-only"`（普通 cpython 程序的例外豁免）必须带非空 `why`，每页至多 2 个 | `exemption_check` | `没有非空的 why` / `有 N 条例外豁免，上限是 2` |
| 源码里写了 `_fixtures/<名>` 的程序：`notes` 中英两边都写出文件名，并把文件的**每一行各自写成一段、连续、按原顺序**（比较时去掉每行首尾空白）；源码提到 `_fixtures` 却没写全 `_fixtures/<名>`（如 `Path("_fixtures") / "x"`）也算错 | `fixture_notes_check`（#187） | `没有提到文件名` / `没有把 _fixtures/<名> 逐行抄出来……缺这几行` / `不是按原顺序连在一起` / `却没有一处写成 _fixtures/<文件名>` |
| 带 `check.property` 的程序在 `gates/refs/` 里**同章文件**有参照 | `algorithm_property_check` | `没有它的参考实现` / `参照却登记在` |
| 参照与被测函数对 200 组随机实参给出同值同类型（**逐层**：list / tuple 按位置、dict 按键含键类型、set 比元素类型、叶子比 type，#192） | `algorithm_property_check` | `与参考实现不符`，附反例实参与 `首个差异：…` |
| 同一 `problem` 的变体标题互不相同 | `variant_check` | 点名组 |
| `chapter.json` 与目录里的 `.py` 双向一致 | `chapter_manifest_check` | 点名文件 |
| 工具页 `TOOL.id` / `accent` / `title` 与 `tool-engine` 等于注册表 | `page_mirror_check` | `TOOL.<字段> 与注册表不同` |
| accent 按模块配色表（M1 cyan · M2 violet · M3 emerald · M4 rose · M5 orange · M6 cyan · M7 violet · M8 emerald） | `accent_module_check` | `accent 应为 …` |
| 注册表 `version` == 页面 `tool-version` meta | `version_meta_check` | 点名两个值 |

**靠人（没有门，评审逐条核）：**
- **只挖写法唯一的行。** 判定严格比较引号风格、数字写法与相对缩进。一行若有同样好的另一种写法，
  使用者写出更好的答案会被判错——要么别挖，要么让提示把形式钉死。**这类「只是在两种同样好的写法
  之间选一种」的钉法放第 1 级提示**（她还没点开提示就写出另一种好写法时不该意外发现自己错了）；
  只有当写出这个钉法本身就等于把整行答案念出来时，才把它挪到最后一级。
- **提示逐级更具体，任何一级都不许给出答案原文。**
- **挖空答案不许原样出现在同一程序没挖的行上（「照抄空」）。** 把答案行去掉缩进，在同一个 `.py` 的其余行里逐字找一遍；找得到，这个空就成了抄上下文——
  换一行挖。第 2 期 M4 终审抓到 3 处（`hash-search-linear-probing` 的探测两行在同程序的查找函数里原样出现、`lcs-length` 的比较行在回溯函数里原样出现），
  修复时扫描又找出 2 处。**只由关键字和标点组成的行（`else:`、`finally:`、`try:`）不算照抄空**——这种行在任何程序里都长一个样，挖它考的是结构位置，不是抄写；
  其余的行，哪怕短如 `ops.append(token)`，也算。**近照抄也算**：从某一没挖的行上**剥掉一两层外壳**就得到答案——外壳指成对括号包住答案的部分：外层调用（`transpose(…)`、`round(…)`，开头、结尾各算一段）或切片（`[::-1]`）；
  删掉的每一段要么是外层调用头（`name(`）、要么只由闭括号组成、要么是完整的下标 / 切片（`[…]`），合起来括号配平、至多四段，**而且答案占那一行记号的一半以上**。第 3 期 `board-move-2048` 的 right / up 两空
  都能从未挖的 down 行剥掉 `transpose(…)` 或 `[::-1]` 得到，裁定为照抄空一类，改成挖 right 与 down、up 留作范例。
  删掉的是参数、运算项、`as e` 一类，或答案只是长行里的一小截，都**不算**：`return node` 之于 `return [node.value] + preorder(node.left) + …`、`node = node.left` 之于 `node.left = insert(node.left, value)` 不是抄。
  挖空模式下所有空同时隐藏，两个空之间互相抄不到，只看没挖的行。
  **没有门**（做成门很便宜，记在第 2 期账本里当建议）；写完自己扫本页，评审扫本波。
  存量：ch01–ch14 按逐字口径 5 处（M3 4 处、第 1 期 1 处，清单在第 2 期账本 §三.4），改它们要升版，留给下一个动那几页的内容 PR；
  近照抄口径没有人工清点（收尾时按上面的定义机扫全库另得 0 处——机扫只是近似，不替代逐空看）。
- **不挖跨嵌套块的多行空。** 判定器在答案与标准答案**行数不同**时完全不比缩进（`python/core/judge.js:162`，只在 `na.rel.length === nr.rel.length` 时比相对缩进），
  连改变语义的缩进也判对：三行的 `if a:` / `    if b: c()` / `d()` 被判等于 `d()` 缩进在外层 `if` 里的那四行。多行空只挖**同一层**的两三行，并用第 1 级提示钉住写法。
  （第 1 期账本 §一.3；判定器没改，第 2 期是靠这条规矩避开的——M3 26 个、M4 6 个多行空都在同一层。）
  **唯一的例外是「复合语句头（`if` / `for` / `while`）+ 一行体」这种两行空**：体写错缩进时行数不变、判定器照比（实测判 `indent`）。
  token 相同而行数不同的写法只有两种：写成一行 `if X: body`（语义与两行相同，判对是对的）；或在体里本来就有的括号里断行——后者若把体写到外层，
  判定器照样判对、CPython 报 `IndentationError`（`judge.js:162` 的同一个洞，罕见，接受）。
  第 3 期 ch21 有 6 个这样的空（5 个 `if` 头、1 个 `for` 头：`traffic-light-fsm`），终审接受。三行以上、或体不止一行的，仍按上面的规矩。
- 被挖的行里若有学生无从推断的文字（`input()` 的提示语、任意取的格式宽度），提示必须给出它，否则别挖。
- **挖空错误反馈从不打印字符串/f-string 字面量的原文**（Task 11b）：期待的 token 是一个字符串或
  f-string 时，她只会看到它的类别（一个字符串 / 一个 f-string）与自己写的原文从第几个字符起开始
  不同（1 起），或者「这里该有一个字符串/f-string」——绝不把标准答案的字面量文本印出来。对作者的
  推论：挖一行里带字面量是可以的，但如果那段字面量的准确文字**推不出来**（不是程序里写死的、notes
  里也没交代），就必须在某一级提示里把它给出来（或者只钉死那段推不出来的部分，其余留给她写）。
  **页面不显示程序的输出**（`run.expect` 只给门用），所以「看输出第几行就知道」不算推得出来，提示里也别写
  「和打印出来的一样」。第 1 期波 1 终审抓到 6 个这样的空（说明文字、文档串、`, studies at `），修法是最后一级给出那段文字。
- `notes` / `blurb` 在三种模式都显示，不许逐字写出挖空答案；`lineNotes` 只在读模式显示，挂在被挖那行上没关系。
  也别让**未挖的字符串**（表头、标题）改个大小写就是答案（波 2 de-morgan）。
- 讲解里指别的程序**写标题**，不写「下一个 / 上一个 / 本页最后一个程序」——页面可以筛选，顺序不可靠；提示里也一样，不用函数名指代别的程序
  （本程序里没有那个函数）。指别的**页**写注册表里的页名，用「」括起来：「递归的机制见「递归」一页」。**不用 `*星号*`**——`notes` 按纯文本渲染，
  星号会原样显示（第 2 期 M4 有 8 处）。
  也不写「捕获到的输出」「看输出第几行」「第一行是……」——她看不到输出；演示块算出的关键数字（计数、距离、路径）用文字在讲解里说出来。
  **notes 里也别举一个这道程序的挖空判定会判错的写法**当例子——「两种写法都对」的note配一个判定
  只认一种的题，是把她往错的方向带（review 在 ch01 抓到过这个）。
- 右侧的说明面板在三种模式下都显示这个程序的 level / kind / lines / 挖空数 / boards / tags（非
  cpython 的 runtime 也显示）——**boards 必须写准**，她看到的就是这一份。
- 中英文对等。`boards` 只有**确知**某考纲不含时才去掉；拿不准就上报，不猜。
- 一个知识点只在一页**讲**（页面边界见第 1 期设计 §6.5）；做过的问题不跨页重复。
- **递归「用，不重讲」**（第 2 期 M3、M4 两次裁决一致）：别的页的程序可以用递归，讲解只说这个结构 / 算法为什么自然分成子问题、基例是什么，
  不讲调用栈、基例与递归步的一般机制；需要时写「递归的机制见「递归」一页」；`tags` 带 `recursion`，让选择器能筛。建树的辅助函数用了递归也算。
- 输出确定：**不读时间**；写文件只写当前目录；数据文件放 `_fixtures/`，要输入就用 `run.stdin`。
  打印异常时只打印自己写的话或 `type(e).__name__`——内置异常的消息措辞随 Python 小版本变（`UnboundLocalError`
  在 3.9.6 与 3.12.9 上实测不同；`int()` 的 `ValueError` 在 3.9–3.12 恰好相同，别据此推广），学生本机不一定是 CI 的 3.12。
- **随机数只有一种写法**（第 3 期裁决；此前是「不用 `random`」）。**作用域：stdlib 层**——`runtime: cpython` 且 `requires` 为空的程序（M1–M5）：
  只用 `rng = random.Random(<固定种子>)` 这个实例，或把 `rng` / `seed` 当实参传进函数；
  **不用模块级的 `random.random()` / `random.choice()` 等**。`random.Random(20260930)` 的 `random / randint / randrange / choice / shuffle / sample / uniform / gauss / choices`
  在 CPython 3.9.6 与 3.12.9 上实测逐项相同，但这不是保证——**每个用到随机的 stdlib 层程序都在 `/usr/bin/python3`（3.9.6）与 3.12.x 上各跑一次、stdout 逐字节比对**，
  并同时跑一个版本相关的程序（`import sys; print(sys.version_info[:2])`）确认两边真是两个解释器（两次跑的若是同一个解释器，比对永远相同、什么也没测）。
  **scipy-stack 层（M6，`requires` 含 numpy）另有裁决**（第 4 期开工前，控制方定）：**numpy 的**随机数只许 `rng = np.random.default_rng(<固定种子>)` 这个实例，或把 `rng` 当实参传进函数；
  **不许 `np.random.seed`、模块级 `np.random.*`（`np.random.rand()` 之类）、`RandomState`**。流不变靠钉住的库版本保证（#191，主规格 §5.4 第 1 条：`numpy==2.3.1` 等，升版 = 单独 PR、全层 `run.expect` 重生成）；
  两解释器比对**不适用**——`/usr/bin/python3`（3.9.6）没有 numpy，`run.expect` 在钉住的那组版本上生成、由 CI（`PYTHON_GATES_REQUIRE_SCIPY=1`）核。
  同一层的程序若也用标准库 `random`，照 stdlib 层只许 `random.Random(<固定种子>)`（它的流只随 CPython 版本，上面已实测 3.9.6 / 3.12.9 一致）。
  讲解里说出的随机结果（估出的 π、频率、平均等待）写明「这个种子下」，并说明换种子会变。
- **交互程序**（井字棋、猜数、菜单）用 `run.stdin` 喂一串输入；`input()` 的提示语写进 stdout、不换行——讲解与提示照「页面不显示输出」写。
- **判「全是数字」用 `isdecimal()`，不用 `isdigit()`**：`'²'.isdigit()` 为真，`int('²')` 却抛 `ValueError`（第 3 期 m5a 终审 I1：`date-format-manual` 用 `isdigit` 在 `'²²/12/2024'` 上崩，而同模块的 py-systems 教的是 `isdecimal`）。
  存量 ch02 `string-method-tour` 的 `is_pin` 仍用 `isdigit`、提示还写着「不是 isdecimal」——见第 3 期账本 §二.8，别照抄。
- 复制按钮只复制 `.py`，**不带 `_fixtures/`**：学生粘进 PyCharm 时没有数据文件，讲解里的手抄是她唯一的来源。读 fixture 的程序在讲解里写明
  文件放在哪（`_fixtures/<名>`），并把文件**一行一段**地抄出来——`fixture_notes_check`（见上表）守它与真文件一致，改 fixture 时门会逼你一起改讲解。
  为什么是「一段一行」而不是「某段里包含这行」：讲解段落渲染成 `<p>`、`white-space: normal`，段内换行会塌成空格，她看到的仍是一行（#187）。
  推论：fixture 要短（取向 ≤ 8 行、每行不长），**不要空行**，行首缩进会被去掉——JSON 写成每行一个完整对象（或一行外框）的紧凑形式，抄出来仍能拼回原文件。源码里路径写全 `_fixtures/<名>`，不拼路径。
  **fixture 要被 git 跟踪，门看不见这一点**（门读磁盘）：根 `.gitignore` 的 `*.log` 曾静默挡掉 `_fixtures/access.log`——本地全绿、CI 会缺文件（第 3 期 m5a）。
  今天根 `.gitignore` 有反向规则 `!python/programs/*/_fixtures/**`（并继续忽略其下的 `.DS_Store`、`._*`）；提交后仍要 `git ls-files 'python/programs/<章>/_fixtures/*'` 对一遍磁盘上的文件。
- 整个程序约 10–40 行（不含 BLANK 指令行；是取向，不是门）。M5「综合运用」起放宽到**约 60 行**（第 3 期裁决）；超过的写进报告。选择器按 20 / 40 / 80 行分档，超过 80 行的会被「不超过 80 行」筛掉（第 3 期 `library-loans` 86 行）。
- 一般 2–3 个空（门只要求至少 1 个），**挖整行**。
- 本期**不用 `chunks`**。
- **每页至少一个变体组**（同一 `problem` 两个以上写法）——`variant_check` 只要求**全库**至少一个，管不到每页。
- **新造 `tags` 之前先 grep 全库已有写法**（`python/programs/*/chapter.json`），跟已有的走：选择器按 tag 筛，`nested loops` 与 `nested-loops` 分裂了就筛不全。
  第 3 期 m5b 终审抓到 8 个新造的分裂（`state` / `state-machine`、`comprehension` / `list comprehension`……），m5a 漏了 1 个（`lookup-table` / `lookup table`）；
  存量里的 `nested loops` / `nested-loops`、`2D list` / `list of lists`、`slice` / `slicing` 等清理（要升版），见第 3 期账本 §二.6。**没有门**。

## 一个程序长什么样

`.py`（注释英文；指令行从第 0 列开始）：

```python
"""Keep a number inside a range."""


def clamp(value, low, high):
    if value < low:
        return low
# >>> BLANK id=upper level=2 hint="和上面判下界的那两行写成对称的样子：同样是一个 if、下一行单独一个 return（不用 elif）；value 写在比较号左边，用严格的大于号 || value 超过上界 high 时，交回去的就是 high 本身" hintEn="Write it as the mirror image of the two lower-bound lines above: again an if with its own return on the next line (not elif); value on the left of the comparison, with a strict greater-than || When value is past the upper bound high, what comes back is high itself"
    if value > high:
        return high
# <<< BLANK
    return value


if __name__ == "__main__":
    print(clamp(5, 0, 10))
    print(clamp(-3, 0, 10))
    print(clamp(42, 0, 10))
```

（提示里的「；」和「; 」只是标点——分级只认 ` || `。）

这一空有好几种**同样对**的写法，判定只认一种，所以第 1 级就把选择钉死，而且不说出整行：

| 她可能写的 | 判定 | 第 1 级里钉住它的话 |
|---|---|---|
| `elif value > high:` | 错 | 不用 elif / not elif |
| `if high < value:` | 错 | value 写在比较号左边 / value on the left of the comparison |
| `if value >= high:` | 错 | 用严格的大于号 / with a strict greater-than |
| `return min(value, high)` | 错 | 同样是一个 if、下一行单独一个 return / again an if with its own return on the next line |

写示例时先把这张表列出来、逐条拿 `PyInteract.blankFeedback(写法, 标准答案)` 跑一遍：判错的每一条，
第 1 级提示里都得有一句话钉住它；钉不住又不想念出整行，就换一行挖。**判对的就不用钉**——比如
`if value > high: return high` 写成一行，判定认它与两行写法相同，提示里再去禁止它只会误导。

`chapter.json` 里对应的一条：

```json
{
  "id": "clamp-to-range",
  "file": "clamp-to-range.py",
  "problem": "clamp",
  "kind": "pattern",
  "level": 2,
  "boards": ["AQA", "OCR", "Edexcel", "CIE"],
  "tags": ["if", "return"],
  "requires": [],
  "runtime": "cpython",
  "entry": "clamp",
  "title": { "en": "Clamp to a Range", "zh": "夹进区间" },
  "blurb": { "en": "…", "zh": "…" },
  "notes": { "en": ["段落一", "段落二"], "zh": ["…", "…"] },
  "lineNotes": [ { "at": "    return value", "en": "…", "zh": "…" } ],
  "run": { "stdin": "", "expect": "5\n0\n10\n", "timeout": 5 },
  "check": { "property": "pure" }
}
```

`gates/refs/chNN_<slug>.py` 里对应的参照：

```python
from ._gen import rand_triples


def _value_low_high(rng):
    value, a, b = rand_triples(rng)
    return value, min(a, b), max(a, b)


REFERENCES = {
    'clamp-to-range': {
        # 被测的是「两个 if 各自提前 return」，参照取三个数排序后的中间那个：机制不同。
        'ref': lambda value, low, high: sorted((low, value, high))[1],
        'cases': _value_low_high,
    },
}
```

（这个问题不在第 1 期设计 §7 的清单里，也不在 ch01 里——照抄它当某一页的程序之前先对一遍 §6.5。）

## 生成 `run.expect`：粘贴真实输出，不要想

门在一个全新临时目录里跑：`_fixtures/` 拷成 `<临时目录>/_fixtures/`、`PYTHONHASHSEED=0`、
`PYTHONIOENCODING=utf-8`、`MPLBACKEND=Agg`、喂 `run.stdin`、超时 `run.timeout` 秒（缺省 5）。
照同样的条件生成，**用 Python 3.12**（CI 钉的版本；别的版本的 `repr` / 报错文字可能不同）。
第一个自变量是程序路径，第二个是超时秒数（与 `run.timeout` 相同，不给就是 5）：

```bash
python3 - python/programs/chNN-slug/prog-id.py 5 <<'EOF'
import json, os, pathlib, shutil, subprocess, sys, tempfile
prog = pathlib.Path(sys.argv[1]).resolve()
timeout = float(sys.argv[2]) if len(sys.argv) > 2 else 5
stdin = ''                                                  # 与 run.stdin 相同（改这里）
print('python', sys.version.split()[0])                     # 应是 3.12.x
with tempfile.TemporaryDirectory() as td:
    shutil.copyfile(prog, os.path.join(td, prog.name))
    fx = prog.parent / '_fixtures'
    if fx.is_dir():
        shutil.copytree(fx, os.path.join(td, '_fixtures'))
    env = dict(os.environ, PYTHONHASHSEED='0', PYTHONIOENCODING='utf-8', MPLBACKEND='Agg')
    r = subprocess.run([sys.executable, prog.name], cwd=td, env=env, input=stdin,
                       capture_output=True, text=True, timeout=timeout)
print('returncode', r.returncode)
print(json.dumps(r.stdout, ensure_ascii=False))   # 这一行原样粘进 "expect"
EOF
```

程序里读数据文件时写相对路径 `_fixtures/scores.csv`。

## property 检查

- 只在参照来得自然的地方加（纯函数、返回值可比），不强求。
- **参照的机制必须与被测程序不同。** 不能拿 `max` 当 `return max(a, b, c)` 的参照——那是拿自己验自己，被测程序错的地方参照会跟着错。
- **清单里写好的参照也要自己核对机制。** 标准库函数不等于「机制不同」：第 1 期波 2 的 `calendar.isleap` 在 3.12 的源码
  与被测的一表达式闰年**逐字相同**（`inspect.getsource` 一看便知），终审改成 400 年周期余数集合。参照与被测同源就上报。
- 比较是严格的：值相等**且类型相同，逐层**（#192）：`[3.0]` 对 `[3]`、`(True,)` 对 `(1,)`、列表里装着 `np.int64` 都是红。numpy 结果用 `.tolist()` 或逐元素转成内置类型——只在顶层 `list(arr)` 不够。
- **`entry` 不改实参。** 需要就地改的（排序、放哨兵、改网格），入口里先复制；原地算法另配一个 3 行包装（`result = list(items)` → 调原地函数 → `return result`）当 `entry`。
  #181 之后门给被测与参照各一份 `copy.deepcopy` 的实参，已经看得见「改了实参」这类错，但这条约定照旧：它让 `entry` 与参照可以并排比，
  也顺带讲清 `list.sort()` 与 `sorted()` 的约定（第 2 期 M4 排序页就这样写）。
- **门在自己的进程里调用被测代码**，所以它的盲区都长在这个假设上：被测函数改了实参，参照看见改过的对象（#181 前）；被测函数不返回，门跟着挂住（#183 前）。
  两个都是第 2 期起草清单时才发现的。今天的门：两边各拿一份深拷贝；每次调用限时 2 秒（SIGALRM），超时报「与参考实现不符」并写明「超过 2 秒没有返回」。
  写参照或 `cases` 时再想一句：被测代码还能通过什么副作用影响门的进程（全局状态、递归深度上限 1000、打印）？想到了就上报。
- **`@dataclass` 的程序现在可以挂 property**：门执行被测程序时 `compile(…, dont_inherit=True)`（#188），不再把 `library.py` 的 `from __future__ import annotations` 继承给它——
  之前注解全变成字符串，加上门给的 `__name__` 不在 `sys.modules`，`@dataclass` 在导入时崩（第 3 期 py-systems 的 `inventory-stock` 因此晚了一轮才挂上 P）。
- **用随机的程序，property 只挂纯核心函数**：随机数由驱动（演示块或一个 `simulate(seed, …)`）生成，当实参传进被检查的核心函数；`cases` 自己造这些实参（任意的 `(a, b)` 列表、任意的 ±1 序列），
  不经过被测程序的 rng。这样参照比的是确定值，不是「同一种子的另一份实现」（第 3 期 m5b 裁决 R2）。驱动里用 rng 的那一半只剩 `run.expect` 守，写进报告。
  参照若只能是同一算法（`shuffle-fisher-yates` 对 `Random.shuffle`，裁决 R3），在 refs 注释里写明它守什么、守不住什么。
- 慢的程序（朴素递归、博弈树）在 `cases` 里收紧实参范围，并写一句为什么（第 3 期 `ttt-minimax` 只取落了 k ≥ 3 步的局面，保证每次调用远在 2 秒以内）。
- **为区分两种写法专门加的 `cases` 分支，在 refs 文件头写明它守什么、别删**：`refs/ch20_text_data.py` 的上标数字分支是 `isdecimal` 与 `isdigit` 之别的唯一守门——
  复审实测去掉它、把被测改回 `isdigit`，门仍全绿；文件头原先写着「生成器只产出 ASCII」，照着「修正」就把守门删了（`:9-14` 现在写明了）。
- **`cases` 必须真的走到被测函数的每一个返回分支。** 随机生成器抽不到的分支，property 门对它就是瞎的：
  波 2 的三角形生成器从不产生正边长的等边三角形，把 `"equilateral"` 改成 `"isosceles"` 门仍全绿。
  做法：每个 `return` 分支各做一次变异、确认门红（或统计一次种子下各分支命中数写进报告），抽不到的分支按一定概率专门构造。
  第 2 期 M4 的实例：`search-comparison-counts` 的原 `entry` 根本走不到「找到」那一支；修成每次都命中的 `binary_found_total` 之后，
  「找不到」那一支又只剩 `run.expect` 守——**一个程序只有一个 `entry`**，两支不能都进 property（第 1 期账本 §二「一个程序要验两个函数」同一件事）。走不到的支写进报告。
- 注释里说明「它守得住什么变异」时，**举的变异必须先真跑一遍、看到门红**。`gates/properties.py` 文件头的 ⚠ 段记着一次反例：解释里举的两个变异，门一个都测不出来。

## 三种作业

**A. 新增一页**（命令都在仓库根目录跑）
1. `cp python/tools/_skeleton.html python/tools/py-<name>.html`，改文件开头注释列出的 6 处（description meta、tool-version、`<title>`、版本记录、`GENERATED:PROGRAMS none` 去掉 `none`、`TOOL` 块）。`TOOL.accent` 查上面的配色表；`TOOL.title` 必须与下面第 4 步注册表条目的 `title` 逐字相同（`page_mirror_check`）。`<title>` 元素里的 `&` 写成 `&amp;`（注册表与 `TOOL.title` 里照写 `&`；没有门看 `<title>`，第 2 期 M3 出过一次裸 `&`）。
2. 建 `python/programs/chNN-<slug>/`：`chapter.json`（顶层 `"module"` 与 `"tool": "py-<name>"`）+ `.py` + 需要时 `_fixtures/`。`run.expect` 照下面「生成 `run.expect`」一节粘贴真实输出。
3. 需要 property 时建 `gates/refs/chNN_<slug>.py`（章目录名的连字符换成下划线）。
4. **自己在 `python/python-tools.json` 的 `tools` 数组末尾追加本页条目**，字段顺序照已有条目：
   `id`（= `py-<name>`）/ `file`（`tools/py-<name>.html`）/ `accent` / `module` / `kicker` / `title` / `desc` / `tag`（后四个都是 `{"en": …, "zh": …}`）/
   `version` `"1.0.0"` / `engine`（与其他工具相同，= 页面 `tool-engine` meta）/ `programs` `0` / `lines` `0`（占位，第 5 步由脚本回写）/
   `changelog` `[{"version": "1.0.0", "date": "YYYY-MM-DD", "en": …, "zh": …}]`。`desc` / `tag` / `changelog` 写草稿即可。
5. `python3 python/scripts/build_programs.py && python3 python/scripts/inline_core.py && python3 python/scripts/sync_fallback.py && python3 python/scripts/check.py`
   ——`build_programs.py` 回写 `programs` / `lines` 并注入页面，`sync_fallback.py` 改写两个导航页的 FALLBACK。必须全绿。
6. **按显式路径一起提交**（绝不 `git add -A`）：`python/tools/py-<name>.html`、`python/programs/chNN-<slug>/`、
   （有的话）`python/scripts/gates/refs/chNN_<slug>.py`、`python/python-tools.json`、`python/app.html`、`python/index.html`。
   提交后读 `git status --short` 的每一行。

**B. 给已有页加程序**：第 2、3 步 + 第 5 步那一串命令；`build_programs.py` 回写注册表的 `programs` / `lines`
（FALLBACK 不含这两个字段，两个导航页不会变）。提交 `.py` / `chapter.json` / refs、`python/tools/py-<name>.html`、`python/python-tools.json`。

**堆叠分支之间的冲突**（多页并行时，`python-tools.json` 与两个导航页的 FALLBACK 必然冲突——都是数组末尾追加）：
**不手工合并。** 取基线分支（`main`，或你堆叠在其上的那个分支）的版本、补回本页条目、重跑生成脚本——配方写成了脚本，在停下的合并里跑：
```bash
# 你的分支合进来（你在基线分支上）：--take HEAD --from MERGE_HEAD；你在自己的分支上合基线：--take MERGE_HEAD --from HEAD
R=<worktree 绝对路径>
python3 $R/.claude/skills/python-content-wave/resolve-registry-conflict.py --repo $R --take MERGE_HEAD --from HEAD && git -C $R commit --no-edit
```
必须用 `&&` 接提交：脚本红了之后冲突在索引里已标为解决，单独一行的 `git commit` 会照样成功。
它取 `--take` 一侧的三个文件、把 `--from` 一侧多出的条目追加到 `tools` 末尾，冲突的工具页取 `--take` 一侧，
然后 `build_programs.py`、`inline_core.py`、`sync_fallback.py`、`check.py`，全绿才按显式路径 `git add`。
退出码 1（生成脚本或 `check.py` 红）时**照它打印的恢复命令做**，不要直接 `git merge --abort`（索引已 ≠ HEAD 时会失败）；
退出码 2（冲突落在别的文件上）与 3（同一个已有条目在 `--from` 一侧改过、又与 `--take` 一侧不同，见 C「升级一页」）什么都没动。
两侧的 `engine` 不同（有一侧改过 `core/`）时，`page_mirror_check` 会红——那不是配方能解的，先让两侧 engine 一致。

**C. 升级一页**：升级改的是已有条目，与别的分支合并时，只要改动在 `--from` 一侧、而 `--take` 一侧的这一条与它不同，配方脚本就以退出码 3 点名这一条、什么都不动——这一条手工处理并写明理由（这是「注册表冲突不手工改」的唯一例外），其余照配方。
版本三处同步——注册表 `version` + `changelog`（最新的放最前）、页面 `tool-version` meta、页面头部版本记录注释（右上角徽章读 meta，不用改）。改了 `core/` 时 engine 升一次，**所有工具与 `_skeleton.html` 一起升**（`page_mirror_check` 要求全库唯一）。版本号是缓存键：不升，线上用户会一直看到旧页面。

## 上报与负控制

- **「我的做法与简报不一致、而我的做法更对」本身就是上报项。** 简报或测试里的断言事实上错了，停下上报，不要改测试迁就实现。
- 你新写或改动的检查，要**先把它守的东西改坏、看到它变红**才算数；从内存里的原字节复原，绝不 `git checkout`；先跑一次基线确认是绿的。
- **负控制一律串行跑，不要并行**——并行跑会互相污染对方临时改的共享文件，两边的「基线是绿的」这个前提都不再成立。
- **负控制只做保证终止的变异。** 删 `visited.add`、删循环变量的更新这类可能死循环的不做：门有 2 秒时限之前，第 2 期一个这样的变异让门挂满 600 秒、
  swap 撑到约 21 GB、同机三个会话一起 ENOSPC（#183 由此而来）。子进程一律带超时——**本机（macOS）没有 `timeout` 命令**，
  用 Python `subprocess.Popen(…, start_new_session=True)` + `communicate(timeout=…)`，超时或被打断时（`except BaseException`；SIGTERM 先用 `signal.signal` 转成异常）`os.killpg(p.pid, signal.SIGKILL)` 杀整个进程组（`subprocess.run(timeout=…)` 只杀直接子进程，`check.py` 起的孙进程会留下）。
- **遇到 ENOSPC / 磁盘满：停下回报，不删任何不是你自己写的文件。**
- 报告「红」时附上变红那一行，并说明是**断言失败**还是**脚本崩溃**——崩溃的红与有效的红长得一样。
  门在被测**抛错或超时**时印的「参照返回：None」是占位（`library.py` 这时不再调用参照），不是参照真的返回了 None——引用时写「参照未计算」。
- **变异之后门是绿的，先问变异在语义上是不是等价**，再怀疑门：第 3 期 `competition-ranking` 把新名次 `place = position` 改成 `len(rows) + 1`——rows 每轮恰好多一行，两者恒等，是等价程序，门绿是对的。
  「等价」要对**整个程序**说，不只对挂 property 的函数说：Fisher–Yates 的 `range` 终点 0 改 -1，对 property 门是等价的（每次调用用新种子，多取的那一位在全部交换之后），
  对程序却不等价——`randrange(1)` 也消耗随机状态，演示块共用一个 `rng`，之后的输出全变了，`program_run_check` 断言红。所以它是「property 门看不见、`run.expect` 看得见」，不是「门绿是对的」。
  等价的变异不要写进 refs 注释当「门守得住的例子」；只对一道门等价的，注释里写清是哪道门看不见。
