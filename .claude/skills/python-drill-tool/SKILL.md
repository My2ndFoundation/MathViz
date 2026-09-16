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

| 你写 | 生成 / 中央登记，**不要手改** |
|---|---|
| `python/programs/chNN-<slug>/chapter.json` 与其中点名的 `.py` | `tools/*.html` 里的全部 `GENERATED:*` 区段 |
| `python/programs/chNN-<slug>/_fixtures/`（程序要读的数据文件） | `python/app.html` / `index.html` 的 `GENERATED:FALLBACK` |
| `python/scripts/gates/refs/chNN_<slug>.py`（property 参照） | `python-tools.json` 的 `programs` / `lines` |
| 新工具页：从 `tools/_skeleton.html` 复制后改那 6 处 | 注册表条目（写进报告，由中央登记） |

生成脚本：`inline_core.py`（core → 页面）、`build_programs.py`（程序 → 页面 + 注册表计数）、
`sync_fallback.py`（注册表 → 两个导航页）。钩子会代跑，但提交后要读 `git status --short` 的每一行。

`lines`（选择器「不超过 20/40/80 行」筛的就是它，面板顶部也显示它）是源码**去掉 BLANK 指令行**
之后的行数（Task 11c）——这是读模式/临摹模式里她真正看到的程序的长度，挖多一个空不会让它变长。

只要碰 `python/core/*.js`：`lineNotes` 这个词在 `core/` 里只能出现在四处——`panelLineNotes` /
`noteLineIndex` 这两个函数名、STR 键表里 `lineNotes: { zh:…` 那一行声明、以及 `t('lineNotes'` 的调用，
多一处会被 `line_note_reader_check`（B 组）拦下。

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
| 4 空格缩进、无 Tab、行尾无空白、LF | `source_indent_check` | 点名行号 |
| `lineNotes.at` / `chunks.from/to` 是**整行原文**、存在且唯一、`clean()` 之后仍唯一 | `anchor_check` | `找不到` / `出现 N 次` / `在 clean() 后消失了` |
| `kind` / `level` / `boards` / `runtime` 在闭集；`title` `blurb` 双语；`notes` 是段落数组；`problem` `entry` 非空；不手写 `lines` / `source` | `program_meta_check` | 点名字段 |
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
- `notes` / `blurb` 在三种模式都显示，不许逐字写出挖空答案；`lineNotes` 只在读模式显示，挂在被挖那行上没关系。
  **notes 里也别举一个这道程序的挖空判定会判错的写法**当例子——「两种写法都对」的note配一个判定
  只认一种的题，是把她往错的方向带（review 在 ch01 抓到过这个）。
- 右侧的说明面板在三种模式下都显示这个程序的 level / kind / lines / 挖空数 / boards / tags（非
  cpython 的 runtime 也显示）——**boards 必须写准**，她看到的就是这一份。
- 中英文对等。`boards` 只有**确知**某考纲不含时才去掉；拿不准就上报，不猜。
- 一个知识点只在一页**讲**（页面边界见第 1 期设计 §6.5）。

## 一个程序长什么样

`.py`（注释英文；指令行从第 0 列开始）：

```python
"""Count how many times a letter appears in a word."""


def count_letter(word, letter):
    count = 0
# >>> BLANK id=tally level=2 hint="逐个字符看一遍，和目标字母比较 || 相等时计数器加一；比较与加一各占一行" hintEn="Look at every character once and compare it with the letter || When they match, add one to the counter; the test and the addition get a line each"
    for ch in word:
        if ch == letter:
            count += 1
# <<< BLANK
    return count


if __name__ == "__main__":
    print(count_letter("banana", "a"))
    print(count_letter("rhythm", "e"))
```

（提示里的「；」和「; 」只是标点——分级只认 ` || `。）

`chapter.json` 里对应的一条：

```json
{
  "id": "count-letter-loop",
  "file": "count-letter-loop.py",
  "problem": "count-letter",
  "kind": "pattern",
  "level": 2,
  "boards": ["AQA", "OCR", "Edexcel", "CIE"],
  "tags": ["loop", "counting"],
  "requires": [],
  "runtime": "cpython",
  "entry": "count_letter",
  "title": { "en": "Count a Letter", "zh": "数一个字母" },
  "blurb": { "en": "…", "zh": "…" },
  "notes": { "en": ["段落一", "段落二"], "zh": ["…", "…"] },
  "lineNotes": [ { "at": "    count = 0", "en": "…", "zh": "…" } ],
  "run": { "stdin": "", "expect": "3\n0\n", "timeout": 5 },
  "check": { "property": "pure" }
}
```

`gates/refs/chNN_<slug>.py` 里对应的参照：

```python
from ._gen import rand_words

REFERENCES = {
    'count-letter-loop': {
        # 被测的是「循环 + 计数器」，参照用 str.count：机制不同。
        'ref': lambda word, letter: word.count(letter),
        'cases': lambda rng: (rand_words(rng)[0], rng.choice('aeiou')),
    },
}
```

## 生成 `run.expect`：粘贴真实输出，不要想

门在一个全新临时目录里跑：`_fixtures/` 拷成 `<临时目录>/_fixtures/`、`PYTHONHASHSEED=0`、
喂 `run.stdin`、超时 `run.timeout` 秒。照同样的条件生成：

```bash
python3 - <<'EOF'
import json, os, pathlib, shutil, subprocess, sys, tempfile
prog = pathlib.Path('python/programs/chNN-slug/prog-id.py').resolve()   # 改这里
stdin = ''                                                              # 与 run.stdin 相同
with tempfile.TemporaryDirectory() as td:
    shutil.copy(prog, td)
    fx = prog.parent / '_fixtures'
    if fx.is_dir():
        shutil.copytree(fx, os.path.join(td, '_fixtures'))
    env = dict(os.environ, PYTHONHASHSEED='0', PYTHONIOENCODING='utf-8')
    r = subprocess.run([sys.executable, prog.name], cwd=td, env=env, input=stdin,
                       capture_output=True, text=True, timeout=5)
print('returncode', r.returncode)
print(json.dumps(r.stdout, ensure_ascii=False))   # 这一行原样粘进 "expect"
EOF
```

程序里读数据文件时写相对路径 `_fixtures/scores.csv`。

## property 检查

- 只在参照来得自然的地方加（纯函数、返回值可比），不强求。
- **参照的机制必须与被测程序不同。** 不能拿 `max` 当 `return max(a, b, c)` 的参照——那是拿自己验自己，被测程序错的地方参照会跟着错。
- 比较是严格的：值相等**且类型相同**。
- 慢的程序（朴素递归）在 `cases` 里收紧实参范围，并写一句为什么。
- 注释里说明「它守得住什么变异」时，**举的变异必须先真跑一遍、看到门红**。`gates/properties.py` 文件头的 ⚠ 段记着一次反例：解释里举的两个变异，门一个都测不出来。

## 三种作业

**A. 新增一页**
1. `cp python/tools/_skeleton.html python/tools/py-<name>.html`，改文件开头注释列出的 6 处（description meta、tool-version、`<title>`、版本记录、`GENERATED:PROGRAMS none` 去掉 `none`、`TOOL` 块）。`TOOL.accent` 查上面的配色表。
2. 建 `python/programs/chNN-<slug>/`：`chapter.json`（顶层 `"module"` 与 `"tool": "py-<name>"`）+ `.py` + 需要时 `_fixtures/`。
3. 需要 property 时建 `gates/refs/chNN_<slug>.py`（章目录名的连字符换成下划线）。
4. 注册表条目（id / file / accent / module / kicker / title / desc / tag / version `1.0.0` / engine 与其他工具相同 / changelog）写进报告，由中央登记。
5. `python3 python/scripts/build_programs.py && python3 python/scripts/inline_core.py && python3 python/scripts/sync_fallback.py && python3 python/scripts/check.py`

**B. 给已有页加程序**：第 2、3 步 + 跑同一串命令；注册表的 `programs` / `lines` 由脚本回写。

**C. 升级一页**：版本三处同步——注册表 `version` + `changelog`（最新的放最前）、页面 `tool-version` meta、页面头部版本记录注释（右上角徽章读 meta，不用改）。改了 `core/` 时 engine 升一次，**所有工具与 `_skeleton.html` 一起升**（`page_mirror_check` 要求全库唯一）。版本号是缓存键：不升，线上用户会一直看到旧页面。

## 上报与负控制

- **「我的做法与简报不一致、而我的做法更对」本身就是上报项。** 简报或测试里的断言事实上错了，停下上报，不要改测试迁就实现。
- 你新写或改动的检查，要**先把它守的东西改坏、看到它变红**才算数；从内存里的原字节复原，绝不 `git checkout`；先跑一次基线确认是绿的。
- **负控制一律串行跑，不要并行**——并行跑会互相污染对方临时改的共享文件，两边的「基线是绿的」这个前提都不再成立。
- 报告「红」时附上变红那一行，并说明是**断言失败**还是**脚本崩溃**——崩溃的红与有效的红长得一样。
