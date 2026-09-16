# Python 第 1 期 · 地基（PR-A + PR-B）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在内容页开工前，把 python 子项目的镜像生成、镜像门、提示格式、挖空下限、元数据面板与作者须知落地，门数 34 → 39。

**Architecture:** PR-A 只动 `python/scripts/`、两个导航页与 CI，不碰 core 与内容；PR-B 在 PR-A 合并后的 main 上改 core（`interact.js` / `py-lex.js`）、门与 ch01 内容，并写作者须知。每道新门或改动过的门都在本任务内做负控制，用 `p1-negctl.py` 执行（基线 → 破坏 → 判定 → 从内存原字节复原）。

**Tech Stack:** Python 3.12 标准库（门与生成脚本）、Node（`vm` 裸 context、`core/*.test.js`）、零依赖单文件 HTML。

**Spec:** `docs/superpowers/specs/2026-09-16-python-phase1-design.md`（下称「设计」）。本计划只覆盖设计 §4、§5；两波内容页（§7–§9）在 PR-B 合并后另写计划。

## Global Constraints

- 单文件、零依赖、`file://` 可开；`python/` 整个目录可搬迁（全目录只有 `PARENT_HOME` 与 `../privacy.html` 两类出站引用）。
- **绝不手改 GENERATED 区段**：`core/*.js` → `inline_core.py`；`programs/ch*/` → `build_programs.py`；注册表 → `sync_fallback.py`（Task 2 起）。
- **提交只列显式路径，绝不 `git add -A` / `commit -a`**；钩子会重跑生成脚本并再暂存，提交后读 `git status --short` 的每一行。
- **所有命令用绝对路径或 `git -C`**。PR-A 的 worktree：`W=/Users/nickma/Develop/My2ndBrain/MathViz/.claude/worktrees/python-phase1`；PR-B 的 worktree：`W=/Users/nickma/Develop/My2ndBrain/MathViz/.claude/worktrees/python-phase1-rules`。
- 临时文件放 `S=/private/tmp/claude-501/-Users-nickma-Develop-My2ndBrain-MathViz/3e4bbe48-6820-4ea1-9cc2-e2cb4bd6aeae/scratchpad`，文件名前缀 `p1-`。
- 负控制一律**从内存原字节复原、带基线**，绝不 `git checkout`；报告「红」时附上变红那一行输出，并说明是断言失败还是脚本崩溃。
- 读写文件显式 `encoding='utf-8'`（R21）。`core/` 的 `.js` 里不许出现 `<` + `script` + `>` 字面序列（含注释）。
- `.py` 程序源码纯 ASCII（BLANK 指令行的 `hint=` 除外）、无非 BMP 字符、4 空格缩进、LF。
- 门与脚本的注释、报错用中文，沿用各文件现有口吻；每道门在「零条被检查」时必须红（「跑了个寂寞」），不许报绿。
- 散文与 docstring 里**不写门数**（Task 1）。
- **「我的做法与本计划不一致、而我的做法更对」本身就是上报项**（R28）。计划里的断言若事实上错了，停下上报，不要改测试去迁就实现。
- 每个 PR 开出后实际读 `gh pr checks`；**等用户在对话里说合并才合并**。

## File Structure

| 文件 | 任务 | 职责 |
|---|---|---|
| `python/scripts/check.py` | 1, 2, 4, 9, 10, 12 | 门运行器：`GATES` 带组标签，按组自数 |
| `python/scripts/sync_fallback.py`（新） | 2 | 注册表 → 两页 `GENERATED:FALLBACK` |
| `python/app.html` / `python/index.html` | 2 | FALLBACK 改为生成区段 |
| `python/scripts/gates/registry.py` | 2, 3, 4 | FALLBACK 两门改 JSON 比对；accent 表门；`page_mirror_check` |
| `python/scripts/gates/__init__.py` | 3 | `MODULE_ACCENTS` |
| `python/scripts/gates/properties.py` | 5 | 只留 `SAMPLES` / `SEED` 与汇总 |
| `python/scripts/gates/refs/__init__.py`（新） | 5 | 按章加载参照，绝不抛 |
| `python/scripts/gates/refs/_gen.py`（新） | 5 | 公共实参生成器 |
| `python/scripts/gates/refs/ch01_basics.py`（新） | 5 | ch01 的三条参照 |
| `python/scripts/gates/library.py` | 5, 7, 9, 12 | 参照归属检查；` \|\| ` 标记；锚点解禁；`blank_presence_check` |
| `python/scripts/gates/hygiene.py` | 9 | `line_note_reader_check` |
| `python/scripts/gates/syntax.py` | 10 | `closed_set_mirror_check` |
| `.githooks/pre-commit` | 2 | python 段触发条件 + `sync_fallback` |
| `.github/workflows/registry-sync.yml` | 6 | `setup-python` pin 3.12 |
| `python/core/interact.js` / `interact.test.js` | 7, 8, 10 | ` \|\| `；装饰器配色与类型核对；元数据面板 |
| `python/core/py-lex.js` | 8 | 导出 `TYPES` |
| `python/programs/ch01-basics/*` | 7, 11 | 提示迁移；补空 |
| `python/python-tools.json`、`python/tools/py-basics.html`、`python/tools/_skeleton.html` | 11 | py-basics 1.1.0、engine py-1.1.0 |
| `.claude/skills/python-drill-tool/SKILL.md`（新） | 13 | 作者须知 |
| `CLAUDE.md` | 2 | python 段：三个生成脚本、钩子触发条件 |

---

## Task 0: 负控制执行器 `p1-negctl.py`（scratchpad，不入库）

后面每个任务都用它。若会话更替后文件不在，照本任务重建。

**Files:**
- Create: `$S/p1-negctl.py`

- [ ] **Step 1: 写执行器**

```python
#!/usr/bin/env python3
"""第 1 期负控制执行器（放在 scratchpad，不入库）。

一次负控制 = 基线 + 破坏 + 判定 + 复原，四步缺一不可：
  1. 基线：什么都不改先跑一次门，必须绿——否则之后的「红」可能是它本来就红。
  2. 破坏：替换模式下逐对做字符串替换，断言每对命中次数恰为 --count、改后字节与改前不同；
     创建模式下新建一个原本不存在的文件。
  3. 判定：输出里必须出现 --must-say 的文本；期望红时还不许出现崩溃特征——
     Python 的 'Traceback (most recent call last)'、编译期的 'SyntaxError:' /
     'IndentationError:' / 'TabError:'，或 node 未捕获异常的调用栈行 '\n    at '
     ——否则红可能来自脚本崩溃而不是断言失败（「红得没有理由」）。
  4. 复原：把内存里的原字节写回（创建模式则删掉文件和它的 pyc），断言复原。绝不用 git checkout。

用法：
  替换：p1-negctl.py --root W --gate registry.fallback_check --file python/app.html \
          --old '"accent": "cyan"' --new '"accent": "violet"' [--count 1] \
          [--old ... --new ... --count ...] --expect red --must-say accent
  创建：p1-negctl.py --root W --gate library.algorithm_property_check \
          --create python/scripts/gates/refs/ch99_nothing.py --content 'REFERENCES = {}' \
          --expect red --must-say 章目录
  --gate 取 gates 包里的 <模块>.<函数>，或 cmd:<shell 命令>（在 --root 下执行）。
"""
import argparse
import pathlib
import subprocess
import sys

# 崩溃特征：出现任一条，红就不算断言失败，而是脚本自己坏了（「红得没有理由」）。
# Python 未捕获异常打 'Traceback (most recent call last)'；编译期错误
# （SyntaxError / IndentationError / TabError）不打 Traceback，只打
# 'File "...", line N' + '<XxxError>:' 那一段；node 未捕获异常打一段
# '\n    at ...' 调用栈，也没有 'Traceback' 字样。
CRASH_MARKERS = (
    'Traceback (most recent call last)',
    'SyntaxError:',
    'IndentationError:',
    'TabError:',
    '\n    at ',
)


def run_gate(root, gate):
    if gate.startswith('cmd:'):
        return subprocess.run(gate[4:], shell=True, cwd=root, capture_output=True, text=True)
    mod, fn = gate.rsplit('.', 1)
    code = ('import sys; sys.path.insert(0, "python/scripts"); '
            'from gates import %s as m; raise SystemExit(m.%s())' % (mod, fn))
    return subprocess.run([sys.executable, '-c', code], cwd=root, capture_output=True, text=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', required=True)
    ap.add_argument('--gate', required=True)
    ap.add_argument('--file')
    ap.add_argument('--old', action='append', default=[])
    ap.add_argument('--new', action='append', default=[])
    ap.add_argument('--count', action='append', type=int, default=[])
    ap.add_argument('--create')
    ap.add_argument('--content', default='')
    ap.add_argument('--expect', choices=('red', 'green'), required=True)
    ap.add_argument('--must-say', required=True)
    a = ap.parse_args()
    root = pathlib.Path(a.root).resolve()

    base = run_gate(root, a.gate)
    if base.returncode != 0:
        print('BASELINE NOT GREEN — 这次负控制无效：\n' + base.stdout + base.stderr)
        return 2

    if a.create:
        target = root / a.create
        if target.exists():
            print(f'CREATE TARGET EXISTS — {target} 已存在，拒绝覆盖')
            return 2
        try:
            target.write_text(a.content + '\n', encoding='utf-8')
            res = run_gate(root, a.gate)
        finally:
            target.unlink()
            for pyc in target.parent.glob('__pycache__/' + target.stem + '.*.pyc'):
                pyc.unlink()
        if target.exists():
            print('RESTORE FAILED — 新建的文件没删掉')
            return 3
    else:
        if not a.file or not a.old or len(a.old) != len(a.new):
            print('USAGE — 替换模式要 --file，且 --old / --new 成对')
            return 2
        counts = a.count or [1] * len(a.old)
        if len(counts) != len(a.old):
            print('USAGE — --count 要么不给，要么与 --old 一样多')
            return 2
        path = root / a.file
        original = path.read_bytes()
        text = original.decode('utf-8')
        for old, new, want in zip(a.old, a.new, counts):
            hits = text.count(old)
            if hits != want:
                print(f'MUTATION MISS — {old!r} 命中 {hits} 次，期望 {want}')
                return 2
            text = text.replace(old, new)
        mutated = text.encode('utf-8')
        if mutated == original:
            print('MUTATION NO-OP — 替换前后字节相同')
            return 2
        try:
            path.write_bytes(mutated)
            res = run_gate(root, a.gate)
        finally:
            path.write_bytes(original)
        if path.read_bytes() != original:
            print('RESTORE FAILED — 文件没有复原！')
            return 3

    out = res.stdout + res.stderr
    red = res.returncode != 0
    crash = next((m for m in CRASH_MARKERS if m in out), None)
    if a.expect == 'green':
        ok = (not red) and (a.must_say in out)
    else:
        ok = red and (a.must_say in out) and (crash is None)
    if a.expect == 'red' and crash is not None:
        print(f'CRASH — 输出里有崩溃特征 {crash!r}，这个红不算数')
    print(f'{"PASS" if ok else "FAIL"}: 期望 {a.expect}，实际 {"red" if red else "green"}'
          f'（rc={res.returncode}），must-say {a.must_say!r} '
          f'{"出现" if a.must_say in out else "未出现"}')
    for line in out.splitlines():
        if ('ERROR' in line or 'FAIL' in line or '✗' in line
                or a.must_say in line
                or any(m.strip('\n') in line for m in CRASH_MARKERS)):
            print('  | ' + line)
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
```

- [ ] **Step 2: 给执行器自己做一次负控制**

一个「必定 PASS」的执行器等于没有执行器。用一个与门无关的替换，期望 red，必须得到 FAIL：

```bash
W=/Users/nickma/Develop/My2ndBrain/MathViz/.claude/worktrees/python-phase1
S=/private/tmp/claude-501/-Users-nickma-Develop-My2ndBrain-MathViz/3e4bbe48-6820-4ea1-9cc2-e2cb4bd6aeae/scratchpad
python3 $S/p1-negctl.py --root $W --gate registry.fallback_check \
  --file docs/superpowers/specs/2026-09-16-python-phase1-design.md \
  --old '# Python 子项目 · 第 1 期设计' --new '# X' --expect red --must-say FALLBACK; echo "rc=$?"
```

Expected: `FAIL: 期望 red，实际 green`，`rc=1`。然后 `git -C $W status --short` 必须为空（文件已复原）。

第二个自测：断言只测「有没有 Traceback」会漏掉编译期错误——SyntaxError / IndentationError /
TabError 不打 Traceback，只打 `File "...", line N` + `<XxxError>:`。故意把 `check.py` 改出语法
错误，期望 red，must-say 是随便一个总会出现在崩溃输出里的字符串（文件名），必须得到 FAIL：

```bash
python3 $S/p1-negctl.py --root $W --gate 'cmd:python3 python/scripts/check.py' \
  --file python/scripts/check.py \
  --old 'GATES = [' --new 'GATES = [[' \
  --expect red --must-say 'check.py'
```

Expected: `FAIL`，且带一行 `CRASH — 输出里有崩溃特征 'SyntaxError:'，这个红不算数`。然后
`git -C $W status --short` 必须为空（文件已复原）。

---

## Task 1: `check.py` 不再写死门数（设计 A6）

**Files:**
- Modify: `python/scripts/check.py`

**Interfaces:**
- Produces: `GATES` 的元素形状改为 `(组, 名, 函数)`。组标签闭集：`'生成'`、`'A'`、`'B'`、`'C'`、`'D·库'`、`'D·词法'`。后续任务往 `GATES` 加门时必须带组标签。

- [ ] **Step 1: 改 docstring**

把文件头第一段与表格改成下面这样（其余段落——两条铁律、`run_node()` 那段、用法——原样保留）：

```python
"""python 子项目的校验门运行器（spec §5）。

**全部返回码无条件跑到底**，最后按「任一非零则整体失败」汇总。
生成脚本的 `--check` 各算一道门，`gates/` 下每个函数各算一道门。

门数**不写在这里**：它是一个可数的事实，写进散文就会漂——`chess/check.py`
的同类数字漂出过三个答案。运行结束时 `main()` 按组打印自己数出来的数目。

| 组 | 模块 | 守什么 |
|----|------|--------|
| 生成   | `inline_core` / `build_programs` / `sync_fallback` | 生成物与编辑源一致 |
| A      | `gates/registry.py` | 注册表 / FALLBACK / 版本 / 计数 / 标签 / 配色 / 页面镜像 |
| B      | `gates/hygiene.py`  | 出站引用 / script 字面量 / 控制字节 / 惰性依赖 / 骨架 |
| C      | `gates/syntax.py`   | node --check / core 测试 / 浏览器分支 |
| D·库   | `gates/library.py`  | 程序库 |
| D·词法 | `gates/lexer.py`    | 词法器 |
```

（其余 docstring 段落不动。）

- [ ] **Step 2: 改 `GATES` 与 `main()`**

```python
GATES = [
    ('生成', 'inline_core --check',    lambda: inline_core.main(check_only=True)),
    ('生成', 'build_programs --check', lambda: build_programs.main(check_only=True)),

    ('A', 'registry_check',         registry.registry_check),
    ('A', 'fallback_check',         registry.fallback_check),
    ('A', 'fallback_version_check', registry.fallback_version_check),
    ('A', 'version_meta_check',     registry.version_meta_check),
    ('A', 'program_count_check',    registry.program_count_check),
    ('A', 'module_label_check',     registry.module_label_check),
    ('A', 'accent_module_check',    registry.accent_module_check),

    ('B', 'outbound_ref_check',       hygiene.outbound_ref_check),
    ('B', 'script_literal_check',     hygiene.script_literal_check),
    ('B', 'control_byte_check',       hygiene.control_byte_check),
    ('B', 'lazy_dep_check',           hygiene.lazy_dep_check),
    ('B', 'skeleton_sentinel_check',  hygiene.skeleton_sentinel_check),
    ('B', 'skeleton_leak_check',      hygiene.skeleton_leak_check),

    ('C', 'node_check',            syntax.node_check),
    ('C', 'core_tests',            syntax.core_tests),
    ('C', 'browser_branch_check',  syntax.browser_branch_check),

    ('D·库', 'program_run_check',              library.program_run_check),
    ('D·库', 'algorithm_property_check',       library.algorithm_property_check),
    ('D·库', 'program_embed_roundtrip_check',  library.program_embed_roundtrip_check),
    ('D·库', 'chapter_manifest_check',         library.chapter_manifest_check),
    ('D·库', 'anchor_check',                   library.anchor_check),
    ('D·库', 'exemption_check',                library.exemption_check),
    ('D·库', 'source_ascii_check',             library.source_ascii_check),
    ('D·库', 'source_bmp_check',               library.source_bmp_check),
    ('D·库', 'source_indent_check',            library.source_indent_check),
    ('D·库', 'blank_directive_check',          library.blank_directive_check),
    ('D·库', 'program_meta_check',             library.program_meta_check),
    ('D·库', 'variant_check',                  library.variant_check),

    ('D·词法', 'lex_roundtrip_check',    lexer.lex_roundtrip_check),
    ('D·词法', 'lex_vs_cpython_check',   lexer.lex_vs_cpython_check),
    ('D·词法', 'judge_strictness_check', lexer.judge_strictness_check),
    ('D·词法', 'lex_never_throws_check', lexer.lex_never_throws_check),
]


def _tally() -> str:
    """按组自数，保持 GATES 里各组第一次出现的顺序。"""
    counts: dict = {}
    for group, _name, _fn in GATES:
        counts[group] = counts.get(group, 0) + 1
    return ' · '.join(f'{g} {n}' for g, n in counts.items())


def main() -> int:
    # 全部跑到底、全部要报——**不能用 `or` 短路**，见文件头。
    rc = [_guard(name, fn) for _group, name, fn in GATES]
    bad = [name for (_group, name, _fn), code in zip(GATES, rc) if code]
    print()
    if bad:
        print(f'{len(bad)} / {len(GATES)} 道门红了：{", ".join(bad)}（{_tally()}）',
              file=sys.stderr)
    else:
        print(f'{len(GATES)} 道门全绿（{_tally()}）。')
    return 1 if any(rc) else 0
```

- [ ] **Step 3: 跑一遍，确认汇总行**

Run: `python3 $W/python/scripts/check.py 2>&1 | tail -1`
Expected: `34 道门全绿（生成 2 · A 7 · B 6 · C 3 · D·库 12 · D·词法 4）。`

- [ ] **Step 4: 负控制——加一道假门，计数跟着变**

```bash
python3 $S/p1-negctl.py --root $W --gate 'cmd:python3 python/scripts/check.py' \
  --file python/scripts/check.py \
  --old "    ('B', 'skeleton_leak_check',      hygiene.skeleton_leak_check)," \
  --new $'    (\'B\', \'skeleton_leak_check\',      hygiene.skeleton_leak_check),\n    (\'B\', \'fake_gate\', lambda: 0),' \
  --expect green --must-say '35 道门全绿（生成 2 · A 7 · B 7'
```

Expected: `PASS: 期望 green，实际 green`。

再做一个红的：假门返回 1，汇总行必须点名它。

```bash
python3 $S/p1-negctl.py --root $W --gate 'cmd:python3 python/scripts/check.py' \
  --file python/scripts/check.py \
  --old "    ('B', 'skeleton_leak_check',      hygiene.skeleton_leak_check)," \
  --new $'    (\'B\', \'skeleton_leak_check\',      hygiene.skeleton_leak_check),\n    (\'B\', \'fake_red_gate\', lambda: 1),' \
  --expect red --must-say '1 / 35 道门红了：fake_red_gate'
```

Expected: `PASS: 期望 red，实际 red`。

- [ ] **Step 5: 确认 docstring 里没有残留的门数**

Run: `grep -nE '[0-9]+ ?(道|个返回码|道门)|（[0-9]+）' $W/python/scripts/check.py`
Expected: 只命中 `main()` 里的 f-string（`{len(bad)} / {len(GATES)} 道门` 等），docstring 零命中。

- [ ] **Step 6: 提交**

```bash
git -C $W add python/scripts/check.py
git -C $W commit -m "refactor(python): check.py 按组自数门，散文里不再写死门数

账本 §二「第 35 道门」的触发条件：docstring 里的门数与表格括号数会漂，
chess/check.py 刚演示过漂出三个答案。GATES 带上组标签，汇总行按组打印自己
数出来的数目。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git -C $W status --short
```

Expected: 状态为空。

---
## Task 2: `sync_fallback.py` 生成两页 FALLBACK（设计 A1）

**Files:**
- Create: `python/scripts/sync_fallback.py`
- Modify: `python/scripts/gates/registry.py`（`fallback_check` / `fallback_version_check` 及其正则）
- Modify: `python/app.html`、`python/index.html`（FALLBACK 段）
- Modify: `python/scripts/check.py`（import + `GATES`）
- Modify: `.githooks/pre-commit`（python 段）
- Modify: `CLAUDE.md`（python 段两句）

**Interfaces:**
- Consumes: Task 1 的 `GATES` 三元组形状。
- Produces:
  - `sync_fallback.main(check_only: bool = False, print_changed: bool = False) -> int`
  - `sync_fallback.encode(entries: list) -> str`（JSON 编码 + 额外转义 `<`、U+2028、U+2029）
  - 两页的区段形状（门按这个形状解析）：
    ```
    /* >>> GENERATED:FALLBACK */
    var FALLBACK = <JSON 数组>;
    /* <<< GENERATED:FALLBACK */
    ```
  - `registry.FALLBACK_FIELDS: dict[str, tuple]`（门自己的规格字段表，**不从脚本导入**）

- [ ] **Step 1: 先改门（会红：区段还不存在）**

`python/scripts/gates/registry.py`：顶部 `import re` 旁加 `import json`；删掉 `FALLBACK_ARRAY_RE`、`FALLBACK_ID_RE`、`FALLBACK_ENTRY_RE`、`FALLBACK_VERSION_RE` 四个正则与 `_fallback_body()`（先 `grep -rn "FALLBACK_ARRAY_RE\|FALLBACK_ID_RE\|FALLBACK_ENTRY_RE\|FALLBACK_VERSION_RE\|_fallback_body" $W/python/scripts` 确认只有 registry.py 用）。在原位置加：

```python
FALLBACK_REGION_RE = re.compile(
    r'/\* >>> GENERATED:FALLBACK \*/\nvar FALLBACK = (.*?);\n/\* <<< GENERATED:FALLBACK \*/',
    re.DOTALL)

# 第 1 期设计 D5：两页 FALLBACK 各自必须**恰好**带这些字段。这是规格，故意不从
# sync_fallback.py 导入——门若与生成器共用同一份字段表，从表里删掉一个字段时
# 两边会一起「同意」：全绿，而页面上少了它。
FALLBACK_FIELDS = {
    'app.html':   ('id', 'file', 'accent', 'module', 'version', 'kicker', 'title', 'tag'),
    'index.html': ('id', 'file', 'accent', 'module', 'version', 'kicker', 'title', 'tag',
                   'desc'),
}


def _fallback_entries(name: str):
    """解析一页的 GENERATED:FALLBACK 区段。返回 (条目列表, None) 或 (None, 错误文本)。

    用 json.loads 而不是正则抠字段：区段由 sync_fallback.py 用 json.dumps 写出，
    门这边用独立的解码器读回来比对——一个比字节（sync_fallback --check），
    一个比语义（本函数的调用方），两次测量互不依赖。
    """
    m = FALLBACK_REGION_RE.search(read_text(ROOT / name))
    if not m:
        return None, (f'{name} 里找不到 GENERATED:FALLBACK 区段'
                      f'（形如 var FALLBACK = [...]; 夹在两条标记之间）')
    try:
        data = json.loads(m.group(1))
    except ValueError as exc:
        return None, f'{name} 的 FALLBACK 区段不是合法 JSON：{exc}'
    if not isinstance(data, list) or not all(isinstance(e, dict) for e in data):
        return None, f'{name} 的 FALLBACK 不是对象数组'
    return data, None
```

把 `fallback_check()` 整个换成：

```python
def fallback_check() -> int:
    """两页 FALLBACK 与注册表：id 顺序相同；字段集恰为 FALLBACK_FIELDS；
    除 version（归 fallback_version_check）外逐字段相等。

    FALLBACK 是 file:// 下唯一的数据来源。第 0 期这道门只比 id 集合，于是把
    accent 改成 orange、module 改成 7、title 改成 WRONG TITLE，34 道门全绿——
    离线打开的侧栏会把工具归进错的模块、画错的颜色（账本 §一.1）。
    """
    tools = load_registry()['tools']
    reg_ids = [t['id'] for t in tools]
    by_id = {t['id']: t for t in tools}
    rc = 0
    compared = 0
    for name in ROOT_PAGES:
        entries, err = _fallback_entries(name)
        if err:
            print(f'ERROR: {err}', file=sys.stderr)
            rc = 1
            continue
        ids = [e.get('id') for e in entries]
        if ids != reg_ids:
            print(f'ERROR: {name} 的 FALLBACK 条目与注册表不一致（顺序也算）\n'
                  f'    FALLBACK：{ids}\n'
                  f'    注册表：  {reg_ids}', file=sys.stderr)
            rc = 1
            continue
        want_fields = set(FALLBACK_FIELDS[name])
        for e in entries:
            tid = e['id']
            got_fields = set(e)
            if got_fields != want_fields:
                print(f'ERROR: {name} 的 FALLBACK 条目 {tid} 字段集不符——'
                      f'多出 {sorted(got_fields - want_fields)}，'
                      f'缺少 {sorted(want_fields - got_fields)}', file=sys.stderr)
                rc = 1
            for field in sorted((want_fields & got_fields) - {'version'}):
                if e[field] != by_id[tid].get(field):
                    print(f'ERROR: {name} 的 FALLBACK 条目 {tid} 的 {field} 与注册表不同\n'
                          f'    FALLBACK：{e[field]!r}\n'
                          f'    注册表：  {by_id[tid].get(field)!r}\n'
                          f'    修复：python3 python/scripts/sync_fallback.py',
                          file=sys.stderr)
                    rc = 1
                else:
                    compared += 1
    if rc == 0 and compared == 0:
        print('ERROR: 一个 FALLBACK 字段都没比到——这道门跑了个寂寞', file=sys.stderr)
        return 1
    if rc == 0:
        print(f'FALLBACK：两页各 {len(reg_ids)} 条，id 顺序与注册表相同，'
              f'{compared} 个镜像字段逐一相等')
    return rc
```

把 `fallback_version_check()` 的函数体换成（docstring 保留原文）：

```python
    reg_ver = {t['id']: t['version'] for t in load_registry()['tools']}
    rc = 0
    checked = 0
    for name in ROOT_PAGES:
        entries, err = _fallback_entries(name)
        if err:
            continue                     # 解析不了由 fallback_check 报，不重复报
        for e in entries:
            tid = e.get('id')
            if 'version' not in e:
                print(f'ERROR: {name} 的 FALLBACK 条目 {tid} 没有 version 字段——'
                      f'file:// 下卡片会渲染成 v0、地址退化成 ?v=0', file=sys.stderr)
                rc = 1
                continue
            want = reg_ver.get(tid)
            if want is None:
                continue                 # id 对不上由 fallback_check 报
            if e['version'] != want:
                print(f'ERROR: {name} 的 FALLBACK 条目 {tid} 版本是 '
                      f'{e["version"]!r}，注册表是 {want!r}', file=sys.stderr)
                rc = 1
                continue
            checked += 1
    if rc == 0 and checked == 0:
        print('ERROR: 一条 FALLBACK 版本戳都没比到——这道门跑了个寂寞', file=sys.stderr)
        return 1
    if rc == 0:
        print(f'FALLBACK 版本戳：{checked} 条内嵌条目全部带 version 且与注册表同值')
    return rc
```

- [ ] **Step 2: 跑两道门，确认因区段缺失而红**

```bash
cd $W && python3 -c 'import sys; sys.path.insert(0,"python/scripts"); from gates import registry as r; raise SystemExit(r.fallback_check())'; echo "rc=$?"
```

Expected: `ERROR: app.html 里找不到 GENERATED:FALLBACK 区段` 与 index.html 同样一行，`rc=1`，无 Traceback。

- [ ] **Step 3: 写 `python/scripts/sync_fallback.py`**

```python
#!/usr/bin/env python3
"""把 python-tools.json 同步进两个导航页内嵌的 FALLBACK（第 1 期设计 §4 A1）。

FALLBACK 是 file:// 下唯一的数据来源（fetch 会因同源限制失败）。第 0 期它是手抄的：
两页各一份、每条带 accent / module / kicker / title / tag 五个镜像字段，门只比 id
集合与 version——把 accent 改成 orange、module 改成 7，34 道门全绿。根仓为同一族
问题付过学费（62 条里 48 条静默漂移），解法是把镜像改成生成的；本脚本照
scripts/sync_registry.py 的形状做同一件事。

两页字段不同（设计 D5）：
  app.html   —— 侧栏用到的字段，不带 desc
  index.html —— 再加 desc：画廊卡片要显示简介，离线与线上从此一致

编码用 json.dumps（desc 是带撇号与引号的正文，手写 JS 单引号字面量的转义不可靠），
然后额外把三种字符写成 JSON 的 unicode 转义（反斜杠 + u + 四位十六进制）：
  <        —— 防正文里出现 script 结束标签或 HTML 注释开头，那会让 HTML 分词器断页
  U+2028 / U+2029 —— 自 ES2019 起不是语法错（R41 实测），但旧引擎与工具链把它们
              当换行，而且肉眼不可见
JSON 的结构字符里没有这三种，所以它们只可能出现在字符串内部，整体替换是安全的。

用法：
    python3 python/scripts/sync_fallback.py                  # 重写两页
    python3 python/scripts/sync_fallback.py --check          # 只查，不同步退出 1
    python3 python/scripts/sync_fallback.py --print-changed  # 重写并逐行打印改过的文件（给钩子）
"""
from __future__ import annotations

import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
REGISTRY = ROOT / 'python-tools.json'

BEGIN = '/* >>> GENERATED:FALLBACK */'
END = '/* <<< GENERATED:FALLBACK */'
REGION_RE = re.compile(re.escape(BEGIN) + r'.*?' + re.escape(END), re.DOTALL)

BASE_FIELDS = ('id', 'file', 'accent', 'module', 'version', 'kicker', 'title', 'tag')
PAGE_FIELDS = {
    'app.html': BASE_FIELDS,
    'index.html': BASE_FIELDS + ('desc',),
}

_ESCAPED = ('<', chr(0x2028), chr(0x2029))


def load_tools() -> list:
    try:
        data = json.loads(REGISTRY.read_text(encoding='utf-8'))
    except (OSError, ValueError) as exc:
        raise SystemExit(f'ERROR: 读不了注册表 {REGISTRY}：{exc}') from None
    tools = data.get('tools') if isinstance(data, dict) else None
    if not isinstance(tools, list) or not tools:
        raise SystemExit(f'ERROR: {REGISTRY} 的 "tools" 不是非空数组')
    return tools


def minimal(tools: list, fields: tuple) -> list:
    out = []
    for i, tool in enumerate(tools):
        if not isinstance(tool, dict):
            raise SystemExit(f'ERROR: {REGISTRY} 的 tools[{i}] 不是对象')
        missing = [f for f in fields if f not in tool]
        if missing:
            raise SystemExit(
                f'ERROR: {REGISTRY} 的 tools[{i}]（id={tool.get("id")!r}）缺字段 {missing}')
        out.append({f: tool[f] for f in fields})
    return out


def encode(entries: list) -> str:
    text = json.dumps(entries, ensure_ascii=False, indent=2)
    for ch in _ESCAPED:
        text = text.replace(ch, '\\' + 'u%04x' % ord(ch))
    return text


def render_page(name: str, text: str, tools: list) -> str:
    found = len(REGION_RE.findall(text))
    if found != 1:
        raise SystemExit(
            f'ERROR: python/{name} 里 GENERATED:FALLBACK 区段有 {found} 个，应恰好 1 个')
    block = f'{BEGIN}\nvar FALLBACK = {encode(minimal(tools, PAGE_FIELDS[name]))};\n{END}'
    return REGION_RE.sub(lambda _m: block, text, count=1)


def main(check_only: bool = False, print_changed: bool = False) -> int:
    tools = load_tools()
    stale = []
    for name in PAGE_FIELDS:
        path = ROOT / name
        original = path.read_text(encoding='utf-8')
        updated = render_page(name, original, tools)
        if updated == original:
            continue
        stale.append(path)
        if not check_only:
            path.write_text(updated, encoding='utf-8')

    if check_only:
        if stale:
            print('ERROR: 以下导航页的 FALLBACK 与 python-tools.json 不同步：', file=sys.stderr)
            for path in stale:
                print(f'  - {path.name}', file=sys.stderr)
            print('修复：python3 python/scripts/sync_fallback.py', file=sys.stderr)
            return 1
        print(f'FALLBACK 生成：两个导航页与注册表同步（{len(tools)} 个工具）')
        return 0

    if print_changed:
        # 机读列表，给 pre-commit 钩子只 git add 这些路径（同 inline_core.py 的纪律）。
        for path in stale:
            print(path)
        return 0

    if stale:
        print(f'已重写 {len(stale)} 个导航页：{", ".join(p.name for p in stale)}')
    else:
        print('两个导航页已是最新')
    return 0


if __name__ == '__main__':
    sys.exit(main(check_only='--check' in sys.argv,
                  print_changed='--print-changed' in sys.argv))
```

- [ ] **Step 4: 编码往返测试（放 scratchpad）**

`$S/p1-encode-probe.py`：

```python
import json, pathlib, subprocess, sys
W = pathlib.Path('/Users/nickma/Develop/My2ndBrain/MathViz/.claude/worktrees/python-phase1')
sys.path.insert(0, str(W / 'python/scripts'))
import sync_fallback as sf

LS, PS = chr(0x2028), chr(0x2029)
entries = [{'id': 'x', 'desc': 'a </' + 'script> <!-- b' + LS + 'c' + PS + " it's \"q\" \\ end"}]
text = sf.encode(entries)
assert '<' not in text, '输出里还有裸 <'
assert LS not in text and PS not in text, '输出里还有裸 U+2028/2029'
js = ("const vm=require('vm');const v=vm.runInNewContext(%s,{});"
      "process.stdout.write(JSON.stringify(v));") % json.dumps('var FALLBACK = ' + text + ';FALLBACK')
r = subprocess.run(['node'], input=js, capture_output=True, text=True)
assert r.returncode == 0, r.stderr
assert json.loads(r.stdout) == entries, 'node 解码后与原文不等'
assert json.loads(text) == entries, 'json.loads 解码后与原文不等'
# 反例：不转义的版本必须被上面的断言抓住，否则这个探针什么都没测
raw = json.dumps(entries, ensure_ascii=False, indent=2)
assert '<' in raw and LS in raw, '反例构造失败：原始 json.dumps 里本该有裸字符'
print('encode 往返 OK；反例确实含裸字符')
```

Run: `python3 $S/p1-encode-probe.py`
Expected: `encode 往返 OK；反例确实含裸字符`

- [ ] **Step 5: 两页换成生成区段**

用脚本替换，断言恰好命中一次：

```python
import pathlib, re
W = pathlib.Path('/Users/nickma/Develop/My2ndBrain/MathViz/.claude/worktrees/python-phase1')
SEG = re.compile(r'/\* =+ 回退列表 =+.*?\nvar FALLBACK = \[.*?\n\];\n', re.DOTALL)
NEW = {
'app.html': """/* ================= 回退列表 =================
   运行时优先 fetch('python-tools.json')；file:// 下 fetch 会因同源限制失败，
   靠这份内嵌副本兜底——一个在 file:// 下只剩 home 一项的导航壳等于没有。

   下面的 GENERATED:FALLBACK 区段由 python/scripts/sync_fallback.py 从注册表
   生成，**不要手改**：手抄的镜像字段没人看管就一定会漂（根仓 62 条里 48 条
   静默漂移过）。改注册表，再跑那个脚本；pre-commit 钩子也会代跑。
   本页只带侧栏用到的字段，不带 desc（画廊那一页带）。 */
/* >>> GENERATED:FALLBACK */
/* <<< GENERATED:FALLBACK */
""",
'index.html': """/* ================= 回退列表 =================
   运行时优先 fetch('python-tools.json')；file:// 下 fetch 会失败（同源限制），
   这里内嵌一份副本静默回落。

   下面的 GENERATED:FALLBACK 区段由 python/scripts/sync_fallback.py 从注册表
   生成，**不要手改**：手抄的镜像字段没人看管就一定会漂（根仓 62 条里 48 条
   静默漂移过）。改注册表，再跑那个脚本；pre-commit 钩子也会代跑。
   本页比 app.html 多带 desc：画廊卡片要显示简介，离线与线上从此一致。 */
/* >>> GENERATED:FALLBACK */
/* <<< GENERATED:FALLBACK */
""",
}
for name, block in NEW.items():
    p = W / 'python' / name
    s = p.read_text(encoding='utf-8')
    assert len(SEG.findall(s)) == 1, (name, len(SEG.findall(s)))
    p.write_text(SEG.sub(lambda _m: block, s, count=1), encoding='utf-8')
print('两页已换成空区段')
```

然后生成：

```bash
python3 $W/python/scripts/sync_fallback.py
grep -n "var TOOLS = FALLBACK;" $W/python/app.html $W/python/index.html
```

Expected: `已重写 2 个导航页：app.html, index.html`；两页各一行 `var TOOLS = FALLBACK;`（紧跟在 `<<< GENERATED:FALLBACK` 之后）。

- [ ] **Step 6: 门转绿**

```bash
cd $W && for g in fallback_check fallback_version_check; do python3 -c "import sys; sys.path.insert(0,'python/scripts'); from gates import registry as r; raise SystemExit(r.$g())"; echo "$g rc=$?"; done
python3 $W/python/scripts/sync_fallback.py --check; echo "sync rc=$?"
python3 $W/scripts/check_nav_contract.py 2>&1 | tail -1
```

Expected: 三个 `rc=0`；契约门 `103 项断言全部通过`。

- [ ] **Step 7: 接进 `check.py`**

`import build_programs` 那几行旁加 `import sync_fallback  # noqa: E402`；`GATES` 的 `'生成'` 组追加：

```python
    ('生成', 'sync_fallback --check',  lambda: sync_fallback.main(check_only=True)),
```

Run: `python3 $W/python/scripts/check.py 2>&1 | tail -1`
Expected: `35 道门全绿（生成 3 · A 7 · B 6 · C 3 · D·库 12 · D·词法 4）。`

- [ ] **Step 8: 钩子**

`.githooks/pre-commit` 的 python 段：把触发行

```sh
if git diff --cached --name-only | grep -qE '^python/(core|programs|tools|scripts)/'; then
```

换成

```sh
# 触发条件多了注册表与两个导航页：FALLBACK 从第 1 期起由 sync_fallback.py 生成，
# 只改 python-tools.json 的提交也必须重新生成。三个分支写成顶层交替、不套可选捕获组
# ——导航契约段注释里记着本机 ugrep 7.8.4 在 `(…)?` 套交替时静默漏匹配（R53）。
if git diff --cached --name-only | grep -qE '^python/(core|programs|tools|scripts)/|^python/python-tools\.json$|^python/(app|index)\.html$'; then
```

在 `PY_PROG_CHANGED=...` 那个 `if` 块之后、`for CHANGED in` 之前插入：

```sh
  # 排在 build_programs.py 之后：它会回写注册表的 programs / lines。FALLBACK 今天
  # 不带这两个字段，但顺序本身不该依赖「今天不带」。
  PY_FALLBACK_CHANGED=$(python3 python/scripts/sync_fallback.py --print-changed)
  if [ $? -ne 0 ]; then
    echo "python: sync_fallback.py 失败，提交中止" >&2
    exit 1
  fi
```

并把循环改成 `for CHANGED in "$PY_CORE_CHANGED" "$PY_PROG_CHANGED" "$PY_FALLBACK_CHANGED"; do`。

验证触发正则在两个 grep 下一致：

```bash
printf 'python/python-tools.json\npython/app.html\npython/index.html\npython/core/x.js\ncryptography/app.html\npython/tools/a.html\npython/README.md\n' > $S/p1-hook-paths.txt
P='^python/(core|programs|tools|scripts)/|^python/python-tools\.json$|^python/(app|index)\.html$'
diff <(grep -E "$P" $S/p1-hook-paths.txt) <(/usr/bin/grep -E "$P" $S/p1-hook-paths.txt) && grep -cE "$P" $S/p1-hook-paths.txt
sh -n $W/.githooks/pre-commit && echo "hook syntax OK"
```

Expected: `diff` 无输出，计数 `5`；`hook syntax OK`。

- [ ] **Step 9: `CLAUDE.md` 的 python 段**

把 `- **Two generator scripts, so `.py` is a second class of edit source.**` 那一条的开头改为 `- **Three generator scripts, and `.py` is a second class of edit source.**`，并在该条末尾（`then re-run.` 之后）加一句：

```
  `python/scripts/sync_fallback.py` writes the `GENERATED:FALLBACK` region of both navigation
  pages from `python-tools.json` (`app.html` without `desc`, `index.html` with it).
```

把段尾 `run by the hook (on `^python/(core|programs|tools|scripts)/`)` 改为
`run by the hook (on `python/{core,programs,tools,scripts}/`, `python/python-tools.json` and the two navigation pages)`。

- [ ] **Step 10: 负控制**

```bash
# (a) 改区段里的 accent：语义门红，并点名字段
python3 $S/p1-negctl.py --root $W --gate registry.fallback_check --file python/app.html \
  --old '"accent": "cyan"' --new '"accent": "violet"' --expect red --must-say '的 accent 与注册表不同'
# (b) 同一破坏：字节门红
python3 $S/p1-negctl.py --root $W --gate 'cmd:python3 python/scripts/sync_fallback.py --check' --file python/app.html \
  --old '"accent": "cyan"' --new '"accent": "violet"' --expect red --must-say '- app.html'
# (c) 只改注册表 title、不重新生成：两页都红
python3 $S/p1-negctl.py --root $W --gate registry.fallback_check --file python/python-tools.json \
  --old '"en": "Basics: Values & Output"' --new '"en": "Basics: WRONG"' --expect red --must-say '的 title 与注册表不同'
# (d) index.html 少了 desc：字段集红
python3 $S/p1-negctl.py --root $W --gate registry.fallback_check --file python/index.html \
  --old '"desc":' --new '"descX":' --expect red --must-say '字段集不符'
# (e) 删掉一条的 version：版本门红
python3 $S/p1-negctl.py --root $W --gate registry.fallback_version_check --file python/index.html \
  --old '"version": "1.0.0",' --new '' --expect red --must-say '没有 version 字段'
```

Expected: 五行 `PASS`。任何一行 `MUTATION MISS`（命中次数不是 1）时，先 `grep -c` 查清再改 `--old`，不要改 `--count` 凑数。

- [ ] **Step 11: `file://` 目测**

用 Browser 工具打开 `file://$W/python/index.html?lang=zh`（显式 `tabId`），断言：`typeof FALLBACK` 为 `object`、`FALLBACK[0].desc` 非空、卡片上有简介段落；截图。再开 `file://$W/python/app.html?lang=en`，侧栏有 py-basics 且圆点为 cyan；截图。

- [ ] **Step 12: 提交**

```bash
git -C $W add python/scripts/sync_fallback.py python/scripts/gates/registry.py python/scripts/check.py \
  python/app.html python/index.html .githooks/pre-commit CLAUDE.md
git -C $W commit -m "feat(python): FALLBACK 由 sync_fallback.py 从注册表生成

两页 FALLBACK 改为 GENERATED 区段（app.html 不带 desc，index.html 带）；
fallback_check / fallback_version_check 从正则比 id 集合改为 json.loads 逐字段比对，
与 sync_fallback --check 的逐字节比对互为独立测量。钩子在改注册表或导航页时也重新生成。

负控制：区段 accent、注册表 title、缺 desc、缺 version 各一次，均因断言失败而红。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git -C $W status --short
```

Expected: 状态为空（钩子跑过 python 段与导航契约段）。

---
## Task 3: accent 分配表变成门（设计 A2）

**Files:**
- Modify: `python/scripts/gates/__init__.py`（加 `MODULE_ACCENTS`）
- Modify: `python/scripts/gates/registry.py`（`accent_module_check` 与 import）

**Interfaces:**
- Produces: `gates.MODULE_ACCENTS: dict[int, str]`，键 1–8。

- [ ] **Step 1: 加表**

`gates/__init__.py` 里 `ACCENTS = {...}` 下一行加：

```python
# 主规格 §6.1 的模块配色表：同模块同色、相邻模块异色。八个模块五种颜色，所以表必须
# **事先定死**——按「相邻异色」临场挑，第六个落地的模块起一定撞色，被迫回头改一个
# 已发布模块的颜色（账本 §一.3）。accent_module_check 同时校验表本身相邻异色。
MODULE_ACCENTS = {1: 'cyan', 2: 'violet', 3: 'emerald', 4: 'rose',
                  5: 'orange', 6: 'cyan', 7: 'violet', 8: 'emerald'}
```

- [ ] **Step 2: 重写 `accent_module_check`**

`registry.py` 的 `from . import (...)` 加入 `MODULE_ACCENTS`。函数整个换成：

```python
def accent_module_check() -> int:
    """注册表每条的 accent == MODULE_ACCENTS[module]；表本身覆盖 1–8、取值在闭集、相邻异色。

    第 0 期这道门只查「同模块同色、相邻异色」，而且因为只有一个模块，后半截在真实
    数据上从没执行过。改成「照表」之后：同模块同色是表的推论；相邻异色从「临场挑色
    时碰运气」变成「对表做一次静态断言」——这条断言每次运行都在真实数据（表）上执行。
    """
    rc = 0
    if set(MODULE_ACCENTS) != MODULES:
        print(f'ERROR: MODULE_ACCENTS 的键应恰为模块 1–8，实际 {sorted(MODULE_ACCENTS)}',
              file=sys.stderr)
        rc = 1
    for mod, accent in sorted(MODULE_ACCENTS.items()):
        if accent not in ACCENTS:
            print(f'ERROR: MODULE_ACCENTS[{mod}]={accent!r} 不在五色闭集 {sorted(ACCENTS)} 内',
                  file=sys.stderr)
            rc = 1
        nxt = MODULE_ACCENTS.get(mod + 1)
        if nxt is not None and nxt == accent:
            print(f'ERROR: MODULE_ACCENTS 相邻模块 {mod} 与 {mod + 1} 都是 {accent!r}——'
                  f'分组的颜色线索会消失', file=sys.stderr)
            rc = 1

    checked = 0
    for d in load_registry()['tools']:
        mod = d.get('module')
        if mod not in MODULES:
            continue                     # 非法 module 由 registry_check 报
        want = MODULE_ACCENTS.get(mod)
        if d.get('accent') != want:
            print(f'ERROR: {d.get("id")} 在模块 {mod}，accent 应为 {want!r}（主规格 §6.1），'
                  f'实际 {d.get("accent")!r}', file=sys.stderr)
            rc = 1
            continue
        checked += 1
    if rc == 0 and checked == 0:
        print('ERROR: 一条注册表 accent 都没比到——这道门跑了个寂寞', file=sys.stderr)
        return 1
    if rc == 0:
        print(f'配色：{checked} 个工具的 accent 与模块配色表一致；表本身覆盖 1–8 且相邻异色')
    return rc
```

- [ ] **Step 3: 跑门**

Run: `cd $W && python3 -c 'import sys; sys.path.insert(0,"python/scripts"); from gates import registry as r; raise SystemExit(r.accent_module_check())'; echo "rc=$?"`
Expected: `配色：1 个工具的 accent 与模块配色表一致；表本身覆盖 1–8 且相邻异色`，`rc=0`。

- [ ] **Step 4: 负控制**

```bash
python3 $S/p1-negctl.py --root $W --gate registry.accent_module_check --file python/python-tools.json \
  --old '"accent": "cyan"' --new '"accent": "violet"' --expect red --must-say "accent 应为 'cyan'"
python3 $S/p1-negctl.py --root $W --gate registry.accent_module_check --file python/scripts/gates/__init__.py \
  --old "6: 'cyan'" --new "6: 'orange'" --expect red --must-say '相邻模块 5 与 6'
python3 $S/p1-negctl.py --root $W --gate registry.accent_module_check --file python/scripts/gates/__init__.py \
  --old "8: 'emerald'}" --new "8: 'teal'}" --expect red --must-say "MODULE_ACCENTS[8]='teal'"
```

Expected: 三行 `PASS`。

- [ ] **Step 5: 全量与提交**

```bash
python3 $W/python/scripts/check.py 2>&1 | tail -1
git -C $W add python/scripts/gates/__init__.py python/scripts/gates/registry.py
git -C $W commit -m "feat(python): accent 按模块配色表校验

主规格 §6.1 早就定了表（账本 §一.3 说它「要定下来」不准确），缺的是门：
accent_module_check 改为断言注册表照表取色，并对表本身做相邻异色的静态断言。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git -C $W status --short
```

Expected: `35 道门全绿（…）。`；状态为空。

---

## Task 4: 新门 `page_mirror_check`（设计 A3）

**Files:**
- Modify: `python/scripts/gates/registry.py`（新门 + import `run_node`、`TOOLS_DIR`）
- Modify: `python/scripts/check.py`（`GATES` 的 A 组加一行）

**Interfaces:**
- Produces: `registry.page_mirror_check() -> int`

- [ ] **Step 1: 写门**

`registry.py` 的 `from . import (...)` 加入 `TOOLS_DIR`、`run_node`。文件末尾加：

```python
TOOL_BLOCK_RE = re.compile(r'var TOOL = (\{.*?\n\});', re.DOTALL)
META_ENGINE_RE = re.compile(r'<meta\s+name="tool-engine"\s+content="([^"]+)"')


def _eval_tool_blocks(paths: list) -> dict:
    """{文件名: {'value': TOOL 对象} | {'error': 文本}}。在 node vm 里求值对象字面量，
    不用正则抠字段——TOOL 块里有注释、有嵌套对象，正则抠出来的是「看起来像」的值。"""
    blocks = {}
    for p in paths:
        m = TOOL_BLOCK_RE.search(read_text(p))
        blocks[p.name] = m.group(1) if m else None
    script = r'''
const vm = require('vm');
const blocks = %s;
const out = {};
for (const name of Object.keys(blocks)) {
  if (blocks[name] === null) { out[name] = { error: '找不到 var TOOL = {...};' }; continue; }
  try { out[name] = { value: vm.runInNewContext('(' + blocks[name] + ')', {}) }; }
  catch (e) { out[name] = { error: 'TOOL 块求值抛错：' + e.message }; }
}
process.stdout.write(JSON.stringify(out));
''' % json.dumps(blocks, ensure_ascii=False)
    proc = run_node(script)
    if proc.returncode != 0:
        raise RuntimeError('node 求值 TOOL 块失败：' + proc.stderr)
    return json.loads(proc.stdout)


def page_mirror_check() -> int:
    """每个已注册工具页的 TOOL.id / accent / title 与 tool-engine meta 都等于注册表；
    全部工具的 engine 相同，且等于 _skeleton.html 的 tool-engine。

    这几处是第 0 期账本没点到的镜像：TOOL 块每页一份，`TOOL.id` 全页零读者、只有一句
    「必须与注册表一致」的注释；engine 在注册表与页面 meta 各存一份，也无门。
    所有页面内联的是同一份 core，所以 engine 只可能有一个真值——骨架也要对上，否则
    下一个从骨架复制出来的新页会带着旧 engine 出生。
    """
    reg = load_registry()['tools']
    present = [d for d in reg if (ROOT / d['file']).exists()]   # 缺文件由 registry_check 报
    skeleton = TOOLS_DIR / '_skeleton.html'
    evaluated = _eval_tool_blocks([ROOT / d['file'] for d in present])
    rc = 0
    checked = 0
    for d in present:
        path = ROOT / d['file']
        res = evaluated.get(path.name) or {'error': '没有求值结果'}
        if 'error' in res:
            print(f'ERROR: {d["file"]}：{res["error"]}', file=sys.stderr)
            rc = 1
            continue
        tool = res['value']
        for field in ('id', 'accent', 'title'):
            if tool.get(field) != d.get(field):
                print(f'ERROR: {d["file"]} 的 TOOL.{field} 与注册表不同\n'
                      f'    页面：  {tool.get(field)!r}\n'
                      f'    注册表：{d.get(field)!r}', file=sys.stderr)
                rc = 1
        m = META_ENGINE_RE.search(read_text(path))
        if not m:
            print(f'ERROR: {d["file"]} 缺 <meta name="tool-engine">', file=sys.stderr)
            rc = 1
        elif m.group(1) != d.get('engine'):
            print(f'ERROR: {d["file"]} 的 tool-engine meta 是 {m.group(1)!r}，'
                  f'注册表是 {d.get("engine")!r}', file=sys.stderr)
            rc = 1
        checked += 1

    engines = sorted({str(d.get('engine')) for d in reg})
    if len(engines) != 1:
        print(f'ERROR: 注册表里的 engine 不止一个：{engines}——所有页面内联同一份 core，'
              f'engine 只能有一个真值', file=sys.stderr)
        rc = 1
    sm = META_ENGINE_RE.search(read_text(skeleton)) if skeleton.exists() else None
    if not sm:
        print('ERROR: tools/_skeleton.html 缺 <meta name="tool-engine">', file=sys.stderr)
        rc = 1
    elif len(engines) == 1 and sm.group(1) != engines[0]:
        print(f'ERROR: _skeleton.html 的 tool-engine 是 {sm.group(1)!r}，工具们是 '
              f'{engines[0]!r}——从骨架复制出来的新页会带着旧 engine 出生', file=sys.stderr)
        rc = 1

    if rc == 0 and checked == 0:
        print('ERROR: 一个工具页都没比到——这道门跑了个寂寞', file=sys.stderr)
        return 1
    if rc == 0:
        print(f'页面镜像：{checked} 个工具页的 TOOL.id/accent/title 与 tool-engine 与注册表一致；'
              f'engine 全库唯一（{engines[0]}），骨架同值')
    return rc
```

- [ ] **Step 2: 跑门**

Run: `cd $W && python3 -c 'import sys; sys.path.insert(0,"python/scripts"); from gates import registry as r; raise SystemExit(r.page_mirror_check())'; echo "rc=$?"`
Expected: `页面镜像：1 个工具页的 … engine 全库唯一（py-1.0.0），骨架同值`，`rc=0`。

- [ ] **Step 3: 接进 `check.py`**

`GATES` 的 A 组末尾（`accent_module_check` 之后）加：

```python
    ('A', 'page_mirror_check',      registry.page_mirror_check),
```

Run: `python3 $W/python/scripts/check.py 2>&1 | tail -1`
Expected: `36 道门全绿（生成 3 · A 8 · B 6 · C 3 · D·库 12 · D·词法 4）。`

- [ ] **Step 4: 负控制**

每条破坏前先 `grep -c` 确认命中 1 次（执行器也会断言）。

```bash
python3 $S/p1-negctl.py --root $W --gate registry.page_mirror_check --file python/tools/py-basics.html \
  --old "  id: 'py-basics'," --new "  id: 'py-basic'," --expect red --must-say 'TOOL.id 与注册表不同'
python3 $S/p1-negctl.py --root $W --gate registry.page_mirror_check --file python/tools/py-basics.html \
  --old "  accent: 'cyan'," --new "  accent: 'rose'," --expect red --must-say 'TOOL.accent 与注册表不同'
python3 $S/p1-negctl.py --root $W --gate registry.page_mirror_check --file python/tools/py-basics.html \
  --old "zh: '基础：值与输出' }" --new "zh: '基础：错的标题' }" --expect red --must-say 'TOOL.title 与注册表不同'
python3 $S/p1-negctl.py --root $W --gate registry.page_mirror_check --file python/tools/py-basics.html \
  --old '<meta name="tool-engine" content="py-1.0.0">' --new '<meta name="tool-engine" content="py-9.9.9">' \
  --expect red --must-say 'tool-engine meta 是'
python3 $S/p1-negctl.py --root $W --gate registry.page_mirror_check --file python/tools/_skeleton.html \
  --old '<meta name="tool-engine" content="py-1.0.0">' --new '<meta name="tool-engine" content="py-0.9.0">' \
  --expect red --must-say '_skeleton.html 的 tool-engine'
python3 $S/p1-negctl.py --root $W --gate registry.page_mirror_check --file python/tools/py-basics.html \
  --old 'var TOOL = {' --new 'var TOOL = {,' --expect red --must-say 'TOOL 块求值抛错'
```

Expected: 六行 `PASS`。最后一条守的是「TOOL 块坏了时门报具名错误而不是崩溃」：must-say 与「无 Traceback」同时成立才算 PASS。

- [ ] **Step 5: 提交**

```bash
git -C $W add python/scripts/gates/registry.py python/scripts/check.py
git -C $W commit -m "feat(python): page_mirror_check 守工具页 TOOL 块与 engine 镜像

TOOL.id / accent / title 与 tool-engine meta 必须等于注册表；全库 engine 唯一且与骨架同值。
TOOL 块在 node vm 里求值，不用正则抠字段。六个负控制均因断言失败而红。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git -C $W status --short
```

---
## Task 5: property 参照按章拆文件（设计 A4）

**Files:**
- Create: `python/scripts/gates/refs/__init__.py`
- Create: `python/scripts/gates/refs/_gen.py`
- Create: `python/scripts/gates/refs/ch01_basics.py`
- Modify: `python/scripts/gates/properties.py`
- Modify: `python/scripts/gates/library.py`（`algorithm_property_check` + 新 helper + import）

**Interfaces:**
- Produces:
  - `gates.refs.REFS_DIR: pathlib.Path`
  - `gates.refs.chapter_dir_name(stem: str) -> str`：`'ch05_files_errors'` → `'ch05-files-errors'`
  - `gates.refs.load_references() -> tuple[dict, dict, list]`：`(REFERENCES, SOURCES, ERRORS)`，**绝不抛**
  - `gates.properties.REFERENCES` / `REF_SOURCES` / `REF_ERRORS` / `SAMPLES` / `SEED`
  - `gates.refs._gen.rand_words(rng)` / `rand_triples(rng)`
  - `library._ref_chapter_mismatches(prog_chapter: dict, ref_sources: dict) -> list[str]`
- 约定（内容波次的构建者照此写）：章目录 `programs/chNN-<slug>/` 的参照写在 `gates/refs/chNN_<slug>.py`，模块级 `REFERENCES = {程序 id: {'ref': 可调用, 'cases': 生成器}}`。

- [ ] **Step 1: 基线——记下性质门现在的输出**

Run: `cd $W && python3 -c 'import sys; sys.path.insert(0,"python/scripts"); from gates import library as l; raise SystemExit(l.algorithm_property_check())'`
Expected: `性质比对：3 个程序 × 200 组实参 = 600 次调用，与独立参考实现全部一致（种子 20260916）`。拆分之后必须逐字相同（同一种子、同一生成器代码 = 同一实参流）。

- [ ] **Step 2: `refs/_gen.py`**

```python
"""各章参照共用的实参生成器。

从 properties.py 原样搬来，**逐字符不改**：门的可复现性建立在「同一种子 + 同一段
生成代码 = 同一条实参流」上，改一个字符（哪怕只是调换 choice 的字母表顺序）就换了
一条流，文件头里任何「实测 N 组不匹配」的数字都会跟着失效。
"""
import string


def rand_words(rng):
    return (''.join(rng.choice(string.ascii_letters + ' ') for _ in range(rng.randint(0, 30))),)


def rand_triples(rng):
    return (rng.randint(-50, 50), rng.randint(-50, 50), rng.randint(-50, 50))
```

- [ ] **Step 3: `refs/__init__.py`**

```python
"""property 参考实现，按章一个文件（第 1 期设计 §4 A4）。

为什么拆：第 1 期八页由并行构建者各自写，全都往 properties.REFERENCES 一个字典里加
条目，堆叠分支变基时必然冲突。一章一个文件，构建者只碰自己那一章。

文件名规则：章目录 `programs/ch05-files-errors/` ↔ `refs/ch05_files_errors.py`
（连字符换下划线，才是合法的模块名）。每个文件导出模块级 `REFERENCES` 字典。

`load_references()` **绝不抛**：library.py 在导入期就读它，这里一抛，check.py 连
`import` 都过不去，全部门一道都不跑——那正是 check.py 文件头「一道门抛异常不许带走
别的门」要防的形状。错误收进返回值，由 algorithm_property_check 当红报出来。
错误文本只记异常类型与消息、不记 traceback：负控制执行器把输出里出现 Traceback
当作「门自己崩了」，一条被正确捕获的错误不该长得像崩溃。
"""
from __future__ import annotations

import importlib
import pathlib

REFS_DIR = pathlib.Path(__file__).resolve().parent


def chapter_dir_name(stem: str) -> str:
    """refs 文件名（不含 .py）→ 章目录名：`ch01_basics` → `ch01-basics`。"""
    return stem.replace('_', '-')


def load_references():
    """返回 (REFERENCES, SOURCES, ERRORS)。

    REFERENCES：{程序 id: {'ref': …, 'cases': …}}
    SOURCES：   {程序 id: 登记它的文件名}
    ERRORS：    [错误文本]
    """
    refs: dict = {}
    sources: dict = {}
    errors: list = []
    for path in sorted(REFS_DIR.glob('ch*.py')):
        try:
            mod = importlib.import_module(f'{__name__}.{path.stem}')
        except Exception as exc:                          # noqa: BLE001
            errors.append(f'gates/refs/{path.name} 导入失败：{type(exc).__name__}: {exc}')
            continue
        table = getattr(mod, 'REFERENCES', None)
        if not isinstance(table, dict):
            errors.append(f'gates/refs/{path.name} 没有导出模块级 REFERENCES 字典')
            continue
        for pid, entry in table.items():
            if pid in refs:
                errors.append(f'程序 {pid!r} 的参照同时登记在 gates/refs/{sources[pid]} '
                              f'与 gates/refs/{path.name}')
                continue
            refs[pid] = entry
            sources[pid] = path.name
    return refs, sources, errors
```

- [ ] **Step 4: `refs/ch01_basics.py`**

把 `properties.py` 里 `REFERENCES = {...}` 的三条（连同每条上方的注释）**原样**搬进来，只改生成器名：

```python
"""ch01-basics 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红。
"""
from ._gen import rand_triples, rand_words

REFERENCES = {
    # 被测程序 id -> {'ref': 参考实现, 'cases': 实参生成器}
    'count-vowels-loop': {
        # 被测的是「索引循环 + 累加」，参考的是「生成式 + sum」：机制不同
        'ref': lambda s: sum(ch in 'aeiouAEIOU' for ch in s),
        'cases': rand_words,
    },
    'max-of-three-if': {
        # 被测的是手写的 if/elif/else 分支链，参考的是内置 max()：机制不同。
        # 实测能被它抓住的变异见 properties.py 文件头（交错变量 / 比错一对）；「漏等号」
        # 那一类抓不住，因为漏掉 `=` 之后落到的那一支返回的是一个相等的值。
        'ref': lambda a, b, c: max(a, b, c),
        'cases': rand_triples,
    },
    'max-of-three-builtin': {
        # 被测的是 max()，参考的是「排序取末位」：机制不同——绝不能拿 max 当
        # max() 自己的参照，那是拿自己验自己。实测抓得住的是「漏参数 / 用错内置
        # 函数」；「参数顺序写错」抓不住，因为 max 本来就与实参顺序无关。
        'ref': lambda a, b, c: sorted([a, b, c])[-1],
        'cases': rand_triples,
    },
}
```

搬完后 `diff` 三条 lambda 与原文件，确认逐字相同：

```bash
diff <(grep -E "'ref':" $W/python/scripts/gates/properties.py) <(grep -E "'ref':" $W/python/scripts/gates/refs/ch01_basics.py) && echo "ref lambdas identical"
```

- [ ] **Step 5: 改 `properties.py`**

文件头 docstring 保留，改两处：
1. 「裁决 R6：本表**按被测程序的 `id` 索引**…」那一段的开头改为：「裁决 R6：参照**按被测程序的 `id` 索引、按章分文件登记在 `gates/refs/chNN_<slug>.py`**（第 1 期设计 A4），不是按 property 族名。」其后的解释照留。
2. 「实测 500 条随机串」那一句后面追加一句：「（这 500 条的生成协议没有写下来，复评员用 `rand_words` + 本文件的种子复现出 475 / 414，见账本 §三.3——写协议，别写期望值。）」

docstring 之后的**全部代码**换成：

```python
from .refs import load_references

# 汇总各章文件。REF_ERRORS 非空时由 library.algorithm_property_check 报红——
# 这里不抛，理由见 gates/refs/__init__.py 文件头。
REFERENCES, REF_SOURCES, REF_ERRORS = load_references()

SAMPLES = 200
SEED = 20260916          # 固定种子：门必须逐次可复现
```

- [ ] **Step 6: 改 `library.py`**

import 区：`import os` 旁加 `import pathlib`；`from . import properties` 下一行加 `from . import refs`。

`algorithm_property_check()` 之前加：

```python
def _ref_chapter_mismatches(prog_chapter: dict, ref_sources: dict) -> list:
    """参照所在的章文件必须对应程序所在的章目录。纯函数，负控制直接喂合成数据。

    prog_chapter：{程序 id: 章目录名}（只含带 check.property 的程序）
    ref_sources： {程序 id: refs 文件名}
    """
    out = []
    for pid, fname in sorted(ref_sources.items()):
        home = prog_chapter.get(pid)
        if home is None:
            continue                     # 程序不存在由「反方向」那条报
        want = refs.chapter_dir_name(pathlib.PurePath(fname).stem)
        if want != home:
            out.append(f'程序 {pid!r} 在 programs/{home}/，参照却登记在 gates/refs/{fname}'
                       f'（那个文件对应 programs/{want}/）')
    return out
```

在 `algorithm_property_check()` 里：

1. `with_property = set()` 下一行加 `prog_chapter = {}`；`with_property.add(prog.get('id'))` 下一行加 `prog_chapter[prog.get('id')] = chapter_dir.name`。
2. 「有 check.property 却没登记参照」那条报错改为：

```python
            print(f'ERROR: {name} 有 check.property={prop!r}，但 gates/refs/ 里没有它的参考实现'
                  f'（应写在 gates/refs/{chapter_dir.name.replace("-", "_")}.py）。\n'
                  f'       参照按**程序 id** 登记（R6），不能跟同族的别的程序共用一份。',
                  file=sys.stderr)
```

3. 「反方向」那条报错里的 `gates/properties.py 的 REFERENCES 里有 {stale!r} 的参考实现` 改为 `gates/refs/{properties.REF_SOURCES.get(stale)} 里有 {stale!r} 的参考实现`。
4. 在「反方向」循环之后、`if checked == 0 and rc == 0:` 之前加：

```python
    for err in properties.REF_ERRORS:
        print(f'ERROR: {err}', file=sys.stderr)
        rc = 1
    chapter_names = {d.name for d, _ in load_chapters()}
    for path in sorted(refs.REFS_DIR.glob('ch*.py')):
        want_dir = refs.chapter_dir_name(path.stem)
        if want_dir not in chapter_names:
            print(f'ERROR: gates/refs/{path.name} 对不上任何章目录（期望 programs/{want_dir}/）'
                  f'——这个文件里的参照永远找不到程序', file=sys.stderr)
            rc = 1
    for msg in _ref_chapter_mismatches(prog_chapter, properties.REF_SOURCES):
        print(f'ERROR: {msg}', file=sys.stderr)
        rc = 1
```

- [ ] **Step 7: 输出逐字不变**

Run: Step 1 的同一条命令。
Expected: 与 Step 1 **逐字相同**的那一行，`rc=0`。

- [ ] **Step 8: 负控制**

```bash
# (a) 对不上章目录的 refs 文件
python3 $S/p1-negctl.py --root $W --gate library.algorithm_property_check \
  --create python/scripts/gates/refs/ch99_nothing.py --content 'REFERENCES = {}' \
  --expect red --must-say '对不上任何章目录'
# (b) 同一个 id 登记在两个文件
python3 $S/p1-negctl.py --root $W --gate library.algorithm_property_check \
  --create python/scripts/gates/refs/ch01_basics_dup.py \
  --content $'from ._gen import rand_triples\nREFERENCES = {"max-of-three-if": {"ref": max, "cases": rand_triples}}' \
  --expect red --must-say '同时登记在'
# (c) 指向不存在程序的参照
python3 $S/p1-negctl.py --root $W --gate library.algorithm_property_check \
  --file python/scripts/gates/refs/ch01_basics.py \
  --old 'REFERENCES = {' --new $'REFERENCES = {\n    \'no-such-program\': {\'ref\': max, \'cases\': rand_triples},' \
  --expect red --must-say "'no-such-program' 的参考实现"
# (d) refs 文件导入失败：门红、具名、不崩
python3 $S/p1-negctl.py --root $W --gate library.algorithm_property_check \
  --file python/scripts/gates/refs/ch01_basics.py \
  --old 'from ._gen import' --new 'from ._nope import' \
  --expect red --must-say '导入失败：ModuleNotFoundError'
```

(e) 章归属 helper 用合成数据，正反两例：

```bash
python3 - <<'EOF'
import sys
sys.path.insert(0, '/Users/nickma/Develop/My2ndBrain/MathViz/.claude/worktrees/python-phase1/python/scripts')
from gates import library
assert library._ref_chapter_mismatches({'a': 'ch01-basics'}, {'a': 'ch01_basics.py'}) == []
assert library._ref_chapter_mismatches({}, {'a': 'ch01_basics.py'}) == []
bad = library._ref_chapter_mismatches({'a': 'ch02-strings'}, {'a': 'ch01_basics.py'})
assert len(bad) == 1 and 'programs/ch02-strings/' in bad[0] and 'programs/ch01-basics/' in bad[0], bad
multi = library._ref_chapter_mismatches({'a': 'ch05-files-errors'}, {'a': 'ch05_files_errors.py'})
assert multi == [], multi   # 多段 slug 的连字符/下划线换算
print('章归属 helper：同章 0 条、异章 1 条、多段 slug 0 条')
EOF
```

Expected: 四行 `PASS` + `章归属 helper：同章 0 条、异章 1 条、多段 slug 0 条`。

- [ ] **Step 9: 全量与提交**

```bash
python3 $W/python/scripts/check.py 2>&1 | tail -1
git -C $W add python/scripts/gates/refs/__init__.py python/scripts/gates/refs/_gen.py \
  python/scripts/gates/refs/ch01_basics.py python/scripts/gates/properties.py python/scripts/gates/library.py
git -C $W commit -m "refactor(python): property 参照按章拆到 gates/refs/

八页并行构建会让 properties.REFERENCES 一个字典成为冲突点。一章一个文件；加载器
绝不抛（否则 check.py 导入即崩、全部门不跑）。新增三种硬错误：同 id 两处登记、
refs 文件对不上章目录、参照与程序不在同一章。性质门输出与拆分前逐字相同。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git -C $W status --short
```

Expected: `36 道门全绿（…）。`；状态为空（`__pycache__` 不应出现；若出现，确认它被 `.gitignore` 覆盖，不要提交）。

---

## Task 6: CI pin Python，PR-A 验收与开 PR（设计 A5）

**Files:**
- Modify: `.github/workflows/registry-sync.yml`

- [ ] **Step 1: 加 `setup-python`**

在 `actions/setup-node@v4` 那一步之后插入：

```yaml
      # R19：lex_vs_cpython_check 拿 CPython 的 tokenize 当裁判，而 PEP 701 让 3.12
      # 与 3.11 对 f-string 给出不同形状。不 pin 时 CI 用的是 ubuntu-latest 自带的
      # python3（第 1 期开工时实测 3.12.3）——镜像一升级，裁判就悄悄换人。
      # 第 0 期的裁决写着「CI 里 pin 一个版本」，但没有落地，这一步补上。
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
```

Run: `python3 -c "import yaml" 2>/dev/null && python3 -c "import yaml,sys; yaml.safe_load(open('$W/.github/workflows/registry-sync.yml')); print('yaml OK')" || ruby -ryaml -e "YAML.load_file('$W/.github/workflows/registry-sync.yml'); puts 'yaml OK'"`
Expected: `yaml OK`

- [ ] **Step 2: PR-A 全量验收（设计 §10）**

```bash
cd $W && bash -c '
for c in "python3 python/scripts/check.py" "python3 scripts/check_nav_contract.py" "python3 scripts/sync_registry.py --check" \
         "python3 scripts/apply_branding.py --check" "python3 scripts/apply_footer.py --check" "python3 chess/scripts/check.py" \
         "python3 cryptography/scripts/check.py" "python3 python/scripts/inline_core.py --check" \
         "python3 python/scripts/build_programs.py --check" "python3 python/scripts/sync_fallback.py --check"; do
  out=$(eval "$c" 2>&1); rc=$?; echo "rc=$rc :: $c :: $(echo "$out" | tail -1 | cut -c1-120)"
done
for f in python/core/*.test.js; do node "$f" >/dev/null 2>&1; echo "rc=$? :: node $f"; done'
```

Expected: 全部 `rc=0`；check.py 行为 `36 道门全绿（生成 3 · A 8 · B 6 · C 3 · D·库 12 · D·词法 4）。`

- [ ] **Step 3: 提交 CI**（本计划文件在写成时已单独提交）

```bash
git -C $W add .github/workflows/registry-sync.yml
git -C $W commit -m "ci: pin Python 3.12（R19 写了但没落地）

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git -C $W status --short
git -C $W log --oneline origin/main..HEAD
```

Expected: 状态为空；log 列出设计、计划、Task 1–5 的提交。

- [ ] **Step 4: 推送并开 PR**

```bash
git -C $W push -u origin claude/python-phase1-design
cd $W && gh pr create --base main --head claude/python-phase1-design \
  --title "python 第 1 期 · PR-A：FALLBACK 生成、镜像门、参照按章拆分、CI pin Python" \
  --body "$(cat <<'BODY'
第 1 期设计 `docs/superpowers/specs/2026-09-16-python-phase1-design.md` §4 的 A1–A6，外加设计文档与地基实施计划本身。**不碰 core、不碰内容。**

## 改了什么
- **A1** `python/scripts/sync_fallback.py`：两个导航页的 FALLBACK 改为 `GENERATED:FALLBACK` 区段，从注册表生成（`index.html` 多带 `desc`，离线画廊也有简介）。`fallback_check` / `fallback_version_check` 改为 JSON 逐字段比对。钩子在改注册表或导航页时也重新生成。
- **A2** accent 按主规格 §6.1 的模块配色表校验，并对表本身做相邻异色断言。
- **A3** 新门 `page_mirror_check`：工具页 `TOOL.id/accent/title` 与 `tool-engine` 必须等于注册表，engine 全库唯一且与骨架同值。
- **A4** property 参照按章拆到 `gates/refs/chNN_<slug>.py`，为八页并行构建去掉冲突点。
- **A5** CI 加 `actions/setup-python`，pin 3.12（R19 写了但没落地）。
- **A6** `check.py` 按组自数门，散文里不再写死门数。

门数 34 → 36。每道新门与改过的门都做了负控制（基线绿 → 破坏 → 因断言失败而红 → 从内存原字节复原）。

## 验证
- [x] 设计 §10 的全量验收命令本机全绿
- [x] `file://` 打开 `python/index.html`：离线卡片显示简介；`python/app.html` 侧栏正常
- [ ] CI 日志里 `lex_vs_cpython_check` 的 Python 版本不再是 3.12.3

合并顺序：本 PR 先合，PR-B（core 规则、ch01 补空、元数据面板、作者须知）从合并后的 main 切出。

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```

- [ ] **Step 5: 实际读 CI**

```bash
cd $W && PR=$(gh pr view --json number -q .number) && gh pr checks $PR --watch --interval 30
RUN=$(gh run list --branch claude/python-phase1-design --workflow registry-sync.yml --limit 1 --json databaseId -q '.[0].databaseId')
gh run view $RUN --log | grep -E 'setup-python|lex_vs_cpython_check 跑在|道门全绿|道门红了'
```

Expected: checks 全部 `pass`；日志里有 setup-python 步骤；`lex_vs_cpython_check 跑在 CPython 3.12.x 上` 的 x **不是 3**（不是就说明 pin 没生效，停下查）；`36 道门全绿`。

若 CI 红：读完整日志定位，不要重跑碰运气。修复作为新提交推上去，再读一遍。

- [ ] **Step 6: 交给用户**

向用户报告 PR 链接、CI 结论（附 Python 版本那一行）、负控制汇总。**等用户说合并。** 合并后：

```bash
cd /Users/nickma/Develop/My2ndBrain/MathViz && git fetch origin -q && git -C .claude/worktrees/python-phase1 status --short
git push origin --delete claude/python-phase1-design
git worktree remove .claude/worktrees/python-phase1 && git branch -D claude/python-phase1-design
```

（`gh pr merge` 由用户确认后执行；本仓没有分支保护，合并前必须先读 `gh pr checks`。）

---
# PR-B · 地基·规则

**前置：PR-A 已合并进 main。** 从这里起 `W=/Users/nickma/Develop/My2ndBrain/MathViz/.claude/worktrees/python-phase1-rules`。

## Task 7: 提示分级标记改为 ` || `（设计 B1）

**Files:**
- Modify: `python/core/interact.js`（`HINT_SEPS` → `HINT_MARK` / `HINT_JOIN`，`hintAt`，导出）
- Modify: `python/core/interact.test.js`（分级提示那一段）
- Modify: `python/scripts/gates/library.py`（`HINT_SEPS` → `HINT_MARK`、`_hint_parts`、`_check_attrs`）
- Modify: `python/programs/ch01-basics/{divmod-and-floor,count-vowels-loop,max-of-three-if}.py`
- Regenerate: `python/tools/py-basics.html`、`python/tools/_skeleton.html`

**Interfaces:**
- Produces:
  - `PyInteract.HINT_MARK === ' || '`（导出，Task 10 的镜像门读它）
  - `hintAt(blank, tier, lang)`：按 `HINT_MARK` 切；展开的几级之间用 `' · '` 连接给使用者看
  - `library.HINT_MARK = ' || '`

- [ ] **Step 0: 开 PR-B 的 worktree**

```bash
cd /Users/nickma/Develop/My2ndBrain/MathViz && git fetch origin -q
git worktree add -b claude/python-phase1-rules .claude/worktrees/python-phase1-rules origin/main
W=/Users/nickma/Develop/My2ndBrain/MathViz/.claude/worktrees/python-phase1-rules
git -C $W log --oneline -3 && git -C $W config core.hooksPath && python3 $W/python/scripts/check.py 2>&1 | tail -1
```

Expected: 最新提交是 PR-A 的合并；`hooksPath` 为 `.githooks`；`36 道门全绿`。

- [ ] **Step 1: 改测试（先红）**

`interact.test.js` 里 `/* 分级提示 */` 那个 IIFE 整个换成：

```js
/* 分级提示：唯一的分级标记是 ' || '（第 1 期设计 B1） */
(function () {
  const blank = { level: 3, hint: '中一 || 中二 || 中三', hintEn: 'en1 || en2 || en3' };
  T.ok(PI.hintAt(blank, 1, 'en').length > 0, '第一级有内容');
  T.ok(PI.hintAt(blank, 3, 'zh').indexOf('中三') !== -1, '第三级到底');
  T.eq(PI.hintAt(blank, 9, 'zh'), PI.hintAt(blank, 3, 'zh'), '超过 level 就钳到 level');

  /* 上面三条**都挡不住**"任何 tier 都把整条提示端出去"这一种坏：第一条只看长度、
     第三条两边同样退化成整条。分级的全部意义在于"第一级看不到第三级"。 */
  T.eq(PI.hintAt(blank, 1, 'zh'), '中一', '第一级**只**给第一段');
  T.ok(PI.hintAt(blank, 2, 'zh').indexOf('中三') === -1, '第二级看不到第三级');
  T.eq(PI.hintAt(blank, 0, 'zh'), '', '一级都没点开时什么都不给');
  T.eq(PI.hintAt(blank, 2, 'zh'), '中一 · 中二', '展开的几级用 · 连接——源码里的 || 是出题标记，不给她看');
  T.eq(PI.HINT_MARK, ' || ', '导出的分级标记');

  /* 旧的三分隔符链（' · ' / '；' / '; '）从此是普通标点。下面三条在旧实现下都会红：
     旧 hintAt 会把 level=1 的提示按标点切开、只给前半句——后半句被静默截掉。 */
  const semi = { level: 1, hint: '先拆 rest；再拆 total', hintEn: 'cut rest; then total' };
  T.eq(PI.hintAt(semi, 1, 'zh'), '先拆 rest；再拆 total', '「；」是标点，不是分级');
  T.eq(PI.hintAt(semi, 1, 'en'), 'cut rest; then total', '「; 」是标点，不是分级');
  const dot = { level: 1, hint: 'a · b', hintEn: 'a · b' };
  T.eq(PI.hintAt(dot, 1, 'en'), 'a · b', '「 · 」也不再是分级');

  /* 作者没有按标记分级时，整条给出去，而不是给空串。这是 hintAt 的**兜底**，不是
     允许的数据形状：blank_directive_check 要求段数 == level。 */
  const flat = { level: 2, hint: '只有一句话', hintEn: 'just one sentence' };
  T.eq(PI.hintAt(flat, 1, 'zh'), '只有一句话', '没有标记时第一级就是整条');
})();
```

Run: `node $W/python/core/interact.test.js; echo "rc=$?"`
Expected: `rc=1`，失败项包括 `「；」是标点，不是分级`、`导出的分级标记`、`第一级**只**给第一段`。

- [ ] **Step 2: 改 `hintAt`**

`interact.js` 里从 `/* hintAt(blank, tier, lang) → string` 注释开始、到 `hintAt` 函数结束，整段换成：

```js
  /* hintAt(blank, tier, lang) → string

     一个空的提示是一条字符串里用 HINT_MARK（' || '）分好的若干级，点一次展开一级：
     tier=1 只给第一段，tier=2 给前两段，超过 level（或超过实际段数）就钳住。
     展开的几级之间用 HINT_JOIN（' · '）连接——' || ' 是写在 .py 指令行里的出题标记，
     不是给她看的标点。

     为什么是一个显式标记而不是标点（第 1 期设计 B1）：第 0 期按 ' · ' / '；' / '; '
     三者中第一个出现的切分，于是正文里不能随手用分号——level=1 的提示里只要出现
     一个「；」，后半句就被静默截掉。Python 没有 || 运算符，正文几乎不会写到它。

     没有标记就是"这条提示只有一级"——**整条给出去**，而不是给空串：作者没分级
     不等于她点了提示却什么都看不到。 */
  var HINT_MARK = ' || ';
  var HINT_JOIN = ' · ';

  function hintAt(blank, tier, lang) {
    var b = blank || {};
    var raw = (lang === 'en') ? b.hintEn : b.hint;
    if (typeof raw !== 'string' || raw === '') { return ''; }

    var parts = raw.split(HINT_MARK);
    var level = (typeof b.level === 'number' && b.level > 0) ? b.level : parts.length;
    var cap = Math.min(level, parts.length);
    var n = Math.min((typeof tier === 'number') ? tier : 0, cap);
    if (n < 1) { return ''; }
    return parts.slice(0, n).join(HINT_JOIN);
  }
```

导出对象里 `hintAt: hintAt,` 下一行加 `HINT_MARK: HINT_MARK,`。

Run: `node $W/python/core/interact.test.js; echo "rc=$?"`
Expected: `interact: N 条断言全部通过`，`rc=0`。

- [ ] **Step 3: 改门（ch01 现有提示会让它红）**

`library.py`：把 `HINT_SEPS = (' · ', '；', '; ')` 及其上方两行注释换成：

```python
# core/interact.js 的 HINT_MARK（第 1 期设计 B1）。两边各存一份，
# 由 syntax.closed_set_mirror_check 比对（Task 10）。
HINT_MARK = ' || '
```

`_hint_parts` 换成：

```python
def _hint_parts(raw: str) -> int:
    """一条提示按 `hintAt()` 的规则切出几段：按 HINT_MARK 切。

    `hintAt` 拿到的是**未转义**的正则捕获组，所以这里也不做反转义——两边看的必须是
    同一串字符。没有标记 = 一段。
    """
    return len(raw.split(HINT_MARK))


def _stray_marks(raw: str) -> int:
    """出现了 `||` 却不是「两侧各一个空格」的形状的次数——十有八九是写错的分级标记。"""
    return raw.count('||') - raw.count(HINT_MARK)
```

`_check_attrs` 里，`for field, m in (('hint', hint_m), ('hintEn', hint_en_m)):` 循环体的 `parts = _hint_parts(m.group(1))` **之前**插入：

```python
            stray = _stray_marks(m.group(1))
            if stray:
                print(f'ERROR: {name}:{line_no} 的 {field} 里有 {stray} 处疑似写错的分级标记——'
                      f'分级标记必须写成两侧各一个空格的 {HINT_MARK!r}：{py_path}:{line_no}\n'
                      f'       {field}={m.group(1)!r}', file=sys.stderr)
                rc = 1
                continue
```

同一循环里报段数不符的那条，把

```python
            seps = '、'.join(repr(x) for x in HINT_SEPS)
```

删掉，并把消息里 `分隔符按 core/interact.js 的 HINT_SEPS 依次找，取第一个出现过的：{seps}` 换成 `分级标记是 {HINT_MARK!r}（与 core/interact.js 的 HINT_MARK 同值）`。docstring 里提到 `；` 与分隔符链的句子改成描述 ` || ` 标记。

Run: `cd $W && python3 -c 'import sys; sys.path.insert(0,"python/scripts"); from gates import library as l; raise SystemExit(l.blank_directive_check())'; echo "rc=$?"`
Expected: `rc=1`，恰好 6 行 `切出 1 段，但 level=2`（3 个程序 × hint / hintEn）。这是这道门在真实数据上的红，记进报告。

- [ ] **Step 4: 迁移 ch01 的三条提示**

```bash
python3 - <<'EOF'
import pathlib, re
W = pathlib.Path('/Users/nickma/Develop/My2ndBrain/MathViz/.claude/worktrees/python-phase1-rules')
for f in ('divmod-and-floor.py', 'count-vowels-loop.py', 'max-of-three-if.py'):
    p = W / 'python/programs/ch01-basics' / f
    src = p.read_text(encoding='utf-8')
    out = []
    for line in src.split('\n'):
        if line.startswith('# >>> BLANK'):
            hm = re.search(r'\bhint="([^"]*)"', line)
            em = re.search(r'\bhintEn="([^"]*)"', line)
            assert hm and em, (f, line)
            assert hm.group(1).count('；') == 1 and ' · ' not in hm.group(1), (f, hm.group(1))
            assert em.group(1).count('; ') == 1 and ' · ' not in em.group(1), (f, em.group(1))
            line = line.replace(hm.group(0), 'hint="' + hm.group(1).replace('；', ' || ') + '"')
            line = line.replace(em.group(0), 'hintEn="' + em.group(1).replace('; ', ' || ') + '"')
        out.append(line)
    new = '\n'.join(out)
    assert new != src, f
    p.write_text(new, encoding='utf-8')
    print('migrated', f)
EOF
grep -h '# >>> BLANK' $W/python/programs/ch01-basics/*.py
```

Expected: 三行 `migrated`；三条指令行里 `hint` 与 `hintEn` 各含一个 ` || `。若某条断言失败（分号不止一个），停下上报，不要猜哪一个是分级位置。

- [ ] **Step 5: 重新生成并跑门**

```bash
python3 $W/python/scripts/build_programs.py && python3 $W/python/scripts/inline_core.py
python3 $W/python/scripts/check.py 2>&1 | tail -1
```

Expected: `36 道门全绿（…）。`

- [ ] **Step 6: 负控制**

```bash
F=python/programs/ch01-basics/divmod-and-floor.py
# (a) 正控制：level=1 的提示正文里写「；」——现在应该绿（改之前是红）
python3 $S/p1-negctl.py --root $W --gate library.blank_directive_check --file $F \
  --old 'level=2' --new 'level=1' --old ' || ' --new '；' --count 1 --count 2 \
  --expect green --must-say 'BLANK 指令'
# (b) level=2 却没有标记
python3 $S/p1-negctl.py --root $W --gate library.blank_directive_check --file $F \
  --old ' || ' --new ' ' --count 2 --expect red --must-say '切出 1 段，但 level=2'
# (c) 标记少了空格
python3 $S/p1-negctl.py --root $W --gate library.blank_directive_check --file $F \
  --old ' || ' --new '||' --count 2 --expect red --must-say '疑似写错的分级标记'
# (d) 实现退回旧的分号切法、门不动：core 测试红
python3 $S/p1-negctl.py --root $W --gate 'cmd:node python/core/interact.test.js' --file python/core/interact.js \
  --old 'var parts = raw.split(HINT_MARK);' --new "var parts = raw.split('；');" \
  --expect red --must-say '「；」是标点，不是分级'
```

Expected: 四行 `PASS`。

- [ ] **Step 7: 提交**

```bash
git -C $W add python/core/interact.js python/core/interact.test.js python/scripts/gates/library.py \
  python/programs/ch01-basics/divmod-and-floor.py python/programs/ch01-basics/count-vowels-loop.py \
  python/programs/ch01-basics/max-of-three-if.py python/tools/py-basics.html python/tools/_skeleton.html
git -C $W commit -m "feat(python): 提示分级标记改为 ' || '

旧的 ' · ' / '；' / '; ' 链让正文不能用分号：level=1 的提示里一个「；」就会让后半句
被静默截掉。改为唯一显式标记；展开的几级用 · 连接展示。门另抓写错的 ||。
ch01 三条提示迁移；改门之后、迁移之前，门在真实数据上红了 6 行。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git -C $W status --short
```

Expected: 状态为空（钩子重跑了生成脚本；若它额外暂存了路径，逐行确认都是本任务的）。

---

## Task 8: 装饰器配色与 token 类型核对（设计 B2）

**Files:**
- Modify: `python/core/py-lex.js`（导出 `TYPES`）
- Modify: `python/core/interact.js`（`.tok-decorator` 规则；导出 `STYLE_CSS`）
- Modify: `python/core/interact.test.js`（新测试段）
- Regenerate: `python/tools/py-basics.html`、`python/tools/_skeleton.html`

**Interfaces:**
- Produces: `PyLex.TYPES: string[]`；`PyInteract.STYLE_CSS: string`

- [ ] **Step 1: 写测试（先红）**

`interact.test.js` 末尾 `T.report('interact');` 之前加：

```js
/* token 类型 × 配色（第 1 期设计 B2）：每个类型要么有 .tok-<type> 规则，要么在
   显式的不上色名单里。第 0 期 decorator 这个类型是专为高亮合成的（CPython 没有它），
   R14 整套裁决都为它服务——而它没有任何 CSS 规则，@property / @dataclass 一直是白字。 */
(function () {
  const PyLex = require('./py-lex.js');
  const CORPUS = [
    '@dataclass\nclass P:\n    x: int = 0\n',
    '@property\ndef area(self) -> float:\n    return self.w * self.h  # note\n',
    'm = a @ b\n',
    's = f"{name!r:>10}" + r"\\d" + b"x" + """doc"""\n',
    'n = 0x1f + 1_000 + 1.5j\n',
    'match cmd:\n    case "go":\n        pass\n    case _:\n        print(len(cmd))\n',
    'total = a \\\n    + b\n',
    'if (y := 3):\n    z = [i for i in range(y)]\n'
  ].join('');
  const UNCOLORED = {
    ws: '空白：透出底色即可',
    nl: '换行：不可见'
  };

  T.ok(Array.isArray(PyLex.TYPES) && PyLex.TYPES.length > 0, 'PyLex.TYPES 是非空数组');
  const types = Array.isArray(PyLex.TYPES) ? PyLex.TYPES : [];
  const seen = {};
  PyLex.tokenize(CORPUS).forEach(function (tk) { seen[tk.type] = true; });
  Object.keys(seen).forEach(function (ty) {
    T.ok(types.indexOf(ty) !== -1, '词法器吐出的类型 ' + ty + ' 登记在 PyLex.TYPES 里');
  });
  T.ok(seen.decorator === true, '语料里真的切出了 decorator（否则下面对它的断言无话可说）');

  const styled = {};
  String(PI.STYLE_CSS || '').replace(/\.tok-([a-z]+)/g, function (m, ty) { styled[ty] = true; return m; });
  types.forEach(function (ty) {
    T.ok(styled[ty] === true || Object.prototype.hasOwnProperty.call(UNCOLORED, ty),
         'token 类型 ' + ty + ' 要么有 .tok-' + ty + ' 配色，要么在不上色名单里');
  });
  Object.keys(UNCOLORED).forEach(function (ty) {
    T.ok(types.indexOf(ty) !== -1, '不上色名单里的 ' + ty + ' 必须是真实类型（名单不许过期）');
  });
})();
```

Run: `node $W/python/core/interact.test.js; echo "rc=$?"`
Expected: `rc=1`，失败项含 `PyLex.TYPES 是非空数组`。

- [ ] **Step 2: `py-lex.js` 导出 `TYPES`**

导出对象上方加：

```js
  /* 词法器可能吐出的全部 token 类型（闭集）。editor.js 把它们映射成 tok-<type> 类名；
     interact.test.js 逐项核对每个类型都有配色或被显式列为不上色。 */
  var TYPES = ['ws', 'nl', 'comment', 'decorator', 'number', 'string', 'fstring',
               'keyword', 'softkw', 'builtin', 'name', 'op', 'punct'];
```

导出对象加 `TYPES: TYPES,`。然后核对列表完整：`grep -n "push('\|type = \|? '" $W/python/core/py-lex.js`，逐个确认每个可能的类型字面量都在 `TYPES` 里；少了就补，并在报告里写明。

- [ ] **Step 3: `interact.js` 加配色、导出样式表**

样式表里

```js
    '.tok-builtin{color:#67e8f9}.tok-softkw{color:#a5b4fc}.tok-name{color:#e2e8f0}',
```

换成

```js
    '.tok-builtin{color:#67e8f9}.tok-softkw{color:#a5b4fc}.tok-name{color:#e2e8f0}',
    '.tok-decorator{color:#fda4af}',
```

（颜色若与现有八色难以区分，可换，但要在报告里说明对比了什么。）导出对象加 `STYLE_CSS: CSS,`。

Run: `node $W/python/core/interact.test.js && node $W/python/core/py-lex.test.js; echo "rc=$?"`
Expected: 两个文件都 `全部通过`，`rc=0`。

- [ ] **Step 4: 负控制**

```bash
python3 $S/p1-negctl.py --root $W --gate 'cmd:node python/core/interact.test.js' --file python/core/interact.js \
  --old "    '.tok-decorator{color:#fda4af}'," --new '' --expect red --must-say 'token 类型 decorator 要么有'
python3 $S/p1-negctl.py --root $W --gate 'cmd:node python/core/interact.test.js' --file python/core/py-lex.js \
  --old "push('decorator', start, i);" --new "push('deco', start, i);" --expect red --must-say '类型 deco 登记在'
python3 $S/p1-negctl.py --root $W --gate 'cmd:node python/core/interact.test.js' --file python/core/py-lex.js \
  --old "var TYPES = ['ws', 'nl', " --new "var TYPES = ['nl', " --expect red --must-say '不上色名单里的 ws'
```

Expected: 三行 `PASS`（若你在 Step 3 换了颜色，第一条的 `--old` 跟着改）。

- [ ] **Step 5: 生成、全量、提交**

```bash
python3 $W/python/scripts/inline_core.py && python3 $W/python/scripts/check.py 2>&1 | tail -1
git -C $W add python/core/py-lex.js python/core/interact.js python/core/interact.test.js \
  python/tools/py-basics.html python/tools/_skeleton.html
git -C $W commit -m "fix(python): 装饰器配色，并让每个 token 类型都有配色或显式不上色

.tok-decorator 在第 0 期漏掉了。修的是这一类：PyLex 导出闭集 TYPES，测试逐项核对
配色或不上色名单，并核对语料里真的切出了 decorator。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git -C $W status --short
```

---
## Task 9: 行注锚点解禁 + 结构门 `line_note_reader_check`（设计 B6）

**Files:**
- Modify: `python/scripts/gates/library.py`（`anchor_check` 删一条判据；删 `_blank_body_lines`）
- Modify: `python/scripts/gates/hygiene.py`（新门 + import `core_modules`）
- Modify: `python/scripts/check.py`（B 组加一行）

**Interfaces:**
- Produces: `hygiene.line_note_reader_check() -> int`；`hygiene.LINE_NOTE_READERS = ('panelLineNotes', 'noteLineIndex')`

- [ ] **Step 1: 先证明旧判据在，再拆**

```bash
python3 $S/p1-negctl.py --root $W --gate library.anchor_check --file python/programs/ch01-basics/chapter.json \
  --old '"at": "    hours, rest = divmod(total, 3600)"' --new '"at": "    minutes = rest // 60"' \
  --expect red --must-say '挖空体内'
```

Expected: `PASS`（锚点移进挖空体，旧门红）。

- [ ] **Step 2: 改 `anchor_check`**

`library.py`：
1. 删除 `def _blank_body_lines(lines: list) -> set:` 整个函数（先 `grep -rn _blank_body_lines $W/python/scripts` 确认只有 `anchor_check` 一处调用）。
2. `anchor_check()` 里删掉 `body = _blank_body_lines(lines)` 一行，以及 `# ① 行注不许锚在挖空体里` 注释开头的整个 `if is_note and (hits[0] - 1) in body:` 块。`is_note` 变量若不再被使用，连同 `targets` 元组里的第三个元素一起去掉。
3. docstring 的第一句改为「`lineNotes.at` / `chunks.from` / `chunks.to` 的整行原文在源码里存在且唯一，**在 `clean()` 之后仍然存在且唯一**。」；原 ① 段整段换成：

```
    **行注可以锚在挖空体内**（第 1 期设计 D7）。第 0 期这里禁止它（最终评审 I1）：
    面板曾在挖空模式照样打印 `note.at` 的整行原文。那个泄题现在由两道防线挡：
    `panelLineNotes` 的模式白名单（只有读模式给行注，interact.test.js 钉着），以及
    hygiene.line_note_reader_check（全仓只有两个函数能读 lineNotes）。数据层的禁令
    在「每程序 ≥ 1 空」之后代价太高——值得讲解的行通常正是值得挖掉的行，ch01 待补空
    的 7 个程序里有 5 个就是这样。
```

   原 ② 段改编号为 ①。
4. 成功消息去掉 `，且没有一条行注锚在挖空体内`。

- [ ] **Step 3: 写新门**

`hygiene.py` 的 `from . import (...)` 加入 `core_modules`。在 `lazy_dep_check` 之后加：

```python
LINE_NOTE_READERS = ('panelLineNotes', 'noteLineIndex')
LINE_NOTE_READ_RE = re.compile(r"\.\s*lineNotes\b|\[\s*['\"]lineNotes['\"]\s*\]")


def _function_span(code: str, name: str):
    """在已剥注释的代码里找 `function name(` 的函数体区间 [起, 止)；找不到返回 None。

    只数花括号，跳过字符串字面量。两个目标函数体内没有正则字面量；若将来有了、
    又恰好含未配对的花括号，这里会切错区间——门会因「允许的函数里一处读取都没有」
    或「读取落在函数外」而红，不会静默放行。
    """
    m = re.search(r'\bfunction\s+' + re.escape(name) + r'\s*\(', code)
    if not m:
        return None
    start = code.find('{', m.end())
    if start < 0:
        return None
    depth = 0
    quote = None
    i = start
    n = len(code)
    while i < n:
        c = code[i]
        if quote:
            if c == '\\':
                i += 2
                continue
            if c == quote:
                quote = None
        elif c in '\'"`':
            quote = c
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return start, i + 1
        i += 1
    return None


def line_note_reader_check() -> int:
    """core/ 里读取 `lineNotes` 属性的地方只能在 `panelLineNotes` 与 `noteLineIndex` 两个函数体内。

    第 1 期设计 D7 解禁了「行注锚在挖空体内」，于是泄题的第二道防线从数据层挪到
    读取点：面板把 `note.at` 的整行原文逐字打出来，而锚可以落在挖空体里。
    `panelLineNotes` 按模式白名单决定给不给（只有读模式给）；`noteLineIndex` 只把锚
    换算成行号、在读模式的文档渲染里点小圆点，不输出正文。任何别处直接读
    `p.lineNotes`，都是绕过白名单的一条新路——这道门让它当场红。

    **先剥注释再扫**（R47）：interact.js 的注释里会提到 lineNotes；i18n 键
    `lineNotes:` 与 `t('lineNotes', …)` 不是属性读取，正则也不匹配它们。
    """
    rc = 0
    reads = 0
    hits = {name: 0 for name in LINE_NOTE_READERS}
    saw_interact = False
    for path in core_modules():
        code = strip_js_comments(read_text(path))
        spans = {}
        if path.name == 'interact.js':
            saw_interact = True
            for name in LINE_NOTE_READERS:
                span = _function_span(code, name)
                if span is None:
                    print(f'ERROR: core/interact.js 里找不到允许读取 lineNotes 的函数 {name}()'
                          f'——改名了就同步改 LINE_NOTE_READERS', file=sys.stderr)
                    rc = 1
                else:
                    spans[name] = span
        for m in LINE_NOTE_READ_RE.finditer(code):
            reads += 1
            owner = next((nm for nm, (a, b) in spans.items() if a <= m.start() < b), None)
            if owner is None:
                line = code[:m.start()].count('\n') + 1
                print(f'ERROR: core/{path.name}:{line} 直接读取了 lineNotes——只允许在 '
                      f'{" / ".join(LINE_NOTE_READERS)} 里读。行注的原文会泄露挖空答案，'
                      f'要给行注请经过 panelLineNotes(program, mode)。', file=sys.stderr)
                rc = 1
            else:
                hits[owner] += 1
    if not saw_interact:
        print('ERROR: core_modules() 里没有 interact.js——这道门无处可扫', file=sys.stderr)
        return 1
    for name, n in hits.items():
        if n == 0 and name in LINE_NOTE_READERS and rc == 0:
            print(f'ERROR: 允许的读取点 {name}() 里一处 lineNotes 读取都没扫到——'
                  f'要么剥注释剥坏了，要么函数不再读它（那就把它移出白名单）', file=sys.stderr)
            rc = 1
    if rc == 0:
        print(f'行注读取点：core/ 共 {reads} 处读取 lineNotes，全部在 '
              f'{" / ".join(LINE_NOTE_READERS)} 内（已先剥注释，见 R47）')
    return rc
```

`check.py` 的 B 组末尾加 `('B', 'line_note_reader_check',   hygiene.line_note_reader_check),`。

- [ ] **Step 4: 跑门**

```bash
cd $W && python3 -c 'import sys; sys.path.insert(0,"python/scripts"); from gates import hygiene as h; raise SystemExit(h.line_note_reader_check())'; echo "rc=$?"
python3 $W/python/scripts/check.py 2>&1 | tail -1
```

Expected: `行注读取点：core/ 共 4 处读取 lineNotes，全部在 panelLineNotes / noteLineIndex 内…`（数目以实测为准，报告里写实测值），`rc=0`；`37 道门全绿（生成 3 · A 8 · B 7 · C 3 · D·库 12 · D·词法 4）。`

- [ ] **Step 5: 负控制**

```bash
# (a) 在挖空模式渲染里直接读 lineNotes
python3 $S/p1-negctl.py --root $W --gate hygiene.line_note_reader_check --file python/core/interact.js \
  --old '    function renderBlank() {' --new $'    function renderBlank() {\n      var leak = current().lineNotes;' \
  --expect red --must-say '直接读取了 lineNotes'
# (b) 同一句只写在注释里：必须仍绿（R47）
python3 $S/p1-negctl.py --root $W --gate hygiene.line_note_reader_check --file python/core/interact.js \
  --old '    function renderBlank() {' --new $'    function renderBlank() {\n      /* var leak = current().lineNotes; */' \
  --expect green --must-say '全部在 panelLineNotes'
# (c) 方括号读取同样抓
python3 $S/p1-negctl.py --root $W --gate hygiene.line_note_reader_check --file python/core/interact.js \
  --old '    function renderBlank() {' --new $'    function renderBlank() {\n      var leak = current()[\'lineNotes\'];' \
  --expect red --must-say '直接读取了 lineNotes'
# (d) 允许的函数改了名：门红而不是静默放行
python3 $S/p1-negctl.py --root $W --gate hygiene.line_note_reader_check --file python/core/interact.js \
  --old 'function noteLineIndex(' --new 'function noteLineIdx(' \
  --expect red --must-say '找不到允许读取 lineNotes 的函数 noteLineIndex'
# (e) D7 正控制：Step 1 的同一破坏，现在 anchor_check 必须绿
python3 $S/p1-negctl.py --root $W --gate library.anchor_check --file python/programs/ch01-basics/chapter.json \
  --old '"at": "    hours, rest = divmod(total, 3600)"' --new '"at": "    minutes = rest // 60"' \
  --expect green --must-say '行锚'
```

Expected: 五行 `PASS`。

- [ ] **Step 6: 提交**

```bash
git -C $W add python/scripts/gates/library.py python/scripts/gates/hygiene.py python/scripts/check.py
git -C $W commit -m "feat(python): 行注锚点可落在挖空体内，泄题防线移到读取点

anchor_check 删去 I1 那条数据层禁令（连同只为它存在的 _blank_body_lines，顺带消掉
账本 §三.1 的假注释）。新门 line_note_reader_check：剥注释后，core 里读取 lineNotes
只允许出现在 panelLineNotes / noteLineIndex 两个函数体内。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git -C $W status --short
```

---

## Task 10: 说明面板顶部显示程序元数据（设计 B7）

**Files:**
- Modify: `python/core/interact.js`（模块级闭集与标签、`panelMeta`、`kindLabel`、`runtimeLabel`、STR、CSS、选择器、`renderPanel`、导出）
- Modify: `python/core/interact.test.js`
- Modify: `python/scripts/gates/syntax.py`（新门）
- Modify: `python/scripts/check.py`（C 组加一行）
- Regenerate: `python/tools/py-basics.html`、`python/tools/_skeleton.html`

**Interfaces:**
- Consumes: Task 7 导出的 `HINT_MARK`。
- Produces:
  - `PyInteract.LEVELS / KINDS / BOARDS / RUNTIMES: array`
  - `PyInteract.kindLabel(kind: string, lang: 'zh'|'en') -> string`
  - `PyInteract.panelMeta(program, lang, blankCount: number|null) -> Array<{key, label, items: string[]}>`，`key ∈ {'summary','boards','tags','runtime'}`
  - `syntax.closed_set_mirror_check() -> int`

- [ ] **Step 1: 写测试（先红）**

`interact.test.js` 末尾 `T.report('interact');` 之前加：

```js
/* 说明面板顶部的元数据（第 1 期设计 B7） */
(function () {
  const prog = { id: 'm', level: 2, kind: 'pattern', lines: 23, boards: ['AQA', 'OCR'],
                 tags: ['selection', 'if-elif-else'], runtime: 'cpython' };
  const zh = PI.panelMeta(prog, 'zh', 2);
  T.eq(zh.map(function (r) { return r.key; }), ['summary', 'boards', 'tags'], 'cpython 不显示运行环境行');
  T.eq(zh[0].items, ['难度 L2 · 惯用模式 · 23 行 · 2 个空'], '中文摘要行');
  T.eq(PI.panelMeta(prog, 'en', 2)[0].items, ['Level 2 · Pattern · 23 lines · 2 blank(s)'], '英文摘要行');
  T.eq(zh[1].label, '考试局', '考试局行的标签');
  T.eq(zh[1].items, ['AQA', 'OCR'], '考试局按声明顺序原样给');
  T.eq(zh[2].items, ['selection', 'if-elif-else'], '标签原样给（英文标识符，不翻译）');
  T.eq(PI.panelMeta(Object.assign({}, prog, { boards: [] }), 'zh', 2)[1].items, ['未标注'],
       '考试局为空时显式写未标注（program_meta_check 要求非空，这是 UI 兜底）');
  T.eq(PI.panelMeta(Object.assign({}, prog, { tags: [] }), 'zh', 2).map(function (r) { return r.key; }),
       ['summary', 'boards'], '没有标签就不出标签行');
  T.eq(PI.panelMeta(prog, 'zh', null)[0].items, ['难度 L2 · 惯用模式 · 23 行'], '空数算不出来时不编一个');
  const pico = Object.assign({}, prog, { runtime: 'micropython-pico' });
  const picoRows = PI.panelMeta(pico, 'en', 1);
  T.eq(picoRows.map(function (r) { return r.key; }), ['summary', 'boards', 'tags', 'runtime'], '非 cpython 才显示运行环境');
  T.eq(picoRows[3].items, ['MicroPython · Pico'], '运行环境用标签而不是枚举值');
  T.eq(PI.panelMeta(null, 'zh', 0), [], '没有当前程序：空数组');

  T.eq(PI.KINDS, ['syntax', 'pattern', 'algorithm', 'project', 'embedded'], 'KINDS 导出且有序');
  PI.KINDS.forEach(function (k) {
    T.ok(PI.kindLabel(k, 'zh') !== k && PI.kindLabel(k, 'en') !== k, 'kind ' + k + ' 中英标签都存在');
  });
  T.eq(PI.kindLabel('quiz', 'zh'), 'quiz', '未知 kind 原样给出，不给空串');
})();
```

Run: `node $W/python/core/interact.test.js; echo "rc=$?"`
Expected: `rc=1`，失败项含 `中文摘要行`（`PI.panelMeta` 不存在时这个 IIFE 会抛 TypeError；若报告里看到的是崩溃栈而不是断言，先在 IIFE 开头加 `T.ok(typeof PI.panelMeta === 'function', 'panelMeta 已导出'); if (typeof PI.panelMeta !== 'function') { return; }` 让它红得能读）。

- [ ] **Step 2: 模块级闭集、标签与 `panelMeta`**

`interact.js` 的 STR 里 `needsPip` 前加：

```js
    metaLevel:   { zh: '难度 L{0}', en: 'Level {0}' },
    blanksCount: { zh: '{0} 个空',  en: '{0} blank(s)' },
    tags:        { zh: '标签',      en: 'Tags' },
    runtime:     { zh: '运行环境',  en: 'Runtime' },
    notTagged:   { zh: '未标注',    en: 'Not tagged' },
```

在 `filterPrograms` 函数定义之前加：

```js
  /* ---- 程序元数据的四个闭集 ----
     与 python/scripts/gates/library.py 的 LEVELS / KINDS / BOARDS / RUNTIMES 同值，由
     syntax.closed_set_mirror_check 比对。第 0 期前三个是 mount() 里的局部变量，与门里的
     闭集是一对没人看管的镜像。数组有序：选择器按这个顺序排 chip。 */
  var LEVELS = [1, 2, 3, 4, 5];
  var KINDS = ['syntax', 'pattern', 'algorithm', 'project', 'embedded'];
  var BOARDS = ['AQA', 'OCR', 'Edexcel', 'CIE'];
  var RUNTIMES = ['cpython', 'micropython-microbit', 'micropython-pico'];

  var KIND_LABELS = {
    syntax:    { zh: '语法',     en: 'Syntax' },
    pattern:   { zh: '惯用模式', en: 'Pattern' },
    algorithm: { zh: '算法',     en: 'Algorithm' },
    project:   { zh: '项目',     en: 'Project' },
    embedded:  { zh: '嵌入式',   en: 'Embedded' }
  };
  var RUNTIME_LABELS = {
    'cpython':              { zh: 'CPython', en: 'CPython' },
    'micropython-microbit': { zh: 'MicroPython · micro:bit', en: 'MicroPython · micro:bit' },
    'micropython-pico':     { zh: 'MicroPython · Pico', en: 'MicroPython · Pico' }
  };

  /* 未知值原样给出而不是空串：一个看得出是错的标签，好过一块看起来正常的空白。 */
  function kindLabel(kind, lang) {
    var e = KIND_LABELS[kind];
    return e ? (lang === 'en' ? e.en : e.zh) : String(kind == null ? '' : kind);
  }
  function runtimeLabel(rt, lang) {
    var e = RUNTIME_LABELS[rt];
    return e ? (lang === 'en' ? e.en : e.zh) : String(rt == null ? '' : rt);
  }

  /* panelMeta(program, lang, blankCount) → [{ key, label, items }]

     说明面板顶部那几行元数据（第 1 期设计 B7）。决定显示什么的逻辑放在这里、可测；
     renderPanel 只负责画。三种模式都显示——元数据不泄题。
       summary  难度 · 类型 · 行数 · 空数（blankCount 不是数字时省略，不编）
       boards   考试局；空时显式写「未标注」
       tags     标签；空时整行不出
       runtime  只在非 cpython 时出 */
  function panelMeta(program, lang, blankCount) {
    if (!program) { return []; }
    var head = [ts('metaLevel', lang, [program.level]), kindLabel(program.kind, lang)];
    if (typeof program.lines === 'number') { head.push(ts('lines', lang, [program.lines])); }
    if (typeof blankCount === 'number') { head.push(ts('blanksCount', lang, [blankCount])); }
    var rows = [{ key: 'summary', label: '', items: [head.join(' · ')] }];

    var boards = asList(program.boards);
    rows.push({ key: 'boards', label: t('boards', lang),
                items: boards.length ? boards.slice() : [t('notTagged', lang)] });

    var tags = asList(program.tags);
    if (tags.length) { rows.push({ key: 'tags', label: t('tags', lang), items: tags.slice() }); }

    if (program.runtime && program.runtime !== 'cpython') {
      rows.push({ key: 'runtime', label: t('runtime', lang), items: [runtimeLabel(program.runtime, lang)] });
    }
    return rows;
  }
```

（先 `grep -n "function asList" $W/python/core/interact.js` 确认 `asList` 定义在模块级、位于这段之前或被提升——函数声明会提升，放在后面也可用。）

- [ ] **Step 3: 选择器改用模块级闭集与标签**

`mount()` 里删掉 `var LEVELS = …`、`var KINDS = …`、`var BOARDS = …` 三行（`LINE_CAPS` 保留）。`renderPicker()` 里：

```js
      fs.appendChild(chipRow('kind', KINDS, function (v) { return v; }));
```

改为

```js
      fs.appendChild(chipRow('kind', KINDS, function (v) { return kindLabel(v, S.lang); }));
```

列表项那行

```js
          'L' + p.level + ' · ' + (p.kind || '') + ' · ' + ts('lines', S.lang, [p.lines]));
```

改为

```js
          'L' + p.level + ' · ' + kindLabel(p.kind, S.lang) + ' · ' + ts('lines', S.lang, [p.lines]));
```

- [ ] **Step 4: `renderPanel` 画元数据、CSS、导出**

`renderPanel()` 里 `if (!p) { return; }` 之后插入：

```js
      /* 元数据在最上面（第 1 期设计 B7）。空数现数：parse 失败时挖空模式自己会把错误
         摆在舞台上，这里只是不显示空数，不另报一次。 */
      var blankCount = null;
      try {
        blankCount = exercise().parse(typeof p.source === 'string' ? p.source : '').blanks.length;
      } catch (e) {
        blankCount = null;
      }
      var metaRows = panelMeta(p, S.lang, blankCount);
      if (metaRows.length) {
        var meta = h('div', 'py-meta');
        metaRows.forEach(function (row) {
          var r = h('div', 'py-meta-row');
          if (row.label) { r.appendChild(h('span', 'py-meta-k', row.label)); }
          var cls = row.key === 'tags' ? 'py-tag' : (row.key === 'boards' ? 'py-board' : 'py-meta-v');
          row.items.forEach(function (it) { r.appendChild(h('span', cls, it)); });
          meta.appendChild(r);
        });
        panel.appendChild(meta);
      }
```

样式表里 `'.py-note{margin:0 0 9px}',` 之前加：

```js
    '.py-meta{margin:0 0 12px;padding:0 0 10px;border-bottom:1px solid var(--panel-line,rgba(148,163,184,.16))}',
    '.py-meta-row{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 6px;margin:0 0 4px;',
    '  font-size:12px;color:var(--ui-slate,#9fb0c8)}',
    '.py-meta-v{color:var(--ui-bright,#e2e8f0)}',
    '.py-board{padding:0 7px;border-radius:999px;border:1px solid var(--panel-line,rgba(148,163,184,.3));',
    '  color:var(--ui-bright,#e2e8f0)}',
    '.py-tag{padding:0 6px;border-radius:4px;background:rgba(148,163,184,.12);',
    '  font-family:var(--font-code,ui-monospace,monospace);font-size:11px}',
```

导出对象加：

```js
    LEVELS: LEVELS,
    KINDS: KINDS,
    BOARDS: BOARDS,
    RUNTIMES: RUNTIMES,
    kindLabel: kindLabel,
    panelMeta: panelMeta,
```

Run: `node $W/python/core/interact.test.js; echo "rc=$?"`
Expected: `全部通过`，`rc=0`。

- [ ] **Step 5: 镜像门 `closed_set_mirror_check`**

`syntax.py` 末尾加：

```python
def closed_set_mirror_check() -> int:
    """interact.js 导出的 LEVELS / KINDS / BOARDS / RUNTIMES / HINT_MARK 与
    library.py 的规格常量逐项相同。

    两边各存一份：门那份是规格（design §2.3），页面那份决定选择器的 chip 与面板的
    标签。门里加了一个 kind、页面没加，这个 kind 的程序在选择器里筛不出来、面板上
    显示成英文枚举值——没有任何东西报错。在 vm 裸 context 里走浏览器分支取值
    （browser_branch_check 同法），测的是页面里真正执行的那份。
    """
    from . import library               # 惰性导入：library 导入期会加载 refs
    script = r'''
const vm = require('vm'), fs = require('fs');
const sandbox = {};
sandbox.self = sandbox;
vm.createContext(sandbox);
if (typeof sandbox.module !== 'undefined' || typeof sandbox.require !== 'undefined') {
  console.error('FAIL 沙箱不干净：module/require 泄漏进来了'); process.exit(1);
}
vm.runInContext(fs.readFileSync(%s, 'utf8'), sandbox, { filename: 'interact.js' });
const P = sandbox.PyInteract;
if (!P) { console.error('FAIL 没有挂上 root.PyInteract'); process.exit(1); }
process.stdout.write(JSON.stringify({ LEVELS: P.LEVELS, KINDS: P.KINDS, BOARDS: P.BOARDS,
                                      RUNTIMES: P.RUNTIMES, HINT_MARK: P.HINT_MARK }));
''' % json.dumps(str(CORE_DIR / 'interact.js'))
    proc = run_node(script)
    if proc.returncode != 0:
        print(f'ERROR: 在 vm 里装载 interact.js 失败：{proc.stderr.strip()}', file=sys.stderr)
        return 1
    got = json.loads(proc.stdout)
    rc = 0
    for key, spec in (('LEVELS', library.LEVELS), ('KINDS', library.KINDS),
                      ('BOARDS', library.BOARDS), ('RUNTIMES', library.RUNTIMES)):
        arr = got.get(key)
        if not isinstance(arr, list):
            print(f'ERROR: PyInteract.{key} 没有导出成数组（实际 {arr!r}）', file=sys.stderr)
            rc = 1
            continue
        if len(arr) != len(set(arr)):
            print(f'ERROR: PyInteract.{key} 有重复值：{arr}', file=sys.stderr)
            rc = 1
        if set(arr) != spec:
            print(f'ERROR: PyInteract.{key} 与 library.{key} 不同——'
                  f'只在页面：{sorted(set(arr) - spec, key=str)}；'
                  f'只在门：{sorted(spec - set(arr), key=str)}', file=sys.stderr)
            rc = 1
    if got.get('HINT_MARK') != library.HINT_MARK:
        print(f'ERROR: PyInteract.HINT_MARK={got.get("HINT_MARK")!r} 与 '
              f'library.HINT_MARK={library.HINT_MARK!r} 不同——门数出的段数与页面切出的段数会分岔',
              file=sys.stderr)
        rc = 1
    if rc == 0:
        print('闭集镜像：interact.js 的 LEVELS/KINDS/BOARDS/RUNTIMES/HINT_MARK 与 library.py 逐项相同'
              '（vm 裸 context，浏览器分支）')
    return rc
```

`check.py` 的 C 组末尾加 `('C', 'closed_set_mirror_check',  syntax.closed_set_mirror_check),`。

```bash
python3 $W/python/scripts/inline_core.py && python3 $W/python/scripts/check.py 2>&1 | tail -1
```

Expected: `38 道门全绿（生成 3 · A 8 · B 7 · C 4 · D·库 12 · D·词法 4）。`

- [ ] **Step 6: 负控制**

```bash
python3 $S/p1-negctl.py --root $W --gate syntax.closed_set_mirror_check --file python/scripts/gates/library.py \
  --old "KINDS = {'syntax', 'pattern', 'algorithm', 'project', 'embedded'}" \
  --new "KINDS = {'syntax', 'pattern', 'algorithm', 'project', 'embedded', 'quiz'}" \
  --expect red --must-say "只在门：['quiz']"
python3 $S/p1-negctl.py --root $W --gate syntax.closed_set_mirror_check --file python/scripts/gates/library.py \
  --old "HINT_MARK = ' || '" --new "HINT_MARK = ' ## '" --expect red --must-say 'PyInteract.HINT_MARK'
python3 $S/p1-negctl.py --root $W --gate syntax.closed_set_mirror_check --file python/core/interact.js \
  --old "  var BOARDS = ['AQA', 'OCR', 'Edexcel', 'CIE'];" --new "  var BOARDS = ['AQA', 'OCR', 'Edexcel'];" \
  --expect red --must-say "只在门：['CIE']"
python3 $S/p1-negctl.py --root $W --gate 'cmd:node python/core/interact.test.js' --file python/core/interact.js \
  --old "    project:   { zh: '项目',     en: 'Project' }," --new "" \
  --expect red --must-say 'kind project 中英标签都存在'
```

Expected: 四行 `PASS`。

- [ ] **Step 7: `file://` 目测**

Browser 工具（显式 `tabId`）打开 `file://$W/python/tools/py-basics.html?lang=zh`：
1. 探针：`document.querySelector('meta[name=tool-version]').content` 与 `TOOL.id === 'py-basics'` 先断言，再读 `document.querySelector('.py-meta').innerText`，应以 `难度 L` 开头、含 `个空` 与 `考试局`。
2. 左侧列表项 meta 显示中文类型（如 `L2 · 惯用模式 · 23 行`），没有 `pattern` 字样。
3. 截图读 / 挖空 / 临摹三种模式下的面板顶部；切 `?lang=en` 再截一张读模式。
4. 窗口宽度 < 880px 时面板整体隐藏（第 0 期已有的 `@media` 规则），确认没有布局错乱即可——**这不是本任务引入的行为，在报告里如实写明「窄屏下元数据不可见」**。

- [ ] **Step 8: 提交**

```bash
git -C $W add python/core/interact.js python/core/interact.test.js python/scripts/gates/syntax.py \
  python/scripts/check.py python/tools/py-basics.html python/tools/_skeleton.html
git -C $W commit -m "feat(python): 说明面板顶部显示程序元数据，闭集镜像加门

面板顶部显示难度、类型、行数、空数、考试局、标签（非 cpython 另显运行环境），
决定显示什么的 panelMeta 为可测纯函数。kind 做双语标签，选择器同用。
LEVELS/KINDS/BOARDS/RUNTIMES 提到模块级并导出；closed_set_mirror_check 在 vm 裸 context
里把它们与 HINT_MARK 同 library.py 的规格常量逐项比对。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git -C $W status --short
```

---
## Task 11: ch01 补空，py-basics 1.1.0，engine py-1.1.0（设计 B4）

**本任务由内容构建子代理（opus）完成**，两轮评审（规格一致性 + 内容质量）。控制方在派发简报里原样附上本任务全文与 Global Constraints。

**Files:**
- Modify: `python/programs/ch01-basics/{hello-name,celsius-to-fahrenheit,number-formatting,max-of-three-builtin,int-float-str,swap-two-temp,swap-two-tuple}.py`
- Modify（按需）: `python/programs/ch01-basics/chapter.json`（受补空影响的 notes / lineNotes 文案）
- Modify: `python/python-tools.json`（py-basics 的 `version` / `engine` / `changelog`）
- Modify: `python/tools/py-basics.html`（`tool-version` / `tool-engine` meta、头部版本记录注释）
- Modify: `python/tools/_skeleton.html`（`tool-engine` meta）
- Regenerate: `python/tools/py-basics.html`、`python/app.html`、`python/index.html`

**Interfaces:**
- Consumes: Task 7 的 ` || ` 标记与门；Task 9 的锚点解禁（行注可以留在被挖的那一行上）；Task 10 的元数据面板（面板会显示空数）。

- [ ] **Step 1: 基线测量（写协议，报实测值）**

```bash
python3 - <<'EOF'
import pathlib, re
d = pathlib.Path('/Users/nickma/Develop/My2ndBrain/MathViz/.claude/worktrees/python-phase1-rules/python/programs/ch01-basics')
zero = [p.stem for p in sorted(d.glob('*.py'))
        if not any(re.match(r'^\s*#\s*>>>\s*BLANK\s', l) for l in p.read_text(encoding='utf-8').split('\n'))]
print(len(zero), zero)
EOF
```

Expected（设计 §2 第 4 条的实测）：`7 [...]`，名单与本任务 Files 列出的七个相同。不同就停下上报。

- [ ] **Step 2: 给七个程序补空**

指令行格式与现有三个程序一致：从第 0 列开始，`# >>> BLANK id=<kebab-case> level=<1-3> hint="<中文>" hintEn="<English>"`，挖空体是完整的若干行，之后一行 `# <<< BLANK`。

硬规矩（前四条有门，后四条靠人，评审逐条核）：
1. `hint` 与 `hintEn` 按 ` || ` 切出的段数都**恰好等于** `level`；标记两侧各一个空格。
2. 挖空体非空；同一程序内 `id` 唯一。
3. 指令行之外保持纯 ASCII；提示里不许有非 BMP 字符（不要 emoji）。
4. 不改任何程序的输出（BLANK 指令是注释，`program_run_check` 会证明）。
5. **只挖写法唯一的行。** 判定严格比较引号风格、数字写法、相对缩进；一行若有同样好的另一种写法（比如 `celsius * 9 / 5 + 32` 与 `celsius * 1.8 + 32`），要么别挖它，要么让提示把形式钉死（「先乘 9 再除以 5」）。
6. 提示逐级更具体；**任何一级都不许直接给出答案原文**。第 1 级给方向，最后一级给到「知道该写什么形状」为止。
7. 字符串字面量里的具体文字（比如 `input()` 的提示语）学生无从推断——整行挖掉时，提示里必须给出那段文字，否则就别挖那一行。
8. 中英两条提示信息对等，不是互相翻译不全的两句话。

建议的挖法（**建议，不是规定**；有更好的挖法就换，并在报告里写理由）：

| 程序 | 建议挖的行 | 建议 level |
|---|---|---|
| `hello-name` | `    return f"Hello, {name}!"` | 1 |
| `celsius-to-fahrenheit` | `    return celsius * 9 / 5 + 32` | 2 |
| `number-formatting` | `    total = quantity * price`（`return` 那行的四段宽度是任意取的，学生无从推断，不建议挖） | 1 |
| `max-of-three-builtin` | `    return max(a, b, c)` | 1 |
| `int-float-str` | `    return f"{value!r} -> {type(value).__name__}"` | 3 |
| `swap-two-temp` | `    temp = a` / `    a = b` / `    b = temp` 三行一空 | 2 |
| `swap-two-tuple` | `    a, b = b, a` | 1 |

每改完一个程序跑一次：

```bash
cd $W && python3 -c 'import sys; sys.path.insert(0,"python/scripts"); from gates import library as l; raise SystemExit(l.blank_directive_check() or l.source_ascii_check() or l.source_bmp_check() or l.anchor_check())'; echo "rc=$?"
```

（这里用 `or` 只是开发期快速反馈；最终以 `check.py` 为准。）

- [ ] **Step 3: 在页面上逐空验证标准答案判为「对了」**

```bash
python3 $W/python/scripts/build_programs.py && python3 $W/python/scripts/inline_core.py
```

Browser 工具（显式 `tabId`）打开 `file://$W/python/tools/py-basics.html?lang=zh`，对七个程序逐个：切到挖空模式 → 每个空点「填进去」再点「检查」应显示「对了」；再把输入改错一个 token，点「检查」应报「第 N 个 token 起不同」。截一张补过空的挖空模式截图。**任何一个标准答案判不对，说明这行的写法在判定器眼里有歧义，换一行挖。**

- [ ] **Step 4: 修订受影响的讲解**

逐个读七个程序的讲解：
- `lineNotes` 只在读模式显示（`panelLineNotes` 白名单），挂在被挖那一行上也不泄题，**不用改**。
- `notes` 与 `blurb` 在三种模式下都显示。若其中某段**逐字写出了**挖空答案（例如原样引用 `a, b = b, a`），改写成讲道理但不给出那一行原文的说法。

在报告里列出改了哪几条、改前改后各一句。

- [ ] **Step 5: 版本与 engine**

1. `python/python-tools.json` 的 py-basics：`"version": "1.1.0"`，`"engine": "py-1.1.0"`；`changelog` 数组**最前面**插入（`date` 取提交当天）：

```json
{
  "version": "1.1.0",
  "date": "2026-09-16",
  "en": "Every program now has at least one blank to fill in - seven of the ten had none, so fill-in mode had nothing to do on them. Hints split into tiers more reliably: a semicolon inside a hint no longer cuts it short. The side panel now opens with each program's level, kind, line and blank counts, exam boards and tags, and decorators get their own colour.",
  "zh": "每个程序都至少有一个空了——十个程序里原先有七个一个空都没有，挖空模式下无事可做。提示分级更可靠：提示里的分号不会再把后半句截掉。右侧面板顶部显示每个程序的难度、类型、行数与空数、考试局和标签；装饰器有了自己的颜色。"
}
```

2. `python/tools/py-basics.html`：`<meta name="tool-version" content="1.1.0">`、`<meta name="tool-engine" content="py-1.1.0">`；头部 `<!-- 版本记录（changelog，新→旧）：` 下第一行插入：

```
     1.1.0  2026-09-16  每个程序至少一个空（原先 7 个零挖空）；提示分级改用显式
                        标记，分号不再截断提示；面板顶部显示程序元数据；装饰器配色。
```

3. `python/tools/_skeleton.html`：`<meta name="tool-engine" content="py-1.1.0">`。
4. 重新生成：

```bash
python3 $W/python/scripts/sync_fallback.py
python3 $W/python/scripts/check.py 2>&1 | tail -1
```

Expected: `38 道门全绿（…）。`（`page_mirror_check` 证明三处 engine 一致，`version_meta_check` 与 `fallback_version_check` 证明版本一致。）

- [ ] **Step 6: 复测基线协议**

重跑 Step 1 的脚本。Expected: `0 []`。

- [ ] **Step 7: 提交**

```bash
git -C $W add python/programs/ch01-basics python/python-tools.json python/tools/py-basics.html \
  python/tools/_skeleton.html python/app.html python/index.html
git -C $W status --short
git -C $W commit -m "feat(python): py-basics 1.1.0——每个程序至少一个空

七个零挖空的程序各补 1–3 个空（挖写法唯一的行，提示逐级更具体、不给答案原文）。
engine 升到 py-1.1.0（core 在 B1/B2/B7 有改动），骨架同步。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git -C $W status --short
```

（`git add python/programs/ch01-basics` 是目录：提交前先 `git -C $W status --short python/programs` 确认里面只有本任务改的文件。）

- [ ] **Step 8: 构建者报告**

必须包含：每个程序挖了哪几行、level、为什么这行写法唯一；Step 3 每个空的判定结果；Step 4 改了哪些讲解；所有与本任务建议不同之处及理由；本任务里写错的地方（R28）。

---

## Task 12: 新门 `blank_presence_check`（设计 B3）

**Files:**
- Modify: `python/scripts/gates/library.py`
- Modify: `python/scripts/check.py`（D·库 组加一行）

**Interfaces:**
- Produces: `library.blank_presence_check() -> int`

- [ ] **Step 1: 写门**

`library.py` 的 `blank_directive_check` 之前加：

```python
def blank_presence_check() -> int:
    """每个程序至少一个 BLANK（第 1 期设计 D2），无豁免。

    第 0 期 ch01 十个程序里七个一个空都没有。挖空模式对它们照常逐行渲染：没有输入框、
    没有说明，使用者面对的是一页无事可做的代码——不报错，也没有任何东西会发现。
    挖空是三种模式里唯一带判定的一种，所以「零个空」不是合法的内容形状。
    """
    rc = 0
    scanned = 0
    total = 0
    for chapter_dir, _data, prog, py_path in iter_programs():
        if not py_path.exists():
            continue                     # 缺文件由 chapter_manifest_check 报
        scanned += 1
        n = sum(1 for line in read_text(py_path).split('\n') if BLANK_OPEN_RE.match(line))
        total += n
        if n == 0:
            print(f'ERROR: {_pid(chapter_dir, prog)} 一个挖空都没有：{py_path}\n'
                  f'       挖空模式下这个程序整页无事可做，而且不会有任何提示。至少挖一行'
                  f'（规则见 .claude/skills/python-drill-tool/SKILL.md）。', file=sys.stderr)
            rc = 1
    if scanned == 0:
        print('ERROR: 一个程序都没扫到——这道门跑了个寂寞', file=sys.stderr)
        return 1
    if rc == 0:
        print(f'挖空下限：{scanned} 个程序每个都至少有一个空（共 {total} 个）')
    return rc
```

`check.py` 的 `D·库` 组里 `blank_directive_check` 之前加 `('D·库', 'blank_presence_check',           library.blank_presence_check),`。

- [ ] **Step 2: 跑门**

```bash
python3 $W/python/scripts/check.py 2>&1 | tail -1
```

Expected: `39 道门全绿（生成 3 · A 8 · B 7 · C 4 · D·库 13 · D·词法 4）。`

- [ ] **Step 3: 负控制（去掉一个程序的全部挖空）**

```bash
python3 - <<'EOF'
import pathlib, re, subprocess, sys
W = pathlib.Path('/Users/nickma/Develop/My2ndBrain/MathViz/.claude/worktrees/python-phase1-rules')
p = W / 'python/programs/ch01-basics/swap-two-tuple.py'
def gate():
    code = ('import sys; sys.path.insert(0, "python/scripts"); '
            'from gates import library as m; raise SystemExit(m.blank_presence_check())')
    return subprocess.run([sys.executable, '-c', code], cwd=W, capture_output=True, text=True)
base = gate()
assert base.returncode == 0, 'BASELINE NOT GREEN\n' + base.stdout + base.stderr
orig = p.read_bytes()
src = orig.decode('utf-8')
stripped = '\n'.join(l for l in src.split('\n') if not re.match(r'^\s*#\s*(>>>|<<<)\s*BLANK', l))
assert stripped != src, '这个程序本来就没有挖空——换一个程序'
try:
    p.write_text(stripped, encoding='utf-8')
    r = gate()
finally:
    p.write_bytes(orig)
assert p.read_bytes() == orig, 'RESTORE FAILED'
out = r.stdout + r.stderr
assert r.returncode != 0, '去掉全部挖空后门仍然绿'
assert 'swap-two-tuple' in out and '一个挖空都没有' in out, out
assert 'Traceback' not in out, '红是因为崩溃：\n' + out
print('PASS: 去掉 swap-two-tuple 的全部挖空 → blank_presence_check 因断言失败而红并点名')
for line in out.splitlines():
    print('  | ' + line)
EOF
git -C $W status --short
```

Expected: `PASS: …`；状态为空。

- [ ] **Step 4: 提交**

```bash
git -C $W add python/scripts/gates/library.py python/scripts/check.py
git -C $W commit -m "feat(python): blank_presence_check——每个程序至少一个空

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git -C $W status --short
```

---
## Task 13: 作者须知 skill（设计 B5）

**Files:**
- Create: `.claude/skills/python-drill-tool/SKILL.md`

**Interfaces:**
- Consumes: Task 1–12 落地的全部门名、`gates/refs/` 约定、` || ` 标记、`p1-negctl.py` 的做法。
- Produces: 第二份计划（内容波次）的构建简报引用这份文件。

- [ ] **Step 1: 写文件**

````markdown
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

## 硬规矩与守门

| 规矩 | 守门 | 门报红时说什么 |
|---|---|---|
| 程序能跑，stdout 逐字节等于 `run.expect` | `program_run_check` | `stdout 与 run.expect 不符`，附期望与实际 |
| 每个程序至少 1 个空 | `blank_presence_check` | `一个挖空都没有` |
| BLANK 成对；`id` / `level` / `hint` / `hintEn` 齐全；`level ∈ 1..3`；挖空体非空；`id` 在程序内唯一 | `blank_directive_check` | `缺 hintEn=`、`level=… 必须是 1、2 或 3` 等 |
| `hint` 与 `hintEn` 按 ` \|\| ` 切出的段数**都等于** `level` | `blank_directive_check` | `切出 N 段，但 level=M` |
| `\|\|` 必须写成两侧各一个空格的 ` \|\| ` | `blank_directive_check` | `疑似写错的分级标记` |
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
  使用者写出更好的答案会被判错——要么别挖，要么让提示把形式钉死。
- **提示逐级更具体，任何一级都不许给出答案原文。**
- 被挖的行里若有学生无从推断的文字（`input()` 的提示语、任意取的格式宽度），提示必须给出它，否则别挖。
- `notes` / `blurb` 在三种模式都显示，不许逐字写出挖空答案；`lineNotes` 只在读模式显示，挂在被挖那行上没关系。
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
- 报告「红」时附上变红那一行，并说明是**断言失败**还是**脚本崩溃**——崩溃的红与有效的红长得一样。
````

- [ ] **Step 2: 核对 skill 里提到的门都真实存在**

```bash
python3 - <<'EOF'
import pathlib, re, sys
W = pathlib.Path('/Users/nickma/Develop/My2ndBrain/MathViz/.claude/worktrees/python-phase1-rules')
sys.path.insert(0, str(W / 'python/scripts'))
import check
names = {name for _g, name, _f in check.GATES}
skill = (W / '.claude/skills/python-drill-tool/SKILL.md').read_text(encoding='utf-8')
cited = set(re.findall(r'`([a-z_]+_check)`', skill))
missing = sorted(cited - names)
assert cited, '一个门名都没抠到——正则写错了'
assert not missing, f'skill 引用了不存在的门：{missing}'
# 反例：一个不存在的名字必须被抓住
assert 'nonexistent_check' not in names
print(f'skill 引用 {len(cited)} 道门，全部在 check.GATES 里')
EOF
```

Expected: `skill 引用 14 道门，全部在 check.GATES 里`（数目以实测为准）。

- [ ] **Step 3: 核对示例程序真的合规**

把 skill 里的示例 `.py` 与 `chapter.json` 片段写进一个**临时章目录**跑一遍门，证明示例本身不违反它宣讲的规矩；跑完删除：

```bash
python3 - <<'EOF'
import json, pathlib, re, shutil, subprocess, sys
W = pathlib.Path('/Users/nickma/Develop/My2ndBrain/MathViz/.claude/worktrees/python-phase1-rules')
skill = (W / '.claude/skills/python-drill-tool/SKILL.md').read_text(encoding='utf-8')
py = re.search(r'```python\n("""Count how many.*?)```', skill, re.S).group(1)
blocks = re.findall(r'```python\n(.*?)```', skill, re.S)
src_dir = W / 'python/programs/ch99-skill-probe'
assert not src_dir.exists()
try:
    src_dir.mkdir()
    (src_dir / 'count-letter-loop.py').write_text(py, encoding='utf-8')
    r = subprocess.run([sys.executable, 'count-letter-loop.py'], cwd=src_dir, capture_output=True, text=True)
    assert r.stdout == '3\n0\n', r.stdout
    sys.path.insert(0, str(W / 'python/scripts'))
    from gates import library
    lines = py.split('\n')
    om = [l for l in lines if l.startswith('# >>> BLANK')][0]
    assert library._hint_parts(re.search(r'\bhint="([^"]*)"', om).group(1)) == 2
    assert library._hint_parts(re.search(r'\bhintEn="([^"]*)"', om).group(1)) == 2
    body = [l for l in lines if not l.startswith('# ')]
    assert all(ord(c) < 128 for l in body for c in l), '示例源码（指令行外）不是纯 ASCII'
    print('skill 示例：输出与 expect 相符、两条提示各切出 2 段、指令行外纯 ASCII')
finally:
    shutil.rmtree(src_dir, ignore_errors=True)
EOF
git -C $W status --short
```

Expected: `skill 示例：…`；状态里只有新建的 skill 文件（临时章目录已删）。

- [ ] **Step 4: 提交**

```bash
git -C $W add .claude/skills/python-drill-tool/SKILL.md
git -C $W commit -m "docs(python): 作者须知 skill python-drill-tool

每条硬约束注明守门与门的报错；没有门的规则标「靠人」。示例程序与 run.expect 生成
脚本在提交前实跑过，引用的门名与 check.GATES 逐一核对。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git -C $W status --short
```

---
## Task 14: PR-B 验收与开 PR

**Files:** 无新改动（发现问题则回到对应任务修，作为新提交）。

- [ ] **Step 1: 全量验收（设计 §10）**

```bash
cd $W && bash -c '
for c in "python3 python/scripts/check.py" "python3 scripts/check_nav_contract.py" "python3 scripts/sync_registry.py --check" \
         "python3 scripts/apply_branding.py --check" "python3 scripts/apply_footer.py --check" "python3 chess/scripts/check.py" \
         "python3 cryptography/scripts/check.py" "python3 python/scripts/inline_core.py --check" \
         "python3 python/scripts/build_programs.py --check" "python3 python/scripts/sync_fallback.py --check"; do
  out=$(eval "$c" 2>&1); rc=$?; echo "rc=$rc :: $c :: $(echo "$out" | tail -1 | cut -c1-120)"
done
for f in python/core/*.test.js; do node "$f" >/dev/null 2>&1; echo "rc=$? :: node $f"; done'
```

Expected: 全部 `rc=0`；check.py 行为 `39 道门全绿（生成 3 · A 8 · B 7 · C 4 · D·库 13 · D·词法 4）。`

- [ ] **Step 2: 浏览器验收（显式 `tabId`，探针先断言 `TOOL.id === 'py-basics'`）**

`file://$W/python/tools/py-basics.html`：
1. `?lang=zh` 与 `?lang=en` 各一遍：读 / 挖空 / 临摹三种模式都能切换；面板顶部元数据与语言一致。
2. 挖空模式下十个程序每个都有输入框（逐个切换程序，数 `.py-blank-in` 个数 ≥ 1）。
3. 装饰器配色：在页面里执行
   ```js
   (function(){ var s=document.createElement('span'); s.className='tok-decorator'; document.body.appendChild(s);
     var c=getComputedStyle(s).color; s.remove(); return c; })()
   ```
   应返回非默认前景色（与 `.tok-name` 的 `rgb(226, 232, 240)` 不同）。
4. 临摹模式在浏览器缩放 90% / 100% / 125% 下三层对齐（主规格 §9.1 第 6 条，靠看，截图）。
5. `?lang=zh` 下给一个空填错一个 token、点「检查」，提示信息指到第几个 token；点「提示」两次，第二次展开的文字用「·」连接两级、不出现 `||`。

截图附进报告。

- [ ] **Step 3: 复制内容真跑（「粘进 PyCharm」的机械等价）**

在页面里（`javascript_tool`，显式 `tabId`）对随机三个程序 `prog`（取自 `PyPrograms.programs`）分别取三种模式的复制内容：

```js
var ex = Exercise.parse(prog.source);
var answers = {}; ex.blanks.forEach(function (b) { answers[b.id] = b.body; });
var read  = PyInteract.copyPayload('read',  prog, {});
var blank = PyInteract.copyPayload('blank', prog, { answers: answers });   // 每个空填标准答案
var trace = PyInteract.copyPayload('trace', prog, { typed: read });        // 临摹缓冲原样交出
JSON.stringify({ id: prog.id, read: read, blank: blank, trace: trace });
```

断言 `read === blank === trace`、三者都不含 `# >>> BLANK`，写入 `$S/p1-copy-<id>.py`，按 skill 里「生成 run.expect」的同一条件用 `python3` 在临时目录真跑，stdout 必须等于该程序的 `run.expect`。**真正粘进 PyCharm 跑一遍（主规格 §9.1 第 5 条）由用户完成，报告里明确写「未代做」。**

- [ ] **Step 4: 记录波 1 之前的仓库体积基线（设计 §9）**

```bash
git -C $W count-objects -vH | tee $S/p1-git-size-before-wave1.txt
```

- [ ] **Step 5: 推送、开 PR、读 CI**

```bash
git -C $W push -u origin claude/python-phase1-rules
cd $W && gh pr create --base main --head claude/python-phase1-rules \
  --title "python 第 1 期 · PR-B：提示标记 ||、挖空下限、元数据面板、作者须知" \
  --body "$(cat <<'BODY'
第 1 期设计 `docs/superpowers/specs/2026-09-16-python-phase1-design.md` §5 的 B1–B7。基于已合并的 PR-A。

## 改了什么
- **B1** 提示分级标记改为 ` || `；分号回归普通标点（旧规则下 level=1 提示里的「；」会静默截掉后半句）。门另抓写错的 `||`。
- **B2** 装饰器配色；`PyLex.TYPES` 闭集 + 测试：每个 token 类型要么有配色、要么显式不上色。
- **B3** 新门 `blank_presence_check`：每个程序至少一个空。
- **B4** py-basics **1.1.0**：七个零挖空的程序补空；engine 升 py-1.1.0（含骨架）。
- **B5** 作者须知 `.claude/skills/python-drill-tool/SKILL.md`。
- **B6** 行注锚点可落在挖空体内；新门 `line_note_reader_check` 把防线移到读取点。
- **B7** 说明面板顶部显示程序元数据；新门 `closed_set_mirror_check`。

门数 36 → 39，每道新门与改动过的门都做了负控制（基线绿 → 破坏 → 因断言失败而红 → 从内存原字节复原）。

## 验证
- [x] 设计 §10 的全量验收命令本机全绿
- [x] `file://` 中英 × 三种模式；十个程序都有空；装饰器配色；临摹三种缩放对齐（截图见评论）
- [x] 随机三个程序的复制内容用 python3 真跑，stdout 等于 run.expect
- [ ] **粘进 PyCharm 真跑（主规格 §9.1 第 5 条）——需要人来做**
- [ ] CI

窄屏（< 880px）下说明面板整体隐藏是第 0 期就有的规则，所以元数据在窄屏上不可见；本 PR 没有改变它。

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
PR=$(gh pr view --json number -q .number) && gh pr checks $PR --watch --interval 30
```

Expected: checks 全部 `pass`。红则读完整日志定位，修复作为新提交推上去。

- [ ] **Step 6: 交给用户**

报告：PR 链接、CI 结论、每个任务的负控制汇总（附变红的那一行）、`p1-git-size-before-wave1.txt` 的数字、B4 构建者报告里的偏离与简报错误、「窄屏不可见」与「PyCharm 未代做」两条。**等用户说合并。** 合并后删分支与 worktree，然后按设计 §7–§9 写内容波次的计划。

---

## 自审记录（写计划时）

- **设计覆盖：** A1→T2、A2→T3、A3→T4、A4→T5、A5→T6、A6→T1、B1→T7、B2→T8、B3→T12、B4→T11、B5→T13、B6→T9、B7→T10；§10 验收→T6 / T14；§9 波前体积基线→T14 Step 4。§7–§9 的内容波次与 §12 收尾不在本计划内（见文件头）。
- **顺序依赖：** T11（补空）需要 T7（` || ` 标记）与 T9（锚点解禁）；T12（下限门）放在 T11 之后，否则提交钩子会被真实数据挡住；T13（skill）放在所有规则落地之后。
- **门数推演：** 34 →T2 35 →T4 36 →T9 37 →T10 38 →T12 39。
