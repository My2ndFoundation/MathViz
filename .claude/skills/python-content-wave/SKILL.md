---
name: python-content-wave
description: >-
  Use when adding program content to the MathViz `python/` subproject as the orchestrating session —
  building one or more practice pages (py-strings, py-loops, py-sorting, a whole module, "第 N 期",
  "波 1", "M3 四页") from a program list through to a merged pull request, or when that list for a new
  module still has to be drafted with the user. Also when resuming such a wave after merge, review or CI.
  Not for writing a single program yourself (python-drill-tool covers the author's rules), for engine work in
  `python/core/`, or for `outputs/`, `chess/`, `cryptography/`.
---

# Python 内容波次 · 控制方作业

一「波」= 同一轮并行构建的若干页（通常一个模块），**一波一条集成分支、一次终审、一个 PR**。
写程序的规则不在这里：**REQUIRED BACKGROUND:** 读 `.claude/skills/python-drill-tool/SKILL.md`——构建者照它写，
终审照它查。本 skill 管的是从「要做这几页」到「PR 合并」之间控制方要做的每一件事。

下面写的每一处取值都来自第 0–4 期真实付过的代价；照抄，不要凭记忆重推。

## 运行（按顺序；⏸ = 停下等用户）

**0. 开工准备**
- 开**集成 worktree**（`M=/Users/nickma/Develop/My2ndBrain/MathViz`，`W=$M/.claude/worktrees/python-wave-<名>`）：
  `git -C $M fetch origin && git -C $M worktree add -b claude/python-wave-<名> $W origin/main`。
  **主工作区（`/Users/nickma/Develop/My2ndBrain/MathViz`）从头到尾不 checkout、不 rebase、不 pull**——它属于用户和别的会话。
- **开完集成 worktree，先用 Read（不用 Skill 工具）从 `$W/.claude/skills/python-content-wave/SKILL.md` 重读本 skill**（连同同目录的模板与 `$W/.claude/skills/python-drill-tool/SKILL.md`），以后一律照 `$W` 里的版本做。
  Skill 工具加载的是**主工作区**里的 skill，而主工作区不 pull，它永远停在旧提交上（第 3 期整期停在 `533c813`，m5b 控制方第 0 步读到的是缺 `checkout -B` 等修正的 #186 之前的版本）。
  **这一条对用 Skill 工具加载本 skill 的读者无效**——主工作区前进之前，他们读到的正是没有这一条的旧版（`533c813` 那份里「重读」「checkout -B」都是 0 处）。
  所以它还必须写在读者一定会读到的地方：**给控制方的派发简报（期级简报、派模块控制方的简报）第一句**写「开完集成 worktree 后，用 Read 读 `$W/.claude/skills/` 下的 `python-content-wave` 与 `python-drill-tool`，不用 Skill 工具」。
  主工作区要不要前进、或在用户级记忆里放一句指路，是用户的决定（第 3 期裁决文件与账本 §四.10）。
  给子代理的简报也用 `$W` 里的模板填，并在简报里让它们用 Read 读自己 worktree 里的 skill 文件、不用 Skill 工具。
- 在集成 worktree 上跑全量验收（见「验收命令」），全绿才继续；把输出末行抄进台账。
- 台账目录：`$W/.superpowers/python-waves/<名>/`（gitignored）。`progress.md` 第一行写本波页面与基线 SHA，以后每一步、每一条裁决都追加进去。
  **本波一切要活过会话的东西都放这里**——构建者报告（构建者写在它自己的 worktree 里，控制方收到回复就拷来，见第 2、3 步）、终审 / 修复 / 复审报告、集成与验收脚本、中断实现者的 patch。**不放草稿区**：
  草稿区随会话重启清空，第 2 期三次重启丢过构建者报告、终审报告和 M3 的集成脚本，台账是因为放在这里才活下来的。
  反过来，**一次性的临时文件（导出副本、克隆、注入副本、驱动脚本的输出）只放草稿区、不放台账**——见第 5 步；台账里放的是要留下来的东西。
- `git -C $W count-objects -vH` 存进台账目录的 `git-size-before.txt`（`count` · `size` · `in-pack` · `size-pack` 四个字段，收尾账本要用），并在 `progress.md` 记一行「何时、在哪个 SHA 上测的」——
  文件时间戳是拷贝时间，第 3 期 m5a、第 4 期 m6a 都没记，收尾账本只能推。
- 若本期规格里还写着「每页一个 PR」「每页两轮评审」，以本 skill 为准，并在本波 PR 里把规格那几句改掉（台账记一条裁决）。

**1. 程序清单**
- 有审过的清单（某期规格里逐页列好的表）→ 直接用，台账记下出处。
- 没有 → 起草：逐页列 `id | 变体组 | 教什么 | P 参照`，依据主规格 §2.2 的页清单、`python-drill-tool` 的内容标准与页面边界；
  查重：全库程序 id（`python/programs/*/chapter.json`）、已有页讲过的问题、同波相邻页的主题。写进本期规格。**⏸ 用户审完清单才派构建。**
- 起草时对**每个程序**问三句：用不用递归（⟳，归进「用，不重讲」的裁决——第 2 期 M4 的 `merge-vs-insertion-counts` 用了递归而清单没标，构建者自己加了 tag）；
  用不用随机、用哪个生成器（🎲；stdlib 层只许 `random.Random(<固定种子>)`，scipy-stack 层 numpy 的随机数只许 `np.random.default_rng(<固定种子>)`、标准库 `random` 照 stdlib 层，见 `python-drill-tool` 内容标准）；读不读 stdin（⌨）。三类各在清单里单列一节，交审。
- **每页的页名（注册表 `title`，中英）在清单里就定下来**，并与全部模块的页名（含还没做的，如 M7「图形与游戏」）比一遍会不会混。第 3 期 py-games 的「游戏」到终审才被指出与 M7 相混，改成「控制台游戏」只能另开一个提交。
- **清单里举的例子要真能触发它声称要测的东西。** 给 `cases` 的边界例、讲解里「没有 X 就会出错」的例子，起草时拿一个**故意去掉 X 的错误实现**跑一遍，确认输出真的不同。
  第 3 期 m5b 清单给 2048 举的 `[2, 2, 2, 2]` 触不到 stack 写法的「刚合并」标志（删掉标志照样得到 `4, 4`），构建者换成 `4, 0, 4, 8` 才看得出差别。
- **起草期原型：每个拟带 P 的程序写「正确实现 / 错误实现 / 纯 Python 参照 / cases」四件套**，用门自己的种子、组数与逐层比较跑一遍，结果写进清单。
  第 4 期两波都做了：m6b 的原型在清单阶段就发现门只比顶层类型（→ #192），m6a 的原型报出两个只抓到 36/200、61/200 的错误实现。
  要的结果：正确 == 参照 200/200；每个错误实现报出**命中数**（错误 ≠ 参照的组数）——低于约 50/200 的，清单里写明、要求构建者调 cases（把逼出边界的输入按一定概率专门造）。
  原型放台账（`draft-proto.py`），它只证明「这个 P 能写、参照机制不同、cases 触得到错」，**不是给构建者抄的实现**。骨架（`sys.argv[1]` 给集成 worktree 路径）：
  ```python
  import random, sys
  import numpy as np
  sys.path.insert(0, sys.argv[1] + '/python/scripts')
  from gates.library import _deep_mismatch                 # 门自己的逐层比较（#192）
  from gates.properties import SEED, SAMPLES               # 门的种子与组数

  def ok(xs, t):    a = np.array(xs, dtype=int); return a[a > t].tolist()    # 正确实现
  def wrong(xs, t): a = np.array(xs, dtype=int); return a[a >= t].tolist()   # 错误实现：学生最可能错的那一处
  def ref(xs, t):   return [x for x in xs if x > t]                          # 纯 Python 参照，机制不同
  def cases(rng):   return ([rng.randint(-9, 9) for _ in range(rng.randint(0, 8))], rng.randint(-3, 3))

  rng, agree, hits = random.Random(SEED), 0, 0
  for _ in range(SAMPLES):
      args = cases(rng); want = ref(*args)
      agree += _deep_mismatch(ok(*args), want) is None
      hits += _deep_mismatch(wrong(*args), want) is not None
  print(f'正确 == 参照 {agree}/{SAMPLES} · 错误被抓 {hits}/{SAMPLES}')
  ```
  这个例子照抄只抓到 32/200——阈值很少恰好等于某个元素；`cases` 改成一半阈值取自 `xs` 就是 103/200：
  ```python
  def cases(rng):
      xs = [rng.randint(-9, 9) for _ in range(rng.randint(0, 8))]
      return (xs, rng.choice(xs) if xs and rng.random() < 0.5 else rng.randint(-3, 3))
  ```
  骨架自己的负控制：把 `ok` 的 `.tolist()` 换成 `list(…)`（列表里装着 numpy 标量），正确 == 参照掉到 44/200。一个错误实现不够时，每个 `return` 分支各写一个。
  pygame 层（M7）的原型把 `import numpy` 换成 `import pygame`，并在导入前设无头环境：`SDL_VIDEODRIVER=dummy`、`SDL_AUDIODRIVER=dummy`、`PYGAME_HIDE_SUPPORT_PROMPT=1`（与 CI 相同，主规格 §5.4 末段）。
- **清单里写到第三方库参数的语义，起草时核一句出处**：`inspect.getsource(…)`、`help(…)` / `__doc__`，或官方文档；核不到就不写进清单。
  第 4 期 m6b 清单两处都凭印象写错、都是构建者纠正的：多列 `sort_values` 走 `lexsort_indexer`、根本不读 `kind`（`inspect.getsource(pd.DataFrame.sort_values)` 一看便知）；
  「`.mean()` 返回 numpy 标量、打印前 `float()`」只对单个值成立，迭代 Series 交回的已是 Python 数。
- `problem` 命名：不在变体组里的程序，`problem` 一律等于程序 id（id 全库唯一有门守）；变体组名由控制方对全库现有 `problem` 名**和**并行的另一个模块的组名交叉核一遍——
  `variant_check` 按全库分组，重名会被静默并成一个跨页变体组，门不会红（第 2 期两个模块并行，靠这条零撞组）。

**2. 派构建者**
- 每页一个子代理，**同一条消息里并行派出**，`isolation: "worktree"`，`model: opus`。
- 派发前先 `git -C $M fetch origin`；若 origin/main 已前进，先把它合进集成分支、跑一次 `check.py`。然后实测两个值填进简报：集成分支 HEAD（`git -C $W rev-parse HEAD`）与
  `git -C $W merge-base HEAD origin/main`——后者是**派发前实测**的，不是集成分支切出时的 SHA（合过 main 之后两者不同，照切出时的填，构建者会在第一步全部停下）。
- 简报用 `builder-brief.md` 填，**每个 REQUIRED 槽都要填**。
  构建者的 isolation worktree 是从 origin/main 切出来的，不是从集成分支：简报让它 `checkout -B <构建者分支> <集成分支>`（新 worktree 没有自己的提交，安全），
  **不要**写「`merge --ff-only <集成分支>`，不是就停下」——worktree 基线不是集成分支的祖先时 ff-only 会失败。第 2 期就是这样：#179 / #180 落在集成分支切出（`83e7a2d`）之后、
  派发之前，构建者 worktree 建在 `601d487`，两波十个构建者全部在这一步失败（M3 五人由控制方叫回来 `reset --hard`，M4 五人各自偏离简报、自行落到正确基线）。
  照上一条先合 main 之后 ff-only 会成功，但 `checkout -B` 两种情况都对，不依赖时序。
- 构建者报告第一行先报它**原来**的分支名（`checkout -B` 之前的 `git rev-parse --abbrev-ref HEAD`，通常是 `worktree-agent-*`）与 worktree 路径——
  `checkout -B` 之后原分支还在、isolation worktree 目录也还在，**每个**构建者都会留一套，不只是自建 worktree 的那几个（第 2 期因此有 46 个 `worktree-agent-*` 分支分不清归属）。控制方把它们逐个记进台账，第 7 步按台账清理。
- 构建者回报 BLOCKED 后续做时，它的 agent worktree 可能已被自动清理；它会按简报先 `git worktree prune`、再在 `$M/.claude/worktrees/<名>-<页>` 自建一个。自建目录同样记进台账。
- 构建者自己加注册表条目、连同重新生成的两个导航页一起提交（设计 §8.1）。
- **派发前定一张本波共有约定表，填进每一份构建者简报**（`builder-brief.md` 的 REQUIRED 槽），并行的构建者互相看不见：
  全波共有的 tag 与拼法（至少库名、模块的主题词——第 4 期 m6a 三页并行，`numpy` tag 两页全带、一页一个没带，终审 I2）；
  英文讲解里指别的**程序**（变体标题）的写法。指别的**页**不进表，已有定论（第 4 期裁决 P28）：中文「页名」，英文 `the <注册表英文页名> page`，不加引号、不夹「」——
  第 4 期两波各自定，结果一边 `the Lists page`、一边「Lists」，全库一度 37 段对 36 段（第 4 期账本 §三.6）。
  两波并行时这张表由期控制方给，两波同一张。
- **构建者的报告写在它自己 worktree 的 `.superpowers/python-waves/<名>/<页>-report.md`**，不写集成 worktree：isolation worktree 拒写**主工作区目录树里、它自己 worktree 以外**的路径——
  集成 worktree 就在 `$M/.claude/worktrees/` 下，所以被拒（提示原话「Edit the worktree copy of this file instead of the shared-checkout path」）；scratchpad 不在主工作区树里，写得进（py-simulation 的报告就写在那里）。第 3 期 4 个构建者照 #186 的模板写集成 worktree，3 个被拒、1 个写成——行为不稳定，不能赌。
  自己 worktree 也写不进就写 scratchpad，并在回复里给**实际路径**。终审员、修复实现者、复审员不是 isolation worktree，报告照旧写 `$W/.superpowers/python-waves/<名>/`。

**3. 集成**（在集成 worktree 里，按模块内页序逐页）
- 收到构建者回复就把它的报告从回复里给的实际路径拷进 `$W/.superpowers/python-waves/<名>/`，最迟在合这一页之前（构建者 worktree 第 7 步就删了；落在 scratchpad 的，会话一重启就没了）。
- `git -C $W merge --no-ff <构建者分支>`。`python-tools.json`、`python/app.html`、`python/index.html`、工具页 `GENERATED:PROGRAMS` 冲突时**不手工合并**，跑配方脚本：
  ```bash
  python3 $W/.claude/skills/python-content-wave/resolve-registry-conflict.py --repo $W --take HEAD --from MERGE_HEAD && git -C $W commit --no-edit
  （它自己的 `--check-timeout` 默认 600 秒：**调用它的那一层（例如 Bash 工具）的超时要更长**，或把 `--check-timeout` 调到更短——
  外层先超时发 SIGKILL 的话谁也接不住，脚本来不及杀它起的门进程组。）
  ```
  脚本路径用集成 worktree 里的绝对路径（`$W/…`）；**必须用 `&&` 接提交**——脚本红了之后冲突在索引里已标为解决，分成两行写的 `git commit` 会照样成功，提交里的注册表缺条目（没有钩子时实测如此）。
  它做的就是配方的每一步：取集成分支版本 → 把构建者分支多出的注册表条目追加回 `tools` 末尾 → `build_programs.py`、`inline_core.py`、`sync_fallback.py`、`check.py`
  → 只 `git add` 显式路径。脚本在收尾时拿两次真实合并回放过：M3 `b06736d`（集成 py-stack-queue）与
  M4 `3196e7e`（M4 合 main），暂存结果与当时手工按配方做出的提交**逐字节相同**。
- 退出码：`0` 已暂存；`1` 生成脚本或 `check.py` 红（或超时）——**照它打印的恢复命令做**，不要直接 `git merge --abort`：`--take MERGE_HEAD` 时索引已 ≠ HEAD、
  生成脚本又改过工作区，直接 abort 会 rc=128 `not uptodate`；只把注册表和两个导航页 `checkout HEAD` 再 abort，abort 会成功，但生成脚本改到的别的页会留在工作区。
  打印的命令先把这两类都复原（`checkout HEAD -- <注册表、两个导航页、冲突的页>`，再 `checkout -- <生成脚本改过的其余文件>`），最后 `merge --abort`；`2` 冲突落在这几类文件之外、什么都没动；`3` 同一个已有条目在 `--from` 一侧改过、又与 `--take` 一侧不同，什么都没动。
- **退出码 3 是升级波的事**：本波若要改已有工具的注册表条目（升级已有页、改 `desc` / `tag`），合并时这几条取哪一侧都会丢掉另一侧的改动，脚本不替你选。
  这几条手工处理、在台账里写明理由——这是下面红旗「注册表冲突不手工改」的**唯一例外**；其余条目、导航页与生成区段仍然跑配方。
  只有 `--take` 一侧改过的条目（例如合 main 时 main 升级了一页、本波没碰）照常取 `--take` 一侧，不算冲突。
- 每合一页跑一次 `check.py`，全绿再合下一页。构建者报告里的偏离、简报错误、`boards` 的判定依据（尤其是写了 `[]` 或只写部分考试局的，以及查不到条目、照 R5 没写的）抄进台账；判定规则与依据文件见 `docs/superpowers/specs/2026-09-30-python-boards-syllabus-map.md`。
- 全部页合完、送终审之前，**先扫一遍本波的 tag**：与全库（`python/programs/*/chapter.json`）比，折叠大小写 / 空格 / 连字符后相同的、同义不同形的，在这里就统一（约定表里没列到的新 tag 最容易分裂）——别留给终审当 Important 报。

**4. 控制方亲验**（全部页集成之后、终审之前）
- 全量验收命令。
- 每页一个亲手负控制（先确认基线绿 → 变异 → 看门因断言失败而红、不是崩溃 → 从内存原字节复原 → 复绿），**串行**跑，**只做保证终止的变异**，
  子进程一律用 Python `subprocess.Popen(…, start_new_session=True)` + `communicate(timeout=…)`，超时或被打断时（`except BaseException`；SIGTERM 先用 `signal.signal` 转成异常）`os.killpg(p.pid, signal.SIGKILL)` 杀整个进程组，以此兜底（`subprocess.run(timeout=…)` 超时只杀直接子进程，`check.py` 起的 node / python 孙进程会留下；配方脚本的 `run_grouped()` 就是这个写法；**本机没有 `timeout` 命令**——第 2 期两个会话都写过 `timeout 120`，一个验收循环因此全部 rc=127 却没停下）：
  页里有带 `check.property` 的程序 → 变异其中一个的被测函数，`algorithm_property_check` 应红；
  页里没有 → 改一个程序 `run.expect` 里的一个字符，`program_run_check` 应红。
  **变异之后门是绿的：先问这个变异在语义上是不是等价**，是就换一个，不是再怀疑门。第 3 期 m5a 第一次选了 `competition-ranking` 的 `place = len(rows) + 1`——rows 每轮恰好多一行，它恒等于 `position`，门绿是对的；
  改选密集排名才断言红。已知的等价变异记在各期账本「门与测量看不见的」一节。
- **用到随机的 stdlib 层程序，控制方独立再跑一次两解释器比对**（构建者报告里有一次，不算）：`/usr/bin/python3`（3.9.6）与 3.12.x 各跑**本波全部 stdlib 层程序**
  （`runtime: cpython` 且 `requires` 为空；每个程序在全新临时目录当 cwd 里跑，`_fixtures/` 照门的方式整个 `copytree` 进去——读 fixture 的波不拷就全红），stdout 逐字节相同且等于 `run.expect`。
  scipy-stack 层不做这一项（`/usr/bin/python3` 没有 numpy；那一层的随机数靠钉住的库版本，见 `python-drill-tool` 内容标准）。两道负控制都要有：
  ① 一个版本相关的程序（如 `import sys; print(sys.version_info[:2])`）两边**必须不同**——否则可能两次跑的是同一个解释器；
  ② 扫模块级 `random.<函数>(` 调用与读时间的正则，先断言它对 `random.choice(xs)` 命中、对 `rng.choice(xs)` 与 `random.Random(1)` 不命中。
  再数一遍构造 `random.Random(` 的文件，与清单的 🎲 逐一对上（按正则数，不按子串 `random` 数——第 3 期的记录里「11」就是子串计数，多数了一个文档串写着 randomness 的程序）。
- **读 `_fixtures/` 的页**：`git -C $W ls-files 'python/programs/*/_fixtures/*'` 与磁盘上的 `_fixtures/` 文件逐一对上——门读磁盘，看不见「文件没被 git 跟踪」（第 3 期 `access.log` 被根 `.gitignore` 的 `*.log` 静默挡过，本地全绿、CI 会缺文件）。
  并做一次 `fixture_notes_check` 负控制：改 fixture 一个字符 → 断言红（中英各一条点名缺的那一行），从内存原字节复原（第 3 期 m5a 控制方做过，m5a 台账第 4 步）。
- **`.gitignore` 这类要 `git add` / `git rm` 才测得到的负控制，在 scratchpad 的临时仓库里做**（`git init` 一个、拷进要测的 `.gitignore` 与几份样例文件）：在集成 worktree 里跑 `git add` / `git rm` 的组合会被权限拒，
  而且会碰共享索引；临时仓库里测到的忽略规则与这里等价（第 3 期 m5a 就这样做的：旧规则 `git add` 静默跳过 `probe.log`，新规则暂存它，别处的 `stray.log` 仍被忽略）。
- 浏览器：见「浏览器验收」。
- 复制内容真跑（`_fixtures/` 要像 `program_run_check` 一样整个 `copytree` 成临时目录里的 `_fixtures/`，平铺到根目录会全红——
  而且这项测量与门一样拷了 fixture，**观察不到**「粘进 PyCharm 缺数据文件」，那一项只能靠人）：每页用 `random.Random(<固定种子>).sample` 抽 3 个程序，取读 / 挖空（每空填标准答案）/ 临摹三种模式的复制内容，
  断言三者相同且不含 BLANK 指令，在全新临时目录按 `run.expect` 的条件用 python3 跑，stdout 逐字节比对。
  **复制内容用页面自己的代码取**：node 裸 `vm` context 里加载页面内联的 core，调 `Exercise.clean` / `PyInteract.copyPayload`（走浏览器分支，见根 `CLAUDE.md` 的 `node -e` 陷阱），
  不要自己写正则剥指令——第 2 期 M3 控制方的正则只认 `# >>> BLANK`，被一行 `# >>>BLANK`（少一个空格，解析器与门都接受）骗过一次，报成页面与本地不一致。
  负控制：挖空填一个错答案，stdout 必须对不上。

**5. 终审（整波一次）**
- `git -C $W merge-base origin/main HEAD` 实测基线，打包整波 diff，用 `final-review-brief.md` 派 opus 评审。不写「不要报 X」一类预判。
  评审必须逐个空查四件事：被判错的等价写法第 1 级提示有没有钉住；提示有没有哪一级说出整行；`notes` / `blurb` 有没有逐字写出挖空行或示范判定器会判错的写法；中英是否等义。
- 有发现：**一次**修复派发（全部发现一起给一个实现者）→ **一次**范围复审 → 残留问题带裁决记进台账。不做逐页评审循环。
  修复实现者直接在集成 worktree 里改（不另开 worktree）；它回报之前，控制方不在 `$W` 里做任何写操作。
  修复简报里写明：遇到 ENOSPC / 磁盘满就停下回报，**不删任何不是自己写的文件**（第 2 期 M3 的修复实现者这样做了，磁盘满的真因在别的会话）；负控制只做保证终止的变异、带超时。
- **评审员、修复实现者、复审员的临时文件一律放草稿区（scratchpad），文件名带波名与角色前缀**（`<名>-review-`、`<名>-fix-`、`<名>-rereview-`）；导出副本、克隆、注入副本、驱动的输出都算。
  台账里只写**报告**，以及报告引用、值得留下的脚本（扫描器、变异驱动）——拷一份进去，不把导出副本拷进去。**草稿区里的东西不必删，也不要试着删**，更不要换命令绕。
  为什么：第 3 期写回的做法是放台账下的一个临时子目录、删不掉留给控制方统一删；第 4 期 m6b 的评审、复审、修复者与控制方的 `rm -rf` **全部被权限拒**，38 项、22 MB 留在集成 worktree 里，
  而删 worktree 等于绕过那次拒绝——worktree 与分支只能留给用户删（m6a 那一波控制方却删掉了：同一个动作结果不稳定，不能当流程的前提）。
  草稿区在仓库目录树外：留在那里的东西不挡 `git worktree remove`，也不会被第 7 步的 `cp -R` 拷进台账。它成立的理由是「不必删」，不是「删得掉」——第 4 期收尾在草稿区里 `rm -rf` 同样被拒过。
- **范围复审报出的 Important 若只动提示 / 讲解文字**（不动程序体、refs、门、注册表以外的东西），控制方可以照复审给的文字直接落地，不开第二轮修复：
  落地后对改过的每个空用判定器（`PyInteract.blankFeedback`）跑标准答案与复审列出的写法，把判对 / 判错表连同钉住每个判错写法的那一级写进台账，再跑 `check.py`（第 4 期 m6a V8、m6b 裁决 10 都这样做）。
  动到程序体、refs 或 `run.expect` 的，仍走修复实现者 + 复审。
- 修复实现者中途中断（会话重启、磁盘满）：先 `git -C $W diff > $W/.superpowers/python-waves/<名>/fix-partial.patch` 备份，再派新实现者，
  让它**先逐条判定**上一个人的改动「已完成 / 部分 / 未做」、写进报告，在上面续做，最后全量验证（第 2 期两波都这样接手，M4 的接手者据此查出前任半截的 refs 让门是红的）。

**6. PR**
- 推送前再合一次 origin/main（冲突照第 3 步，脚本用 `--take MERGE_HEAD --from HEAD`：以 main 为准、本波各页追加在后；退出码 1 / 3 的处理同第 3 步），全量验收重跑。
- 推送集成分支，`gh pr create`，描述用 `pr-body.md` 填（验证怎么做的就怎么写；PyCharm 那一项不打勾）。
- 读 CI：`gh pr checks <n> --watch`，再从日志里核对 `Successfully set up CPython (3.12.x)`、钉版本那一步打印的 `scipy-stack 2.3.1 2.3.0 3.10.3`（有 pygame 程序时还有 `pygame 2.6.1 dummy`）、python 门的「0 段因缺库跳过」与 `N 道门全绿`。红了读完整日志修，修复作为新提交。
- **⏸ 汇报 PR 链接、CI、负控制与裁决清单，等用户说合并。**

**7. 合并**
- 合并前：再读一次 `gh pr checks`；在 **PR head**（`gh pr view <n> --json headRefOid`，与你验过的 SHA 相同）上自己跑一遍全量验收，
  外加**一个自己挑的负控制**——不是 PR 作者做过的那几个（第 2 期集中合并的控制方对 #184、#185 各做了一次）。然后 `gh pr merge <n> --merge --match-head-commit <SHA>`。
  核验的事实（CI run、head、diff 范围、本地全量、自选负控制与结果）**写进台账**——期控制方写它自己的台账文件：第 3 期 #189 的核验只留在会话里，收尾时差点记成「缺记录」；第 4 期的期控制方台账做到了。
- **两波并行、由一个控制方集中合并时**：先合的那个 PR 一落地，后一个就必然与 main 的注册表 / FALLBACK 冲突。通知后一波的控制方：合 origin/main、
  用配方脚本（`--take MERGE_HEAD --from HEAD`）解、全量验收、push；它回报新的 head 之后，照上一条核 head 与 CI 再合。
- 合并之后、拷走台账之前：`git -C $M count-objects -vH`（只读，整个仓库共用一个 `.git`，在主工作区跑安全）存成台账目录的 `git-size-after.txt`，与第 0 步的 `git-size-before.txt` 对称
  （第 2 期两波的波后量只报在回报里、没进台账文件，收尾账本只能从回报转抄）。
- 拷台账之前看一眼台账目录：里面应该只有报告与脚本。导出副本、克隆按第 5 步在草稿区，不在这里——若有人放进来了，拷贝时排除它（`rsync --exclude`，`diff -rq -x` 同样排除），别为它去删东西。
- 删集成 worktree 之前，把**整个**台账目录拷到主工作区的 `.superpowers/python-phase<期>/<名>-ledger/`（gitignored；worktree 一删台账就没了），连脚本与探针一起、并核对：
  `mkdir -p <目标> && cp -R $W/.superpowers/python-waves/<名>/. <目标>/ && diff -rq $W/.superpowers/python-waves/<名> <目标>`（`diff` 无输出才算拷全；第 2 期 M4 只拷了 `*.md`，`m4-probe.js` 没保住，m5b 只好重写）。
  然后**先删 worktree、再删分支**（分支还检出在某个 worktree 里时 `git branch -D` 会报 used by worktree、rc=1）：
  先 `git worktree remove` 集成 worktree 与**台账里记下的**每个构建者的 isolation worktree 与自建 worktree，
  再删集成分支、各构建者分支与它们的原分支（`worktree-agent-*`）（本地 + origin），最后 `git -C $M worktree prune`。只删台账里有的——主仓库里别的 `worktree-agent-*` 可能属于别的会话。
- 复盘：构建者与评审员指出的简报错误 → 改本 skill 的模板或 `python-drill-tool`（单独一个小 PR）；
  `git-size-before.txt` 与 `git-size-after.txt` 的对比记进下一期账本。

## 验收命令

```bash
PYTHON_GATES_REQUIRE_SCIPY=1 python3 python/scripts/check.py   # 严格模式：缺 requires 里任何一个库即红（#196 起也管 pygame）
python3 scripts/check_nav_contract.py
python3 scripts/sync_registry.py --check
python3 scripts/apply_branding.py --check
python3 scripts/apply_footer.py --check
python3 scripts/apply_gallery_bg.py --check
python3 chess/scripts/check.py
python3 cryptography/scripts/check.py
python3 python/scripts/inline_core.py --check
python3 python/scripts/build_programs.py --check
python3 python/scripts/sync_fallback.py --check
for f in python/core/*.test.js; do node "$f"; done
```

**严格模式才是保证**：不设 `PYTHON_GATES_REQUIRE_SCIPY=1` 时缺库只是跳过、门照样绿——跳过的程序等于没验。非严格跑的时候**两行都要读**：
「程序真跑」行的「N 段因缺库跳过」（只数 scipy-stack 层——pygame 程序整段只过 `compile()`，永远不在这一行里），
与「性质比对」行尾的「因缺库跳过 pygame 层 N 个、scipy-stack 层 N 个」（按层名排序，只列有跳过的层；pygame 缺库只出现在这里）。
版本要是 CI 钉的那组：`python3 -c "import numpy,pandas,matplotlib;print(numpy.__version__,pandas.__version__,matplotlib.__version__)"` → `2.3.1 2.3.0 3.10.3`；
有 pygame 程序时 `PYGAME_HIDE_SUPPORT_PROMPT=1 python3 -c "import pygame;print(pygame.version.ver)"` → `2.6.1`（CI 那一步还打印 `pygame 2.6.1 dummy`，dummy 是无头 SDL 驱动）。

## 浏览器验收

浏览器工具**不能操作 `file://` 页面**。用预览服务器 `mathviz`（`preview_start {name: "mathviz"}`，端口 8777）。8777 可能已被别的会话的同一台服务器占着，这时 `preview_start {name: …}` 会失败；
退路是 `preview_start {url: "http://localhost:8777/.claude/worktrees/python-wave-<名>/python/tools/py-<页>.html?lang=zh"}`——那台服务器的根也是主工作区，worktree 路径照样取得到（第 2 期两波都这样做）。
它的根目录是**主工作区**，所以直接开根路径测到的是别的分支的旧文件；本 worktree 在它下面：
`http://localhost:8777/.claude/worktrees/python-wave-<名>/python/tools/py-<页>.html?lang=zh`。

**用标准件探针 `$W/.claude/skills/python-content-wave/probe.js`**，不要从上一波台账复制一份再改——第 3 期修了「量到换行符」只修在那一次测量上，第 4 期 m6b 的探针又量到了 `\n`。
每次导航后重新注入，每次调用都传显式 `tabId`：
```js
eval(await (await fetch('/.claude/worktrees/python-wave-<名>/.claude/skills/python-content-wave/probe.js', { cache: 'no-store' })).text());
await PYPROBE({ page: 'py-<页>', marker: '/.claude/worktrees/python-wave-<名>/.superpowers/python-waves/<名>/progress.md', copyIds: [/* 可省 */] });
```
它先断言 marker 取得到、且 `TOOL.id === page`，不成立就返回 `{ VOID: true }`——这次测量作废（量到的是别的分支或别的页）。然后逐项报数（文件头写着每一项怎么量）：
- 中英 × 读 / 挖空 / 临摹：面板元数据；挖空输入框数 == 挖空数 ≥ 1；临摹三层在。
- **字面量泄漏**：每个含 ≥ 3 字符字符串字面量的空改中间一个字符，中英各判一次（必须判错、反馈不印原文）。报 `literalChecks`——**0 次就是没测，不是通过**
  （第 2 期 M3 两页、M4 几乎全波，第 4 期 m6a 三页都是 0）；这时 `literalMode` 是 `'fallback'`，下面这一项就是字面量那一格的结论：
- 全部空各改一个字符 × 中英：0 次判对、0 次印出标准答案行、0 条空消息；加合成对照（`x = "abcd"` 答成 `"abcQ"`：判错、不印 `abcd`）。
- **页面层**（`literalDom`）：在页面上真点一次「检查」，看渲染出来的反馈——有字面量空用改了字面量的答案，没有（fallback）就用改了一个字符的答案，两种模式都走一次。
- **临摹对齐**：往输入层打入第一个程序的前 4 行，从末尾往前找**可见字符**（量到换行符时矩形退化，dx = 0 可能是假阴），用 `Range` 量它在 `.py-typed` 与 `.py-shadow` 里的矩形，
  `document.body.style.zoom` = 0.9 / 1 / 1.25 三档 dx = dy = 0；每档报这个字符的宽度，**宽度必须随缩放严格变大**（第 4 期实测 7.063 / 7.844 / 9.797）才证明缩放真的生效；
  负控制：把 `.py-typed` 的 `padding-left` 设成「原值 + 3px」（原值 16px），dx 必须是 +3（实测 +3；第 4 期两波与收尾初版是**设成** 3px，净减 13px，所以记的是 −13）。只比层外框宽度会得到假差异（`pre` 随内容收缩）。
- 给了 `copyIds`：读与挖空（每空填标准答案）的复制内容相同、不含 BLANK 指令；负控制：改一个空的答案，挖空的复制内容必须变得不同。
  **临摹不比**：`copyPayload('trace', …)` 按定义交回的就是她打的字（`state.typed` 本身），拿读的内容当 typed 传进去再比，恒真、什么也观察不到（收尾初版就这样比过，第 4 期收尾评审 I3）。
  复制内容**真跑**见第 4 步（node 裸 vm 取、python3 跑）。
- 收尾：zoom 复原、临摹输入清空、localStorage **只在本页的键上按差分复原**（`python-draft:` / `python-progress:` 后接本页程序 id 的键，加 `python-prefs` / `python-store-v` / `python-lang`）——
  8777 是几个会话共用的同源，`clear()` 再整份写回会抹掉、改回别的标签页这几秒里写的键。语言走 `ctl.setLang`（不改地址栏）；不点同意横幅。
回报里贴它返回的对象（至少 `literalChecks` / `literalMode` / `allBlanks` / `align` / `alignNegative` / `localStorageRestored`），不写「通过」两个字了事。
探针本身改了（页面 DOM 变了、要量新东西），改的是 skill 里这一份，并在真页面上做负控制，**两层分开做**：
把 `PyInteract.blankFeedback` 临时包成「消息里拼上标准答案」只控制判定层——页面内部调的是闭包里的 `blankFeedback`，包装到不了它（实测包了之后 `literalDom` 照样不泄漏）；
页面层要在 DOM 上注入，例如定时往 `.py-msg` 的文字后面接上标准答案，`literalDom.leaks` 必须变成 true。

`file://` 双击验收与「复制粘进 PyCharm 真跑」只能由用户做——PR 里列为未勾选项，不代为声称。

## 已知的坑

| 情形 | 后果 | 做法 |
|---|---|---|
| 在主工作区 checkout / rebase / pull | 改掉用户或别的会话的分支与未提交工作 | 一切 git 操作在集成 worktree 里，`git -C $W` |
| `core.hooksPath` 是共享 git 配置里的绝对路径，指向主工作区的 `.githooks` | worktree 里提交跑的是主工作区当前分支那份钩子**脚本**（可能是旧的），但它操作的是提交所在 worktree 的文件 | 不依赖钩子代跑生成脚本；提交前自己跑三个生成脚本与 `check.py`，提交后读 `git status --short` |
| 写文件工具把反斜杠-u 转义解码成真实字符 | 不可见的 U+2028 进了源码或提示；`js_parser_parity_check` 会红，文档里则悄悄变假 | 代码里用 `chr(0x2028)`；写完扫一遍 U+2028 / U+2029 / U+0085 / U+FEFF |
| 并行跑负控制 | 同时改同一批文件，互相污染基线 | 串行 |
| 本机 `grep` 是 ugrep | `(…)?` 套交替时静默漏匹配 | 写钩子或门的正则时用顶层交替，并与 `/usr/bin/grep` 对比 |
| 构建者的 worktree 从 origin/main 切出，不是从集成分支 | 集成分支合进了 origin/main 之后 origin/main 又前进（第 2 期 #179 / #180 落在切出之后、派发之前），worktree 基线就不是集成分支的祖先，`merge --ff-only <集成分支>` 失败（照第 2 步派发前先合 main 时它会成功，但时序不可靠）；落错基线时评审包 diff 里出现假删除 | 简报让它 `checkout -B <构建者分支> <集成分支>` 并报告实测 HEAD 与 merge-base；打包一律 `git merge-base` 实测 |
| 报告、脚本、patch 放草稿区 | 会话重启时草稿区清空，第 2 期丢过构建者报告、终审报告、集成脚本 | 一律放 `$W/.superpowers/python-waves/<名>/`，第 7 步整体拷走 |
| 负控制做了可能不终止的变异（删 `visited.add` 之类） | 门挂住而不是变红；第 2 期一次跑满 600 秒、swap 约 21 GB、同机会话一起 ENOSPC | 只做保证终止的变异；子进程用 Python `subprocess.Popen(…, start_new_session=True)` + `communicate(timeout=…)`，超时或被打断时（`except BaseException`；SIGTERM 先用 `signal.signal` 转成异常）`os.killpg(p.pid, signal.SIGKILL)` 杀整个进程组（本机没有 `timeout` 命令，写了只会 rc=127） |
| 集成后删构建者分支用 `git branch -d` | 主工作区的 `main` 不 pull，`-d` 按它判「未合并」而拒删 | 先 `merge-base --is-ancestor <分支> origin/main` 确认，再 `-D` |
| 在不带引号的 heredoc 里写含反引号的 PR 文案 | 反引号被当命令替换执行，文案被吃掉 | heredoc 一律 `<<'EOF'`，路径走环境变量 |
| 命令后接 `\| tail` / `\| head` 再 `echo rc=$?` | 打印的是管道末端的退出码，崩溃显示 `rc=0` | 要看退出码就不接管道，或先存 `rc` |
| 评审员或实现者自己又派子代理 | 重复一个评审席位 | 简报里写明不许派子代理 |
| 用 Skill 工具加载本 skill 或 `python-drill-tool` | 读到的是主工作区（不 pull、停在旧提交）的版本；第 3 期 m5b 读到的是 #186 之前的版本。旧版里没有「重读」这一条，所以写在本 skill 里的提醒到不了用 Skill 工具的读者 | 给控制方的派发简报第一句写「开完集成 worktree 后用 Read 读 `$W/.claude/skills/`，不用 Skill 工具」；第 0 步照做；简报让子代理用 Read 读自己 worktree 里的文件 |
| 构建者把报告写进集成 worktree | isolation worktree 拒写主工作区目录树里、它自己 worktree 以外的路径——集成 worktree 在 `$M/.claude/worktrees/` 下（第 3 期 4 个里 3 个被拒、1 个写成，不稳定） | 报告写构建者自己 worktree 的 `.superpowers/`，写不进就写 scratchpad、回复里给实际路径；控制方第 3 步集成前拷进台账 |
| 在 worktree 里跑 `git add` / `git rm` 组合、或 `rm -rf` 一个目录（`.superpowers/` 下、草稿区里都遇到过） | 被权限拒，且同一个动作这一次拒、下一次放行（第 4 期 m6a 控制方删掉了评审的临时子目录，m6b 四方全被拒）；留在集成 worktree 里的东西会让 worktree 删不掉——删它等于绕过拒绝 | 子代理的临时文件放草稿区、不必删、不试着删、不换命令绕；`.gitignore` 类负控制在草稿区的临时仓库里做 |
| fixture 的文件名撞上根 `.gitignore` 的规则（`*.log` 之类） | `git add` 静默跳过它，本地门全绿、CI 缺文件；门读磁盘看不见 | 根 `.gitignore` 已有反向规则 `!python/programs/*/_fixtures/**`；提交前 `git ls-files` 对一遍磁盘上的 `_fixtures/` |

## 红旗——停下来重看本 skill

- 打算每页开一个 PR，或每页做一轮评审
- 打算用 `file://` 打开页面，或预览没先确认 worktree 标记
- 打算在主工作区里 `git checkout` 任何东西
- 注册表或 FALLBACK 冲突打算手工改（唯一例外：配方脚本退出码 3，见第 3 步）
- 简报里写「注册表由控制方登记」「不要碰 python-tools.json」
- 没等用户说合并就 `gh pr merge`
- 删集成 worktree 之前没把台账拷到主工作区 `.superpowers/python-phase<期>/`
- 简报里写着 `merge --ff-only <集成分支>`，或构建者的报告路径指向集成 worktree（应指它自己的 worktree）
- 照 Skill 工具加载出来的版本派发，没有先用 Read 从 `$W/.claude/skills/` 重读；或给控制方的派发简报第一句没写这一条
- 负控制变异后门绿，就断定「门瞎了」而没先问变异是不是等价
- 打算跑一个删掉 `visited.add` / 循环更新的负控制，或写 `timeout 120 …`
- 探针报「0 处泄漏」而没报检查了几次；或用的不是 skill 里的 `probe.js`，或它返回了 `VOID` 还照样记结论
- 让子代理把临时文件、导出副本放进集成 worktree（`.superpowers/` 也算）
- 派构建者时简报里没有本波共有约定表（tag、英文里指别的程序的写法）；或把「英文里指别的页怎么写」又当成每波自己定的一项
