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

下面写的每一处取值都来自第 0、1 期真实付过的代价；照抄，不要凭记忆重推。

## 运行（按顺序；⏸ = 停下等用户）

**0. 开工准备**
- 开**集成 worktree**（`M=/Users/nickma/Develop/My2ndBrain/MathViz`，`W=$M/.claude/worktrees/python-wave-<名>`）：
  `git -C $M fetch origin && git -C $M worktree add -b claude/python-wave-<名> $W origin/main`。
  **主工作区（`/Users/nickma/Develop/My2ndBrain/MathViz`）从头到尾不 checkout、不 rebase、不 pull**——它属于用户和别的会话。
- 在集成 worktree 上跑全量验收（见「验收命令」），全绿才继续；把输出末行抄进台账。
- `git -C $W count-objects -vH` 存进草稿区 `<名>-git-size-before.txt`。
- 若本期规格里还写着「每页一个 PR」「每页两轮评审」，以本 skill 为准，并在本波 PR 里把规格那几句改掉（台账记一条裁决）。
- 台账：`$W/.superpowers/python-waves/<名>/progress.md`（gitignored），第一行写本波页面与基线 SHA。以后每一步、每一条裁决都追加进去。

**1. 程序清单**
- 有审过的清单（某期规格里逐页列好的表）→ 直接用，台账记下出处。
- 没有 → 起草：逐页列 `id | 变体组 | 教什么 | P 参照`，依据主规格 §2.2 的页清单、`python-drill-tool` 的内容标准与页面边界；
  查重：全库程序 id（`python/programs/*/chapter.json`）、已有页讲过的问题、同波相邻页的主题。写进本期规格。**⏸ 用户审完清单才派构建。**

**2. 派构建者**
- 每页一个子代理，**同一条消息里并行派出**，`isolation: "worktree"`，`model: opus`。
- 简报用 `builder-brief.md` 填，**每个 REQUIRED 槽都要填**；集成分支名与基线 SHA 填进去。
- 构建者自己加注册表条目、连同重新生成的两个导航页一起提交（设计 §8.1）。

**3. 集成**（在集成 worktree 里，按模块内页序逐页）
- `git -C $W merge --no-ff <构建者分支>`。`python-tools.json`、`python/app.html`、`python/index.html`、工具页 `GENERATED:PROGRAMS` 冲突时**不手工合并**：
  取集成分支版本（`git -C $W checkout HEAD -- <这三个文件>`）→ 把本页注册表条目从构建者分支（`git show <分支>:python/python-tools.json`）追加回 `tools` 末尾 →
  `build_programs.py && inline_core.py && sync_fallback.py && check.py` → `git add` 显式路径 → 完成合并。
- 每合一页跑一次 `check.py`，全绿再合下一页。构建者报告里的偏离、简报错误、拿不准的 `boards` 抄进台账。

**4. 控制方亲验**（全部页集成之后、终审之前）
- 全量验收命令。
- 每页一个亲手负控制（先确认基线绿 → 变异 → 看门因断言失败而红、不是崩溃 → 从内存原字节复原 → 复绿），**串行**跑：
  页里有带 `check.property` 的程序 → 变异其中一个的被测函数，`algorithm_property_check` 应红；
  页里没有 → 改一个程序 `run.expect` 里的一个字符，`program_run_check` 应红。
- 浏览器：见「浏览器验收」。
- 复制内容真跑（`_fixtures/` 要像 `program_run_check` 一样整个 `copytree` 成临时目录里的 `_fixtures/`，平铺到根目录会全红——
  而且这项测量与门一样拷了 fixture，**观察不到**「粘进 PyCharm 缺数据文件」，那一项只能靠人）：每页用 `random.Random(<固定种子>).sample` 抽 3 个程序，取读 / 挖空（每空填标准答案）/ 临摹三种模式的复制内容，
  断言三者相同且不含 `# >>> BLANK`，在全新临时目录按 `run.expect` 的条件用 python3 跑，stdout 逐字节比对。

**5. 终审（整波一次）**
- `git -C $W merge-base origin/main HEAD` 实测基线，打包整波 diff，用 `final-review-brief.md` 派 opus 评审。不写「不要报 X」一类预判。
  评审必须逐个空查四件事：被判错的等价写法第 1 级提示有没有钉住；提示有没有哪一级说出整行；`notes` / `blurb` 有没有逐字写出挖空行或示范判定器会判错的写法；中英是否等义。
- 有发现：**一次**修复派发（全部发现一起给一个实现者）→ **一次**范围复审 → 残留问题带裁决记进台账。不做逐页评审循环。
  修复实现者直接在集成 worktree 里改（不另开 worktree）；它回报之前，控制方不在 `$W` 里做任何写操作。

**6. PR**
- 推送集成分支，`gh pr create`，描述用 `pr-body.md` 填（验证怎么做的就怎么写；PyCharm 那一项不打勾）。
- 读 CI：`gh pr checks <n> --watch`，再从日志里核对 `Successfully set up CPython (3.12.x)` 与 `N 道门全绿` 两行。红了读完整日志修，修复作为新提交。
- **⏸ 汇报 PR 链接、CI、负控制与裁决清单，等用户说合并。**

**7. 合并之后**
- 合并前再读一次 `gh pr checks`，`gh pr merge <n> --merge`。
- 台账先备份到草稿区（worktree 一删台账就没了），再删集成 worktree、集成分支与各构建者分支（本地 + origin）。
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

浏览器工具**不能操作 `file://` 页面**。用预览服务器 `mathviz`（`preview_start {name: "mathviz"}`，端口 8777）。
它的根目录是**主工作区**，所以直接开根路径测到的是别的分支的旧文件；本 worktree 在它下面：
`http://localhost:8777/.claude/worktrees/python-wave-<名>/python/tools/py-<页>.html?lang=zh`。

每个探针的第一步：
```js
(await fetch('/.claude/worktrees/python-wave-<名>/.superpowers/python-waves/<名>/progress.md')).ok === true
  && TOOL.id === 'py-<页>'
```
不成立就作废这次测量。每次调用都传显式 `tabId`。核对：中英 × 读 / 挖空 / 临摹；面板顶部元数据；每个程序挖空模式都有输入框；
每页挑一个空打错一处，确认反馈不印出字符串字面量；临摹三层在 `document.body.style.zoom` = 0.9 / 1 / 1.25 下对齐（量坐标，不凭截图说对齐）：往输入层打入影子的前几行，
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
| worktree 的基线不一定是派发时的 HEAD | 评审包 diff 里出现假删除 | 构建者第一步 `merge --ff-only` 并报告实测 merge-base；打包一律 `git merge-base` 实测 |
| 集成后删构建者分支用 `git branch -d` | 主工作区的 `main` 不 pull，`-d` 按它判「未合并」而拒删 | 先 `merge-base --is-ancestor <分支> origin/main` 确认，再 `-D` |
| 在不带引号的 heredoc 里写含反引号的 PR 文案 | 反引号被当命令替换执行，文案被吃掉 | heredoc 一律 `<<'EOF'`，路径走环境变量 |
| 评审员或实现者自己又派子代理 | 重复一个评审席位 | 简报里写明不许派子代理 |

## 红旗——停下来重看本 skill

- 打算每页开一个 PR，或每页做一轮评审
- 打算用 `file://` 打开页面，或预览没先确认 worktree 标记
- 打算在主工作区里 `git checkout` 任何东西
- 注册表或 FALLBACK 冲突打算手工改
- 简报里写「注册表由控制方登记」「不要碰 python-tools.json」
- 没等用户说合并就 `gh pr merge`
- 删集成 worktree 之前没备份台账
