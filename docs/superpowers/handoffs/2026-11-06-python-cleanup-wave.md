# Python 子项目 · 清理波（2026-11-06）

> 做的是第 6 期账本 `2026-10-01-python-phase6-deferred.md` §十的**第一组**（方向已定、存量未改）与**第二组**（门与判定器）。基线 `963d1a5`（#209 合并后的 main）。
> 三个构建者并行（gates / early：ch01–ch08 / later：ch09–ch35），控制方集成、统一升版。台账（gitignored）：主工作区 `.superpowers/python-cleanup/cleanup-ledger/`。
> 状态句都锚在本 PR 的 head 上；数字以门的输出行为准（交接文档 §1.1 的快照表）。

## 一、第二组：门与判定器

| 账本条目 | 做了什么 | 负控制 |
|---|---|---|
| 判定器行数不同时不比缩进（`judge.js`，第 1 期 §一.3） | 行数不同时切逻辑行、复合语句头后同一行的体算深一层，用缩进栈比**块结构**；token 相同而层级不同 → 新 kind `block`（反馈只报行号，不涉及字面量）。行数相同的路径一字未改。engine `py-1.3.1` → **`py-1.3.2`**。 | `judge_strictness_check` 先加 3 条判异样例、改判定器前断言红；9 个判定器内部变异全部断言红。全库 953 个空标准答案判对 953 / 953；68 种「语句头 + 单行体」折成一行全部判对。 |
| 一个程序一个 property 入口（第 6 期 §三.3） | `check.alsoEntries` + refs 键 `'<id>::<函数名>'`；`copyrun.py` 认它。ch08 四个程序补 5 个入口。 | 每个新入口一个变异，断言红；`flatten-and-transpose` 的「首空填 pass」以前 property 看不见，现在 0 / 200 抓到。 |
| fixture 必须被 git 跟踪 | `fixture_tracked_check`（7 个文件） | 注入「已跟踪集合」少一个 → 断言红 |
| tag 规范化 | `tag_normalize_check`（折大小写、空格、连字符，不折下划线） | 改一个 tag 的大小写 / 空格 → 断言红 |
| 照抄空 | `copied_blank_check`（逐字 + drill-tool 的近照抄口径，纯关键字行不算） | 注入逐字孪生、近孪生 → 断言红；2048 修复前的形状两条都报 |
| `isdigit` → `int()` | `isdigit_check`（AST：守着转换、判整串、收集数字字符 → 红；逐字符分类计数、`any(c.isdigit() …)`、单字符演示放行；不看同一行有没有 `isdecimal`）。判整串认得 `s.isdigit()`、`all(c.isdigit() for c in s)` / `not any(not c.isdigit() …)`、逐字符 `if not ch.isdigit(): return False / break / ok = False`（后两类是终审 I1 补的）；**看不见**：`if ch.isdigit(): continue` + `else: return False`、计数后与 `len(s)` 比、`all(map(str.isdigit, s))`、`ok = ok and ch.isdigit()` | 三种形状各注入一处 → 断言红；终审修复另注入 `all(…)`、逐字符 `return False` 各一处 → 断言红 |
| 依据表四家各节与计数 | `boards_groups_check`：按概念组的自查表与附录逐组一致；附录每写一家都引了那家的条目。**「条目编号在四家各节查得到」没做**：878 处引用里 50 个编号（157 处）在各节查不到——各节按主题列，不是全表；要做先补文档。「计数」一节是增量句，不做门。 | 4 条负控制断言红 |
| 「参照返回：None」措辞 | 被测抛错 / 超时印「参照：未计算」 | 造一个抛错的被测 |
| `properties.py` R6 | 改成「参照不能与任何一个被测同源」 | 注释 |

门数 45 → **50**。三道新门上线时各带存量豁免表（`library.py` 的 `TAG_STOCK` / `COPY_BLANK_STOCK` / `ISDIGIT_STOCK`）；集成内容分支后门报出全部 9 条「存量已清、删掉这一条」，控制方清空了三张表——豁免对不上违例本身是红，以后要豁免须带出处。

## 二、第一组：存量内容

| 账本条目 | 结果 |
|---|---|
| 讲解指向看不到的输出（第 1 期 27 处、第 2 期 1 处） | 全部改写；另扫出同类 14 处（ch01–ch08 12、ch09 `flatten-nested` 2）一并改。ch15 那一句还把表的行数说错了（4 → 5），改正。 |
| 打印内置 / 操作系统异常消息 5 个 | 改打印类名或自己的话（`multiple-except-clauses` 是「类名 + 自己的话」，保住 `as e` 那一空的教学点）；6 个程序重生成 `run.expect`，3.9.6 / 3.12.9 逐字节相同。 |
| 英文「」括页名 36 段、ch02 三处 `the Files and Errors page` | 全改；全库扫描 0 残留。另有 5 个程序 10 段用页 id `py-files-errors` 当页名，一并改。 |
| `lives-and-invulnerability` ↔ `bullet-cooldown` | 互相指回。 |
| 注册表 M5、M6 顺序 | 按章号排（纯移动）；配方脚本的 WARN 不再出现。 |
| 照抄空 5 处 | ch12、ch13 四处换行挖；ch07 `sentinel-running-total` 把两次读入的提示语分成 First / Next（换行挖会丢掉核心教学点）。 |
| 钉法缺口 | ch01–ch08 2 处（第 1 期 §四「残留提示」，用词是「没规定 / 没点名」，grep「钉法缺口」找不到）；ch09–ch35 16 个空 / 14 个程序（第 3 期 §二.3、第 4 期 §三.3）。另 2048 `down` 与 `right` 同问题，一并钉。 |
| 讲解用程序 id 指兄弟程序（ch01–ch07 26 个） | 全改成标题；ch08 之后 0 处。 |
| `isdigit` 存量 | `is_pin` 改 `isdecimal`；方法巡礼的演示行一并改；`password-rules` 只给单字符分类，保留。 |
| tag 分裂 | 12 组统一（见 `python-drill-tool` tag 一条）；**裁决 C2：方法 tag 写裸名**（`lower`，不写 `str.lower`），模块函数照写模块名。 |
| m8b 规格「硬件定时器」、两份文档没列标准件 | 改了；`python.md` §2 与 `python-handoff.md` §3 补列。 |

35 页各升一个 patch 版本（判定器的 `block` 反馈在每页都是可见变化；裁决 C1：版本与 changelog 由控制方集成后统一写）。

## 三、仍开着的

- **第三组「测量没走到的」原样不动**：MicroPython 与 pygame 的 `main()`、matplotlib 的图、硬件行为据文档未实测、复制不带 `_fixtures/`、逐键首次正确率（第 6 期 §十）。
- 其余多函数程序仍只有一个 property 入口（机制有了，只给 ch08 四个补了）；往返 entry 的 `radio-packet-bytes` 可以改成两个入口，没改。
- 判定器：行数相同、块结构相同而缩进宽度不同（外层 4 / 内层 2）仍判 `indent`——有意的严格。有效行条数恰好相等时仍按宽度比：一处单行 `if x: y` + 一处括号断行的等价写法判 `indent`，非法的 `if a: b` / `    f(x,` / `y)` 判对（终审 M1，`python.md` §8.2）。
- 依据表各节的条目编号没有门（上表）。
- `library-loans` 86 行被「不超过 80 行」筛掉（不修）。
- `core.hooksPath`：2026-10-01 用户设成相对路径；本波实测共享配置里又是绝对路径（原因不明，没有改用户配置）。
- 环境：本机 `python3` 现在是 Homebrew 3.14.8（PATH 在 miniconda 之前）。门要用 3.12（`/Users/nickma/miniconda3/bin/python3`）跑；3.14 上 `lex_vs_cpython_check` 红在 stdlib `dataclasses.py` 的嵌套同引号 f-string（PEP 701），另两道门因缺库红。提交钩子用 PATH 上的 `python3`，所以提交前把 miniconda 放到 PATH 前面。

## 四、原描述错在哪

1. 简报的括号断行反例写反了：`if x:\n    f(a,\nb)` 是合法 Python；报 IndentationError 的是 `if x:\nf(a,\n    b)`（gates 构建者，CPython 3.12 实测）。
2. 第 1 期账本 `evens-comprehension` 的「配对的程序」在 notes[2]，不是 notes[1]。
3. 简报让 early 按「钉法缺口」grep——第 1 期的缺口记在 §四「残留提示」，那样 grep 不到。
4. 第 3 期账本 `nested-loops` ×15、`lookup-table` ×1，实测 ×20、×2（之后的期又加了）。
5. 原讲解 `hello-name`「问候语落在问号同一行」只在管道喂输入时成立。
