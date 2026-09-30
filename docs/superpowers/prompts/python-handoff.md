# Python 子项目交接：M1–M7 上线、M8 开工之时

> 这份文件是给**新会话**用的：接手 `python/` 之前要知道的事——现在的状态、不能碰的线、
> 会绊人的 API、每道门怎么弄红、真实踩过的坑、各期裁决在哪。
> 写于 2026-09-30，基线 `e342ba2`（#201 合并后的 main）。
>
> **架构**（目录、数据形状、core 七模块的职责、注册表字段、门的分组）在
> `docs/superpowers/python.md`，这里不重复，只在需要时一句话指过去。
> **作业流程**在两个 skill 里：`.claude/skills/python-drill-tool/SKILL.md`（作者）与
> `.claude/skills/python-content-wave/SKILL.md`（波次控制方）。这里只给入口。
>
> 本文所有 `文件:行` **行号以 `e342ba2` 为准**；会变的数字只出现在 §1 的快照表里，并附重算命令。

---

## 1. 现在的状态

### 1.1 快照 · 写于 `e342ba2`

**这是两份文档里唯一一张会随内容过期的数字表**（历史事件里的数字，如某次事故的 21 GB，不在此列）。`python.md` 不再抄这些数字，只指到这里；下一次有人更新数字，改这一张、重跑下面的命令即可。

| 项 | 值（至 `e342ba2`） | 重算命令（编号见下） |
|---|---|---|
| 已上线的工具页 | **32**（模块 1–7；模块 8 还没有页） | ① |
| 程序（`.py`） | **346** | ①、② |
| `lines` 合计 | **11,099**（`lines` 口径见 `python.md` §4.1） | ① |
| engine | 至 `e342ba2` 全库唯一 **`py-1.2.0`**，骨架同值。boards PR 合并后会变（engine 预计升级） | ①、②「页面镜像」行 |
| 门 | **44**（生成 3 · A 8 · B 7 · C 5 · D·库 17 · D·词法 4） | ② 最后一行 |
| core 断言 | 7 个测试文件，**811** 条（editor 33 · exercise 43 · interact 354 · judge 37 · py-lex 273 · store 31 · trace 40） | ② 开头七行 |
| 运行层 | stdlib **267** · scipy-stack **43** · pygame **36**（compile-only）· MicroPython **0**；`runtime` 全部是 `cpython` | ⑤ |
| 真跑 / 只过 `compile` / 因缺库跳过 | **310 / 36 / 0**（严格模式） | ②「程序真跑」行 |
| 带 property 的程序 | **235**（× 200 组实参） | ②「性质比对」行；⑤ |
| 挖空 | **874** 个 | ②「挖空下限」行 |
| 变体 | 275 个 `problem` 组，其中 63 个多变体 | ②「变体」行 |
| 分段临摹（`chunks`） | 5 个程序、15 段，落在 2 个工具页 | ②「分段」行；⑤ |
| `_fixtures/` | 4 个章目录带；源码里 9 处引用（fixture 手抄） | ⑥；②「fixture 手抄」行 |
| 例外豁免 | 0 条（结构性豁免 36 条） | ②「豁免」行 |
| pygame 程序 / MicroPython 程序 | 36 / 0 | ②「pygame 顶层」「MicroPython 顶层」行 |
| `boards` | 至 `e342ba2`：346 条全部写满四家考试局。boards PR 合并后会变（按新规则允许空列表） | ⑤ |
| 主工作区 HEAD | `e342ba2`，与 `origin/main` 相同 | ④ |

分模块（①的输出）：

| 模块 | 页 | 程序 | 页 id |
|---|---|---|---|
| 1 语言基础 | 5 | 58 | py-basics · py-strings · py-functions · py-oop · py-files-errors |
| 2 控制逻辑 | 4 | 48 | py-conditionals · py-loops · py-comprehensions · py-recursion |
| 3 数据结构 | 5 | 57 | py-lists · py-dicts-sets · py-stack-queue · py-linked-list · py-trees-heaps |
| 4 算法分析 | 5 | 54 | py-searching · py-sorting · py-graphs · py-dp-greedy · py-complexity |
| 5 综合运用 | 4 | 47 | py-simulation · py-games · py-text-data · py-systems |
| 6 科学计算与数理统计 | 5 | 46 | py-numpy-basics · py-numpy-linalg · py-statistics · py-pandas · py-matplotlib |
| 7 图形与游戏 | 4 | 36 | py-pygame-basics · py-pygame-sprites · py-pygame-motion · py-pygame-games |
| 8 嵌入式 Python | 0 | 0 | 第 6 期在建（`e342ba2` 时） |

重算命令（都在仓库根目录跑，都是写这份文件时实跑过的；编号在两份文档里唯一，`python.md` 引用时用的也是这里的编号）：

```bash
# ① 注册表汇总：页数、程序数、lines、engine 集合，再按模块分
python3 -c "import json,collections as c;t=json.load(open('python/python-tools.json'))['tools'];print(len(t),sum(x['programs'] for x in t),sum(x['lines'] for x in t),{x['engine'] for x in t});m=c.defaultdict(list);[m[x['module']].append(x) for x in t];[print(k,len(v),sum(x['programs'] for x in v)) for k,v in sorted(m.items())]"
# ② 全部门，严格模式（缺 requires 里任何一个库即红）；开头七行是 core 测试的断言数，末行是按组自数的门数
PYTHON_GATES_REQUIRE_SCIPY=1 python3 python/scripts/check.py
# ③ 各期的合并（#169 起；按 PR 号的数值过滤，不依赖位数）
git log --merges --first-parent origin/main --format='%h %s' | awk 'match($0,/pull request #[0-9]+/){n=substr($0,RSTART+14,RLENGTH-14)+0; if(n>=169) print}'
# ④ 主工作区是否跟上 main
M=/Users/nickma/Develop/My2ndBrain/MathViz; git -C $M log --oneline -1; git -C $M status --short | head; git -C $M rev-parse origin/main
# ⑤ 章目录扫描：程序数、runtime、运行层；property 数、chunks 数、boards 写满四家的条数
python3 -c "
import json,glob,collections as C
P=[p for f in sorted(glob.glob('python/programs/ch*/chapter.json')) for p in json.load(open(f))['programs']]
print(len(P), C.Counter(p.get('runtime','cpython') for p in P), C.Counter('pygame' if 'pygame' in p['requires'] else ('scipy-stack' if p['requires'] else 'stdlib') for p in P))
print(sum(1 for p in P if (p.get('check') or {}).get('property')), sum(1 for p in P if 'chunks' in p), sum(len(p['boards'])==4 for p in P))
"
# ⑥ 带数据文件的章目录数
ls -d python/programs/*/_fixtures | wc -l
```

（⑤ 的运行层分类是近似口径：它没有看 `runtime` 与例外豁免，`e342ba2` 时两者都不影响结果；严格的分层以 `gates/library.py` 的 `_tier()` 为准。）

**先跑一遍确认起点是绿的**：② 末行必须是「N 道门全绿」（`e342ba2` 时 N = 44）且「0 段因缺库跳过」；完整的验收命令列表在
`python-content-wave` 的「验收命令」一节（含五道根级门与 chess / cryptography 的门）——照那张表跑，不要只跑 ②。

### 1.2 各期的 PR（③的输出，按期归类）

| 期 | 内容 | PR |
|---|---|---|
| 0 地基 | 骨架、七个 core 模块、两个生成脚本（`inline_core` · `build_programs`）与 `check.py`、当时的全部门、`py-basics` | #169 · 裁决 #170 |
| 1 | FALLBACK 生成（第三个生成脚本 `sync_fallback.py`，#172）、` \|\| ` 分级标记、M1 剩余 + M2 | #172 · #173 · #174 · #175 · #176 · #177 · #178 · 收尾 #182 |
| 2 | property 门深拷贝与逐次时限、M3 + M4 | #181 · #183 · #184 · #185 · 收尾 #186 |
| 3 | fixture 门、`compile` 不继承 future、M5 | #187 · #188 · #189 · #190 · 收尾 #193 |
| 4 | scipy-stack 层、逐层比类型、M6 | #191 · #192 · #194 · #195 · 收尾 #197 |
| 5 | pygame 层、分段临摹、M7 | #196 · #198 · #199 · #200 · 收尾 PR 未合 |
| 6 | MicroPython 层（前提）；M8 在建（`e342ba2` 时） | #201 |

同期不属于 python 的：#171（deploy-guard）、#179（根画廊）、#180（四个画廊共用背景：改了四个画廊，在 `python/` 里只动了 `index.html`）。

---

## 2. 不可协商的边界

1. **四套注册表互不相交。** python 工具只进 `python/python-tools.json`，绝不进根 `tools.json`（根 `CLAUDE.md`「Subprojects」）。
2. **GENERATED 区段禁止手改。** 改 `core/*.js`、`programs/ch*/`、`python-tools.json`，再跑对应的生成脚本
   （哪个区段由哪个脚本写，见 `python.md` 的目录一节）。
3. **页面从不显示程序输出。** `run.expect` 只给门用——这是用户 2026-09-30 的定论，不再是「待裁决」。
   推论：讲解与提示不许说「看输出第几行」；只能从输出得知的字符串字面量，要在最后一级提示里给出（根 `CLAUDE.md` python/ 一节）。
4. **主工作区跟 main，除此之外不在它上面做任何 git 操作。** 用户 2026-09-30 裁决：每次合并之后、在主工作区干净（`git status` 无输出）时，
   由期控制方 `git -C $M merge --ff-only origin/main` 快进；checkout / rebase / 提交等其余 git 操作一律在自己的 worktree 里、用 `git -C <worktree>`
   （用户裁决，由期 5 收尾 PR 记入；`$M` 见 §1.1 命令 ④）。这条取代了旧的「主工作区不 pull」。
5. **不 `git add -A` / `git commit -a`，只暂存显式路径；钩子跑完后逐行读 `git status --short`。**
   钩子会重跑三个生成脚本、从磁盘读——别的会话已保存未提交的改动会被卷进你的提交（根 `CLAUDE.md` 并发纪律第 5 条；主规格 §9）。
6. **负控制串行跑、从内存里的原字节复原并断言字节相同、先跑基线确认是绿的；绝不用 `git checkout` 复原。**
   只做保证终止的变异（§6 第 1 条）。出处：内存复原与基线是主规格 §7.3；串行与「只做保证终止的变异」不在主规格里，
   来自第 2 期裁决 / #183（那次非终止负控制拖垮机器），写进了 `python-drill-tool`「上报与负控制」。
7. **禁改单。** 每期的期控制方在派发简报里列一张禁改单：`CLAUDE.md`、主规格、导航契约、`docs/superpowers/handoffs/*`、
   根 `scripts/*`、`.github/workflows/*`、`.claude/skills/*`、`python/core/*`、`python/scripts/gates/`（本波 `refs/` 章文件除外）。
   需要改，找期控制方——「门看不见某类错误」本身就是上报项。
8. **改导航壳之前读 `docs/superpowers/subproject-nav-contract.md`（v2.1，九条，C9 = 画廊背景）。**
9. **`boards` 按新规则写**：程序教的内容不在某考纲里，就不写那家；`boards: []` 合法。按概念判，附依据。
   考纲对照文件 `docs/superpowers/specs/2026-09-30-python-boards-syllabus-map.md` **由 boards PR 引入**（`e342ba2` 时还没进 main）。

---

## 3. 干活的循环：入口

细节全在两个 skill 里，这里只说「做什么事读哪一节」。**用 Read 读你自己 worktree 里的 skill 文件**，
而不是只信 Skill 工具加载出来的版本——Skill 工具读的是主工作区（§6 第 16 条）。

| 要做的事 | 读哪里 | 一句话 |
|---|---|---|
| 加一页 | `python-drill-tool`「三种作业」A | 复制 `_skeleton.html` 改 6 处，建章目录，自己追加注册表条目，跑三个生成脚本 + `check.py` |
| 给已有页加程序 | 同上 B；「一个程序长什么样」「生成 `run.expect`」「property 检查」 | `run.expect` 粘贴真实输出，不要想；参照机制必须与被测不同 |
| 升级一页 | 同上 C | 版本三处；改了 `core/` 则 engine 全库一起升 |
| 并行分支的注册表冲突 | 同上「堆叠分支之间的冲突」 | 不手工合并，跑 `resolve-registry-conflict.py`，用 `&&` 接提交 |
| 跑一波（一个模块的几页） | `python-content-wave`「运行」第 0–7 步 | 一波一个集成 worktree、一次终审、一轮修复、一次范围复审、一个 PR |
| 浏览器验收 | `python-content-wave`「浏览器验收」+ `probe.js` | 用标准件探针，不要复制上一波台账里的探针 |
| 起草一波的程序清单 | `python-content-wave` 第 1 步 | 每个 property 程序先做起草期原型，证明 cases 能触发它声称要测的分支 |

---

## 4. 容易绊人的 API 签名

`python.md` 讲每个模块做什么；这一节只收**调用方最容易写错的那一处**。每一条都对过源码与
`python/core/*.test.js` 里的真实调用，标 ◆ 的另在 node 里实跑过。

| 签名 | 位置（`e342ba2`） | 会绊人的地方 |
|---|---|---|
| `Exercise.parse(source) → { blanks, stripped, lineMap }` | `exercise.js:275` | `blanks[i]` 是 `{ id, level, hint, hintEn, body, indent, line }`：`body` 是挖空体**原文、每行带自己的缩进**；`indent` 只是第一行的前导空白；`line` 是在 `stripped` 里的 0 起行号，`lineMap[k].srcLine` 是原文 1 起行号——两个方向、两种起点。◆ |
| `Exercise.clean(source) → string` | `exercise.js:328` | 读模式、临摹、复制都用它，**不是裸 `source`**（第 0 期裁决 R16）。它和 `parse` 共用 `scanBlocks`，所以**畸形指令照样抛**（缺 `hintEn` 实跑即抛），不是「只剥行不校验」。◆ |
| `Exercise.merge(source, answers) → string` | `exercise.js:366` | `answers[id]` **原样**替换整个指令块——不补缩进。答 `'return 2'` 给一个缩进 4 的空，拼出来就是顶格的 `return 2`（`exercise.test.js:59` 传的是带 8 个空格的整行）。缺的 id 用原 `body` 兜底。◆ |
| `Exercise.DIRECTIVE_OPEN / DIRECTIVE_CLOSE` | `exercise.js:121-122` | 允许 `#`、`>>>`、`BLANK` 之间任意空白（`\s*`）。门以外的工具要识别指令行，用这两个正则或 `clean`，不要手写只认一个空格的前缀（第 2 期 M3 的复制真跑被 `# >>>BLANK` 骗过）。 |
| `PyInteract.blankFeedback(answer, reference, lang) → { ok, kind, caret, message }` | `interact.js:508`（文档 `:482`） | **`answer` 的第一行必须带这个空自己的缩进**：`reference` 就是 `b.body`（带缩进），第一行前导空格数不同直接判 `lead-indent`。实跑：`blankFeedback('x = 1', '    x = 1', 'en')` → `lead-indent`；加上四个空格 → `equal`。页面里 textarea 的初值就是 `b.indent`（`interact.js:1557`），调用在 `:1630`。自己写判定器探针时一律「`b.indent` + 写法」，并先断言标准答案判对。◆ |
| `Judge.compare(answer, reference) → { ok, index, expected, got, kind }` | `judge.js:158` | 它**看不见整块的绝对缩进**（`compare('x = 1', '    x = 1')` 判 `equal`），所以绝对缩进由 `blankFeedback` 另查。相对缩进**只在两边有效行数相同时比**（`:162`）——行数不同时连改变语义的缩进也判对（§9）。`index` 的语义随 `kind` 变：`indent` 时是物理行号（0 起），其余是有效 token 下标。◆ |
| `PyInteract.hintAt(blank, tier, lang) → string` | `interact.js:360` | 按 `HINT_MARK = ' \|\| '`（`:357`）切；`tier` 是「给到第几级」，0 返回空串，超过 `level` 截到 `level`；多级之间用 `' · '` 拼回（`:358`）。`；` 与 `; ` 是普通标点。◆ |
| `PyInteract.chunkSegments(cleanText, chunks) → null \| [{ index, title, start, end, text, fromLine, toLine }]` | `interact.js:783` | 参数是 **clean 文本**，不是带指令的源码。`[start, end)` 半开区间；段 = 从本段 `from` 行到**下一段 `from` 之前**（不是 `from…to` 闭区间），最后一段到文本末尾含结尾换行，所以各段拼回去逐字节等于 clean；`to` 只作校验。失败不抛，返回 `null`（页面退回不分段）。实跑 `'a\nb\n\nc\nd\n'` 两段 → `[0,5)`、`[5,9)`，段间空行归前一段。◆ |
| `PyInteract.encodeChunkDraft(seg, typed)` / `decodeChunkDraft(raw, n)` | `interact.js:835` / `:848` | 草稿仍存在 `(id, 'trace')` 键下，值是 JSON `{"v":1,"seg":k,"typed":[…]}`；不分段程序的草稿仍是纯字符串。`decode` 在纯字符串、版本不认识、**数组长度 ≠ 段数 `n`**、`seg` 越界时都返回 `null`——「视为无」，不删旧字符串。◆ |
| `Trace.create(reference)` → `{ update(typed), noteBackspace(), reset() }` | `trace.js:163` | `update` 每次收**整个缓冲**，不是增量；返回 `{ marks, overflow, stats }`，不变量 `marks.length + overflow.length === typed.length`（第 0 期 R40）。`stats.lineDelta` 是行数差信号。 |
| `Trace._useClock(fn)` | `trace.js:114` | **模块级**，换了就影响此后全部 session；测试里换完要换回 `Date.now`（`interact.test.js:875`、`:898`）。`IDLE_PAUSE_MS = 10000`（`:110`）。 |
| `Store._useStorage(s)` | `store.js:322` | 测试注入口。纯状态切换、不做 I/O：清空内存缓存、`notified`、`schemaChecked` 与待写的防抖。schema 检查延迟到第一次真读写，所以可以先换后端再挂 `onUnavailable`。 |
| `Store.patchProgress(id, patch)` / `setPrefs(patch)` | `store.js:270` / `:280` | **顶层浅合并、整值替换**，不递归（第 0 期 R9）：改子对象里一个字段要自己读—改—写。 |
| `Store.clearAll(opts)` / `clearMany(ids)` / `clearProgram(id, modes)` | `store.js:309` / `:302` / `:294` | 三级清空各清什么不同：模块级只清草稿不清进度；整项清空按键前缀扫。`PyInteract.clearScope(...)` 在 `'all'` 时返回 `null`，意思是交给 `clearAll`（第 0 期 R4）。 |
| `PyInteract.filterPrograms(programs, filters)` | `interact.js:290` | 只按 level / kind / boards / lines 筛，**不按 tag**（第 4 期终审 m10 订正过作者须知）。 |
| 惰性依赖 `factory(function () { return root.PyLex; })` | 各模块 UMD 外壳 | 不是 `factory(root.PyLex)`；`lazy_dep_check` 先剥注释再查（第 0 期 R47）。测浏览器分支要用 `vm` 裸 context——`node -e` 与 stdin 都定义 `module`/`require`，走的是 node 分支（第 5 期 m7a 终审员就用 `require` 测错了分支）。 |
| `probe.js`：`PYPROBE({ page, marker, copyIds })` | `.claude/skills/python-content-wave/probe.js:6-10` | 先 `fetch` 注入再调；每次导航后重新注入；每次调用传显式 `tabId`。返回 `{ VOID: true }` 表示 marker 取不到或 `TOOL.id` 不对——**这次测量作废**，不是通过。`literalChecks` 为 0 是「没测」，看 `literalMode = 'fallback'` 那一项。用法写在文件头第 6–10 行，别从上一波台账复制旧探针。 |

两条通用的：

- **页面全局名**：`TOOL`、`PyPrograms.programs`、`ctl.setLang(lang)`、`Exercise`、`PyInteract`——探针直接用它们；语言切换走 `ctl.setLang`，不改地址栏。
- **property 门的调用约定**（`python/scripts/gates/library.py`）：被测与参照各拿一份实参的深拷贝（`:536`、`:544`，#181）；每次调用限时
  `PROPERTY_CALL_TIMEOUT = 2.0` 秒（`:243`，#183）；导入限时 `IMPORT_TIMEOUT = 10.0`（`:293`，#196）；两处 `compile(…, dont_inherit=True)`（`:122`、`:503`，#188）；
  返回值逐层比值与类型（`_deep_mismatch`，`:246`，#192）；分层看 `requires` 不看模块（`_tier`，`:66`）。

---

## 5. 门与负控制对照表

「零问题在负控制变红之前不是证据」（主规格 §7.3）。下表只收**在门源码、主规格 §7.3、各期设计、PR 描述或账本里找得到依据**的负控制；
找不到记录的门单列在表后，**不是说它们不能弄红，而是没有人留下过弄红它的记录**。「形态」一栏：断言 = 门自己报出具名的红；挂死 / 崩溃是另一种红，不算数。

「依据」一栏分两类，读的时候别混：**〔设〕设计规定**——主规格 §7.3 的负控制表、各期设计文件的计划表（第 1 期设计 A1… 那一列）、门自己的 docstring，
说的是「应当这样弄红」；**〔执〕执行记录**——PR 描述、合并前核验、裁决与账本里记下的实测（#181 / #183 / #191 / #196 / #198 / #201、P27、R24 等），
说的是「有人真的这样弄红过」。只有〔设〕的行，意思是规定在、没找到执行记录。

| 门 | 怎么把它弄红 | 形态与要点 | 依据 |
|---|---|---|---|
| `sync_fallback --check` | 改 `app.html` FALLBACK 区段里 py-basics 的 `accent` | 断言；`fallback_check` 同时红并点名字段 | 〔设〕第 1 期设计 A1（#172 落地） |
| `fallback_check` | 同上；或只改注册表 `title` 不重新生成 | 断言。它与 `sync_fallback --check` 是两次独立测量（一个比语义一个比字节）。第 0 期终审时旧版只比 id，改 accent / title **34 道门全绿**——这是它改成逐字段比的原因 | 〔设〕第 1 期设计 A1；〔执〕第 0 期账本 §一.1（旧门在这条负控制下全绿） |
| `fallback_version_check` | 删一条 FALLBACK 的 `version` | 断言 | 〔设〕主规格 §7.3 |
| `accent_module_check` | py-basics 的 accent 改成 `violet`；或配色表里 M6 改成与 M5 同色 | 断言，点名期望值 / 撞色的两个模块 | 〔设〕第 1 期设计 A2 |
| `page_mirror_check` | 逐一改坏 `TOOL.id` / `TOOL.accent` / `TOOL.title.zh` / `tool-engine` meta；骨架的 engine 改成别的版本 | 断言，各自点名字段。页名改名漏改一处也在这里红；合 main 后 engine 不一致也在这里红（第 5 期 m7b 合 #198 时） | 〔设〕第 1 期设计 A3；〔执〕第 3 期裁决 §三 第 12 条（复审做过负控制）；〔执〕#200 |
| `lazy_dep_check` | 把一个模块改成 `factory(root.PyLex)` | 断言。**同一句只写在注释里必须仍绿**（R47：裸 grep 会在正确代码上误报） | 〔设〕主规格 §7.3；〔执〕第 0 期 R47 |
| `line_note_reader_check` | 在 `renderBlank()` 里加一行读 `p.lineNotes` | 断言，点名函数；同一句只写在注释里仍绿 | 〔设〕第 1 期设计 B6 |
| `core_tests` | 把 `interact.js` 的分级改回旧分隔符链；`chunkTotals` 丢掉 `errors` | `interact.test.js` 断言红 | 〔设〕第 1 期设计 B1；〔执〕#198 合并前核验 |
| `closed_set_mirror_check` | 只在 `library.py` 的 `KINDS` 里加一个值 | 断言 | 〔设〕第 1 期设计 B7 |
| `js_parser_parity_check` | 往某个 `.py` 的 BLANK 提示里放一个 U+2028（地基终审用的是 `swap-two-tuple`） | 断言（`FORBIDDEN_LINE_BREAKS` 点名码位）。**设计动机，未见门建成后的执行记录**：地基终审 G3 的注入实验是在这道门存在之前做的，证明的是「当时别的门全绿」，不是「这道门会红」 | 〔设〕`gates/syntax.py:288` 的 docstring；〔设〕第 1 期 R2 |
| `program_run_check` | 删某程序一个冒号；`run.expect` 改一个字 | 断言，点名 `id` | 〔设〕主规格 §7.3；〔执〕#191 |
| `algorithm_property_check` | 冒泡排序比较方向反过来 | 断言，报反例输入 | 〔设〕主规格 §7.3 |
| 〃 · 被测改实参 | ch08 `invert()` 改成 `mapping.clear(); return {}` | #181 之前**门绿**；之后断言红，反例照原样打印 | 〔执〕#181 |
| 〃 · 被测不终止 | `digit-sum-modulo` 改成 `n //= 1`；参照换成 `while True: pass` | #183 之前**挂死**；之后约 12 秒断言红 / 单独报「参照超时」 | 〔执〕#183 |
| 〃 · 类型只比顶层 | `round(float(p), 9)` → `round(p, 9)`；`merge-left-join` 的 `int(score)` → `score` | #192 之前放行；之后报「类型 numpy.float64 ≠ builtins.float」 | 〔执〕#192；〔执〕第 4 期裁决 P27 |
| 〃 · pygame | 逻辑变异 → 红；顶层 `while True` → 「导入超过 10 秒」具名红（不挂死） | 顶层 `pygame.init()` / `set_mode` 时 property **照样绿**，只有结构门看得见 | 〔执〕#196 |
| 〃 · MicroPython | 入口里调 `button_a.was_pressed()` | 断言红：`HardwareStubCalled` | 〔执〕#201 |
| 〃 · 缺库 | `requires` 写一个本机没有的库 | 非严格模式**跳过、门绿**；严格模式具名红 | 〔执〕#191、#196 |
| `program_embed_roundtrip_check` | 手改 HTML 里某段 `source` 一个字符 | 断言 | 〔设〕主规格 §7.3 |
| `anchor_check` | 把某条 `lineNotes` 的锚改掉一个空格；段锚写错一字 | 断言 | 〔设〕主规格 §7.3；〔执〕#198 |
| `chunks_check` | 两段之间夹一行非空代码；只写 1 段；标题为空；首段 `from` 指向第 5 行；交换 `chunks[1]` 与 `[2]`；只改页面内联的 `chunkSegments` | 断言。只改 `core/` 不重新内联时本门绿而 core 测试红——证明第 4 条比的是**页面内联**那份 | 〔执〕#198 PR 描述与合并前核验 |
| `exemption_check` | 删掉某个例外豁免的 `why` | 断言。`e342ba2` 时例外 0 条（§1.1），所以**必须临时造一条**，否则这段断言从没执行过（门自己的 docstring 这么写） | 〔设〕主规格 §7.3；〔设〕`library.py:1160` 的 docstring |
| `source_ascii_check` | 往源码注释里塞一个中文字 | 断言（BLANK 指令行豁免） | 〔设〕主规格 §7.3 |
| `source_indent_check` | 把某行的 4 个空格换成一个 Tab | 断言 | 〔设〕主规格 §7.3 |
| `blank_presence_check` | 删掉某程序唯一的挖空对 | 断言，点名程序 | 〔设〕第 1 期设计 B3 |
| `blank_directive_check` | `level=2` 但没有 ` \|\| `；写成 `a\|\|b` | 断言，后者报「疑似写错的分级标记」。正控制：`level=1` 的提示里写 `；` 必须绿 | 〔设〕第 1 期设计 B1 |
| `variant_check` | 把**全部**多变体组都拆成单例 | 断言「至少一个多变体组」。只拆一个组不会触发——另一个组还在（第 0 期 R57，控制方开的方子本身空转过） | 〔执〕第 0 期 R57 |
| `fixture_notes_check` | notes.en 删一行；notes.zh 两行对调；不写文件名；fixture 改一个字符；源码写成 `Path("_fixtures") / "x"` | 五条都是断言红、无 traceback | 〔执〕#187 |
| `pygame_main_guard_check` | 顶层 `pygame.init()` / `set_mode`；顶层 `while True`；没有 main 守卫 | 断言 | 〔执〕#196 |
| `micropython_main_guard_check` | 顶层 `display.show(...)` / `Pin(25, Pin.OUT)`；顶层 `while True`；没有 main 守卫 | 断言。**`e342ba2` 时 0 个 MicroPython 程序（§1.1），这道门只在负控制里执行过** | 〔执〕#201 |
| `lex_vs_cpython_check` | 把 `py-lex` 的 `//` 切成两个 `/` | 断言，报位置分歧。比对必须**双向逐区间相等**：「包含」式的探针在 44,081 个区间上报零不匹配、还通过了这条负控制 | 〔设〕主规格 §7.3；〔执〕第 0 期 R24 |
| `lex_roundtrip_check` | 让词法器丢掉 token 间的空白片段 | 断言 | 〔设〕主规格 §7.3 |
| 根级 `check_nav_contract.py` | 删某一页的 `target="_top"`；`#btnAlone` 的 `?v=` 写死成 `v=0` | 断言 | 〔设〕主规格 §7.3；〔执〕第 0 期 R45 |

**没找到负控制记录的门**（设计规定与执行记录都没有）：`inline_core --check`、`build_programs --check`、`registry_check`、`version_meta_check`、`program_count_check`、
`module_label_check`、`outbound_ref_check`、`script_literal_check`、`control_byte_check`、`skeleton_sentinel_check`、`skeleton_leak_check`、
`node_check`、`browser_branch_check`、`chapter_manifest_check`、`source_bmp_check`（第 0 期 R22 只记了测量：注释里放一个 emoji，17 字符对 18 码元）、
`program_meta_check`、`judge_strictness_check`、`lex_never_throws_check`。第一个动它们的人顺手补一条，写进本表。

**只在严格模式下有牙的**：`program_run_check` 与 `algorithm_property_check` 对 scipy-stack 层与 pygame 层——不设 `PYTHON_GATES_REQUIRE_SCIPY=1` 时
缺库只是跳过、门照样绿。跳过分在两行里报：「程序真跑」行只数 scipy-stack 层，pygame 缺库只出现在「性质比对」行尾（`python-content-wave`「验收命令」）。
**绿得无事可查的**（至 `e342ba2`，数字见 §1.1）：`exemption_check` 的例外分支（例外 0 条）、`micropython_main_guard_check`（0 个 MicroPython 程序）——门的输出会自己说出来，别把它读成覆盖。

做负控制的手法（在导出副本上变异、进程组超时、区分断言红与崩溃红、等价变异）见 `python-drill-tool`「上报与负控制」，不在这里重复。

---

## 6. 已知坑

每一条都真实发生过：要么是事故，要么是评审 / 终审实测出来、当时没有任何门挡得住的漏洞（第 10 条属于后者，写明了）。
做法多数已写进两个 skill 的坑表，这里只记**发生了什么、在哪一期、哪个 PR**。

**门与测量**

1. **非终止的负控制把机器拖垮。** 第 2 期 M4 终审删掉 `bfs-order` 的 `visited.add`，property 门跑满外层 600 秒、swap 约 21 GB、
   数据卷只剩约 124 MiB，同机三个会话一起 ENOSPC 中断 → #183 加逐次 2 秒时限。仍然只做保证终止的变异；本机 macOS 没有 `timeout` 命令（第 2 期，写了只会 rc=127）。
2. **被测改了实参，门看不见。** 被测先跑、参照后跑、共用同一个实参对象：M4 丢了 key 的原地插入排序 200 组里 134 组答案错、门 0 组检出 → #181 深拷贝。
3. **类型只比顶层。** `[np.int64(3)]` 对 `[3]` 判相同，第 4 期 m6b 起草原型时发现 → #192 逐层比。
4. **`compile` 继承了门自己的 `from __future__ import annotations`。** 被测程序里注解变字符串，`@dataclass` 导入即崩，`inventory-stock` 挂不上 property → #188 `dont_inherit=True`。
5. **顶层 `pygame.init()` 在无头 SDL 下导入照样成功、property 照样绿。** 只有结构门看得见 → #196 `pygame_main_guard_check`。
6. **负控制「红得没有理由」。** #192 旧门第一次只解包了 scripts 没解包 programs，四种全红；#201 第一轮基线是红的（`const(3)` 被当成硬件、空桩 `import *` 取不到 `Image`）。
   基线先绿，红了先问为什么红。
7. **等价变异不是门的盲区。** 第 3 期 `competition-ranking` 的 `len(rows) + 1` 与 `position` 恒等；第 4 期 `int(round(d))` → `round(d)` 在 numpy ≥ 1.19 下等价。
   各期账本的「等价变异」一节是清单，做负控制前先查。
8. **一个在结构上观察不到目标的探针。** 第 0 期「包含」式的词法比对通过了两个负控制（R24）；第 0 期 R60：叫 `emoji` 的畸形语料里没有 emoji；
   第 4 期收尾评审：`copyPayload('trace')` 交回的就是传进去的 typed，拿它比「临摹复制」恒真（#197）。

**内容与判定**

9. **页面不显示输出，但简报默认学生看得到。** 第 1 期波 1 终审发现（#175）；只能从输出得知的字面量从此在最后一级提示里给出。
10. **地基终审往 `swap-two-tuple` 的提示里放一个 U+2028 实测：`clean()` 抛错、三种模式全坏，而当时 39 道门全绿**（第 1 期地基终审 G3 的注入实验，不是上线事故；`gates/syntax.py:288–291`，第 1 期 R2）→ #173 `js_parser_parity_check`。另：`node --check` 自 ES2019 起接受裸 U+2028，拿它当判据得到一道永远绿的门（第 0 期 R41）。
11. **fixture 被根 `.gitignore` 的 `*.log` 静默挡住**，本地门读磁盘全绿、CI 缺文件 → #190 加反向规则 `!python/programs/*/_fixtures/**`；「必须被 git 跟踪」至 `e342ba2` 没有门（§9）。
12. **简报与清单写错库的行为。** m6b 清单把 `kind="stable"` 写在多列 `sort_values` 上（多列不读它，#195）；m6a 的「NumPy 2 起 round 返回 int」实为 1.19 起（#194）；
    第 5 期控制方简报的 `Color.lerp` 公式错，构建者对——5 万组随机 `t` 旧式 66 处不同（#199）。库的舍入行为要在**舍入边界**上测。
13. **两波并行做了同一道题。** 第 5 期 m7b 的 `game-state-screens` 与已合并 m7a 的 `screen-states` 同题、答案行逐字相同，终审才抓到（#200）。批准第二份清单时逐条对程序，不只对组名。
14. **分段临摹的段尾空行逐键打不到。** 整段粘贴测不出来，评审逐键驱动才抓到（#198 I1）→ `chunkTailFill`。交互 UI 的验收要逐键。

**工具链与流程**

15. **`core.hooksPath` 是共享 git 配置里指向主工作区 `.githooks` 的绝对路径**（`e342ba2` 时实测
    `/Users/nickma/Develop/My2ndBrain/MathViz/.githooks`）。所以在 worktree 里提交，跑的是**主工作区当前那份钩子脚本**——主工作区落后时就是旧钩子——
    但它操作的是**提交所在 worktree** 的文件。第 1 期波 1 两个构建者上报（#175；第 1 期裁决 §六）。是否改成相对路径**待用户决定**。
    在那之前：提交前自己跑三个生成脚本与 `check.py`。
16. **Skill 工具读主工作区的 skill。** 第 3 期 m5b 读到了 #186 之前的旧版（#189）——当时主工作区不 pull，整期停在旧提交上。
    用户 2026-09-30 裁决主工作区跟 main（合并后在它干净时由期控制方 `merge --ff-only` 快进，§2 第 4 条；用户裁决，由期 5 收尾 PR 记入），这条坑的后果随之变小，
    但「用 Read 读自己 worktree 里的版本」仍是更稳的做法——你的分支上的 skill 改动，主工作区要等合并、快进之后才有；主工作区不干净时也不会被快进。
17. **构建者的 worktree 从 origin/main 切出**，不是从集成分支；`merge --ff-only <集成分支>` 两波十个构建者全部失败（第 2 期 #184 / #185）→ 模板改成 `checkout -B`。
18. **isolation worktree 写不进集成 worktree**（第 3 期 4 个里 3 个被拒，#189 / #190）→ 报告写构建者自己的 worktree。
19. **`rm -rf` 被权限拒，而且结果不稳定**（第 4 期 m6a 删掉了、m6b 四方全被拒，#195）；留在集成 worktree 里的 22 MB 让 worktree 删不掉。临时文件放 scratchpad，不删、不换命令绕。
20. **钩子触发正则被本机 ugrep 静默漏匹配**：`^((chess|cryptography|python)/)?(app|index)\.html$` 稳定漏掉 `cryptography/app.html`，`/usr/bin/grep` 与 Python `re` 都匹配（第 0 期 R53，#169）→ 拆成顶层分支。
    第 5 期 m7b（#200）另见 ugrep 对长 Unicode 交替报 complexity 错。工具命令失败，先验证工具再下结论。
21. **不带引号的 heredoc 执行了 PR 文案里的反引号**，吃掉 CI 那一行（第 1 期，裁决 §五.4）；第 5 期填简报时又发生一次（#198 期间）。heredoc 一律 `<<'EOF'`。
22. **`| tail` 之后 `echo rc=$?`**，一次崩溃被显示成 rc=0（第 1 期，裁决 §五.3）；**zsh 不对 `set -- $p` 分词**，一轮复制真跑全部崩溃（同上 §五.2）。
23. **写文件工具把反斜杠-u 转义解码成真字符。** `python/scripts/build_programs.py` 的 docstring 至 `e342ba2` 仍写着「把 `<` 统一替换成 `<`」——前一个本该是转义文字（第 1 期账本 §三.5，未修）。
    写代码用 `chr(0x2028)`；写完扫一遍 U+2028 / U+2029 / U+0085 / U+FEFF。
24. **localStorage 复原先 `clear()` 再写回。** 第 5 期 chunks 实现者的自写探针这样复原，刷新后快照丢失，共用的 8777 源上 3 个键丢失、内容不明（#198 期间）；
    #197 的收尾评审也在初版 `probe.js` 里抓到同一形状（m5）。标准件已改成只在本页的键上按差分复原。
25. **草稿区不持久。** 第 2 期三次会话重启，构建者报告、终审报告、集成脚本全丢（#184 / #185）。台账放集成 worktree 的 `.superpowers/`，收尾整目录拷走。

**根仓的同类教训（python 期间没有记录在案的实例）**：Linux 单参数上限 `MAX_ARG_STRLEN` 让 chess 的门本地绿、CI 红四次（#97–#100；python 的 `run_node()`
逐字继承了走 stdin 的修法）；`git mv` 暂存的是改名前的旧 blob；钩子把另一个会话已保存未提交的文件卷进提交（chess 第 6 期）。都在根 `CLAUDE.md`。

---

## 7. 各期裁决的入口

每期两份：`…-rulings.md`（控制方替你做的决定：决定了什么 · 为什么 · 判错的代价）与 `…-deferred.md`（账本：为什么没修、什么时候必须修）。都在 `docs/superpowers/handoffs/`。

| 期 | 文件 | 三句话 | 最值得记住的一条 |
|---|---|---|---|
| 0 | `2026-09-16-python-phase0-rulings.md` · `-deferred.md` | 地基 + `py-basics`；15 个任务、34 道门。61 条裁决里 18 条源自实现者申报「简报有错」，全部经实测为真。三条是控制方自己的失误。 | R24：一个「包含」式探针在四万多个区间上报零问题、还过了两个负控制——对过度切分结构性失明 |
| 1 | `2026-09-30-python-phase1-rulings.md` · `-deferred.md` | FALLBACK 改为生成、` \|\| ` 分级、构建者自己写注册表条目；M1 剩余 + M2 八页。地基阶段的台账死在草稿区，裁决是事后重建的。开始列「控制方自己的失误」三类：无效的红、假绿、文书错误。 | 页面不显示输出——这条是波 1 终审发现的，之前的简报与模板都默认学生看得到 |
| 2 | `2026-09-30-python-phase2-rulings.md` · `-deferred.md` | 两波并行（M3 / M4），三个控制方；两次修门（#181、#183）。台账第一次活下来。 | 21 GB 那次事故：一个负控制本身就能把机器拖垮 |
| 3 | `2026-09-30-python-phase3-rulings.md` · `-deferred.md` | fixture 门（#187）、`dont_inherit`（#188）、M5 四页；随机数只许 `random.Random(种子)`。期控制方的合并核验第一次被要求进台账。 | #187 的作者按「我的做法更对」申报：子串式「逐行包含」守不住页面上的一行一行（`<p>` 的 `white-space: normal` 把段内换行塌成空格） |
| 4 | `2026-09-30-python-phase4-rulings.md` · `-deferred.md` | scipy-stack 层（#191，钉版本 + 严格模式）、逐层比类型（#192）、M6 五页；标准件 `probe.js`；英文跨页写 `the <页名> page`（P28）。 | 起草期原型在清单阶段就发现了门的盲区——比终审早两步 |
| 5 | `2026-09-30-python-phase5-rulings.md` · `-deferred.md` **（由期 5 收尾 PR 引入，文件名按既有命名推断；`e342ba2` 时未合）** | pygame 层（#196）、分段临摹（#198，engine `py-1.2.0`）、M7 四页（#199、#200）。 | 控制方简报的 `Color.lerp` 公式错、构建者对；原型 200/200 通过是因为 `t` 取了「好看」的值 |
| 6 | 期 6 收尾时再补 | MicroPython 层前提（#201）；写于 `e342ba2` 时，M8 三页与本文档 PR 在做。 | —— |

各期设计（清单与裁决表）在 `docs/superpowers/specs/2026-09-*-python-phase*-*.md`；主规格是 `2026-09-16-python-subproject-design.md`。

---

## 8. 仍由人做的验收

主规格 §9.1 的六条里，第 1–3 条（门全绿、根级门、读 CI）是机器的事；第 4–6 条原先要人做：

| 验收 | 为什么门做不到 | 现状 |
|---|---|---|
| `file://` 双击打开每个新页，三种模式、三级清空 | 浏览器工具开不了 `file://`，控制方一直用 http 预览打开 worktree 路径（第 1 期裁决 R15） | **已关闭**：用户 2026-09-30 在线上做过人工验收并关闭此项，有 bug 会提 |
| 复制程序粘进 PyCharm 真跑 | 门跑的是磁盘上的 `.py`，不是复制按钮交出去的文本；复制不带 `_fixtures/` | **已关闭**（同上）。机器侧的替代是 `python-content-wave` 第 4 步的「复制真跑」：用页面自己的 `Exercise.clean` 在裸 vm 里取、`python3` 跑 |
| 临摹三层在三种缩放下不错位 | 没有机械门 | 控制方用 `probe.js` 第 4 项量（`Range` 矩形 dx = dy = 0，带 +3px 负控制） |
| **pygame 真玩** | 门在结构上做不到：pygame 程序只过 `compile()`、property 只验纯逻辑函数，窗口、手感、帧率从没被人以外的东西看过 | 由用户按需做，不是待办 |
| **MicroPython 上板** | 门在结构上做不到：不装 MicroPython 运行时，硬件调用全部是桩（调用即 `HardwareStubCalled`） | 由用户按需做，不是待办 |
| matplotlib 画出来的图 | `program_run_check` 只比 stdout，`savefig` 写进临时目录即删；页面也不显示图 | 讲解里「图长什么样」只由评审对着代码读过（第 4 期账本 §四.3） |

---

## 9. 已知未做 / 未决

逐条的来龙去脉在最新一期的账本里（`2026-09-30-python-phase4-deferred.md`，期 5 的账本合并后以它为准）。这里只列还开着的、按「谁来定」分。

**方向已定、存量未改**

- **讲解与提示指向「页面上看不到的输出」**：第 1 期列的 27 处（25 个程序）加第 2 期 1 处，一直没改。「页面显示 `run.expect`」这条路已被用户否决，
  所以存量只剩逐条改写一条路（要给涉及的页升版）。
- **`boards`**：新规则已定（§2 第 9 条）；全库按新规则的审计由 boards PR 做，考纲对照文件随它进仓库。

**门与判定器**

- **判定器在行数不同时完全不比缩进**（`python/core/judge.js:162`）。`compare('if a:\n    if b: c()\nd()', 'if a:\n    if b:\n        c()\n    d()')` 在 `e342ba2` 上实跑仍是 `equal`——`d()` 被移出了外层 `if`。
  靠作者规矩挡着（多行空只挖同一层，或「复合语句头 + 一行体」）。第一次改 core 时先给 `judge_strictness_check` 加这条反例、看它红，再改判定器。
- **一个程序只有一个 property 入口**：多函数的程序只验一个（第 1、2 期账本列了实例），其余靠 `run.expect`。
- 建议的门，至 `e342ba2` 都还没做：fixture 必须被 git 跟踪；tag 规范化（存量两组分裂）；`isdigit` → `int()` 扫描；「照抄空」扫描（第 2 期账本 §三.4 列了 5 处存量，之后的账本没再跟踪；抽查 `infix-to-rpn`、`sentinel-running-total` 两处在 `e342ba2` 仍在）。
- 门在被测抛错 / 超时时印「参照返回：None」——那是占位，参照没被调用（`python-drill-tool` 已写怎么读它）。

**内容存量**（改就要给页升版，下一个动这些页的内容 PR 顺手做）

- 5 个程序打印内置 / 操作系统的异常消息（ch02 三个、ch05 两个）——`e342ba2` 时在 3.9.6 与 3.12.x 上逐字相同，CI Python 升版时要复查。
- 英文讲解里用「」括页名的存量（ch20、ch23、ch26、ch27），与 ch02 三处 `the Files and Errors page`（注册表页名是 Files & Exceptions）。
- 讲解用程序 id 指代兄弟程序（ch01–ch07）；`library-loans` 86 行被「不超过 80 行」筛掉；各期记下的钉法缺口。

**流程与配置**

- **`core.hooksPath` 改相对路径：待用户决定**（§6 第 15 条）。
- 全库「只由 `run.expect` 守」的部分、各期的等价变异清单：见各期账本，做负控制前先查。

---

## 10. 一句话交接

三百多个程序能在没人逐行复查的情况下长出来，靠的是两个独立裁判——CPython 真跑、机制不同的参照实现——和一条纪律：
**门在你把它守的东西改坏、亲眼看它变红之前不算数**；而这套东西每一次最有价值的纠正，都来自一个实现者说
「简报错了，我的做法更对」——第 0–4 期的裁决文件逐期记着：这样的上报没有一条被判为上报者错了。
