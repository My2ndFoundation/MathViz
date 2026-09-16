"""C 组 · 语法与运行时。

`node_check` 与 `core_tests` 是照抄 cryptography 的两道；`browser_branch_check`
是这个子项目自己的，守的是 UMD 的**另一条分支**。

> `node -e` **和** `node` 读 stdin **都会定义 `module` 与 `require`**，UMD 会走
> **node** 分支。用那两种方式测浏览器分支，是在检查浏览器里根本不执行的代码——
> **一道测错分支的门比没有门更糟：它广告了一份它并不具备的覆盖。**

所以 `browser_branch_check` 用 `vm` + **裸 context**，而且脚本自己会先断言沙箱
里确实没有 module / require——一道门宣称自己跑在裸沙箱里，得有人去查那句话。

`js_parser_parity_check` 用同一个裸 context，把**真实程序库**喂给页面自己的
`Exercise.parse` / `clean`：D 组解析指令的门全是 Python 写的，而 JS 与 Python 的
正则方言（`.` / `\\s` / `\\b`）并不相同——只在 Python 那一侧看，看不见页面上的坏。
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile

from . import (CORE_DIR, PROGRAMS_DIR, ROOT, SCRIPT_RE, STDIN_LINE_RE,
               all_tool_pages, core_modules, iter_programs, load_registry,
               read_text, root_pages, run_node, tool_pages)

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
  console.error('FAIL 沙箱不干净：module/require 泄漏进来了');
  process.exit(1);
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


# 页面不认、Python 却认的「换行」码位（第 1 期地基终审 G3）。`.py` 里一律不许出现：
#   U+2028 / U+2029 —— JS 正则的 `.` 不匹配它们（它们是 JS 的行终止符），指令行里
#                       有一个，`Exercise.DIRECTIVE_OPEN` 就失配，`clean()` 当场抛；
#                       Python 的 `.` 照样匹配，Python 侧的门全都看不出来。
#   U+0085 (NEL)     —— Python 的 `str.splitlines()` 把它当换行，页面的 `split('\n')`
#                       不当；行数会在两边分岔。
FORBIDDEN_LINE_BREAKS = {'\u2028': 'LINE SEPARATOR', '\u2029': 'PARAGRAPH SEPARATOR',
                         '\u0085': 'NEXT LINE (NEL)'}


def js_parser_parity_check() -> int:
    """在 `vm` **裸 context** 里装载 `py-lex.js` / `exercise.js`，对章目录里的每个
    `.py`（**从磁盘读**，不从 HTML）调页面自己的 `Exercise.parse` 与 `Exercise.clean`。

    为什么需要它（第 1 期地基终审 G3）：在 `swap-two-tuple` 的提示里放一个 U+2028，
    `Exercise.clean()` 抛「<<< BLANK 没有对应的 >>> BLANK」，该程序三种模式全坏——
    而当时的每一道门都是绿的：Python 的 `.` 匹配 U+2028；ASCII 门豁免指令行；U+2028
    不是 C0 控制字节；它在 BMP 内。**库里所有「解析指令」的门都是 Python 写的，页面
    跑的是 JS**——两份解析器在正则方言上的分歧，没有任何一道门站在页面那一侧去看。

    逐项，任何一项不满足都红：
      1. `.py` 里不许有 U+2028 / U+2029 / U+0085（`FORBIDDEN_LINE_BREAKS`）。
      2. `Exercise.parse` / `Exercise.clean` 都不许抛——抛了就点名程序与 JS 的报错。
      3. JS 解析出的挖空 id 列表 == Python 侧（`library.blank_ids`，与
         `blank_directive_check` 同一套摘属性的规则）的 id 列表，顺序也算。
      4. `clean(src)` 的行数（与 `lines` 同一口径：按 `\\n` 切，源码以换行结尾时
         去掉最后那个空尾巴）== 嵌入页面里该程序的 `lines`，逐个比；每页之和 ==
         注册表该工具的 `lines`（注册表只存每页总和）。
      5. 一个程序都没核对到 → 红（跑了个寂寞）。

    第 4 条里「空尾巴」按**源码**是否以 `\\n` 结尾来判，不按 `clean()` 输出的最后
    一个元素是不是空串来判：一个文件若不以换行结尾、最后一行恰是 `# <<< BLANK`、
    挖空体最后一行是空行，`clean()` 输出的末元素是那个真实的空行，不是尾巴。
    """
    from . import library               # 惰性导入：library 导入期会加载 refs

    modules = {p.name: p for p in core_modules()}
    need = ('py-lex.js', 'exercise.js')
    missing = [n for n in need if n not in modules]
    if missing:
        print(f'ERROR: core/ 缺模块 {missing}，无法在页面的解析器上核对程序',
              file=sys.stderr)
        return 1

    rc = 0
    # (显示名, .py 路径, 工具页 id 或 None, 程序 id 或 None)
    targets = []
    listed = set()
    for chapter_dir, data, prog, py_path in iter_programs():
        if not py_path.is_file():
            continue                     # 缺文件由 chapter_manifest_check 报
        listed.add(py_path.resolve())
        targets.append((f'{chapter_dir.name}/{prog.get("id")}', py_path,
                        data.get('tool'), prog.get('id')))
    # 章目录里没被 chapter.json 点名的 .py：不进页面、没有 lines 可比，但照样要
    # 能被页面的解析器吃下去（chapter_manifest_check 会另外报它没登记）。
    for py_path in sorted(PROGRAMS_DIR.glob('ch*/*.py')):
        if py_path.resolve() not in listed:
            targets.append((f'{py_path.parent.name}/{py_path.name}', py_path, None, None))
    if not targets:
        print('ERROR: 一个 .py 都没扫到——这道门跑了个寂寞', file=sys.stderr)
        return 1

    sources = {}
    for name, py_path, _tool, _pid in targets:
        text = py_path.read_bytes().decode('utf-8')   # 不经通用换行转换：node 读的也是原字节
        sources[name] = text
        for n, line in enumerate(text.split('\n'), 1):
            for col, ch in enumerate(line, 1):
                if ch in FORBIDDEN_LINE_BREAKS:
                    print(f'ERROR: {name} 有 U+{ord(ch):04X} {FORBIDDEN_LINE_BREAKS[ch]}：'
                          f'{py_path}:{n}:{col}\n'
                          f'       Python 与页面的 JS 对它是不是「换行」意见不一——'
                          f'.py 里一律不许出现 U+2028 / U+2029 / U+0085',
                          file=sys.stderr)
                    rc = 1

    with tempfile.TemporaryDirectory() as td:
        blocks = []
        for page in tool_pages():
            m = library.PROGRAMS_BLOCK_RE.search(read_text(page))
            if not m or m.group(1).strip() == 'none':
                continue                 # 缺标记 / 弃权由 program_embed_roundtrip_check 等报
            block = os.path.join(td, page.stem + '.js')
            with open(block, 'w', encoding='utf-8') as fh:
                fh.write(m.group(2))
            blocks.append({'page': page.stem, 'file': block})

        script = r'''
const vm = require('vm'), fs = require('fs');
const core = %s;
const progs = %s;
const blocks = %s;
const sandbox = {};
sandbox.self = sandbox;
vm.createContext(sandbox);
if (typeof sandbox.module !== 'undefined' || typeof sandbox.require !== 'undefined') {
  console.error('FAIL 沙箱不干净：module/require 泄漏进来了，测的还是 node 分支');
  process.exit(1);
}
for (const f of core) { vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: f }); }
const E = sandbox.Exercise;
if (!E || typeof E.parse !== 'function' || typeof E.clean !== 'function') {
  console.error('FAIL 裸沙箱里没有可调用的 Exercise.parse / Exercise.clean');
  process.exit(1);
}
const out = { programs: {}, pages: {} };
for (const p of progs) {
  const src = fs.readFileSync(p.path, 'utf8');
  const r = {};
  try { r.ids = E.parse(src).blanks.map(function (b) { return b.id; }); }
  catch (e) { r.parseError = String(e && e.message); }
  try {
    let n = E.clean(src).split('\n').length;
    if (src === '' || src.charAt(src.length - 1) === '\n') { n--; }
    r.lines = n;
  } catch (e) { r.cleanError = String(e && e.message); }
  out.programs[p.name] = r;
}
for (const b of blocks) {
  const sb = {};
  sb.self = sb;
  vm.createContext(sb);
  try {
    vm.runInContext(fs.readFileSync(b.file, 'utf8'), sb);
    out.pages[b.page] = { programs: sb.PyPrograms.programs.map(function (x) {
      return { id: x.id, lines: x.lines };
    }) };
  } catch (e) { out.pages[b.page] = { error: String(e && e.message) }; }
}
process.stdout.write(JSON.stringify(out));
''' % (json.dumps([str(modules[n]) for n in need]),
       json.dumps([{'name': name, 'path': str(p)} for name, p, _t, _i in targets]),
       json.dumps(blocks))
        proc = run_node(script)

    if proc.returncode != 0:
        print('ERROR: 在 vm 裸 context 里装载 py-lex.js / exercise.js 失败：', file=sys.stderr)
        print((proc.stderr or proc.stdout).strip(), file=sys.stderr)
        return 1
    got = json.loads(proc.stdout)

    embedded = {}                        # 工具页 id -> {程序 id: lines}
    for page, info in got['pages'].items():
        if 'error' in info:
            print(f'ERROR: {page}.html 的 GENERATED:PROGRAMS 块在裸 vm 里求值失败：'
                  f'{info["error"]}', file=sys.stderr)
            rc = 1
            continue
        embedded[page] = {x['id']: x['lines'] for x in info['programs']}

    checked = 0
    page_sums: dict = {}
    uncounted = set()                    # 有程序没数出行数的工具：加总无意义，不再比注册表
    for name, py_path, tool, pid in targets:
        r = got['programs'][name]
        bad = False
        for key, fn in (('parseError', 'parse'), ('cleanError', 'clean')):
            if key in r:
                mode = '挖空模式' if fn == 'parse' else '读 / 临摹模式'
                print(f'ERROR: {name} 在页面的解析器上 Exercise.{fn}() 抛错——这个程序在'
                      f'页面的{mode}里打不开：{py_path}\n'
                      f'       JS：{r[key]}', file=sys.stderr)
                rc = 1
                bad = True
        if 'ids' in r:
            py_ids = library.blank_ids(sources[name])
            if r['ids'] != py_ids:
                print(f'ERROR: {name} 的挖空 id 两边解析得不一样：{py_path}\n'
                      f'       页面 Exercise.parse：{r["ids"]}\n'
                      f'       门 library.blank_ids：{py_ids}\n'
                      f'       两份解析器在正则方言上分岔了（\\b / \\s / . 在 JS 与 Python '
                      f'里含义不同）——门验的不是页面看到的那份', file=sys.stderr)
                rc = 1
                bad = True
        if 'lines' not in r and tool is not None:
            uncounted.add(tool)
        if 'lines' in r and tool is not None:
            page_sums[tool] = page_sums.get(tool, 0) + r['lines']
            want = embedded.get(tool, {}).get(pid)
            if want is None:
                print(f'ERROR: {name} 在 {tool}.html 的嵌入数据里找不到 lines——'
                      f'没法核对页面显示的行数（修复：python3 python/scripts/'
                      f'build_programs.py）', file=sys.stderr)
                rc = 1
                bad = True
            elif want != r['lines']:
                print(f'ERROR: {name} 嵌入页面的 lines={want!r}，页面自己的 clean() '
                      f'数出来是 {r["lines"]}：{py_path}\n'
                      f'       口径：按 \\n 切、去掉末尾换行的空尾巴、不含 BLANK 指令行',
                      file=sys.stderr)
                rc = 1
                bad = True
        if not bad:
            checked += 1

    by_id = {t.get('id'): t for t in load_registry().get('tools') or []}
    for tool, total in sorted(page_sums.items()):
        entry = by_id.get(tool)
        if entry is None or tool in uncounted:
            continue                     # 前者由 program_count_check 报；后者上面已经红过
        if entry.get('lines') != total:
            print(f'ERROR: 注册表 {tool} 的 lines={entry.get("lines")!r}，页面的 clean() '
                  f'逐程序数出来加总是 {total}', file=sys.stderr)
            rc = 1

    if checked == 0 and rc == 0:
        print('ERROR: 一个程序都没核对到——这道门跑了个寂寞', file=sys.stderr)
        return 1
    if rc == 0:
        print(f'JS 解析器对齐：{len(targets)} 个 .py 在裸 vm 里过 Exercise.parse/clean 不抛，'
              f'挖空 id 与门的解析一致，clean() 行数与嵌入的 lines、'
              f'{len(page_sums)} 个工具的注册表 lines 一致；无 U+2028/U+2029/U+0085')
    return rc
