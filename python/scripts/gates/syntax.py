"""C 组 · 语法与运行时的三道门。

`node_check` 与 `core_tests` 是照抄 cryptography 的两道；`browser_branch_check`
是这个子项目自己的，守的是 UMD 的**另一条分支**。

> `node -e` **和** `node` 读 stdin **都会定义 `module` 与 `require`**，UMD 会走
> **node** 分支。用那两种方式测浏览器分支，是在检查浏览器里根本不执行的代码——
> **一道测错分支的门比没有门更糟：它广告了一份它并不具备的覆盖。**

所以 `browser_branch_check` 用 `vm` + **裸 context**，而且脚本自己会先断言沙箱
里确实没有 module / require——一道门宣称自己跑在裸沙箱里，得有人去查那句话。
"""
from __future__ import annotations

import json
import subprocess
import sys

from . import (CORE_DIR, ROOT, SCRIPT_RE, STDIN_LINE_RE, all_tool_pages,
               core_modules, read_text, root_pages, run_node)

ROOT_PAGE_MIN = 2      # index.html + app.html

# 浏览器分支里每个模块挂到 root 上的名字，以及一个「挂上了就该能调」的函数。
# 这张表是**规格**（每个模块 UMD 的 else 分支写的就是它），所以允许写成常量。
BROWSER_GLOBALS = [
    ('py-lex.js',   'PyLex',      ['tokenize', 'significant']),
    ('store.js',    'Store',      ['available', 'getDraft', 'setDraft']),
    ('exercise.js', 'Exercise',   ['parse', 'merge', 'clean']),
    ('editor.js',   'Editor',     ['highlight', 'lineStarts', 'applyTab']),
    ('judge.js',    'Judge',      ['normalize', 'compare']),
    ('trace.js',    'Trace',      ['create', 'alignLines']),
    ('interact.js', 'PyInteract', ['mount', 'filterPrograms', 'blankFeedback']),
]


def node_check() -> int:
    """逐个 <script> 块跑 node --check，并把报错行号换算回原文件真实行号。

    不把多个块拼起来再检查一次：工具页有三个 script 块（引导 / 生成 / 手写），
    拼接会把报错行号错报到人手写的那块代码上。

    扫 **all_tool_pages()**（含 `_skeleton.html`）加两个根级导航页：骨架也内嵌
    八个 GENERATED 区间、也会语法错，而它是以后每个新工具的复制源——它坏了，
    坏的是所有后代。chess 栽过反方向的同一件事：它的 index.html 从来没有被任何
    语法门覆盖过，而那是一个纯 JS 驱动的页面，语法错就是整页白屏。
    """
    pages = root_pages()
    missing = [p for p in pages if not p.exists()]
    if missing or len(pages) < ROOT_PAGE_MIN:
        print(f'ERROR: python/ 根级页面缺失：{[p.name for p in missing]}——'
              f'至少要 index.html 与 app.html', file=sys.stderr)
        return 1
    tools = all_tool_pages()
    if not tools:
        print('ERROR: python/tools/ 下一个页面都没有——这道门本该检查语法，'
              '不是跑了个寂寞', file=sys.stderr)
        return 1

    failed = []
    total_blocks = 0
    for path in tools + pages:
        text = read_text(path)
        matches = list(SCRIPT_RE.finditer(text))
        if not matches:
            print(f'WARN: {path.name} 里没有内联 <script>', file=sys.stderr)
            continue
        for m in matches:
            total_blocks += 1
            # group(1) 的第一个字符所在的行号（1-based）——node --check 报的
            # 「第 1 行」就对应这一行。
            start_line = text.count('\n', 0, m.start(1)) + 1
            proc = subprocess.run(['node', '--check', '-'],
                                  input=m.group(1), text=True, capture_output=True)
            if proc.returncode != 0:
                def fix_line(mm, base=start_line):
                    return '[stdin]:' + str(int(mm.group(1)) + base - 1)
                failed.append((path.name, STDIN_LINE_RE.sub(fix_line, proc.stderr.strip())))

    for name, err in failed:
        print(f'ERROR: {name} 语法检查失败\n{err}', file=sys.stderr)
    if not failed:
        print(f'node --check：{len(tools) + len(pages)} 个文件、{total_blocks} 个脚本块通过')
    return 1 if failed else 0


def core_tests() -> int:
    """跑 core/ 下的全部 *.test.js（**含子目录**）。

    用 rglob 而不是 glob：chess 在这一点上栽过——algos/minimax.test.js 整个落在
    门外，本地手跑是绿的，那道门却一次都没跑到它。

    一个测试都没找到必须是**失败**，不是通过——空列表下循环一次都不转、rc 保持
    0，这道门就会「因为什么都没找到」而通过。
    """
    tests = sorted(CORE_DIR.rglob('*.test.js'))
    if not tests:
        print('ERROR: core/ 下一个 *.test.js 都没找到 —— 这道门本该跑测试，'
              '不是跑了个寂寞', file=sys.stderr)
        return 1
    rc = 0
    for test in tests:
        if subprocess.run(['node', str(test)]).returncode != 0:
            print(f'ERROR: {test.relative_to(ROOT)} 未通过', file=sys.stderr)
            rc = 1
    print(f'core 测试：{len(tests)} 个测试文件'
          + ('全部通过' if rc == 0 else '有未通过的'))
    return rc


def browser_branch_check() -> int:
    """在 `vm` 的**裸 context** 里跑每个 core 模块的浏览器分支。

    单元测试只覆盖 UMD 的 node 分支（`module.exports = factory(...)`）。浏览器
    走的是另一条（`root.X = factory(...)`），它在 node 下一行都不执行——一个把
    `root.Store` 写成 `root.Stor` 的手滑，所有测试照样全绿，页面在浏览器里是
    `Store is not defined`。

    三件事一起验，缺一不可：
      1. 沙箱确实是裸的（没有 module / require）。脚本自己断言这一条——不然
         这道门就在广告一份它并不具备的覆盖。
      2. 每个模块挂上了它该挂的那个全局名，且列出的函数都是 function。
      3. **按依赖的反序装载**（interact 最先、py-lex 最后），然后真调一遍。
         这一条顺手把「惰性取依赖」从静态断言（hygiene.lazy_dep_check）升级成
         可执行的证明：谁要是在工厂实参里直接抓了 root.X，这里会当场抓死
         undefined。正序装载看不出任何区别。
    """
    modules = {p.name: p for p in core_modules()}
    missing = [name for name, _, _ in BROWSER_GLOBALS if name not in modules]
    if missing:
        print(f'ERROR: core/ 缺模块 {missing}——BROWSER_GLOBALS 与磁盘对不上',
              file=sys.stderr)
        return 1
    extra = sorted(set(modules) - {name for name, _, _ in BROWSER_GLOBALS})
    if extra:
        print(f'ERROR: core/ 多出未登记的模块 {extra}——它们的浏览器分支没有任何'
              f'覆盖。把它们加进 BROWSER_GLOBALS。', file=sys.stderr)
        return 1

    # 反序装载：依赖最深的先进沙箱。见上面第 3 条。
    load_order = [modules[name] for name, _, _ in reversed(BROWSER_GLOBALS)]
    spec = [{'file': str(modules[name]), 'name': name, 'glob': g, 'fns': fns}
            for name, g, fns in BROWSER_GLOBALS]

    script = r'''
const vm = require('vm'), fs = require('fs');
const files = %s;
const spec  = %s;
const sandbox = {};
sandbox.self = sandbox;
sandbox.console = console;
vm.createContext(sandbox);
if (typeof sandbox.module !== 'undefined' || typeof sandbox.require !== 'undefined') {
  console.error('FAIL 沙箱不干净：module/require 泄漏进来了，测的还是 node 分支');
  process.exit(1);
}
const bad = [];
for (const f of files) {
  try { vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: f }); }
  catch (e) { bad.push('装载 ' + f + ' 抛错：' + e.message); }
}
/* 沙箱里必须仍然没有 module/require —— 一个模块里的 `var module = {}` 会把
   后面所有模块推回 node 分支，那样这道门就悄悄测错了分支。 */
if (typeof sandbox.module !== 'undefined' || typeof sandbox.require !== 'undefined') {
  bad.push('装载之后沙箱里出现了 module/require —— 后续模块走的是 node 分支');
}
for (const s of spec) {
  const obj = sandbox[s.glob];
  if (!obj) { bad.push(s.name + ' 没有挂上 root.' + s.glob +
                       '（沙箱里现有：' + Object.keys(sandbox).sort().join(',') + '）');
              continue; }
  for (const fn of s.fns) {
    if (typeof obj[fn] !== 'function') {
      bad.push(s.glob + '.' + fn + ' 不是函数，实际 ' + typeof obj[fn]);
    }
  }
}
/* 真调一遍：挂上名字不等于能用。惰性依赖若被写成装载时求值，这里才会炸。 */
const SRC = 'def f(a):\n    return f"v={a!r}"\n';
try {
  const toks = sandbox.PyLex.tokenize(SRC);
  if (!toks.length) { bad.push('PyLex.tokenize 返回空'); }
  const joined = sandbox.Editor.highlight(SRC).map(function (p) { return p.text; }).join('');
  if (joined !== SRC) { bad.push('Editor.highlight 往返不等于原文（浏览器分支）'); }
  if (!sandbox.Judge.normalize('x = 1').toks.length) { bad.push('Judge.normalize 没产出 token'); }
  if (!sandbox.Judge.compare('x = 1', 'x  =  1').ok) { bad.push('Judge.compare 自比不相等'); }
  if (sandbox.Exercise.clean(SRC) !== SRC) { bad.push('Exercise.clean 改写了无指令的源码'); }
  if (!sandbox.Trace.create(SRC)) { bad.push('Trace.create 返回假值'); }
  if (typeof sandbox.Store.available() !== 'boolean') { bad.push('Store.available 不返回布尔'); }
  if (!Array.isArray(sandbox.PyInteract.filterPrograms([], {}))) {
    bad.push('PyInteract.filterPrograms 不返回数组');
  }
} catch (e) {
  bad.push('浏览器分支冒烟调用抛错：' + e.message);
}
if (bad.length) { bad.forEach(function (b) { console.error('FAIL ' + b); }); process.exit(1); }
console.log('OK ' + spec.length);
''' % (json.dumps([str(p) for p in load_order]), json.dumps(spec))

    proc = run_node(script)
    if proc.returncode != 0:
        print('ERROR: core 模块的**浏览器分支**（vm 裸 context）不可用：', file=sys.stderr)
        print((proc.stderr or proc.stdout).strip(), file=sys.stderr)
        return 1
    print(f'浏览器分支：{len(BROWSER_GLOBALS)} 个 core 模块在裸 vm 沙箱里'
          f'按依赖**反序**装载后全部挂上并可调用')
    return 0
