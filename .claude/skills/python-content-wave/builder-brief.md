# 构建者简报模板

控制方填好每个 `{{…}}` 槽（**REQUIRED** 的一个都不能空），把整段作为子代理的 prompt。
用**集成 worktree 里**的这份模板填（`$W/.claude/skills/python-content-wave/builder-brief.md`），不要用 Skill 工具加载出来的版本——那是主工作区的旧版。
派发参数：`isolation: "worktree"`，`model: "opus"`，同一波的构建者在同一条消息里并行派出。

---

你在为 MathViz 仓库的 `python/` 子项目构建一个练习页：**{{REQUIRED 页 id，如 py-strings}}**（模块 {{REQUIRED 模块号}}，章目录 `python/programs/{{REQUIRED chNN-slug}}/`）。
使用者是一名在读 A-level Computer Science 的学生，靠「读 / 挖空 / 影子临摹」把 Python 练成肌肉记忆；挖空按 token 严格判定。

## 先读（它们就是你的要求）

**用 Read 读你自己 worktree 里的文件**（下面第一步 `checkout -B` 之后再读，读到的就是集成分支的版本）。**不要用 Skill 工具加载 skill**——它读的是主工作区里的版本，主工作区不更新，是旧的。

1. `.claude/skills/python-drill-tool/SKILL.md` —— 全部写作规则、每道门守什么、新增一页的作业 A。**照作业 A 做。**
2. {{REQUIRED 清单出处，如 docs/superpowers/specs/2026-09-16-python-phase1-design.md §7.1}} —— 本页程序清单（id / 变体组 / 教什么 / P 参照）。清单审过了：**不增、不删、不换**；觉得某个程序不够经典或有更好的替换，写进报告，不擅自改。
3. {{REQUIRED 内容标准出处，如同一文件 §6}} —— 内容标准与页面边界。

**全库已用的 `problem` 名**（`variant_check` 按全库分组：单例程序的 `problem` 名若与下列重名，会被误并成跨页变体组，门不会红）：
{{REQUIRED 控制方从 `python/programs/*/chapter.json` 现取的 problem 名清单}}

## 工作区与基线

- 你在自己的 worktree 里工作。它是从 origin/main 切出来的，**不是**从集成分支——所以别 `merge --ff-only` 集成分支：它的基线不是集成分支的祖先时 ff-only 会失败
  （第 2 期 origin/main 在集成分支切出后前进过，两波十个构建者全部因此失败）；下面的 `checkout -B` 不管基线落在哪都对。
  **第一步**：先记下两个值——`git -C <你的 worktree> rev-parse --abbrev-ref HEAD`（原分支名，通常是 `worktree-agent-*`）与 `git -C <你的 worktree> rev-parse --show-toplevel`（worktree 路径）；
  `checkout -B` 之后原分支和这个目录都还在，控制方收尾时要按你报的名字清理。
  然后 `git -C <你的 worktree> status --short` 应为空、`git -C <你的 worktree> log --oneline origin/main..HEAD` 应为空（这个 worktree 还没有任何你的提交），
  再 `git -C <你的 worktree> checkout -B {{REQUIRED 构建者分支名，如 claude/python-wave-m1-py-strings}} {{REQUIRED 集成分支名，如 claude/python-wave-m1}}`，
  把 `git rev-parse HEAD` 与 `git merge-base HEAD origin/main` 两个值写进报告第一行。
  预期 HEAD = {{REQUIRED 集成分支 HEAD 的 SHA}}、merge-base = {{REQUIRED 派发前实测的 `git -C $W merge-base HEAD origin/main`}}；前两条不为空、或这两个值对不上，就停下报告。所有提交落在这条分支上。
- **续做时**（你回报过 BLOCKED / NEEDS_CONTEXT、又被叫回来）：原来那个 agent worktree 可能已被自动清理。先 `git -C {{REQUIRED 主工作区绝对路径}} worktree prune`（目录已删、登记还在时，下面的 `worktree add` 会 rc=128「is already used by worktree at <旧目录>」），
  再 `git -C {{主工作区绝对路径}} worktree list` 找你的分支；找不到它的 worktree 就 `git -C {{主工作区绝对路径}} worktree add {{主工作区绝对路径}}/.claude/worktrees/{{REQUIRED 波名}}-{{页 id}} {{构建者分支名}}`，在那里接着做，并在报告里写明新路径（控制方收尾时要清理它）。`worktree add` 只新建一个目录，不动主工作区的检出，与下面「不 checkout 主工作区」不冲突。
- **每条命令用绝对路径或 `git -C <你的 worktree>`**——Bash 的 cwd 会悄悄跳回主工作区。
- 临时文件放 `{{REQUIRED scratchpad 绝对路径}}`，**文件名以 `{{页 id}}-` 开头**。
- 开工前在你的 worktree 上跑一次 `python3 python/scripts/check.py`，末行应为 `{{REQUIRED 当前门数行}}`。

## 你交付什么

照 `python-drill-tool` 作业 A：工具页、章目录（`.py` + `chapter.json` + 需要时 `_fixtures/`）、需要时 `python/scripts/gates/refs/{{chNN_slug}}.py`、
**你自己追加的本页注册表条目**（`desc` / `tag` / `changelog` 可以是草稿，控制方集成时审改），以及重新生成的两个导航页——**按显式路径一起提交**，绝不 `git add -A`。
提交前自己跑三个生成脚本与 `check.py`（钩子脚本来自主工作区、可能是旧的，虽然它操作的是你 worktree 的文件），提交后读 `git status --short` 的每一行。

## 规矩

- **「我的做法与简报不一致、而我的做法更对」本身就是上报项。** 简报或规则里的断言事实上错了（数字、锚点、预期输出），停下上报，**不要改测试或门去迁就**。
- 报告「门变红」时贴出变红的那一行，并说明是**断言失败**还是**脚本崩溃**（崩溃的红与有效的红长得一样）。
- 负控制**串行**跑，从内存原字节复原，先确认基线是绿的；绝不 `git checkout` 一个被你改坏的文件来复原。
  变异之后门是绿的，先问这个变异是不是**等价程序**（第 3 期：Fisher–Yates 的 `range` 终点从 0 改成 -1 只多换一次自己、结果不变），是就换一个变异，并且别在注释里声称门守得住它。
- **负控制只做保证终止的变异**（改比较号、改常量、改下标都行；删掉 `visited.add`、删掉循环变量的更新这类可能死循环的不行——第 2 期一个这样的变异让门挂满 600 秒、swap 撑到约 21 GB、同机三个会话一起磁盘满）。
  跑 `check.py` 或任何子进程都带超时：**本机（macOS）没有 `timeout` 命令**，写 `timeout 120 …` 只会 rc=127、什么都没跑。用 Python：
  `subprocess.Popen(…, start_new_session=True)` + `communicate(timeout=…)`，超时或被打断时（`except BaseException`；SIGTERM 先用 `signal.signal` 转成异常）`os.killpg(p.pid, signal.SIGKILL)` 杀整个进程组（`subprocess.run(timeout=…)` 只杀直接子进程，孙进程会留下）。门自己也有时限（property 每次调用 2 秒、`program_run_check` 逐程序 `run.timeout`），子进程超时是兜底。
- **遇到 ENOSPC / 磁盘满**：停下回报。不删任何不是你自己写的文件（worktree、别人的草稿、缓存都不是你的）。
- 写文件时不要写反斜杠-u 形式的转义：写文件工具会把它解码成真实字符（U+2028 之类不可见字符会让页面解析器崩溃）。需要这类字符时用 `chr()` 构造；写完扫一遍 U+2028 / U+2029 / U+0085 / U+FEFF。
- 不推送、不开 PR、不合并、不改 git 配置、不 checkout 主工作区（`/Users/nickma/Develop/My2ndBrain/MathViz`）。
- **页面不显示程序输出**：挖空行里的字面量文字若只能从输出得知，就在最后一级提示里给出；讲解与提示都不写「看输出第 N 行」「和打印出来的一样」「第一行是……」；演示块算出的关键数字要在讲解里用文字说出来。
- 下面几条 `python-drill-tool` 里都有，第 2 期的构建者与终审反复在这里栽过，逐条对一遍：property 的 `entry` 不改实参；`cases` 走到每个返回分支；参照与被测机制不同（`inspect.getsource` 看标准库源码）；
  不挖跨嵌套块的多行空；挖空答案不许原样出现在同一程序没挖的行上（「照抄空」；从没挖的某一行删几个记号就能得到的也算——第 3 期 m5b 终审 I1）；讲解指别的程序写标题、指别的页写「页名」（用「」，不用星号）；用到递归的程序「用，不重讲」、`tags` 带 `recursion`。
- 读 `_fixtures/` 的程序：复制出去不带数据文件，讲解要把文件逐行抄出来——`fixture_notes_check` 要求中英两边都写出文件名、文件的**每一行各自成一段、连续、按原顺序**（所以 fixture 要短、不要空行）；
  源码里路径写全 `_fixtures/<名>`。提交后 `git ls-files` 对一遍磁盘上的 `_fixtures/`：根 `.gitignore` 的规则（第 3 期的 `*.log`）可能静默挡掉它，门读磁盘看不见。
- **随机数只许 `random.Random(<固定种子>)` 实例**（或把 `rng` / `seed` 当实参传进函数），不用模块级 `random.*`、不读时间；property 只挂在纯核心函数上，随机序列当实参传进去。
  每个用到随机的程序，在 `/usr/bin/python3`（3.9.6）与 `python3`（3.12.x）上各跑一次（照 `python-drill-tool`「生成 `run.expect`」的条件），stdout 逐字节比对，写进报告；
  同时跑一个版本相关的程序（`import sys; print(sys.version_info[:2])`）证明两边真是两个解释器。不一致就上报，不要只取一边。
- 判「全是数字」用 `isdecimal()`，不用 `isdigit()`（`'²'` 过得了 `isdigit`，`int()` 却会抛错）。新造 `tags` 之前先 grep 全库已有写法，跟已有的走。
- 长度取向约 {{REQUIRED 本期的行数取向，如 40 或 60}} 行（不含 BLANK 指令行，是取向不是门），超过的写进报告；{{REQUIRED 本期用不用 `chunks`，如「不用 `chunks`」}}。
- 你自己不派子代理（不派帮手，更不派评审）。评审由控制方安排。

## 报告

写到**你自己 worktree 里**的 `.superpowers/python-waves/{{REQUIRED 波名}}/{{页 id}}-report.md`（`.superpowers/` 是 gitignored，不进提交）——**不要**写集成 worktree：
你的 isolation worktree 会拒写它以外的路径（第 3 期 4 个构建者里 3 个被拒）。自己 worktree 里也写不进，就写到 `{{REQUIRED scratchpad 绝对路径}}/{{页 id}}-report.md`；不要换别的办法绕过拒写。
然后只回复：状态（DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT）、提交（短 SHA + 标题）、一行测试结论、顾虑、**报告的实际绝对路径**（控制方要去那里拷）。

报告必须包含：
1. 第一行：原分支名与 worktree 路径（`checkout -B` 之前记下的），实测 `HEAD` 与 `merge-base`。
2. 每个程序：挖了哪几行、level、为什么这一行写法唯一（或第 1 级提示钉住了哪一点）；你用判定器试过的等价写法及结果。
3. 每个 `run.expect` 的生成命令（照 `python-drill-tool`「生成 `run.expect`」一节）。
4. 每个 P 程序：你实际跑过的一个变异，门在哪组实参上变红（贴红行，注明断言失败还是崩溃）；各返回分支的覆盖证据；`entry` 不改实参的确认（怎么确认的）。
5. 拿不准的 `boards`（照现行规则四个都写上，只列出拿不准的）。
   另列：超过长度取向的程序与行数；新造的 `tags`（及你 grep 过的全库已有写法）；用到随机的程序的两解释器比对结果（含版本相关程序那道负控制）；读 `_fixtures/` 的程序的 `git ls-files` 核对结果。
6. 注册表条目已由你加入的确认，以及 `desc` / `tag` / `changelog` 草稿原文。
7. 与清单或规则的全部偏离及理由；简报里写错的地方。
8. `check.py` 末行。
