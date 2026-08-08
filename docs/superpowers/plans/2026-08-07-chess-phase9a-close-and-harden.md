# 阶段 9a：收口与加固 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「双语工具」这件事收口到最后一份源码（`minimax.js`），并把这一段反复栽跟头的那道门——**恒真的断言**——从靠自觉变成一道机器门。

**Architecture:** 三件事，顺序是硬的。① 先立**判别力门**：给 `_test.js` 加一个运行期审计模式，`check.py` 用它横扫全仓的 `T.throws`，报出「pattern 匹中同文件全部消息」的那些。② 再拿这道门去补 84 条缺第三参的断言。③ 最后做 `minimax.js` 双语与阶段 8 的遗留，共用一次工具 ④⑤（**不是** ②——见下） 的浏览器验收。

**Tech Stack:** 零依赖 ES5 子集 JavaScript（`node` 直跑 + 浏览器内联）；Python 3 的 `chess/scripts/check.py`；无构建、无包管理器。

## Global Constraints

**每次派发子代理都必须带上这一句：**

> 如果计划里某段代码是错的、或某个测试断言了一件事实上错误的事，停下来报告，不许改代码或改测试去迁就它。计划是记录，不是权威。

- **规格**是 `docs/superpowers/specs/2026-08-02-chess-viz-suite-design.md`，本阶段相关的是 **§1.6**（双语裁定与 9a 收口三点）、**§7.6**（断言的判别力）、**§8**（阶段表）。
- **本阶段的基线 commit 是 `ff28d13`**。要对照「改动前」的一律 `git show ff28d13:<path>`。
- **`_test.js` 的签名是 `throws(fn, label, pattern)`——正则必须在第三位。** 放第二位则 `pattern` 是 `undefined`，`_test.js:20` 的 `if (pattern === undefined) { passed++; return; }` 让它退化成「抛了就算过」。
- **补上 pattern 也可以是恒真的**（阶段 7：三条错误消息共享前缀 `source({ W, H, blocked }) 少了 …`，于是 `/W/`、`/H/`、`/blocked/` 匹到了每一条，删光三道守卫仍然全绿）。**判据是判别力，不是有无。**
- **不许自动转换、不许放宽语义去迁就测试。** 遇到「测试断言了一件错事」，停下来报告。
- **中文一个字节都不许改**（`minimax.js` 的中文变体必须与基线逐字节相同）；`hintEn` 那个例外在这一份上**不存在**（`minimax.js` 没有挖空）。
- **英文以中文为底本重写，不是对译；不能比中文说得少或多。** 行数约束落在「段」上不落在「句」上；写不成等行数**停下来报告**，不许塞废话或砍内容凑数。
- **判「有没有中文」用 `/[一-鿿㐀-䶿　-〿＀-￯]/`**（含中文标点与全角），不是 `/[一-鿿]/`——后者看不见 `「」。，？`。
- **别在注释里为一个没有门守住的设计做辩护**，更别引用不存在的调用点（阶段 8 抓到过三次）。要写就写明「这一半是人肉门」。
- ES 子集：**没有模板字面量、没有正则字面量**，字符串用 `+` 拼。
- 本仓无构建/lint/测试工具链。测试 = `node chess/core/xxx.test.js`；总门 = `python3 chess/scripts/check.py`。
- **`git status --short` 之后只暂存显式路径**；禁止 `git add -A` / `git commit -a`。`.githooks/pre-commit` 会重跑 `inline_core.py` 并**再暂存**（它读**磁盘**上的 `chess/core/**/*.js`），**钩子跑完要再看一遍**。
- ⚠ **突变实验前先把文件拷进 scratchpad，绝不要用 `git checkout --` 还原**——那会把整个文件退回 HEAD，本任务的活全没（阶段 8 的实现者踩过）。
- ⚠ **本地绿 ≠ CI 绿**（CLAUDE.md 新加的那条）。开 PR 后 `gh pr checks <PR#>`。

---

## 文件结构

| 文件 | 责任 | 本阶段动作 |
|---|---|---|
| `chess/core/_test.js` | 共用断言器 | **加**运行期审计模式（env 门控），修两条阶段 8 遗留 |
| `chess/scripts/check.py` | 总门 | **加**第九道门（判别力普查）；**删** `MONOLINGUAL_ALGOS` 机制；修 3 条遗留 |
| `chess/core/exercise.test.js` | 挖空测试 | 44 条补第三参 |
| `chess/core/chess-core.test.js` | 规则/perft | 17 条补第三参 |
| `chess/core/tree-model.test.js` | 博弈树 | 8 条补第三参 |
| `chess/core/interp.test.js` | 解释器 | 12 条补第三参 |
| `chess/core/algos/minimax.js` | 工具④ 的算法源码生成器 | **双语化** |
| `chess/core/algos/minimax.test.js` | 它的测试 | 三道双语门 + 调用点补 `lang` |
| `chess/core/debugger.js` | ④⑤（**不是** ②——见下） 共用调试器 | OUTPUT 空态占位跟语言走 |
| `chess/tools/chess-search-minimax.html` | 工具④ | **补 `source()` 单一入口**并传 `lang` |
| `chess/tools/chess-board-algorithms.html` | 工具⑤ | 修 4 条阶段 8 遗留 |

**`minimax.js` 与阶段 8 那七份形状不同**：它是 **七个数组**（`HEADER` / `ORDERING` / `LOOP_HEAD` / `CUT_WHITE` / `LOOP_MID` / `CUT_BLACK` / `LOOP_TAIL`）按 `mode` 拼装，`mode` 有三个值（`plain` / `ab` / `ordered`）。所以是**三个变体 × 两种语言**，三道门要**按 mode 各跑一次**。

---

> **2026-08-07 实测订正（Task 1 跑出来的）。** 这份计划里 `149 / 84 / 44 / 17 / 12 / 8` 那批数字是我用 `grep -c 'T\.throws('` 数的，**运行期审计推翻了三处**：
>
> | | 计划写的 | 实测 |
> |---|---|---|
> | 全仓 | 149 / 缺 84 | **170 / 缺 86** |
> | `exercise.test.js` | 44 | **43** |
> | `interp.test.js` | 12 | **17** |
> | `knight-path` / `queens` | 各 1 | **各 0**（早就有 pattern） |
> | `chess-core` / `tree-model` / `exercise-blanks` | 17 / 8 / 1 | 17 / 8 / 1 ✓ |
>
> 170 既是执行次数也是逻辑断言数（循环里重复执行的断言 label 各不相同，因为 label 插了循环变量），**不会随循环次数漂**。
>
> **§7.6 的判据也是错的，已换。** 「pattern 匹中同文件**全部**消息」今天一条都抓不到；换成「匹中 >1 条**去重后**的消息」则 33 条全是误报（那些消息只差一个插值）。正确的判据是**抹掉插值之后匹中几种形状**——今天 78 条精确匹中 1 种、0 条被抓，而反向验证里阶段 7 那个 bug 的 `/W/` `/H/` `/blocked/` **全部被抓**（各匹中 3 种形状）。匹中 **0 种**的（pattern 自己带插值，如 `/收到：25/`）是判别力最强的一档，**不许报错**。

## Task 1：判别力门（`_test.js` 审计模式 + `check.py` 第九道门）

这道门是后面三个任务的判据来源。**先立门，再补断言**——反过来做的话，补完了也不知道补对没有。

**为什么用运行期审计而不是静态解析**：实测 `chess/core/algos/rook-cover.test.js` 的 `grep -c 'T\.throws('` 是 **15**，而运行期捕获是 **14**——注释里也会出现 `T.throws(`。**grep 才是不可靠的那个。** 运行期审计顺带还能抓出「一条从没被执行到的 `T.throws`」（那种断言今天完全隐形）。

**Files:**
- Modify: `chess/core/_test.js`
- Modify: `chess/scripts/check.py`

**Interfaces:**
- Produces: `_test.js` 在 `process.env.THROWS_AUDIT` 指向一个路径时，`report()` 把 `[{label, pattern, msg}]` 写进那个文件（`pattern` 为 `null` 表示没传第三参）
- Produces: `check.py` 的 `throws_discrimination_check() -> int`，接进 `__main__` 汇总
- Consumes: `check.py` 的 `run_node()`（#101 加的，脚本走 stdin）

- [ ] **Step 1: 写会失败的测试**

在 `chess/core/_test.self.test.js` 末尾、`T.report()` 之前插入：

```js
/* ---- 审计模式（阶段 9a）----
   THROWS_AUDIT 没设时必须**一个字节的行为都不变** —— 这是给全仓 149 条
   T.throws 加的旁路，它自己不能改变任何既有断言的判定。 */
T.ok(typeof T.auditEntry === 'function', '审计模式暴露了 auditEntry 供自测');
// 没开审计时不记账
T.eq(T.auditEntry(), null, '未设 THROWS_AUDIT 时 auditEntry() 返回 null');
```

- [ ] **Step 2: 跑一遍，确认它失败**

```bash
node chess/core/_test.self.test.js
```

期望：`TypeError: T.auditEntry is not a function`。

- [ ] **Step 3: 给 `_test.js` 加审计模式**

`throws()` 现在长这样（`chess/core/_test.js:16-30`）：

```js
function throws(fn, label, pattern) {
  try {
    fn();
  } catch (e) {
    if (pattern === undefined) { passed++; return; }
    ...
```

改成（**只加，不改任何既有判定**）：

```js
/* 运行期审计（阶段 9a，规格 §7.6）。THROWS_AUDIT 指向一个路径时，把每一条
   真的抛出来的 T.throws 记下来：它的 label、它的 pattern（没传就是 null）、
   以及**实际抛出的消息**。report() 收尾时写进那个文件。

   为什么是运行期而不是静态解析：实测 rook-cover.test.js 的
   `grep -c 'T\.throws('` 是 15、运行期捕获是 14 —— 注释里也会出现
   `T.throws(`。grep 才是不可靠的那个。运行期审计顺带还能抓出「一条从没被
   执行到的 T.throws」，那种断言今天完全隐形。

   ⚠ **没设 THROWS_AUDIT 时行为必须一个字节不变** —— 这是给全仓 149 条
   断言加的旁路，它自己不能改变任何既有判定。 */
const AUDIT = (typeof process !== 'undefined' && process.env && process.env.THROWS_AUDIT)
  ? [] : null;

function auditEntry() { return AUDIT; }

function throws(fn, label, pattern) {
  try {
    fn();
  } catch (e) {
    if (AUDIT) {
      AUDIT.push({ label: String(label),
                   pattern: pattern === undefined ? null : String(pattern),
                   msg: String(e && e.message) });
    }
    if (pattern === undefined) { passed++; return; }
    ...
```

`report()` 开头加一句（**在 `process.exit` 之前**）：

```js
function report() {
  if (AUDIT) {
    require('fs').writeFileSync(process.env.THROWS_AUDIT, JSON.stringify(AUDIT));
  }
  for (const f of failures) console.error('FAIL  ' + f);
  ...
```

导出加上 `auditEntry`：

```js
module.exports = { eq, ok, throws, failedCount, normalizeSource, auditEntry, report };
```

- [ ] **Step 4: 跑测试确认通过**

```bash
node chess/core/_test.self.test.js
```

期望：比改动前多 2 条通过（`21 passed, 0 failed`）。

- [ ] **Step 5: 确认既有断言一个都没被碰**

```bash
python3 chess/scripts/check.py
```

期望：exit 0，八道门跑到底。**逐个测试文件的通过数必须与改动前完全相同**——审计模式没开时它是一条旁路。跑之前先记下改动前的数字：

```bash
git stash && python3 chess/scripts/check.py 2>&1 | grep -E "^[0-9]+ passed" > /tmp/9a-before.txt; git stash pop
python3 chess/scripts/check.py 2>&1 | grep -E "^[0-9]+ passed" > /tmp/9a-after.txt
diff /tmp/9a-before.txt /tmp/9a-after.txt && echo "✓ 每个文件的通过数一字不差"
```

- [ ] **Step 6: 加 `check.py` 的第九道门**

在 `core_tests()` **之后**插入（它要复用 `core_tests()` 已经在跑的那一趟，不额外再跑一遍）：

```python
def throws_discrimination_check() -> int:
    """T.throws 的判别力普查（规格 §7.6，阶段 9a）。

    `_test.js` 的 throws(fn, label, pattern) 第三参可选，**不传就退化成
    「抛了就算过」**。全仓实测（2026-08-07）149 条里 84 条没有第三参。

    但**补上 pattern 也可以是恒真的**：阶段 7 栽过一次 —— 三条错误消息
    共享前缀 `source({ W, H, blocked }) 少了 …`，于是 /W/、/H/、/blocked/
    三个 pattern 匹到了每一条，把那三道守卫全删掉仍然四条全绿。

    所以这道门守的是**判别力**：拿每条 pattern 去横扫同文件里**全部**
    T.throws 实际抛出的消息，**匹中全部 = 等于没有**。

    ⚠ 这道门**不要求每条都有 pattern** —— 那是 9a 的补齐任务的事，
    补齐过程中这道门要能跑。它只报两类：
      · 无判别力的 pattern（匹中同文件全部消息，且该文件不止一条）
      · 缺第三参的条数（**只统计、不失败**，收敛到 0 之后再收紧）

    收紧的时机写在这里：9a 的补齐任务做完后，把 ALLOW_MISSING 改成 0，
    这道门从此拒绝任何新增的无 pattern T.throws。
    """
    import os
    ALLOW_MISSING = 84          # ⚠ 补齐任务做完后改成 0
    tests = sorted(list((ROOT / 'core').rglob('*.test.js')))
    if not tests:
        print('ERROR: core/ 下一个 *.test.js 都没找到 —— 这道门本该普查，'
              '不是跑了个寂寞', file=sys.stderr)
        return 1
    rc = 0
    total = missing = blunt = 0
    for test in tests:
        out = ROOT / '.throws-audit.json'
        env = dict(os.environ, THROWS_AUDIT=str(out))
        proc = subprocess.run(['node', str(test)], capture_output=True,
                              text=True, env=env)
        if not out.exists():
            print(f'ERROR: {test.name} 没写出审计文件 —— _test.js 的审计模式'
                  f'没生效，或者这个文件根本没调 T.report()', file=sys.stderr)
            rc = 1
            continue
        entries = json.loads(out.read_text(encoding='utf-8'))
        out.unlink()
        total += len(entries)
        missing += sum(1 for e in entries if e['pattern'] is None)
        if len(entries) < 2:
            continue
        msgs = [e['msg'] for e in entries]
        for e in entries:
            if e['pattern'] is None:
                continue
            body = re.sub(r'^/|/[a-z]*$', '', e['pattern'])
            try:
                pat = re.compile(body)
            except re.error as err:
                print(f'ERROR: {test.name} 的 pattern {e["pattern"]} '
                      f'Python 侧编译失败：{err}', file=sys.stderr)
                rc = 1
                continue
            if all(pat.search(m) for m in msgs):
                blunt += 1
                print(f'ERROR: {test.name} 的这条 pattern 匹中了同文件全部 '
                      f'{len(msgs)} 条消息，等于没有判别力：\n'
                      f'    {e["pattern"]}  ←  {e["label"][:60]}',
                      file=sys.stderr)
                rc = 1
    if missing > ALLOW_MISSING:
        print(f'ERROR: 缺第三参的 T.throws 有 {missing} 条，超过当前允许的 '
              f'{ALLOW_MISSING} 条 —— 只许减不许加', file=sys.stderr)
        rc = 1
    print(f'T.throws 判别力普查：{total} 条，缺第三参 {missing} 条'
          f'（允许 {ALLOW_MISSING}），无判别力 {blunt} 条')
    return rc
```

在 `__main__` 里加（**不用 `or` 短路**，跟既有八道一样）：

```python
    rc_throws = throws_discrimination_check()
```

并把 `sys.exit(...)` 的条件加上 `rc_throws`，把顶上注释里的「八道门」改成「九道门」、写明第九道守什么。

`.gitignore` 里加一行 `.throws-audit.json`（门自己会删，但跑挂时会留下）。

- [ ] **Step 7: 跑，确认它在数真东西**

```bash
python3 chess/scripts/check.py 2>&1 | tail -3
```

期望：exit 0，且打印 `T.throws 判别力普查：149 条，缺第三参 84 条（允许 84），无判别力 0 条`。

⚠ **如果「无判别力」不是 0，那是真发现**——阶段 7 修过的那批之外还有钝的，记下来带进补齐任务。
⚠ **如果总数不是 149**，先查是不是有测试文件没调 `T.report()`（那样审计文件写不出来）。

- [ ] **Step 8: 对照实验——证明这道门真的会响**

⚠ **突变前先把文件拷进 scratchpad（`t1-` 前缀），别用 `git checkout --` 还原。**

```bash
# 突变 A：把 rook-cover.test.js 里「少了 W」那条的 pattern 换成 /少了/
#   （它会匹中「少了 W」「少了 H」「少了 blocked」全部三条）
#   期望：ERROR: rook-cover.test.js 的这条 pattern 匹中了同文件全部 N 条消息
# 突变 B：把 ALLOW_MISSING 改成 0
#   期望：ERROR: 缺第三参的 T.throws 有 84 条，超过当前允许的 0 条
# 突变 C：把某个测试文件末尾的 T.report() 注释掉
#   期望：ERROR: <file> 没写出审计文件
```

三个都必须让 `check.py` 退出 1，**并且要在输出里找到第九道门自己那一行 ERROR**（只看退出码不算数——别的门本来就可能因为同一个突变而红；阶段 8 Task 3 正是这样漏过一次）。每个跑完从 scratchpad 的拷贝还原。

- [ ] **Step 9: 提交**

```bash
git status --short
git add chess/core/_test.js chess/core/_test.self.test.js chess/scripts/check.py .gitignore
git commit -m "test(chess): T.throws 判别力普查 —— 第九道门"
git status --short
```

---

## Task 2：`exercise.test.js` 的 44 条

最大的一块。**这不是机械活**——每补一条都要问「这个 pattern 分得出它和邻居吗」。

**Files:**
- Modify: `chess/core/exercise.test.js`

**Interfaces:**
- Consumes: Task 1 的第九道门（`throws_discrimination_check`）

- [ ] **Step 1: 先看清楚要补的是哪些**

```bash
THROWS_AUDIT=/tmp/t2-audit.json node chess/core/exercise.test.js >/dev/null
python3 -c "
import json
a=json.load(open('/tmp/t2-audit.json'))
for i,e in enumerate(a):
    if e['pattern'] is None:
        print(f'{i:3}  {e[\"label\"][:48]:50} → {e[\"msg\"][:70]}')
print(len(a),'条，缺',sum(1 for e in a if e['pattern'] is None))
"
```

这一步的输出**就是要补的清单**，而且每条都带着它**实际抛出的消息**——pattern 从那条消息里挑一段**只有它有**的。

- [ ] **Step 2: 逐条补第三参**

规则：

1. **挑消息里独有的那一段**，不是最短的那一段。`/少了/` 匹中所有「少了 X」；`/少了 W/` 才分得出。
2. **不许为了让 pattern 好写而改被测代码的错误消息**——那是倒因为果。消息本来就分不出来的话，**停下来报告**（那说明错误消息本身该改，而那是另一件事）。
3. **`T.throws` 的第二参是 label（人话），第三参才是 pattern。**

- [ ] **Step 3: 跑，确认没有钝的**

```bash
node chess/core/exercise.test.js 2>&1 | tail -2
python3 chess/scripts/check.py 2>&1 | grep "判别力普查"
```

期望：`exercise.test.js` 通过数不变（补 pattern 不改变判定，只是让它更严），普查行的「缺第三参」从 84 降到 **40**。

⚠ **如果通过数变了**，说明某条 pattern 匹不上它自己的消息——那是补错了，不是测试有问题。

- [ ] **Step 4: 自验——每一条都真的有判别力**

```bash
python3 - <<'PY'
import json, re, subprocess, os
env = dict(os.environ, THROWS_AUDIT='/tmp/t2-audit.json')
subprocess.run(['node','chess/core/exercise.test.js'], capture_output=True, env=env)
a = json.load(open('/tmp/t2-audit.json'))
msgs = [e['msg'] for e in a]
bad = 0
for e in a:
    if not e['pattern']: continue
    pat = re.compile(re.sub(r'^/|/[a-z]*$','',e['pattern']))
    hit = sum(1 for m in msgs if pat.search(m))
    if hit == len(msgs):
        bad += 1; print('⚠ 无判别力:', e['pattern'], '←', e['label'][:50])
    elif hit > 1:
        print('  匹中 %d 条（不一定是错，确认这几条本就该同形）: %s ← %s' % (hit, e['pattern'], e['label'][:44]))
print('无判别力', bad, '条')
PY
```

「匹中 >1 条」不必然是错——几条断言本来就可能验同一类错误。**逐条看一眼**，确认那是有意的。

- [ ] **Step 5: 提交**

```bash
git status --short
git add chess/core/exercise.test.js
git commit -m "test(chess): exercise.test.js 44 条 T.throws 补 pattern"
git status --short
```

---

## Task 3：`chess-core.test.js` 的 17 条 + `tree-model.test.js` 的 8 条

两份放一起，因为都是「一次补完一个文件」的同形工作，而且两份加起来只有 25 条。

**Files:**
- Modify: `chess/core/chess-core.test.js`
- Modify: `chess/core/tree-model.test.js`

- [ ] **Step 1: 看清单**（两份各跑一次 Task 2 Step 1 那段，把 `exercise.test.js` 换成对应文件名）

- [ ] **Step 2: 逐条补第三参**（规则同 Task 2 Step 2）

⚠ **`tree-model.test.js` 有 8140 条断言**（语料驱动），跑一次要点时间。别因为跑得慢就跳过重跑。

- [ ] **Step 3: 跑，确认通过数不变、缺口下降**

```bash
node chess/core/chess-core.test.js 2>&1 | tail -1
node chess/core/tree-model.test.js 2>&1 | tail -1
python3 chess/scripts/check.py 2>&1 | grep "判别力普查"
```

期望：两份通过数各自不变（`8140` 那个数字一字不差），普查行的「缺第三参」从 40 降到 **15**。

- [ ] **Step 4: 自验判别力**（同 Task 2 Step 4，两份各跑一次）

- [ ] **Step 5: 提交**

```bash
git status --short
git add chess/core/chess-core.test.js chess/core/tree-model.test.js
git commit -m "test(chess): chess-core / tree-model 25 条 T.throws 补 pattern"
git status --short
```

---

## Task 4：`interp.test.js` 的 12 条 + 零散 3 条，并**收紧**这道门

**这一任务是 9a 存在的理由**：9b 要大改 `interp.js`，而 `interp.test.js` 现在有 12 条「抛了就算过」的断言。补完之后把 `ALLOW_MISSING` 收到 0——**从此这道门拒绝任何新增的无 pattern `T.throws`**。

**Files:**
- Modify: `chess/core/interp.test.js`
- Modify: `chess/core/exercise-blanks.test.js`（1 条）
- Modify: `chess/core/algos/knight-path.test.js`（1 条）、`chess/core/algos/queens.test.js`（1 条）
- Modify: `chess/scripts/check.py`（`ALLOW_MISSING` → 0）

- [ ] **Step 1: 看清单**（同 Task 2 Step 1，逐个文件）

- [ ] **Step 2: 逐条补第三参**（规则同 Task 2 Step 2）

⚠ `interp.test.js` 里有一批 `unsupportedCheck(...)` 走的是 `T.ok` / `T.eq` 而**不是** `T.throws`——**那些不在这次范围里**，别顺手改（它们已经查了 category 与消息关键词，形状是对的）。

- [ ] **Step 3: 收紧门**

`chess/scripts/check.py` 里：

```python
    ALLOW_MISSING = 0          # 9a 补齐完成（2026-08-07）；从此只许是 0
```

并把上面那段 docstring 里「收紧的时机写在这里」那句改成**已经收紧**的事实描述。

- [ ] **Step 4: 跑，确认收敛到 0**

```bash
python3 chess/scripts/check.py 2>&1 | grep "判别力普查"
```

期望：`T.throws 判别力普查：149 条，缺第三参 0 条（允许 0），无判别力 0 条`。

- [ ] **Step 5: 对照实验——门收紧之后真的拒绝新增**

⚠ 拷进 scratchpad 再改。

```bash
# 突变：随便挑一条 T.throws，把它的第三参删掉
#   期望：ERROR: 缺第三参的 T.throws 有 1 条，超过当前允许的 0 条
```

必须让 `check.py` 退出 1，**并且要在输出里找到第九道门自己那一行**。

- [ ] **Step 6: 提交**

```bash
git status --short
git add chess/core/interp.test.js chess/core/exercise-blanks.test.js chess/core/algos/knight-path.test.js chess/core/algos/queens.test.js chess/scripts/check.py
git commit -m "test(chess): 补齐最后 15 条 T.throws，门收紧到 0"
git status --short
```

---

## Task 5：`minimax.js` 双语 + 工具④ 补 `source()` 入口 + 删白名单机制

**Files:**
- Modify: `chess/core/algos/minimax.js`
- Modify: `chess/core/algos/minimax.test.js`
- Modify: `chess/tools/chess-search-minimax.html`
- Modify: `chess/scripts/check.py`（删 `MONOLINGUAL_ALGOS`）

**Interfaces:**
- Consumes: `render(parts, lang)` 的定版文本（在 `chess/core/algos/queens.js`，锚线 `  /* ================= 双语渲染（规格 §1.6 / §7.5）` 到 `    return out;\n  }\n`，**3,001 字节**，七份 sha256 全等）
- Produces: `AlgoMinimax.source({ mode, depth, position, lang }) -> string`

**这一份与阶段 8 那七份的三点不同**（规格 §1.6）：

1. **七个数组按 `mode` 拼装**（`HEADER` / `ORDERING` / `LOOP_HEAD` / `CUT_WHITE` / `LOOP_MID` / `CUT_BLACK` / `LOOP_TAIL`），`mode` 有三个值（`plain` / `ab` / `ordered`）。**三道门要按 mode 各跑一次**。
2. **0 处 `log`**（163 行生成源码、977 个汉字，全是注释）。结构门几乎自动成立——**这反而让「英文说得对不对」成为唯一的风险面**，人工审查那两条判据在这一份上是全部。
3. **工具④ 没有 `source()` 单一入口**：`AM.source(...)` 有两个调用点（`chess-search-minimax.html` 的 `rebuildDepth` 与 `btnRevert` 处理器）。**补一个入口**，理由跟工具⑤ 当初一样：第三个调用点迟早会出现。

- [ ] **Step 1: 先写三道门（会失败）**

在 `chess/core/algos/minimax.test.js` 末尾、`T.report()` 之前插入（⚠ **测试文件里的别名是 `A`**——`chess/core/algos/minimax.test.js:4` 是 `const A = require('./minimax.js')`；`AM` 是**页面里**的别名，别混。合法参数同样以现场为准）：

```js
/* ---- 双语三道门 × 三个 mode（规格 §7.5）----
   三道各有对方才拦得住的漏，见 queens.test.js 里那段注释；这里不重复。
   ⚠ 步数门必须带 !truncated 前置断言：两语都撞 STEP_LIMIT 时它退化成
   200000 === 200000（阶段 5 在 tour-dfs 5×5 上栽过）。 */
const E = require('../exercise.js');
for (const mode of ['plain', 'ab', 'ordered']) {
  const zh = A.source({ mode: mode, depth: 2, lang: 'zh' });
  const en = A.source({ mode: mode, depth: 2, lang: 'en' });

  T.eq(en.split('\n').length, zh.split('\n').length, mode + '：两种语言行数相同');
  T.eq(T.normalizeSource(en), T.normalizeSource(zh),
       mode + '：抽掉注释与字符串之后，两种语言逐字节相同');

  const rz = I.run(zh, { host: {} }), re_ = I.run(en, { host: {} });
  T.ok(!rz.trace.truncated && !re_.trace.truncated,
       mode + '：两语都没撞上限 —— 撞了的话下面那条步数断言就是 200000 === 200000');
  T.eq(re_.trace.length, rz.trace.length, mode + '：两种语言的解释器步数相同');
  T.eq(re_.result, rz.result, mode + '：两种语言的返回值相同');

  T.ok(zh !== en, mode + '：两种语言的源码不是同一份');
  T.ok(/[一-鿿㐀-䶿　-〿＀-￯]/.test(zh), mode + '：中文那一份里有汉字');
  T.ok(!/[一-鿿㐀-䶿　-〿＀-￯]/.test(E.parse(en, 'en').clean),
       mode + '：英文那一份送到编辑器的文本里一个汉字都没有');
}

// ---- lang 必填，且只认两个值 ----
T.throws(function () { A.source({ mode: 'plain', depth: 2 }); },
         'minimax：缺 lang 必须抛', /少了 lang/);
T.throws(function () { A.source({ mode: 'plain', depth: 2, lang: 'fr' }); },
         'minimax：lang=fr 必须抛', /只认/);
```

⚠ **「缺参数当场抛」那一组既有 `T.throws` 不许补 `lang: 'zh'`**——补了之后那一组对 `lang` 的校验位置**完全失明**（`'zh'` 合法，无论排前排后都落到参数那条；阶段 8 实测：补 `lang` 后调换顺序 `76 passed, 1 failed`，不补 `69 passed, 8 failed`）。

- [ ] **Step 2: 跑，确认失败**

```bash
node chess/core/algos/minimax.test.js
```

- [ ] **Step 3: 复制 `render`、改 `source()`、把七个数组改成片段数组**

```bash
python3 - <<'PY'
import pathlib
src = pathlib.Path('chess/core/algos/queens.js').read_text(encoding='utf-8')
b = src.index('  /* ================= 双语渲染（规格 §1.6 / §7.5）')
e = src.index('    return out;\n  }\n', b) + len('    return out;\n  }\n')
print(src[b:e])
PY
```

把输出**原样**贴进 `minimax.js` 的 `'use strict';` 之后（别手打）。`source()` 里**自身参数的校验仍在最前**，`lang` 由 `render` 在最后校验。

七个数组按同一条机械规则改写：连续的注释行收拢成 `{ zh: [...], en: [...] }`（`zh` 侧**逐字节抄旧值**），其余每行留成字符串。**两边行数必须相等**（`render` 会当场抛+堆栈，不是红断言）。

- [ ] **Step 4: 跑测试**

```bash
node chess/core/algos/minimax.test.js
node chess/core/tree-model.test.js
```

⚠ **`tree-model.test.js` 也 require 了 `algos/minimax.js`**（`:6`），它的 8140 条里有一批建在这份源码上。**必须跑**。

- [ ] **Step 5: 中文逐字节不变**

```bash
node -e '
const cp=require("child_process"), fs=require("fs"), path=require("path");
fs.writeFileSync("/tmp/t5-mm-base.js", cp.execSync("git show ff28d13:chess/core/algos/minimax.js").toString());
const OLD=require("/tmp/t5-mm-base.js"), NEW=require(path.resolve("chess/core/algos/minimax.js"));
let bad=0, n=0;
for (const mode of ["plain","ab","ordered"]) for (const depth of [0,1,2,3,4]) {
  n++;
  if (OLD.source({mode:mode,depth:depth}) !== NEW.source({mode:mode,depth:depth,lang:"zh"})) {
    bad++; console.log("mode="+mode+" depth="+depth+" 与基线不同");
  }
}
console.log(bad===0 ? "OK 中文 "+n+" 档逐字节不变" : "FAIL "+bad+"/"+n);
process.exit(bad?1:0);'
```

期望：`OK 中文 15 档逐字节不变`。**不相同就停下来报告**（这一份没有挖空，所以连 `hintEn` 那个例外都不存在，应当是零差异）。

- [ ] **Step 6: 工具④ 补 `source()` 单一入口并传 `lang`**

`chess-search-minimax.html` 里两个调用点（`rebuildDepth` 与 `btnRevert` 的处理器）都走一个新函数：

```js
  /* 这一页唯一的源码入口。**AM.source() 的每一个调用点都得走这里。**

     工具⑤ 有 genSource 这条通道，这一页没有 —— 阶段 9a 补上，理由跟那边
     当初一样：第三个调用点迟早会出现，而 lang 是必填的，漏传一处就是这道
     题在浏览器里坏掉。这个函数在的时候，漏传变成不可能而不是要靠自觉。 */
  function genSource(mode, depth) {
    return AM.source({ mode: mode, depth: depth, lang: curLang() });
  }
```

两处调用点改成 `genSource(tb.mode, depth)` / `genSource(S[id].mode, curDepth)`。

⚠ **`curLang()` 在这一页叫什么、有没有，要照现场核对**。工具⑤ 是 `function curLang() { return t({ zh: 'zh', en: 'en' }); }`。核对不上就**停下来报告**，别凭空造一个。

⚠ **切语言时源码要跟着换**。工具⑤ 阶段 8 的做法是整份重新生成而不重跑解释器（两语代码逐字节相同、行号逐行对齐，轨迹仍然有效）。这一页的对应位置在 `relabel()` 一族——**照现场的结构接**，接不上停下来报告。

- [ ] **Step 7: 删掉 `MONOLINGUAL_ALGOS` 机制**

七份 + minimax = 八份全双语之后，白名单**空了**。**空白名单是个迟早会被重新打开的暗门**——把 `MONOLINGUAL_ALGOS`、它的 `stale` 检查、以及 `bilingual_algos_check()` 里那个 `if p.name in MONOLINGUAL_ALGOS: continue` **一并删掉**，让第八道门（双语普查）**无条件**要求 `core/algos/` 下每一份非测试 `.js` 双语。

顺带把「白名单收缩只有注释、无代码强制」那条阶段 8 遗留在注释里销掉。

```bash
python3 chess/scripts/check.py 2>&1 | grep "双语 algos"
```

期望：`双语 algos 普查：8 份双语，render 助手 8 份一致`（不再有「N 份白名单」）。

- [ ] **Step 8: 英文自己读一遍**

```bash
node -e 'console.log(require("./chess/core/algos/minimax.js").source({mode:"ordered",depth:3,lang:"en"}))'
```

整份读一遍，逐条自查：

1. 有没有翻译腔？
2. 英文说的和中文是不是**同一件事**？有没有漏掉一个从句、或多添了一句中文没有的解释？
3. 术语用的是英文惯用词吗？（minimax / alpha-beta / pruning / move ordering / ply / cutoff / Shannon number）
4. 有没有哪一行超过 ~90 列？
5. **单复数**（阶段 8 出过 `Shortest is 1 moves`）
6. **别用 `piece` 指非棋子的东西**（阶段 8 栽过）——但**这一份里 `piece` 就是棋子**，用对即可

⚠ **这一份 0 处 `log`，机器只能验「代码没分岔」，验不了「英文对不对」。这一遍是全部的风险面。**

- [ ] **Step 9: 提交**

```bash
git status --short
git add chess/core/algos/minimax.js chess/core/algos/minimax.test.js chess/tools/chess-search-minimax.html chess/scripts/check.py
git commit -m "feat(chess): minimax.js 双语 —— 八份到齐，白名单机制删除"
git status --short
```

---

## Task 6：调试器 OUTPUT 空态占位跟语言走

> ⚠ **「影响工具 ②④⑤」是错的，2026-08-08 实测订正。** 这句话出自阶段 8 的账本，被一路转述了四次。实测：`GENERATED:DEBUGGER` 标记只出现在 `_debugger-preview.html`（预览页）、`chess-board-algorithms.html`（工具⑤）、`chess-search-minimax.html`（工具④）；**工具② `chess-rules-check-mate.html` 里 `dbg-root` / `dbg-out` / `editorHost` 全是 0**，整页没有调试器、编辑器或 OUTPUT 面板，正文里连「输出」二字都没有。**共用调试器引擎的登记工具只有 ④ 和 ⑤。**


阶段 9 的旧账，在**共用引擎**里（影响工具 ④⑤（**不是** ②——见下））。**放在这里做，是因为 Task 5 已经要重跑工具④ 的验收了**——分开做等于把同一次验收付两遍。

阶段 8 Task 9 的查证：切成英文后 OUTPUT 面板的空态占位仍写中文「还没有输出」（同块的「只有全局帧」是跟着换的）。根因是 `relabel` 没重画这一格，而 `chess/core/debugger.js:534` 的 `noOut` **本身是双语的**。最终审核补了一条：**实测是双向的**——那一格取建面板那一刻的语言、此后永不重画（英文界面下看到 `还没有输出`，中文界面下也看到 `no output yet`）。

**Files:**
- Modify: `chess/core/debugger.js`
- Test: `chess/core/debugger.test.js`（若存在；否则在 `tree-model.test.js` 里加）

- [ ] **Step 1: 先写会失败的测试**

先确认这一格能不能在 node 里测到（`debugger.js` 是否依赖 DOM）：

```bash
grep -n "document\.\|window\." chess/core/debugger.js | head -3
ls chess/core/debugger.test.js 2>/dev/null || echo "（没有 debugger.test.js）"
```

⚠ **如果它重度依赖 DOM、node 里测不到**，就**停下来报告**——那时这一条要靠浏览器验收钉（Task 8），而不是硬造一个假的单元测试。**别为了有测试而写一个不测任何东西的测试。**

能测的话，断言：建面板时语言为 `zh`、随后切到 `en`、`relabel()` 之后那一格的文本必须是英文。

- [ ] **Step 2: 跑，确认失败**

- [ ] **Step 3: 让 `relabel` 重画这一格**

`debugger.js` 的 `relabel`（或同名的语言刷新函数）里补上重画 OUTPUT 空态那一格。**只在「当前确实是空态」时重画**——有输出时那一格装的是真日志，不能被占位覆盖。

- [ ] **Step 4: 跑测试 + 全量门**

```bash
node chess/core/tree-model.test.js 2>&1 | tail -1
python3 chess/scripts/check.py 2>&1 | tail -3
```

- [ ] **Step 5: 提交**

```bash
git status --short
git add chess/core/debugger.js
git commit -m "fix(chess): 调试器 OUTPUT 空态占位跟语言走"
git status --short
```

---

## Task 7：阶段 8 的 12 条遗留

四组，互相独立。**逐条确认它还在**再改——阶段 8 之后又改过几轮，有的可能已经不成立了。

**Files:**
- Modify: `chess/scripts/check.py`（3 条）
- Modify: `chess/core/_test.js`（2 条）
- Modify: `chess/tools/chess-board-algorithms.html`（4 条）
- Modify: `chess/core/algos/*.js`（3 条英文）

- [ ] **Step 1: `check.py` 三条**

1. `:508` 附近的汇总行：①② 失败时仍拼「render 助手 N 份**一致**」——文案与实际判定解耦。
2. `:449` 附近：锚线缺失走 `continue`，于是「N 份双语」数的其实是「被检查数」——文案或变量名择一改清楚。
3. docstring 要写明：这道门**不校验 `render` 段内容**真含那两条 lang 的抛（结构判据的边界，行为侧由各文件的 `T.throws` 覆盖）。

- [ ] **Step 2: `_test.js` 两条**

1. `:57-66` 附近：字符串里「反斜杠 + 真实换行」的续行语法会被 `normalizeSource` **静默吞掉一行**，破坏「行结构保留」。今天八份源码一个都没有（`grep -n '\\$'` 为空），而且它们用 `+` 拼字符串。**加一道跟反引号守卫同形状的守卫**：归一化之后行数与输入不等就抛。
2. `:90` 附近注释里「king-greedy.js 的中文注释里就有 6 个反引号」措辞含混——**两个数都对但指的不是一回事**：`source()` **生成出来的源码**里是 6 个（那才是 `normalizeSource` 看得到的），**文件全文**是 142 个。改成「生成的源码里」。

- [ ] **Step 3: 工具⑤ 四条**

1. `:11623` 附近 `retextSources` 的 `failed` 累加**没有出口**，而 `relabel:11661` 在 `statusKind='idle'` 时照写 `Ready` —— `:11620` 那句「屏幕上必须有一句话」在这条路上不成立。
2. `:11625` 附近成功分支**不清 `tk.err`**，换语言成功后旧红字仍挂着。
3. `:9027` 附近 `markGenerated` 的注释说漏调「一个字都不说」，**实际会说一句假话**（她没改过却弹「你改过的源码保持原样」）。改注释**或**改行为，二选一并写明理由。
4. `:11667` + `:9922` 旁注用 `innerHTML +=`，而 `showProblemStatus` 在 `st.hookErr` 时早退不写 → **连切两次语言会追加两遍**。

- [ ] **Step 4: 三条英文**

1. `chess-board-algorithms.html:7653` 的 `covering by accident` —— **与阶段 8 已修的 king 那条是同一个词、同一种误译方向**（`by accident` 把前一段刚证完的必然性否掉；中文「顺手」是 by-product 不是 by chance）。
2. `king-greedy.js:334` / `king-exact.js:334`（**共用段同一行，两份要一起改**）`a king block` 略生硬。
3. `king-exact.js:621` 的 `Kings allowed this round: 1 — are they enough?` 在 0/1 时略拗。

⚠ 改 `algos/*.js` 的英文之后**行数必须仍然相等**（`render` 会当场抛给你看），**中文一个字节都不许动**。

- [ ] **Step 5: 全量门**

```bash
python3 chess/scripts/check.py 2>&1 | tail -4
node chess/core/algos/king.test.js 2>&1 | tail -1
```

- [ ] **Step 6: 提交**

```bash
git status --short
git add chess/scripts/check.py chess/core/_test.js chess/tools/chess-board-algorithms.html chess/core/algos/king-greedy.js chess/core/algos/king-exact.js
git commit -m "fix(chess): 阶段 8 的 12 条遗留"
git status --short
```

---

## Task 8：全量门与工具 ④⑤（**不是** ②——见下） 的浏览器验收

**Files:**
- Modify: `chess/chess-tools.json`（工具④ 版本 + changelog）
- Modify: `chess/tools/chess-search-minimax.html`（`tool-version` meta + `VERSION` 常量 + 页头 changelog）

⚠ **`chess/index.html` 与 `chess/app.html` 不带版本**（阶段 8 Task 9 查证过：条目字段只有 id/file/accent/phase/kicker/title/tag，`card()` 不打印版本）。**别凭空加一个页面不显示、也没有门校验的 `version` 字段。**

- [ ] **Step 1: 工具④ 定版**

`tool-version` meta **与** `VERSION` 常量**必须一起改**（阶段 5 的裁定：这两个分开改过一次，面板徽章读 meta，于是两个数字能不一致而没人发现）。

```bash
grep -n "tool-version\|VERSION = '1\." chess/tools/chess-search-minimax.html
```

当前 meta（`:27`）与 `const VERSION`（`:6400`）都是 `1.0.1` → 改成 `1.1.0`。⚠ 这一页的注释写明**角标读的是 `VERSION` 不是 meta**（设计系统 §10 说的「从 meta 读取」在 chess 这套里不成立），所以两处都得改（双语是新增能力，不是修补）。`chess/chess-tools.json` 的 `version` + `changelog` 同步。

- [ ] **Step 2: 全量门**

```bash
python3 chess/scripts/check.py 2>&1 | tail -5
python3 scripts/sync_registry.py --check
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' chess/tools/chess-search-minimax.html | node --check /dev/stdin
```

期望：`check.py` exit 0，**九道门都跑到底**，且打印
`T.throws 判别力普查：149 条，缺第三参 0 条（允许 0），无判别力 0 条`
`双语 algos 普查：8 份双语，render 助手 8 份一致`

- [ ] **Step 3: 阶段 8 没被碰坏**

```bash
node -e '
const cp=require("child_process"), fs=require("fs"), path=require("path");
const files=["queens","knight-path","tour-dfs","tour-warnsdorff","rook-cover","king-greedy","king-exact"];
const params={queens:[{N:6},{N:8}],"knight-path":[{W:5,start:0,target:24}],
 "tour-dfs":[{W:5,H:5,start:0}],"tour-warnsdorff":[{W:5,H:5,start:0}],
 "rook-cover":[{W:5,H:5,blocked:[]}],"king-greedy":[{W:6,H:6,blocked:[6,24,35]}],
 "king-exact":[{W:6,H:6,blocked:[6,24,35]}]};
let bad=0,n=0;
for (const f of files) {
  fs.writeFileSync("/tmp/t8-"+f+".js", cp.execSync("git show ff28d13:chess/core/algos/"+f+".js").toString());
  const OLD=require("/tmp/t8-"+f+".js"), NEW=require(path.resolve("chess/core/algos/"+f+".js"));
  for (const p of params[f]) { n++;
    const a=OLD.source(Object.assign({},p,{lang:"zh"})), b=NEW.source(Object.assign({},p,{lang:"zh"}));
    if (a!==b) { bad++; console.log("❌ "+f+" "+JSON.stringify(p)); } } }
console.log(bad===0 ? "OK 阶段 8 的七份中文共 "+n+" 档未被碰" : "FAIL "+bad+"/"+n);
process.exit(bad?1:0);'
```

⚠ Task 7 Step 4 改了 `king-greedy.js` / `king-exact.js` 的**英文**——所以这里只比**中文**，中文必须零差异。

- [ ] **Step 4: 浏览器验收（工具 ④⑤（**不是** ②——见下））**

`preview_start {name: "mathviz"}`，**每次浏览器工具调用都带显式 `tabId`**，探针**先断言页面身份**再取值。

⚠ **`TOOL` 不是页面全局**（阶段 8 最终审核查证：它是 `VizEngine` IIFE 内的 `let TOOL`）。用等价三元组断言：`location.pathname` + `meta[name=tool-version]` + 该页的算法全局。

⚠ **标签不在前台时 `requestAnimationFrame` 完全不跑**（阶段 8 Task 9 实测帧计数 0），而换页签的重建走 `frameFor → ensureBuiltAsync`——**不夹截图就点页签，题根本不会换**。

⚠ **浏览器工具只回传截图、不落盘**——逐条写死看到的原文，探针数据另存 JSON（`t8-` 前缀）。

逐条验：

1. **工具④**：三个 mode 各切一次语言，源码整份换语言；`minimax depth 3 → 136`（规格记录值）不变；页面无红字。
2. **工具④**：`?lang=en` 直接打开就是英文源码。
3. **工具④**：OUTPUT 空态占位跟语言走（Task 6 的回归）。**这一条要写成两半，缺一不可**：
   - a) **空态占位双向跟语言走**（zh→en 与 en→zh 都验）
   - b) **有日志时切语言，日志一字不变**

   ⚠ **b 才是最容易改坏的方向**，而这条修复**没有常驻回归测试**——Wave 3 的审查实测过：删掉 `relabelEmptyOut()` 之后**四套测试与九道门全绿**，回归完全不可见。这两条勾选项是它唯一的守卫。
4. **工具⑤**：仍然正常（Task 7 动了它四处）；切语言、填对后切语言仍是绿的「对了」。
5. **工具②**：OUTPUT 空态占位跟语言走（同一个共用引擎）——**同样验 a 与 b 两半**。

- [ ] **Step 5: 提交**

```bash
git status --short
git add chess/tools/chess-search-minimax.html chess/chess-tools.json
git commit -m "feat(chess): 工具④ 1.1.0 —— 双语算法源码"
git status --short
```

- [ ] **Step 6: 开 PR，等用户在对话里确认合并**

```bash
git push -u origin claude/chess-phase9a
gh pr create --title "阶段 9a：收口与加固 —— 八份源码全双语，判别力门立起来" --body "…"
```

**不要自己合并。** 开完 PR **必须** `gh pr checks <PR#>`——本地绿 ≠ CI 绿（CLAUDE.md）。

---

## 自查（写完计划后对着规格过了一遍）

- **规格覆盖**：§7.6（判别力）→ Task 1–4；§1.6 的 9a 三点（0 处 `log`、工具④ 补入口、删白名单）→ Task 5；§8 说的「9a 必须第一」的理由（`interp.test.js` 12 条）→ Task 4 显式收紧；阶段 8 遗留 → Task 6（调试器）+ Task 7（12 条）。
- **占位符扫描**：无 TBD/TODO。Task 6 Step 1 与 Task 5 Step 6 显式标注了「核对不上就停下来报告」——那是诚实的不确定（`debugger.js` 能否在 node 里测、工具④ 的 `curLang()` 叫什么），凭空写死一个函数名才是缺陷。
- **类型一致**：`T.auditEntry()`（Task 1 定义 → Task 1 Step 1 使用）、`THROWS_AUDIT` 环境变量（Task 1 → Task 2/3/4 的清单命令）、`ALLOW_MISSING`（Task 1 设 84 → Task 4 收 0）、`genSource(mode, depth)`（Task 5 定义 → 两个调用点）、`render(parts, lang)`（阶段 8 定版 → Task 5 复制）——名字全对得上。
- **数字来源**：149 / 84 / 44 / 17 / 12 / 8 都是本次实测（`THROWS_AUDIT` 原型跑出来的），不是转述。**`grep -c` 与运行期审计会不一致**（rook-cover 15 vs 14，注释里也有 `T.throws(`）——以运行期为准，计划里已写明。
