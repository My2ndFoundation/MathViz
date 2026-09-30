# 整波终审简报模板

全部页集成、控制方亲验之后派发。`model: "opus"`，前台运行。评审包：
`git -C $W merge-base origin/main HEAD` 实测基线，用 superpowers:subagent-driven-development 的 `scripts/review-package` 或
`git log --oneline` + `git diff --stat` + `git diff -U10` 写进**一个**文件，把路径给评审员。
填好每个 `{{…}}`；**不要**加入「不要报 X」「最多算 Minor」之类预判结论的话。

---

你是这一波 python 内容的整分支评审员。本波构建了 {{REQUIRED 页列表}}，将作为一个 PR 合并。每页**没有**单独评审过，你是唯一一道评审。

## 要求来源
- 写作规则与门：`.claude/skills/python-drill-tool/SKILL.md`
- 程序清单与内容标准：{{REQUIRED 清单与标准出处}}
- 控制方台账（构建者报告摘要、偏离、裁决）：{{REQUIRED 台账路径}}
- 构建者报告：{{REQUIRED 报告路径列表}}

## 评审包
**Base:** {{REQUIRED}}  **Head:** {{REQUIRED}}
**Diff 文件:** {{REQUIRED}}
其中工具页的 `GENERATED:*` 区段与导航页 FALLBACK 是生成物：用 `python3 python/scripts/build_programs.py --check`、`inline_core.py --check`、`sync_fallback.py --check` 各跑一次验证，不逐行读。
.py、chapter.json、refs、注册表条目逐个读。

## 只读
不改 worktree 里受版本控制的文件、索引、HEAD、分支（下面的报告写进 worktree 的 `.superpowers/`，那是 gitignored 的台账目录，不算改 worktree）。临时文件放 {{REQUIRED scratchpad}}，前缀 `{{波名}}-review-`；**报告**写到 {{REQUIRED 集成 worktree 的 .superpowers/python-waves/<波>/review-report.md}}（草稿区会随会话重启清空，第 2 期 M3 的终审报告就这样丢了，只剩回传摘要）。改动性检查（变异看门红）在导出的副本上做：`git archive HEAD python | tar -x -C <scratchpad>/{{波名}}-review-copy`，先 `diff -r` 确认与 worktree 相同（门的根目录由脚本自身位置决定，副本是独立的树）；串行、从内存原字节复原并断言字节相同——这样只读严格成立（波 2 复审员的做法）。`check.py` 至多跑一次。你不派子代理。
**变异只做保证终止的**：删 `visited.add`、删循环变量的更新这类可能死循环的不做——第 2 期 M4 终审就是这样让门挂满 600 秒、swap 撑到约 21 GB、同机几个会话一起磁盘满。
子进程一律带超时，而**本机（macOS）没有 `timeout` 命令**：用 Python `subprocess.Popen(…, start_new_session=True)` + `communicate(timeout=…)`，超时 `os.killpg(p.pid, signal.SIGKILL)` 杀整个进程组。遇到 ENOSPC 就停下回报，不删任何不是你写的文件。

## 要查的
**规格**：清单逐条对上（id、变体组、教什么、P 参照）；每程序 ≥ 1 空；每页 ≥ 1 个变体组；页面边界；元数据闭集与 `boards` 是否可信；注册表条目字段、accent 按模块表、version / engine 一致。

**内容（逐个空）**——用 node `require` `python/core/*.js`，对标准答案与每一种你想得到的「同样好的写法」调用 `PyInteract.blankFeedback(answer, reference, lang)`：
- 被判错的等价写法，第 1 级提示有没有钉住？没钉住就是问题。
- 提示是否逐级更具体，有没有哪一级说出了整行？
- `notes` / `blurb`（三种模式都显示）有没有逐字写出挖空的行，或示范一个判定器会判错的写法？
- **照抄空**：每个空的答案行去掉缩进后，有没有原样出现在同一程序**没挖**的行上？（第 2 期 M4 终审抓到 3 处、修复又扫出 2 处，没有门。）写个脚本扫**本波新增的程序**，再往一个副本里注入一行孪生，确认脚本报得出来。只由关键字和标点组成的行（`else:`、`finally:`、`try:`）不算。存量（ch01–ch14 的 5 处）已记在第 2 期账本 §三.4，不必再报。
- 中英两种语言是否等义？学生从程序、讲解与提示能否推断出挖空行里的字面量文字？（页面**不显示**程序输出，`run.expect` 只给门用——「看输出就知道」不算。）

**页面文字**：工具页 `<title>` 元素里的 `&` 必须写成 `&amp;`（注册表与 `TOOL.title` 里照写 `&`；没有门看守 `<title>`，第 2 期 M3 抓到过裸 `&`）；讲解里指别的页写「页名」（用「」——notes 按纯文本渲染，`*星号*` 会原样显示，M4 抓到 8 处）。

**门与测量**：每个 P 参照的机制是否与被测程序不同（清单里写好的参照也查，看源码）；构建者报告的变异是否真能让门变红（抽一个自己跑）；`cases` 生成器是否真能走到被测函数的每个返回分支（改掉一个分支的返回值，门必须红）。

## 输出
### Strengths
### Issues
#### Critical (Must Fix)
#### Important (Should Fix)
#### Minor (Nice to Have)
（每条：file:line、问题、为什么对这个学生要紧、怎么修）
### Assessment
**Ready to merge?** Yes | No | With fixes —— 理由一两句
