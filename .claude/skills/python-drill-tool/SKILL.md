---
name: python-drill-tool
description: >-
  Add, extend or upgrade a Python practice page in the `python/` subproject of MathViz — a
  single-file page where a student reads worked programs, fills in blanks and shadow-traces them.
  Use this skill WHENEVER the developer wants to add a new `python/tools/py-*.html` page, add or
  change programs under `python/programs/ch*/`, write BLANK directives or hints, add a property
  check, or bump a python tool's version — even if they only say "加一页 Python 练习",
  "add programs for loops", "给 py-strings 加个程序" or "升级 py-basics". Do NOT use it for
  engine work in `python/core/*.js`, for the maths tools in `outputs/` (math-viz-tool), for
  `cryptography/` (crypto-viz-tool), or for `chess/`.
---

# Python 练习页 · 作者须知

`python/` 是 MathViz 的第三个子项目：**没有 canvas，没有运行时**。页面展示程序、挖掉几行让人填、
垫一层影子让人逐字临摹；浏览器里不执行 Python。程序是真的 `.py` 文件，**CPython 在构建期替你验**。

规格：`docs/superpowers/specs/2026-09-16-python-subproject-design.md`（主规格）、
`docs/superpowers/specs/2026-09-16-python-phase1-design.md`（第 1 期）。

## 你碰什么、不碰什么

| 你写 | 生成，**不要手改**（但重新生成的结果**要一起提交**） |
|---|---|
| `python/programs/chNN-<slug>/chapter.json` 与其中点名的 `.py` | `tools/*.html` 里的全部 `GENERATED:*` 区段 |
| `python/programs/chNN-<slug>/_fixtures/`（程序要读的数据文件） | `python/app.html` / `index.html` 的 `GENERATED:FALLBACK` |
| `python/scripts/gates/refs/chNN_<slug>.py`（property 参照） | `python-tools.json` 的 `programs` / `lines` |
| 新工具页：从 `tools/_skeleton.html` 复制后改那 6 处 | |
| 新工具页的注册表条目：自己追加进 `python/python-tools.json`（`desc` / `tag` / `changelog` 可以是草稿，控制方集成时审改） | |

生成脚本：`inline_core.py`（core → 页面）、`build_programs.py`（程序 → 页面 + 注册表计数）、
`sync_fallback.py`（注册表 → 两个导航页）。钩子（`core.hooksPath` 是指向主工作区 `.githooks` 的绝对路径）
在提交涉及 `python/` 时，会在**提交所在的 worktree** 上把三个生成脚本都跑一遍并代为暂存——但钩子脚本本身是主工作区当前分支那一份，可能是旧的，
所以提交前自己跑三个生成脚本与 `check.py`，提交后读 `git status --short` 的每一行。

为什么注册表条目由你自己加（第 1 期地基终审改；原先写的是「写进报告、由中央登记」，工具链上跑不通）：
`build_programs.py` 在工具页没有注册表条目时**硬错误退出**（`python-tools.json 里没有 id='py-…' 的条目，
无法回写 programs/lines`），`page_mirror_check` / `registry_check` 也要求条目存在——不先加条目，你一道门都跑不绿。

`lines`（选择器「不超过 20/40/80 行」筛的就是它，面板顶部也显示它）是源码按 `\n` 切、**去掉 BLANK 指令行**、
**不含文件末尾换行产生的那个空尾巴**之后的行数（Task 11c）——这是读模式/临摹模式里她真正看到的程序的长度，
挖多一个空不会让它变长。读模式的行号栏会因为文件末尾的换行多显示一个空行号，`lines` 不数它。

只要碰 `python/core/*.js`：`lineNotes` 这个词（剥掉注释之后）在 `core/` 里只放行三种位置——
① `panelLineNotes` / `noteLineIndex` **这两个函数的函数体内**（白名单读取点，体内出现几次都行）；
② STR 键表里 `lineNotes: { zh:…` 那**一行**声明；③ `t('lineNotes', …)` 这个独立调用。
落在这三种位置之外的任何一处都会被 `line_note_reader_check`（B 组）拦下。

## 硬规矩与守门

| 规矩 | 守门 | 门报红时说什么 |
|---|---|---|
| 程序能跑，stdout 逐字节等于 `run.expect` | `program_run_check` | `stdout 与 run.expect 不符`，附期望与实际 |
| 每个程序至少 1 个空 | `blank_presence_check` | `一个挖空都没有` |
| BLANK 成对；`id` / `level` / `hint` / `hintEn` 齐全；`level ∈ 1..3`；挖空体非空；`id` 在程序内唯一 | `blank_directive_check` | `缺 hintEn=`、`level=… 必须是 1、2 或 3` 等 |
| `hint` 与 `hintEn` 按 ` \|\| ` 切出的段数**都等于** `level` | `blank_directive_check` | `切出 N 段，但 level=M` |
| `\|\|` 必须写成两侧各一个空格的 ` \|\| `；标记落在整条提示的最前或最后，或两侧空白不止一个，同样算写错 | `blank_directive_check` | `疑似写错的分级标记` |
| 源码纯 ASCII（BLANK 指令行的 `hint=` 除外） | `source_ascii_check` | 点名行号与字符 |
| 整份 `.py` 不许出现非 BMP 字符（含提示里的 emoji） | `source_bmp_check` | 点名码位 |
| 4 空格缩进、无 Tab、行尾无空白、文件以单个换行结尾 | `source_indent_check` | 点名行号 |
| 无 BOM、无 CRLF、无杂散 C0 控制字节（`.py` / `chapter.json`、`core/`、`tools/`、两个导航页、注册表）——`source_indent_check` 读文件走通用换行，**看不见 CRLF**，这一条归它 | `control_byte_check`（B 组） | `以 UTF-8 BOM 开头` / `含 CR（CRLF 行尾）` / `含 C0 控制字符` |
| `.py` 里不许出现 U+2028 / U+2029 / U+0085（Python 与页面的 JS 对它们是不是换行意见不一）；页面自己的 `Exercise.parse` / `clean` 吃得下每个程序，挖空 id 与门的解析一致，`clean()` 行数与 `lines` 一致 | `js_parser_parity_check`（C 组） | `有 U+2028 …` / `Exercise.parse() 抛错` / `挖空 id 两边解析得不一样` / `嵌入页面的 lines=…` |
| `lineNotes.at` / `chunks.from/to` 是**整行原文**、存在且唯一、`clean()` 之后仍唯一 | `anchor_check` | `找不到` / `出现 N 次` / `在 clean() 后消失了` |
| `kind` / `level` / `boards` / `runtime` 在闭集；`title` `blurb` 双语；`notes` 是段落数组；`problem` `entry` 非空；不手写 `lines` / `source` | `program_meta_check` | 点名字段 |
| `requires` 是白名单 `numpy` / `pandas` / `matplotlib` / `scipy` / `pygame` 的子集（可以是空数组） | `program_meta_check` | `requires=… 必须是 … 的子集` |
| `"tier": "compile-only"`（普通 cpython 程序的例外豁免）必须带非空 `why`，每页至多 2 个 | `exemption_check` | `没有非空的 why` / `有 N 条例外豁免，上限是 2` |
| 带 `check.property` 的程序在 `gates/refs/` 里**同章文件**有参照 | `algorithm_property_check` | `没有它的参考实现` / `参照却登记在` |
| 参照与被测函数对 200 组随机实参给出同值同类型 | `algorithm_property_check` | `与参考实现不符`，附反例实参 |
| 同一 `problem` 的变体标题互不相同 | `variant_check` | 点名组 |
| `chapter.json` 与目录里的 `.py` 双向一致 | `chapter_manifest_check` | 点名文件 |
| 工具页 `TOOL.id` / `accent` / `title` 与 `tool-engine` 等于注册表 | `page_mirror_check` | `TOOL.<字段> 与注册表不同` |
| accent 按模块配色表（M1 cyan · M2 violet · M3 emerald · M4 rose · M5 orange · M6 cyan · M7 violet · M8 emerald） | `accent_module_check` | `accent 应为 …` |
| 注册表 `version` == 页面 `tool-version` meta | `version_meta_check` | 点名两个值 |

**靠人（没有门，评审逐条核）：**
- **只挖写法唯一的行。** 判定严格比较引号风格、数字写法与相对缩进。一行若有同样好的另一种写法，
  使用者写出更好的答案会被判错——要么别挖，要么让提示把形式钉死。**这类「只是在两种同样好的写法
  之间选一种」的钉法放第 1 级提示**（她还没点开提示就写出另一种好写法时不该意外发现自己错了）；
  只有当写出这个钉法本身就等于把整行答案念出来时，才把它挪到最后一级。
- **提示逐级更具体，任何一级都不许给出答案原文。**
- 被挖的行里若有学生无从推断的文字（`input()` 的提示语、任意取的格式宽度），提示必须给出它，否则别挖。
- **挖空错误反馈从不打印字符串/f-string 字面量的原文**（Task 11b）：期待的 token 是一个字符串或
  f-string 时，她只会看到它的类别（一个字符串 / 一个 f-string）与自己写的原文从第几个字符起开始
  不同（1 起），或者「这里该有一个字符串/f-string」——绝不把标准答案的字面量文本印出来。对作者的
  推论：挖一行里带字面量是可以的，但如果那段字面量的准确文字**推不出来**（不是程序里写死的、notes
  里也没交代），就必须在某一级提示里把它给出来（或者只钉死那段推不出来的部分，其余留给她写）。
  **页面不显示程序的输出**（`run.expect` 只给门用），所以「看输出第几行就知道」不算推得出来，提示里也别写
  「和打印出来的一样」。第 1 期波 1 终审抓到 6 个这样的空（说明文字、文档串、`, studies at `），修法是最后一级给出那段文字。
- `notes` / `blurb` 在三种模式都显示，不许逐字写出挖空答案；`lineNotes` 只在读模式显示，挂在被挖那行上没关系。
  也别让**未挖的字符串**（表头、标题）改个大小写就是答案（波 2 de-morgan）。
- 讲解里指别的程序**写标题**，不写「下一个 / 上一个 / 本页最后一个程序」——页面可以筛选，顺序不可靠；
  也不写「捕获到的输出」「看输出第几行」——她看不到输出。
  **notes 里也别举一个这道程序的挖空判定会判错的写法**当例子——「两种写法都对」的note配一个判定
  只认一种的题，是把她往错的方向带（review 在 ch01 抓到过这个）。
- 右侧的说明面板在三种模式下都显示这个程序的 level / kind / lines / 挖空数 / boards / tags（非
  cpython 的 runtime 也显示）——**boards 必须写准**，她看到的就是这一份。
- 中英文对等。`boards` 只有**确知**某考纲不含时才去掉；拿不准就上报，不猜。
- 一个知识点只在一页**讲**（页面边界见第 1 期设计 §6.5）；做过的问题不跨页重复。
- 输出确定：**不用 `random`、不读时间**；写文件只写当前目录；数据文件放 `_fixtures/`，要输入就用 `run.stdin`。
  打印异常时只打印自己写的话或 `type(e).__name__`——内置异常的消息措辞随 Python 小版本变（`UnboundLocalError`
  在 3.9.6 与 3.12.9 上实测不同；`int()` 的 `ValueError` 在 3.9–3.12 恰好相同，别据此推广），学生本机不一定是 CI 的 3.12。
- 复制按钮只复制 `.py`，**不带 `_fixtures/`**：学生粘进 PyCharm 时没有数据文件。读 fixture 的程序在讲解末段写明
  文件放在哪（`_fixtures/<名>`）与逐行内容；这份手抄目前没有门守一致，改 fixture 时一起改。
- 整个程序约 10–40 行（不含 BLANK 指令行；是取向，不是门）。
- 一般 2–3 个空（门只要求至少 1 个），**挖整行**。
- 本期**不用 `chunks`**。
- **每页至少一个变体组**（同一 `problem` 两个以上写法）——`variant_check` 只要求**全库**至少一个，管不到每页。

## 一个程序长什么样

`.py`（注释英文；指令行从第 0 列开始）：

```python
"""Keep a number inside a range."""


def clamp(value, low, high):
    if value < low:
        return low
# >>> BLANK id=upper level=2 hint="和上面判下界的那两行写成对称的样子：同样是一个 if、下一行单独一个 return（不用 elif）；value 写在比较号左边，用严格的大于号 || value 超过上界 high 时，交回去的就是 high 本身" hintEn="Write it as the mirror image of the two lower-bound lines above: again an if with its own return on the next line (not elif); value on the left of the comparison, with a strict greater-than || When value is past the upper bound high, what comes back is high itself"
    if value > high:
        return high
# <<< BLANK
    return value


if __name__ == "__main__":
    print(clamp(5, 0, 10))
    print(clamp(-3, 0, 10))
    print(clamp(42, 0, 10))
```

（提示里的「；」和「; 」只是标点——分级只认 ` || `。）

这一空有好几种**同样对**的写法，判定只认一种，所以第 1 级就把选择钉死，而且不说出整行：

| 她可能写的 | 判定 | 第 1 级里钉住它的话 |
|---|---|---|
| `elif value > high:` | 错 | 不用 elif / not elif |
| `if high < value:` | 错 | value 写在比较号左边 / value on the left of the comparison |
| `if value >= high:` | 错 | 用严格的大于号 / with a strict greater-than |
| `return min(value, high)` | 错 | 同样是一个 if、下一行单独一个 return / again an if with its own return on the next line |

写示例时先把这张表列出来、逐条拿 `PyInteract.blankFeedback(写法, 标准答案)` 跑一遍：判错的每一条，
第 1 级提示里都得有一句话钉住它；钉不住又不想念出整行，就换一行挖。**判对的就不用钉**——比如
`if value > high: return high` 写成一行，判定认它与两行写法相同，提示里再去禁止它只会误导。

`chapter.json` 里对应的一条：

```json
{
  "id": "clamp-to-range",
  "file": "clamp-to-range.py",
  "problem": "clamp",
  "kind": "pattern",
  "level": 2,
  "boards": ["AQA", "OCR", "Edexcel", "CIE"],
  "tags": ["if", "return"],
  "requires": [],
  "runtime": "cpython",
  "entry": "clamp",
  "title": { "en": "Clamp to a Range", "zh": "夹进区间" },
  "blurb": { "en": "…", "zh": "…" },
  "notes": { "en": ["段落一", "段落二"], "zh": ["…", "…"] },
  "lineNotes": [ { "at": "    return value", "en": "…", "zh": "…" } ],
  "run": { "stdin": "", "expect": "5\n0\n10\n", "timeout": 5 },
  "check": { "property": "pure" }
}
```

`gates/refs/chNN_<slug>.py` 里对应的参照：

```python
from ._gen import rand_triples


def _value_low_high(rng):
    value, a, b = rand_triples(rng)
    return value, min(a, b), max(a, b)


REFERENCES = {
    'clamp-to-range': {
        # 被测的是「两个 if 各自提前 return」，参照取三个数排序后的中间那个：机制不同。
        'ref': lambda value, low, high: sorted((low, value, high))[1],
        'cases': _value_low_high,
    },
}
```

（这个问题不在第 1 期设计 §7 的清单里，也不在 ch01 里——照抄它当某一页的程序之前先对一遍 §6.5。）

## 生成 `run.expect`：粘贴真实输出，不要想

门在一个全新临时目录里跑：`_fixtures/` 拷成 `<临时目录>/_fixtures/`、`PYTHONHASHSEED=0`、
`PYTHONIOENCODING=utf-8`、`MPLBACKEND=Agg`、喂 `run.stdin`、超时 `run.timeout` 秒（缺省 5）。
照同样的条件生成，**用 Python 3.12**（CI 钉的版本；别的版本的 `repr` / 报错文字可能不同）。
第一个自变量是程序路径，第二个是超时秒数（与 `run.timeout` 相同，不给就是 5）：

```bash
python3 - python/programs/chNN-slug/prog-id.py 5 <<'EOF'
import json, os, pathlib, shutil, subprocess, sys, tempfile
prog = pathlib.Path(sys.argv[1]).resolve()
timeout = float(sys.argv[2]) if len(sys.argv) > 2 else 5
stdin = ''                                                  # 与 run.stdin 相同（改这里）
print('python', sys.version.split()[0])                     # 应是 3.12.x
with tempfile.TemporaryDirectory() as td:
    shutil.copyfile(prog, os.path.join(td, prog.name))
    fx = prog.parent / '_fixtures'
    if fx.is_dir():
        shutil.copytree(fx, os.path.join(td, '_fixtures'))
    env = dict(os.environ, PYTHONHASHSEED='0', PYTHONIOENCODING='utf-8', MPLBACKEND='Agg')
    r = subprocess.run([sys.executable, prog.name], cwd=td, env=env, input=stdin,
                       capture_output=True, text=True, timeout=timeout)
print('returncode', r.returncode)
print(json.dumps(r.stdout, ensure_ascii=False))   # 这一行原样粘进 "expect"
EOF
```

程序里读数据文件时写相对路径 `_fixtures/scores.csv`。

## property 检查

- 只在参照来得自然的地方加（纯函数、返回值可比），不强求。
- **参照的机制必须与被测程序不同。** 不能拿 `max` 当 `return max(a, b, c)` 的参照——那是拿自己验自己，被测程序错的地方参照会跟着错。
- **清单里写好的参照也要自己核对机制。** 标准库函数不等于「机制不同」：第 1 期波 2 的 `calendar.isleap` 在 3.12 的源码
  与被测的一表达式闰年**逐字相同**（`inspect.getsource` 一看便知），终审改成 400 年周期余数集合。参照与被测同源就上报。
- 比较是严格的：值相等**且类型相同**。
- 慢的程序（朴素递归）在 `cases` 里收紧实参范围，并写一句为什么。
- **`cases` 必须真的走到被测函数的每一个返回分支。** 随机生成器抽不到的分支，property 门对它就是瞎的：
  波 2 的三角形生成器从不产生正边长的等边三角形，把 `"equilateral"` 改成 `"isosceles"` 门仍全绿。
  做法：每个 `return` 分支各做一次变异、确认门红（或统计一次种子下各分支命中数写进报告），抽不到的分支按一定概率专门构造。
- 注释里说明「它守得住什么变异」时，**举的变异必须先真跑一遍、看到门红**。`gates/properties.py` 文件头的 ⚠ 段记着一次反例：解释里举的两个变异，门一个都测不出来。

## 三种作业

**A. 新增一页**（命令都在仓库根目录跑）
1. `cp python/tools/_skeleton.html python/tools/py-<name>.html`，改文件开头注释列出的 6 处（description meta、tool-version、`<title>`、版本记录、`GENERATED:PROGRAMS none` 去掉 `none`、`TOOL` 块）。`TOOL.accent` 查上面的配色表；`TOOL.title` 必须与下面第 4 步注册表条目的 `title` 逐字相同（`page_mirror_check`）。
2. 建 `python/programs/chNN-<slug>/`：`chapter.json`（顶层 `"module"` 与 `"tool": "py-<name>"`）+ `.py` + 需要时 `_fixtures/`。`run.expect` 照下面「生成 `run.expect`」一节粘贴真实输出。
3. 需要 property 时建 `gates/refs/chNN_<slug>.py`（章目录名的连字符换成下划线）。
4. **自己在 `python/python-tools.json` 的 `tools` 数组末尾追加本页条目**，字段顺序照已有条目：
   `id`（= `py-<name>`）/ `file`（`tools/py-<name>.html`）/ `accent` / `module` / `kicker` / `title` / `desc` / `tag`（后四个都是 `{"en": …, "zh": …}`）/
   `version` `"1.0.0"` / `engine`（与其他工具相同，= 页面 `tool-engine` meta）/ `programs` `0` / `lines` `0`（占位，第 5 步由脚本回写）/
   `changelog` `[{"version": "1.0.0", "date": "YYYY-MM-DD", "en": …, "zh": …}]`。`desc` / `tag` / `changelog` 写草稿即可。
5. `python3 python/scripts/build_programs.py && python3 python/scripts/inline_core.py && python3 python/scripts/sync_fallback.py && python3 python/scripts/check.py`
   ——`build_programs.py` 回写 `programs` / `lines` 并注入页面，`sync_fallback.py` 改写两个导航页的 FALLBACK。必须全绿。
6. **按显式路径一起提交**（绝不 `git add -A`）：`python/tools/py-<name>.html`、`python/programs/chNN-<slug>/`、
   （有的话）`python/scripts/gates/refs/chNN_<slug>.py`、`python/python-tools.json`、`python/app.html`、`python/index.html`。
   提交后读 `git status --short` 的每一行。

**B. 给已有页加程序**：第 2、3 步 + 第 5 步那一串命令；`build_programs.py` 回写注册表的 `programs` / `lines`
（FALLBACK 不含这两个字段，两个导航页不会变）。提交 `.py` / `chapter.json` / refs、`python/tools/py-<name>.html`、`python/python-tools.json`。

**堆叠分支之间的冲突**（多页并行时，`python-tools.json` 与两个导航页的 FALLBACK 必然冲突——都是数组末尾追加）：
**不手工合并。** 取基线分支（`main`，或你堆叠在其上的那个分支；下面记作 `main`）的版本、补回本页条目、重跑生成脚本：
```bash
git checkout main -- python/python-tools.json python/app.html python/index.html   # 合并冲突中照样可用，直接按 main 的内容解决
# 把本页那一条注册表条目重新追加到 tools 数组末尾（从自己分支的版本里拷：git show <你的分支>:python/python-tools.json）
python3 python/scripts/build_programs.py && python3 python/scripts/sync_fallback.py && python3 python/scripts/check.py
git add python/python-tools.json python/app.html python/index.html
```
工具页的 `GENERATED:PROGRAMS` 区段若也冲突，同理：取任一边，重跑 `build_programs.py`。

**C. 升级一页**：版本三处同步——注册表 `version` + `changelog`（最新的放最前）、页面 `tool-version` meta、页面头部版本记录注释（右上角徽章读 meta，不用改）。改了 `core/` 时 engine 升一次，**所有工具与 `_skeleton.html` 一起升**（`page_mirror_check` 要求全库唯一）。版本号是缓存键：不升，线上用户会一直看到旧页面。

## 上报与负控制

- **「我的做法与简报不一致、而我的做法更对」本身就是上报项。** 简报或测试里的断言事实上错了，停下上报，不要改测试迁就实现。
- 你新写或改动的检查，要**先把它守的东西改坏、看到它变红**才算数；从内存里的原字节复原，绝不 `git checkout`；先跑一次基线确认是绿的。
- **负控制一律串行跑，不要并行**——并行跑会互相污染对方临时改的共享文件，两边的「基线是绿的」这个前提都不再成立。
- 报告「红」时附上变红那一行，并说明是**断言失败**还是**脚本崩溃**——崩溃的红与有效的红长得一样。
