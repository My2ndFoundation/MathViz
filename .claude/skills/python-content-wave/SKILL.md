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

下面写的每一处取值都来自第 0–2 期真实付过的代价；照抄，不要凭记忆重推。

## 运行（按顺序；⏸ = 停下等用户）

**0. 开工准备**
- 开**集成 worktree**（`M=/Users/nickma/Develop/My2ndBrain/MathViz`，`W=$M/.claude/worktrees/python-wave-<名>`）：
  `git -C $M fetch origin && git -C $M worktree add -b claude/python-wave-<名> $W origin/main`。
  **主工作区（`/Users/nickma/Develop/My2ndBrain/MathViz`）从头到尾不 checkout、不 rebase、不 pull**——它属于用户和别的会话。
- 在集成 worktree 上跑全量验收（见「验收命令」），全绿才继续；把输出末行抄进台账。
- 台账目录：`$W/.superpowers/python-waves/<名>/`（gitignored）。`progress.md` 第一行写本波页面与基线 SHA，以后每一步、每一条裁决都追加进去。
  **本波一切要活过会话的东西都放这里**——构建者报告、终审 / 修复 / 复审报告、集成与验收脚本、中断实现者的 patch。**不放草稿区**：
  草稿区随会话重启清空，第 2 期三次重启丢过构建者报告、终审报告和 M3 的集成脚本，台账是因为放在这里才活下来的。
- `git -C $W count-objects -vH` 存进台账目录的 `git-size-before.txt`（`count` · `size` · `in-pack` · `size-pack` 四个字段，收尾账本要用）。
- 若本期规格里还写着「每页一个 PR」「每页两轮评审」，以本 skill 为准，并在本波 PR 里把规格那几句改掉（台账记一条裁决）。

**1. 程序清单**
- 有审过的清单（某期规格里逐页列好的表）→ 直接用，台账记下出处。
- 没有 → 起草：逐页列 `id | 变体组 | 教什么 | P 参照`，依据主规格 §2.2 的页清单、`python-drill-tool` 的内容标准与页面边界；
  查重：全库程序 id（`python/programs/*/chapter.json`）、已有页讲过的问题、同波相邻页的主题。写进本期规格。**⏸ 用户审完清单才派构建。**
- 起草时对**每个程序**问一句「它用不用递归」，用的标 ⟳、归进「用，不重讲」的裁决（第 2 期 M4 的 `merge-vs-insertion-counts` 用了递归而清单没标，构建者自己加了 tag）。
- `problem` 命名：不在变体组里的程序，`problem` 一律等于程序 id（id 全库唯一有门守）；变体组名由控制方对全库现有 `problem` 名**和**并行的另一个模块的组名交叉核一遍——
  `variant_check` 按全库分组，重名会被静默并成一个跨页变体组，门不会红（第 2 期两个模块并行，靠这条零撞组）。

**2. 派构建者**
- 每页一个子代理，**同一条消息里并行派出**，`isolation: "worktree"`，`model: opus`。
- 简报用 `builder-brief.md` 填，**每个 REQUIRED 槽都要填**；集成分支名、它的 HEAD 与 merge-base 填进去。
  构建者的 isolation worktree 是从 origin/main 切出来的，不是从集成分支：简报让它 `checkout -B <构建者分支> <集成分支>`（新 worktree 没有自己的提交，安全），
  **不要**写「`merge --ff-only <集成分支>`，不是就停下」——第 2 期两波十个构建者全部在这一步失败：M3 五人由控制方叫回来 `reset --hard`，M4 五人各自偏离简报、自行落到正确基线。
  派发前若 origin/main 已前进，先把它合进集成分支、跑一次 `check.py`，再把新的 HEAD 填进简报。
- 构建者回报 BLOCKED 后续做时，它的 agent worktree 可能已被自动清理；它会按简报在 `$M/.claude/worktrees/<名>-<页>` 自建一个。台账里记下每个自建目录，第 7 步一起清理。
- 构建者自己加注册表条目、连同重新生成的两个导航页一起提交（设计 §8.1）。

**3. 集成**（在集成 worktree 里，按模块内页序逐页）
- `git -C $W merge --no-ff <构建者分支>`。`python-tools.json`、`python/app.html`、`python/index.html`、工具页 `GENERATED:PROGRAMS` 冲突时**不手工合并**，跑配方脚本：
  ```bash
  python3 .claude/skills/python-content-wave/resolve-registry-conflict.py --repo $W --take HEAD --from MERGE_HEAD
  git -C $W commit --no-edit
  ```
  它做的就是配方的每一步：取集成分支版本 → 把构建者分支多出的注册表条目追加回 `tools` 末尾 → `build_programs.py`、`inline_core.py`、`sync_fallback.py`、`check.py`
  → 只 `git add` 显式路径；冲突落在这几类文件之外就什么都不动、退出码 2。脚本在收尾时拿两次真实合并回放过：M3 `b06736d`（集成 py-stack-queue）与
  M4 `3196e7e`（M4 合 main），暂存结果与当时手工按配方做出的提交**逐字节相同**；把 `--from` 指成不含本页条目的一侧，它在 `build_programs.py` 上红、不 `git add` 生成结果。
- 每合一页跑一次 `check.py`，全绿再合下一页。构建者报告里的偏离、简报错误、拿不准的 `boards` 抄进台账。

**4. 控制方亲验**（全部页集成之后、终审之前）
- 全量验收命令。
- 每页一个亲手负控制（先确认基线绿 → 变异 → 看门因断言失败而红、不是崩溃 → 从内存原字节复原 → 复绿），**串行**跑，**只做保证终止的变异**，
  子进程一律用 Python `subprocess.run(…, timeout=…)` 兜底（**本机没有 `timeout` 命令**——第 2 期两个会话都写过 `timeout 120`，一个验收循环因此全部 rc=127 却没停下）：
  页里有带 `check.property` 的程序 → 变异其中一个的被测函数，`algorithm_property_check` 应红；
  页里没有 → 改一个程序 `run.expect` 里的一个字符，`program_run_check` 应红。
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
- 修复实现者中途中断（会话重启、磁盘满）：先 `git -C $W diff > $W/.superpowers/python-waves/<名>/fix-partial.patch` 备份，再派新实现者，
  让它**先逐条判定**上一个人的改动「已完成 / 部分 / 未做」、写进报告，在上面续做，最后全量验证（第 2 期两波都这样接手，M4 的接手者据此查出前任半截的 refs 让门是红的）。

**6. PR**
- 推送前再合一次 origin/main（冲突照第 3 步，脚本用 `--take MERGE_HEAD --from HEAD`：以 main 为准、本波各页追加在后），全量验收重跑。
- 推送集成分支，`gh pr create`，描述用 `pr-body.md` 填（验证怎么做的就怎么写；PyCharm 那一项不打勾）。
- 读 CI：`gh pr checks <n> --watch`，再从日志里核对 `Successfully set up CPython (3.12.x)` 与 `N 道门全绿` 两行。红了读完整日志修，修复作为新提交。
- **⏸ 汇报 PR 链接、CI、负控制与裁决清单，等用户说合并。**

**7. 合并**
- 合并前：再读一次 `gh pr checks`；在 **PR head**（`gh pr view <n> --json headRefOid`，与你验过的 SHA 相同）上自己跑一遍全量验收，
  外加**一个自己挑的负控制**——不是 PR 作者做过的那几个（第 2 期集中合并的控制方对 #184、#185 各做了一次）。然后 `gh pr merge <n> --merge`。
- **两波并行、由一个控制方集中合并时**：先合的那个 PR 一落地，后一个就必然与 main 的注册表 / FALLBACK 冲突。通知后一波的控制方：合 origin/main、
  用配方脚本（`--take MERGE_HEAD --from HEAD`）解、全量验收、push；它回报新的 head 之后，照上一条核 head 与 CI 再合。
- 删集成 worktree 之前，把整个台账目录拷到主工作区的 `.superpowers/python-phase<期>/<名>-ledger/`（gitignored；worktree 一删台账就没了），
  再删集成 worktree、集成分支与各构建者分支（本地 + origin），以及第 2 步记下的构建者自建 worktree 和它们留下的 `worktree-agent-*` 分支。
- 复盘：构建者与评审员指出的简报错误 → 改本 skill 的模板或 `python-drill-tool`（单独一个小 PR）；
  再跑 `git -C $M count-objects -vH`（只读，整个仓库共用一个 `.git`，在主工作区跑安全）与开工前的记录对比，记进下一期账本。

## 验收命令

```bash
python3 python/scripts/check.py
python3 scripts/check_nav_contract.py
python3 scripts/sync_registry.py --check
python3 scripts/apply_branding.py --check
python3 scripts/apply_footer.py --check
python3 chess/scripts/check.py
python3 cryptography/scripts/check.py
python3 python/scripts/inline_core.py --check
python3 python/scripts/build_programs.py --check
python3 python/scripts/sync_fallback.py --check
for f in python/core/*.test.js; do node "$f"; done
```

## 浏览器验收

浏览器工具**不能操作 `file://` 页面**。用预览服务器 `mathviz`（`preview_start {name: "mathviz"}`，端口 8777）。8777 可能已被别的会话的同一台服务器占着，这时 `preview_start {name: …}` 会失败；
退路是 `preview_start {url: "http://localhost:8777/.claude/worktrees/python-wave-<名>/python/tools/py-<页>.html?lang=zh"}`——那台服务器的根也是主工作区，worktree 路径照样取得到（第 2 期两波都这样做）。
它的根目录是**主工作区**，所以直接开根路径测到的是别的分支的旧文件；本 worktree 在它下面：
`http://localhost:8777/.claude/worktrees/python-wave-<名>/python/tools/py-<页>.html?lang=zh`。

每个探针的第一步：
```js
(await fetch('/.claude/worktrees/python-wave-<名>/.superpowers/python-waves/<名>/progress.md')).ok === true
  && TOOL.id === 'py-<页>'
```
不成立就作废这次测量。每次调用都传显式 `tabId`。核对：中英 × 读 / 挖空 / 临摹；面板顶部元数据；每个程序挖空模式都有输入框；
字面量泄漏：每页挑含字符串的空打错一处，确认反馈不印出字面量原文。探针要**报出实际检查了几次**——0 次就是**没测**，不是通过
（第 2 期 M3 两页、M4 几乎全波没有带字面量的空）。0 次时改做：该页**全部空各改一个字符**、中英各跑一遍，确认 0 次判对、0 次印出标准答案行、0 条空消息，
另加一个合成字面量对照（例如 `x = "abcd"` 答成 `"abcQ"`，反馈只说第几个字符起不同、不印 `abcd`）；临摹三层在 `document.body.style.zoom` = 0.9 / 1 / 1.25 下对齐（量坐标，不凭截图说对齐）：往输入层打入影子的前几行，
用 `Range` 量**同一个字符**在 `.py-typed` 与 `.py-shadow` 里的矩形，dx = dy = 0；只比层外框宽度会得到假差异（`pre` 随内容收缩）。
负控制：给 `.py-typed` 加一点 `padding-left`，dx 必须变成非零。探针脚本放在集成 worktree 的 `.superpowers/`（预览服务器能取到），
每次导航后 `eval(await (await fetch(...)).text())` 重新注入；localStorage 复原后按**排序后的键**比较（键序会变）。
模式按钮文字带快捷键数字（「挖空 2」/「Fill in 2」），按 `startsWith` 找。不点同意横幅。改过的 localStorage 先记后还。

`file://` 双击验收与「复制粘进 PyCharm 真跑」只能由用户做——PR 里列为未勾选项，不代为声称。

## 已知的坑

| 情形 | 后果 | 做法 |
|---|---|---|
| 在主工作区 checkout / rebase / pull | 改掉用户或别的会话的分支与未提交工作 | 一切 git 操作在集成 worktree 里，`git -C $W` |
| `core.hooksPath` 是共享 git 配置里的绝对路径，指向主工作区的 `.githooks` | worktree 里提交跑的是主工作区当前分支那份钩子**脚本**（可能是旧的），但它操作的是提交所在 worktree 的文件 | 不依赖钩子代跑生成脚本；提交前自己跑三个生成脚本与 `check.py`，提交后读 `git status --short` |
| 写文件工具把反斜杠-u 转义解码成真实字符 | 不可见的 U+2028 进了源码或提示；`js_parser_parity_check` 会红，文档里则悄悄变假 | 代码里用 `chr(0x2028)`；写完扫一遍 U+2028 / U+2029 / U+0085 / U+FEFF |
| 并行跑负控制 | 同时改同一批文件，互相污染基线 | 串行 |
| 本机 `grep` 是 ugrep | `(…)?` 套交替时静默漏匹配 | 写钩子或门的正则时用顶层交替，并与 `/usr/bin/grep` 对比 |
| 构建者的 worktree 从 origin/main 切出，不是从集成分支 | `merge --ff-only <集成分支>` 必然失败；落错基线时评审包 diff 里出现假删除 | 简报让它 `checkout -B <构建者分支> <集成分支>` 并报告实测 HEAD 与 merge-base；打包一律 `git merge-base` 实测 |
| 报告、脚本、patch 放草稿区 | 会话重启时草稿区清空，第 2 期丢过构建者报告、终审报告、集成脚本 | 一律放 `$W/.superpowers/python-waves/<名>/`，第 7 步整体拷走 |
| 负控制做了可能不终止的变异（删 `visited.add` 之类） | 门挂住而不是变红；第 2 期一次跑满 600 秒、swap 约 21 GB、同机会话一起 ENOSPC | 只做保证终止的变异；子进程用 Python `subprocess.run(timeout=…)`（本机没有 `timeout` 命令，写了只会 rc=127） |
| 集成后删构建者分支用 `git branch -d` | 主工作区的 `main` 不 pull，`-d` 按它判「未合并」而拒删 | 先 `merge-base --is-ancestor <分支> origin/main` 确认，再 `-D` |
| 在不带引号的 heredoc 里写含反引号的 PR 文案 | 反引号被当命令替换执行，文案被吃掉 | heredoc 一律 `<<'EOF'`，路径走环境变量 |
| 命令后接 `\| tail` / `\| head` 再 `echo rc=$?` | 打印的是管道末端的退出码，崩溃显示 `rc=0` | 要看退出码就不接管道，或先存 `rc` |
| 评审员或实现者自己又派子代理 | 重复一个评审席位 | 简报里写明不许派子代理 |

## 红旗——停下来重看本 skill

- 打算每页开一个 PR，或每页做一轮评审
- 打算用 `file://` 打开页面，或预览没先确认 worktree 标记
- 打算在主工作区里 `git checkout` 任何东西
- 注册表或 FALLBACK 冲突打算手工改
- 简报里写「注册表由控制方登记」「不要碰 python-tools.json」
- 没等用户说合并就 `gh pr merge`
- 删集成 worktree 之前没把台账拷到主工作区 `.superpowers/python-phase<期>/`
- 简报里写着 `merge --ff-only <集成分支>`，或报告路径指向草稿区
- 打算跑一个删掉 `visited.add` / 循环更新的负控制，或写 `timeout 120 …`
- 探针报「0 处泄漏」而没报检查了几次
