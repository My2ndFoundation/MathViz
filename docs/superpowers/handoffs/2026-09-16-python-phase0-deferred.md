# Python 子项目 · 第 0 期留给第 1 期的账

> 第 0 期（地基 + 第一个真页面 `py-basics`）已完成：15 个任务、61 个提交、34 道门。
> 这份文件是**账本**，不是待办列表——每一条都记着**为什么当时没修**，以及**什么时候它会变成必须修**。
>
> 规格：`docs/superpowers/specs/2026-09-16-python-subproject-design.md`
> 计划：`docs/superpowers/plans/2026-09-16-python-phase0-foundation.md`
> 契约：`docs/superpowers/subproject-nav-contract.md`（v2.0）

---

## 一、开工前必须先做的三件事

这三条不是「有空再说」——**第 1 期的第一个 PR 里就该有它们**，因为后面 34 页会把现状照抄 34 遍。

### 1. `python/scripts/sync_fallback.py` —— 把 FALLBACK 改成生成的

`python/app.html` 与 `python/index.html` 各内嵌一份 `FALLBACK`，每条带 `accent` / `module` / `kicker` / `title` / `tag` **五个镜像字段**。两道门只看两样：`fallback_check()` 比 **id 集合**，`fallback_version_check()` 比 **version**。

最终评审的负控制：把 `app.html` 的 FALLBACK 改成 `accent:'orange', module:7`、把 `index.html` 的 `title` 改成 `'WRONG TITLE'` → **34 道门全绿**。`file://` 下侧栏会把 py-basics 归进「第 7 模块 · 图形与游戏」、画橙点，而线上一切正常。

**35 工具 × 2 页 × 5 字段 = 350 个无人看管的镜像值。** 根仓已经为这一族付过一次学费（62 条里 48 条静默漂移），**而根仓的解法是把那份镜像改成生成的**（`sync_registry.py` 重写 `app.html` 的 GENERATED 区段）。三个子项目都还是手抄；python 是从 1 条长到 35 条的那一个，**现在是最便宜的时刻**。

照 `scripts/sync_registry.py` 的形状写，一两百行。

### 2. python 版的作者须知（`.claude/skills/` 下还没有）

`.claude/skills/` 目前只有 `crypto-viz-tool` 与 `math-viz-tool`。第 1 期的 34 页会由不同的人（或代理）写，而下面这些约束**目前只活在门的错误信息里**：

- **`hint` 与 `hintEn` 按分隔符切出的段数必须等于 `level`。** 分隔符链是 `' · '` / `'；'` / `'; '`（与 `interact.js` 的 `HINT_SEPS` 逐条同序）。
  ⚠️ **推论：`level=1` 的提示里不能出现这三个分隔符**——否则 `hintAt` 的 `cap=1` 会把后半句**静默截掉**，使用者根本看不到。门会拦住它，但作者该先知道。
- **`lineNotes.at` 不得落在任何挖空体内。** 第 0 期栽过：三个挖空的答案被右侧面板逐字印了出来。
- **源码纯 ASCII、注释英文**；唯一豁免是 BLANK 指令行的 `hint=`（双语设计），且**整份 `.py` 不许出现非 BMP 字符**（CPython 给字符偏移、JS 给 UTF-16 码元偏移，一个 emoji 让该行之后所有偏移静默平移）。
- **缩进只用 4 个空格，无制表符，LF 结尾**——复制粘贴进 PyCharm 必须原样能跑。
- **`run.expect` 必须是真实运行输出的粘贴**，不是想出来的。
- **`check.property` 的参考实现绝不能是被测程序自己用的那个函数**，而且**举例子说明它守什么时，要举一个它真能观察到的变异**（见 `gates/properties.py` 的 ⚠ 段）。

### 3. accent 分配表要在第二个模块落地时定下来

八个模块、五个颜色，规则是「相邻模块异色」。`accent_module_check()` 今天诚实地打印「本章无事可做」。**第六个落地的模块开始一定会撞色**——若不预先定表，会出现「加第 6 个模块必须回头改第 2 个的 accent」，而 accent 是缓存键之外的视觉身份。

---

## 二、有明确触发条件的四条

它们今天不可达或不成立，**但在某个具体时刻会变成真问题**。

| 条件 | 会变成什么 | 出处 |
|---|---|---|
| **第一次 bump `SCHEMA_VERSION`** | `store.js` 的迁移分支里若版本键回写抛错，`notify('migrated')` 会被 `notified` 标志吞掉——横幅仍出现，但说错原因。今天要同时满足「升版」＋「写入失败」才可达，升版那天它从不可达变成可达 | T2-5 |
| **第一个带 `chunks` 的程序** | `anchor_check()` 的「锚不得落在挖空体内」判据只覆盖 `lineNotes`，`chunks` 走 `is_note=False`。第 0 期零条 chunks，**这条分支从未被真实数据执行过**——而一条没有真实数据走过的分支，和一条不存在的分支，在门的输出里是一样的 | 修复波实现者自陈 |
| **第 2 页落地** | 加一章要手写 5 处：`chapter.json` + `.py`、工具页（复制骨架改 6 处）、注册表条目、**两页 FALLBACK 条目（手抄，见 §一.1）**。前两处有生成器，后两处没有 | 最终评审 |
| **第 35 道门** | 要改 3 处：`gates/<模块>.py`、`check.py` 的 `GATES`、`check.py` docstring 里那两个写死的数字。汇总行打的是 `len(GATES)` 自数，**但 docstring 的散文数字会漂**——`chess/check.py` 刚演示过漂到有三个答案 | 最终评审 |

---

## 三、「写下来的理由是假的」——三条

这一族在第 0 期被抓到**十二次**，其中三条留到了第 1 期。它们的共同形状是：**代码是对的，注释承诺的东西做不到**。危险在于下一个人会照着那句承诺去推理。

1. **`gates/library.py:504` `_blank_body_lines` 的「宁可多圈几行也不要漏圈」** —— 双 open 形状下它**是漏圈的**。复评员实测：在挖空体中间再插一条 `# >>> BLANK`、把行注锚在两个 open 之间，`anchor_check` 绿而 `blank_directive_check` 红。套件层面不假绿，但那句保证不成立。
2. **`gates/library.py:556` 的「与 `clean()` 同法」** —— 门剥的是**每一条**匹配指令正则的行；`exercise.js:328` 的 `clean()` 只剥 `scanBlocks` 配出对的 open/close。良构数据下同值，只在已被判红的形状上分岔。严格说是「同法，除了未配对的那一支」。
3. **`gates/properties.py:33` 的 `500 条随机串：475 / 412`** —— 复评员用门自己的 `_rand_words` + `SEED=20260916` 跑出 **475 / 414**。475 对上，412 没有——因为 docstring 没写「漏掉那次加一」具体怎么写、也没写这 500 条的生成协议。而 343 组那一批是**完全指定**的，所以逐个复现。这是本仓「写协议、别写期望值」那条规矩的残留。

---

## 四、其余留待的 minor（按文件归类）

**`python/core/`**
- `py-lex.js`：文件头「构造性」的措辞笼统——`end ≤ src.length` 实际靠 `scanString` 的钳位与 `scanNumber` 的 `second !== ''` 两行守着，不是结构保证。
- `py-lex.js`：`tokenize(非字符串)` 静默返回 `[]`，让「无缝全覆盖」不变量**空洞成立**；未申报未测试。
- `judge.js`：文件头描述的是没落地的那个设计（「左侧缩进由占位块撑出、不算她打的」），而 `blankBox()` 把 `b.indent` 放进 textarea 初值、`blankFeedback()` 因此补了 `lead-indent` 判据。行为对、前提旧。
- `judge.js`：`normalize()` 的 `toks[].line/.col` 算出、导出、**全仓零读者**（`blankFeedback` 自己用 `PyLex.significant` 重算）。删或用。
- `trace.js`：`alignLines()` 的 `refLine`/`typedLine` 同样**全仓零读者**。
- `editor.js`：`indentOf` 只数空格，粘贴进来的带 Tab 行报 0（题库侧已有门禁 Tab，唯一入口是使用者粘贴）。
- `interact.js`：`.tok-decorator` **没有 CSS 规则**——而 `decorator` 这个 token 类型是**专为高亮合成的**（CPython 没有它），R14 整套裁决、CPython 侧的区间合并、两道括号深度闸全为它服务。`@staticmethod` / `@property` / `@dataclass` 是第 3–5 模块的必考内容。
- `interact.js`：`shouldSaveBest()` 在「参考末尾之后多打字符」时仍写最好成绩（屏幕有警告、成绩照记）。
- `interact.js`：`hintAt` 的分隔符链按「哪个先出现」挑；一条正文带分号的普通句子会被切成两级。建议改成正文不会出现的显式标记。
- `store.js`：`parseJSON` 解析失败静默返回 `null`，是「失败绝不静默」的第三条安静路径（行为对，注释没写在最近那一行）。
- `exercise.js`：`clean()`/`stripped`/`merge` 各自重扫一次 `scanBlocks`（10 程序 × 3 次，加缓存要加失效逻辑，净负收益）。
- `exercise.js`：属性之间完全不留空白（`hintEn="e"level=3`）会误报缺 `level`——文档格式之外的畸形输入，且门用**逐字同款**的两步式切法，两边会一起错、不会分岔。

**`python/scripts/`**
- `inline_core.py`：`--check` 与 `--print-changed` 同给时 check 分支先短路，路径列表不打印（逐字继承自 cryptography）。
- `build_programs.py`：`compute_registry_update()` 里 `registry['tools']` / `t['id']` 是裸下标，畸形注册表抛裸 traceback——与该文件其余每条「点名文件的干净 ERROR」路径不一致。
- `gates/syntax.py`：`node_check()` 只认裸 `<script>`，`<script type="module">` 会被静默跳过，块数只打印不断言。
- `gates/registry.py`：`fallback_version_check` / `version_meta_check` 在 `checked == 0` 时仍报绿（今天由兄弟门兜住，但这是全包唯一两处偏离自己纪律的地方）。
- `gates/registry.py`：`accent_module_check` 在某模块混有 `None` 与字符串 accent 时抛 `TypeError`（经 `_guard` 仍是红，但是 traceback 红不是具名红）。
- `check.py`：`_guard` 把无参 `SystemExit()` 当绿（今天每条路径都带字符串）。

**`python/tools/`**
- `_skeleton.html`：语言按钮在「core 未内联」错误态下是死的（监听器在 `else` 分支里）。
- 两个导航页里有过期注释：「`tools/py-basics.html` 还不存在」——它在 Task 13 就存在了；加第二条 FALLBACK 的人会照抄这段。
- `_skeleton.html`：`TOOL.id` 是 `'py-skeleton'` 而文件名是 `_skeleton`；将来若有门比对二者会在骨架上红。

**仓级**
- `chess/scripts/check.py`：门数三处同值现在靠一句注释，**不是一道门**——它已经漂过一次（九 / 12 / 13）。建议加一道「docstring 表格行数 == `rc_` 行数」。
- `chess/scripts/check.py` 与 `python/scripts/build_programs.py`：畸形注册表抛裸 traceback，建议三处（chess / cryptography / python）一起修。
- `.github/workflows/registry-sync.yml`：导航契约那一步现在排在 chess / cryptography 两道门之后。它自己的注释写着「一道不可达的门和一道不存在的门没有区别」——而 chess 的门历史上连红四次（#97–#100）。

---

## 五、体积

实测 `py-basics.html` **242 KB**（gzip 后 84 KB），其中 **180 KB 是七个 core 模块**，每页一份、完全相同。35 页 ≈ **8.4 MB**。

参照已上线的 `cryptography/tools/` = 6.2 MB / 28 页（均 221 KB）——**同一个数量级，同一套铁律的必然代价**，不会在第 1 期变成问题。

真正会变贵的是**仓库**：`core/interact.js` 改一行就要重写 35 个页面 ≈ 每次提交 8 MB 新 blob。**建议在第 1 期中段量一次 `.git` 的增速**，并考虑「core 稳定后不再每个 commit 都重内联」的节奏。**不建议现在动**——去掉注释会毁掉这套代码最大的资产。
