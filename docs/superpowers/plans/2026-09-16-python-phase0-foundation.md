# Python 子项目 · 第 0 期（地基）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建起 `python/` 子项目的全部地基——七个 core 模块、三个构建/校验脚本、
两个导航页、全部校验门与负控制、根仓接线——并用一个真实页面 `py-basics`（10 个程序）
把它们全部走通。

**Architecture:** 与 `chess/` `cryptography/` 平级的第三个子项目，同构但无 canvas、
无运行时。`core/**/*.js` 与 `programs/**/*.py` 是唯二编辑源，两个生成脚本把它们
注入 `tools/*.html` 的 `GENERATED:*` 区段，每页自足、`file://` 双击可用。
程序是真的 `.py` 文件，由门在构建期用 CPython 真跑、真比对。

**Tech Stack:** 零依赖。浏览器端纯 ES5+/UMD 的 JS（node 与浏览器双用），
构建与校验用 python3 标准库，测试用 node 跑 `core/*.test.js`。

**Spec:** `docs/superpowers/specs/2026-09-16-python-subproject-design.md`

---

## Global Constraints

每个任务的要求都隐含包含本节。值全部逐字来自 spec。

1. **单文件、零依赖、`file://` 可开。** 不引入任何 npm 包、CDN、测试框架、构建器。
2. **全目录只有一处父目录相对路径**：`PARENT_HOME = '../app.html'`，
   `python/app.html` 与 `python/index.html` 各一份。`core/` `programs/` `tools/` 里零次。
3. **注册表隔离。** `python/python-tools.json` 只指向 `python/tools/*.html`。
   绝不把 Python 工具写进根 `tools.json`。
4. **无运行时。** 浏览器里不执行 Python。
5. **默认语言 en。** `resolveLang()` 与 `t()` 的兜底字面量是 `'en'`。
   存储键前缀 `python-`；导航两键是 `python-lang` / `python-nav`。
6. **程序源码纯 ASCII、注释一律英文。** 中文只出现在 `chapter.json` 的
   `title` / `blurb` / `notes` / `lineNotes` 与 UI 文案里。
   **唯一豁免：`# >>> BLANK` 指令行的 `hint="…"`**——它按双语设计就该是中文
   （`hintEn` 才是英文），而指令行**永远不进入任何渲染层**（见接口表的
   `Exercise.clean`），所以三层对齐与复制保真都不受影响。
   `source_ascii_check()` 必须跳过指令行。
7. **缩进只用 4 个空格；`.py` 里不许出现制表符；行尾 LF；行末无多余空白。**
8. **accent 闭集** `{cyan, rose, violet, emerald, orange}`，退路 `--trace-unpaired`。
   `module` 闭集 `1..8`。第 0 期只用到 `module: 1`、`accent: 'cyan'`。
9. **UMD 依赖一律惰性取**：`factory(function () { return root.PyLex; })`，
   **禁止** `factory(root.PyLex)`。
10. **任何 `.js` 里不许出现 `<` + `script` + `>` 字面序列**，注释里也不行。
11. **所有 node 调用走 stdin**，不走 `node -e '<大段脚本>'`（Linux 单个 argv 上限
    `MAX_ARG_STRLEN = 131072`，macOS 没有——本仓为此 CI 假绿过四次合并）。
12. **派生字段一律不手写**：`chapter.json` 不写 `lines`；注册表的 `programs` / `lines`
    由脚本写回。
13. **负控制纪律**：一道门在你把它守的东西改坏、看到它变红之前不算数。
    每个负控制先跑一次确认**基线是绿的**；破坏后恢复**必须从内存里的原字节写回**，
    **绝不用 `git checkout`**（会抹掉别的会话未提交的工作）。
14. **提交时显式列路径，绝不 `git add -A` / `git commit -a`。**
    `.githooks/pre-commit` 会重跑生成脚本并再暂存文件——**hook 跑完后要读一遍
    `git status --short` 的每一行**，不是只在跑之前读。

---

## File Structure

```
python/
  app.html                     导航壳（侧边栏 + iframe 舞台）          T11
  index.html                   画廊（按 module 分组的卡片）            T11
  python-tools.json            注册表（第 0 期 1 条：py-basics）        T13
  core/
    _test.js                   微型断言 harness（照抄 cryptography）    T1
    py-lex.js                  Python 词法器                            T1
    store.js                   localStorage：草稿/进度/三级清空          T2
    exercise.js                BLANK 指令解析                           T3
    editor.js                  片段化高亮 + Tab/Enter + 行号            T6
    judge.js                   token 级严格比对                         T7
    trace.js                   影子临摹引擎                             T8
    interact.js                页面装配                                 T12
    *.test.js                  各自的测试，与被测模块同任务交付
  programs/
    ch01-basics/
      chapter.json             本章元数据                               T5
      *.py                     10 个程序                                T5
  tools/
    _skeleton.html             模板（参与内联）                          T13
    py-basics.html             第一个真页面                              T13
  scripts/
    inline_core.py             注入 core 的各 GENERATED 区段             T9
    build_programs.py          注入 GENERATED:PROGRAMS                   T10
    check.py                   门的运行器                                T14
    gates/
      __init__.py
      registry.py              A 组：注册表与镜像                        T14
      hygiene.py               B 组：可搬迁与卫生                        T14
      syntax.py                C 组：语法与执行                          T14
      library.py               D 组：程序库（run/compile/meta/…）        T14
      lexer.py                 D 组：词法器三道往返/对表门               T14
      properties.py            property 参考实现登记表                   T10
scripts/check_nav_contract.py  根级：六个导航页的契约门                  T15
chess/scripts/check.py         补 registry_check()                       T4
```

> **为什么 `gates/` 是一个包，而 chess/cryptography 是单文件 `check.py`。**
> 那两个子项目分别是 ~700 行和 1140 行；这里是 29 道门，单文件会到 ~1800 行，
> 而且本期要由多个并行的实现者同时写——同一个文件会成为串行瓶颈与冲突源。
> `check.py` 保留为运行器（导入各模块、无条件跑完、按「任一失败则整体失败」汇总），
> 每组门住在自己的文件里。这是既有模式的演进，不是另起炉灶。

---

## 并行波次

| 波 | 任务 | 可同时开工 |
|---|---|---|
| **A** | T1 py-lex · T2 store · T3 exercise · T4 chess registry_check · T5 ch01 内容 | 5 路并行 |
| **B** | T6 editor · T7 judge · T8 trace | 3 路并行 |
| **C** | T9 inline_core · T10 build_programs+properties · T11 app/index 导航壳 | 3 路并行 |
| **D** | T12 interact | 1 路 |
| **E** | T13 skeleton + py-basics 页面 | 1 路 |
| **F** | T14 check.py + gates/ · T15 根接线 + nav 契约门 | 2 路并行 |

每个并行实现者用**自己的 git worktree**（`isolation: "worktree"`），
临时文件前缀用任务号（`t1-probe.py`，不要 `probe.py`）。

---

## 接口总表（并行实现者的唯一契约）

所有模块都是 UMD，node 下 `module.exports`，浏览器下挂到 `root.<Name>`。
**依赖惰性取**（Global Constraint 9）。

```js
// ── PyLex（T1）────────────────────────────────────────────────
PyLex.tokenize(src) -> Token[]
//   Token = { type: string, start: number, end: number }
//   type ∈ 'ws' | 'nl' | 'comment' | 'keyword' | 'softkw' | 'builtin' | 'name'
//          | 'number' | 'string' | 'fstring' | 'op' | 'punct' | 'decorator'
//   不变量（构造性，不是靠测试）：
//     tokens[0].start === 0
//     tokens[i].end === tokens[i+1].start        （无缝）
//     tokens[tokens.length-1].end === src.length （全覆盖）
//   永不抛错。src === '' 时返回 []。
PyLex.significant(tokens) -> Token[]     // 滤掉 ws / nl / comment
PyLex.KEYWORDS  -> object                // { 'if': 1, 'def': 1, … } 真关键字
PyLex.SOFTKW    -> object                // { 'match': 1, 'case': 1, 'type': 1, '_': 1 }
PyLex.BUILTINS  -> object                // { 'print': 1, 'len': 1, 'range': 1, … }

// ── Editor（T6）───────────────────────────────────────────────
Editor.highlight(src) -> Fragment[]
//   Fragment = { text: string, cls: string }   cls = 'tok-' + token.type
//   不变量：fragments.map(f => f.text).join('') === src
Editor.lineStarts(src) -> number[]              // 每行起始偏移，含第 0 行
Editor.indentOf(line) -> number                 // 前导空格数
Editor.applyTab(value, selStart, selEnd) -> { value, selStart, selEnd }
Editor.applyEnter(value, selStart) -> { value, selStart }
//   applyEnter：沿用上一行缩进；上一行 rstrip 后以 ':' 结尾则 +4

// ── Exercise（T3）─────────────────────────────────────────────
Exercise.parse(src) -> {
  blanks: [ { id, level, hint, hintEn, body, indent, line } ],
  //   body   = 挖空体原文（不含两条指令行，不含尾随换行）
  //   indent = 挖空体第一行的前导空白（字符串）
  //   line   = 该空在 stripped 里占的行号（0-based）
  stripped: string,      // 指令行删除，挖空体换成单行 `<indent>___`
  lineMap: [ { kind: 'code' | 'blank', blankId: string|null, srcLine: number } ]
  //   stripped 每一行一条
}
Exercise.clean(src) -> string
//   剥掉两种指令行、**保留挖空体原文**。读模式显示的、临摹要打的、复制出去的
//   都是它——裸 `source` 里带着 `# >>> BLANK …`，直接拿去显示就是把出题标记
//   摆给学习者看，拿去临摹就是让她把中文提示也打一遍。
Exercise.merge(src, answers) -> string
//   answers = { [blankId]: string }；把 src 里每个挖空体（含两条指令行）换成答案文本，
//   缺的 id 用原 body。返回可直接复制进 PyCharm 的完整程序。
Exercise.DIRECTIVE_OPEN  = /^\s*#\s*>>>\s*BLANK\s+(.*)$/
Exercise.DIRECTIVE_CLOSE = /^\s*#\s*<<<\s*BLANK\s*$/

// ── Judge（T7）────────────────────────────────────────────────
Judge.normalize(src) -> { toks: [ { text, line, col } ], rel: number[] }
//   toks = 去掉 ws/nl/comment 后各 token 的**原文切片**
//   rel  = 每一行相对第一行的缩进差（参与比对）
Judge.compare(answer, reference) -> {
  ok: boolean,
  index: number,        // 第一处不同的 token 序号；ok 时为 -1
  expected: string|null,
  got: string|null,
  kind: 'equal' | 'different' | 'missing' | 'extra' | 'indent'
}

// ── Trace（T8）────────────────────────────────────────────────
Trace.create(reference) -> session
session.update(typed) -> {
  marks: [ { index: number, state: 'ok' | 'bad' } ],   // 只列已输入的位置
  stats: { correct, total, errors, backspaces, elapsedMs, cpm, accuracy, lineTimes }
}
session.noteBackspace()
session.reset()
Trace.IDLE_PAUSE_MS = 10000      // 失焦/停手超过它就暂停计时
Trace.alignLines(reference, typed) -> [ { refLine, typedLine } ]
//   以行为同步单位；行内按位置对齐，一行打错不跨行传染

// ── Store（T2）────────────────────────────────────────────────
Store.available() -> boolean
Store.getDraft(progId, mode) -> string | null        // mode ∈ 'blank' | 'trace'
Store.setDraft(progId, mode, text)                   // 立即写
Store.scheduleDraft(progId, mode, text)              // 防抖 400ms 写
Store.flush()                                        // 立刻落盘所有待写
Store.getProgress(progId) -> object | null
Store.patchProgress(progId, patch)
Store.getPrefs() -> object
Store.setPrefs(patch)
Store.countRecords(progIds) -> number                // 「将清除 N 条记录」
Store.clearProgram(progId, modes)                    // modes = ['blank','trace']
Store.clearMany(progIds)                             // 模块级
Store.clearAll(opts)                                 // { prefs: false } 默认保留偏好与语言
Store.onUnavailable(cb)                              // 配额满/被禁用时回调一次
Store.DEBOUNCE_MS = 400
Store.SCHEMA_VERSION = 1

// ── PyPrograms（T10 生成，注入 GENERATED:PROGRAMS）─────────────
PyPrograms = { module: 1, tool: 'py-basics', programs: [ /* §2.3 的对象，外加 lines */ ] }

// ── PyInteract（T12）──────────────────────────────────────────
PyInteract.mount({ root, programs, lang }) -> controller
controller.setMode('read'|'blank'|'trace')
controller.setProgram(progId)
controller.setLang('en'|'zh')
```

---

# 波次 A（5 路并行）

---

### Task 1: `py-lex.js` —— Python 词法器

**Files:**
- Create: `python/core/_test.js`（从 `cryptography/core/_test.js` 逐字节复制，只改首行注释里的子项目名）
- Create: `python/core/py-lex.js`
- Test: `python/core/py-lex.test.js`

**Interfaces:**
- Consumes: 无。这是第一块地基。
- Produces: `PyLex.tokenize` / `significant` / `KEYWORDS` / `SOFTKW` / `BUILTINS`，签名见「接口总表」。
  T6 editor、T7 judge、T14 的三道词法门都直接依赖它。

**为什么这个词法器不抛错**（写进文件头注释，实现者必须理解这一条再动手）：
三层临摹结构要求「片段拼回去逐字节等于原文」。如果 tokenize 会抛，就必须有降级路径，
而 chess 的 `editor.js` 选的整篇降级代价写在它自己的注释里——「一个引号没有闭合期间，
整份文档都会短暂失去颜色」。使用者打字打到一半源码几乎总是暂时不合法，那个代价会一直付。
这里改成**构造性保证**：任何输入都产出无缝覆盖 `[0, len)` 的 token 序列，
未闭合的三引号就一直吃到文件尾，孤立反斜杠当一个 op。于是往返不变量不需要降级路径。

- [ ] **Step 1: 复制测试 harness，写第一批失败的测试**

```bash
cp cryptography/core/_test.js python/core/_test.js
# 把首行注释里的「本子项目」措辞改成 python 子项目；其余逐字节保持
```

`python/core/py-lex.test.js`：

```js
'use strict';
const T = require('./_test.js');
const PyLex = require('./py-lex.js');

/* ---- 不变量：无缝、全覆盖、永不抛错 ---- */
function assertSeamless(src, label) {
  const toks = PyLex.tokenize(src);
  if (src === '') { T.eq(toks, [], label + ' · 空串返回空数组'); return; }
  T.eq(toks[0].start, 0, label + ' · 首 token 从 0 开始');
  T.eq(toks[toks.length - 1].end, src.length, label + ' · 末 token 覆盖到结尾');
  let seamless = true;
  for (let i = 0; i + 1 < toks.length; i++) {
    if (toks[i].end !== toks[i + 1].start) { seamless = false; break; }
  }
  T.ok(seamless, label + ' · token 区间无缝');
  const rebuilt = toks.map(t => src.slice(t.start, t.end)).join('');
  T.eq(rebuilt, src, label + ' · 切片拼回与原文逐字节相同');
}

const CORPUS = [
  '',
  'x = 1\n',
  'def f(a, b=2, *args, **kw):\n    return a // b\n',
  '# only a comment\n',
  's = "double" + \'single\'\n',
  'doc = """line one\nline two"""\n',
  'f1 = f"{name!r:>{width}} ok"\n',
  'r = rb"\\x00raw" + FR\'\\d+\'\n',
  'n = 0x1f + 0o17 + 0b1010 + 1_000_000 + 1e10 + 1.5j\n',
  'walrus = (y := 3)\n',
  'def g() -> int:\n    return 1\n',
  '@decorator\nclass C:\n    pass\n',
  'total = a \\\n    + b\n',
  'match cmd:\n    case "go":\n        pass\n',
  'x = 1 if a else 2  # trailing\n',
  'a @= b\nc **= 2\nd //= 3\n',
];

/* 畸形语料：这些都**不许抛**，且必须照样满足三条不变量 */
const MALFORMED = [
  '"unterminated',
  "'''never closed\nstill going",
  'x = \\',
  'f"{unclosed',
  '\ufeffx = 1\n',
  'y = "a" "b',
  '0x',
  '1e',
];

CORPUS.concat(MALFORMED).forEach(function (src, i) {
  let threw = null;
  try { PyLex.tokenize(src); } catch (e) { threw = e; }
  T.eq(threw, null, '语料 #' + i + ' 不抛错');
  assertSeamless(src, '语料 #' + i);
});

/* ---- 分类：拿几处关键切分点钉死 ---- */
function typesOf(src) {
  return PyLex.significant(PyLex.tokenize(src)).map(t => t.type + ':' + src.slice(t.start, t.end));
}

T.eq(typesOf('x = 1\n'), ['name:x', 'op:=', 'number:1'], '最简赋值');
T.eq(typesOf('a // b\n'), ['name:a', 'op://', 'name:b'], '整除是一个 token，不是两个 /');
T.eq(typesOf('a ** b\n'), ['name:a', 'op:**', 'name:b'], '幂是一个 token');
T.eq(typesOf('(y := 3)\n'), ['punct:(', 'name:y', 'op::=', 'number:3', 'punct:)'], '海象是一个 token');
T.eq(typesOf('def f() -> int:\n'),
     ['keyword:def', 'name:f', 'punct:(', 'punct:)', 'op:->', 'builtin:int', 'punct::'],
     '箭头是一个 token；int 是 builtin 不是 name');
T.eq(typesOf('print(len(s))\n'),
     ['builtin:print', 'punct:(', 'builtin:len', 'punct:(', 'name:s', 'punct:)', 'punct:)'],
     'print / len 归类为 builtin');
T.eq(typesOf('match x:\n'), ['softkw:match', 'name:x', 'punct::'], 'match 是软关键字');
T.eq(typesOf('m = match\n'), ['name:m', 'op:=', 'softkw:match'], '软关键字在任何位置都归 softkw（简化：不看上下文）');
T.eq(typesOf('n = 1_000_000\n'), ['name:n', 'op:=', 'number:1_000_000'], '下划线数字是一个 token');
T.eq(typesOf('z = 1.5j\n'), ['name:z', 'op:=', 'number:1.5j'], '虚数后缀属于数字');
T.eq(typesOf('s = rb"\\x00"\n'), ['name:s', 'op:=', 'string:rb"\\x00"'], '前缀属于字符串 token');
T.eq(typesOf('s = f"{a}"\n'), ['name:s', 'op:=', 'fstring:f"{a}"'], 'f 串单独归类 fstring');
T.eq(typesOf('@dec\n'), ['decorator:@dec'], '装饰器整体一个 token');
T.eq(typesOf('x = 1  # tail\n'), ['name:x', 'op:=', 'number:1'], 'significant 滤掉注释');

/* 三引号跨行 */
(function () {
  const src = 'doc = """a\nb"""\nx = 1\n';
  const t = typesOf(src);
  T.eq(t[2], 'string:"""a\nb"""', '三引号跨行是一个 token');
  T.eq(t[3], 'name:x', '三引号之后继续正常切词');
})();

/* 未闭合三引号：吃到文件尾，且仍然无缝 */
(function () {
  const src = 'doc = """a\nb\n';
  const toks = PyLex.tokenize(src);
  T.eq(toks[toks.length - 1].end, src.length, '未闭合三引号吃到文件尾');
})();

T.report('py-lex');
```

- [ ] **Step 2: 跑测试，确认它失败**

Run: `node python/core/py-lex.test.js`
Expected: FAIL —— `Cannot find module './py-lex.js'`

- [ ] **Step 3: 实现 `py-lex.js`**

UMD 外壳（**这是本仓所有 core 模块的统一形状，后续任务照抄**）：

```js
'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PyLex = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // …实现…
  return { tokenize, significant, KEYWORDS, SOFTKW, BUILTINS };
});
```

实现要点（按扫描顺序）：

1. 主循环 `while (i < n)`，每一轮**必须**推进 `i`，且每一轮都 push 一个 token
   —— 这两条一起保证无缝与终止。
2. `\n` / `\r\n` → `nl`；其他空白连续吃完 → `ws`。
3. `#` 吃到行尾（不含换行）→ `comment`。
4. `@` **只有在它是该逻辑行的第一个有效 token 时**才是 `decorator`（`@` + 点分名字）；
   否则一律是 `op`（`@=` / `@`）。实测依据：CPython 对 `c = a@b` 给的是 `OP @` + `NAME b`
   ——不加这个限定，无空格的矩阵乘会被读成装饰器，而 numpy 那几页到处是 `a @ b`。
5. 字符串：先尝试匹配前缀 `[rRbBuUfF]{0,3}`（且是 `r`/`b`/`u`/`f` 的合法组合）后接引号。
   三引号优先于单引号。带 `f` 的归 `fstring`，其余归 `string`。
   **转义 `\\` 在 raw 串里同样挡住收尾引号**（实测：CPython 把 `r"\\""` 切成一个 STRING
   token）——若照"raw 串里反斜杠无特殊含义"处理，`r"\\""` 会让串一路开到文件尾，
   正是本模块要防的那种失败。
   **未闭合时：三引号吃到文件尾，单引号止于行尾。** 后者 CPython 直接抛 TokenError，
   没有标准可依；止于行尾把一个打了一半的引号的破坏限制在一行内，
   吃到文件尾则会让下面整篇失色——那正是 chess 整篇降级的同一种代价。
6. 数字：`0x/0X` `0o/0O` `0b/0B` 前缀走各自字符集；否则十进制，允许 `_`、小数点、
   `e/E` 指数（含符号）、结尾 `j/J`。**`0x` 与 `1e` 这种残缺写法也要吃掉已有字符
   并归 `number`**，不抛。
7. 标识符：`[A-Za-z_]\w*`。查表 → `keyword` / `softkw` / `builtin` / `name`。
8. 运算符：**按长度从长到短**匹配，表为
   `['//=', '**=', '>>=', '<<=', '...', '!=', '==', '>=', '<=', '//', '**', '->', ':=',
     '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '@=', '>>', '<<',
     '+', '-', '*', '/', '%', '&', '|', '^', '~', '<', '>', '=', '@']`。
   长度顺序错了 `//` 会被切成两个 `/`——这正是 T14 `lex_vs_cpython_check` 的负控制。
9. `punct`：`( ) [ ] { } , : ; .`
10. 反斜杠续行与任何落单字符：吃一个字符，归 `op`。**绝不抛错、绝不跳过。**

`KEYWORDS` 用 Python 3.12 的 `keyword.kwlist`；`SOFTKW` 用 `keyword.softkwlist`
（`_`, `case`, `match`, `type`）。`BUILTINS` 取 `dir(builtins)` 里不以 `_` 开头的名字。
生成一次、写成字面量，并在文件头注释里记下它是用哪条命令生成的：

```bash
python3 -c "import keyword,builtins,json; print(json.dumps({'kw':keyword.kwlist,'soft':keyword.softkwlist,'bi':[n for n in dir(builtins) if not n.startswith('_')]}))"
```

- [ ] **Step 4: 跑测试，确认全绿**

Run: `node python/core/py-lex.test.js`
Expected: PASS —— 输出 `py-lex: N 条断言全部通过`

- [ ] **Step 5: 负控制 —— 把长度顺序弄反，确认测试变红**

把运算符表里的 `'//'` 移到 `'/'` 后面，重跑，必须看到 `整除是一个 token` 失败。
**从内存里改回来**（不要 `git checkout`）。

- [ ] **Step 6: 提交**

```bash
git add python/core/_test.js python/core/py-lex.js python/core/py-lex.test.js
git commit -m "feat(python): Python 词法器 —— 全覆盖、不抛错

三层临摹要求片段拼回去逐字节等于原文。做法不是「出错就整篇降级成纯文本」
（chess 的 editor.js 那条路，代价是一个引号没闭合期间整页失色），而是让
tokenize 对任何输入都产出无缝覆盖 [0,len) 的序列：未闭合三引号吃到文件尾、
孤立反斜杠当一个 op。往返不变量因此是构造性成立的，不需要降级路径。"
```

---

### Task 2: `store.js` —— 草稿、进度与三级清空

**Files:**
- Create: `python/core/store.js`
- Test: `python/core/store.test.js`

**Interfaces:**
- Consumes: 无（不依赖任何其他 core 模块）。
- Produces: `Store.*`，签名见「接口总表」。T12 interact 直接用。

**两条不可违背的纪律：**

1. **`Store` 不认识任何一道题，也不认识模块。** 清空 API 收 id 列表，由调用方从程序库拿。
   （chess 的 `exercise.js` 同一条纪律。）
2. **失败绝不静默。** `QuotaExceededError`、`file://` 下被禁用、Safari 的古怪行为，
   都要走 `onUnavailable` 回调让 UI 挂出持久横幅。她以为存住了而其实没有，
   是这套东西最坏的失败方式。

- [ ] **Step 1: 写失败的测试**

`python/core/store.test.js`：

```js
'use strict';
const T = require('./_test.js');

/* node 下没有 localStorage：装一个可控的假的，顺便用它模拟配额爆掉。 */
function makeFakeStorage(limitBytes) {
  const map = Object.create(null);
  let used = 0;
  return {
    get length() { return Object.keys(map).length; },
    key(i) { return Object.keys(map)[i]; },
    getItem(k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
    setItem(k, v) {
      const delta = String(k).length + String(v).length;
      if (limitBytes != null && used + delta > limitBytes) {
        const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e;
      }
      used += delta; map[k] = String(v);
    },
    removeItem(k) {
      if (Object.prototype.hasOwnProperty.call(map, k)) {
        used -= k.length + map[k].length; delete map[k];
      }
    },
    _keys() { return Object.keys(map); }
  };
}

const Store = require('./store.js');

/* ---- 基本读写 ---- */
Store._useStorage(makeFakeStorage(null));
T.eq(Store.available(), true, '装上假存储后可用');
Store.setDraft('hello-name', 'trace', 'print("hi")');
T.eq(Store.getDraft('hello-name', 'trace'), 'print("hi")', '草稿读回');
T.eq(Store.getDraft('hello-name', 'blank'), null, '另一个模式互不干扰');

/* ---- 键名形状（缓存键与清空都靠它，钉死）---- */
T.ok(Store._useStorage(makeFakeStorage(null)) === undefined || true, '换一块干净存储');
Store.setDraft('p1', 'blank', 'x');
Store.patchProgress('p1', { blank: { done: true } });
Store.setPrefs({ alpha: 0.35 });
const keys = Store._storage()._keys().sort();
T.eq(keys, ['python-draft:p1:blank', 'python-prefs', 'python-progress:p1', 'python-store-v'],
     '键名与 schema 版本键');

/* ---- 三级清空 ---- */
Store._useStorage(makeFakeStorage(null));
['a', 'b', 'c'].forEach(id => {
  Store.setDraft(id, 'blank', 'B' + id);
  Store.setDraft(id, 'trace', 'T' + id);
  Store.patchProgress(id, { trace: { bestCpm: 100 } });
});
T.eq(Store.countRecords(['a', 'b', 'c']), 9, '三题 × (2 草稿 + 1 进度) = 9 条');
Store.clearProgram('a', ['blank']);
T.eq(Store.getDraft('a', 'blank'), null, '单题单模式清空');
T.eq(Store.getDraft('a', 'trace'), 'Ta', '同题另一模式不受影响');
T.eq(Store.getProgress('a') != null, true, '清草稿不动进度');
Store.clearMany(['a', 'b']);
T.eq(Store.getDraft('b', 'trace'), null, '模块级清空覆盖 b');
T.eq(Store.getDraft('c', 'trace'), 'Tc', '模块级清空不越界到 c');
Store.setPrefs({ alpha: 0.5 });
Store.clearAll({});
T.eq(Store.getDraft('c', 'trace'), null, '整项清空扫掉草稿');
T.eq(Store.getProgress('c'), null, '整项清空扫掉进度');
T.eq(Store.getPrefs().alpha, 0.5, '整项清空默认保留偏好');
Store.clearAll({ prefs: true });
T.eq(Store.getPrefs().alpha, undefined, '全部重置连偏好一起清');

/* ---- 配额爆掉必须喊出来，不能静默 ---- */
(function () {
  let called = 0, lastReason = null;
  Store._useStorage(makeFakeStorage(60));
  Store.onUnavailable(function (reason) { called++; lastReason = reason; });
  Store.setDraft('big', 'trace', 'x'.repeat(500));
  T.eq(called, 1, '配额爆掉时回调恰好一次');
  T.eq(lastReason, 'quota', '回调带上原因');
  T.eq(Store.getDraft('big', 'trace'), 'x'.repeat(500), '降级到内存后仍读得回来');
})();

/* ---- localStorage 整个不可用（file:// / 隐私模式）---- */
(function () {
  let called = 0;
  Store._useStorage({ getItem() { throw new Error('denied'); },
                      setItem() { throw new Error('denied'); },
                      removeItem() { throw new Error('denied'); },
                      get length() { return 0; }, key() { return null; } });
  Store.onUnavailable(function () { called++; });
  T.eq(Store.available(), false, '存储不可用时 available() 为 false');
  Store.setDraft('x', 'trace', 'v');
  T.eq(Store.getDraft('x', 'trace'), 'v', '不可用时仍走内存，不丢当前会话');
  T.ok(called >= 1, '不可用时也回调');
})();

/* ---- 防抖 ---- */
(function (done) {
  Store._useStorage(makeFakeStorage(null));
  Store.scheduleDraft('deb', 'trace', 'v1');
  Store.scheduleDraft('deb', 'trace', 'v2');
  T.eq(Store.getDraft('deb', 'trace'), null, '防抖期内尚未落盘');
  Store.flush();
  T.eq(Store.getDraft('deb', 'trace'), 'v2', 'flush 落最后一次的值');
})();

T.report('store');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node python/core/store.test.js`
Expected: FAIL —— `Cannot find module './store.js'`

- [ ] **Step 3: 实现 `store.js`**

要点：

- UMD 外壳同 T1。浏览器分支里默认 `_useStorage(root.localStorage)`（包 try/catch，
  取 `localStorage` 这个动作本身在某些环境就会抛）。
- `_useStorage(s)` / `_storage()` 是**测试注入口**，用下划线前缀标明非公开 API。
  没有它，这个模块在 node 下根本无法测——而它恰恰是最容易静默坏掉的模块。
- 内部维护一份 `memory` 映射作为影子层：**所有读先读 memory、再读存储**；
  写时先写 memory 再试存储，存储抛错就记下降级状态并触发一次 `onUnavailable`。
  「回调恰好一次」靠一个 `notified` 标志。
- `countRecords(ids)` 数的是真实存在的键，不是 `ids.length * 3`。
- `clearAll({prefs:false})` 扫 `python-draft:` 与 `python-progress:` 两个前缀，
  **不动** `python-lang` / `python-nav` / `python-prefs` / `python-store-v`。
- `scheduleDraft` 用 `setTimeout` 防抖 `DEBOUNCE_MS`；`flush()` 清掉待定定时器并立即写。
  浏览器侧由 T12 在 `visibilitychange` / `pagehide` 上调 `flush()`。
- 启动时读 `python-store-v`：缺失就写入 `SCHEMA_VERSION`；值不等于当前版本就
  **清掉 draft/progress 两个前缀**并写入新版本（安全丢弃优于错误迁移），
  且触发 `onUnavailable('migrated')` 让 UI 能说一句。

- [ ] **Step 4: 跑测试确认全绿**

Run: `node python/core/store.test.js`
Expected: PASS

- [ ] **Step 5: 负控制 —— 让配额失败静默**

把 `setItem` 的 try/catch 里触发 `onUnavailable` 的那一行注释掉，重跑，
必须看到 `配额爆掉时回调恰好一次` 失败。从内存改回来。

- [ ] **Step 6: 提交**

```bash
git add python/core/store.js python/core/store.test.js
git commit -m "feat(python): localStorage 层 —— 边输边存、三级清空、失败不静默

存储失败有两种形状都会静默地骗人：配额爆掉，和 file:// 下 localStorage 被禁用。
两种都走 onUnavailable 回调，由 UI 挂持久横幅。她以为存住了而其实没有，是这套
东西最坏的失败方式。

Store 不认识任何一道题也不认识模块：清空 API 收 id 列表，由调用方从程序库拿。"
```

---

### Task 3: `exercise.js` —— BLANK 指令解析

**Files:**
- Create: `python/core/exercise.js`
- Test: `python/core/exercise.test.js`

**Interfaces:**
- Consumes: 无（纯文本处理，不依赖 PyLex）。
- Produces: `Exercise.parse` / `Exercise.merge`，签名见「接口总表」。T12、T14 用。

**指令形状**（Python 注释，所以带着标准答案的 `.py` 本身仍然能跑）：

```python
# >>> BLANK id=mid level=2 hint="用整除算中点" hintEn="use floor division for the midpoint"
        mid = (lo + hi) // 2
# <<< BLANK
```

`id=` / `level=` 是裸值（读到下一个空白为止），`hint=` / `hintEn=` 是双引号串。
属性顺序不作要求，**四个都必须出现**。

- [ ] **Step 1: 写失败的测试**

```js
'use strict';
const T = require('./_test.js');
const Ex = require('./exercise.js');

const SRC = [
  'def binary_search(items, target):',
  '    lo, hi = 0, len(items) - 1',
  '    while lo <= hi:',
  '# >>> BLANK id=mid level=2 hint="用整除" hintEn="floor division"',
  '        mid = (lo + hi) // 2',
  '# <<< BLANK',
  '        if items[mid] == target:',
  '            return mid',
  '# >>> BLANK id=narrow level=3 hint="两侧各走一步" hintEn="move one side"',
  '        elif items[mid] < target:',
  '            lo = mid + 1',
  '        else:',
  '            hi = mid - 1',
  '# <<< BLANK',
  '    return -1',
  ''
].join('\n');

const p = Ex.parse(SRC);

T.eq(p.blanks.length, 2, '两个空');
T.eq(p.blanks[0].id, 'mid', '第一个空的 id');
T.eq(p.blanks[0].level, 2, 'level 解析成数字');
T.eq(p.blanks[0].hint, '用整除', '中文提示');
T.eq(p.blanks[0].hintEn, 'floor division', '英文提示');
T.eq(p.blanks[0].body, '        mid = (lo + hi) // 2', '单行挖空体');
T.eq(p.blanks[0].indent, '        ', '缩进取挖空体第一行的前导空白');
T.eq(p.blanks[1].body.split('\n').length, 4, '多行挖空体保留全部四行');
T.eq(p.blanks[1].indent, '        ', '多行空的缩进取第一行');

/* 占位版：指令行消失，挖空体塌成一行 `<indent>___` */
const lines = p.stripped.split('\n');
T.eq(lines[3], '        ___', '第一个空塌成一行占位');
T.eq(lines[2], '    while lo <= hi:', '占位上方的代码原样');
T.eq(lines[4], '        if items[mid] == target:', '占位下方的代码原样');
T.eq(p.lineMap[3].kind, 'blank', 'lineMap 标出这一行是空');
T.eq(p.lineMap[3].blankId, 'mid', 'lineMap 带上是哪个空');
T.eq(p.lineMap[2].kind, 'code', 'lineMap 标出代码行');
T.eq(p.lineMap.length, lines.length, 'lineMap 与 stripped 行数一致');

/* merge：填回去等于原文（去掉指令行） */
const answers = { mid: '        mid = (lo + hi) // 2',
                  narrow: p.blanks[1].body };
const merged = Ex.merge(SRC, answers);
T.ok(merged.indexOf('BLANK') === -1, 'merge 的结果里没有指令行');
T.ok(merged.indexOf('mid = (lo + hi) // 2') !== -1, 'merge 填回了答案');
T.eq(merged.split('\n')[0], 'def binary_search(items, target):', 'merge 不动其他行');

/* 缺的 id 用原 body 兜底 */
const partial = Ex.merge(SRC, { mid: '        mid = 0' });
T.ok(partial.indexOf('mid = 0') !== -1, '给了的空用答案');
T.ok(partial.indexOf('elif items[mid] < target:') !== -1, '没给的空用原文');

/* 没有指令的源码：零个空，stripped 逐字节等于原文 */
(function () {
  const plain = 'x = 1\ny = 2\n';
  const q = Ex.parse(plain);
  T.eq(q.blanks.length, 0, '没有指令就没有空');
  T.eq(q.stripped, plain, 'stripped 逐字节等于原文');
})();

/* ---- 错误形状必须抛，不能悄悄放过 ---- */
T.throws(function () {
  Ex.parse('# >>> BLANK id=a level=1 hint="x" hintEn="y"\nbody\n');
}, '开标记没有对应的闭标记要抛', /未闭合|unclosed/i);

T.throws(function () {
  Ex.parse('# >>> BLANK id=a level=1 hint="x"\nbody\n# <<< BLANK\n');
}, '缺 hintEn 要抛', /hintEn/);

T.throws(function () {
  Ex.parse('# >>> BLANK id=a level=9 hint="x" hintEn="y"\nbody\n# <<< BLANK\n');
}, 'level 越界要抛', /level/);

T.throws(function () {
  Ex.parse('# >>> BLANK id=a level=1 hint="x" hintEn="y"\n# <<< BLANK\n');
}, '空的挖空体要抛', /空|empty/i);

T.throws(function () {
  const dup = '# >>> BLANK id=a level=1 hint="x" hintEn="y"\nb1\n# <<< BLANK\n'
            + '# >>> BLANK id=a level=1 hint="x" hintEn="y"\nb2\n# <<< BLANK\n';
  Ex.parse(dup);
}, '同页重复 id 要抛', /重复|duplicate/i);

T.report('exercise');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node python/core/exercise.test.js`
Expected: FAIL —— `Cannot find module './exercise.js'`

- [ ] **Step 3: 实现 `exercise.js`**

要点：

- UMD 外壳同 T1，无依赖。
- 逐行扫描；遇到 `DIRECTIVE_OPEN` 进入收集态，遇到 `DIRECTIVE_CLOSE` 结束。
  文件结束仍在收集态 → 抛「未闭合的 BLANK」。
- 属性解析分两步。**先**用 `/\bhintEn="((?:[^"\\]|\\.)*)"/` 与
  `/\bhint="((?:[^"\\]|\\.)*)"/` 取出两个带引号的属性（**先 `hintEn` 再 `hint`**，
  否则 `\bhint=` 会先咬到 `hintEn=` 的前半段），**并把这两段从指令行里摘掉**；
  **再**在剩余文本上用 `/\bid=(\S+)/` `/\blevel=(\S+)/` 取裸值。
  两步的顺序是硬的：属性顺序不作要求，所以
  `# >>> BLANK hint="see id=5 example" id=real level=2 hintEn="y"`
  在一步式写法下会把 id 解析成 `5`——不属于必须抛错的三种形状，是静默的数据损坏。
  四个属性缺任何一个 → 抛，消息里点名缺的是哪一个。
- `level` 必须是 `1|2|3`，否则抛。
- 挖空体为空（两条指令行贴在一起）→ 抛。这是手滑最常见的形状，
  不能当成「一个空空间」悄悄放过。
- id 在同一份源码里重复 → 抛。UI 拿 id 当锚点，重复会互相顶掉。
- `stripped` 用 `indent + '___'` 一行代替整个挖空体；`lineMap` 与之逐行对应，
  `srcLine` 记回原文行号（给错误信息用）。
- `merge(src, answers)`：重新扫描一遍，把「开标记 + 体 + 闭标记」整体替换成
  `answers[id]`（缺则原 body）。返回值以原文的换行风格结尾。

- [ ] **Step 4: 跑测试确认全绿**

Run: `node python/core/exercise.test.js`
Expected: PASS

- [ ] **Step 5: 负控制 —— 把「空挖空体」改成放过**

删掉「挖空体为空则抛」那个判断，重跑，必须看到 `空的挖空体要抛` 失败。
从内存改回来。

- [ ] **Step 6: 提交**

```bash
git add python/core/exercise.js python/core/exercise.test.js
git commit -m "feat(python): BLANK 指令解析

指令是 Python 注释，所以带着标准答案的那个 .py 文件本身仍然能跑、能被门验——
参考答案与正在运行的源码从来没有分开过，也就没有第二份可以漂。

四个属性缺一即抛、空挖空体即抛、重复 id 即抛：这三种都是手滑最常见的形状，
悄悄放过它们的代价要到使用者点开那一页才出现。"
```

---

### Task 4: 补 `chess/scripts/check.py` 的 `registry_check()`

**Files:**
- Modify: `chess/scripts/check.py`（新增函数 + 在 `__main__` 的 `rc` 列表里加一项 + 更新文件头表格）
- Modify: `docs/superpowers/subproject-nav-contract.md:第 2 节表格`（chess 的 `registry_check` 一格 ❌ → ✅）

**Interfaces:**
- Consumes: 无。**与 python 子项目完全无关，可与波次 A 的其他任务并行，且不碰同一个文件。**
- Produces: 无（对其他任务没有接口）。

**背景：** 契约文档第 2 节记着 chess 至今没有这道门——注册表里写错一个 `file` 路径
要到运行时才暴露。cryptography 的 `registry_check()`（`cryptography/scripts/check.py:203`）
是现成的形状，照它改。

- [ ] **Step 1: 读现成实现，确认基线是绿的**

```bash
sed -n '203,276p' cryptography/scripts/check.py
python3 chess/scripts/check.py
```
Expected: chess 现有的门全绿（这是负控制的基线）。

- [ ] **Step 2: 写 `registry_check()`**

在 `chess/scripts/check.py` 里新增，照 cryptography 版逐条对应，把
`chapter` 换成 chess 的 `phase`、`CHAPTERS` 换成 chess 的合法阶段集合。必须校验：

- 顶层有 `schemaVersion`，`tools` 是非空列表
- 每条都有 `id` / `file` / `accent` / `phase` / `version` / `engine`
- `id` 全表唯一
- `version` 匹配 `^\d+\.\d+\.\d+$`
- `accent ∈ {'cyan','rose','violet','emerald','orange'}`
- `kicker` / `title` / `desc` / `tag` 四个字段都同时有 `zh` 与 `en`
- **双向存在**：注册表里的 `file` 在磁盘上存在；`chess/tools/*.html` 里每个
  不以 `_` 开头的页面都在注册表里

- [ ] **Step 3: 接进运行器**

在 `chess/scripts/check.py` 的 `__main__` 里，把 `registry_check()` 加进 `rc` 列表
（**不要用 `or` 短路** —— 那会让后面的门根本不执行）。同步更新文件头的门表格。

- [ ] **Step 4: 跑，确认仍然全绿**

Run: `python3 chess/scripts/check.py`
Expected: PASS，输出里多一行 registry 的结果。

- [ ] **Step 5: 负控制 —— 三个，逐个见红**

每一个都是：改 → 跑 → 看到红 → **从内存里的原字节写回** → 再跑确认恢复绿。

1. 把 `chess/chess-tools.json` 里某条的 `file` 改成一个不存在的路径 → 红
2. 把某条的 `version` 改成 `1.0` → 红（semver 形状）
3. 把某条的 `desc.zh` 删掉 → 红（双语字段）

- [ ] **Step 6: 提交**

```bash
git add chess/scripts/check.py docs/superpowers/subproject-nav-contract.md
git commit -m "fix(chess): 补上 registry_check()，契约表里那格 ❌ 转绿

契约文档第 2 节记着：chess 只有 fallback_check() 的 id 比对，一个注册表里
写错的 file 路径要到运行时才暴露。cryptography 那道门校验 semver 形状、
字段齐全、以及磁盘与注册表的双向存在——照它补齐。

三个负控制（不存在的 file / 非 semver 的 version / 缺一半的双语字段）都见过红。"
```

---

### Task 5: `programs/ch01-basics/` —— 10 个真程序 + `chapter.json`

**Files:**
- Create: `python/programs/ch01-basics/chapter.json`
- Create: `python/programs/ch01-basics/{10 个 .py}`

**Interfaces:**
- Consumes: 无。**内容任务，不依赖任何代码。**
- Produces: 供 T10 `build_programs.py` 消费的目录；供 T14 全部程序库门消费的语料。
  `chapter.json` 的字段形状是 T10 与 T14 的共同契约，**必须与本任务写出的完全一致**。

**这十个程序的选择不是随手挑的** —— 它们要同时满足两件事：既是 `py-basics` 真正该教的
内容，又要让 T14 的每一道程序库门都有真实的守护对象。对应关系写在下表，
实现者**不要替换成别的程序**，否则 T14 会有门没有语料。

| # | id | 教什么 | 让哪道门有语料 |
|---|---|---|---|
| 1 | `hello-name` | `input()` / `print()` / f-string | `program_run_check` 的 stdin 路径 |
| 2 | `celsius-to-fahrenheit` | 算术、浮点、`round` | 基本 run |
| 3 | `max-of-three-if` | 嵌套 `if/elif/else` | `variant_check`（problem `max-of-three` 之一） |
| 4 | `max-of-three-builtin` | `max()` 内置 | `variant_check` 之二 + `algorithm_property_check`（参考实现 `max`） |
| 5 | `swap-two-temp` | 临时变量 | `variant_check`（problem `swap-two` 之一） |
| 6 | `swap-two-tuple` | 元组解包 | `variant_check` 之二 |
| 7 | `count-vowels-loop` | `for` + 成员测试 + 计数 | `algorithm_property_check`（参考实现是 `sum(...)` 生成式，机制不同） |
| 8 | `int-float-str` | 类型转换与 `type()` | `program_run_check` 的多行输出 |
| 9 | `divmod-and-floor` | `//` `%` `divmod` `round` | `lex_vs_cpython_check` 的运算符切分语料 |
| 10 | `number-formatting` | f-string 格式规格 `{x:.2f}` `{n:,}` `{p:>8}` | `lex_vs_cpython_check` 的 f-string 语料 |

**至少三个程序要带 `# >>> BLANK` 指令**（建议 #3、#7、#9），否则
`blank_directive_check` 没有守护对象。

- [ ] **Step 1: 写第一个程序并当场跑通**

`python/programs/ch01-basics/count-vowels-loop.py`：

```python
"""Count the vowels in a word, one character at a time."""


def count_vowels(text):
    vowels = "aeiouAEIOU"
    total = 0
# >>> BLANK id=accumulate level=2 hint="逐个字符判断，命中就加一" hintEn="test each character, add one on a hit"
    for ch in text:
        if ch in vowels:
            total = total + 1
# <<< BLANK
    return total


if __name__ == "__main__":
    print(count_vowels("Programming"))
    print(count_vowels("rhythm"))
    print(count_vowels(""))
```

跑一遍，把真实输出记下来（**不要凭想象写 `expect`**）：

```bash
cd python/programs/ch01-basics && python3 count-vowels-loop.py
```
Expected: `3` / `0` / `0` 三行 —— 以**实际输出**为准填进 `chapter.json` 的 `expect`。

- [ ] **Step 2: 写 `chapter.json` 的第一条**

```json
{
  "module": 1,
  "tool": "py-basics",
  "programs": [
    {
      "id": "count-vowels-loop",
      "file": "count-vowels-loop.py",
      "problem": "count-vowels",
      "kind": "pattern",
      "level": 2,
      "boards": ["AQA", "OCR", "Edexcel", "CIE"],
      "tags": ["loop", "string", "counting"],
      "requires": [],
      "runtime": "cpython",
      "entry": "count_vowels",
      "title": { "en": "Count Vowels", "zh": "数元音" },
      "blurb": {
        "en": "A counter, a loop and a membership test — the shape almost every counting problem takes.",
        "zh": "一个计数器、一个循环、一次成员测试——几乎所有计数问题都是这个形状。"
      },
      "notes": {
        "en": ["…", "…"],
        "zh": ["…", "…"]
      },
      "lineNotes": [
        { "at": "    total = 0", "en": "…", "zh": "计数器必须在循环之前归零。" }
      ],
      "run": { "stdin": "", "expect": "3\n0\n0\n", "timeout": 5 },
      "check": { "property": "pure" }
    }
  ]
}
```

> `notes` 是**段落数组**不是长字符串（JSON 里写中文散文只有这样才读得下去）。
> `lineNotes` 的 `at` 是**整行原文**，不是行号——行号会在你编辑上方任何一行时静默错位。
> **不要写 `lines` 字段**，它由脚本数出来（Global Constraint 12）。

- [ ] **Step 3: 剩下九个程序，逐个「写完就跑」**

每个程序都要：

- 纯 ASCII、注释英文、4 空格缩进、无 Tab、LF 结尾（Global Constraint 6/7）
- 结构是「一个具名函数 + `if __name__ == "__main__":` 里的演示」
  —— `algorithm_property_check` 要靠 `entry` 取那个函数，主循环不能在导入时执行
- `expect` 一律来自**真实运行的输出**，粘贴，不要手写
- `hello-name` 的 `run.stdin` 要给 `"Ada\n"`

跑完整章：

```bash
cd python/programs/ch01-basics
for f in *.py; do echo "=== $f ==="; python3 "$f" < /dev/null; done
```

- [ ] **Step 4: 自查四条硬规矩**

```bash
cd python/programs/ch01-basics
# 纯 ASCII
! LC_ALL=C grep -nP '[^\x00-\x7F]' *.py && echo "ASCII OK"
# 无 Tab
! grep -nP '\t' *.py && echo "no tab OK"
# 行尾无多余空白
! grep -nP ' +$' *.py && echo "no trailing space OK"
# 无 CRLF
! grep -lU $'\r' *.py && echo "LF OK"
```
四条都要打印 OK。（T14 会把这四条变成真正的门；这一步是先手自查。）

- [ ] **Step 5: 确认变体与 property 两组语料齐了**

```bash
python3 - <<'PY'
import json, collections
d = json.load(open('python/programs/ch01-basics/chapter.json'))
ps = d['programs']
print('程序数:', len(ps))
g = collections.Counter(p['problem'] for p in ps)
print('多变体的 problem:', {k: v for k, v in g.items() if v > 1})
print('带 property 的:', [p['id'] for p in ps if p.get('check')])
print('带 BLANK 的:', [p['id'] for p in ps
                      if '>>> BLANK' in open('python/programs/ch01-basics/' + p['file']).read()])
PY
```
Expected: 程序数 10；至少两个 problem 有 2 个变体；至少 2 个带 property；至少 3 个带 BLANK。

- [ ] **Step 6: 提交**

```bash
git add python/programs/ch01-basics/
git commit -m "feat(python): ch01-basics 的十个程序

程序是真的 .py 文件，每一个都在写完当场跑过，expect 是粘贴进去的实际输出、
不是凭想象写的——这正是把源码放进 .py 而不是 JS 字符串里的全部理由。

十个的选择同时满足两件事：既是 py-basics 该教的内容，又让第 0 期每一道程序库
门都有真实的守护对象（两组变体、两个 property、三处 BLANK、一条走 stdin 的
输入程序、两段专门喂给词法器对表门的运算符与 f-string 语料）。"
```

---

# 波次 B（3 路并行）

---

### Task 6: `editor.js` —— 片段化高亮与编辑行为

**Files:**
- Create: `python/core/editor.js`
- Test: `python/core/editor.test.js`

**Interfaces:**
- Consumes: `PyLex.tokenize`（T1）。**必须惰性取**：`factory(function () { return root.PyLex; })`。
- Produces: `Editor.highlight` / `lineStarts` / `indentOf` / `applyTab` / `applyEnter`。T12 用。

**这个模块的全部价值在一条不变量上**：`highlight(src).map(f => f.text).join('') === src`。
三层临摹是逐字符对齐的三层，错一个字符光标就与文字对不上。所以片段文本**一律**用
`src.slice(start, end)` 现切，**绝不**拿 token 的 `value` 去 stringify——
PyLex 的 Token 本来就不带 `value`，正是为了让这条错误无从写起。

- [ ] **Step 1: 写失败的测试**

```js
'use strict';
const T = require('./_test.js');
const Editor = require('./editor.js');

/* ---- 往返不变量（本模块存在的理由）---- */
const SAMPLES = [
  '', 'x = 1\n',
  'def f():\n    return "a" + \'b\'  # tail\n',
  'doc = """multi\nline"""\nn = 1e10\n',
  's = f"{v:>8.2f}"\n',
  '"unterminated\n',
  'x = \\\n',
];
SAMPLES.forEach(function (src, i) {
  const frs = Editor.highlight(src);
  T.eq(frs.map(f => f.text).join(''), src, '片段 #' + i + ' 拼回逐字节相同');
  T.ok(frs.every(f => typeof f.cls === 'string' && f.cls.indexOf('tok-') === 0),
       '片段 #' + i + ' 每片都有 tok- 前缀的类名');
});

/* 1e10 这个具体的陷阱：value 化会变成 10000000000，切片不会 */
(function () {
  const src = 'n = 1e10\n';
  const frs = Editor.highlight(src);
  T.ok(frs.some(f => f.text === '1e10'), '数字片段保留原文写法 1e10');
  T.ok(!frs.some(f => f.text === '10000000000'), '绝不出现 stringify 过的数字');
})();

/* ---- 行工具 ---- */
T.eq(Editor.lineStarts('a\nbb\n\nc'), [0, 2, 5, 6], '行起始偏移');
T.eq(Editor.lineStarts(''), [0], '空串也有第 0 行');
T.eq(Editor.indentOf('        mid = 1'), 8, '前导空格数');
T.eq(Editor.indentOf(''), 0, '空行缩进为 0');

/* ---- Tab 永远插 4 个空格，绝不插制表符 ---- */
(function () {
  const r = Editor.applyTab('ab', 2, 2);
  T.eq(r.value, 'ab    ', 'Tab 插四个空格');
  T.eq(r.selStart, 6, '光标落在插入之后');
  T.ok(r.value.indexOf('\t') === -1, '结果里没有制表符');
  const sel = Editor.applyTab('abcd', 1, 3);
  T.eq(sel.value, 'a    d', '有选区时替换选区');
})();

/* ---- Enter 自动缩进 ---- */
(function () {
  const a = Editor.applyEnter('    x = 1', 9);
  T.eq(a.value, '    x = 1\n    ', '沿用上一行缩进');
  T.eq(a.selStart, 14, '光标落在新缩进之后');
  const b = Editor.applyEnter('    if x:', 9);
  T.eq(b.value, '    if x:\n        ', '冒号结尾再加四格');
  const c = Editor.applyEnter('    if x:  # note', 17);
  T.eq(c.value, '    if x:  # note\n        ',
       '注释在后也算冒号结尾（判断前先剥掉注释再 rstrip）');
  const d = Editor.applyEnter('x = "a:"', 8);
  T.eq(d.value, 'x = "a:"\n', '字符串里的冒号不算——用 PyLex 判最后一个有效 token');
})();

T.report('editor');
```

- [ ] **Step 2: 跑，确认失败**

Run: `node python/core/editor.test.js` → FAIL

- [ ] **Step 3: 实现**

- UMD 外壳同 T1，**依赖惰性取**。取 `PyLex` 后当场校验存在，**这一次校验放在
  任何 try 之外**——`highlight` 里的 try 是「源码打到一半暂时不合法就降级」用的，
  把「依赖压根没装载」也吞进去，结果是整篇永远没有颜色，一种安静的坏。
- `highlight(src)`：`PyLex.tokenize(src)` → 每个 token 映射成
  `{ text: src.slice(t.start, t.end), cls: 'tok-' + t.type }`。
  因为 PyLex 保证无缝全覆盖，这里**不需要**补空白片段，往返不变量自动成立。
- `applyEnter` 判「冒号结尾」：对当前行跑一次 `PyLex.tokenize`，取
  `PyLex.significant()` 的最后一个 token，其原文是 `':'` 才 +4。
  这样字符串与注释里的冒号都不会误触发——**不要用 `/:\s*$/` 正则**。

- [ ] **Step 4: 跑，确认全绿** → `node python/core/editor.test.js`

- [ ] **Step 5: 负控制 ×2**

1. 把 `text` 改成 `String(t.type === 'number' ? Number(src.slice(t.start, t.end)) : src.slice(...))`
   → `数字片段保留原文写法 1e10` 与往返断言一起变红。
2. 把 `applyEnter` 的冒号判断换成 `/:\s*$/.test(line)`
   → `字符串里的冒号不算` 变红。

两次都从内存改回来。

- [ ] **Step 6: 提交**

```bash
git add python/core/editor.js python/core/editor.test.js
git commit -m "feat(python): 片段化高亮与 Tab/Enter 行为

片段一律用 src.slice 现切。PyLex 的 Token 不带 value 字段，就是为了让
「拿 value 去 stringify」这个错误无从写起——1e10 会变成 10000000000，
三层临摹从那个字符起全部错位。

Enter 的冒号判断走 PyLex 的最后一个有效 token，不用正则：x = \"a:\" 后面
不该缩进，而 /:\\s*\$/ 分不出这件事。"
```

---

### Task 7: `judge.js` —— token 级严格比对

**Files:**
- Create: `python/core/judge.js`
- Test: `python/core/judge.test.js`

**Interfaces:**
- Consumes: `PyLex.tokenize` / `PyLex.significant`（T1），惰性取。
- Produces: `Judge.normalize` / `Judge.compare`。T12、T14 的 `judge_strictness_check` 用。

**严格到什么程度，spec §4.4 写死了**：只吞 token 之间的空白与注释；
引号风格、数字写法、空内部各行的相对缩进**都参与比对**。

- [ ] **Step 1: 写失败的测试**

```js
'use strict';
const T = require('./_test.js');
const J = require('./judge.js');

function ok(a, b, label) { T.eq(J.compare(a, b).ok, true, label); }
function no(a, b, label) { T.eq(J.compare(a, b).ok, false, label); }

/* ---- 吞掉的：空白与注释 ---- */
ok('mid = (lo+hi)//2', 'mid = (lo + hi) // 2', '空白差异判同');
ok('mid = (lo + hi) // 2  # my note', 'mid = (lo + hi) // 2', '注释差异判同');
ok('  x = 1', 'x = 1', '整体前导缩进不参与（由占位块撑出）');

/* ---- 不吞的：三样 ---- */
no("s = 'a'", 's = "a"', '引号风格参与比对');
no('n = 10000000000', 'n = 1e10', '数字写法参与比对');
no('for i in r:\nprint(i)', 'for i in r:\n    print(i)', '空内部的相对缩进参与比对');

/* ---- 报错要报得有意义 ---- */
(function () {
  const r = J.compare('a / b', 'a // b');
  T.eq(r.ok, false, '把整除打成除法要判错');
  T.eq(r.index, 1, '定位到第 2 个 token');
  T.eq(r.expected, '//', '说出期待什么');
  T.eq(r.got, '/', '说出你写了什么');
  T.eq(r.kind, 'different', '分类是 different');
})();

(function () {
  const r = J.compare('a', 'a + b');
  T.eq(r.kind, 'missing', '少写了要分类成 missing');
  T.eq(r.expected, '+', 'missing 报出缺的那个 token');
  T.eq(r.got, null, 'missing 的 got 为 null');
})();

(function () {
  const r = J.compare('a + b + c', 'a + b');
  T.eq(r.kind, 'extra', '多写了要分类成 extra');
  T.eq(r.got, '+', 'extra 报出多出来的 token');
})();

(function () {
  const r = J.compare('for i in r:\nprint(i)', 'for i in r:\n    print(i)');
  T.eq(r.kind, 'indent', '缩进不同单独分类，不混进 different');
})();

ok('x = 1', 'x = 1', '完全相同判同');
T.eq(J.compare('x = 1', 'x = 1').index, -1, '判同时 index 为 -1');

/* ---- normalize 暴露出来供门复用 ---- */
(function () {
  const n = J.normalize('a = 1  # c\nb = 2');
  T.eq(n.toks.map(t => t.text), ['a', '=', '1', 'b', '=', '2'], 'normalize 只留有效 token 原文');
  T.eq(n.rel, [0, 0], '两行都没有相对缩进差');
})();

T.report('judge');
```

- [ ] **Step 2: 跑，确认失败** → FAIL

- [ ] **Step 3: 实现**

- `normalize(src)`：`PyLex.significant(PyLex.tokenize(src))` → 每个取原文切片，
  连同所在行号/列号。另算 `rel`：每一行的前导空格数减去**第一行**的前导空格数
  （空行跳过）。这样整体缩进被吞掉、**行间的相对缩进保留**。
- `compare(answer, reference)`：先比 `rel` 数组（不同 → `kind:'indent'`，
  `index` 取第一处不同的行号）；再逐 token 比原文。
  长度不同时，短的一方先到头 → `missing`（answer 短）或 `extra`（answer 长）。
- 判同返回 `{ ok:true, index:-1, expected:null, got:null, kind:'equal' }`。

- [ ] **Step 4: 跑，确认全绿**

- [ ] **Step 5: 负控制 ×2**

1. 在 `normalize` 里把字符串 token 的引号统一成双引号 → `引号风格参与比对` 变红。
2. 去掉 `rel` 的比较 → `空内部的相对缩进参与比对` 与 `缩进不同单独分类` 一起变红。

- [ ] **Step 6: 提交**

```bash
git add python/core/judge.js python/core/judge.test.js
git commit -m "feat(python): token 级严格比对

严格是有意的：这套东西练的是肌肉记忆，Python 的多写法靠「同一问题给多个变体」
容纳，不靠放宽判定。只吞空白与注释，引号风格、数字写法、空内部的相对缩进都算数
——最后一条是因为缩进正是 Python 最该练的东西。

token 化不是为了放宽，是为了报错报得有意义：能说「第 2 个 token 起不同：
期待 // 你写了 /」，而不是「第 37 个字符不对」。"
```

---

### Task 8: `trace.js` —— 影子临摹引擎

**Files:**
- Create: `python/core/trace.js`
- Test: `python/core/trace.test.js`

**Interfaces:**
- Consumes: 无（纯逻辑，不依赖 PyLex）。
- Produces: `Trace.create` / `Trace.alignLines` / `Trace.IDLE_PAUSE_MS`。T12 用。

**核心判断：以行为同步单位、行内按位置对齐。** 纯位置对齐会让一行打错之后
后面全红；每到行首重新对齐，错误就不跨行传染。

- [ ] **Step 1: 写失败的测试**

```js
'use strict';
const T = require('./_test.js');
const Trace = require('./trace.js');

/* 注入时钟：统计要可测，就不能读真实时间 */
let NOW = 0;
Trace._useClock(function () { return NOW; });

const REF = 'a = 1\nb = 2\n';

(function () {
  const s = Trace.create(REF);
  const r = s.update('a = 1\n');
  T.ok(r.marks.every(m => m.state === 'ok'), '全对时没有 bad');
  T.eq(r.stats.correct, 6, '已正确输入 6 个字符');
  T.eq(r.stats.total, REF.length, 'total 是参考全长');
})();

(function () {
  const s = Trace.create(REF);
  const r = s.update('a = 9\n');
  const bad = r.marks.filter(m => m.state === 'bad').map(m => m.index);
  T.eq(bad, [4], '只有第 5 个字符错');
})();

/* 不跨行传染：第一行少打一个字符，第二行仍然按自己的行首对齐 */
(function () {
  const s = Trace.create(REF);
  const r = s.update('a = \nb = 2\n');
  const badLines = r.marks.filter(m => m.state === 'bad')
                          .map(m => REF.slice(0, m.index).split('\n').length);
  T.ok(badLines.every(l => l === 1), '错误只落在第 1 行，第 2 行不受污染');
})();

T.eq(Trace.alignLines('a\nbb\n', 'a\nbb\n').length, 3, '按行对齐，含末尾空行');

/* 统计 */
(function () {
  const s = Trace.create(REF);
  NOW = 0;  s.update('a');
  NOW = 60000; const r = s.update('a = 1\nb = 2\n');
  T.eq(r.stats.accuracy, 1, '全对时正确率为 1');
  T.eq(r.stats.cpm, 12, '60 秒打完 12 个字符 = 12 cpm');
  T.eq(r.stats.errors, 0, '没有错字');
})();

/* 正确率按「首次输入即正确」算：改对了也不还给你 */
(function () {
  const s = Trace.create(REF);
  NOW = 0; s.update('a = 9');
  s.noteBackspace();
  NOW = 1000; const r = s.update('a = 1\nb = 2\n');
  T.ok(r.stats.accuracy < 1, '改对之后正确率仍低于 1');
  T.eq(r.stats.backspaces, 1, '退格计数');
  T.eq(r.stats.errors, 1, '错字计数记的是首次输入错的位置数');
})();

/* 停手超过 IDLE_PAUSE_MS 不计入用时 */
(function () {
  const s = Trace.create(REF);
  NOW = 0; s.update('a');
  NOW = 60000; s.update('a ');                    // 中间停了 60 秒
  NOW = 61000; const r = s.update('a = 1\nb = 2\n');
  T.ok(r.stats.elapsedMs < 20000, '空闲段被剔除，用时不被一次走神污染');
})();

/* 逐行耗时 */
(function () {
  const s = Trace.create(REF);
  NOW = 0;    s.update('a = 1\n');
  NOW = 3000; const r = s.update('a = 1\nb = 2\n');
  T.eq(r.stats.lineTimes.length, 2, '两行各有一条耗时');
  T.ok(r.stats.lineTimes[1] > 0, '第二行的耗时为正');
})();

T.report('trace');
```

- [ ] **Step 2: 跑，确认失败** → FAIL

- [ ] **Step 3: 实现**

- UMD 外壳同 T1。`Trace._useClock(fn)` 是测试注入口（默认 `Date.now`）——
  读真实时间的统计模块没法测，而统计恰恰是最容易悄悄算错的地方。
- `create(reference)` 返回一个带内部状态的 session：`firstWrong`（Set，记
  「首次输入时就错了」的位置）、`backspaces`、`lastTickAt`、`activeMs`、`lineDone[]`。
- `update(typed)`：
  1. `alignLines(reference, typed)` 按 `\n` 切两边，逐行配对。
  2. 每一对行内按位置逐字符比；已输入的位置产出 `{index, state}`，
     `index` 是**在 reference 全文里的偏移**（UI 要拿它定位）。
  3. 位置首次出现不匹配时记进 `firstWrong`；之后改对了也不移除。
  4. 用时累加：`delta = now - lastTickAt`，`delta > IDLE_PAUSE_MS` 时只记
     `IDLE_PAUSE_MS`（或直接跳过），其余累加进 `activeMs`。
  5. 某一行首次全对时记下 `now` 作为该行完成时刻，`lineTimes[i]` 是与上一行完成时刻之差。
- `accuracy = (total - firstWrong.size) / total`；`cpm = correct / (activeMs/60000)`，
  `activeMs` 为 0 时返回 0（不要产出 `Infinity`）。

- [ ] **Step 4: 跑，确认全绿**

- [ ] **Step 5: 负控制 ×2**

1. 把 `firstWrong` 改成「改对了就移除」→ `改对之后正确率仍低于 1` 变红。
2. 去掉空闲剔除 → `空闲段被剔除` 变红。

- [ ] **Step 6: 提交**

```bash
git add python/core/trace.js python/core/trace.test.js
git commit -m "feat(python): 影子临摹引擎

以行为同步单位、行内按位置对齐：纯位置对齐会让一行少打一个字符之后后面全红,
每到行首重新对齐,错误就不跨行传染。

正确率按「首次输入即正确」算,改对了不还给你——这是临摹要测的东西。
时钟从外部注入,否则统计没法测,而统计恰恰是最容易悄悄算错的地方。"
```

---

# 波次 C（3 路并行）

---

### Task 9: `python/scripts/inline_core.py`

**Files:**
- Create: `python/scripts/inline_core.py`

**Interfaces:**
- Consumes: `python/core/*.js`（T1/T2/T3/T6/T7/T8/T12 产出）。
- Produces: CLI `python3 python/scripts/inline_core.py [--check] [--print-changed]`，
  以及可被 `check.py` 导入的 `main(check_only=True)`。T13、T14、T15 用。

**基准实现是 `cryptography/scripts/inline_core.py`**，照它改。**去掉**那边的
`ALGOS_MARK_RE` / `EXAMPLES_PARTS` 整套（python 没有逐页算法清单，程序库由
`build_programs.py` 管）。**保留**这三条不能丢的纪律：

1. `--print-changed` 的 stdout 是给 pre-commit 机读的路径列表，**所有 WARN 走 stderr**
   （混一行诊断文字进去就会喂给 `git add` 一个不存在的路径）。
2. 区间体正则**不要求非空**：两条标记贴在一起的空区间是「新建页面时先写标记、
   内容交给脚本填」的唯一来源。chess 那边要求非空的后果不是报错而是三样都没发生
   ——没内联、missing 里也没有它、门也扫不到，新页带着空块全绿上线。
3. `_` 开头的模板页**也在内联范围内**。把它排除的代价是它的内联块从此无人看管，
   而它是每个新工具的复制源。

**标记表：**

```python
SOURCES = {
    'PY-LEX':   ROOT / 'core' / 'py-lex.js',
    'STORE':    ROOT / 'core' / 'store.js',
    'EXERCISE': ROOT / 'core' / 'exercise.js',
    'EDITOR':   ROOT / 'core' / 'editor.js',
    'JUDGE':    ROOT / 'core' / 'judge.js',
    'TRACE':    ROOT / 'core' / 'trace.js',
    'INTERACT': ROOT / 'core' / 'interact.js',
}
OPTIONAL_TAGS = set()   # 七块全是必需的：每一页都是完整的三模式页面
```

> **没有 `inline_order_check`。** cryptography 需要那道门是因为它的模块在 UMD 工厂参数里
> 直接抓 `root.CryptoCore`；这里全部惰性取（Global Constraint 9），顺序不再影响正确性。
> 取而代之的是 T14 的 `lazy_dep_check()`——它守的是真实的坏（有人写了 `factory(root.X)`），
> 而不是一个已经不存在的坏。

- [ ] **Step 1: 照 cryptography 版写出来**

```bash
sed -n '1,60p' cryptography/scripts/inline_core.py   # 先读懂基准
```

- [ ] **Step 2: 造一个只有标记、没有内容的临时页面，验证它会被填上**

```bash
mkdir -p python/tools
printf '<!doctype html>\n<script>\n/* >>> GENERATED:PY-LEX */\n/* <<< GENERATED:PY-LEX */\n</scr'\''ipt>\n' > /tmp/claude-501/*/scratchpad/t9-probe.html
```
（探针文件放**自己的 scratchpad 且带 t9- 前缀**——scratchpad 是共享的，
两个会话各写一个 `probe.html` 会互相覆盖。）

把探针拷进 `python/tools/_t9probe.html`，跑一次脚本，确认空区间被填上 py-lex 的内容，
然后**删掉探针**。

- [ ] **Step 3: 验证 `--check` 会在内联过期时返回 1**

改一个字符到 `python/core/py-lex.js`（内存里记住原字节），跑 `--check`，
必须返回 1 并列出过期文件；改回来后返回 0。

- [ ] **Step 4: 验证 `--print-changed` 的 stdout 只有路径**

```bash
python3 python/scripts/inline_core.py --print-changed 2>/dev/null | while read -r f; do
  [ -e "$f" ] || { echo "stdout 里混进了非路径：$f"; exit 1; }
done; echo "stdout 纯净"
```

- [ ] **Step 5: 提交**

```bash
git add python/scripts/inline_core.py
git commit -m "build(python): core 内联脚本

照 cryptography 版改，去掉逐页算法清单那一整套（这里程序库归 build_programs.py），
保留三条不能丢的纪律：--print-changed 的 stdout 只放路径、区间体正则不要求非空、
模板页也在内联范围内。

不带 inline_order_check：这里的模块全部惰性取依赖，顺序不再影响正确性，
取而代之的是 lazy_dep_check——守真实存在的那个坏。"
```

---

### Task 10: `build_programs.py` + `gates/properties.py`

**Files:**
- Create: `python/scripts/build_programs.py`
- Create: `python/scripts/gates/__init__.py`（空文件）
- Create: `python/scripts/gates/properties.py`

**Interfaces:**
- Consumes: `python/programs/ch*/chapter.json` 与同目录 `.py`（T5）。
- Produces:
  - CLI `python3 python/scripts/build_programs.py [--check] [--print-changed]`
  - 写入每个工具页的 `GENERATED:PROGRAMS` 区段，内容是
    `var PyPrograms = {...};`（JSON 编码，见下）
  - 回写 `python/python-tools.json` 里对应条目的 `programs` / `lines`
  - `gates/properties.py` 暴露 `REFERENCES: dict[str, dict]`，T14 的
    `algorithm_property_check()` 导入它

**嵌入的三条硬要求：**

1. **走 `json.dumps` 编码，不手写转义规则。**
2. **编码后的文本里不许出现 `<` + `script` + `>` 或 `<` + `/script` 序列。**
   `json.dumps` 不会替你处理这件事——把 `<` 统一转成 `\u003c` 即可（JSON 与 JS
   都接受，解码后逐字节还原）。
3. **`U+2028` / `U+2029` 必须转义**（JS 字符串字面量里它们是换行符，
   会当场造成语法错）。`json.dumps(..., ensure_ascii=True)` 已覆盖这两个码位；
   若改用 `ensure_ascii=False` 就必须另行处理——**本任务一律用 `ensure_ascii=True`**。

**`lines` 的定义**（T14 的 `program_count_check` 会重算，两边必须同法）：
`.py` 文件的行数 = `len(src.splitlines())`，**含** BLANK 指令行。

**`gates/properties.py` 的形状：**

```python
"""property 的参考实现登记表。

规矩（spec §2.3）：新增一个 property 必须**同时写出它的参考实现**，
而且参考实现要用**与被测程序不同的机制**——否则这道门就退化成拿自己验自己。

`ref` 拿被测程序的实参跑一遍，结果必须与被测程序的 `entry` 相同。
`cases` 产出 200 组随机实参（元组）。
"""
import random
import string

def _rand_words(rng):
    return (''.join(rng.choice(string.ascii_letters + ' ') for _ in range(rng.randint(0, 30))),)

def _rand_triples(rng):
    return (rng.randint(-50, 50), rng.randint(-50, 50), rng.randint(-50, 50))

REFERENCES = {
    # 被测程序 id -> {'ref': 参考实现, 'cases': 实参生成器}
    'count-vowels-loop': {
        # 被测的是「索引循环 + 累加」，参考的是「生成式 + sum」：机制不同
        'ref': lambda s: sum(ch in 'aeiouAEIOU' for ch in s),
        'cases': _rand_words,
    },
    'max-of-three-builtin': {
        # 被测的是 max()，参考的是「排序取末位」：机制不同
        'ref': lambda a, b, c: sorted([a, b, c])[-1],
        'cases': _rand_triples,
    },
}

SAMPLES = 200
SEED = 20260916          # 固定种子：门必须逐次可复现
```

- [ ] **Step 1: 写 `build_programs.py`**

结构照 `inline_core.py`：`render(text, payload)` 就地替换
`/* >>> GENERATED:PROGRAMS */ … /* <<< GENERATED:PROGRAMS */`，
`main(check_only, print_changed)` 同款三模式。

章 → 工具页的映射来自 `chapter.json` 的 `"tool"` 字段；输出文件是
`python/tools/<tool>.html`。**目标页不存在时当场报错**（不要静默跳过）。

- [ ] **Step 2: 先跑一次，确认注册表回写与 lines 计数**

在 `python/python-tools.json` 里先手写一条最小的 `py-basics` 条目
（`programs` / `lines` 先写 `0`），跑脚本，确认两个字段被改写成真实值：

```bash
python3 python/scripts/build_programs.py
python3 -c "import json;t=json.load(open('python/python-tools.json'))['tools'][0];print(t['programs'],t['lines'])"
```
Expected: `10 <真实总行数>`

- [ ] **Step 3: 往返验证（本任务最关键的一步）**

写一个一次性探针 `t10-roundtrip.py`（放自己的 scratchpad，**带 t10- 前缀**），
从生成好的 HTML 里抠出 `GENERATED:PROGRAMS`，用 `node` 的 `vm` 在**裸 context**
里求值，把每段 `source` 与磁盘 `.py` 逐字节比对。

> 必须用 `vm` + 裸 context，**不能**用 `node -e` 或 `node < file`：
> 那两种都会定义 `module` 与 `require`，UMD 会走 node 分支——门就在检查浏览器里
> 根本不执行的那条路径。

脚本走 stdin（Global Constraint 11）。确认 10 段全部逐字节相同。

- [ ] **Step 4: 转义负控制 ×2**

1. 临时往某个 `.py` 的注释里加一行 `# see <` + `script` + `>tag`，重跑构建，
   确认生成的 HTML 里**不含**该字面序列，而往返比对仍然逐字节相同。
2. 把 `ensure_ascii=True` 改成 `False`，往某个 `.py` 里塞一个 `U+2028`，
   重跑，确认页面语法门（`node --check`）变红；改回 `True` 后变绿。

两次都从内存恢复 `.py` 原字节。

- [ ] **Step 5: 提交**

```bash
git add python/scripts/build_programs.py python/scripts/gates/__init__.py python/scripts/gates/properties.py
git commit -m "build(python): 把 .py 程序库注入 GENERATED:PROGRAMS

编码一律 json.dumps(ensure_ascii=True)，并把 < 统一转成 \\u003c：一段打印
HTML 的教学程序会让 HTML 分词器当场断页，而 json.dumps 不管这件事。
ensure_ascii=True 顺带盖掉 U+2028/2029——它们在 JS 字符串字面量里是换行符。

往返用 vm 裸 context 验，不用 node -e：后者会定义 module/require，UMD 走 node
分支，门就在检查浏览器里根本不执行的代码。

properties.py 立下一条规矩：参考实现必须与被测程序机制不同，否则这道门就是
拿自己验自己。"
```

---

### Task 11: `python/app.html` 与 `python/index.html`

**Files:**
- Create: `python/app.html`
- Create: `python/index.html`

**Interfaces:**
- Consumes: `python/python-tools.json`（运行时 `fetch`，`file://` 下退到内嵌 FALLBACK）。
- Produces: 两个导航页。T15 的 `check_nav_contract.py` 扫它们；T14 的
  `fallback_check` / `fallback_version_check` / `outbound_ref_check` 扫它们。

**基准是 `cryptography/app.html`（882 行）与 `cryptography/index.html`（681 行）。**
逐页改写，差异**只允许**下面这张表里的几项；其余（DOM id 集合、`L` 的 key 集合、
函数集合）保持相同。

| 项 | cryptography | python |
|---|---|---|
| 分组轴 | `chapter` / `chapterLabel()` / `#chapters` | `module` / `moduleLabel()` / `#modules` |
| 分组标签表 | `CHAPTER_LABELS`（5 章） | `MODULE_LABELS`（8 模块，见下） |
| 存储键 | `cryptography-lang` / `cryptography-nav` | `python-lang` / `python-nav` |
| 注册表路径 | `cryptography-tools.json` | `python-tools.json` |
| 占位卡片 | 无 | 无（同 cryptography） |

`MODULE_LABELS` —— **两页必须逐字节相同**（T14 的 `module_label_check` 会比对）：

```js
var MODULE_LABELS = {
  1: { en: 'Language Foundations',   zh: '语言基础' },
  2: { en: 'Control Flow',           zh: '控制逻辑' },
  3: { en: 'Data Structures',        zh: '数据结构' },
  4: { en: 'Algorithms & Analysis',  zh: '算法分析' },
  5: { en: 'Applied Projects',       zh: '综合运用' },
  6: { en: 'Scientific Computing',   zh: '科学计算与数理统计' },
  7: { en: 'Graphics & Games',       zh: '图形与游戏' },
  8: { en: 'Embedded Python',        zh: '嵌入式 Python' }
};
```

**这五个代码块必须与既有四份逐字节相同**（T15 会跨六页比 sha）：
`wireParentLink()`、`ACCENTS`、`safeAccent()`、`resolveLang()`、`t()`。

```bash
# 抽出来对照，确认你抄的是逐字节相同的那一份
sed -n '/^function wireParentLink/,/^}/p' cryptography/app.html | shasum
sed -n '/^function wireParentLink/,/^}/p' chess/app.html | shasum      # 应当相同
```

- [ ] **Step 1: 复制并逐项改写 `app.html`**

```bash
cp cryptography/app.html python/app.html
```
然后按上表改写。**四处 `?v=` 一个都不能少**（契约 C1）：
`srcFor(id)` 的 iframe、`#btnAlone` 的单开链接（**必须与 iframe 同值**）、
`srcFor(null)` 的画廊 iframe（用 `regFingerprint()` 指纹）、以及运行时
`tools.json` 映射里**必须抄 `d.version`**——漏掉它每个地址都变成 `?v=0`。

- [ ] **Step 2: 内嵌 FALLBACK，每条都带 `version`**

第 0 期只有一条：

```js
var FALLBACK = [
  { id: 'py-basics', file: 'tools/py-basics.html', cat: 1, accent: 'cyan',
    version: '1.0.0',
    title: { en: 'Basics: Values & Output', zh: '基础：值与输出' },
    kicker: { en: 'Language Foundations', zh: '语言基础' } }
];
```

> `version` 不是展示文案，是**缓存键**。`file://` 下 `fetch` 因同源限制失败，
> FALLBACK 是唯一的数据源——少这个字段，离线打开时每个地址退化成 `?v=0`、
> 每张卡片的徽章写着 `v0`，而线上一切正常。cryptography 把这条规则写在三处文档里，
> 54 条 FALLBACK 一条都没带，直到有门才发现。

- [ ] **Step 3: 复制并改写 `index.html`**

```bash
cp cryptography/index.html python/index.html
```
同样改写，另外确认契约 C5：`.wrap{max-width:min(2600px,96vw)}`、
简介 `-webkit-line-clamp:4`、眉题与 tag 的 `text-overflow:ellipsis`。

- [ ] **Step 4: 手工验收（`file://` 下）**

在浏览器里双击打开 `python/app.html`，确认：

1. 侧边栏出现「语言基础」分组与 `py-basics` 一项（页面此时还不存在，iframe 会 404
   —— 这是预期的，T13 补上）
2. 画廊卡片上的版本徽章是 `v1.0.0`，不是 `v0`
3. 语言开关即时生效，并把 `?lang=` 写回地址栏
4. 「返回 MathViz」链接指向 `../app.html`，且带 `target="_top"`

- [ ] **Step 5: 语法门自查**

```bash
for f in python/app.html python/index.html; do
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' "$f" > /tmp/t11.js && node --check /tmp/t11.js \
    && echo "$f OK"
done
```

- [ ] **Step 6: 提交**

```bash
git add python/app.html python/index.html
git commit -m "feat(python): 导航壳与画廊

照 cryptography 的两页逐项改写，差异只有分组轴（module/8 个标签）、存储键前缀
与注册表路径；wireParentLink/ACCENTS/safeAccent/resolveLang/t 五块与既有四份
逐字节相同（T15 的根级契约门会跨六页比 sha）。

FALLBACK 从第一条起就带 version。它是缓存键不是文案，而 file:// 下 FALLBACK 是
唯一数据源——缺了它离线每张卡片写着 v0、每个地址是 ?v=0，而线上一切正常。"
```

---

# 波次 D

---

### Task 12: `interact.js` —— 页面装配

**Files:**
- Create: `python/core/interact.js`
- Test: `python/core/interact.test.js`

**Interfaces:**
- Consumes: `PyLex` `Editor` `Exercise` `Judge` `Trace` `Store`（全部**惰性取**）。
- Produces: `PyInteract.mount({ root, programs, lang }) -> controller`，
  `controller.setMode` / `setProgram` / `setLang`。T13 的页面调它。

**可测的部分与不可测的部分要分开。** 这个模块有 DOM，但它的决策逻辑不该有。
把下面这些抽成**纯函数并导出**，让它们在 node 下可测；DOM 装配只做「把纯函数的
结果画出来」：

```js
PyInteract.filterPrograms(programs, filters) -> Program[]
//   filters = { level: [1,2], kind: ['pattern'], boards: ['AQA'], maxLines: 40 }
//   空/缺省的维度不筛。多个维度是**与**关系，同一维度内是**或**关系。
PyInteract.copyPayload(mode, program, state) -> string
//   'read'  -> Exercise.clean(program.source)   ← 不是裸 source，见接口表
//   'blank' -> Exercise.merge(program.source, state.answers)   （merge 本就剥掉指令行）
//   'trace' -> state.typed
//   返回值**只有纯源码**：pip 提示、行注、模式名一概不进剪贴板
PyInteract.requirementLine(program) -> string | null
//   requires 非空时返回 'pip install numpy pandas'，否则 null
PyInteract.hintAt(blank, tier, lang) -> string
//   tier 1..blank.level，逐级展开；lang 决定取 hint 还是 hintEn
PyInteract.clearScope(scope, programs, currentId) -> string[]
//   scope ∈ 'program' | 'module' | 'all'，返回要交给 Store 的 id 列表
```

- [ ] **Step 1: 写失败的测试（只测纯函数）**

```js
'use strict';
const T = require('./_test.js');
const PI = require('./interact.js');

const PROGS = [
  { id: 'a', level: 1, kind: 'syntax',  boards: ['AQA'],        lines: 10, requires: [] },
  { id: 'b', level: 3, kind: 'pattern', boards: ['OCR','AQA'],  lines: 40, requires: ['numpy'] },
  { id: 'c', level: 5, kind: 'pattern', boards: ['CIE'],        lines: 90, requires: ['numpy','pandas'] }
];

T.eq(PI.filterPrograms(PROGS, {}).map(p => p.id), ['a','b','c'], '空筛选不筛');
T.eq(PI.filterPrograms(PROGS, { level: [1,3] }).map(p => p.id), ['a','b'], '同一维度内是或');
T.eq(PI.filterPrograms(PROGS, { level: [3,5], kind: ['pattern'], boards: ['CIE'] }).map(p => p.id),
     ['c'], '多个维度是与');
T.eq(PI.filterPrograms(PROGS, { maxLines: 40 }).map(p => p.id), ['a','b'], '长度上限含等号');

T.eq(PI.requirementLine(PROGS[0]), null, '无依赖不显示 pip 行');
T.eq(PI.requirementLine(PROGS[2]), 'pip install numpy pandas', '依赖行按声明顺序');

/* 剪贴板里只有纯源码 —— 这是整套东西存在的理由 */
(function () {
  const prog = { id: 'x', source: 'print(1)\n', requires: ['numpy'] };
  T.eq(PI.copyPayload('read', prog, {}), 'print(1)\n', '读模式复制原程序');
  T.eq(PI.copyPayload('trace', prog, { typed: 'print(2)\n' }), 'print(2)\n', '临摹复制她打的');
  const out = PI.copyPayload('read', prog, {});
  T.ok(out.indexOf('pip install') === -1, 'pip 提示绝不进剪贴板');
})();

/* 分级提示 */
(function () {
  const blank = { level: 3, hint: '中一 · 中二 · 中三', hintEn: 'en1 · en2 · en3' };
  T.ok(PI.hintAt(blank, 1, 'en').length > 0, '第一级有内容');
  T.ok(PI.hintAt(blank, 3, 'zh').indexOf('中三') !== -1, '第三级到底');
  T.eq(PI.hintAt(blank, 9, 'zh'), PI.hintAt(blank, 3, 'zh'), '超过 level 就钳到 level');
})();

/* 清空范围 */
T.eq(PI.clearScope('program', PROGS, 'b'), ['b'], '单题只给自己');
T.eq(PI.clearScope('module', PROGS, 'b'), ['a','b','c'], '模块级给本页全部');
T.eq(PI.clearScope('all', PROGS, 'b'), null, '整项清空交给 Store.clearAll，不走 id 列表');

T.report('interact');
```

- [ ] **Step 2: 跑，确认失败** → FAIL

- [ ] **Step 3: 实现纯函数 + DOM 装配**

DOM 侧要做到（无自动化测试，靠 Step 5 手工验收）：

- 三层临摹的 DOM：`.py-stage` 里三个绝对定位的层，**共用同一个 CSS 类**
  提供 `font-family: var(--font-code)` / `line-height` / `padding` / `tab-size: 4`；
  `white-space: pre`（**绝不软换行**）；`font-variant-ligatures: none`。
  顶层 textarea `color: transparent; caret-color: <accent>`。
  同步滚动由顶层 `scroll` 事件驱动，另外两层用 `transform: translate(-x, -y)`
  （**不用 `scrollTop`**，后者有子像素抖动）。
- α 滑块绑底层的 `opacity`；三个预设 100% / 35% / 0%。
- 错字反馈三档：`宽松` / `标红`（默认）/ `硬拦截`（`beforeinput` 里拒绝）。
- Tab 键 → `Editor.applyTab`；Enter → `Editor.applyEnter`；
  「跟随影子」开关**默认关**。
- 边输边存：`input` → `Store.scheduleDraft`；
  `visibilitychange` 与 `pagehide` → `Store.flush()`。
- `Store.onUnavailable` → 顶部挂**持久横幅**（不是 toast，不自动消失）。
- 复制：`navigator.clipboard.writeText` → 失败降级到隐藏 textarea + `execCommand('copy')`
  （`file://` 下 clipboard API 会被拒，这个降级是必须的）。
- 快捷键：`1/2/3` 切模式，`[` `]` 上下一个程序，`Cmd/Ctrl+Enter` = Check，`Esc` 退焦点。
  **输入焦点在 textarea 里时，`1/2/3` 与 `[` `]` 不得劫持**。
- 三级清空的二次确认对话框里显示 `Store.countRecords(ids)` 的真实条数。

- [ ] **Step 4: 跑，确认全绿** → `node python/core/interact.test.js`

- [ ] **Step 5: 负控制 ×1**

把 `copyPayload` 改成在源码前面拼上 `requirementLine()`，重跑，
必须看到 `pip 提示绝不进剪贴板` 变红。从内存改回来。

- [ ] **Step 6: 提交**

```bash
git add python/core/interact.js python/core/interact.test.js
git commit -m "feat(python): 页面装配

决策逻辑（筛选、剪贴板载荷、分级提示、清空范围）抽成纯函数并导出，在 node 下
可测；DOM 只负责把结果画出来。

剪贴板里只有纯源码：pip 提示显示在按钮旁边、不进剪贴板——粘进 PyCharm 必须
直接能跑，这是整套东西存在的理由。"
```

---

# 波次 E

---

### Task 13: `_skeleton.html` 与 `py-basics.html`

**Files:**
- Create: `python/tools/_skeleton.html`
- Create: `python/tools/py-basics.html`
- Modify: `python/python-tools.json`（补全 `py-basics` 条目的文案与 changelog）

**Interfaces:**
- Consumes: T9 的 `inline_core.py`、T10 的 `build_programs.py`、T12 的 `PyInteract`。
- Produces: 第一个真页面。T14 全部页面级门的守护对象。

**基准是 `cryptography/tools/_skeleton.html`**（3335 行）。保留它的：视觉令牌、
`GENERATED:FAVICON` 与 `GENERATED:COPYRIGHT` 两个区段、`tool-version` / `tool-engine`
两个 meta、i18n 机制、独立语言开关、响应式布局。**去掉**它的 canvas / 动画时钟 /
传输条 / 页签系统（这里没有 canvas）。

**新增一个 token**（python 子项目自己的，不从数学设计系统借 `--font-math`）：

```css
--font-code: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
```

**七个 GENERATED 区段全部必需**，顺序随意（惰性取依赖）：

```
GENERATED:PY-LEX  STORE  EXERCISE  EDITOR  JUDGE  TRACE  INTERACT  PROGRAMS
```

> ⚠️ 这个文件里除了两处真正的脚本标签，**任何地方——包括注释——都不要再写出
> `<` + `script` + `>` 这个字符串**：语法门与 CI 都靠这个字面量切分脚本块，
> 注释里多出来的一个会让切分从那里开始，把整段 HTML 当成 JS 去检查，
> 报一个跟真实代码毫无关系的错。

- [ ] **Step 1: 从 cryptography 骨架裁出 python 骨架**

```bash
cp cryptography/tools/_skeleton.html python/tools/_skeleton.html
```
删掉 canvas 相关整块，换上三层舞台 + 三个面板的 DOM，写上八对 GENERATED 标记
（**区段先留空**，交给脚本填）。`tool-engine` 写 `py-1.0.0`。

`_skeleton.html` 的 `GENERATED:PROGRAMS` 区段：**骨架不带任何程序**，
但**空区段是硬错误**（照 cryptography 让空 `ALGOS` 列表报错的同一条规矩：
空正是疏漏呈现的形状）。所以骨架用一个显式弃权哨兵：

```
/* >>> GENERATED:PROGRAMS none */
/* <<< GENERATED:PROGRAMS */
```

`build_programs.py`（T10）要认这个 `none`：区段留空、不报错、也不去找对应的章目录。
**如果 T10 还没实现这一条，本任务负责补上并加一条 T14 的门。**

- [ ] **Step 2: 复制出 `py-basics.html` 并填四处**

从骨架复制，改四处：`tool-version` 的 `content`（`1.0.0`）、页面 `title`、
版本记录注释块、`GENERATED:PROGRAMS` 标记行（`none` → 去掉，由 `chapter.json`
的 `tool` 字段驱动）。

- [ ] **Step 3: 跑两个生成脚本，把内容灌进去**

```bash
python3 python/scripts/inline_core.py
python3 python/scripts/build_programs.py
```
Expected: 两个页面都被改写；`py-basics.html` 里出现十段程序。

- [ ] **Step 4: 语法门与体积自查**

```bash
for f in python/tools/*.html; do
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' "$f" > /tmp/t13.js && node --check /tmp/t13.js \
    && echo "$f OK  $(du -h "$f" | cut -f1)"
done
```
Expected: 两个都 OK；`py-basics.html` 约 120 KB 上下（spec §4.7 的估算）。

- [ ] **Step 5: `file://` 手工验收 —— 六条，全部要过**

在浏览器里双击 `python/tools/py-basics.html`：

1. **读模式**：十个程序都能选，行号与高亮正常，行注点得开
2. **变体对照**：`max-of-three` 与 `swap-two` 各有两个写法，能并排看
3. **挖空模式**：三处 BLANK 变成 ①②③ 占位块；填对变绿、填错报出第几个 token；
   分级提示逐级展开
4. **临摹模式**：三层对齐——把 α 拉到 100% 时打字，**每一个字符都要压在影子上**；
   Tab 插四个空格（用「显示空白」或复制出来数）；Enter 在 `:` 后多缩四格
5. **一键复制**：三种模式各复制一次，粘到编辑器里确认**只有源码**、没有 pip 行
6. **三级清空**：单题 / 整模块 / 整项，二次确认里的条数与实际相符；
   清完刷新页面，草稿确实没了

**第 4 条如果对不齐，不要调 `line-height` 蒙混过关**——先确认三层是不是共用了
同一个 CSS 类、有没有哪一层多了 `padding`、连字是不是没关掉。

- [ ] **Step 6: 提交**

```bash
git add python/tools/_skeleton.html python/tools/py-basics.html python/python-tools.json
git commit -m "feat(python): 骨架与第一个真页面 py-basics

从 cryptography 骨架裁出来：留下视觉令牌、FAVICON/COPYRIGHT 两个区段、
tool-version/tool-engine 两个 meta 与 i18n，去掉 canvas、动画时钟与传输条。
新增 --font-code 这一个 token —— 三层临摹要求三层逐字相同的等宽字体。

骨架的 GENERATED:PROGRAMS 用显式弃权哨兵 none，而不是留空：空正是疏漏呈现
的形状，留空必须是硬错误（cryptography 的空 ALGOS 列表同一条规矩）。"
```

---

# 波次 F（2 路并行）

---

### Task 14: `check.py` 与 `gates/` —— 29 道门 + 29 个负控制

**Files:**
- Create: `python/scripts/check.py`（运行器）
- Create: `python/scripts/gates/registry.py`（A 组 7 道）
- Create: `python/scripts/gates/hygiene.py`（B 组 5 道）
- Create: `python/scripts/gates/syntax.py`（C 组 3 道）
- Create: `python/scripts/gates/library.py`（D 组 10 道）
- Create: `python/scripts/gates/lexer.py`（D 组 4 道）
- Modify: `python/scripts/gates/properties.py`（T10 已建，本任务按需补参考实现）

**Interfaces:**
- Consumes: 前面全部任务的产出。
- Produces: `python3 python/scripts/check.py` → 全绿退出 0，任一门红退出 1。
  T15 接进 hook 与 CI。

**运行器的两条铁律：**

```python
if __name__ == '__main__':
    # 29 道门全部**无条件跑到底**——不能用 `or` 短路。
    # `a() or b() or c()` 一旦 a() 非零就跳过后面的，意味着一份过期的内联副本
    # 会让最有分量的那几道门根本不执行，问题只报出第一个。
    rc = [
        inline_core.main(check_only=True),
        build_programs.main(check_only=True),
        registry.registry_check(),
        registry.fallback_check(),
        registry.fallback_version_check(),
        registry.version_meta_check(),
        registry.program_count_check(),
        registry.module_label_check(),
        registry.accent_module_check(),
        hygiene.outbound_ref_check(),
        hygiene.script_literal_check(),
        hygiene.control_byte_check(),
        hygiene.lazy_dep_check(),
        hygiene.skeleton_sentinel_check(),
        syntax.node_check(),
        syntax.core_tests(),
        syntax.browser_branch_check(),
        library.program_run_check(),
        library.algorithm_property_check(),
        library.program_embed_roundtrip_check(),
        library.chapter_manifest_check(),
        library.anchor_check(),
        library.exemption_check(),
        library.source_ascii_check(),
        library.source_indent_check(),
        library.blank_directive_check(),
        library.program_meta_check(),
        library.variant_check(),
        lexer.lex_roundtrip_check(),
        lexer.lex_vs_cpython_check(),
        lexer.judge_strictness_check(),
    ]
    sys.exit(1 if any(rc) else 0)
```

`run_node()` **逐字照抄** `cryptography/scripts/check.py:72-90`——包括那条
`MAX_ARG_STRLEN = 128 * 1024` 的断言。本仓为这个 Linux 单参数上限 CI 假绿过四次合并。

每道门返回 `0`（绿）或 `1`（红），并且**红的时候必须打印出具体是哪个文件/哪个 id
/哪一行**，不能只说「失败」。

#### A 组 · `gates/registry.py`

| 门 | 守什么 | 负控制 |
|---|---|---|
| `registry_check` | `schemaVersion`；每条有 `id/file/accent/module/version/engine`；id 唯一；`version` 匹配 `^\d+\.\d+\.\d+$`；`accent ∈ 五色`；`module ∈ 1..8`；`kicker/title/desc/tag` 四字段中英齐全；**注册表与磁盘双向存在**（`_` 开头的页除外） | 把 `file` 改成不存在的路径 → 红 |
| `fallback_check` | 两个导航页 FALLBACK 的 id 集合 == 注册表 | 删掉 FALLBACK 里那一条 → 红 |
| `fallback_version_check` | 每条 FALLBACK 都有 `version` 且与注册表同值 | 删掉某条的 `version` → 红 |
| `version_meta_check` | 注册表 `version` == 页面 `tool-version` meta | 把 meta 改成 `1.0.1` → 红 |
| `program_count_check` | 注册表的 `programs`/`lines` == 从 `programs/ch*/` 重算 | 把 `programs` 改成 9 → 红 |
| `module_label_check` | `MODULE_LABELS` 两页逐字节相同，且 1..8 一个不缺 | 改掉 `index.html` 里模块 3 的 `zh` → 红 |
| `accent_module_check` | 同模块同 accent；相邻模块异 accent | 第 0 期只有一个模块，**负控制要临时往注册表里加一条 `module:2, accent:'cyan'` 的假条目** → 红（相邻同色）；验完删除 |

`program_count_check` 的 `lines` 定义**必须与 T10 同法**：`len(src.splitlines())`，
含 BLANK 指令行。两边不同法，这道门就会在一个无害的差异上永远报红。

#### B 组 · `gates/hygiene.py`

| 门 | 守什么 | 负控制 |
|---|---|---|
| `outbound_ref_check` | `core/` `programs/` `tools/` 里零个 `../`；`app.html`/`index.html` 各**恰好一处** | 往 `core/store.js` 加一行 `// see ../foo` → 红 |
| `script_literal_check` | 任何 `.js` 里不许出现 `<`+`script`+`>` 或 `<`+`/script` | 往 `core/editor.js` 注释里塞一个 → 红 |
| `control_byte_check` | `core/` `programs/` `tools/` 无 BOM、无 CRLF、无杂散 C0 控制字符 | 给某个 `.py` 加 BOM → 红 |
| `lazy_dep_check` | **没有任何 core 模块在 UMD 工厂参数里直接抓 `root.X`**。扫法：找 `factory(` 的实参，出现 `root.` 且不在 `function` 体内即红 | 把 `editor.js` 改成 `factory(root.PyLex)` → 红 |
| `skeleton_sentinel_check` | `_skeleton.html` 的 `GENERATED:PROGRAMS` 标记行必须是 `none`；非模板页**不许**用 `none` | 把骨架的 `none` 去掉 → 红 |

#### C 组 · `gates/syntax.py`

| 门 | 守什么 | 负控制 |
|---|---|---|
| `node_check` | `tools/*.html`（**含 `_` 开头的模板**）与 `app.html`/`index.html` 的每个脚本块过 `node --check` | 往 `py-basics.html` 的脚本块塞一个 `)` → 红 |
| `core_tests` | 跑 `core/*.test.js` 全绿 | 改坏 `judge.js` 一行 → 红 |
| `browser_branch_check` | 用 `vm` + **裸 context** 跑每个 core 模块的**浏览器分支**，断言 `root.<Name>` 被挂上且关键函数可调用 | 把 `store.js` 的 UMD 浏览器分支改成挂到 `root.Stor` → 红 |

> `browser_branch_check` 为什么必须用 `vm` 裸 context：`node -e` **和** `node` 读 stdin
> 都会定义 `module` 与 `require`，UMD 会走 **node** 分支。用那两种方式测浏览器分支，
> 是在检查浏览器里根本不执行的代码——一道测错分支的门比没有门更糟，
> 它在广告一份它并不具备的覆盖。

#### D 组 · `gates/library.py`

| 门 | 守什么 | 负控制 |
|---|---|---|
| `program_run_check` | 每段 `.py` 在**全新临时目录**里 `python3 <file>`：`PYTHONHASHSEED=0`、`cwd=tmp`（`_fixtures/` 先拷进去）、喂 `run.stdin`、超时 `run.timeout`、比对 stdout 与 `run.expect` | 某程序里删一个冒号 → 红且指名 id |
| `algorithm_property_check` | 有 `check.property` 的程序：导入模块取 `entry`，用 `properties.SEED` 固定种子生成 `SAMPLES` 组实参，与 `properties.REFERENCES[id]['ref']` 比 | 把 `count_vowels` 的 `total + 1` 改成 `total + 2` → 红且打印反例 |
| `program_embed_roundtrip_check` | 从 HTML 抠 `GENERATED:PROGRAMS`，`vm` 裸 context 解码，每段 `source` 与磁盘 `.py` 逐字节比 | 手改 HTML 里某段 source 一个字符 → 红 |
| `chapter_manifest_check` | 清单点名的 `.py` 存在；目录里的 `.py` 都被点名；**章目录与注册表工具页一一对应** | 往章目录扔一个没被点名的 `.py` → 红 |
| `anchor_check` | `lineNotes.at` / `chunks.from` / `chunks.to` 的整行原文在源码里**存在且唯一** | 把某条 `at` 改掉一个空格 → 红 |
| `exemption_check` | **例外豁免**（`runtime == 'cpython'` 且 `requires` 不含 pygame，却标了 `compile-only`）必须带 `why`，每页 ≤ 2，且每次运行**逐条打印**；结构性豁免自动放行 | 临时加一个无 `why` 的 compile-only → 红 |
| `source_ascii_check` | 每段 `.py` 纯 ASCII | 往注释塞一个中文字 → 红 |
| `source_indent_check` | 无制表符；缩进是 4 的倍数；行尾无多余空白；LF 结尾 | 把某行 4 个空格换成 Tab → 红 |
| `blank_directive_check` | 指令成对；`id/level/hint/hintEn` 齐全；id 页内唯一；`level ∈ 1..3`；挖空体非空 | 删掉某个 BLANK 的 `hintEn` → 红 |
| `program_meta_check` | id 全库唯一；`kind/level/boards/runtime` 在闭集；`title/blurb/notes` 中英齐全；`notes` 是数组；`requires` 在白名单；**`chapter.json` 里不许出现 `lines` 字段**（派生字段不手写） | 给某条加一个 `"lines": 20` → 红 |
| `variant_check` | **只对成员数 > 1 的 `problem` 组**校验 `title.en` 互不相同（绝大多数程序是单例，"每个 problem ≥ 2"会把任何一章判红）；**另加一条**：全库至少存在一个多变体组——否则这道门在一个全是单例的库上永远绿，等于没有门 | 把两个 `max-of-three-*` 的 `problem` 改成不同值 → 红（多变体组归零） |

`program_run_check` 与 `algorithm_property_check` 的三层策略（spec §5.4）：

```python
def _tier(prog):
    if prog.get('runtime', 'cpython') != 'cpython':
        return 'compile-only'            # 结构性
    reqs = prog.get('requires', [])
    if 'pygame' in reqs:
        return 'compile-only'            # 结构性
    if reqs:
        return 'scipy-stack'             # 缺库则跳过，并打印跳过了几段
    return 'stdlib'                      # 每次都真跑
```

`compile-only` 那一层仍然要过 `compile(src, prog['id'], 'exec')`——
**`compile` 从不执行 import**，所以这道门不需要装 numpy/pandas/pygame
或任何 MicroPython 运行时。第 0 期的十个程序全是 `stdlib` 层。

#### D 组 · `gates/lexer.py`

| 门 | 守什么 | 负控制 |
|---|---|---|
| `lex_roundtrip_check` | 对**全部 `.py` + 一份畸形语料**，`Editor.highlight(src).join('') === src`，且 token 无缝全覆盖 | 让 `py-lex` 丢掉 token 间的空白 → 红 |
| `lex_vs_cpython_check` | 用 CPython 的 `tokenize` 模块切同一段源码，与 `PyLex` 比对**关键类别的起止位置** | 把 `py-lex` 的 `//` 切成两个 `/` → 红并报出位置 |
| `judge_strictness_check` | 判定器正负样例表（换空白/换注释 → 判同；换引号风格、换数字写法、改相对缩进 → 判异） | 让 `judge` 归一化引号 → 红 |
| `lex_never_throws_check` | 畸形语料逐条喂 `PyLex.tokenize`，**一条都不许抛** | 让未闭合三引号抛错 → 红 |

**`lex_vs_cpython_check` 的类别映射表必须显式写出来并可读**——它就是「我的词法器
与标准的差别在哪」的完整清单：

```python
# CPython tokenize 的 type -> PyLex 的 type 集合。
# 只比对**这张表里的类别**的 (start, end) 区间；两边对 f-string 内部结构与空白
# 片段的处理必然不同，那部分不参与比对。差别写在这里，而不是散落在代码里。
TOKEN_MAP = {
    'NAME':    {'name', 'keyword', 'softkw', 'builtin'},
    'NUMBER':  {'number'},
    'STRING':  {'string', 'fstring'},
    'COMMENT': {'comment'},
    'OP':      {'op', 'punct'},
}
# 不参与比对的 CPython 类别，以及为什么：
#   NEWLINE / NL / INDENT / DEDENT / ENDMARKER —— PyLex 不维护缩进栈（spec §4.2），
#       它把换行当 'nl'、把缩进当 'ws'，两边结构不同源，比对没有意义。
#   行续反斜杠 —— CPython 对 `t = a \\<换行>    + b` 里的 `\\` **一个 token 都不发**
#       （实测确认），而 PyLex 必须发一个才能保持无缝全覆盖。这条排除是 T1 的实现者
#       撞出来的真红，不是推测。
#   FSTRING_START / MIDDLE / END（3.12+）—— PyLex 把整个 f 串当一个 token。
#       所以 f 串在这里只比**整体区间**：CPython 的 START..END 合并后的 (start, end)
#       必须等于 PyLex 那一个 fstring token 的 (start, end)。
#   '@' 装饰器 —— PyLex 把 '@name' 合成一个 decorator token，CPython 切成 OP + NAME。
#       所以装饰器行只比**合并后的整体区间**。
```

> 这道门是整套设计里最重要的一道：验证一个自己写的词法器，最坏的方式是用自己
> 写的测试用例。CPython 的 `tokenize` 是这里的「免费 OpenSSL」——
> 根 `CLAUDE.md` 拿 node 的 `crypto` 当独立实现，同一条规矩。

- [ ] **Step 1: 写运行器骨架与 A 组，先跑通**

Run: `python3 python/scripts/check.py`
Expected: A 组 7 道全绿（其余门尚未接入）。

- [ ] **Step 2: 依次实现 B / C / D 四组，每组写完立刻跑**

每组接进 `rc` 列表后立刻 `python3 python/scripts/check.py`，确认**全绿**再写下一组。
不要攒到最后一起调——29 道门一起变红时，你分不清是哪一道的问题。

- [ ] **Step 3: 29 个负控制，逐个见红**

**这是本任务的核心交付物，不是收尾动作。** 按上面四张表逐条执行，每一条都是：

1. 先跑一次 `python3 python/scripts/check.py`，确认**基线是绿的**
   （否则你看到的「红」可能是它本来就红）
2. 施加破坏动作
3. 跑，确认**这道门变红**，且报错信息点名了具体的文件/id/行
4. **从内存里的原字节写回**——**绝不 `git checkout`**（会抹掉别的会话未提交的工作）
5. 再跑一次，确认恢复绿

把 29 条的结果记成一张表（门名 / 破坏动作 / 看到的报错首行），贴进提交信息或
`docs/superpowers/prompts/python-handoff.md`。

> **一道门在你把它守的东西改坏、看到它变红之前不算数。** 本仓有三个探针在同一次
> 会话里「全部通过」而实际什么都没测到的前科：一个比较的是 `String(object)` 与
> 自己（两边都是 `'[object Object]'`）、一个的循环体一次都没执行、一个枚举范围太小。
> 三个看起来都像强阳性结果。

- [ ] **Step 4: 确认没有一道门是在测自己**

逐条自问：这道门的「期望值」是从哪来的？

- 来自**独立实现**（CPython 的 `compile` / `tokenize` / `sorted` / `max`）→ 好
- 来自**磁盘上的另一份字节**（往返比对、跨页 sha）→ 好
- 来自**我自己写下的常量**→ 只有在那个常量本身就是规格时才可以
  （如 `MODULE_LABELS`、accent 闭集），否则重写

- [ ] **Step 5: 提交**

```bash
git add python/scripts/check.py python/scripts/gates/
git commit -m "test(python): 29 道门，每一道都见过红

分成 gates/ 一个包而不是单文件 check.py：29 道门单文件会到 ~1800 行，而且本期
要由多个并行实现者同时写，同一个文件会成为串行瓶颈。check.py 保留为运行器，
无条件跑完全部门再汇总——不能用 or 短路，否则一份过期的内联副本会让最有分量的
几道门根本不执行。

两道门拿 CPython 当独立裁判：程序库过真正的 compile 与真跑比对 stdout，词法器
与 tokenize 模块对表。验证一个自己写的词法器，最坏的方式是用自己写的用例。

29 个负控制逐条见过红，每个都先确认过基线是绿的。"
```

---

### Task 15: 根仓接线 + `scripts/check_nav_contract.py`

**Files:**
- Create: `scripts/check_nav_contract.py`
- Modify: `index.html`（第三张子项目卡片 + `L` 里五个 key + `href` 赋值）
- Modify: `CLAUDE.md`（Subprojects 一节：两个 → 三个）
- Modify: `docs/superpowers/subproject-nav-contract.md`（升到 v2.0）
- Modify: `.githooks/pre-commit`（加 python 段）
- Modify: `.github/workflows/registry-sync.yml`（加两步）
- Modify: `scripts/apply_branding.py`（`BRAND_PAGES` 加两页）

**Interfaces:**
- Consumes: T11 的两个导航页、T14 的 `check.py`。
- Produces: 让第 0 期在 hook 与 CI 上都跑得起来。

- [ ] **Step 1: 根 `index.html` 加第三张卡片**

照 `index.html:183-193` 的 chess / crypto 两张卡片写第三张：
`href="python/app.html"`、`target="_top"`、accent 取 **emerald**
（cyan 与 violet 已被占）。在 `L` 里加 `pythonKicker/pythonTitle/pythonDesc/pythonTag`，
在渲染函数里加五行赋值，并把 `href` 设成 `'python/app.html?lang=' + LANG`。

> ⚠️ `sync_registry.py` **不管这三张卡片**（根注册表里没有它们的 id），
> 今天没有门——所以 Step 3 的新门要把它们纳进去。
> 另：`chessDesc` 那条注释记着教训——**工具数不要写进文案**，
> 阶段 4 加了第四个工具之后根页面漏改过。

- [ ] **Step 2: 三个脚本 / 两个配置接线**

1. `scripts/apply_branding.py` 的 `BRAND_PAGES` 加 `'python/index.html', 'python/app.html'`，
   并在两页里写上 `GENERATED:BRAND-LOGO` 区段。
2. 跑 `python3 scripts/apply_branding.py`，给全部新页面铺 `GENERATED:FAVICON`。
   ⚠️ **CI 的那道门扫的是 `git ls-files '*.html'` 的全部页面**——
   新加的页面不打品牌就会「本地全绿、CI 全红」。
3. 跑 `python3 scripts/apply_footer.py`，给新页面铺 `GENERATED:COPYRIGHT`（同上）。
4. `.githooks/pre-commit`：照 cryptography 段加一段 python 段，
   触发条件 `^python/(core|programs|tools|scripts)/`，
   先跑 `inline_core.py --print-changed` 与 `build_programs.py --print-changed`
   并**只 `git add` 它们打印出来的路径**，再跑 `check.py`。
5. `.github/workflows/registry-sync.yml`：加两步——
   `python3 python/scripts/check.py` 与 `python3 scripts/check_nav_contract.py`。
   ⚠️ 在同一个 `run:` 里把 `python/app.html python/index.html python/tools/*.html`
   加进既有的内联脚本语法门循环。

> ⚠️ GitHub Actions 跑的是**被测分支自己的** workflow 文件。比这次改动更早切出的
> 分支不会跑到新加的这两步——本仓记过同类的事。

- [ ] **Step 3: 写 `scripts/check_nav_contract.py`**

扫**全部六个导航页**（`index.html` `app.html` 与三个子项目各两页）：

| 条款 | 检查 | 负控制 |
|---|---|---|
| C3/C6 | 抽出 `wireParentLink` / `ACCENTS` / `safeAccent` 三块，跨六页比 sha 相同 | 改掉 python 那份的一个空格 → 红 |
| C4 | 每个子项目页的父链接 `<a>` 带 `target="_top"`；根 `index.html` 三张子项目卡片都带 | 删掉 python 的 → 红 |
| C5 | 三个子项目 `index.html` 的 `.wrap` 是 `max-width:min(2600px,96vw)` | 改成 `1200px` → 红 |
| C7 | `resolveLang` / `t` 的兜底字面量是 `'en'`；存储键前缀与所在子项目一致 | 把 python 的兜底改成 `'zh'` → 红 |
| C8 | 出现 `contentWindow.location.replace`；**不出现禁用形状 `frame.src =`** | 往 python `app.html` 加一行 `frame.src = url` → 红 |
| 卡片 | 根 `index.html` 里三张子项目卡片齐全（chess / cryptography / python） | 注释掉 python 卡片 → 红 |

抽代码块的实测命令（写门之前先手跑一遍，确认六份真的相同）：

```bash
for f in app.html chess/app.html cryptography/app.html python/app.html \
         index.html chess/index.html cryptography/index.html python/index.html; do
  [ -f "$f" ] && printf '%s  %s\n' "$(sed -n '/^function wireParentLink/,/^}/p' "$f" | shasum | cut -c1-12)" "$f"
done
```
Expected: 有 `wireParentLink` 的那几页 sha 全部相同（既有四份是 `d353d1f97b61`）。

- [ ] **Step 4: 六个负控制逐个见红**

同 T14 Step 3 的纪律：先确认基线绿 → 破坏 → 见红 → **从内存字节恢复** → 再确认绿。

- [ ] **Step 5: 更新两份文档**

1. **`CLAUDE.md`** 的「Subprojects」一节：两个子项目 → 三个。写清 python 的特殊之处：
   无 canvas、无运行时、`.py` 是第二类编辑源、两个生成脚本、
   `python3 python/scripts/check.py` 是它的门。
2. **`docs/superpowers/subproject-nav-contract.md`** 升到 **v2.0**：
   三个子项目、六个导航页；第 2 节那张「谁在守每一条」的表要**实测后**重写——
   chess 的 `registry_check` 一格（T4 补的）与 C4–C8 五格（本任务补的）转 ✅。
   ⚠️ 那份文件第 4 节记着它自己是怎么发现第一条被违反的：**照抄意图会写出假的状态**。
   这张表的每一格都要跑一次命令再填。

- [ ] **Step 6: 全量验收并提交**

```bash
python3 python/scripts/check.py
python3 chess/scripts/check.py
python3 cryptography/scripts/check.py
python3 scripts/check_nav_contract.py
python3 scripts/sync_registry.py --check
python3 scripts/apply_branding.py --check
python3 scripts/apply_footer.py --check
```
七条全绿才能提交。

```bash
git add scripts/check_nav_contract.py index.html CLAUDE.md \
        docs/superpowers/subproject-nav-contract.md \
        .githooks/pre-commit .github/workflows/registry-sync.yml \
        scripts/apply_branding.py
# 品牌与版权脚本改写过的页面要单独确认后再逐个 add —— 不要 git add -A
git status --short
git commit -m "feat: 接入 python 子项目，并给导航契约装上机械门

契约文档第 2 节里 C4–C8 五条一直写着「无机械门」，理由是「它们是行为，不是能用
正则数出来的字段」。加第三个子项目正是这笔债变贵的时刻——wireParentLink 与
ACCENTS 从四份变六份。实测下来其中五条能静态扫出来：跨页比代码块的 sha、
target=\"_top\"、.wrap 的 max-width、兜底语言字面量、以及 C8 的禁用形状
frame.src=。check_nav_contract.py 扫全部六个导航页，六个负控制都见过红。

契约表按实测重写，不照抄意图——那份文件第 4 节记着它自己就是这么发现第一条
被违反的。"
```

- [ ] **Step 7: 开 PR 并**真的读一遍** CI**

```bash
git push -u origin claude/python-phase0-foundation
gh pr create --fill
gh pr checks <PR#>
```

> **本机绿不算绿。** 所有人都在 macOS 上开发，CI 跑 Linux，两者在无法本地复现的
> 地方分歧。`chess/scripts/check.py` 曾经本地全绿而 CI 连红四次合并，
> 包括一次只改了两个 markdown 文件的提交——`registry-sync.yml` 那道
> 「没配 hook 的克隆也别想合并漂移」的门，对着虚空报了四次红。

---

## Self-Review（写计划时已执行）

**1. Spec 覆盖度**

| spec 小节 | 任务 |
|---|---|
| §2.1 八模块闭集 | T11（`MODULE_LABELS`）、T14（`module_label_check`） |
| §2.3 程序数据形状 | T5（写出来）、T14（`program_meta_check`） |
| §2.4 变体 | T5（两组变体）、T14（`variant_check`）、T13 Step 5（对照视图验收） |
| §2.5 三条硬规矩 | T14（`source_ascii_check` / `source_indent_check`）、T3（答案即源码） |
| §3.2–3.4 三种模式 | T12（逻辑）、T13 Step 5（六条手工验收） |
| §3.5 复制与快捷键 | T12（`copyPayload` + 降级路径） |
| §4.1–4.3 core 与三层对齐 | T1 / T6 |
| §4.4 判定严格度 | T7、T14（`judge_strictness_check`） |
| §4.5 store 与三级清空 | T2、T12（`clearScope`） |
| §4.6 惰性取依赖 | 全部 core 任务 + T14（`lazy_dep_check`） |
| §4.7 编辑模型与内联 | T9 / T10 / T13 |
| §5.2–5.5 `.py` 程序库 | T5 / T10 / T14（D 组） |
| §6.1 注册表 | T10（回写派生字段）、T14（A 组） |
| §6.2 契约 C1–C8 | T11 + T15 |
| §7 全部门 | T14 + T15 |
| §8 五个接线点 + 还债 | T15 |
| §8.3 chess `registry_check` | T4 |
| §9.1 六条验收 | T13 Step 5 + T15 Step 6/7 |

**2. 占位符扫描：** 无 TBD / TODO / 「类似 Task N」/「加上适当的错误处理」。
每个「照 X 改」都点名了仓库里真实存在的文件与行号，实现者能读到原件。

**3. 类型一致性：** 「接口总表」是唯一真相，各任务的 Consumes/Produces 与之逐字对应。
三处曾经不一致、已在写计划时改掉：

- `Exercise.parse` 的返回字段一度在 T3 写作 `map` 而在接口表写作 `lineMap` → 统一为 `lineMap`
- `Trace` 的统计字段一度缺 `backspaces` → 已补进接口表与 T8 的测试
- `Store.clearAll` 的参数一度写作布尔 → 统一为 `{ prefs: boolean }`

**4. 范围：** 第 0 期不含 M1 其余四页、不含 M2–M8。程序库只有 `ch01-basics` 一章。
`properties.py` 只登记 `pure` 一族的两条参考实现；`sort` / `search` 随第 2 期到来。

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-16-python-phase0-foundation.md`.**

15 个任务、6 个波次，波内可并行。每个并行实现者要有**自己的 git worktree**，
临时文件**带任务号前缀**（`t5-probe.py`，不要 `probe.py` —— scratchpad 是共享的，
chess 阶段 6 有两个会话各写一个 `probe-quote.js` 互相覆盖的前科）。
