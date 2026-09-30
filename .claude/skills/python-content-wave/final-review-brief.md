# 整波终审简报模板

全部页集成、控制方亲验之后派发。`model: "opus"`，前台运行。评审包：
`git -C $W merge-base origin/main HEAD` 实测基线，用 superpowers:subagent-driven-development 的 `scripts/review-package` 或
`git log --oneline` + `git diff --stat` + `git diff -U10` 写进**一个**文件，把路径给评审员。
用同目录的 `fill-template.py` 填每个 `{{…}}`（不在 shell heredoc 里拼）；**不要**加入「不要报 X」「最多算 Minor」之类预判结论的话。用集成 worktree 里的这份模板（本波改过 skill 时只有那里是新的）。
同一份「只读」一节也给范围复审员用；修复实现者的简报照抄其中临时文件那一句。

---

你是这一波 python 内容的整分支评审员。本波构建了 {{REQUIRED 页列表}}，将作为一个 PR 合并。每页**没有**单独评审过，你是唯一一道评审。

## 要求来源
- 写作规则与门：`.claude/skills/python-drill-tool/SKILL.md`
- 程序清单与内容标准：{{REQUIRED 清单与标准出处}}
- 控制方台账（构建者报告摘要、偏离、裁决）：{{REQUIRED 台账路径}}
- 构建者报告：{{REQUIRED 报告路径列表}}

## 评审包
**Base:** {{REQUIRED Base}}  **Head:** {{REQUIRED Head}}
**Diff 文件:** {{REQUIRED Diff 文件}}
其中工具页的 `GENERATED:*` 区段与导航页 FALLBACK 是生成物：用 `python3 python/scripts/build_programs.py --check`、`inline_core.py --check`、`sync_fallback.py --check` 各跑一次验证，不逐行读。
.py、chapter.json、refs、注册表条目逐个读。

## 只读
不改 worktree 里受版本控制的文件、索引、HEAD、分支（下面的报告写进 worktree 的 `.superpowers/`，那是 gitignored 的台账目录，不算改 worktree）。**临时文件与导出副本一律放草稿区 `{{REQUIRED scratchpad 绝对路径}}`**，文件名以 `{{波名}}-review-` 开头（范围复审员用 `{{波名}}-rereview-`，修复实现者用 `{{波名}}-fix-`）——**不放进 worktree**，`.superpowers/` 下也不放。草稿区里的东西**不必删，也不要试着删**，删被拒时更不要换命令绕（第 4 期把临时文件放在台账下的子目录，四方的 `rm -rf` 全被拒，集成 worktree 因此删不掉）。**报告**写到 {{REQUIRED 集成 worktree 的 .superpowers/python-waves/<波>/review-report.md}}（草稿区会随会话重启清空，第 2 期 M3 的终审报告就这样丢了，只剩回传摘要）；报告引用的、值得留下的脚本（照抄扫描器、泄漏扫描器、变异驱动）拷一份到报告旁边，导出副本不拷。改动性检查（变异看门红）在导出的副本上做：`mkdir -p <草稿区>/{{波名}}-review-copy && git archive HEAD python | tar -x -C <草稿区>/{{波名}}-review-copy`（`tar -C` 要求目录已存在），先 `diff -r` 确认与 worktree 相同（门的根目录由脚本自身位置决定，副本是独立的树）；串行、从内存原字节复原并断言字节相同——这样只读严格成立（波 2 复审员的做法）。`check.py` 至多跑一次。你不派子代理。
**变异只做保证终止的**：删 `visited.add`、删循环变量的更新这类可能死循环的不做——第 2 期 M4 终审就是这样让门挂满 600 秒、swap 撑到约 21 GB、同机几个会话一起磁盘满。
子进程一律带超时，而**本机（macOS）没有 `timeout` 命令**：用 Python `subprocess.Popen(…, start_new_session=True)` + `communicate(timeout=…)`，超时或被打断时（`except BaseException`；SIGTERM 先用 `signal.signal` 转成异常）`os.killpg(p.pid, signal.SIGKILL)` 杀整个进程组。遇到 ENOSPC 就停下回报，不删任何不是你写的文件。

## 要查的
**规格**：清单逐条对上（id、变体组、教什么、P 参照）；每程序 ≥ 1 空；每页 ≥ 1 个变体组；页面边界；元数据闭集；`boards` 逐个对照 `docs/superpowers/specs/2026-09-30-python-boards-syllabus-map.md` 的判定原则与条目（只写考纲点名了核心教学点的考试局，考纲外写 `[]`）；注册表条目字段、accent 按模块表、version / engine 一致。

**内容（逐个空）**——在 node 的**裸 `vm` context** 里加载工具页内联的 core（`GENERATED:PY-LEX` … `GENERATED:INTERACT` 各区段，按页面里的顺序），对标准答案与每一种你想得到的「同样好的写法」调用 `PyInteract.blankFeedback(answer, reference, lang)`。
**不要 `require` `python/core/*.js`**：`require` 与 `node -e` 都定义了 `module`，UMD 外壳走 node 分支，测的不是浏览器跑的那一支（根 `CLAUDE.md`；第 5 期 m7a 终审员用了 `require`，修复者改用裸 vm 重验）。先断言 context 里 `typeof module === 'undefined'`。
每种写法前面**拼上这个空的缩进**（`b.indent + 写法`，`b` 取自 `Exercise.parse(source).blanks`），并**先断言标准答案本身判对**——这就是这项测量的负控制：不拼缩进时判定器报第 1 行缩进对不上（`lead-indent`），看上去像「钉法漏了」，其实与写法无关（第 5 期 m7b 控制方头一轮这样误判过）：
- 被判错的等价写法，第 1 级提示有没有钉住？没钉住就是问题。
- 提示是否逐级更具体，有没有哪一级说出了整行？
- `notes` / `blurb`（三种模式都显示）有没有逐字写出挖空的行，或示范一个判定器会判错的写法？
- **照抄空**：每个空的答案行去掉缩进后，有没有原样出现在同一程序**没挖**的行上？（第 2 期 M4 终审抓到 3 处、修复又扫出 2 处，没有门。）写个脚本扫**本波新增的程序**，再往一个副本里注入一行孪生，确认脚本报得出来。只由关键字和标点组成的行（`else:`、`finally:`、`try:`）不算。存量（ch01–ch14 的 5 处）已记在第 2 期账本 §三.4，不必再报。
  **近照抄也算**：从某一没挖的行上**剥掉一两层外壳**就得到答案——外壳指成对括号包住答案的部分（外层调用 `transpose(…)`，开头、结尾各算一段；切片 `[::-1]`）：删掉的每一段要么是外层调用头（`name(`）、要么只由闭括号组成、要么是完整的下标 / 切片（`[…]`），合起来括号配平、至多四段，且答案占那一行记号的一半以上。
  第 3 期 m5b 终审 I1：`board-move-2048` 的 right / up 两空都能从未挖的 down 行剥掉 `transpose(…)` 或 `[::-1]` 得到，裁定为照抄空一类。删掉的是参数、运算项、`as e`，或答案只是长行里的一小截（`return node` 之于 `return [node.value] + preorder(…) + …`），不算。
  扫描同样要有两道对照：注入一行孪生（负控制），以及拿 `board-move-2048` 修复前的版本（提交 `9994062`）确认 right、up 两条都报得出来（正对照）。
- **等价写法在挖空模式下能不能互抄**：挖空模式下所有空同时隐藏，两个空之间互相抄不到；只看**没挖**的行。
- **讲解泄漏**：`notes` / `blurb` 在三种模式都显示。写个脚本，把每个空的「核心」去掉空白后在中英 `notes`、`blurb` 与**每一级提示**里找——核心取：整行、赋值号右边、`print(…)` / `return` / `for` / `if` 后面的部分，
  **以及答案行里每一对括号 / 方括号里的内容**（长度 ≥ 4）。第 4 期 m6b 的第一版扫描没把括号里的内容当核心，漏掉了只出现在下标里的 `r * 2 + c`（讲解原文「格子 (r, c) 拿第 r * 2 + c 个名字」），补上这一条才报出来。
  候选逐条看过再报（`name`、`True` 这类单词命中是噪声）。两道对照：往副本的 notes 里注入一句含某个答案核心的话，确认报出（负控制）；拿一个已知泄漏的旧版本确认报出（正对照，例如 `subplots-grid` 修复前的 `5448b00`）。
  **照抄扫描与这道泄漏扫描同一个脚本、同一批空一起跑**，报告里写两者各自的命中数与两道对照的结果。
- 中英两种语言是否等义？学生从程序、讲解与提示能否推断出挖空行里的字面量文字？（页面**不显示**程序输出，`run.expect` 只给门用——「看输出就知道」不算。）

**页面文字**：工具页 `<title>` 元素里的 `&` 必须写成 `&amp;`（注册表与 `TOOL.title` 里照写 `&`；没有门看守 `<title>`，第 2 期 M3 抓到过裸 `&`）；讲解里指别的页：中文写「页名」，英文写 `the <注册表英文页名> page`（不加引号、不夹「」；第 4 期裁决 P28，存量留账不必报）；不用 `*星号*`（notes 按纯文本渲染，会原样显示，M4 抓到 8 处）。

**元数据与词表**：新造的 `tags` 与全库已有写法是否分裂——把本波的 tag 与全库（`python/programs/*/chapter.json`）比，折叠大小写、空格与连字符后相同的（`nested loops` / `nested-loops`）、同义不同形的（`2D list` / `list of lists`、`slice` / `slicing`）都算；
第 3 期 m5b 终审抓到 8 个，m5a 的终审没查、漏了 1 个（`lookup-table`）。存量分裂记在第 3 期账本 §二.6，不必再报。「全是数字」的判断是否用 `isdecimal`（`isdigit` 后接 `int()` 遇到 `'²'` 会抛错，第 3 期 m5a 终审 I1）。

**随机与 fixture**（本波有才查）：用到随机的 stdlib 层程序是否只构造 `random.Random(<种子>)`、没有模块级 `random.*` 调用、不读时间，构造 `Random` 的程序与清单标的一一对上；
scipy-stack 层 numpy 的随机数是否只用 `np.random.default_rng(<种子>)`、没有 `np.random.seed` / 模块级 `np.random.*` / `RandomState`（同层若用标准库 `random`，照上一条 stdlib 层查）；讲解里说出的随机结果是否写明「这个种子下」。
读 `_fixtures/` 的程序：fixture 文件是否都被 git 跟踪（`git ls-files` 对磁盘，门看不见这一项）；讲解逐行抄出的内容拼回去是否与文件逐字节相同。

**逐键**（本波有声明 `chunks` 的程序才做）：每个分段程序至少一段、段尾带空行的段优先，在裸 vm 里照人打的方式逐键驱动——一次一个字符喂 `Trace.create(段参考).update(缓冲)`；
换行走 `Editor.applyEnter`，与参考下一行的缩进差用退格 / 空格补齐；只打影子层**看得见**的部分（段参考去掉结尾换行），打完最后一个可见行再按一次 Enter，
之后与页面的 onTyped 一样只在插入时调 `PyInteract.chunkTailFill`。要的结果：`correct === total`、缓冲 === 段参考；负控制：不调 `chunkTailFill` 时段尾带空行的段必须到不了完成。
整段粘贴测不到这一类问题——第 5 期 #198 评审 I1（段尾空行看不见、逐键打的人永远到不了「段完成」）就是实现者与控制方都用整段粘贴验收、都没看见的。

**门与测量**：每个 P 参照的机制是否与被测程序不同（清单里写好的参照也查，看源码）；构建者报告的变异是否真能让门变红（抽一个自己跑）；`cases` 生成器是否真能走到被测函数的每个返回分支（改掉一个分支的返回值，门必须红）。
你的变异让门保持绿时，先判断它是不是等价程序（在 `cases` 的定义域里改不了任何答案），再下「门看不见」的结论——构建者报成「门盲点」的，也按这个口径复核。
门在被测抛错或超时时印的「参照返回：None」是占位（`library.py` 此时不调用参照），不是参照的返回值，别据此下结论。

## 输出
### Strengths
### Issues
#### Critical (Must Fix)
#### Important (Should Fix)
#### Minor (Nice to Have)
（每条：file:line、问题、为什么对这个学生要紧、怎么修）
### Assessment
**Ready to merge?** Yes | No | With fixes —— 理由一两句
