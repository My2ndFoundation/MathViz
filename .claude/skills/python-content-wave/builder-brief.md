# 构建者简报模板

控制方填好每个 `{{…}}` 槽（**REQUIRED** 的一个都不能空），把整段作为子代理的 prompt。
派发参数：`isolation: "worktree"`，`model: "opus"`，同一波的构建者在同一条消息里并行派出。

---

你在为 MathViz 仓库的 `python/` 子项目构建一个练习页：**{{REQUIRED 页 id，如 py-strings}}**（模块 {{REQUIRED 模块号}}，章目录 `python/programs/{{REQUIRED chNN-slug}}/`）。
使用者是一名在读 A-level Computer Science 的学生，靠「读 / 挖空 / 影子临摹」把 Python 练成肌肉记忆；挖空按 token 严格判定。

## 先读（它们就是你的要求）

1. `.claude/skills/python-drill-tool/SKILL.md` —— 全部写作规则、每道门守什么、新增一页的作业 A。**照作业 A 做。**
2. {{REQUIRED 清单出处，如 docs/superpowers/specs/2026-09-16-python-phase1-design.md §7.1}} —— 本页程序清单（id / 变体组 / 教什么 / P 参照）。清单审过了：**不增、不删、不换**；觉得某个程序不够经典或有更好的替换，写进报告，不擅自改。
3. {{REQUIRED 内容标准出处，如同一文件 §6}} —— 内容标准与页面边界。

**全库已用的 `problem` 名**（`variant_check` 按全库分组：单例程序的 `problem` 名若与下列重名，会被误并成跨页变体组，门不会红）：
{{REQUIRED 控制方从 `python/programs/*/chapter.json` 现取的 problem 名清单}}

## 工作区与基线

- 你在自己的 worktree 里工作。**第一步**：`git merge --ff-only {{REQUIRED 集成分支名，如 claude/python-wave-m1}}`，然后把 `git rev-parse HEAD` 与 `git merge-base HEAD origin/main` 两个值写进报告第一行。
  预期基线是 {{REQUIRED 基线 SHA}}；不是就停下报告。
- 在 worktree 里 `git checkout -b {{REQUIRED 构建者分支名，如 claude/python-wave-m1-py-strings}}`，所有提交落在这条分支上。
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
- 写文件时不要写反斜杠-u 形式的转义：写文件工具会把它解码成真实字符（U+2028 之类不可见字符会让页面解析器崩溃）。需要这类字符时用 `chr()` 构造；写完扫一遍 U+2028 / U+2029 / U+0085 / U+FEFF。
- 不推送、不开 PR、不合并、不改 git 配置、不 checkout 主工作区（`/Users/nickma/Develop/My2ndBrain/MathViz`）。
- **页面不显示程序输出**：挖空行里的字面量文字若只能从输出得知，就在最后一级提示里给出；提示里不写「和输出一样」。
- 读 `_fixtures/` 的程序：复制出去不带数据文件，讲解末段写明文件位置与内容（见 `python-drill-tool`）。
- 你自己不派子代理（不派帮手，更不派评审）。评审由控制方安排。

## 报告

写到 `{{REQUIRED 报告文件绝对路径}}`，然后只回复：状态（DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT）、提交（短 SHA + 标题）、一行测试结论、顾虑、报告路径。

报告必须包含：
1. 第一行：实测 `HEAD` 与 `merge-base`。
2. 每个程序：挖了哪几行、level、为什么这一行写法唯一（或第 1 级提示钉住了哪一点）；你用判定器试过的等价写法及结果。
3. 每个 `run.expect` 的生成命令（照 `python-drill-tool`「生成 `run.expect`」一节）。
4. 每个 P 程序：你实际跑过的一个变异，门在哪组实参上变红（贴红行）。
5. 拿不准的 `boards`。
6. 注册表条目已由你加入的确认，以及 `desc` / `tag` / `changelog` 草稿原文。
7. 与清单或规则的全部偏离及理由；简报里写错的地方。
8. `check.py` 末行。
