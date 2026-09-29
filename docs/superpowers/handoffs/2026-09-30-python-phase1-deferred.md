# Python 子项目 · 第 1 期留给第 2 期的账

> 第 1 期（地基 PR-A / PR-B + 两波内容：M1 剩余四页、M2 四页）已完成：9 页、**106 个程序**（期末验收要求 ≥ 100）、
> 40 道门。PR：#172 · #173 · #174 · #175 · #176 · #177 · #178。
> 这份文件是**账本**，不是待办列表——每一条都记着**为什么当时没修**，以及**什么时候它会变成必须修**。
>
> **每一条都在收尾当天（2026-09-30，`83e7a2d`）逐条实测核对过**：44 条里仍成立 34、已修 2、与原描述不符 8。
> 与原描述不符的，下文写的是核对后的版本；原描述错在哪，列在 §七。
>
> 规格：`docs/superpowers/specs/2026-09-16-python-subproject-design.md`（第 1 期规则已于收尾回写）
> 本期设计：`docs/superpowers/specs/2026-09-16-python-phase1-design.md`
> 裁决：`docs/superpowers/handoffs/2026-09-30-python-phase1-rulings.md`
> 第 0 期账本：`docs/superpowers/handoffs/2026-09-16-python-phase0-deferred.md`（本文 §四起逐条继承它还开着的条目）

---

## 一、第 2 期开工前该先想清楚的五件事

它们会被第 2 期的十页照抄。第 2 期（M3 / M4）已在并行起草清单，这五条已写进它们的简报，但**已上线的 9 页里仍有存量**。

### 1. 讲解里有约 25 处指向「页面上看不到的输出」

页面不显示程序输出（`run.expect` 只给门用）。这条规则是在波 1 终审才发现的，写回作者须知是 #176；之前写好的讲解没有回头扫。
收尾实测，**直接指向输出**的讲解与提示：

- ch01：hello-name notes[2]「注意输出的第一行」· celsius-to-fahrenheit notes[1]「看 36.6C 那一行」· divmod-and-floor notes[1] 与 blurb
- ch02：index-and-slice notes[2]「输出的最后两行」· split-and-join notes[0]「那两行输出」
- ch03：define-call-return notes[2]「第四行和第六行」· mutable-default-trap notes[0] 与 blurb · return-several-values notes[0] · docstrings-and-type-hints notes[1] · mutate-vs-return notes[0] · local-and-global-scope `.py:7` 提示「输出第一行就是它」
- ch04：str-and-repr notes[2] · class-vs-instance-attributes notes[0] · bank-account-encapsulation notes[2] · composition-has-a `.py:22` 提示「和输出第二行对上」· point-plain-class `.py:10` 提示「和打印出来的那一行一模一样」
- ch05：missing-file-eafp notes[3] · custom-exception-class notes[3] · input-validation-loop notes[3]
- ch06：rps-winner notes[2] · triangle-classifier notes[1] · leap-year-one-expression 与 ticket-price-nested notes[3]
- ch08：if-placement-in-comprehension notes[1] · comprehension-or-loop notes[0]；另 evens-comprehension notes[1] 用「配对的程序」指代 evens-filter，没有点名

**为什么没修**：收尾只做文档（设计 §12）；改讲解要 bump 八页版本。**什么时候必须修**：两种修法二选一，都要在第 2 期结束前定——
逐条改写成不依赖输出的说法；或者**让页面显示 `run.expect`**（读模式下折叠的「运行结果」块）。后者一次解决存量与增量，
还顺带让「字面量只能从输出得知」那类空（波 1 终审 C1）不再是问题。**建议后者**，它是 core 改动，要走设计。

### 2. 复制进 PyCharm 时没有 `_fixtures/`

读数据文件的 4 个程序（ch05 missing-file-lbyl / missing-file-eafp / read-csv-split / read-csv-module）复制出去后，
CSV 两个会 `FileNotFoundError`，missing-file 两个会走默认分支、输出与讲解对不上。讲解末段手抄了 `_fixtures/` 的内容，
**今天逐项一致，但没有门**——门只负责把 fixture 拷进临时目录（`library.py:144-146`）。
**什么时候必须修**：M5 `py-text-data`（CSV / JSON 读写）落地前。两条路：加一道「讲解必须逐字包含 fixture 内容」的门；
或复制按钮在有 fixture 的程序上一并给出建文件的代码。

### 3. 判定器在行数不同时完全不比缩进——连改变语义的缩进也判对

`judge.js:161-172` 只在两边行数相同时比相对缩进。原账本记的是「单行 `if x > h: return h` 被判等于两行参考」；
收尾实测**更宽**：`compare('if a:\n    if b: c()\nd()', 'if a:\n    if b:\n        c()\n    d()')` → `equal`，
走 UI 路径 `blankFeedback` 同样显示 Correct——`d()` 被移出了外层 `if`，程序的意思已经变了。
`judge_strictness_check` 的 14 条样例没有覆盖这个形状。**什么时候必须修**：第一个多行挖空里有嵌套块的程序——
M3 / M4 的树遍历、图搜索几乎一定会有。先给 `judge_strictness_check` 加这条反例（必红），再改判定器。

### 4. `boards` 的语义等用户裁决

「考试局」一栏现在的规则是「确知某考纲不含才去掉」，9 页全部保留四家。它会被学生读成「在我的考纲里」。
若裁定为「考纲点名」，`@dataclass`、ABC、`*args/**kwargs`、`lambda`、`for…else` 等没有一家 A-level 考纲点名，
M1 / M2 八页要大面积改。**什么时候必须修**：用户裁决之后；第 2 期起草清单时已被要求列出拿不准的。

### 5. 5 个程序打印内置 / 操作系统的异常消息

规则（#176 写回）：只打印自己的话或 `type(e).__name__`，因为内置消息随 Python 小版本变。违反它的：
ch02 `index-and-slice.py:33`（IndexError）、`string-method-tour.py:27`（ValueError）、`strings-are-immutable.py:17`（TypeError）；
ch05 `multiple-except-clauses.py:11`（`int()` 的 ValueError）、`missing-file-eafp.py:24`（`[Errno 2] …`，由操作系统给出）。
**实测 3.9.6 与 3.12.9 下这 5 条输出逐字相同**——所以今天没有坏，规则与存量不一致。**什么时候必须修**：
CI 的 Python 版本升级、或任何一条在新版本上漂了。修法是改程序、重生成 `run.expect`，或把规则改成「已知跨版本稳定的可以打印」。

---

## 二、有明确触发条件的

| 条件 | 会变成什么 | 出处 |
|---|---|---|
| **第一次 bump `SCHEMA_VERSION`** | `store.js:123-127` 迁移分支里版本键回写失败后，`notify('migrated')` 被 `notified` 标志吞掉（`:93`）——横幅说错原因。今天 `SCHEMA_VERSION = 1`，不可达 | 第 0 期 §二，仍成立 |
| **第一个带 `chunks` 的程序** | 全库仍是 **0 条 chunks**，`anchor_check` 的 chunks 分支（`library.py:574-576`）从未被真实数据执行过。（原账本说的「锚不得落在挖空体内只覆盖 lineNotes」那条不对称已随 D7 删除，不再成立） | 第 0 期 §二，部分成立 |
| **一个程序要验两个函数** | property 门一个程序只有一个 `entry`。今天只验一半的：dict-and-set-comprehensions（未覆盖 `word_lengths`、`first_letters`）、flatten-and-transpose（`flatten`）、sorted-min-max-with-key（`by_score_desc_then_name`）、if-placement-in-comprehension（`drop_negatives`）——都靠 `program_run_check` 守 | 波 2 R17 + 终审 M9 |
| **学生在手机或窄窗口上用** | `interact.js:870` 在 < 880px 隐藏整个说明面板，元数据、讲解、行注一起看不见 | 第 0 期行为，B7 之后更显眼 |
| **第一个用到 Tab 的粘贴** | `editor.js:71-75` 的 `indentOf` 只数空格，粘贴进来的带 Tab 行报缩进 0（题库侧有门，唯一入口是使用者粘贴） | 第 0 期 §四，仍成立 |

---

## 三、「写下来的理由是假的」

代码是对的，注释或文档承诺的东西不成立。危险在于下一个人会照着那句承诺去推理。

1. **`gates/library.py:569` 的「与 `clean()` 同法」**——门剥每一条匹配指令正则的行；`exercise.js:328-351` 的 `clean()` 只剥
   `scanBlocks` 配成对的 open/close。良构数据下同值。（第 0 期 §三.2，行号从 :556 挪到 :569）
2. **`gates/properties.py:39-41` 的「475 / 412」**——已补上「复评员复现出 475 / 414」的说明，但 412 仍写在那里、生成协议仍没写。
   写协议，别写期望值。（第 0 期 §三.3，部分修）
3. **`core/judge.js:13`** 描述的是没落地的设计（「左侧缩进由占位块撑出、不算她打的」），而实际是 `b.indent` 放进 textarea 初值、
   反馈另有 `lead-indent` 判据。（第 0 期 §四）
4. **`core/py-lex.js:8`、`:19` 的「构造性」**——`end ≤ src.length` 靠 `:221` 的守卫与钳位两行，不是结构保证。（第 0 期 §四）
5. **`scripts/build_programs.py:32` docstring**——本应写反斜杠-u-003c 的转义文字，被写文件工具吞成了 `<`，句子变成「把 `<` 换成 `<`」。
   该 docstring 不是 raw string，修时要写成两个反斜杠。
6. **`docs/superpowers/subproject-nav-contract.md`**（行号按 v2.1，即 #180 合并之后）：`:78` 与第 2 节表格 `:203` 仍说 `fallback_check()` 只比 id 集合
   （PR-A 起逐字段比较），`:234` 仍写「34 道门全绿」（现 40），`:243` 仍写「两页各 1 条」（现 9）。
7. **`python-drill-tool` 的冲突处理步骤**（`SKILL.md:255-263`）只重跑 `build_programs` / `sync_fallback` / `check`，没有 `inline_core`，
   也没提 engine 同步——engine 不一致时 `page_mirror_check` 会红。`python-content-wave` 已写了 `inline_core`，同样没提 engine。

---

## 四、其余留待的 minor（按文件归类；均于收尾核对仍成立）

**`python/core/`**
- `py-lex.js:250`：`tokenize(非字符串)` 静默返回 `[]`（`42`、`null`、`['x']` 实测），让「无缝全覆盖」不变量空洞成立；测试里没有一处传非字符串。
- `judge.js`：`normalize()` 的 `toks[].col` 全仓零读者（`.line` 现在由 `:120` 自己读了）。
- `trace.js:140-141`：`alignLines()` 的 `refLine` / `typedLine` 全仓零读者。
- `interact.js:724-728`：`shouldSaveBest()` 只看 `correct >= total`；参考末尾之后多打 10 个字符实测仍返回 true（屏幕有警告、成绩照记）。
- `interact.js:564`：`atTok ? atTok.start : a.length` 的后半支是死兜底（`different` 蕴含 token 存在）。
- `interact.js`：`typeof p.source` 守卫重复 **4 处**（`:309`、`:1000`、`:1238`、`:1728`）。
- `interact.js:1192`、`:1264`：字符串字面量里两个裸 U+200B，内联进全部 10 个工具页。**没有门看得见它**——`control_byte_check` 只查 C0 / BOM / CRLF。
- `store.js:214-217`：`parseJSON` 解析失败静默返回 `null`，最近一行没有注释。
- `exercise.js`：`clean` / `stripped` / `merge` 各自重扫一次 `scanBlocks`（第 0 期判过「净负收益」，不动）。
- `exercise.js:133-167`：属性之间不留空白时误报——真正会误报的形状是 **`level=3hint="…"`**（报「缺 hint」）；原账本举的 `hintEn="e"level=3` 实测能正确解析。
- `interact.test.js:498` 的去注释正则：今天 `STYLE_CSS` 里没有注释，所以只是潜在的过度剥离。

**`python/scripts/`**
- `sync_fallback.py:126`、`inline_core.py:129`、`build_programs.py:380`：`'--check' in sys.argv`——拼错成 `--chek` / `--chk` 时**静默改写文件、rc=0**（三个都实测过）。改用 argparse。
- `inline_core.py:104-118`：`--check` 与 `--print-changed` 同给时 check 分支先返回，路径列表不打印。
- `build_programs.py:294` 等：畸形注册表抛裸 traceback；删掉一个 `id`，python 侧 5 道门同时打印 traceback（汇总行仍是红，但看不出是哪个文件的哪条）。chess / cryptography 同样（`KeyError: 'id'`）。建议三处一起改成「点名文件的干净 ERROR」。
- `gates/refs/__init__.py:63-84`：不检查 `REFERENCES` 的键是否为字符串；**一个**非字符串键就在 `library.py:211` 抛 TypeError，经 `_guard` 变 traceback 红。
- `gates/registry.py:293-295`：`version_meta_check` 在 `checked == 0` 时仍报绿（`fallback_version_check` 已于 PR-A 修掉同一问题）。
- `gates/__init__.py:28` / `syntax.py:67-100`：`node_check()` 只认裸 `<script>`，`<script type="module">` 被静默跳过，块数只打印不断言。
- `check.py:59-67`：`_guard` 把无参 `SystemExit()` 当绿。
- `check.py:79-135`：`GATES` 的分组标签没有闭集检查（`_tally` 只计数）。

**`python/tools/`**
- `_skeleton.html:4034` / `:4061`：语言按钮在「core 未内联」错误态下是死的（监听器在 `else` 分支里）。
- `_skeleton.html:3977`：`TOOL.id` 是 `'py-skeleton'`，文件名是 `_skeleton`。

**内容（小）**
- 残留提示：password-rules `#space` 没规定空格字符串的引号风格；inheritance-and-super **`extend-describe`** 两级都没点名 `super()`（`parent-init` 已点名）；abstract-base-class 的 `@abstractmethod` 空答案在 import 行可见；try-except-else-finally 下方 `leave_early` 明写 `finally:`；power-by-squaring `square` 第 1 级已说全、后两级更泛；de-morgan 讲解先用 ¬∧∨、第 3 段才释义；三角形生成器的等腰样本只有 10 组。
- ch01 celsius-to-fahrenheit `notes.en[2]` 用散文写出了 `round-to-int` 那一空的关键事实。

**钩子与仓级**
- `.githooks/pre-commit:156-229`：手跑 `sync_fallback.py` 后只暂存注册表，会提交一份注册表带改动、导航页不带的提交（clone 里实测复现；CI 会抓）。机制：两页先被记成「跑之前就脏」，`--print-changed` 因磁盘已是最新而为空，`check.py` 读磁盘所以是绿的。
- `chess/scripts/check.py:1-8`：门数三处同值靠一句注释，不是一道门（今天 13 == 13）。
- `.github/workflows/registry-sync.yml`：导航契约那一步（`:101`）仍排在 chess（`:80`）与 cryptography（`:88`）之后，全文没有 `if: always()`。
- `core.hooksPath` 是共享配置里指向主工作区 `.githooks` 的绝对路径：从 worktree 提交时跑的是主工作区当前分支那份钩子**脚本**（它操作的是 worktree 的文件）。是否改成相对路径——**等用户决定**。

---

## 五、流程上的账

1. **台账不能只活在草稿区。** 地基阶段逐任务的裁决台账、两波的台账都放在会话草稿区，收尾时草稿区已被清空；
   本期裁决记录只能从设计文档的注记、提交信息与 PR 描述重建，地基阶段一部分只影响实现细节的裁决已经找不回来。
   **第 2 期起：每波结束时把台账的裁决与留账两节随复盘 PR 提交进 `docs/superpowers/handoffs/`**，或至少随回报发给控制方。
2. **设计 §9.2 列了两份文档，第 1 期结束时仍未写**：`docs/superpowers/python.md`（架构）与 `docs/superpowers/prompts/python-handoff.md`（交接）。
   两期的坑散在两个 skill、两份账本、两份裁决里；第 2 期的构建者读得到 skill，读不到「为什么」。建议在第 2 期收尾时写。
3. **用户验收仍未做**：新 8 页的 `file://` 双击打开、复制程序粘进 PyCharm 真跑（`match-case-commands` 需要 3.10+；读 CSV 的程序要先建 `_fixtures/scores.csv`）。
4. **控制方的「红得没有理由」**：本期出现过七次（`zsh` 不分词、`| tail` 吞退出码、不带引号的 heredoc 吃反引号、复制工具平铺 fixture 等），
   都记在裁决 §五。其中两次让一段没跑的验收看起来像跑过——**验收循环必须在第一处红时停下，而不是只打印**。

---

## 六、体积

收尾实测（`83e7a2d`）：9 页合计 **2,545,092 B**（gzip -9 后 850,469 B），平均约 283 KB/页（cryptography 均 221 KB）；
七个 core 模块合计 **180,939 B**，每页一份、完全相同；py-basics 从第 0 期的 242 KB 涨到 266 KB。

仓库增速（`git count-objects -vH`，同一方法量）：波 1 前 6387 对象 · 128.32 MiB → 波 1 后 6569 · 130.46 MiB；
波 2 前 6580 · 130.52 MiB → 波 2 后 6765 · 132.67 MiB；**size-pack 始终 25.04 MiB**（增量都还是松散对象，未打包）。
第 0 期账本 §五 担心的「core 改一行 = 每页重写」本期没有发生——两波都没改 core。**第 2 期若改 core（§一.1 的输出块、§一.3 的判定器），
那一次会重写全部 19 页**；到时量一次。

---

## 七、原描述错在哪（收尾核对发现）

照第 0 期「记下原描述错在哪」的惯例：

1. 第 0 期 §四 的 `exercise.js` 误报例子写错了形状（见 §四）。
2. 「ch02 有两个程序打印内置异常消息」——是三个；另有 ch05 两个（§一.5）。
3. 「`typeof p.source` 守卫重复 3 处」——是 4 处。
4. 「inheritance-and-super 第 1 级没点名 super()」——指错了空：`parent-init` 已点名，没点名的是 `extend-describe`。
5. 第 0 期 §二 chunks 条目里的「挖空体内」判据已随 D7 删除。
6. 「refs 加载器接受非字符串键 → sorted 陈旧键时崩」——一个非字符串键就在更早的 `library.py:211` 崩。
7. 「判定器宽松」原描述低估了范围：会改变语义的缩进也判对（§一.3）。
8. 已修、不再带过去：`accent_module_check` 的 TypeError（`7416ee0`）、导航页「py-basics.html 还不存在」的过期注释（`a39a368`）。
