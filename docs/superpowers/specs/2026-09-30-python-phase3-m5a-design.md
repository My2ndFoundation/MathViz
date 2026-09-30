# Python 子项目 · 第 3 期 · 波 m5a（M5「综合运用」上半）程序清单

> 状态：**草稿，待审**（清单、§3 边界、§4 随机、§5 递归、§6 fixture 需要裁决）。
> 日期：2026-09-30
>
> 上游：
> - 主规格 `docs/superpowers/specs/2026-09-16-python-subproject-design.md` §2.1、§2.2（M5：`py-text-data` 词频、文本清洗、CSV/JSON 读写、简易解析器、正则入门；
>   `py-systems` 成绩管理、库存、银行账户——OOP + 文件持久化 + 查找排序的综合体）、§9
> - 第 3 期派发简报（主工作区 `.superpowers/python-phase3/phase3-brief.md`，Python编程 定）：随机数只许 `random.Random(<种子>)` 实例；程序长度取向约 60 行；
>   本期不用 `chunks`；CSV 的 `split` / `csv` 读法 ch05 已讲、不重复
> - 作者须知 `.claude/skills/python-drill-tool/SKILL.md`；控制方作业 `.claude/skills/python-content-wave/SKILL.md`
> - 格式范本：第 2 期 `2026-09-30-python-phase2-m3-design.md`、`-m4-design.md`
>
> 同期并行：波 m5b（`py-simulation` ch21、`py-games` ch22）由另一会话起草与构建。本文只管 ch20、ch23。

---

## 0. 本波做什么

| 页 | 章目录 | 模块 | accent | 程序 | 变体组 | 带 P |
|---|---|---|---|---|---|---|
| `py-text-data` | `ch20-text-data` | 5 | orange | 12 | 2 | 11 |
| `py-systems` | `ch23-systems` | 5 | orange | 11 | 1 | 7 |
| **合计** | | | | **23** | **3** | **18** |

refs 文件：`python/scripts/gates/refs/ch20_text_data.py`、`ch23_systems.py`。
集成分支 `claude/python-wave-m5a`，构建者分支 `claude/python-wave-m5a-py-<页>`，一波一个 PR。
**构建者在 fixture 门（PR #187，`fixture_notes_check`）合并之后派发**：读 `_fixtures/` 的程序从第一天就在门下写。

---

## 1. 约定

1. **`problem` 命名。** 变体组用下表「组」列的名字（3 个：`date-format-check`、`tokenise-expression`、`money-arithmetic`，已对全库 217 个程序的 problem 名查过无重名；
   请 Python编程 与 m5b 的组名交叉核一遍）。单个程序的 `problem` 一律等于 `id`。
2. **P 入口**照第 2 期的约定：收简单值（字符串、列表、操作元组列表），内部建自己的对象，返回 Python 内置值；不改实参。
   系统类程序的 P 入口一般是 `run_ops(ops)`，返回每次「有输出的」操作的结果列表；参照用朴素的 dict / list 实现同一套语义。
   `cases` 必须走到每个返回分支（拒绝、错误、边界各有概率专门构造），每个 `return` 分支各变异一次看门红。
3. **程序长度**取向约 60 行（本期放宽）；超过 60 的写进报告。本期仍**不用 `chunks`**。
4. **fixture**：读 `_fixtures/<名>` 的程序受 `fixture_notes_check` 约束——讲解中英两边写出文件名，并把文件**每一行各自写成一段、连续、按原顺序**。
   所以 fixture 文件要短（取向 ≤ 8 行、每行不长），不要空行。
5. **不讲已讲过的**：类、异常、文件读写、`csv` 模块、推导式、`sorted(key=)`、字典计数、查找排序算法都只是「用」，讲解点一句「这里用的是 X，见「页名」」，不重讲。
6. **boards** 缺省四家全写；拿不准的见 §7，构建者照缺省写全、报告里标出。

「组」空 = 单个程序；「P」写参照实现的**机制**（空 = 无 property，只受 `program_run_check` 约束）。
「教什么」是这个程序存在的理由，构建者不得偏离；有更经典的替换，**上报，不擅自换**。

---

## 2. 程序清单

### 2.1 py-text-data · `ch20-text-data` · M5 · 12

| id | 组 | 教什么 | P |
|---|---|---|---|
| `clean-text-normalise` | | 文本清洗：`lower()`、`str.maketrans('', '', string.punctuation)` + `translate` 去标点、`split()` + `' '.join` 压空白；为什么「先清洗再比较」 | 逐字符循环：保留 `isalnum()` 与空白、其余丢掉，再 `split` / `join`（不用 `translate`） |
| `word-frequency-file` | | 读 `_fixtures/passage.txt`，清洗、停用词集合过滤、字典计数，按「次数降序、同次数按字母」取前 n；与 ch11 `word-count-*` 不同在：读文件、清洗、停用词、并列的排序规则 | `sorted(set(words), key=lambda w: (-words.count(w), w))[:n]`（入口 `top_words(text, n, stopwords)`，收字符串而非文件） |
| `regex-find-numbers` | | 正则入门：`re.findall`、`\d+`、`-?`、字符类 `[...]`、量词 `+ * ?`；原始字符串 `r"..."` 为什么必要；从一行乱七八糟的文字里取出所有整数 | 逐字符扫描、手工拼数字（含负号规则） |
| `date-format-regex` | date-format-check | `re.fullmatch(r"\d{2}/\d{2}/\d{4}", s)` 判格式，再转 `int` 判日月范围；`fullmatch` 与 `match` / `search` 之别 | refs 里的手工版（`split("/")` + `len` + `isdigit`） |
| `date-format-manual` | date-format-check | 同一问题不用正则：`split("/")`、三段长度、`isdigit()`、范围 | refs 里的正则版 |
| `name-swap-regex-sub` | | 分组 `( )`、`re.sub` 里的 `\2 \1` 反向引用：把 `"Surname, Forename"` 改成 `"Forename Surname"`；不匹配的行原样保留 | `str.partition(", ")` 手工换位 |
| `json-round-trip` | | `json.dumps(indent=2, sort_keys=True)` / `json.loads`；写进当前目录的文件再读回；类型对照：元组变列表、键变字符串、`None`↔`null`、`True`↔`true`；`json.dump` 与 `dumps` 之别 | |
| `json-load-fixture` | | 读 `_fixtures/students.json`（嵌套的字典与列表），按键与下标一路取到底；`KeyError` 与 `get` 的取舍；汇总出每人平均分 | `students_average(json_text)` 的参照：不用 `json` 模块——用 `ast.literal_eval` 解析（fixture 只含 JSON 与 Python 字面量共有的写法：无 `true`/`false`/`null`） |
| `config-parser` | | 简易解析器：逐行读 `key = value` 配置文本，跳过空行与 `#` 注释，`[section]` 分节，重复键后者覆盖，格式不对的行报行号（`ValueError`，只打印自己的话）；返回嵌套字典 | 基于 `re.fullmatch` 的逐行分类器（机制：正则分类 vs 被测的 `startswith` / `partition`） |
| `tokenise-loop` | tokenise-expression | 词法分析：逐字符状态机把 `"12*(3+45)"` 切成 `['12', '*', '(', '3', '+', '45', ')']`，跳过空白，遇到不认识的字符 `raise ValueError`（只打印自己的话） | refs 里的正则版（`re.finditer` + 顶层交替） |
| `tokenise-regex` | tokenise-expression | 同一问题：`re.findall(r"\d+|[+\-*/()]", s)`，再用「拼回去是否等于去空白原串」发现非法字符 | refs 里的逐字符版 |
| `log-line-parser` | | 读 `_fixtures/access.log`，命名分组 `(?P<name>...)` 解析每行（IP、路径、状态码、字节数），坏行计数跳过，按状态码汇总 | `parse_line(line)` 的参照：`split()` 按空白切段再逐段校验 |

- `word-frequency-file` 的 `cases`：窄字母表短词、大量并列次数、停用词占一半、`n` 大于不同词数。
- `date-format-*` 的 `cases`：约一半是格式对的串（纯随机串几乎全不对，「格式对但范围错」「全对」两支会没人测），专门构造 `00/..`、`31/02/…`（本清单只判日 1–31、月 1–12，不判大小月——构建者写明约定，两版一致）。
- `tokenise-*` 的 `cases`：随机表达式树的中缀串加随机空白；约四分之一混入一个非法字符（期待 `ValueError`——入口约定为返回 `None` 或捕获后返回 `"error"`，构建者写明，两版一致）。
- `regex-find-numbers` 的 `cases` 要常出现 `-` 紧贴数字、`-` 单独出现、数字紧贴字母。

### 2.2 py-systems · `ch23-systems` · M5 · 11

| id | 组 | 教什么 | P |
|---|---|---|---|
| `gradebook-classes` | | 两个类协作：`Student`（姓名、分数列表、平均）与 `Gradebook`（按名字存、加分数、查不到时的自定义异常、等级按分数线查表）；类的职责怎么切 | `run_ops(ops)` 的参照：一个 `{name: [marks]}` 字典 + 函数 |
| `gradebook-json-persist` | | 持久化：`to_dict()` / `from_dict()` 把对象图转成 JSON 能存的结构，写进当前目录再读回，读回的对象与原来相等（`__eq__`）；文件不存在时从空开始 | |
| `competition-ranking` | | 排名：`sorted(key=)` 按分数降序、同分同名次、下一名跳号（1, 2, 2, 4）；输出「名次 姓名 分数」表 | `rank(score) = 1 + 比它高的人数`（不排序） |
| `inventory-stock` | | `@dataclass` 的 `Item` + `Inventory`：进货、出货、库存不足时抛自定义 `OutOfStock`（带属性）、低于再订货线时报警；方法返回值 vs 打印的分工 | `run_ops(ops)` 的参照：朴素 `{sku: qty}` 字典 |
| `inventory-csv-restock` | | 读 `_fixtures/deliveries.csv`（用 `csv.DictReader`，ch05 讲过，这里只「用」）批量进货，坏行（数量不是整数、未知 SKU）记下行号跳过，处理完写出新的库存 CSV 到当前目录 | |
| `bank-transfer-atomic` | | 两个账户之间转账：**先全部检查、再改**——任何一步失败都不能留下「一边扣了一边没加」；交易记录列表；与 ch04 `bank-account-encapsulation`（`@property` 与存取校验）不同在：多个对象之间的一致性 | `run_ops(ops)` 的参照：余额字典 + 事务前拷贝、失败回滚 |
| `money-in-pence` | money-arithmetic | 钱用整数「便士」存：`0.1 + 0.2` 的问题；利息按便士算、四舍五入的约定写死（半数进位）；显示时 `divmod(pence, 100)` | refs 里的 `Decimal` 版 |
| `money-decimal` | money-arithmetic | 同一问题用 `decimal.Decimal`：从字符串构造、`quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)`；为什么不能 `Decimal(0.1)` | refs 里的整数便士版 |
| `library-loans` | | 三个类协作：`Book`、`Member`、`Library`；借书规则（每人上限、已借出不能再借、逾期天数按「第几天」整数算罚金）；还书；`run_ops(ops)` | 参照：两个字典（书→借阅人、人→书集合）+ 罚金公式 |
| `menu-driven-cli` | | 经典考卷结构：`while True` 菜单、`input()` 校验、选项→函数的分派字典、退出；`run.stdin` 喂一串选择（`input()` 的提示语进 stdout、不换行——讲解照「页面不显示输出」写） | |
| `test-data-normal-boundary-erroneous` | | 测试数据三类：正常、边界、错误数据（A-level 考点）；给一个校验函数（年龄 0–120 的整数串）写测试表，逐条 `assert` 并打印通过数；故意留一个边界 bug 让测试抓出来、再修好 | |

- `money-*`：入口 `add_interest(balance, rate_percent, months)` 返回便士整数（两版同类型）；`cases` 要常出现恰好 .5 便士的舍入点。
- `competition-ranking` 的 `cases`：大量同分、全部同分、单人、空表。
- 所有 `run_ops` 的 `cases`：每种拒绝分支（库存不足、余额不足、借阅上限、书已借出、查无此人）都要有概率专门构造。

---

## 3. 边界（待裁决）

- **3.1 正则只在 py-text-data 讲。** 别的页（含 m5b 的 `py-games`）可以用，不重讲。`date-format-*` 是「正则 vs 手工」的变体组，本页讲正则的入口。
- **3.2 JSON 在 py-text-data 讲**（`json-round-trip`、`json-load-fixture`）；`gradebook-json-persist` 只「用」JSON，讲的是对象 ↔ 可存结构的转换（`to_dict` / `from_dict`）。
- **3.3 CSV 不重复 ch05。** 本波只有 `inventory-csv-restock` 读 CSV，用 `csv.DictReader`（ch05 `write-csv-dictwriter` 讲过），讲解只点一句；讲的是「批量处理 + 坏行记录 + 写回」。
- **3.4 词频与 ch11 的关系。** `word-count-*`（ch11）讲的是字典累加的三种写法；`word-frequency-file` 讲读文件、清洗、停用词、并列排序规则，计数那一步只「用」。
- **3.5 银行与 ch04 的关系。** ch04 `bank-account-encapsulation` 讲单个对象的封装与校验；`bank-transfer-atomic` 讲多个对象之间的一致性（先检查后修改），不重复 `@property`。
- **3.6 查找排序只「用」。** `competition-ranking` 用 `sorted(key=)`，不讲排序算法；py-systems 不单列「按 id 查找」的程序（M3 字典查找、M4 二分已讲）。
- **3.7 解析器与 M3 的关系。** `tokenise-*` 只做词法（切记号），不做求值与中缀转后缀（M3 `rpn-evaluate` / `infix-to-rpn` 已讲）；讲解可以点一句「切好的记号可以交给「栈与队列」一页的调度场算法」。
- **3.8 测试数据。** `test-data-normal-boundary-erroneous` 是全库第一个讲「测试」的程序；只用 `assert` 与打印，不引入 `unittest` / `pytest`（第三方与框架不在白名单思路里）。拿不准它该不该放 py-systems：它是「系统开发」的一环，放这里最自然。

## 4. 随机

本波**没有**用到随机的程序（文本与系统类程序都是确定输入）。`menu-driven-cli` 的输入走 `run.stdin`。若构建者觉得某个程序需要随机（例如生成测试数据），**上报，不擅自加**；
加了就照第 3 期裁决：只用 `random.Random(<固定种子>)` 实例，3.9.6 与 3.12.9 各跑一次比对。

## 5. 递归

本波预计**没有**程序用递归（⟳ 无）。`json-load-fixture` 取嵌套结构用逐层下标，不写递归遍历；`config-parser` 逐行，不递归。构建者若用了（例如递归打印嵌套 JSON），照「用，不重讲」标 tags 并上报。

## 6. fixture（新门下的第一批）

| 程序 | 文件 | 取向 |
|---|---|---|
| `word-frequency-file` | `_fixtures/passage.txt` | 4–6 行短句，有标点、大小写、重复词、停用词 |
| `json-load-fixture` | `_fixtures/students.json` | ≤ 8 行（每个学生一行的紧凑写法），不含 `true` / `false` / `null`（参照用 `ast.literal_eval`） |
| `log-line-parser` | `_fixtures/access.log` | 6–8 行，含 1–2 行坏行 |
| `inventory-csv-restock` | `_fixtures/deliveries.csv` | 5–7 行（含表头），含一个数量非整数、一个未知 SKU |

讲解里逐行抄写（门要求）意味着 fixture 越长讲解越长——宁短。JSON 缩进在讲解段落里会被去掉首尾空白，所以 `students.json` 写成每行一个完整对象的紧凑形式，抄出来仍是合法 JSON。

## 7. boards（拿不准的，构建者照缺省写全四个，报告里标出）

| 内容 | 程序 | 疑问 |
|---|---|---|
| 正则表达式 | `regex-*`、`date-format-regex`、`name-swap-regex-sub`、`tokenise-regex`、`log-line-parser` | AQA 7517 含正则（形式语言那一节），OCR / Edexcel / CIE 是否含 Python 的 `re` 用法不确定 |
| JSON | `json-*`、`gradebook-json-persist` | 四家是否点名 JSON |
| `decimal` 模块 | `money-decimal` | 考纲只谈浮点误差，不点名 `decimal` |
| 测试数据三类 | `test-data-normal-boundary-erroneous` | 四家都考「正常 / 边界 / 错误数据」，应当四家全写——列出只为让评审核一下 |
| 词法分析 | `tokenise-*` | AQA / CIE 讲编译阶段（词法分析），OCR / Edexcel 不确定 |
