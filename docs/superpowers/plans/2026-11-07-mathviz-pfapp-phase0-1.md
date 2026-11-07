# MathViz pfapp · 第 0–1 期实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 网页版 python 加只读状态桥与程序深链接（第 0 期），再在 `MathViz/pfapp/` 建起一套代码四个目标的 pfapp 地基，把 **python 目标**做通到可打包（第 1 期）。

**Architecture:** 一个 Next.js 应用，`MATHVIZ_TARGET` 选目标；内容来自 `.pfaddon` 内容包（由 `pfapp/extract/` 从网页版逐字节提取）；工具页同源 iframe 原样嵌入；问答、笔记、问整个库走 PrimeForge 的 agent 任务 + 应用自己的 MCP 工具，数据在 `node:sqlite`。打包脚本在 PFD 仓库。

**Tech Stack:** Bun 1.3.5、Next.js 16.4.3（App Router）、React 19.3.0、TypeScript 5、Tailwind 4、Drizzle 0.45 + `node:sqlite` / `bun:sqlite` 双后端、`@modelcontextprotocol/sdk` 1.32.1、zod 4、Biome、Playwright——版本照抄 MTB `trainer/package.json`。

**Spec:** `docs/superpowers/specs/2026-11-07-mathviz-pfapp-design.md`（下称「设计」）。调研报告 `.superpowers/pfapp-research/research-report.md`（主工作区，gitignored）。

第 2 期（math / chess / crypto）、第 3 期（四个应用首发）各写一份计划，在第 1 期验收后。

## Global Constraints

- 网页版是唯一内容源；pfapp 侧不手改内容；内容包里的工具页与网页版**逐字节相同**。
- 目标：`math` / `chess` / `crypto` / `python`；app id `app.primeforge.mathviz.<target>`；端口 math 26454、chess 26455、crypto 26456、python 26457；**默认语言四个都是英文**。
- 不声明 `ui.window`（在浏览器里打开）；`minDesktopVersion: "1.45.0"`；`capabilities: ["ai","addons"]`；`runtime: "node@24"`；`surface: "http"`。
- 不能带原生代码：只用 `node:sqlite`（测试用 `bun:sqlite`）；`next.config.mjs`；不用 sharp / better-sqlite3。安装目录只读，数据只写 `PRIMEFORGE_DATA_DIR`。
- AI 只走 agent 任务；不做流式；**不做预算功能**（manifest 的 `maxBudgetUsd` 填固定值，无任何界面）。Claude 与 Codex 都支持，**不泄题只靠服务器**。
- 内容包 id `<appId>/content`；`payload/{catalog.json, tools/, source/, provenance.json}`；`provenance.json` 不含时间；同一 MV commit 提取两次逐字节相同；python 的 `run.expect` 不进内容包。
- `pfapp/` 下不提交任何 `.html` 文件。
- MV 的纪律照旧：负控制先红后绿、说明断言红还是崩溃红；不 `git add -A`；本机 `python3` 是 3.14，网页版的门一律用 `/Users/nickma/miniconda3/bin/python3`，提交前 `PATH` 前置 miniconda。
- PFD 主工作区有用户未提交的改动：PFD 的改动一律在 PFD 的新 worktree / 分支里做，不碰它的主工作区。
- 向商店发布（`publish:app` / `publish:addon`）、在控制台建商品是对外动作：**做之前停下问用户**。

## Review Focus

1. **iframe 里的工具页在应用里第一次打开就报 CSP 错误、白屏**——期望 35 个 python 页每页 0 个控制台错误（Task 12 的 e2e 逐页断言）。
2. **学生在挖空模式里问「这一行怎么写」，回答里直接出现答案行**——期望服务器拒收并让 agent 重写（Task 10 的假引擎测试）。
3. **只装了内容包的旧版本 / 新版本 / 手动导入与商店两条来源同时存在**——期望以版本高者为准、目录与索引随之重建（Task 6 测试）。
4. **两个字的中文查询（「递归」「排序」）在「问整个库」里搜不到**——期望退到子串匹配后命中（Task 6 测试）。
5. **网页版单独打开时，状态桥多发了消息或改变了行为**——期望没有父窗口时 `postMessage` 从未被调用（Task 1 的门）。

---

## 第 0 期 · 网页版

### Task 1: python 状态桥与 `?prog=` 深链接

在 MV 新 worktree（分支 `claude/python-state-bridge`），照 `python-drill-tool`「C. 升级一页」与 `python-content-wave` 的验收、终审、PR 流程。

**Files:**
- Modify: `python/core/interact.js`（`mount()` 内：状态 `S` 初始化处约 `:1188-1200`、`setMode` `:2304`、`setProgram` `:2316`、挖空输入框创建处 `:1586` 一带、「填进去」`:1628-1636`、改动删 `given` `:1592-1596`）
- Test: `python/core/interact.test.js`
- Create gate: `python/scripts/gates/syntax.py` 里加 `py_state_bridge_check`（注册进 `check.py`，门数 50 → 51）
- Regenerate: `inline_core.py`；35 页 + `_skeleton.html` engine `py-1.3.2` → `py-1.4.0`；35 页 `tool-version` minor +1 与 changelog（中英：「可以用 `?prog=<程序 id>` 直接打开某个程序；嵌在 PrimeForge 应用里时向应用报告当前程序与模式」）
- Docs: `docs/superpowers/python.md`（新一节「状态桥与深链接」）、`python-drill-tool` 门表加一行

**Interfaces:**
- Produces（Task 9 消费）：父窗口收到 `{type: 'mathviz/py-state', v: 1, page: string /*TOOL.id*/, progId: string, mode: 'read'|'blank'|'trace', blankId: string|null, given: string[]}`，`targetOrigin = location.origin`。触发：mount 完成后一次；`setMode`、`setProgram`、挖空输入框 `focus`、`given` 增删之后各一次。`page` 取 `opts.page`（页面脚本传 `TOOL.id`；不传则取 `doc.documentElement.dataset` 不到就为 `null`——页面脚本改一行传入，35 页的页面脚本区段都要改，它不在 GENERATED 区段里，用一个一次性脚本逐页替换 `PyInteract.mount({` 那一行并人工核对 diff）。
- Produces：`?prog=<id>` 且 id 在 `PROGRAMS` 里 → 初始 `S.progId = id`；不在 → 照旧取第一个，不报错。

- [ ] **Step 1: 写失败的测试**（`interact.test.js`，用该文件已有的 DOM 桩）
  - `bridge: 没有父窗口时不发消息`：`win.parent === win`，mount 后 `setMode('blank')`、`setProgram(第二个 id)`，断言 `postMessage` 调用次数 `=== 0`。
  - `bridge: 有父窗口时报告状态`：`win.parent = {postMessage: spy}`，mount → 第一条消息 `mode === 'read'`、`progId === 第一个 id`、`blankId === null`、`given` 为 `[]`；`setMode('blank')` 后最后一条 `mode === 'blank'`；第二个参数 `=== win.location.origin`。
  - `bridge: 填进去与改动`：点「填进去」后 `given` 含该空 id；再改动该输入框后 `given` 不含。
  - `deep link: ?prog= 选中程序`：`location.search = '?prog=<第三个 id>'` → 初始渲染的程序是第三个；`?prog=nope` → 第一个。
- [ ] **Step 2: 跑测试确认失败**：`node python/core/interact.test.js` → 上面 4 条 ✗。
- [ ] **Step 3: 实现** `emitState()`（闭包内，`win.parent && win.parent !== win` 时才 `postMessage`，外包 `try/catch`），在上述触发点调用；`S.progId` 初始化读 `URLSearchParams(win.location.search).get('prog')`。
- [ ] **Step 4: 测试全过**：`node python/core/interact.test.js` → 全部通过。
- [ ] **Step 5: 门** `py_state_bridge_check`：在裸 `vm` 里装载一个工具页的内联 core 与 PROGRAMS（照 `js_parser_parity_check` 的装法），桩 `window.parent === window`，mount、切模式、切程序，断言 `postMessage` 从未被调用；再桩一个父窗口，断言至少收到一条 `type === 'mathviz/py-state'`。负控制：把 `emitState` 的父窗口判断去掉 → 断言红（贴那一行）。
- [ ] **Step 6: 升 engine、改 35 页 mount 行、升版、生成**：`inline_core.py`、`build_programs.py`、`sync_fallback.py`；严格模式 `PYTHON_GATES_REQUIRE_SCIPY=1 /Users/nickma/miniconda3/bin/python3 python/scripts/check.py` → `51 道门全绿`。
- [ ] **Step 7: 浏览器**：`probe.js` 跑 2 页（中英）；另在一个本地父页面里 iframe 打开 `py-strings.html?prog=<id>`，确认选中、父页收到消息。
- [ ] **Step 8: 终审（一次）+ 修复 + 范围复审，PR、读 CI、合并**（照 `python-content-wave` 第 5–7 步）。

---

## 第 1 期 · pfapp 地基 + python

全部在 MV 新 worktree（分支 `claude/pfapp-foundation`，从第 0 期合并后的 main 切）里，`pfapp/` 子目录。命令在 `pfapp/` 下跑。

### Task 2: 骨架与目标配置

**Files:**
- Create: `pfapp/{package.json, bun.lock, tsconfig.json, biome.json, .gitignore, README.md}`、`pfapp/app/next.config.mjs`、`pfapp/app/src/lib/target.ts`、`pfapp/targets/{math,chess,crypto,python}/{target.json, manifest.json}`
- Test: `pfapp/tests/unit/target.test.ts`

**Interfaces:**
- Produces: `type TargetId = 'math'|'chess'|'crypto'|'python'`；`interface Target { id: TargetId; appId: string; name: {en: string; zh: string}; port: number; defaultLang: 'en'; groupField: 'cat'|'phase'|'chapter'|'module'; registry: string /* MV 内相对路径 */; toolDir: string; subjectTypes: ('tool'|'program'|'blank'|'library')[] }`；`loadTarget(id?: string): Target`（缺省读 `process.env.MATHVIZ_TARGET`，未知值抛错）。
- `target.json` 的值：math `{registry:'tools.json', toolDir:'outputs', groupField:'cat'}`；chess `{'chess/chess-tools.json','chess/tools','phase'}`；crypto `{'cryptography/cryptography-tools.json','cryptography/tools','chapter'}`；python `{'python/python-tools.json','python/tools','module'}`；python 的 `subjectTypes` 是 `['tool','program','blank','library']`，其余 `['tool','library']`。名称照设计 §5.2。

- [ ] **Step 1: 失败的测试** `target.test.ts`：四个目标 `loadTarget(t).port` 依次 `26454/26455/26456/26457`；`defaultLang === 'en'`；`appId === 'app.primeforge.mathviz.' + t`；manifest 的 `id`/`port` 与 target.json 一致；`loadTarget('x')` 抛错。
- [ ] **Step 2:** `bun test tests/unit/target.test.ts` → FAIL。
- [ ] **Step 3:** 写 package.json（依赖版本照 MTB）、四份 target.json 与 manifest.json（manifest 字段照设计 §7.6：workflows `ask`、`library`，python 另有 `hint`；`ai.mcp: {path:'/api/mcp', jobPathPrefix:'/api/mcp/t/'}`；`tools.allow` 照 Task 10 的工具名；`maxTurns`/`maxRuntimeSeconds`：ask 6/150、hint 4/90、library 10/300；`maxBudgetUsd` 固定 ask 0.15、hint 0.08、library 0.4）、`target.ts`。`.gitignore`：`node_modules/ .next/ build/ out/ *.tsbuildinfo test-results/`。
- [ ] **Step 4:** `bun test tests/unit/target.test.ts` → PASS；`bunx biome check .` 干净。
- [ ] **Step 5: 提交**（显式路径）。

### Task 3: 提取器

**Files:**
- Create: `pfapp/extract/{index.ts, catalog.ts, labels.ts, python-source.ts, provenance.ts, cli.ts}`
- Test: `pfapp/tests/unit/extract.test.ts`（以真实 MV checkout 为输入：`MATHVIZ_PATH`，缺省 `pfapp/..`）

**Interfaces:**
- Consumes: `loadTarget`。
- Produces:
  - `extract(target: Target, mvPath: string, outDir: string): Promise<{ tools: number; files: string[]; fingerprint: string }>`——写 `outDir/payload/…`；`fingerprint` = 除 `provenance.json` 外全部 payload 文件的 sha256（路径排序后串接再 sha256）。
  - `CatalogItem { id; file /* 'tools/<basename>' */; group: string; groupLabel: {en; zh}; order: number; accent; version; title: {en; zh}; kicker?; desc?; tag? }`；`catalog.json = { target, items: CatalogItem[], groups: {id, label:{en,zh}}[] }`。
  - `readGroupLabels(target, mvPath): Record<string, {en: string; zh: string}>`：chess `PHASE_LABELS`、crypto `CHAPTER_LABELS`、python `MODULE_LABELS`（各子项目 `app.html`）、math 根 `index.html` 的 `CATS`——按文本定位那段对象字面量并用 `vm`（不执行页面其余脚本）求值。
  - python 的 `source/<programId>.json = { id, tool, title, blurb, notes, lineNotes, tags, boards, level, source /* .py 原文 */ }`——**不含 `run`**。
  - CLI：`bun run extract <target> [--mathviz <path>] [--out <dir>]`，打印工具数、指纹、与上次（`--compare <dir>`）相比变了哪些文件。
- MV checkout 必须干净（`git -C <mv> status --porcelain` 非空即退出 1），HEAD SHA 写进 provenance。

- [ ] **Step 1: 失败的测试**：
  - `python 目录 35 条、分组 8 个、每条 tools/<file> 与 MV 源文件 sha256 相同`；math 62、chess 5、crypto 27。
  - `source 里没有 run 字段`：遍历 375 个 `source/*.json`，`'run' in obj === false`。
  - `确定性`：同一 MV 提取两次到两个目录，全部文件逐字节相同。
  - `provenance 不含时间`：JSON 里没有任何键名含 `time`/`date`，`sha` 等于 `git rev-parse HEAD`。
  - `注册表之外的文件不进包`：python 的 payload 里没有 `_skeleton.html`。
- [ ] **Step 2:** `bun test tests/unit/extract.test.ts` → FAIL。
- [ ] **Step 3:** 实现。
- [ ] **Step 4:** → PASS。
- [ ] **Step 5: 提交**。

### Task 4: pfapp 的门与接线

**Files:**
- Create: `pfapp/scripts/check.ts`
- Modify: `.githooks/pre-commit`（`pfapp/**` 或四个注册表有改动时跑 `bun --cwd pfapp run check:content`）、`.github/workflows/registry-sync.yml`（装 Bun 1.3.5，跑同一命令 + `bun test` + typecheck + biome）、根 `CLAUDE.md`（新节「pfapp/」：目录、门、日常流程照设计 §8）

**Interfaces:**
- Produces: `bun run check:content` 退出码 0/1，逐项打印：提取一致（四目标）、组标签一致、确定性、`git ls-files 'pfapp/**/*.html'` 为 0。

- [ ] **Step 1: 负控制先行**：在临时拷贝的 MV（`git archive HEAD | tar -x` 到草稿区）上：改一页一个字节后，让 check 读一份过期的 payload → 「提取一致」断言红；删一条注册表条目 → catalog 条数断言红；在 `pfapp/` 放一个 `x.html` 并 `git add`（在草稿区的临时仓库里）→ 断言红。每条贴红的那一行。
- [ ] **Step 2:** 实现 `check.ts` 到全绿；hook 与 CI 接线；本地跑一次 `.githooks/pre-commit` 等价命令。
- [ ] **Step 3: 提交**；推分支后读 CI（`gh pr checks`）——此刻还没开 PR 就推一个 draft PR 看 CI。

### Task 5: SQLite 层与 schema

**Files:**
- Create: `pfapp/app/src/lib/db/sqlite/{connection,drizzle,migrator,statement}.ts`（从 MTB `trainer/src/lib/db/sqlite/` 拷，保留出处注释）、`pfapp/app/src/lib/db/{schema.ts, open.ts}`、`pfapp/app/drizzle/0000_init.sql`
- Test: `pfapp/tests/unit/db.test.ts`

**Interfaces:**
- Produces: `openDb(dataDir: string): Db`（`<dataDir>/mathviz.sqlite`，启动时迁移，备份轮转照 MTB `open.ts`）。表：
  - `settings(key text pk, value text)`——`lang`。
  - `content_state(id integer pk check(id=1), addon_version text, addon_source text /* 'store'|'manual' */, mv_sha text)`。
  - `catalog_items(id text pk, grp text, ord integer, title_en, title_zh, file, version, accent)`。
  - `library_docs(id text pk /* 'tool:<id>' | 'program:<id>' */, kind text, title text, body text)` + `library_fts` = `fts5(title, body, content='library_docs', tokenize='trigram')`。
  - `threads(id text pk /* ulid */, title, archived integer, created_at, updated_at)`、`thread_subjects(thread_id, subject_type text /* 'tool'|'program'|'blank'|'library' */, subject_id text)`、`messages(id pk, thread_id, role text /* 'user'|'assistant' */, text, citations text /* JSON string[] */, created_at)`、`notes(id pk, message_id, created_at)`、`ai_jobs(id pk, thread_id, workflow, status, ticket, platform_job_id, error, created_at, updated_at)`（状态机照 MTB `jobs.ts`）。

- [ ] **Step 1: 失败的测试**：`openDb(tmp)` 后五张主表存在；`library_fts` 能建并查到（**第一件事实测 `bun:sqlite` 与 `node:sqlite` 都支持 `fts5` + `trigram`**——node 侧用 `node -e` 跑一段 `new DatabaseSync(':memory:').exec("create virtual table t using fts5(x, tokenize='trigram')")`，结果写进测试注释；不支持则把 `library_fts` 换成普通表、Task 6 走纯 `LIKE`，在报告里写明）；迁移重复跑幂等。
- [ ] **Step 2–4:** FAIL → 实现 → PASS。
- [ ] **Step 5: 提交**。

### Task 6: 读内容包、建目录与检索

**Files:**
- Create: `pfapp/app/src/lib/content/{installed.ts, manual-import.ts, index-builder.ts, search.ts}`；`pfapp/app/src/lib/addons/client.ts`（照 MTB `src/lib/addons/client.ts`）
- Test: `pfapp/tests/unit/content.test.ts`（输入用 Task 3 提取出的真实 python payload）

**Interfaces:**
- Consumes: `extract`（测试里造内容包目录）、`openDb`。
- Produces:
  - `findContent(env): Promise<{ dir: string; version: string; source: 'store'|'manual' } | null>`：读 `/addons/v1/installed` 与 `PRIMEFORGE_ADDONS_DIR/<appId>/content/<ver>/`，以及手动导入目录 `<DATA_DIR>/addons-manual/<ver>/`，**取版本最高者**。
  - `importAddonFile(file: string, dataDir: string): Promise<string /* version */>`：解 `.pfaddon`（gzip tar），校验 `addon.json.appId === target.appId`，放到 `addons-manual/<ver>/`。
  - `ensureIndexed(db, content): void`：`content_state.addon_version` 不同时重建 `catalog_items` 与 `library_docs`/`library_fts`（python：每个工具一条 `tool:`、每个程序一条 `program:`，body = 标题 + blurb + notes + 去掉挖空行的源码——检索结果不泄题；数学等第 2 期再加可读文字）。
  - `searchLibrary(db, q: string, limit = 8): {id, title, snippet}[]`：`[...q].length < 3` 时 `LIKE '%q%'`，否则 `library_fts MATCH`。

- [ ] **Step 1: 失败的测试**：
  - `版本取高`：商店 1.0.3、手动 1.0.4 → 手动；再装商店 1.0.5 → 商店。
  - `重建`：版本变了 → `catalog_items` 行数 35、`library_docs` 35 + 375；版本不变 → 不重建（计数 SQL 调用或时间戳）。
  - `两字中文`：python 内容里有讲解含「递归」的程序，`searchLibrary(db,'递归')` 非空；`searchLibrary(db,'recursion')` 非空；
  - `检索不泄题`：任取一个挖空答案行（去缩进，≥ 12 字符），`searchLibrary` 返回的任何 `snippet` 都不含它。
  - `导入拒收别的应用的包`：`appId` 不符 → 抛错。
- [ ] **Step 2–4:** FAIL → 实现 → PASS。
- [ ] **Step 5: 提交**。

### Task 7: HTTP 防护、内容路由、语言

**Files:**
- Create: `pfapp/app/src/proxy.ts`、`pfapp/app/src/lib/http/{guard,csp,body,errors,route}.ts`（照 MTB）、`pfapp/app/src/app/c/[ver]/tools/[file]/route.ts`、`pfapp/app/src/lib/i18n/{messages/en.ts, messages/zh.ts, locale.ts}`（照 LSL 的结构）、`pfapp/app/src/app/api/settings/route.ts`
- Test: `pfapp/tests/integration/http.test.ts`

**Interfaces:**
- Produces: `GET /c/<ver>/tools/<file>`：`ver` 不等于当前内容版本 → 404；`file` 必须在 `catalog_items.file` 里（防路径穿越）；返回 `text/html; charset=utf-8`，头部 CSP `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self'`，`Cache-Control: public, max-age=31536000, immutable`（URL 带版本）。
- `GET/PUT /api/settings {lang: 'en'|'zh'}`，缺省 `'en'`；写请求要 CSRF（照 MTB guard）。

- [ ] **Step 1: 失败的测试**：版本不符 404；`../../etc/passwd`、不在目录里的文件名 404；正常文件 200 且字节与内容包相同、CSP 头逐字等于上面；`PUT /api/settings` 无 CSRF → 403、有 → 200，再 `GET` 得到新值；缺省 `lang === 'en'`。
- [ ] **Step 2–4:** FAIL → 实现 → PASS。
- [ ] **Step 5: 提交**。

### Task 8: 外壳：侧栏与工具页

**Files:**
- Create: `pfapp/app/src/app/[locale]/{layout.tsx, page.tsx, tool/[id]/page.tsx, empty/page.tsx}`、`pfapp/app/src/components/{sidebar.tsx, tool-frame.tsx, command-k.tsx, lang-switch.tsx, empty-state.tsx}`、`pfapp/app/src/app/globals.css`（色彩 token 取自 `design-system/math-viz-design-system.md`）
- Test: Playwright `pfapp/tests/e2e/shell.spec.ts`（Task 12 起整体跑；本任务先写 2 条）

**Interfaces:**
- Consumes: `catalog_items`、`settings.lang`、`findContent`。
- Produces: `/tool/<id>` → iframe `src = /c/<ver>/tools/<file>?lang=<lang>`（python 目标另加 `&prog=<id>` 当 URL 带 `?prog=`）；侧栏按 `grp` 分组、组内按 `ord`、标签按语言、当前项高亮、显示版本号；⌘K 按标题与 tag 过滤；没有内容包 → `/empty`（「从商店安装」说明 + 「导入本地内容包」按钮，调 `POST /api/content/import`，multipart，CSRF）。

- [ ] **Step 1: e2e 失败的测试**：`侧栏 8 组、35 项、第一项高亮可点、点后 iframe src 以 /c/<ver>/tools/ 开头且带 lang=en`；`切到中文后侧栏组标签变中文、iframe 以 lang=zh 重载`。
- [ ] **Step 2–4:** FAIL → 实现 → PASS（`bunx playwright test tests/e2e/shell.spec.ts`，用 Task 12 的测试启动脚本：临时 DATA_DIR、预装 Task 3 提取的 python 内容包、假平台）。
- [ ] **Step 5: 提交**。

### Task 9: 外壳接收 python 状态

**Files:**
- Create: `pfapp/app/src/lib/py-state.ts`、`pfapp/app/src/components/use-py-state.ts`
- Test: `pfapp/tests/unit/py-state.test.ts`

**Interfaces:**
- Consumes: Task 1 的消息格式。
- Produces: `parsePyState(ev: {origin: string; data: unknown}, expectedOrigin: string, page: string): PyState | null`——origin 不等、`type`/`v` 不对、字段类型不对、`page` 不等于当前工具 id → `null`。`PyState = {progId; mode; blankId: string|null; given: string[]}`。`usePyState(iframeRef, toolId): PyState | null`（React hook，切工具时清空）。

- [ ] **Step 1: 失败的测试**：合法消息 → 对象；错 origin / `v: 2` / `mode: 'x'` / `given` 不是数组 / 别的页 → `null`。
- [ ] **Step 2–4:** FAIL → 实现 → PASS。
- [ ] **Step 5: 提交**。

### Task 10: AI 任务、MCP 工具、取材与不泄题

**Files:**
- Create: `pfapp/app/src/lib/agent/platform/client.ts`（照 MTB，含 409 重新注册与引擎偏好）、`pfapp/app/src/lib/mcp/{route.ts, server.ts, tools.ts}`、`pfapp/app/src/lib/ai/{jobs.ts, context.ts, leak.ts}`、`pfapp/app/src/app/api/mcp/[[...path]]/route.ts`
- Test: `pfapp/tests/unit/leak.test.ts`、`pfapp/tests/integration/ai.test.ts`、`pfapp/tests/integration/fake-platform.ts`（照 MTB，加一个「不守规矩」的假引擎）

**Interfaces:**
- Consumes: `openDb`、`ensureIndexed`、`searchLibrary`、python `source/*.json`、`PyState`。
- Produces:
  - `allowedBlanks(programId, pyState: PyState | null): 'all' | Set<string>`——`mode === 'read'` → `'all'`；否则 = `new Set(given)`（`pyState` 为 null 或别的程序 → 空集）。
  - `programContext(programId, allowed): {title, notes, lineNotes, source}`——不允许的空：挖空体换成 `# ___ (blank <id>) ___` 一行（保持缩进），挂在其任何一行上的 `lineNotes` 删掉；BLANK 指令行里的 `hint` 保留（分级提示本来就给学生看）。
  - `forbiddenAnswerLines(programId, allowed): string[]`——不允许的空的答案行，去缩进、去空白。
  - `leakCheck(text: string, forbidden: string[]): string | null`——`text` 去掉全部空白后包含任何一条（同样去空白）→ 返回那一条，否则 `null`。
  - MCP 工具（名字即 manifest 的 `tools.allow`）：`mv_get_task(ticket)`、`mv_search_library(query, limit)`、`mv_read_item(id)`、`mv_list_groups()`、`mv_submit_answer(ticket, text, citations: string[], revealsAnswer?: boolean)`。workflow 白名单：`ask` = get_task, read_item, submit_answer；`hint` = get_task, submit_answer；`library` = 全部五个。
  - `submit_answer`：`leakCheck` 命中 → 返回工具错误「answer reveals a blank that is not allowed yet; rewrite without it」；同一 job 第二次命中 → job 置 `failed`，`error = 'needs-blank-done'`；`citations` 里不在 `library_docs` 的 id 丢弃。
  - `submitJob(db, {threadId, workflow, subjects, pyState})`、`reconcileJobs(db)`（启动时）、`pollJob(db, jobId)`——照 MTB `jobs.ts` 状态机。

- [ ] **Step 1: 失败的单元测试** `leak.test.ts`：取一个真实 python 程序（含 ≥ 2 个空）：`mode:'blank', given:[]` → `programContext` 源码里没有任何答案行、没有挂在挖空行上的行注；`given:[b1]` → b1 的答案在、b2 的不在；`mode:'read'` → 全在；`leakCheck('…' + 答案行加多余空格 + '…', forbidden)` 命中；不相关文字 → `null`。
- [ ] **Step 2: 失败的集成测试** `ai.test.ts`（假平台）：守规矩的引擎 → 回答落进 `messages`、引用只剩合法 id；**不守规矩的引擎**（直接把答案行贴进 `submit_answer`）→ 第一次收到工具错误、第二次 job `failed` 且 `error === 'needs-blank-done'`；library workflow 调 `mv_search_library('递归')` 有结果；`mv_read_item` 对挖空模式不返回答案行；启动对账把 `running` 且平台已完成的 job 收回。
- [ ] **Step 3–4:** 实现 → PASS。
- [ ] **Step 5: 提交**。

### Task 11: 问答、笔记、问整个库的界面与 API

**Files:**
- Create: `pfapp/app/src/app/api/threads/{route.ts, [id]/route.ts}`、`pfapp/app/src/app/api/jobs/[id]/route.ts`、`pfapp/app/src/app/api/notes/route.ts`、`pfapp/app/src/components/qa/{ask-panel.tsx, thread-view.tsx, notes-view.tsx, library-ask.tsx, citation-link.tsx}`、`pfapp/app/src/app/[locale]/{notes/page.tsx, ask/page.tsx}`
- Test: `pfapp/tests/integration/threads.test.ts`

**Interfaces:**
- Consumes: Task 10 的 `submitJob` / `pollJob`、Task 9 的 `usePyState`。
- Produces:
  - `POST /api/threads {subjects: {type, id}[], message: string, workflow: 'ask'|'hint'|'library', pyState?: PyState}` → 202 `{threadId, jobId}`；`GET /api/jobs/<id>` → `{status, threadId}`；`GET /api/threads/<id>` → 消息列表；`POST /api/notes {messageId}`、`DELETE /api/notes/<id>`、`GET /api/notes?q=`。
  - 工具页右侧「问」面板：python 目标显示当前程序 / 空（来自状态桥），按钮「问这个程序」「要一条提示」（`hint`，只在挖空模式且聚焦了一个空时可用）；其余目标「问这个工具」。提交后「正在思考…」+ 取消；`failed` 且 `needs-blank-done` 时显示「先做完这个空，或在读模式里问」。
  - `/ask`：问整个库；回答下列出引用，点开 `/tool/<toolId>`（python 程序引用 → `/tool/<toolId>?prog=<programId>`）。
  - 回答旁「存为笔记」；`/notes` 按时间列出、可搜索、可删除。回答渲染 Markdown（`markdown-it`，转义 HTML）。

- [ ] **Step 1: 失败的集成测试**：发问 → 202 → 假平台完成 → 线索里有一问一答；存笔记 → `GET /api/notes` 有一条；`q` 过滤；删除后为空；`hint` 在 `pyState.mode !== 'blank'` 时 400。
- [ ] **Step 2–4:** FAIL → 实现 → PASS。
- [ ] **Step 5: 提交**。

### Task 12: 入口、打包形态与端到端

**Files:**
- Create: `pfapp/app/primeforge-entry.mjs`（照 MTB：读 `PRIMEFORGE_*`、进程内 `next({dev:false})`、监听 `127.0.0.1:${PRIMEFORGE_PORT}`、SIGTERM 4 秒收尾）、`pfapp/targets/*/icon.svg`（四个目标同一 M/V 标记、四种 accent：math cyan、chess violet、crypto rose、python emerald；照 PFD `docs/app-icon-standard.md`）、`pfapp/tests/e2e/{setup.ts, python.spec.ts}`、`pfapp/scripts/build-local.ts`（`MATHVIZ_TARGET=<t> next build` 并拷出 PFD 构建脚本需要的文件清单，供 Task 13 复用）
- Test: `pfapp/tests/e2e/python.spec.ts`

**Interfaces:**
- Produces: `bun run build -- --target python` 产出 `pfapp/build/python/`（`.next`、`drizzle`、入口、`next.config.mjs`、`package.json`、`bun.lock`、`public`、`manifest.json`、`icon.svg`）；Task 13 的 PFD 脚本只做「装生产依赖 + 检查 + 签名」。

- [ ] **Step 1: e2e 失败的测试**（假平台、临时 DATA_DIR、预装 python 内容包、起 `primeforge-entry.mjs`）：
  - **35 个 python 页逐个打开，每页控制台 0 条 error、0 条 CSP 违规**（Review Focus 1）。
  - 在 iframe 里切到挖空模式 → 外壳的「要一条提示」变为可用。
  - 问一个程序 → 出答案；问整个库 → 答案下有可点引用、点开后 iframe URL 带 `prog=`。
  - 换一个端口重启后，笔记与问答历史还在（反目标 4）。
- [ ] **Step 2–4:** FAIL → 实现 → PASS；`bun run check`（lint + typecheck + 单元 + 集成）全绿。
- [ ] **Step 5: 提交**；开 PR，读 CI。

### Task 13: PFD 构建脚本

在 PFD 新 worktree（`git -C /Users/nickma/Develop/darkhorseone/system/PrimeForge-Desktop worktree add -b claude/mathviz-builds <路径> origin/main`；**不碰 PFD 主工作区**，它有用户未提交的改动）。

**Files:**
- Create: `scripts/build-mathviz.ts`、`scripts/build-mathviz-addon.ts`、`scripts/mathviz-content-releases.json`（初始 `{}`）、`scripts/build-mathviz.test.ts`、`scripts/build-mathviz-addon.test.ts`
- Modify: `package.json`（`build:mathviz`、`build:mathviz-addon`）、`docs/build-manual.md`（新节）

**Interfaces:**
- `bun run build:mathviz <target>`：`MATHVIZ_PATH` 缺省 `~/Develop/My2ndBrain/MathViz`；MV 干净 → `bun --cwd <mv>/pfapp run build -- --target <t>` → 装生产依赖、检查无原生代码 / 无 checkout 路径 / 无符号链接（照 `build-mathtestbuddy.ts:84-109`）→ `pack` → `out/app.primeforge.mathviz.<t>-<ver>.pfapp`。
- `bun run build:mathviz-addon <target> [--status]`：调 MV 提取器到临时目录 → 指纹与 `mathviz-content-releases.json[<t>]` 比：相同 → 退出 2「nothing to release」；不同 → 版本 patch +1（首次 `1.0.0`）→ 写 `addon.json`（`format:1, id:'<appId>/content', appId, version, kind:'content', title, minAppVersion:<该目标应用当前版本>, unpackedBytes`）→ `pack:addon`；`--status` 只打印差异与将要的版本、不打包。发布成功后（`publish:addon` 之后，手动）跑 `--record <version> <fingerprint>` 更新 json 并在 PFD 提交。

- [ ] **Step 1: 失败的测试**（照 PFD 现有 `build-*.test.ts` 的写法，用一个假 MV 目录）：MV 不干净 → 退出 1；指纹不变 → 退出 2；变了 → 版本 1.0.0 → 记录后再变 → 1.0.1；`addon.json` 字段与 PFD `packages/app-contract/src/addon-manifest.ts` 解析器一致（直接调解析器）。
- [ ] **Step 2–4:** FAIL → 实现 → PASS（PFD 的 `bun test scripts/build-mathviz*.test.ts`）。
- [ ] **Step 5:** 本机真打一次 python 的应用包与内容包（签名需要种子：没有就停下问用户），`bun run` PFD 的包校验通过。
- [ ] **Step 6: 提交**；在 PFD 开 PR（PFD 自己的 CI 与合并规则——合并前问用户）。

### Task 14: 上架与验收（对外动作，逐步问用户）

- [ ] **Step 1:** 问用户：本机 Desktop 升到 ≥ 1.45；在控制台为 python 应用与 python 内容包建商品（免费）；确认发布。
- [ ] **Step 2:** 得到同意后 `publish:app`、`publish:addon`、`--record`。
- [ ] **Step 3:** 本机 Desktop 从商店装 python 应用与内容包；打开、逐项过 Task 12 的 e2e 场景（这次是真引擎）；结果写进 `pfapp/README.md` 的验收记录与第 1 期台账。

---

## 自查记录

- 设计覆盖：§5 结构 → T2；§6 管线 → T3、T13；§7.1 → T6、T12；§7.2 → T8；§7.3 → T1、T7、T8、T9；§7.4 → T10、T11；§7.5 → T5、T6、T10、T11；§7.6 → T2；§8 → T13、T14；§9 → T1、T4、T12；§10 第 0–1 期 → 本计划。第 2–3 期另写。
- 名字一致：`loadTarget`、`extract`、`openDb`、`findContent`、`ensureIndexed`、`searchLibrary`、`parsePyState`、`allowedBlanks`、`programContext`、`forbiddenAnswerLines`、`leakCheck`、`submitJob`、MCP 工具 `mv_*`——各任务的 Interfaces 互相对得上。
