# Python 子项目 · 第 3 期留给第 4 期的账

> 第 3 期（M5「综合运用」四页，两波并行：m5a = `py-text-data` + `py-systems`，m5b = `py-simulation` + `py-games`）已完成：
> **4 页、47 个程序**（m5a 23 + m5b 24），其中 37 个带 property 检查，`lines` 合计 1,790。
> 全库现为 23 页、**264 个程序**（其中 173 个带 property 检查）、`lines` 合计 7,494，门数 40 → **41**（新增 `fixture_notes_check`）。
> PR：#187（fixture 门，py-files-errors 1.0.1）· #188（门的 `compile` 加 `dont_inherit=True`）· #189（m5b）· #190（m5a）。
> 这份文件是**账本**，不是待办列表——每一条都记着**为什么当时没修**，以及**什么时候它会变成必须修**。
>
> **核对基线 `83e9eb9`**（#190 合并后的 main），收尾当天（2026-09-30）逐条实测；文中 file:line 都按它。
> 来源：两波控制方的台账（主工作区 `.superpowers/python-phase3/m5a-ledger/`、`m5b-ledger/`，gitignored，**不在仓库里**——
> 要留下来的，这里都抄全了）、复盘条目汇总 `.superpowers/python-phase3/retro-items.md`（1–26）、派发简报 `phase3-brief.md`、两份清单规格、四个 PR 的描述。
>
> 规格：`docs/superpowers/specs/2026-09-16-python-subproject-design.md`
> 两波清单：`docs/superpowers/specs/2026-09-30-python-phase3-m5a-design.md`、`-m5b-design.md`
> 裁决：`docs/superpowers/handoffs/2026-09-30-python-phase3-rulings.md`
> 前两期账本：`2026-09-30-python-phase1-deferred.md`、`-phase2-deferred.md`（两份的 §一 是同五件事，见下文 §一）

---

## 一、前两期账本 §一 的五件事：第 3 期之后

第 3 期派发简报 §1.5 要求「§一 列的存量问题新内容一个都别再加」。结论：**五件里第 2 件（fixture 手抄没门守）已修**（#187）；
其余四件新内容没有加、存量没有动。

「存量没动」的整体证明：`git diff --stat f82945d 83e9eb9 -- 'python/programs/ch0*' 'python/programs/ch1*'` 只报
`python/programs/ch05-files-errors/chapter.json`（+40 / −8，#187 把 fixture 那几段改成一段一行，`git log` 只有 `7b59f2a` 一个提交）；
`git diff --stat f82945d 83e9eb9 -- python/core` 为空。对照：同一命令换成 `'python/programs/ch2*'` 报出 55 个文件，路径模式是有效的。
`f82945d` 是第 2 期账本的核对基线，所以第 2 期账本记下的、落在 `programs/ch0*`（ch05 的 fixture 段落除外）、`programs/ch1*` 与 `core/` 下的 file:line 今天**逐字仍成立**。

### 1. 讲解与提示指向「页面上看不到的输出」

- **存量**：第 1 期列的 27 处（25 个程序）与第 2 期留下的 1 处都在。逐条重看了 10 处，行号一处没动：
  `ch01-basics/chapter.json:30`「注意输出的第一行」、`:71`「看 36.6C 那一行」、`ch02-strings/chapter.json:44`「输出的最后两行」、
  `ch03-functions/chapter.json:43`「输出的第四行和第六行」、`ch04-oop/chapter.json:72`「看输出第四行」、`ch08-comprehensions/chapter.json:614`「输出第三行」、
  提示 `ch03-functions/local-and-global-scope.py:7`「输出第一行就是它」、`ch04-oop/composition-has-a.py:22`「和输出第二行对上」、`ch04-oop/point-plain-class.py:10`「和打印出来的那一行一模一样」、
  `ch15-searching/chapter.json:539`「最后一行写着没找到」。#187 改过的 ch05 里，`ch05-files-errors/chapter.json:586`「两个程序输出的前三行完全相同」（missing-file-eafp）仍在。
- **新内容**：m5a 终审 I3 抓到 3 处（clean-text-normalise「本页第一个程序」、json-load-fixture「打印的第一行」、json-round-trip "The first thing printed"），修复实现者另扫出 2 处，全部改成说出值（`b8dfd0e`）；
  m5b 终审逐个核过讲解里的数字、0 处指向输出。今天用一个短语扫描（「看输出」「输出的第」「打印的第」「屏幕上」"first line printed" "in the output" 等）扫 ch20–ch23：**0 处**
  （唯一一处命中 `ch22-games/chapter.json:358`「屏幕上显示的一切都由这三样算出来」讲的是程序怎么算，不指向输出）。对照：同一扫描在 ch01 报出 6 处，含 `:30`。
- **为什么没修**：两波只管自己的页；「读模式显示 `run.expect`」仍等用户裁决（简报 §2 末条：本期照「页面不显示输出」写）。
- **什么时候必须修**：同第 2 期账本——用户定下两条路里的哪一条时。存量若走改写，仍是 28 处、10 页 bump。

### 2. 复制进 PyCharm 时没有 `_fixtures/`——手抄一致性**已修**

- **修了什么**：#187 加 `fixture_notes_check`（`python/scripts/gates/library.py:1311`，登记在 `python/scripts/check.py:120` 的 D·库 组）：源码里出现 `_fixtures/<名>` 的程序，
  讲解中英两边都要写出文件名，并把文件**每一行各自成段、连续、按原顺序**抄出来；源码提到 `_fixtures` 却没写全路径也报红。ch05 的 4 个程序的讲解改成一段一行（py-files-errors 1.0.0 → 1.0.1）。
  今天门认出 8 处引用（ch05 4 + ch20 3 + ch23 1），`check.py` 输出原话「讲解中英两边都逐行、按序抄出了文件内容并写出文件名」。
  #187 的负控制五个都是断言失败而红（删一行、两行对调、不提文件名、fixture 改一个字符、改成 `Path("_fixtures") / …` 拼路径）；m5a 控制方又在新内容上做了一次（passage.txt「flat!」→「flat?」，中英各一条点名缺的那一行）。
- **仍开着的**：复制按钮照旧只复制 `.py`（core 没改）——学生要照讲解自己建 `_fixtures/` 目录和文件，这一步没人验过（#190 列为未勾选项）；另有「fixture 必须被 git 跟踪」看不见，见 §三.2。
- **门把 fixture 拷进临时目录**的位置今天是 `library.py:146-148`（与第 2 期账本同）。

### 3. 判定器在行数不同时完全不比缩进

- **存量**：`python/core/judge.js:162` 仍是 `if (na.rel.length === nr.rel.length)`。今天重跑反例：
  `compare('if a:\n    if b: c()\nd()', 'if a:\n    if b:\n        c()\n    d()')` → `{"ok":true,…,"kind":"equal"}`；对照（行数相同、`d()` 缩进错）→ `{"ok":false,"index":3,"expected":4,"got":0,"kind":"indent"}`。
- **新内容**：扫 ch20–ch23 的全部 128 个空，多行空 9 个：ch20 0、ch22 0；ch23 1 个（`bank-transfer-atomic` 的 move-money，两行同层）；
  ch21 8 个，其中 2 个同层、**6 个是「if 头 + 一行体」**（`game-of-life-grid.py:11`、`game-of-life-set.py:17`、`random-walk-1d.py:11`、`:15`、`sir-epidemic-steps.py:28`、`traffic-light-fsm.py:29`，行号是指令行）。
  后者按字面不是「同一层」，但判定器挡得住：这种两行空唯一能改变行数的写法是写成一行 `if X: body`，语义与两行相同；
  实测 `compare('if abs(position) > farthest: farthest = abs(position)', 两行参考)` → equal，体缩进写成 0 或 8 → `kind:"indent"`。m5b 终审也判为「无跨嵌套块」。
  本收尾把这条例外写进了 `python-drill-tool`（原句「只挖同一层」，字面上会让下一个评审把这 6 个当违例）。对照：同一扫描在 ch10–ch19 上报出 31 个多行空（ch10–14 26 个、ch15–19 5 个）、0 个混层；第 2 期账本记的是「M3 26 个、M4 6 个都同层」——M4 那个 6 是终审在修复之前数的，差的 1 个没有追查。
- **为什么没修 / 什么时候必须修**：同第 2 期账本——改判定器是 core 改动；一个**必须**跨嵌套块挖三行以上的程序出现时，或第一次改 core 时先给 `judge_strictness_check` 加这条反例、看它红。

### 4. `boards` 的语义等用户裁决

- 264 个程序**全部**写满四家（实测 264 / 264）。两波都照「确知不含才去掉」写全，拿不准的见 §二.2。
- **什么时候必须修**：用户裁决之后；第 2 期账本 §二.2 与本账本 §二.2 两张清单一起过。

### 5. 程序打印内置 / 操作系统的异常消息

- **存量**：5 条都在，行号不变——`ch02-strings/index-and-slice.py:33`（`print("IndexError:", err)`）、`string-method-tour.py:27`、`strings-are-immutable.py:17`、
  `ch05-files-errors/multiple-except-clauses.py:11`、`missing-file-eafp.py:24`。
- **新内容**：ch20 / ch23 共 14 个 `except` 处理块，全部只打印或返回程序自己的话：自己 `raise` 的 `ValueError`（`config-parser.py:20/22`、`tokenise-loop.py:24`、`tokenise-regex.py:17` 的消息）、
  自定义异常（`TransferError`、`LoanError`、`OutOfStock` 的属性）、或写死的句子（`json-load-fixture.py:40` 的 `"KeyError: Chen has no tutor key"`）。ch21 / ch22 没有 `except`。
  对照：同一个扫描在 `ch02-strings/index-and-slice.py` 上报出 `:32 except IndexError as err: || print("IndexError:", err)`。
- **什么时候必须修**：照旧——CI 的 Python 版本升级（CI 今天是 3.12.14，#189 / #190 的日志）、或任何一条在新版本上漂了。

---

## 二、两波留账：内容

### 1. 程序长度：取向放宽到约 60 行之后

按 `lines` 的算法（去掉 BLANK 指令行、不含末尾空尾巴；全库合计 7,494，与注册表 `lines` 之和相同，口径对）：
第 3 期 47 个程序里 **17 个超过 40 行、5 个超过 60 行，5 个全在 ch23**——`library-loans` 86、`gradebook-classes` 67、`inventory-stock` 66、`bank-transfer-atomic` 64、`gradebook-json-persist` 63。
ch20 最长 48（`config-parser`）、ch21 最长 48（`game-of-life-grid`）、ch22 最长 53（`ttt-game-loop`、`ttt-minimax`、`minesweeper-flood-reveal`）。
全库超过 60 行的 8 个（另 3 个是第 2 期的 `doubly-linked-list` 61、`traversals-iterative` 73、`bst-delete` 68），超过 40 行的 44 个。

- **超过 80 行的只有 `library-loans`**：选择器「不超过 80 行」会把它筛掉。m5a 终审 Minor 8 给过两条省法（删从不被读的 `Book.title` / `Member.name`，或把 `add_book` / `join` 并进 `run_ops`，约省 6 行），都削弱「只存事实」或「类的职责」的示范，建议保持；m5a 控制方裁决 V2 留账。
- **为什么没修**：60 行是取向不是门；三个类协作是清单点名的要求。
- **什么时候必须修**：学生反馈临摹太长、或选择器的 80 行一档筛掉的程序不止这一个时。可能的修法与第 2 期账本 §二.1 相同（不临摹的共用前导，属 core / 数据形状改动）。

### 2. `boards` 拿不准的清单（交用户裁决 `boards` 语义时与第 2 期账本 §二.2 一起看）

没有一条逐条核对过考纲原文：

- **m5a**：正则（`regex-find-numbers`、`date-format-regex`、`name-swap-regex-sub`、`tokenise-regex`、`log-line-parser`——AQA 7517 有形式语言那一节，OCR / Edexcel / CIE 对 Python `re` 的要求不确定）；
  JSON（`json-round-trip`、`json-load-fixture`、`gradebook-json-persist`）；`decimal` 模块（`money-decimal`）；词法分析（`tokenise-*`、`config-parser`；
  终审补了一句「据我所知 OCR H446 与 CIE 9618 的编译阶段都点名词法分析」，未核原文）；分派字典（`menu-driven-cli`，函数当值）；
  测试数据三类（`test-data-normal-boundary-erroneous`，四家都考，列出只为核一下）。
- **m5b**：模拟 / 蒙特卡洛（`monte-carlo-*`、`dice-sum-frequencies`、`random-walk-1d`、`gamblers-ruin`、`queue-single-server`、`sir-epidemic-steps`）、
  生命游戏（`game-of-life-*`）、洗牌（`shuffle-*`）——都不是考纲明列的知识点，用到的编程技能在范围内；有限状态机（`traffic-light-fsm`：只确知 AQA 明列，CIE 有状态转移图）；
  minimax / 博弈树（`ttt-minimax`）；函数当值（`pig-dice-two-players`）；`zip(*board)` 星号拆包（`board-move-2048`）。
- **CIE 术语**：`test-data-normal-boundary-erroneous` 的讲解列了 CIE 9618 的 normal / abnormal / extreme / boundary 四个词，**不作逐项映射**（m5a 控制方裁决 V4：评审与复审对 abnormal 的范围说法不一，两方都没核考纲原文，不教可能错的映射）。核过考纲原文之后可以补映射。

### 3. 钉法缺口（范围复审之后留下的，都是少见写法）

m5b（范围复审 Minor 2 与 m5b 台账「留账」，行号按今天；**指令行与答案行分开写**，m5b 台账写的 `:11` / `:17` 是指令行）：
- `ch21-simulation/game-of-life-grid.py` on-board（指令 :11，答案 :12）：`0 <= r <= len(grid) - 1` 判错，第 2 级（「0 <= 下标 < 长度」）才钉。
- `ch21-simulation/game-of-life-set.py` rule（指令 :17，答案 :18）：`3 == n` / `2 == n` 第 3 级才钉；多加括号的 `(n == 3) or (…)`、`(cell in live)` 没钉。
- `ch22-games/board-move-2048.py` right（指令 :28，答案 :29）：`row[-1::-1]` 判错，第 1 级只说「步长为 -1 的切片」（不是现实写法）。

m5a（构建报告与复审里标为「罕见、未钉」「按例外放末级」、评审接受的）：
- `ch20-text-data/tokenise-regex.py:6`：字符类里运算符的**顺序**只在第 3 级钉（第 1 级再写顺序就念出整行；转义减号已挪到第 1 级）。
- `ch20-text-data/config-parser.py:13`：`line[1:len(line) - 1]` 第 3 级才钉（同上理由）。
- `ch23-systems/menu-driven-cli.py:19`：`0 < int(choice) <= …`、反向连写 `len(tasks) >= int(choice) >= 1` 只在第 3 级钉。
- `ch23-systems/test-data-normal-boundary-erroneous.py:12`：第 1 级「写出 buggy 版修掉差一错误之后的样子」已等于定死答案，第 2 级反而不如第 1 级具体（复审 Minor 3，控制方接受现状：这是裁决 M5A-D2 的「透明化」方案带来的）。
- 没钉的罕见写法：`word-frequency-file.py:17` 的 `(word in stopwords)`、`:22` 元组尾逗号；`money-in-pence.py:18` 的 `(pounds, pennies) = divmod(…)`；`test-data-…:34` 的 `assert (…) == expected`。

**为什么没修**：一次修复 + 一次范围复审，不开第二轮；都是少见写法。**什么时候必须修**：下次升级这几页时顺手修；学生实际碰到被判错时立即修。

### 4. 只由 `run.expect` 守的部分

property 只挂纯核心（R2）、一个程序只有一个 `entry`（第 1、2 期账本同一件事）之下的已知形状：

- **m5b**：`hangman-state` 的剩余命数与游戏循环、`minesweeper-place-count` 的 `place_mines`（用 rng 的那一半）、三个 ⌨ 程序（`ttt-game-loop`、`guess-computer-halving`、`hangman-state` 的循环）、
  `pig-dice-two-players`、`sir-epidemic-steps`、`shuffle-naive-biased`。
- **m5a**：`json-load-fixture` 的 `tutor_room` 与 KeyError 演示、`log-line-parser` 的 `summarise`、`tokenise-loop` 的错误消息原文（入口把它吞成 `None`）；
  无 property 的 `json-round-trip`、`gradebook-json-persist`、`inventory-csv-restock`、`menu-driven-cli`、`test-data-normal-boundary-erroneous`。

**什么时候必须修**：想让一个程序的两个函数都进 property 时——那要改门（一个程序多个 entry），属 `gates/`。

### 5. `shuffle-fisher-yates` 的参照与被测同一算法（R3）

参照 `random.Random(同种子).shuffle`（`python/scripts/gates/refs/ch21_simulation.py:250-260`，局限写在 `:251-258` 的注释里）：`Random.shuffle` 的源码就是 Fisher–Yates，
只是一个走 `randrange` 一个走 `_randbelow`。它守得住「下标范围 / 遍历方向写错」（`randrange(i)` 变异红、从前往后走红），守不住「算法本身错」——算法本身就是标准。
清单起草时实测：300 个种子 × 长度 0–11 在 3.9.6 与 3.12.9 上逐项相同；负控制 `randrange(i)` 3000 组里 2683 组不同。
**为什么没修**：Python编程 裁决接受（R3），另一个选项是不设 P。**什么时候必须修**：CPython 改了 `shuffle` 的实现（两者就不再逐项相同，门会红——那时改成只比统计性质，或不设 P）。

### 6. tag 词表分裂

m5b 终审 M6 抓到本波新造的 8 个 tag 与库里已有写法分裂，修复实现者统一了（`state`→`state-machine`、`comprehension`→`list comprehension`、`nested-loop` / `nested loops`→`nested-loops`、
`slicing`→`slice`、`function`→`def`、`grid`→`2D list`、`halving`→`binary-search`）。今天实测：

- **存量分裂**（改要 bump，m5b 修复报告与台账都记为留账）：`nested loops` 2（ch10 `grid-row-col-totals`、`matrix-multiply-loops`）/ `nested-loops` 15；
  `2D list` 7 / `list of lists` 6；`slice` 13 / `slicing` 1（ch16 `merge-sort-bottom-up`）。
- **m5a 新造了一处、没人抓到**：`lookup-table`（ch23 `gradebook-classes`）/ `lookup table`（ch11 `roman-to-int-lookup`）各 1。m5a 的终审简报没有要求查 tag（这一条是 m5b 终审自己查出来的），所以 m5a 没查。
  本收尾把「tag 先 grep 全库已有写法」写进了 `python-drill-tool` 与终审简报。
- **为什么没修**：改 tag 就是改内容，要给 py-lists / py-dicts-sets / py-sorting / py-systems 等页升版；收尾 PR 只改文档。
- **什么时候必须修**：下一个动这几页的内容 PR 顺手统一并升版；若要加门，先清存量（见 §三.4）。

### 7. 讲解用程序 id 指代兄弟程序

复盘条目 13 记的是「read-csv-split 讲解用 id 指代兄弟程序」。本收尾全库扫了一遍（notes / blurb / lineNotes 里出现别的程序的 id）：**26 个程序，全在 ch01–ch07（第 1 期）**，
中英两边都有——例如 `ch05-files-errors/chapter.json:105/116`（read-csv-split →「兄弟程序 read-csv-module」）、`:179/191`（read-csv-module → read-csv-split）、`:576/586`（missing-file-eafp → missing-file-lbyl）、
`ch01-basics/chapter.json:109/114`（max-of-three-if →「它的兄弟 max-of-three-builtin」）；按章：ch01 3、ch02 3、ch03 2、ch04 3、ch05 3、ch06 6、ch07 6 个程序。ch10–ch23：0 处。对照：扫描报得出 ch05 那一条（复盘条目点名的就是它）。
- **为什么没修**：「指别的程序写标题」是第 2 期 M3 清单 §7 才定的规矩（第 2 期裁决 P7），第 1 期内容早于它；改讲解要给 7 页升版。
- **什么时候必须修**：同 §一.1——下一个动这几页的内容 PR 顺手改。学生在页面上看到的是标题，id 她对不上号，所以这不只是文风问题。

### 8. `isdigit` 的存量

m5a 终审 I1 之后，作者规矩改成「判『全是数字』用 `isdecimal`」（`'²'.isdigit()` 为真，`int('²')` 却抛错）。本收尾扫全库 `.py`：
**`isdigit()` 后接 `int()` 的 0 处**；`isdigit()` 共 3 处，都不接 `int()`——`ch02-strings/password-rules.py:15`（只数有几个数字字符，无害）、
`ch02-strings/string-method-tour.py:12`（`is_pin`：`len(text) == 4 and text.isdigit()`）与 `:30`（演示行）。
**`is_pin` 这一空的第 1 级提示写着「不是 isdecimal 或 isnumeric」、第 2 级写着「每个字符是不是都是 0 到 9」**（`string-method-tour.py:11`）——
后一句对 `isdigit` 不成立（`is_pin('12³4')` 为 True），前一句与 py-systems / py-text-data 教的正好相反，同 m5a 终审 I1 一类。
- **为什么没修**：改提示要给 py-strings 升版；收尾 PR 只改文档。**什么时候必须修**：下一个动 py-strings 的 PR；学生先做 M5 再回头做 py-strings 就会撞上两条相反的规则。

---

## 三、门与测量看不见的

### 1. 等价变异：门看不见，也不该看见

记下来是为了**下一个做负控制的人别把它们当成「cases 的盲区」**（复盘条目 21：变异后门绿，先问变异是不是等价）：

- `competition-ranking`：新名次支 `place = position` 改成 `len(rows) + 1`——rows 每轮恰好多一行，两者恒等（m5a 控制方第一次负控制选了它、门绿，是选错不是门瞎；改选密集排名后断言红）。
- `shuffle-fisher-yates`：`range(len(items) - 1, 0, -1)` 的终点 `0` 改成 `-1`——多走一次 i = 0，`randrange(1)` 只能取 0、自换，多取的随机位在最后，结果不变（构建者 refs 注释原先称门能守，实测后改正）。
- `monte-carlo-pi-grid`：`<=` 改 `<`——两个奇数的平方和永远不等于 4n²（构建者声明，m5b 终审实测绿、确认等价；第 1 级钉 `<=`，第 3 级解释）。
- `minesweeper-flood-reveal`：`!= 0` 改 `> 0`——出队的格子不会是雷（m5b 终审实测绿）。
- `minesweeper-place-count`：`neighbours` 的边界放宽（`0 <= nx <= w`）或删掉「跳过自己」——出界格与自己本来就不在 `mines` 里（构建者报为「门盲点」，m5b 终审判为等价程序）。

### 2. 「fixture 必须被 git 跟踪」没有门（建议作第 42 道门）

`access.log` 被根 `.gitignore:23` 的 `*.log` 静默挡住：`git add` 跳过它，本地门全绿（门读磁盘），CI 上会缺文件。py-text-data 构建者用 `git add -f` 纳入，
m5a 控制方加了反向规则（今天 `.gitignore:55` `!python/programs/*/_fixtures/**`，`:56-57` 继续忽略 `_fixtures` 下的 `.DS_Store` 与 `._*`；负控制在临时仓库做：旧规则 `git add` 跳过 `probe.log`，新规则暂存它，别处的 `stray.log` 仍被忽略）。
今天 `git ls-files 'python/programs/*/_fixtures/*'` 与磁盘上 `find python/programs -path '*_fixtures*' -type f` 都是同样 6 个文件。
- **建议的门**：`git ls-files` 列出的 `_fixtures/*` 与磁盘上的逐一对比，磁盘有、索引没有就红（便宜；负控制：`.gitignore` 里临时加一条挡住某个 fixture 的规则，在临时仓库里看它红）。
- **为什么没做**：收尾 PR 不加门（简报：只改文档与 skill）；反向规则已让同一类坑今天不会再踩。另一个细节：门跑在 CI 的 checkout 上时，磁盘就是索引，这道门只在本地有意义——它要守的正是「本地绿、CI 红」。
- **什么时候必须做**：再有一个 fixture 被某条忽略规则挡住（例如有人往根 `.gitignore` 加 `*.json`、`*.csv`），或第一次给 fixture 建子目录之前。

### 3. 门在被测抛错时印「参照返回：None」

`python/scripts/gates/library.py:337`（被测超时）与 `:340`（被测抛错）把 `want` 填成 `None`、不再调用参照，`:359` 照样印「参照返回：None」。
读报告的人会以为参照真的返回了 None——m5a 修复报告里就这样引过一次（复审指出）。
- **建议**：被测抛错或超时时印「参照返回：（未计算：被测已抛错 / 已超时）」，或者照样算一次参照再印出来。
- **为什么没做**：收尾 PR 不改门；它不会让门判错，只会误导读报告的人。本收尾在 `python-drill-tool`「上报与负控制」里写了一句怎么读它。
- **什么时候必须做**：下次改 `library.py` 时顺手改（第 2 期账本 §三.5 建议的「威胁模型文件头」是同一时机）。

### 4. tag 规范化门（建议）

规范化后相同即红。**规范化只能折叠大小写、空格与连字符**——实测全库 391 个不同 tag，这样折叠后有 2 组撞：`nested loops` / `nested-loops`、`lookup table` / `lookup-table`；
若连下划线一起去掉，还会误撞 4 组本来就不同义的（`repr` / `__repr__`、`len` / `__len__`、`str` / `__str__`、`main` / `__main__`：内置函数与特殊方法不是一回事）。
`2D list` / `list of lists`、`slice` / `slicing` 这类同义不同形的，规范化门看不见——只能靠「先 grep 全库」的作者规矩。
- **为什么没做**：门一上线就会因存量红；先清存量要升版（§二.6）。
- **什么时候必须做**：再出现一次新造分裂之后；或者第 4 期（M6，会大量新造 `numpy` / `pandas` 一类 tag）开工之前，连同存量一起做。

### 5. `isdigit` → `int()` 的扫描（建议作门，或留作评审的一步）

本收尾扫过：0 处（§二.8）。**为什么没做成门**：今天没有违例，一个永远绿的门在负控制之外观察不到任何东西；已写进作者规矩与终审简报。
**什么时候必须做**：再有一个程序把 `isdigit` 用在转换之前时（m5a 一波就出了两个：`date-format-manual`、`tokenise-loop`）。

### 6. 只由一条 `cases` 分支守的规则

`gates/refs/ch20_text_data.py` 的 `_date_cases` 上标分支与 tokenise cases 里的 `chr(178)` 是 `isdecimal` 与 `isdigit` 之别**唯一**的守门——m5a 范围复审实测：去掉它们、把被测改回 `isdigit`，门仍全绿。
文件头 `:9-14` 已写明「两处例外是故意的，别修正掉」。本收尾把这条做法（为区分两种写法专门加的 cases 分支，要在 refs 文件头写明它守什么）写进了 `python-drill-tool`。
**什么时候必须回头看**：有人想把 refs 的生成器「统一成只产出 ASCII」时。

### 7. 主规格 §7.1 门表缺 `fixture_notes_check`

§7.1 自称「与 `GATES` 的门名与分组一一对应」，但 #187 之后 D·库 组是 14 道门、表里 13 行。#187 按简报 §6 不改主规格（由 Python编程 管），之后没人补。
**本收尾补了这一行**（与 §9 第 3 期行同一个提交）。

---

## 四、流程上的账

1. **Skill 工具加载的是主工作区的 skill。** 主工作区不 pull（今天仍停在 `533c813`，第 1 期波 1 复盘之后），所以 Skill 工具读到的 `python-content-wave` 永远是旧版——缺 #186 的 `checkout -B` 等修正。
   m5b 控制方第 0 步发现、改从集成 worktree 读（m5b 台账裁决 1：判错的代价是照旧版派发、构建者第一步全部失败）。
   已写回：`python-content-wave` 第 0 步「开完集成 worktree 后从 `$W/.claude/skills/` 重读本 skill」，简报模板也从 `$W` 取；构建者简报写明读自己 worktree 里的文件、不用 Skill 工具。
2. **构建者写不进集成 worktree。** #186 的模板让构建者把报告写到集成 worktree 的 `.superpowers/python-waves/<波>/`；isolation worktree 的规则拒写本 worktree 以外的路径
   （提示原话「Edit the worktree copy of this file instead of the shared-checkout path」）。4 个构建者里 3 个被拒（m5a 两个写进了自己 worktree 的同名相对路径，m5b 的 py-simulation 写进了 scratchpad），
   m5b 的 py-games 同样的路径却写成了——行为不稳定。终审员、修复实现者、复审员不是 isolation worktree，都写进去了。每个被拒的构建者都没有绕过，报告里写明了实际路径，控制方拷入台账。
   已写回：构建者报告写**自己 worktree** 的 `.superpowers/python-waves/<波>/<页>-report.md`，写不进就写 scratchpad 并在回复里给实际路径；控制方第 3 步集成前拷进集成 worktree 台账。
3. **权限拒 `rm` 与 `git add` / `git rm` 组合。** m5a 终审员删 `.superpowers/` 下的临时导出副本被拒（控制方代删）；m5a 复审员删 `.superpowers/python-waves/m5a/rereview-copy/` 被拒、留在原处；
   m5a 控制方在集成 worktree 里做 `.gitignore` 负控制时 `git add` / `git rm` 被拒，改在 scratchpad 的临时仓库里做（等价，且不碰共享索引）。
   已写回：评审 / 复审 / 修复的临时文件一律放台账下的 `review-tmp/` 子目录，删不掉就列出、控制方统一删；`.gitignore` 这类负控制在 scratchpad 的临时仓库里做。
4. **台账整目录拷走。** 第 2 期 M4 的台账只拷了 `*.md`，`m4-probe.js` 没保住，m5b 重写了一个。本期两波的台账目录都连脚本拷走了（`m5a-probe.js`、`m5b-probe.js`、`negctl.py`、`copy-run.py`、`two-interp.py` 等都在）。
   已写回：第 7 步写成 `cp -R <台账>/. <目标>/ && diff -rq <台账> <目标>`。
5. **浏览器对齐探针第一次量到了换行符。** py-simulation 第一次量的「同一个字符」是行末的 `\n`，矩形退化，dx = 0 可能是假阴；改量可见字符（从末尾往前找第一个非空白字符）复测，
   并报出字宽随缩放的变化（7.05 / 7.83 / 9.80）证明缩放真的生效（m5b 台账裁决 8）。已写回 `python-content-wave`「浏览器验收」。
6. **两解释器比对的记录里有一个口径差。** `m5b-ledger/two-interp.txt` 写「uses random: 11」，是按源码里出现子串 `random` 数的，多出来的是 `monte-carlo-pi-grid`（文档串「without randomness」）；
   台账正文写的「构造 `random.Random` 的恰好是清单 🎲 的 10 个」是另一次正则扫描。本收尾重扫：构造 `random.Random(` 的 10 个文件与清单 🎲 逐一相同；
   模块级 `random.<函数>(` 调用 0、读时间 0（模式先断言 `random.choice(xs)` 命中、`rng.choice(xs)` 与 `random.Random(1)` 不命中）。
7. **遗留的 worktree 与分支：第 3 期一个没留。** 今天主仓库仍是 46 个 `worktree-agent-*` 分支、16 个 `.claude/worktrees/agent-*` 目录——与第 2 期账本 §四.5 记的数相同；
   台账里记下的 4 个构建者原分支（`worktree-agent-a179752b…`、`-a7abb180…`、`-ae77f394…`、`-a3a3295b…`）与集成、构建者、fixture-gate 分支都已删（本地 `git branch --list` 0 条；
   origin 上 `git ls-remote --heads` 共 20 条、没有一条 python 分支）。第 2 期写回的「构建者第一行报原分支名、控制方按台账清理」这一次完整走通了。第 2 期留下的那 46 / 16 仍然归属不明，本收尾不删。
8. **设计 §9.2 的两份文档仍未写**：`docs/superpowers/python.md` 与 `docs/superpowers/prompts/python-handoff.md`（今天 `ls` 都不存在）。第 2 期账本说「第 3 期派出第一个构建者之前」必须写，没写；
   第 3 期的 fixture 问题靠 #187 的门与简报解决了，构建者读得到规则。**什么时候必须修**：第 4 期（M6 scipy-stack，`program_run_check` 第一次要装第三方库）开工前——那一层的运行策略只写在主规格 §5.4。
9. **用户验收仍未做**：4 个新页面的 `file://` 双击打开、复制程序粘进 PyCharm 真跑（含**照讲解手工建 `_fixtures/`**）——#189、#190 都列为未勾选项；前 19 页同样未做。
10. **三个等用户的决定照旧**：`boards` 语义、页面是否显示 `run.expect`、`core.hooksPath` 是否改成相对路径。本期都照现行规则、没有停下（简报 §2）。
11. **m5a 的 `git-size-before.txt` 没记测量时点**：m5a 台账第 0 步没有这一行，文件时间戳是拷贝时间；它比 m5b 的开工前多 21 个对象，应是晚于 m5b 测的。§五 照录。

---

## 五、体积

**页面**（今天实测 `83e9eb9`）：23 页合计 **6,624,379 B**（逐页 gzip -9 之和 2,211,273 B），平均约 288 KB/页。
新 4 页合计 1,229,236 B：`py-text-data` 327,800（**现在最大的一页**）、`py-systems` 304,859、`py-games` 299,001、`py-simulation` 297,576。
前 19 页合计 5,395,143 B，比第 2 期账本记的 5,394,371 B 多 772 B——全部来自 `py-files-errors`（301,502 → 302,274，#187 把 fixture 那几段拆成一段一行）。core 没改（`git diff` 为空），每页的 core 份额与第 2 期相同。

**仓库**（`git count-objects -vH`，字段 `count` · `size` · `in-pack` · `size-pack`；整个仓库共用一个 `.git`）：

| 时点 | count | size | in-pack | size-pack | 出处 |
|---|---|---|---|---|---|
| 第 2 期收尾（#185 合并后） | 1505 | 17.07 MiB | 6776 | 26.47 MiB | 第 2 期账本 §五 |
| m5b 开工前（`b0e0a80`） | 1557 | 17.42 MiB | 6776 | 26.47 MiB | `m5b-ledger/git-size-before.txt` |
| m5a 开工前（时点未记，见 §四.11） | 1578 | 17.72 MiB | 6776 | 26.47 MiB | `m5a-ledger/git-size-before.txt` |
| m5b 波后（#189 合并后） | 1838 | 20.63 MiB | 6776 | 26.47 MiB | `m5b-ledger/git-size-after.txt` |
| m5a 波后（#190 合并后） | 1874 | 21.06 MiB | 6776 | 26.47 MiB | `m5a-ledger/git-size-after.txt` |
| 收尾当天 | 1874 | 21.06 MiB | 6776 | 26.47 MiB | 本收尾在主工作区实测，2026-09-30 12:06 |

第 3 期增量全是松散对象（第 2 期收尾以来 +369 个、+3.99 MiB），pack 没变（`prune-packable` 801，与第 2 期相同，下次 gc 会并进 pack）。
这一次两波的波前 / 波后量**都进了台账文件**（第 2 期写回的 `git-size-before.txt` / `git-size-after.txt` 生效了）。
第 1、2 期账本的担心照旧：**第一次改 core 会重写全部 23 页**；到时量一次。

---

## 六、原描述错在哪（收尾核对发现）

照前两期的惯例：

1. **复盘条目 13 只点了 read-csv-split**：全库用 id 指代兄弟程序的是 26 个程序（ch01–ch07），见 §二.7。
2. **m5b 台账与范围复审把两处钉法缺口记在 `game-of-life-grid:11`、`game-of-life-set:17`**：那是 BLANK 指令行，答案行是 `:12`、`:18`（第 2 期账本 §六.3 同一类）。
3. **`two-interp.txt` 的「uses random: 11」** 是子串计数，不是「用随机的程序数」（§四.6）；10 才对。
4. **py-simulation 构建报告说「10 个模拟类程序用 `project`」**：今天 ch21 是 `project` 9、`algorithm` 2、`pattern` 1（报告自己的分法 10 + 1 + 2 = 13，多于 12 个程序）。
   另：m5a 台账说 `kind: "project"` 是「全库首用（py-systems 7 个）」——同一天 m5b 也在用，今天全库 18 个（ch21 9、ch22 2、ch23 7）。
5. **复盘条目 7 说 tag 分裂「本波 8 个」**：那是 m5b 一波；m5a 另有 1 个（`lookup-table`）没人查到（§二.6）。
6. **派发简报 §1.2 写「报告与台账放集成 worktree」**：对构建者不成立（§四.2），是第 2 期收尾（#186）写回的模板带来的；控制方、评审、修复者成立。
7. **派发简报 §3 写「notes 中英两边都必须逐行包含 fixture 的每一行」**：按子串理解，ch05 原来的「行 / 行」写法对它是绿的，而页面上 `.py-note` 是 `white-space: normal`，段内换行塌成空格；
   #187 的作者改成「各自成段、连续、按序」并在 PR 里申报了偏离，Python编程 采纳（见裁决文件）。
8. **m5b 清单 §6 的 2048 示例 `[2, 2, 2, 2]`** 触不到 stack 版的「刚合并」标志（删掉标志照样得到 4, 4）；py-games 构建者改成 `4, 0, 4, 8` 并用负控制证明。清单作为 `cases` 用例本身是对的。
9. **m5b 清单 §2.1 说 `monte-carlo-pi-random` 的参照「用 `math.isqrt` 逐列数格点」**：随机点构不成整列格点，构建者改成逐点用 `isqrt` 求这一列允许的最大 |y|；
   **m5a 清单 §2.1 说 `log-line-parser` 的参照用 `split()`**：按任意空白切会把多空格、制表符的行判成好行，与被测语义不一致，构建者改成 `split(' ')`。两处都经终审认可。
10. **m5a 清单 §2.1 原写 `date-format-manual` 用 `isdigit()`**（构建者的第 1 级提示还明令「不用 isdecimal」）：终审 I1 改正，规格 §2.1 与 §8（M5A-D7 / D8）已由 `b323b1e` 补记。
