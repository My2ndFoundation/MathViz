# 国际象棋子项目 · 阶段 2（棋谱回放：工具③ + 30 局棋谱）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付工具③ `chess-game-replay`——四个页签（`board` / `trace` / `eval` / `heat`），z 轴 = 回合数，一整局棋是三维里的一条曲线——并内置 30 局历史棋谱与双语背景故事，回放到关键步自动暂停并弹出说明。

**Architecture:** 三层。① `chess/core/replay.js` 是新的**纯逻辑内核**（回放状态机、三条评估曲线、子力轨迹、累计热力），零 DOM、node 可测，本阶段的全部 TDD 都在它和棋谱校验门上。② `chess/games/` 是棋谱数据层：六个分组文件各自独立（并行开工不冲突）+ 一个汇总器 + 一道校验门。③ `chess/tools/chess-game-replay.html` 是单文件工具，通过 `VizEngine.init({ SCENES, PARAMS, TOOL })` 驱动，`inline_core.py` 把六个 core/games 模块注入进去。同时本阶段执行一项阶段 0 遗留的架构决定（F4）：删除引擎里那套按 0.02 秒量化浮点行的录制采样器。

**Tech Stack:** 纯 ES2015、Canvas 2D、零依赖、零构建。Python 3 仅用于内联同步。

---

## Global Constraints

- **零依赖**：不得引入任何 npm 包、CDN 资源、外部字体或图片。
- **单文件可用**：`chess/tools/*.html` 必须 `file://` 双击可用。棋谱全部内联，不 fetch。
- **UMD 双导出**：`core/*.js` 与 `games/*.js` 既支持 `module.exports`（node 测试），也挂到 `window`。
- **模块顶层不得触碰 DOM**：`document` / `window` / `localStorage` / `location` 只能在函数体内出现。
- **英文默认、中文可切**（规格 §1.6）。所有面向用户的文案是 `{zh, en}` 对象，经引擎的 `t()` 渲染。
- **标准术语**（规格 §3）：King/Queen/Rook/Bishop/Knight/Pawn、`a1`–`h8`、rank/file/diagonal、square（不用 grid）。中文界面下战术术语并列英文（`弃后 queen sacrifice`）。
- **canvas 是主角**：工具③ **不使用分屏**（分屏只属于 ④⑤，规格 §1.5）。所有 UI 浮在 canvas 之上。
- **一切按时间推进，不按帧计数**。开发机是 30Hz 外接显示器；按帧计数的动画会慢一半。
- **性能预算**：单帧绘制耗时 ≤4ms，强制光栅化后测量，**探针开销单列并排除**（规格 §2.5）。
- **并行开工纪律**：`git status --short` 后只暂存自己的路径，**禁止 `git add -A` / `git commit -a`**（CLAUDE.md 有专条，是事故换来的）。
- **规格来源**：`docs/superpowers/specs/2026-08-02-chess-viz-suite-design.md` §4③、§5、§6、§1.3。有冲突以规格为准并在计划里记一笔。

### 给每一位执行者的硬性要求

> **如果本计划里某条国际象棋事实是错的、或某个测试断言了一件事实上错误的事，停下来报告，不许改代码或改测试去迁就它。计划是记录，不是权威。**

这条在阶段 0 与阶段 1 里抓出了 13 处计划缺陷。同样适用于棋谱：**任何一局棋谱都不许凭记忆敲**——取一份真实的 PGN，让走法生成器逐步重放通过（见 Task 8–12 的取谱协议）。

---

## 本阶段 owns 的三个架构决定（已定，不再讨论）

### 决定 1（F4）：删除引擎里的浮点采样录制骨架

`viz-engine.js` 现有约 250 行录制/回放子系统：按 `REC_DT = 0.02` 秒量化采样、把 `capture()` 的对象拍扁成浮点行、存 JSON、载入时做「种子复现比对」。阶段 0 的最终审核把它列为 F4 并推迟到本阶段决定。

**决定：删掉。** 理由三条，都可验证：

1. 它的每一个前提在棋这里都不成立——没有连续时间（`state.t` 只被它自己读）、没有随机种子（`h.seed()` / `h.reseed()` 无从实现）、没有「一轮」的概念（`h.roundOf()` 同理）。
2. 规格 §1.3 明确：本子项目的存档格式**就是 PGN**。`chess-core.js` 已经有 `parsePGN` / `writePGN`，工具③ 的「保存」是一次 `writePGN` + 一次下载，与这套骨架一行都不共用。
3. 工具①② 都没有声明 `RECORD`，`recHooks()` 恒为 `null`，所有 `rec*` 函数第一行就 early-return——删除对它们**不可见**，风险只在删干净与否。

**不选「改形状成五工具共用的离散传输控件」的理由**：现在只有一个消费方（工具③），把它提前塞进引擎等于凭空猜阶段 4/5 调试器的需求。工具③ 的传输逻辑先放在可测的 `replay.js` 里；等阶段 4 有第二个真实消费方时再决定要不要上提。

### 决定 2：引擎提供 `state.dt`，工具不再各自造钟

删掉 `simAdvance` / `state.t` 之后，帧循环里那个已经算好并 `clamp` 到 `[0, 0.05]` 的 `dt` 就没有出口了。而工具①② 各自在 `draw()` 里用 `performance.now()` 又算了一遍（`frameDt()`）——同一个量两处计算，正是 CLAUDE.md 反复警告的漂移源。

**决定：引擎每帧把 `dt` 写进 `state.dt`，工具①② 的 `frameDt()` 改成读它。** 一处出口。

### 决定 3：PGN 原文就是数据，不再另抄一份元数据字段

规格 §2 的目录树里列了 `games/*.pgn` + `games.js` 两份东西。**合成一份**：每条记录的 `pgn` 字段直接放**整份 PGN 原文（含标签对）**，也就是你拿到的那个 `.pgn` 文件的内容。棋手、赛事、日期、结果、半步数全部在载入时从它读出来，**一个都不另抄成字段**。

理由很直接：抄下来的字段只会有两种命运——与 PGN 一致（那它是冗余），或与 PGN 不一致（那它是 bug）。既然 `parsePGN` 已经把标签对解析出来了，让它做这件事。

**这也意味着本阶段不做棋谱版本考据。** 同一局棋在不同来源可能有长短不一的记谱，我们**不判定哪一版是"真的"**：取一份能重放的，把来源 URL 记在 `source` 里，故事按这一份写。这个工具是用来看懂一局棋怎么下的，不是做记谱考古的。

---

## 已有的内核接口（本阶段只消费，除 Task 1/2 外不修改）

以下签名**已在本机对着运行中的代码逐条核实过**，可以照抄：

```js
// chess-core.js  （module.exports 与 window.ChessCore 双导出）
WHITE=1 BLACK=-1 EMPTY=0 P=1 N=2 B=3 R=4 Q=5 K=6
SQ(file,rank) fileOf(sq) rankOf(sq) offBoard(sq) toAlg(sq) fromAlg('e4')
START_FEN
Position.fromFEN(fen, { requireKings })   // requireKings 默认 true；无王局面必须传 false
new Position()                            // 空盘，直接写 board[] 摆子
pos.board[]                               // 0x88，128 长；越界格用 offBoard(sq) 判
pos.turn pos.castling pos.ep pos.half pos.full pos.kingW pos.kingB
pos.clone() pos.toFEN() pos.kingSq(colour)
pos.pseudoLegalMoves() pos.legalMoves()
pos.attacksFrom(sq)      // 攻击域：含友方占据格；兵只给两条斜线（不含前进）
pos.attackedBy(sq, colour) pos.isAttacked(sq, by) pos.inCheck(colour) pos.status()
pos.make(move)                            // 不可变，返回新 Position
FLAG = { CAPTURE:1, EP:2, CASTLE_K:4, CASTLE_Q:8, DOUBLE:16, PROMO:32 }
moveToSAN(pos, move) parseSAN(pos, s) moveToUCI(move) parseUCI(pos, s) sameMove(a,b)
parsePGN(text)   // → { headers, moves[], positions[], result, skipped, startFEN }
                 //   positions[0] 是起始局面，positions[i] 是走完第 i 个半步之后
                 //   注释 {} 与变着 () 已被逐层剥掉，剥掉几段记在 skipped
writePGN(headers, moves, startFEN)        // → 完整 PGN 文本（七标签 + 80 列折行）
perft(pos, depth) perftDivide(pos, depth)
// Move = { from, to, piece, captured, promo, flags }

// viz-engine.js  （window.VizEngine）
init({ canvas, SCENES, PARAMS, TOOL, VERSION, ENGINE_VERSION, autoLoop })
cam  state  makeCam() proj(C,[x,y,z]) unproject(C,[sx,sy],planeZ) viewInfo() withContext(ctx,fn)
strokePoly line3 glowDot solidDot label3 arrowAt drawAxes drawGridXY
clamp fmt fmtS t bindOrbit
// SCENES[id] = { label, brand, tips, views{}, presets[], presetsLabel, params[], toggles[], draw(C), readout() }
// views 只放相机角度；presets 放离散具名内容。views 的第一项必须是 iso（双击回家）。
// state.running 默认 false（载入即暂停）。

// board-render.js  （window.BoardRender）
layout({files,ranks,cell}) → { files, ranks, cell, w, h, squareCenter(f,r), squareCorners(f,r) }
drawBoard(ctx,C,E,spec) drawCoordLabels(ctx,C,E,spec)
drawPiece(ctx,C,E,{code,center,scale,alpha,cell})   // center 是世界点，z 任意
pickSquare(C,E,[sx,sy],L) → { file, rank } | null
pieceAutoScale(C,E,center,cell)   // 棋子尺寸必须用它，不要传固定像素值
fileLabel(i) isLight(f,r) COORD_LABEL_OFFSET PIECE_BOX PIECE_ANCHOR CODE_KEY PIECE_PATHS

// interact.js  （window.Interact）——本阶段不消费，工具③ 是只读回放
```

### 世界坐标与相机约定（务必读完再动手，这里错过一次）

- 棋盘铺在世界 **x–y 平面**（`squareCenter` 返回 `[x, y, 0]`），法线是 **z 轴**。
- **顶视 = `az: 0, el: 0`**，不是 `el: π/2`。写成 `el: 1.45` 会让相机跑到离法线 83° 的地方，几乎贴着棋盘边看——阶段 1 犯过这个错并由用户截图抓出。
- **侧视 = `az: -π/2 ≈ -1.5708, el ≈ 0`**：此时屏幕水平向右正好是 **+z**。这是把「z = 回合数」画成一张普通折线图的唯一正确机位，也是本工具的**顿悟视角**。
- 顶视相机 eye 在 **+z** 一侧。因此工具③ 的历史必须沿 **−z** 展开（当前局面 z=0，第 i 个半步在 `z = -(cur - i)·zStep`），历史才是「向远处退去」而不是糊在镜头前。工具② 的应手层用的是 `+z = 1.7`，那是单薄一层、不会撞相机的特例，**不要照抄它的符号**。

---

## File Structure

| 文件 | 责任 | 归属 track |
|---|---|---|
| `chess/core/viz-engine.js` | 删除 F4 录制骨架；新增 `state.dt` | A |
| `chess/core/board-render.js` | `layout()` 支持可选 `z`，`pickSquare` 跟随 | A |
| `chess/core/board-render.test.js` | 上者的测试 | A |
| `chess/scripts/inline_core.py` | 新增可选源 `REPLAY` / `GAMES` | A |
| `chess/scripts/check.py` | 测试发现范围扩到 `games/*.test.js` | A |
| `chess/core/replay.js` | ★ 回放内核：状态机 + 三条曲线 + 轨迹 + 热力。纯逻辑、零 DOM | B |
| `chess/core/replay.test.js` | 上者的测试 | B |
| `chess/games/games.js` | ★ 汇总器：合并六个分组、学习路线、按 id 索引 | C |
| `chess/games/games-teaching.js` | ★ 教学构造局（2 局） | C |
| `chess/games/games-machine.js` | ★ 人机对抗（5 局） | C |
| `chess/games/games-romantic.js` | ★ 浪漫时代（6 局） | C |
| `chess/games/games-coldwar.js` | ★ 冷战与世界冠军战（7 局） | C |
| `chess/games/games-theory.js` | ★ 理论转折（5 局） | C |
| `chess/games/games-human.js` | ★ 争议与人性（5 局） | C |
| `chess/games/games.test.js` | 棋谱校验门（规格 §7 门 2） | C |
| `chess/tools/chess-game-replay.html` | 工具③ | D |
| `chess/chess-tools.json` | 注册工具③ | D |
| `chess/index.html` | 导航页回退列表加工具③ | D |
| `chess/tools/chess-moves-geometry.html` | 仅 Task 1 的 `frameDt()` 改写 + 版本号 | A |
| `chess/tools/chess-rules-check-mate.html` | 同上 | A |

**为什么棋谱拆成六个分组文件**：30 局的双语文案要在六条并行 track 上写。写进同一个 `games.js` 必然在 worktree 合并时冲突，而冲突的是大段中英文散文——最难 review、最容易在解冲突时丢一段。一组一个文件，每条 track 只碰自己那一个，`games.js` 只做汇总（Task 7 一次写死，之后不再改）。这是对规格 §2.1「`games.js` 是唯一编辑源」的细化而非违反：**每一局仍然只有一处编辑源**。

### Track 依赖图

```
Task 1 ─┐
Task 2 ─┼─→（A 完成）
Task 3 ─┘        ↘
Task 4 → 5 → 6 （B：replay.js，可与 A、C 并行）→┐
Task 7 → 8 / 9 / 10 / 11 / 12 （C：五组棋谱，五个 worktree 并行）→┤
                                                                  ↓
                                        Task 13 → 14 → 15 → 16 → 17 → 18（D）
```

- **A 必须最先落地**：Task 1 改的是被内联进每个工具的 `viz-engine.js`，晚做会让 D 的工作被一次全量重新内联覆盖。
- **B 与 C 完全无交集**，可与 A 并行；D 需要 A/B/C 全部完成。
- Task 8–12 之间零依赖，**必须各自一个 worktree**（`isolation: "worktree"`）。

---

## Task 1: 删除 F4 录制骨架，引擎改出 `state.dt`

**Files:**
- Modify: `chess/core/viz-engine.js`
- Modify: `chess/tools/chess-moves-geometry.html`（`frameDt()` + 版本号 + changelog）
- Modify: `chess/tools/chess-rules-check-mate.html`（同上）
- Modify: `chess/chess-tools.json`（两个工具的 `version` / `engine` / `changelog`）

**Interfaces:**
- Consumes: 无
- Produces: `VizEngine.state.dt`（number，每帧由引擎写入，已 clamp 到 `[0, 0.05]`）；`VizEngine.recInfo` **不再导出**；`init()` 不再接受 `RECORD`

- [ ] **Step 1: 按符号名删除录制子系统**

在 `chess/core/viz-engine.js` 里删除下列全部内容（按符号名找，不要按行号——行号会随删除移动）：

| 类别 | 要删的东西 |
|---|---|
| 常量 | `REC_FORMAT` `REC_FORMAT_VERSION` `REC_DT` `REC_MAX_ROWS` `REC_PREC` |
| 状态 | `recState` 整个对象；`state` 里的 `t` 字段；`RECORD` 声明 |
| 函数 | `recHooks` `recInfo` `recShapeOf` `recFlatten` `recUnflatten` `recStartRecording` `recStopRecording` `recPush` `recStep` `recExitReplay` `recSave` `recValidate`/`recLoadDoc` `recVerify` `recInfoText` `buildRecRow` `refreshRecInfo` `refreshRecLocks` `simAdvance` |
| UI 文案 | `UI` 里的 `recRec` `recStop` `recSave` `recLoad` `recExit` `recPlay` `recPause` `recRewind` `recRows` `recFull` `recRoundEnd` `recReplay` `recVerifyOK` `recVerifyNo` `recVerifyTail` |
| 调用点 | `switchTab` 里的 `recStopRecording` / `recExitReplay` / `buildRecRow` 三行；`applyLang`（或 `setLang`）里的 `buildRecRow()`；`init()` 里的 `if (opts.RECORD) RECORD = opts.RECORD;`；`resetSim()` 里的 `state.t = 0;` |
| 导出 | `return {...}` 里的 `recInfo` |

顶部注释里凡是描述这套机制的段落（模块头注释提到 `RECORD` 的两处、`state.t` 的那段说明、`bindKeyboard` 附近提到 `state.t` 的那句）一并改掉，**不要留下描述已删代码的注释**。

`#recHost` 这个 DOM 槽与 `.recrow` / `.recinfo` 两个样式类**全部保留**——工具③ 的传输条要挂在它上面并复用这两个类（见 Task 13）。但 `_skeleton.html` 的 `<style>` 块里那句 CSS 注释

```css
/* 录制 / 回放行（§11）；未声明 RECORD 的工具里 #recHost 始终为空 */
```

已经不再成立（`RECORD` 这个机制没有了），改成：

```css
/* 工具自己的传输条 / IO 行；#recHost 是给它的槽，不需要的工具留空即可 */
```

这三处（`_skeleton.html` 与两个工具的同一段 CSS）都要改。

- [ ] **Step 2: 把帧循环的 `dt` 变成引擎的公开出口**

`state` 声明改成：

```js
  /* state.dt：本帧的时长（秒），由 frame() 每帧写入，已 clamp 到 [0, 0.05]
     以熬过后台标签页的时间跳变。场景在 draw() 里读它来推进自己的动画——
     这是引擎唯一的时钟出口。工具不得自己再用 performance.now() 算一遍：
     同一个量两处计算必然漂移（阶段 1 的两个工具各自造了一份 frameDt()，
     本任务一并收口）。running 默认 false（载入即暂停）。 */
  const state = { running: false, dt: 0 };
```

`frame(ts)` 里，把原来那整段 `if (recState.mode === 'replay') { … } else if (state.running) { … }` 换成一行：

```js
      state.dt = dt;
```

`draw()` 之后那行 `if (ts - lastRO > 120) { lastRO = ts; updateReadout(); refreshRecInfo(); }` 去掉 `refreshRecInfo()`。

- [ ] **Step 3: 工具①② 改用 `E.state.dt`**

两个文件里各有一处：

```js
  var __lastTs = null;
  function frameDt() {
    var now = performance.now();
    var dt = __lastTs == null ? 0 : Math.min(0.05, Math.max(0, (now - __lastTs) / 1000));
    __lastTs = now;
    return dt;
  }
```

整段替换为：

```js
  /* 帧时长只有一个出处：引擎的 state.dt（frame() 每帧写入，已 clamp 到
     [0, 0.05]）。本工具曾用 performance.now() 自己算一份——同一个量两处
     计算，engine 的时钟一改就会悄悄不同步。阶段 2 Task 1 收口到这里。 */
  function frameDt() { return E.state.dt || 0; }
```

其余调用点（`advanceDemo(frameDt())`）不动。

- [ ] **Step 4: 版本号（规格 §10：三处齐动）**

引擎版本 `chess-1.0.0` → **`chess-1.1.0`**（删除子系统 + 新增公开出口 `state.dt`，是引擎的次版本变更）。

两个工具：

- `<meta name="engine-version" content="chess-1.1.0">`
- `<meta name="tool-version" content="1.0.1">`（内部改写、用户可见行为不变 → patch）
- HTML 头部的 changelog 块加一条 1.0.1
- `chess/chess-tools.json` 里两条记录的 `version` → `1.0.1`、`engine` → `chess-1.1.0`，各加一条 changelog：

```json
{ "version": "1.0.1", "date": "2026-08-02",
  "en": "Internal: the frame clock now has a single source (VizEngine.state.dt); the unused float-row recording skeleton was removed from the engine.",
  "zh": "内部改写：帧时钟收口到引擎的单一出处（VizEngine.state.dt）；引擎里未被使用的浮点行录制骨架已删除。" }
```

面板上的版本徽章读的是 meta，不需要单独改。

- [ ] **Step 5: 验证——删干净了，且两个工具没坏**

```bash
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py; echo "chess gate exit=$?"
node -e "
const fs=require('fs');
let bad=0;
const dead=['recState','recFlatten','recUnflatten','recVerify','recSave','recLoadDoc','recStep',
            'recPush','recStartRecording','recStopRecording','recExitReplay','recInfoText',
            'buildRecRow','refreshRecInfo','refreshRecLocks','simAdvance','REC_DT','REC_MAX_ROWS',
            'REC_FORMAT','REC_PREC','recHooks','recInfo'];
for(const f of ['chess/core/viz-engine.js','chess/tools/chess-moves-geometry.html',
                'chess/tools/chess-rules-check-mate.html','chess/tools/_skeleton.html',
                'chess/tools/_piece-preview.html']){
  const s=fs.readFileSync(f,'utf8');
  for(const d of dead) if(s.indexOf(d)>=0){console.error('残留 '+d+' 于 '+f);bad++;}
}
const eng=fs.readFileSync('chess/core/viz-engine.js','utf8');
if(!/state\.dt = dt/.test(eng)){console.error('引擎没有写入 state.dt');bad++;}
if(/state\.t\b/.test(eng)){console.error('state.t 未删净');bad++;}
for(const f of ['chess/tools/chess-moves-geometry.html','chess/tools/chess-rules-check-mate.html']){
  const s=fs.readFileSync(f,'utf8');
  if(/performance\.now\(\)/.test(s.split('/* <<< GENERATED:BOARD-RENDER */')[1]||'')){
    console.error(f+' 的工具区仍在自己算 dt');bad++;}
  if(!/content=\"chess-1\.1\.0\"/.test(s)){console.error(f+' 的 engine-version 没更新');bad++;}
  if(!/content=\"1\.0\.1\"/.test(s)){console.error(f+' 的 tool-version 没更新');bad++;}
}
console.log(bad?('✗ '+bad+' 处问题'):'✓ F4 已删净，state.dt 已就位，两个工具已切换');
process.exit(bad?1:0);
"
```
Expected: `check.py` exit 0；`✓ F4 已删净…`。

- [ ] **Step 6: 浏览器验收（这一步不能跳——「符合模式、过了 check.py」不等于验证过）**

用 preview 工具（`.claude/launch.json` 的 `mathviz`，8777 端口）打开，**每次调用带显式 `tabId`**：

1. `/chess/tools/chess-rules-check-mate.html` — 点 ▶ 播放，预置局面**确实在轮换**（这是 `state.dt` 通路的唯一活体证据；浏览器面板 rAF 被节流到约 12 秒一帧，所以不要靠「我看了几秒」下结论，**改用探针读状态位**）：

```js
// javascript_exec，带 tabId
(() => { const a = VizEngine.state.dt; return { dt: a, running: VizEngine.state.running,
         hasRecInfo: typeof VizEngine.recInfo }; })()
```
Expected: `dt` 是一个 `0 < dt <= 0.05` 的数；`hasRecInfo === 'undefined'`。

2. 同页面点开 ▶ 后，隔一次调用再读当前预置 key，确认它变了：
```js
document.querySelector('.presets[data-tab="legal"] .pbtn.on')?.dataset.preset
```
3. `/chess/tools/chess-moves-geometry.html` — 同样两条。
4. 两个页面的 `#recHost` 是空的（不再有录制按钮行），面板布局没有塌陷。

- [ ] **Step 7: 提交**

```bash
git status --short   # 确认列出的每个路径都是本任务应当改的
git add chess/core/viz-engine.js chess/tools/chess-moves-geometry.html \
        chess/tools/chess-rules-check-mate.html chess/tools/_skeleton.html \
        chess/tools/_piece-preview.html chess/chess-tools.json
git commit -m "refactor(chess): 删除 F4 浮点采样录制骨架，帧时钟收口到 state.dt"
```

---

## Task 2: `board-render.js` — 棋盘可以躺在任意 z 平面上

**Files:**
- Modify: `chess/core/board-render.js`
- Test: `chess/core/board-render.test.js`

**Interfaces:**
- Consumes: 无
- Produces: `layout({ files, ranks, cell, z })` 的返回值多一个 `z` 字段，`squareCenter` / `squareCorners` 返回该 z；`pickSquare(C, E, xy, L)` 用 `L.z` 作为求交平面

工具③ 的 `board` 页要在 `z < 0` 处画历史局面的框线，`trace` 页要沿 z 连折线。`drawPiece` 早就接受任意世界点（`center[2]` 原样透传），差的只有 `layout`。

- [ ] **Step 1: 写失败的测试**

追加到 `chess/core/board-render.test.js`（`T.report()` 之前）：

```js
// ---- layout 的 z 平面 ----
const L0 = BR.layout({ files: 8, ranks: 8, cell: 1 });
T.eq(L0.z, 0, 'layout 默认躺在 z=0');
T.eq(L0.squareCenter(0, 0)[2], 0, '默认格心 z=0');
T.eq(L0.squareCorners(3, 4)[2][2], 0, '默认角点 z=0');

const Lz = BR.layout({ files: 8, ranks: 8, cell: 1, z: -2.5 });
T.eq(Lz.z, -2.5, 'layout 记住给定的 z');
T.eq(Lz.squareCenter(0, 0)[2], -2.5, '格心跟着 z');
T.eq(Lz.squareCorners(3, 4).map(p => p[2]), [-2.5, -2.5, -2.5, -2.5], '四个角点都跟着 z');
// x/y 与 z=0 时逐值相同——抬起平面不该动到平面内的坐标
T.eq(Lz.squareCenter(5, 2).slice(0, 2), L0.squareCenter(5, 2).slice(0, 2), '平移 z 不改 x/y');
T.eq(Lz.w, L0.w, '宽不变');
T.eq(Lz.h, L0.h, '高不变');
```

`pickSquare` 需要一个 `E` 桩。测试文件里已有的桩若不含 `unproject`，补一个最小的正交桩（相机沿 −z 正对棋盘、1:1 缩放）：

```js
// 极简正交相机桩：屏幕 (sx, sy) → 世界 (sx, -sy, planeZ)。
// 只用来验证 pickSquare 是否把 L.z 传给了 unproject，不模拟透视。
const Estub = {
  unproject: function (C, xy, planeZ) { Estub.lastPlaneZ = planeZ; return [xy[0], -xy[1], planeZ]; },
  lastPlaneZ: null,
};
BR.pickSquare(null, Estub, [0, 0], Lz);
T.eq(Estub.lastPlaneZ, -2.5, 'pickSquare 在 L.z 那个平面上求交，不是写死的 0');
BR.pickSquare(null, Estub, [0, 0], L0);
T.eq(Estub.lastPlaneZ, 0, 'z=0 的棋盘照旧在 z=0 求交');
```

- [ ] **Step 2: 运行确认失败**

Run: `node chess/core/board-render.test.js`
Expected: FAIL —— `layout 默认躺在 z=0` 那条报 `expected: 0 / actual: undefined`

- [ ] **Step 3: 写实现**

`layout()` 改成：

```js
  function layout(spec) {
    const files = (spec && spec.files) || 8;
    const ranks = (spec && spec.ranks) || 8;
    const cell = (spec && spec.cell) || 1;
    /* z：棋盘所在的平面。默认 0（前两个工具的全部用法）。工具③ 的历史局面
       沿 −z 后退，每一层是一块自己的 layout——把 z 放进 layout 而不是让每个
       调用方在拿到 [x,y,0] 之后自己改第三个分量，是因为 pickSquare 也要用
       同一个 z 去求交：两处各写一遍必然有一天对不上。 */
    const z = (spec && spec.z) || 0;
    const w = files * cell, h = ranks * cell;
    const x0 = -w / 2, y0 = -h / 2;

    return {
      files: files, ranks: ranks, cell: cell, z: z, w: w, h: h,
      squareCenter: function (f, r) {
        return [x0 + (f + 0.5) * cell, y0 + (r + 0.5) * cell, z];
      },
      squareCorners: function (f, r) {
        const x = x0 + f * cell, y = y0 + r * cell;
        return [[x, y, z], [x + cell, y, z], [x + cell, y + cell, z], [x, y + cell, z]];
      },
    };
  }
```

`pickSquare()` 的第一行改成：

```js
    const p = E.unproject(C, screenXY, L.z || 0);
```

- [ ] **Step 4: 运行确认通过**

Run: `node chess/core/board-render.test.js`
Expected: PASS，输出以 `0 failed` 结尾

- [ ] **Step 5: 全量门 + 提交**

```bash
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py; echo "exit=$?"
git add chess/core/board-render.js chess/core/board-render.test.js chess/tools/*.html
git commit -m "feat(chess): 棋盘 layout 支持任意 z 平面，pickSquare 跟随"
```

---

## Task 3: 内联与校验门扩容

**Files:**
- Modify: `chess/scripts/inline_core.py`
- Modify: `chess/scripts/check.py`

**Interfaces:**
- Consumes: 无
- Produces: `inline_core.py` 认识 `GENERATED:REPLAY` 与 `GENERATED:GAMES`；缺这两个标记的 html **不报 WARN**；`check.py` 会跑 `chess/games/*.test.js`

`REPLAY` 与 `GAMES` 只属于工具③（规格 §2.1），其余四个 html 没有这两个标记区。现有 `render()` 对缺失标记一律 WARN，直接加进 `SOURCES` 会让每次 `check.py` 都吐四行噪音。

- [ ] **Step 1: 改 `inline_core.py`**

`SOURCES` 改成（注意 **顺序即注入顺序**，`games.js` 依赖六个分组文件先存在）：

```python
GAMES_DIR = ROOT / 'games'
# games/ 下的分组文件先注入、汇总器最后——games.js 在浏览器里读的是
# root.ChessGamesParts，那份对象由每个分组文件自己挂上去。靠文件名排序
# 碰巧成立（'games-' < 'games.'）不算依据，这里显式写死顺序。
GAMES_PARTS = ['games-teaching.js', 'games-machine.js', 'games-romantic.js',
               'games-coldwar.js', 'games-theory.js', 'games-human.js', 'games.js']

SOURCES = {
    'VIZ-ENGINE': ROOT / 'core' / 'viz-engine.js',
    'CHESS-CORE': ROOT / 'core' / 'chess-core.js',
    'INTERACT': ROOT / 'core' / 'interact.js',
    'BOARD-RENDER': ROOT / 'core' / 'board-render.js',
    'REPLAY': ROOT / 'core' / 'replay.js',
}

# 只有工具③ 有这两个标记区；其余 html 缺它们是正常的，不该 WARN。
OPTIONAL_TAGS = {'REPLAY', 'GAMES'}
```

`render()` 里的 `missing.append(tag)` 改成 `if tag not in OPTIONAL_TAGS: missing.append(tag)`。

`GAMES` 不是单文件源，单独处理。在 `render()` 的 `for tag, src in SOURCES.items()` 循环之后加：

```python
    pat = pattern('GAMES')
    if pat.search(text):
        parts = []
        for name in GAMES_PARTS:
            p = GAMES_DIR / name
            if not p.exists():
                raise SystemExit(f'ERROR: 缺少棋谱源 {p.relative_to(ROOT.parent)}')
            parts.append(p.read_text(encoding='utf-8').rstrip())
        text = pat.sub(lambda _m: block('GAMES', '\n'.join(parts)), text, count=1)
```

`main()` 开头那段「缺少编辑源」的存在性检查里，`REPLAY` 也要能被友好报错——它已经在 `SOURCES` 里，现有循环会覆盖到，不需要额外改。

- [ ] **Step 2: 改 `check.py`**

`core_tests()` 改成也扫 `games/`：

```python
def core_tests() -> int:
    """跑 core/ 与 games/ 下的全部 *.test.js。

    棋谱校验门（games/games.test.js，规格 §7 门 2）与内核测试同等重要：
    30 局棋谱里抄错的一步，只有它能当场抓住。
    """
    rc = 0
    tests = sorted((ROOT / 'core').glob('*.test.js')) + sorted((ROOT / 'games').glob('*.test.js'))
    for test in tests:
        proc = subprocess.run(['node', str(test)])
        if proc.returncode != 0:
            print(f'ERROR: {test.name} 未通过', file=sys.stderr)
            rc = 1
    return rc
```

- [ ] **Step 3: 验证（此刻 `replay.js` 与 `games/` 还不存在，先确认「不存在时行为正确」）**

```bash
python3 chess/scripts/check.py; echo "exit=$?"
```
Expected: **exit 1**，并且 stderr 里明确写着缺少编辑源 `chess/core/replay.js`——不是静默通过、也不是 traceback。

建一个空壳先让门变绿（真正的实现在 Task 4）：

```bash
mkdir -p chess/games
printf '%s\n' '/* 占位：真正的实现见 Task 4。 */' \
  '(function (root, factory) {' \
  '  if (typeof module === "object" && module.exports) module.exports = factory();' \
  '  else root.Replay = factory();' \
  '})(typeof self !== "undefined" ? self : this, function () { "use strict"; return {}; });' \
  > chess/core/replay.js
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py; echo "exit=$?"
```
Expected: exit 0，且 WARN 里**没有**关于 `REPLAY` / `GAMES` 的行。

- [ ] **Step 4: 提交**

```bash
git add chess/scripts/inline_core.py chess/scripts/check.py chess/core/replay.js
git commit -m "build(chess): 内联认识 REPLAY/GAMES 两个可选源，校验门纳入 games/*.test.js"
```

---

## Task 4: `replay.js` — 回放状态机与关键步自动暂停

**Files:**
- Modify: `chess/core/replay.js`（Task 3 建的空壳）
- Test: `chess/core/replay.test.js`

**Interfaces:**
- Consumes: `chess-core.js` 的 `parsePGN` / `moveToSAN` / `Position`
- Produces:

```js
Replay.load({ pgn, keyMoves })   // keyMoves 可省；→ rs
// rs = { headers, moves, positions, san, maxPly, result, skipped,
//        ply, playing, speed, acc, keyMoves, fired, note, zStep }
Replay.position(rs)              // → positions[rs.ply]
Replay.goto(rs, ply)             // 夹到 [0, maxPly]；→ bool（ply 是否变了）
Replay.step(rs, delta)           // delta = ±1 …；→ bool
Replay.setPlaying(rs, on)        // → void
Replay.rewind(rs)                // ply=0、playing=false、fired 清空
Replay.tick(rs, dt)              // 自动播放；→ bool（本次是否推进过）
Replay.zStep(maxPly)             // → number，历史沿 z 的每半步间距
Replay.Z_SPAN_MAX                // 14
```

- [ ] **Step 1: 写失败的测试**

Create `chess/core/replay.test.js`：

```js
'use strict';
const T = require('./_test.js');
const C = require('./chess-core.js');
const R = require('./replay.js');

// 歌剧院局（Morphy, 1858）——33 个半步，1-0，末局面是将死。
// 这三个数已在本机用 chess-core 逐步重放核对过；改动本文件时不要重新猜。
const OPERA = '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 ' +
              '7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 ' +
              '13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0';

// ---- load ----
const rs = R.load({ pgn: OPERA });
T.eq(rs.maxPly, 33, '歌剧院局 33 个半步');
T.eq(rs.result, '1-0', '结果 1-0');
T.eq(rs.ply, 0, '载入停在第 0 步（起始局面）');
T.eq(rs.playing, false, '载入即暂停 —— 与引擎 state.running 默认 false 同一条规矩');
T.eq(rs.positions.length, 34, 'positions 比半步数多一个（起始局面）');
T.eq(rs.san.length, 33, 'SAN 表与半步一一对应');
T.eq(rs.san[0], 'e4', '第 1 个半步是 e4');
T.eq(rs.san[32], 'Rd8#', '最后一个半步是 Rd8#');
T.eq(R.position(rs).toFEN(), C.START_FEN, 'ply=0 就是初始局面');

// ---- goto / step ----
T.eq(R.goto(rs, 1), true, 'goto 到第 1 步，ply 变了');
T.eq(rs.ply, 1, 'ply 现在是 1');
T.eq(R.position(rs).board[C.fromAlg('e4')], C.P, '第 1 步之后 e4 上是白兵');
T.eq(R.goto(rs, 1), false, 'goto 到同一步返回 false');
T.eq(R.goto(rs, -5), true, '负数被夹到 0');
T.eq(rs.ply, 0, '夹到了 0');
T.eq(R.goto(rs, 999), true, '超出被夹到 maxPly');
T.eq(rs.ply, 33, '夹到了 33');
T.eq(R.step(rs, 1), false, '已在末尾，再前进无效');
T.eq(R.step(rs, -1), true, '后退一步有效');
T.eq(rs.ply, 32, '后退到 32');

// ---- 自动播放按 dt 推进，不按帧计数 ----
const auto = R.load({ pgn: OPERA });
auto.speed = 2;                      // 每秒 2 个半步
R.setPlaying(auto, true);
R.tick(auto, 0.2);
T.eq(auto.ply, 0, '0.2 秒不够走一个半步（需要 0.5 秒）');
R.tick(auto, 0.35);                  // 累计 0.55 秒
T.eq(auto.ply, 1, '累计超过 0.5 秒后推进一个半步');
// 一次大 dt 应当补上多个半步（后台标签页回来时），而不是只走一步
R.tick(auto, 1.6);                   // 余 0.05 + 1.6 = 1.65 秒 → 3 个半步
T.eq(auto.ply, 4, '大 dt 一次补齐多个半步');
R.setPlaying(auto, false);
R.tick(auto, 10);
T.eq(auto.ply, 4, '暂停后 tick 不推进');
// 走到末尾自动停
R.goto(auto, 32);
R.setPlaying(auto, true);
R.tick(auto, 10);
T.eq(auto.ply, 33, '推进到末尾就停住');
T.eq(auto.playing, false, '到末尾自动取消播放');

// ---- keyMoves：自动暂停 + 说明 ----
const KM = [
  { ply: 10, note: { en: '5…dxe5 recaptures; material is level again.', zh: '5…dxe5 吃回来，子力重新持平。' } },
  { ply: 33, note: { en: 'Mate with the last two pieces he has left.', zh: '用仅剩的两个子将死。' } },
];
const key = R.load({ pgn: OPERA, keyMoves: KM });
key.speed = 100;                     // 快到一次 tick 能跨过关键步
R.setPlaying(key, true);
R.tick(key, 1);
T.eq(key.ply, 10, '自动播放在关键步停住，不越过它');
T.eq(key.playing, false, '关键步自动暂停');
T.eq(key.note.en, KM[0].note.en, '关键步的说明被亮出来');
// 再播不该在同一步再停一次
R.setPlaying(key, true);
R.tick(key, 0.02);
T.ok(key.ply > 10, '同一个关键步不会二次拦住播放');
// 手动跳到关键步：给说明，但不需要「自动暂停」这件事发生
const key2 = R.load({ pgn: OPERA, keyMoves: KM });
R.goto(key2, 10);
T.eq(key2.note.en, KM[0].note.en, '手动跳到关键步同样显示说明');
R.goto(key2, 11);
T.eq(key2.note, null, '离开关键步说明消失');
// rewind 复位
R.rewind(key);
T.eq(key.ply, 0, 'rewind 回到第 0 步');
T.eq(key.playing, false, 'rewind 后是暂停态');
T.eq(key.note, null, 'rewind 清掉说明');
key.speed = 100;
R.setPlaying(key, true);
R.tick(key, 1);
T.eq(key.ply, 10, 'rewind 之后关键步重新生效');

// ---- zStep：任意长度的棋局都塞进同一段 z ----
T.eq(R.zStep(0), 0, '零步棋（纯 FEN）不需要 z 跨度');
T.ok(R.zStep(33) <= 0.12 + 1e-9, '短棋局用默认间距上限');
T.ok(R.zStep(272) * 272 <= R.Z_SPAN_MAX + 1e-9,
     '272 个半步（史上最长世界冠军赛对局的量级）仍然塞得进 Z_SPAN_MAX');
T.ok(R.zStep(272) < R.zStep(33), '越长的棋局间距越小');

// ---- 变着与注释：跳过并如实报数，不静默 ----
const withVar = R.load({ pgn: '1. e4 e5 (1... c5 2. Nf3) 2. Nf3 {a comment} Nc6 1/2-1/2' });
T.eq(withVar.maxPly, 4, '主线之外的变着不进走法表');
T.eq(withVar.skipped, 2, '跳过的段数如实记下（一段变着 + 一段注释）');

T.report();
```

- [ ] **Step 2: 运行确认失败**

Run: `node chess/core/replay.test.js`
Expected: FAIL —— `R.load is not a function`

- [ ] **Step 3: 写实现**

Create `chess/core/replay.js`（覆盖 Task 3 的空壳）：

```js
/* 回放内核：一局棋沿「半步」这根离散时间轴的全部可观测量。
   纯逻辑、零 DOM —— 工具负责画，本模块负责「第 k 个半步的世界长什么样」。
   零依赖；node 与浏览器双用。编辑源，运行时被内联进 tools/*.html。

   本子项目的存档格式就是 PGN（规格 §1.3）：这里不发明任何私有序列化格式，
   载入是 parsePGN、导出是 writePGN，一局棋的真身始终是那串 SAN。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./chess-core.js'));
  else root.Replay = factory(root.ChessCore);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* 历史沿 z 展开的总跨度上限（世界单位）。棋盘边长是 8，14 让最长的棋局
     也只比棋盘长出不到一倍——再长，侧视角下一头一尾就同时读不清了。
     短棋局不必摊薄到这个跨度，因此 zStep 取「默认间距」与「摊满上限」中
     较小的那个。 */
  const Z_SPAN_MAX = 14;
  const Z_STEP_DEFAULT = 0.12;

  function zStep(maxPly) {
    if (!maxPly || maxPly <= 0) return 0;
    return Math.min(Z_STEP_DEFAULT, Z_SPAN_MAX / maxPly);
  }

  function load(opts) {
    const parsed = C.parsePGN(opts.pgn);
    const san = [];
    for (let i = 0; i < parsed.moves.length; i++) {
      san.push(C.moveToSAN(parsed.positions[i], parsed.moves[i]));
    }
    const keyMoves = (opts.keyMoves || []).slice().sort(function (a, b) { return a.ply - b.ply; });
    return {
      headers: parsed.headers,
      moves: parsed.moves,
      positions: parsed.positions,
      san: san,
      maxPly: parsed.moves.length,
      result: parsed.result,
      skipped: parsed.skipped,
      startFEN: parsed.startFEN,
      ply: 0,
      /* playing 默认 false：与引擎 state.running 同一条规矩——打开 = 静止，
         播放是使用者主动要的动作。阶段 1 两个工具因为默认 true 被用户报过
         「到达页面时演示已经在切换」。 */
      playing: false,
      speed: 1.5,          // 半步 / 秒
      acc: 0,              // 自动播放的时间累加器（秒）
      keyMoves: keyMoves,
      fired: {},           // ply -> 1，本轮已经因为它自动暂停过
      note: null,          // 当前半步的关键步说明（{en,zh}）或 null
      zStep: zStep(parsed.moves.length),
      series: null,        // Task 5 惰性填充
      traces: null,        // Task 6 惰性填充
    };
  }

  function position(rs) { return rs.positions[rs.ply]; }

  function keyAt(rs, ply) {
    for (let i = 0; i < rs.keyMoves.length; i++) if (rs.keyMoves[i].ply === ply) return rs.keyMoves[i];
    return null;
  }

  function goto(rs, ply) {
    const target = Math.max(0, Math.min(rs.maxPly, ply | 0));
    if (target === rs.ply) return false;
    rs.ply = target;
    /* 说明随「当前停在哪一步」走，与「是不是自动暂停过」无关：手动拖时间轴
       到关键步同样该看到说明，只是不需要再拦一次播放。 */
    const k = keyAt(rs, target);
    rs.note = k ? k.note : null;
    return true;
  }

  function step(rs, delta) { return goto(rs, rs.ply + (delta | 0)); }

  function setPlaying(rs, on) {
    rs.playing = !!on;
    if (rs.playing) rs.acc = 0;    // 从按下播放的那一刻起算，不继承上次的零头
  }

  function rewind(rs) {
    rs.ply = 0;
    rs.playing = false;
    rs.acc = 0;
    rs.fired = {};
    rs.note = null;
  }

  /* 自动播放：按 dt 累加，绝不按帧计数（开发机是 30Hz 外接显示器，按帧
     计数会让回放速度慢一半）。一次大 dt（后台标签页回来）要补齐多个半步，
     但遇到关键步就停在那一步、把剩下的时间丢掉——「走到关键步自动暂停」
     如果被同一次 tick 里后续的推进越过去，等于没有暂停。 */
  function tick(rs, dt) {
    if (!rs.playing || rs.maxPly === 0) return false;
    const interval = 1 / Math.max(0.01, rs.speed);
    rs.acc += Math.max(0, dt);
    let moved = false;
    let guard = 0;
    while (rs.acc >= interval && guard++ < 4096) {
      rs.acc -= interval;
      if (rs.ply >= rs.maxPly) { rs.playing = false; rs.acc = 0; break; }
      goto(rs, rs.ply + 1);
      moved = true;
      if (rs.ply >= rs.maxPly) { rs.playing = false; rs.acc = 0; break; }
      const k = keyAt(rs, rs.ply);
      if (k && !rs.fired[rs.ply]) {
        rs.fired[rs.ply] = 1;
        rs.playing = false;
        rs.acc = 0;
        break;
      }
    }
    return moved;
  }

  return {
    load: load, position: position, goto: goto, step: step,
    setPlaying: setPlaying, rewind: rewind, tick: tick,
    zStep: zStep, Z_SPAN_MAX: Z_SPAN_MAX, Z_STEP_DEFAULT: Z_STEP_DEFAULT,
  };
});
```

- [ ] **Step 4: 运行确认通过**

Run: `node chess/core/replay.test.js`
Expected: PASS，`0 failed`

- [ ] **Step 5: 提交**

```bash
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py; echo "exit=$?"
git add chess/core/replay.js chess/core/replay.test.js chess/tools/*.html
git commit -m "feat(chess): 回放状态机 —— 按 dt 推进、关键步自动暂停、z 跨度自适应"
```

---

## Task 5: `replay.js` — 沿回合的三条评估曲线

**Files:**
- Modify: `chess/core/replay.js`
- Test: `chess/core/replay.test.js`

**Interfaces:**
- Consumes: Task 4 的 `rs`
- Produces: `Replay.series(rs)` → `{ material: number[], control: number[], safety: number[] }`，三个数组长度都是 `maxPly + 1`；`Replay.evalAt(pos)` → `{ material, control, safety, controlW, controlB, safetyW, safetyB }`；`Replay.PIECE_VALUE`

规格 §4③ 只给了「王的安全度」的定义，另外两条必须在这里定死，否则实现会各写各的。**三条曲线一律「白方减黑方」，正数对白方有利**——三条同尺度、同符号，才能画在一张图上互相参照。

| 曲线 | 颜色 | 定义 | 它粗糙在哪（必须写进工具的说明区） |
|---|---|---|---|
| 子力差 material | rose | `Σ 白子价值 − Σ 黑子价值`，P=1 N=3 B=3 R=5 Q=9 K=0 | 棋子价值是一套约定俗成的近似，不是定理。位置价值、兵形、王的安全全都不在里面 |
| 控制格数 control | violet | 「被白方任一子攻击到的**不同**格子数」减黑方同量。用 `attacksFrom` 的并集 | `attacksFrom` **包含被己方子占据的格**（那是「保护」）且**不含兵的前进**（兵不攻击正前方）。所以这个数量的是「火力覆盖」，不是「安全占据」 |
| 王的安全度 safety | emerald | 每方：己方王周围**在盘内的**格中被对方攻击的格数，取负（王在边角时邻格不足 8）。曲线 = 白方值 − 黑方值 | 只数邻格，不看是谁在攻击、有没有子挡着、能不能真的杀过来。开局时两边都接近 0，它对中局的攻势最灵敏 |

- [ ] **Step 1: 写失败的测试**

追加到 `chess/core/replay.test.js`（`T.report()` 之前）：

```js
// ---- 评估：三个定值局面（下列数字全部是手推的，且已在本机对着 chess-core 复算一致）----
// 初始局面：完全对称，三项都必须是 0。
const e0 = R.evalAt(C.Position.fromFEN(C.START_FEN));
T.eq(e0.material, 0, '初始局面子力差为 0');
T.eq(e0.control, 0, '初始局面控制格差为 0');
T.eq(e0.safety, 0, '初始局面王的安全度差为 0');
T.eq(e0.controlW, 22, '初始局面白方控制 22 格（16 兵斜攻 + 马 + 后翼展开的格）');
T.eq(e0.controlB, 22, '黑方同为 22 —— 对称');

// 白 Ke1 + Re7，黑 Ke8。手推：
//   子力：车 5，其余为 0 → +5
//   控制：白 = 车 e7 的 14 格 ∪ 王 e1 的 5 格，e2 重合一次 → 18；黑 = 王 e8 的 5 格 → 13
//   王安全：黑王 e8 的盘内邻格 d7 e7 f7 d8 f8 中，d7 与 f7 被 e7 的车攻击 → −2；
//           e7 是车自己站的格，车不攻击自己所在的格，白王也够不着，所以不算；
//           白王 e1 的邻格无一被黑方攻击 → 0。差 = 0 − (−2) = +2
const e1 = R.evalAt(C.Position.fromFEN('4k3/4R3/8/8/8/8/8/4K3 b - - 0 1'));
T.eq(e1.material, 5, '多一个车 = +5');
T.eq(e1.controlW, 18, '白方控制 18 格');
T.eq(e1.controlB, 5, '黑方控制 5 格');
T.eq(e1.control, 13, '控制格差 +13');
T.eq(e1.safetyW, 0, '白王邻格无一受攻');
T.eq(e1.safetyB, -2, '黑王有两个邻格受攻');
T.eq(e1.safety, 2, '王安全度差 +2');
T.ok(!Object.is(e1.safetyW, -0), '零要是正零，别让 −0 漏进读数');

// 空盘单车：控制 = 14，这是「盘上一个车能扫到多少格」的教科书数字
const bare = new C.Position();
bare.board[C.fromAlg('a1')] = C.R;
T.eq(R.evalAt(bare).controlW, 14, '空盘 a1 的车控制 14 格');

// ---- series：整局一次算完 ----
const srs = R.load({ pgn: OPERA });
const S = R.series(srs);
T.eq(S.material.length, 34, '每个半步一个点，加上起始局面');
T.eq(S.control.length, 34, '三条曲线等长');
T.eq(S.safety.length, 34, '三条曲线等长');
T.eq(S.material[0], 0, '开局子力差 0');
T.eq(S.control[0], 0, '开局控制差 0');
T.eq(S.safety[0], 0, '开局王安全差 0');
// 第 19 个半步是 10.Nxb5（白方吃掉 b5 的兵，暂时多一个兵）；
// 第 20 个半步是 10...cxb5（黑方吃回那只马）。两条一起断言，才看得见
// 「弃马」在这条曲线上是先上一格、再掉三格的一个两拍动作。
// 注意换算：白方第 N 回合的走法是第 2N−1 个半步 —— 10.Nxb5 是 ply 19，不是 ply 10。
T.eq(S.material[19], 1, '10.Nxb5 吃掉一个兵，白方暂时领先 1');
T.eq(S.material[20], -2, '10...cxb5 吃回马之后，白方净落后 2（马换兵）');
// 末局面：白方以少得多的子力将死 —— 断言符号而不是具体数字，
// 具体数字取决于双方各剩什么，改棋谱就会变，断言符号才是真意图
T.ok(S.material[33] < 0, '莫菲最后是在子力落后的情况下将死的');
T.eq(R.series(srs), S, 'series 结果被缓存，第二次调用返回同一个对象');
```

- [ ] **Step 2: 运行确认失败**

Run: `node chess/core/replay.test.js`
Expected: FAIL —— `R.evalAt is not a function`

- [ ] **Step 3: 写实现**

在 `replay.js` 的 `return` 之前插入：

```js
  /* 子力价值：一套约定俗成的近似，不是定理。工具的说明区必须写明这一点。
     王取 0 —— 王不会被吃，给它任何有限值都只会让曲线在残局里失真。 */
  const PIECE_VALUE = { 1: 1, 2: 3, 3: 3, 4: 5, 5: 9, 6: 0 };

  /* 0x88 的 128 格里只有 64 格在盘内。这张表只算一次，之后所有遍历都走它——
     每次现算 offBoard 在 series() 里会被跑上百次 × 64 格。 */
  const SQUARES = (function () {
    const a = [];
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) a.push(C.SQ(f, r));
    return a;
  })();

  const KING_STEPS = [1, -1, 16, -16, 17, -17, 15, -15];

  function materialOf(pos) {
    let s = 0;
    for (let i = 0; i < SQUARES.length; i++) {
      const v = pos.board[SQUARES[i]];
      if (v === C.EMPTY) continue;
      s += (v > 0 ? 1 : -1) * PIECE_VALUE[Math.abs(v)];
    }
    return s;
  }

  /* 「控制」= 被该方任一子攻击到的不同格子数。attacksFrom 含被己方子占据的
     格（那是保护），且不含兵的前进（兵不攻击正前方）——所以这个数量的是
     火力覆盖，不是安全占据。工具的说明区必须写明这一点。 */
  function controlOf(pos, colour) {
    const seen = {};
    let n = 0;
    for (let i = 0; i < SQUARES.length; i++) {
      const sq = SQUARES[i];
      const v = pos.board[sq];
      if (v === C.EMPTY) continue;
      if ((v > 0 ? C.WHITE : C.BLACK) !== colour) continue;
      const hits = pos.attacksFrom(sq);
      for (let j = 0; j < hits.length; j++) {
        if (!seen[hits[j]]) { seen[hits[j]] = 1; n++; }
      }
    }
    return n;
  }

  /* 王的安全度（规格 §4③ 给定）：己方王周围「在盘内的」格中被对方攻击的
     格数，取负。王在边角时邻格不足 8 —— 只数盘内的，因此范围是 [−8, 0]。
     粗糙之处：只数邻格，不看攻击者是谁、路上有没有挡子、能不能真的杀过来。 */
  function safetyOf(pos, colour) {
    const k = pos.kingSq(colour);
    if (k < 0) return 0;
    let n = 0;
    for (let i = 0; i < KING_STEPS.length; i++) {
      const t = k + KING_STEPS[i];
      if (C.offBoard(t)) continue;
      if (pos.isAttacked(t, -colour)) n++;
    }
    return n === 0 ? 0 : -n;      // 别让 −0 漏进读数
  }

  function evalAt(pos) {
    const cw = controlOf(pos, C.WHITE), cb = controlOf(pos, C.BLACK);
    const sw = safetyOf(pos, C.WHITE), sb = safetyOf(pos, C.BLACK);
    return {
      material: materialOf(pos),
      control: cw - cb, controlW: cw, controlB: cb,
      safety: sw - sb, safetyW: sw, safetyB: sb,
    };
  }

  /* 整局一次算完并缓存在 rs 上：每帧重算 34～273 个局面的攻击域会吃掉整个
     4ms 绘制预算。载入一局是一次性成本（最长的棋局约 273 个局面 × 32 子）。 */
  function series(rs) {
    if (rs.series) return rs.series;
    const material = [], control = [], safety = [];
    for (let i = 0; i < rs.positions.length; i++) {
      const e = evalAt(rs.positions[i]);
      material.push(e.material); control.push(e.control); safety.push(e.safety);
    }
    rs.series = { material: material, control: control, safety: safety };
    return rs.series;
  }
```

在 `return` 的对象里加上 `evalAt`、`series`、`PIECE_VALUE`。

- [ ] **Step 4: 运行确认通过**

Run: `node chess/core/replay.test.js`
Expected: PASS

> 若 `S.material[19]`/`S.material[20]` 不是 `1`/`-2`，**先手工核对第 19 个半步是不是 `Nxb5`**（`console.log(srs.san[18])`）——是的话就是实现错了，不是测试错了。
>
> **勘误**：本文档曾在此处断言 `S.material[10] === -2` 并称「第 10 个半步是 10.Nxb5」——这把 PGN 记号里的「白方第 10 回合」与「第 10 个半步」搞混了：白方第 N 回合的走法是第 `2N−1` 个半步，`10.Nxb5` 实际是第 19 个半步。`S.material[10]`（第 10 个半步，即 `5...dxe5`）应为 `0`。已改为断言 `S.material[19]` 与 `S.material[20]`，见上。

- [ ] **Step 5: 提交**

```bash
git add chess/core/replay.js chess/core/replay.test.js
git commit -m "feat(chess): 三条评估曲线 —— 子力差 / 控制格数 / 王的安全度"
```

---

## Task 6: `replay.js` — 子力轨迹与累计热力

**Files:**
- Modify: `chess/core/replay.js`
- Test: `chess/core/replay.test.js`

**Interfaces:**
- Consumes: Task 4 的 `rs`
- Produces:
  - `Replay.traces(rs)` → `Trace[]`（缓存在 `rs.traces`），`Trace = { id, code, from, points: [{ ply, sq }], capturedAt: number|null, promotedAt: number|null }`
  - `Replay.heat(rs, uptoPly)` → `{ counts: { [sq]: number }, max: number, landings: number }`

`trace` 页要「一眼看出这只马走了 9 步，那只象一步没动」——需要**追踪每一颗子的身份**，而不是每一步的起讫。这是本任务全部难度所在：易位一步动两颗子、吃过路兵被吃的兵不在落点格、升变是同一颗子换了个身份。三者都会被下面的测试打到。

- [ ] **Step 1: 写失败的测试**

追加到 `chess/core/replay.test.js`（`T.report()` 之前）：

```js
// ---- 子力轨迹 ----
function tracesOf(pgn) { return R.traces(R.load({ pgn: pgn })); }
function findFrom(list, alg) { return list.filter(function (t) { return t.from === C.fromAlg(alg); })[0]; }

const t0 = tracesOf('1. e4 e5 1/2-1/2');
T.eq(t0.length, 32, '开局 32 颗子各一条轨迹');
const eP = findFrom(t0, 'e2');
T.eq(eP.points.map(function (p) { return [p.ply, C.toAlg(p.sq)]; }),
     [[0, 'e2'], [1, 'e4']], 'e2 的兵走了一步：起点在第 0 步，落点在第 1 步');
T.eq(eP.capturedAt, null, '它没被吃');
T.eq(findFrom(t0, 'b1').points.length, 1, 'b1 的马一步没动 —— 只有起点一个点');

// 易位：一步动两颗子
const cas = tracesOf('[FEN "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"]\n1. O-O Rd8 2. Kh1 O-O-O 1/2-1/2');
T.eq(findFrom(cas, 'e1').points.map(function (p) { return C.toAlg(p.sq); }), ['e1', 'g1', 'h1'],
     '白王短易位到 g1，再走 h1');
T.eq(findFrom(cas, 'h1').points.map(function (p) { return [p.ply, C.toAlg(p.sq)]; }),
     [[0, 'h1'], [1, 'f1']], '短易位同一步里 h1 的车到了 f1');
T.eq(findFrom(cas, 'e8').points.map(function (p) { return C.toAlg(p.sq); }), ['e8', 'c8'],
     '黑王长易位到 c8');
T.eq(findFrom(cas, 'a8').points.map(function (p) { return [p.ply, C.toAlg(p.sq)]; }),
     [[0, 'a8'], [4, 'd8']], '长易位同一步里 a8 的车到了 d8');

// 吃过路兵：被吃的兵不在落点格上
const ep = tracesOf('[FEN "rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3"]\n1. exf6 1-0');
const victim = findFrom(ep, 'f5');
T.eq(victim.capturedAt, 1, 'f5 的黑兵在第 1 个半步被吃');
T.eq(C.toAlg(victim.points[victim.points.length - 1].sq), 'f5',
     '它最后停在 f5 —— 吃它的兵落在 f6，别把尸体挪到落点格去');
T.eq(C.toAlg(findFrom(ep, 'e5').points[1].sq), 'f6', '吃过路兵的白兵落在 f6');

// 升变：同一颗子换了身份，不是新长出一颗
const pr = tracesOf('[FEN "8/4P3/8/8/8/8/8/4K2k w - - 0 1"]\n1. e8=N 1-0');
const promoted = findFrom(pr, 'e7');
T.eq(promoted.code, C.N, '升变后这条轨迹的身份变成马');
T.eq(promoted.promotedAt, 1, '记下在第几步升的变');
T.eq(promoted.points.length, 2, '还是同一条轨迹，不是新建一条');
T.eq(pr.length, 3, '盘上原本 3 颗子，升变没有让轨迹数变多');

// 守恒：活着的 + 被吃的 = 开局子数
const opera = tracesOf(OPERA);
const dead = opera.filter(function (t) { return t.capturedAt != null; }).length;
T.eq(opera.length, 32, '歌剧院局从满盘开始');
T.eq(opera.filter(function (t) { return t.capturedAt == null; }).length + dead, 32, '不多不少');

// ---- 累计热力 ----
const h2 = R.heat(R.load({ pgn: '1. e4 e5 1/2-1/2' }), 2);
T.eq(h2.counts[C.fromAlg('e4')], 1, 'e4 被落子一次');
T.eq(h2.counts[C.fromAlg('e5')], 1, 'e5 被落子一次');
T.eq(Object.keys(h2.counts).length, 2, '其余 62 格从头到尾没人碰');
T.eq(h2.max, 1, '最热的格是 1');
T.eq(h2.landings, 2, '两个半步 = 两次落子');

const hcas = R.heat(R.load({ pgn: '[FEN "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"]\n1. O-O 1-0' }), 1);
T.eq(hcas.counts[C.fromAlg('g1')], 1, '易位：王的落点算一次');
T.eq(hcas.counts[C.fromAlg('f1')], 1, '易位：车的落点也算一次');
T.eq(hcas.landings, 2, '一步易位是两次落子 —— 落子数不等于半步数');

const hpartial = R.load({ pgn: OPERA });
T.eq(R.heat(hpartial, 0).landings, 0, '第 0 步时热力全空');
T.ok(R.heat(hpartial, 33).landings >= 33, '整局的落子数至少等于半步数');
T.ok(R.heat(hpartial, 10).landings < R.heat(hpartial, 33).landings, '热力随时间轴增长');
```

- [ ] **Step 2: 运行确认失败**

Run: `node chess/core/replay.test.js`
Expected: FAIL —— `R.traces is not a function`

- [ ] **Step 3: 写实现**

在 `replay.js` 的 `return` 之前插入：

```js
  /* 子力轨迹：追踪的是「同一颗子」，不是「每一步的起讫」。三处特殊规则
     全部在这里收口，各配一条测试：
       易位   —— 一个半步里王和车各走一段；
       吃过路兵 —— 被吃的兵不在落点格上，它在落点格的正后方一格；
       升变   —— 同一条轨迹换身份（code 变），不是新长出一条。
     用 FLAG 判定而不是靠「起讫格相隔两列就是易位」这类几何猜测：Move 上
     本来就带着生成器给的权威标记，猜是没有理由的。 */
  function traces(rs) {
    if (rs.traces) return rs.traces;
    const start = rs.positions[0];
    const list = [];
    const at = {};                 // square -> list 下标

    for (let i = 0; i < SQUARES.length; i++) {
      const sq = SQUARES[i];
      const v = start.board[sq];
      if (v === C.EMPTY) continue;
      at[sq] = list.length;
      list.push({ id: list.length, code: v, from: sq,
                  points: [{ ply: 0, sq: sq }], capturedAt: null, promotedAt: null });
    }

    function walk(from, to, ply) {
      const k = at[from];
      if (k == null) return;       // 不该发生；发生了也不要静默造一条假轨迹
      delete at[from];
      at[to] = k;
      list[k].points.push({ ply: ply, sq: to });
    }
    function kill(sq, ply) {
      const k = at[sq];
      if (k == null) return;
      list[k].capturedAt = ply;
      delete at[sq];
    }

    for (let i = 0; i < rs.moves.length; i++) {
      const m = rs.moves[i], ply = i + 1;
      if (m.flags & C.FLAG.EP) {
        // 被吃的兵在落点格的「后方」一格：白方吃则在下一横行，黑方吃则在上一横行
        kill(m.to + (m.piece > 0 ? -16 : 16), ply);
      } else if (at[m.to] != null) {
        kill(m.to, ply);
      }
      walk(m.from, m.to, ply);
      // 易位的车：短易位 h 线车 → 王落点的左邻；长易位 a 线车 → 王落点的右邻
      if (m.flags & C.FLAG.CASTLE_K) walk(m.to + 1, m.to - 1, ply);
      if (m.flags & C.FLAG.CASTLE_Q) walk(m.to - 2, m.to + 1, ply);
      if (m.promo) {
        const tr = list[at[m.to]];
        tr.code = m.piece > 0 ? m.promo : -m.promo;
        tr.promotedAt = ply;
      }
    }
    rs.traces = list;
    return list;
  }

  /* 累计热力：数的是「有子落在这一格」的次数，不是控制、也不是经过。
     一步易位算两次落子（王一次、车一次），所以 landings 与半步数不相等——
     工具的读数区把两个数都列出来，别让人以为它们该相等。
     不缓存：整局最多 273 个半步，按当前 ply 现算一次是微秒级，而缓存
     「截至第 k 步」需要 273 份快照，得不偿失。 */
  function heat(rs, uptoPly) {
    const n = Math.max(0, Math.min(rs.maxPly, uptoPly == null ? rs.maxPly : uptoPly | 0));
    const counts = {};
    let max = 0, landings = 0;
    function land(sq) {
      counts[sq] = (counts[sq] || 0) + 1;
      if (counts[sq] > max) max = counts[sq];
      landings++;
    }
    for (let i = 0; i < n; i++) {
      const m = rs.moves[i];
      land(m.to);
      if (m.flags & C.FLAG.CASTLE_K) land(m.to - 1);
      if (m.flags & C.FLAG.CASTLE_Q) land(m.to + 1);
    }
    return { counts: counts, max: max, landings: landings };
  }
```

在 `return` 的对象里加上 `traces`、`heat`。

- [ ] **Step 4: 运行确认通过**

Run: `node chess/core/replay.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py; echo "exit=$?"
git add chess/core/replay.js chess/core/replay.test.js chess/tools/*.html
git commit -m "feat(chess): 子力轨迹（易位/吃过路兵/升变三处特殊规则）与累计热力"
```

---

## Task 7: 棋谱数据骨架、汇总器与校验门

**Files:**
- Create: `chess/games/games-teaching.js`（含两局教学构造局，完整可用）
- Create: `chess/games/games-machine.js` `games-romantic.js` `games-coldwar.js` `games-theory.js` `games-human.js`（**各建成空数组的骨架**，由 Task 8–12 填）
- Create: `chess/games/games.js`（汇总器 + 学习路线）
- Create: `chess/games/games.test.js`（规格 §7 门 2）

**Interfaces:**
- Consumes: `chess-core.js` 的 `parsePGN`
- Produces:

```js
ChessGames = {
  GAMES,              // Game[]，按 GROUP_ORDER 展开
  byId,               // { [id]: Game }
  GROUPS,             // { teaching: Game[], machine: Game[], … }
  GROUP_ORDER,        // ['teaching','machine','romantic','coldwar','theory','human']
  GROUP_LABEL,        // { teaching: {en,zh}, … }
  LEARNING_ROUTE,     // string[]（11 个 id，规格 §6.3）
  TAGS,               // 允许出现在 game.tags 里的全部值
  headersOf(game),    // → { Event, Site, Date, White, Black, Result, … }
                      //   只正则扫标签对、不重放走法（列表页要给 30 局各画一张卡，
                      //   为了显示两个名字去把三十局棋全走一遍是没必要的）
}
// Game = { id, group, tags: string[], difficulty: 1|2|3,
//          story: {en,zh}, why: {en,zh},
//          keyMoves: [{ ply, san, note: {en,zh} }],
//          source: url,
//          pgn: '[Event "…"]\n…\n\n1. e4 …' }   ← 整份 PGN 原文，含标签对
//
// 棋手 / 赛事 / 日期 / 结果 / 半步数都不是字段：它们在 PGN 里，用
// headersOf(game) 取标签对、用 Replay.load(game.pgn) 取走法与半步数。
```

### 数据契约（Task 8–12 逐字遵守）

| 字段 | 规则 |
|---|---|
| `id` | 小写连字符，`/^[a-z0-9-]+$/`；本计划已给出全部 30 个，**不得改名** |
| `pgn` | **整份 PGN 原文，含标签对**——就是你取到的那个 `.pgn` 文件的内容，原样放进来。棋手、赛事、日期、结果、半步数全部从这里读，**不另抄成字段**。至少要有 `White` / `Black` / `Result` 三个标签对（多数来源给的 PGN 都是七标签齐全的） |
| `source` | 一个 URL，写明这份记谱从哪儿来。**只为标注出处，不用来做版本核对** |
| `tags` | 取自 `TAGS`；至少一个 |
| `difficulty` | 1（零基础第一天能看懂）/ 2 / 3（需要一点棋感） |
| `story` | 双语各 2–3 段（每段 2–4 句）。写**为什么这局重要、当时发生了什么**，不逐步讲解棋 |
| `why` | 双语各**一句话**。它是列表页上唯一显示的那行字 |
| `keyMoves` | 3–6 条，`ply` 严格递增且在这份 PGN 的半步数以内。`note` 双语各 1–3 句，说明**这一步为什么是转折**。回放到这里会自动暂停 |
| `keyMoves[].san` | 该 ply 那一步的 SAN，**由 `moveToSAN` 生成后抄进来**，不是手写的。这是全套里唯一保留的一致性检查，理由见下一节末尾 |

### 棋谱数据存在哪里，以后怎么导入新的

**存在哪里**：`chess/games/games-<group>.js` 里那条记录的 `pgn` 字段，内容就是一份 PGN 原文。运行时 `inline_core.py` 把七个 `games/*.js` 拼进 `chess/tools/chess-game-replay.html` 的 `/* >>> GENERATED:GAMES */` 区间——那是**副本，不是编辑源**，改它会被下一次内联覆盖，`check.py --check` 会当场报出不一致。

**三种「导入」是三件不同的事**：

| 我想…… | 怎么做 |
|---|---|
| 现在就看一眼手上这份 PGN | 把 `.pgn` 拖进画布（Task 17）。四个页签全部照常工作，但**不留存**——没有故事、没有 keyMoves，刷新即失 |
| 把一局**新棋**加进内置清单 | 挑一个分组文件，加一条记录（PGN 原文 + 来源 URL + 故事 + keyMoves），跑 `inline_core.py` + `check.py`。不用改 `games.js`、工具或注册表；顺手把 `games.test.js` 里 `EXPECTED_GAME_COUNT` 加一 |
| 把某局**换成另一份记谱** | 替换 `pgn`，然后**重算 `keyMoves` 的 ply**，跑 `check.py` |

第三种是唯一需要多想一步的：换一份补了开头几步、或多录了几步的记谱，会让后面每一条 keyMove 整体平移。`plies` 之类的字段已经不存在了（都从 PGN 现读），所以不会有元数据对不上的问题；**唯一会静默出错的是 keyMove 的说明指向了另一步棋**——ply 平移之后多半仍在合法区间内。

这就是 `keyMoves[].san` 保留下来的唯一理由：它让换谱当场报出「第 3 条 keyMove 期望 `Qg3+`、实际 `Rxd4`」，你照着报错逐条修完就对了。它锚的是**内部一致性**（我写的这段话还指着我写它时那一步棋吗），不是史实——一个字段、一行断言，而且那个字段是脚本打印出来抄的，不用动脑子。**觉得这一条也多余就砍掉它，代价是换谱时说明会悄悄错位。**

### 全部 30 个 id（分组即文件归属）

| 文件 | id |
|---|---|
| `games-teaching.js` | `fools-mate` `scholars-mate` |
| `games-machine.js` | `deep-blue-kasparov-1996-g1` `deep-blue-kasparov-1997-g2` `deep-blue-kasparov-1997-g6` `alphazero-stockfish-2017-g10` `hydra-adams-2005` |
| `games-romantic.js` | `anderssen-kieseritzky-1851` `anderssen-dufresne-1852` `morphy-opera-1858` `rotlewi-rubinstein-1907` `legal-saint-brie-1750` `levitsky-marshall-1912` |
| `games-coldwar.js` | `byrne-fischer-1956` `spassky-fischer-1972-g1` `fischer-spassky-1972-g6` `tal-botvinnik-1960-g6` `karpov-kasparov-1985-g16` `karpov-kasparov-1985-g48` `carlsen-nepomniachtchi-2021-g6` |
| `games-theory.js` | `reti-capablanca-1924` `botvinnik-capablanca-1938` `steinitz-bardeleben-1895` `kasparov-topalov-1999` `capablanca-marshall-1918` |
| `games-human.js` | `kasparov-polgar-2002` `deep-fritz-kramnik-2006-g2` `carlsen-niemann-2022` `kasparov-world-1999` `menchik-euwe-1930` |

- [ ] **Step 1: 写失败的测试**

Create `chess/games/games.test.js`：

```js
'use strict';
const T = require('../core/_test.js');
const C = require('../core/chess-core.js');
const G = require('./games.js');

const RESULTS = ['1-0', '0-1', '1/2-1/2'];

/* 这个数字是一道刻意的绊索：以后加一局棋会让它失败，逼你回来把它改成 31。
   加棋谱是要过脑子的事（新的一局要有故事、要有来源、要进不进学习路线），
   不该悄悄溜进清单。 */
const EXPECTED_GAME_COUNT = 30;
T.eq(G.GAMES.length, EXPECTED_GAME_COUNT, '一共 30 局（规格 §6.2）');
T.eq(G.LEARNING_ROUTE.length, 11, '学习路线 11 站（规格 §6.3）');

const seen = {};
for (const g of G.GAMES) {
  const at = g.id + ': ';

  // ---- 标识与分类 ----
  T.ok(/^[a-z0-9-]+$/.test(g.id), at + 'id 是小写连字符');
  T.ok(!seen[g.id], at + 'id 不重复');
  seen[g.id] = 1;
  T.ok(G.GROUP_ORDER.indexOf(g.group) >= 0, at + 'group 是已知分组');
  T.ok(Array.isArray(g.tags) && g.tags.length > 0, at + '至少一个 tag');
  T.ok(g.tags.every(x => G.TAGS.indexOf(x) >= 0), at + 'tag 都在词表里：' + g.tags.join(','));
  T.ok([1, 2, 3].indexOf(g.difficulty) >= 0, at + 'difficulty ∈ {1,2,3}');

  // ---- 来源：只标注出处，不做版本核对（本工具不做记谱考古）----
  T.ok(/^https?:\/\//.test(g.source), at + 'source 是一个 URL');

  // ---- 双语完整 ----
  for (const k of ['story', 'why']) {
    T.ok(g[k] && g[k].en && g[k].en.trim().length > 0, at + k + ' 有英文');
    T.ok(g[k] && g[k].zh && g[k].zh.trim().length > 0, at + k + ' 有中文');
  }
  /* why 是列表卡片上唯一显示的那行字，长度是它唯一能机器化的约束。
     不要改成「数句号」——'St. Louis'、'G. Kasparov' 这类写法会让它误判。 */
  T.ok(g.why.en.length <= 160, at + 'why 的英文不超过 160 字符（卡片放得下一行）');
  T.ok(g.why.zh.length <= 70, at + 'why 的中文不超过 70 字');

  /* ---- 唯一真正的门：这份 PGN 能不能逐步重放 ----
     抄错的一步会当场走不通。这不是「核实史实」，是「这份数据能不能渲染」——
     走不通的棋谱在工具里就是一块白屏。 */
  let parsed = null;
  try { parsed = C.parsePGN(g.pgn); }
  catch (e) { T.ok(false, at + 'PGN 逐步重放失败 —— ' + e.message); continue; }
  T.ok(parsed.moves.length > 0, at + 'PGN 里有走法');
  T.ok(RESULTS.indexOf(parsed.result) >= 0, at + '结果是三种之一（从 PGN 读，不另抄字段）');

  // 标签对：列表卡片要靠它显示，缺了就是一张空卡
  const H = G.headersOf(g);
  for (const tag of ['White', 'Black', 'Result']) {
    T.ok(H[tag] && H[tag].trim() && H[tag] !== '?', at + 'PGN 有 ' + tag + ' 标签对');
  }
  T.eq(H.Result, parsed.result, at + 'Result 标签对与走法末尾的结果一致');

  // ---- keyMoves ----
  T.ok(g.keyMoves.length >= 3 && g.keyMoves.length <= 6, at + 'keyMoves 有 3–6 条');
  let last = 0;
  for (const k of g.keyMoves) {
    T.ok(Number.isInteger(k.ply) && k.ply >= 1 && k.ply <= parsed.moves.length,
         at + 'keyMove 的 ply ' + k.ply + ' 落在 [1, ' + parsed.moves.length + ']');
    T.ok(k.ply > last, at + 'keyMove 的 ply 严格递增');
    last = k.ply;
    T.ok(k.note && k.note.en && k.note.en.trim(), at + 'keyMove@' + k.ply + ' 有英文说明');
    T.ok(k.note && k.note.zh && k.note.zh.trim(), at + 'keyMove@' + k.ply + ' 有中文说明');
    /* 锚在走法上，不只锚在序号上。换一份记谱时 ply 会整体平移，而平移后的
       ply 多半仍在合法区间里 —— 只查范围的话，说明会悄悄指向另一步棋而
       校验门全绿。这是全套里唯一保留的一致性检查。 */
    T.eq(C.moveToSAN(parsed.positions[k.ply - 1], parsed.moves[k.ply - 1]), k.san,
         at + 'keyMove@' + k.ply + ' 指向的仍然是它当初标注的那一步');
  }
}

// ---- 学习路线 ----
for (const id of G.LEARNING_ROUTE) T.ok(!!G.byId[id], '学习路线里的 ' + id + ' 是存在的棋局');
T.eq(G.LEARNING_ROUTE[0], 'fools-mate', '路线从最短的将死开始');
T.eq(G.byId[G.LEARNING_ROUTE[0]].difficulty, 1, '第一站必须是 difficulty 1');

// ---- 分组与总表一致 ----
let sum = 0;
for (const k of G.GROUP_ORDER) {
  T.ok(Array.isArray(G.GROUPS[k]), k + ' 是一个数组');
  T.ok(G.GROUP_LABEL[k] && G.GROUP_LABEL[k].en && G.GROUP_LABEL[k].zh, k + ' 有双语标签');
  T.ok(G.GROUPS[k].every(g => g.group === k), k + ' 里每一局的 group 字段都对得上');
  sum += G.GROUPS[k].length;
}
T.eq(sum, G.GAMES.length, '分组之和等于总表');

T.report();
```

- [ ] **Step 2: 运行确认失败**

Run: `node chess/games/games.test.js`
Expected: FAIL —— `Cannot find module './games.js'`

- [ ] **Step 3: 写五个空分组骨架**

`chess/games/games-machine.js`（另外四个同形，只改文件名里的分组名与注释）：

```js
/* 棋谱分组：人机对抗。★ 编辑源之一。
   一组一个文件，因为 30 局的双语文案要在并行的 worktree 上写——写进同一个
   文件必然在合并时冲突，而冲突的是大段散文，最难 review。每一局仍然只有
   一处编辑源。数据契约见 docs/superpowers/plans/2026-08-02-chess-phase2-game-replay.md。
   零依赖；node 与浏览器双用。运行时被内联进 tools/chess-game-replay.html。 */
(function (root, factory) {
  const list = factory();
  if (typeof module === 'object' && module.exports) module.exports = list;
  else {
    root.ChessGamesParts = root.ChessGamesParts || {};
    root.ChessGamesParts.machine = list;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return [
    // Task 8 在此填 5 局：deep-blue-kasparov-1996-g1 / deep-blue-kasparov-1997-g2 /
    // deep-blue-kasparov-1997-g6 / alphazero-stockfish-2017-g10 / hydra-adams-2005
  ];
});
```

- [ ] **Step 4: 写 `games-teaching.js`（两局完整数据，同时是后续五组的样板）**

```js
/* 棋谱分组：教学构造局。★ 编辑源之一。
   这两局明确标注为构造局面而非史料（规格 §6.2 末节）：它们没有对局者、
   没有赛事，是为了说明「将死」这个定义本身而摆出来的最短序列。
   零依赖；node 与浏览器双用。 */
(function (root, factory) {
  const list = factory();
  if (typeof module === 'object' && module.exports) module.exports = list;
  else {
    root.ChessGamesParts = root.ChessGamesParts || {};
    root.ChessGamesParts.teaching = list;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return [
    {
      id: 'fools-mate',
      group: 'teaching',
      tags: ['teaching', 'constructed'],
      difficulty: 1,
      source: 'https://en.wikipedia.org/wiki/Fool%27s_mate',
      story: {
        en: 'This is not a game anyone played. It is the shortest possible checkmate, four half-moves long, and it exists in this collection for one reason: it is the smallest object that shows what checkmate actually is.\n\nWhite opens two pawns in front of the king — f3 and g4 — and by the second of them the diagonal h4–e1 is a clear road. The black queen walks down it and the game is over. Nothing was captured. No piece was even threatened until the last move.\n\nThat is the point. Checkmate is not a special kind of capture, and the king is never taken off the board. It is a purely logical condition: the king is attacked, and every legal move still leaves it attacked. Here White has one attacked king and zero legal moves, and the game ends mid-development with almost every piece still at home.',
        zh: '这不是任何人下过的一局棋。它是可能存在的最短将死，只有四个半步，收进这套工具里只为一个理由：它是能说明「将死到底是什么」的最小对象。\n\n白方在自己王的门前推开两个兵——f3 与 g4——第二个兵一动，h4–e1 这条斜线就成了一条通途。黑后沿着它走下来，棋局就结束了。全程没有任何子被吃，直到最后一步之前也没有任何子被威胁。\n\n这正是重点。将死不是某种特殊的吃子，王自始至终没有被拿下棋盘。它是一个纯逻辑的条件：王正被攻击，而所有合法走法都无法让它脱离攻击。这里白方有一个被攻击的王和零个合法走法，棋局在几乎全部棋子还没出动的时候就结束了。',
      },
      why: {
        en: 'The shortest checkmate there is, which makes it the cleanest definition of checkmate you will ever see.',
        zh: '现存最短的将死，因此也是你能见到的对「将死」最干净的定义。',
      },
      keyMoves: [
        { ply: 1, san: 'f3', note: {
          en: '1.f3 opens the h4–e1 diagonal towards White\'s own king. On its own it is merely careless.',
          zh: '1.f3 打开了通向白方自家王的 h4–e1 斜线。单看这一步只是随手。' } },
        { ply: 3, san: 'g4', note: {
          en: '2.g4 is the fatal one: it blocks the only square (g4) from which a piece could later interpose on that diagonal, and it does so voluntarily.',
          zh: '2.g4 才是致命的一步：它自己堵死了 g4——那是日后唯一还能垫在这条斜线上的格子——而且是主动堵死的。' } },
        { ply: 4, san: 'Qh4#', note: {
          en: 'Qh4#. Count White\'s legal moves: zero. Count the attackers on the king: one, and nothing can capture it, block it, or run. That triple is the whole definition.',
          zh: 'Qh4#。数一数白方的合法走法：零。数一数攻击王的子：一个，而白方吃不掉它、挡不住它、也躲不开。这三件事同时成立，就是将死的全部定义。' } },
      ],
      /* 构造局面同样走 PGN 原文这条路 —— 让「一局棋 = 一份 PGN」在数据里
         没有例外，工具就不必为教学局另开一条分支。 */
      pgn: [
        '[Event "Constructed position"]',
        '[Site "—"]',
        '[Date "????.??.??"]',
        '[Round "-"]',
        '[White "White"]',
        '[Black "Black"]',
        '[Result "0-1"]',
        '',
        '1. f3 e5 2. g4 Qh4# 0-1',
      ].join('\n'),
    },
    {
      id: 'scholars-mate',
      group: 'teaching',
      tags: ['teaching', 'constructed', 'trap'],
      difficulty: 1,
      source: 'https://en.wikipedia.org/wiki/Scholar%27s_mate',
      story: {
        en: 'The four-move mate is the first complete game most beginners see, and the first trap most beginners lose to. White aims two pieces — the bishop on c4 and the queen on h5 — at a single square, f7, and Black does not notice that the square is defended only by the king.\n\nf7 (and f2 for White) is the weakest square in the starting position, and the reason is structural rather than tactical: it is the only square in each camp that no piece defends. Every other pawn has a knight, a rook or a queen behind it. That one hole is enough for two attackers to be one more than the defence.\n\nIt is worth learning from both sides. As the attacker it works exactly once against any given opponent. As the defender the answer is unglamorous and permanent: develop a piece that covers f7, and the whole idea evaporates.',
        zh: '四步杀是多数初学者看到的第一局完整的棋，也是多数初学者第一次栽的跟头。白方把两个子——c4 的象与 h5 的后——同时对准一个格子 f7，而黑方没有注意到那一格只有王在守。\n\nf7（对白方来说是 f2）是初始局面里最弱的一格，原因是结构性的而非战术性的：它是各自阵营里唯一没有任何棋子保护的格。其余每个兵背后都站着马、车或后。就这一个洞，足以让两个攻击者比防守方多出一个。\n\n这局棋值得从两边各学一遍。当攻方，它对同一个对手只灵一次；当守方，答案朴素但一劳永逸：出一个能罩住 f7 的子，整个构想立刻蒸发。',
      },
      why: {
        en: 'Two attackers against one defender on f7 — the structural weak point every starting position has.',
        zh: '两个攻击者对一个防守者，落在 f7——每个初始局面都自带的那处结构弱点。',
      },
      keyMoves: [
        { ply: 3, san: 'Bc4', note: {
          en: '2.Bc4 puts the first attacker on f7. Nothing is threatened yet: f7 is defended once, by the king.',
          zh: '2.Bc4 把第一个攻击者对准 f7。此刻还没有威胁：f7 有一个防守者，就是黑王。' } },
        { ply: 5, san: 'Qh5', note: {
          en: '3.Qh5 makes it two attackers against one defender. Black must add a defender or remove an attacker — …g6 does both jobs at once.',
          zh: '3.Qh5 让攻击者变成两个、防守者仍是一个。黑方必须加一个防守者或赶走一个攻击者——…g6 一步同时做到两件事。' } },
        { ply: 6, san: 'Nf6', note: {
          en: '3…Nf6?? develops a piece and ignores the count. It is the most natural-looking losing move in chess.',
          zh: '3…Nf6?? 出了一个子，却没去数攻防的人数。这是国际象棋里看上去最自然的一步败着。' } },
        { ply: 7, san: 'Qxf7#', note: {
          en: 'Qxf7#. The queen is protected by the bishop on c4, so the king cannot take it — and no other piece can reach f7.',
          zh: 'Qxf7#。这个后有 c4 的象保护，所以黑王吃不掉它——而黑方再没有别的子够得到 f7。' } },
      ],
      pgn: [
        '[Event "Constructed position"]',
        '[Site "—"]',
        '[Date "????.??.??"]',
        '[Round "-"]',
        '[White "White"]',
        '[Black "Black"]',
        '[Result "1-0"]',
        '',
        '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0',
      ].join('\n'),
    },
  ];
});
```

> 这两局的走法已在本机用 `parsePGN` 逐步重放过：4 / 7 个半步，末局面 `status()` 都是 `checkmate`，`keyMoves[].san` 是 `moveToSAN` 打印出来抄的。

- [ ] **Step 5: 写汇总器 `games.js`**

```js
/* 棋谱汇总器：把六个分组文件合成一份总表，并声明学习路线与词表。
   ★ 编辑源。分组数据本身在 games-*.js 里，本文件只做汇总，加新局不必改它。
   零依赖；node 与浏览器双用。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory({
      teaching: require('./games-teaching.js'),
      machine: require('./games-machine.js'),
      romantic: require('./games-romantic.js'),
      coldwar: require('./games-coldwar.js'),
      theory: require('./games-theory.js'),
      human: require('./games-human.js'),
    });
  } else {
    /* 浏览器里六个分组文件已经在本文件之前被内联执行过，各自往
       root.ChessGamesParts 上挂了自己那份数组（内联顺序由 inline_core.py
       的 GAMES_PARTS 显式写死，不靠文件名排序碰巧成立）。 */
    root.ChessGames = factory(root.ChessGamesParts || {});
  }
})(typeof self !== 'undefined' ? self : this, function (parts) {
  'use strict';

  const GROUP_ORDER = ['teaching', 'machine', 'romantic', 'coldwar', 'theory', 'human'];

  const GROUP_LABEL = {
    teaching: { en: 'Constructed for teaching', zh: '教学构造局' },
    machine:  { en: 'Human versus machine', zh: '人机对抗' },
    romantic: { en: 'The Romantic era', zh: '浪漫时代' },
    coldwar:  { en: 'Cold War and world championships', zh: '冷战与世界冠军战' },
    theory:   { en: 'Turning points in theory', zh: '理论转折' },
    human:    { en: 'Controversy and human nature', zh: '争议与人性' },
  };

  /* tags 的封闭词表。开放式自由标签会在 30 局 × 两位作者之间长出
     'human-vs-machine' 与 'human-machine' 两个同义词，筛选就此失效。 */
  const TAGS = [
    'human-vs-machine', 'controversy', 'romantic', 'teaching', 'constructed',
    'sacrifice', 'attack', 'endgame', 'opening-theory', 'blunder', 'trap',
    'world-championship', 'prodigy', 'defence', 'positional', 'longest',
  ];

  /* 给零基础的顺序（规格 §6.3）。UI 默认按它排列，而不是平铺 30 局。 */
  const LEARNING_ROUTE = [
    'fools-mate',
    'scholars-mate',
    'legal-saint-brie-1750',
    'morphy-opera-1858',
    'anderssen-kieseritzky-1851',
    'byrne-fischer-1956',
    'reti-capablanca-1924',
    'fischer-spassky-1972-g6',
    'kasparov-topalov-1999',
    'deep-blue-kasparov-1997-g2',
    'alphazero-stockfish-2017-g10',
  ];

  const GROUPS = {};
  const GAMES = [];
  for (let i = 0; i < GROUP_ORDER.length; i++) {
    const k = GROUP_ORDER[i];
    GROUPS[k] = (parts[k] || []).slice();
    for (let j = 0; j < GROUPS[k].length; j++) GAMES.push(GROUPS[k][j]);
  }

  const byId = {};
  for (let i = 0; i < GAMES.length; i++) byId[GAMES[i].id] = GAMES[i];

  /* 标签对：只正则扫，不重放走法。列表页要给 30 局各画一张卡，为了显示
     两个名字去把三十局棋全走一遍是没必要的（真要走法时用 Replay.load）。
     结果缓存在记录上——同一局的卡片会被重绘很多次。 */
  const TAG_RE = /\[\s*(\w+)\s*"((?:[^"\\]|\\.)*)"\s*\]/g;
  function headersOf(game) {
    if (game.__headers) return game.__headers;
    const h = {};
    let m;
    TAG_RE.lastIndex = 0;
    while ((m = TAG_RE.exec(game.pgn))) h[m[1]] = m[2].replace(/\\(.)/g, '$1');
    game.__headers = h;
    return h;
  }

  return { GAMES: GAMES, byId: byId, GROUPS: GROUPS, GROUP_ORDER: GROUP_ORDER,
           GROUP_LABEL: GROUP_LABEL, LEARNING_ROUTE: LEARNING_ROUTE, TAGS: TAGS,
           headersOf: headersOf };
});
```

- [ ] **Step 6: 运行确认「只差数据」**

Run: `node chess/games/games.test.js`
Expected: FAIL，但**失败的只有数量相关的那几条**——`一共 30 局`（实际 2）、`学习路线里的 legal-saint-brie-1750 是存在的棋局` 等。两局教学构造局的每一条断言都必须已经通过。如果有任何一条 `fools-mate:` / `scholars-mate:` 开头的断言失败，先修它，别往下走。

- [ ] **Step 7: 提交**

```bash
git add chess/games/
git commit -m "feat(chess): 棋谱数据契约、六分组骨架、汇总器与校验门（含两局教学构造局）"
```

---

## Task 8–12: 五组历史棋谱（五个 worktree 并行）

这五个任务**形状完全相同，只有 id 清单与故事要点不同**。下面先写共用的协议，再逐组给清单。

**Files（每组只碰自己那一个文件）:**
- Modify: `chess/games/games-<group>.js`

**Interfaces:**
- Consumes: Task 7 的数据契约与 `games-teaching.js` 的样板
- Produces: 该文件导出的数组由 N 局构成，`node chess/games/games.test.js` 中属于本组的断言全部通过

### 取谱协议

**这不是考据。** 取一份能重放的 PGN、记下它从哪儿来、按它写故事，就够了。同一局棋在不同来源可能有长短不一的记谱，**不去判定哪一版是「真的」**——本工具是用来看懂一局棋怎么下的。

1. **取一份 PGN**。可用的公开来源举例：`en.wikipedia.org` 的对局条目、`www.chessgames.com`、`lichess.org` 的公开 study、`www.chess.com` 的名局文章。优先取**带标签对的完整 PGN**；只拿到走法表时，自己按七标签补齐 `Event` / `Site` / `Date` / `Round` / `White` / `Black` / `Result`（不知道的写 `?`），棋手先后手**照来源写的填**。
2. **去掉注释、变着与 NAG**，只留标签对 + 主线走法 + 结果。
3. **逐步重放**——这是唯一的硬门，因为走不通的棋谱在工具里就是一块白屏：

```bash
node -e "
const C=require('./chess/core/chess-core.js');
const pgn='<粘在这里>';
const g=C.parsePGN(pgn);
const last=g.positions[g.positions.length-1];
console.log('plies', g.moves.length, '| result', g.result, '| skipped', g.skipped,
            '| final status', last.status());
console.log('last 6 SAN:', g.moves.slice(-6).map((m,i)=>C.moveToSAN(g.positions[g.moves.length-6+i],m)).join(' '));
"
```
任何抄错的一步会当场抛 `PGN move N ("Nf3") is illegal` —— **报错就回去重取，不要「猜一步能走通的」**。

4. **把来源 URL 写进 `source`**，一个就够。
5. **末局面粗看一眼**：以将死结束的局，`status()` 应该是 `'checkmate'`；认输或和棋结束的局通常是 `'ongoing'` 或 `'check'`，都正常。**如果你打算在故事里写「XX 将死了 YY」，那就顺手确认一下 `status()` 真的是 `checkmate`**——只核实你要写进文案的那部分，别的不用管。
6. **写文案**（见下）。
7. **`keyMoves` 的 ply 换算与 `san` 锚点**：白方第 N 回合的走法是第 `2N−1` 个半步，黑方第 N 回合是第 `2N`。`23...Qg3` 这样的记法是**黑方**第 23 回合 → ply = 46。换算完跑一次，把打印出来的 SAN **原样抄进 `san` 字段**（不要手写——手写的 `Qg3` 与 `moveToSAN` 生成的 `Qg3+` 差一个字符，校验门会当场拒绝，那正是它该做的）：

```bash
node -e "
const C=require('./chess/core/chess-core.js');
const pgn='<粘在这里>';
const plies=[/* 你算出来的 ply 列表，如 */ 17, 33, 46];
const g=C.parsePGN(pgn);
for(const p of plies) console.log(p, '→', C.moveToSAN(g.positions[p-1], g.moves[p-1]));
"
```

### 文案标准

- **`story`**：双语各 2–3 段。写**发生了什么、为什么它重要**——对手是谁、赌注是什么、这局棋改变了什么。不要逐步讲解棋（那是 `keyMoves` 的活），不要写"精彩绝伦"这类没有信息量的形容。受众是 16 岁、零基础、正要开始 A-level 数学与 CS 的人：可以密集、可以正式，但**每一句都要有一个具体的事实**。
- **`why`**：双语各一句话，是列表页上唯一显示的那行字。
- **`keyMoves`**：3–6 条。每条说明**这一步为什么是转折**，而不是复述走法。回放到这里会自动暂停——所以它要值得被打断一次。
- **中文界面下战术术语并列英文**（规格 §3.2）：`弃后 queen sacrifice`、`别子 pin`、`双叉 fork`、`闷杀 smothered mate`。
- **别把没把握的事写成断言**。§6.2 的「故事要点」是任务简报，不是史料来源。具体的数字与名次（比分、届次、多少人参与投票）顺手扫一眼来源；扫不到的就换个说法或去掉，流传的说法写成「据说」。这不是要你去考据，是别让一句可有可无的细节把整段话变成假话。**发现简报本身写错了，停下来报告。**

### Task 8: `games-machine.js` — 人机对抗（5 局）

| id | 对局 | 年份 | 故事要点（简报，需核实） |
|---|---|---|---|
| `deep-blue-kasparov-1996-g1` | Deep Blue – Kasparov, 第 1 局 | 1996 | 机器第一次在正式比赛中击败在位世界冠军；卡斯帕罗夫最终仍以 4–2 赢下整场 |
| `deep-blue-kasparov-1997-g2` | Deep Blue – Kasparov, 第 2 局 | 1997 | 争议顶点：第 36 步「太像人」，卡斯帕罗夫要求查看日志被拒；事后分析发现他认输的局面其实能和 |
| `deep-blue-kasparov-1997-g6` | Deep Blue – Kasparov, 第 6 局 | 1997 | 19 步崩盘，走进已知的弃马陷阱 |
| `alphazero-stockfish-2017-g10` | AlphaZero – Stockfish, 第 10 局 | 2017 | 自学 4 小时的神经网络对手工评估函数；长期弃子换压制 |
| `hydra-adams-2005` | Hydra – Adams | 2005 | Deep Blue 十年后，人类顶尖棋手 5.5–0.5 落败 |

> 先后手照 PGN 的标签对填，不照本表的排列填（本表只是任务简报）。AlphaZero–Stockfish 那批公开对局的编号在不同来源里不统一——取一局能重放的，在 `story` 里说明你取的是哪一批就行，不必去判定哪个编号是权威的。

### Task 9: `games-romantic.js` — 浪漫时代（6 局）

| id | 对局 | 年份 | 故事要点（简报，需核实） |
|---|---|---|---|
| `anderssen-kieseritzky-1851` | Anderssen – Kieseritzky「不朽局」 | 1851 | 弃双车与后；一局非正式的休息时间对局，却成了最著名的一局 |
| `anderssen-dufresne-1852` | Anderssen – Dufresne「常青局」 | 1852 | 同一位棋手、同一种美学，结尾组合更干净 |
| `morphy-opera-1858` | Morphy – 布伦瑞克公爵与伊苏阿尔伯爵「歌剧院局」 | 1858 | 教学价值第一：在巴黎歌剧院包厢看《诺尔玛》时下的，17 回合展示全部开局原则 |
| `rotlewi-rubinstein-1907` | Rotlewi – Rubinstein「鲁宾斯坦不朽局」 | 1907 | 收官组合中四子同时被攻 |
| `legal-saint-brie-1750` | Légal – Saint Brie「勒加尔杀法」 | 1750 | 现存最早的名局之一，最经典的弃后陷阱 |
| `levitsky-marshall-1912` | Levitsky – Marshall | 1912 | 23...Qg3!!；「观众往棋盘上撒金币」的传说 —— **写故事时必须写明这是流传的说法而非确证** |

**`morphy-opera-1858` 的走法已在本机重放核实，直接用**（33 个半步，1-0，末局面 `checkmate`）——把它按七标签补成完整 PGN：

```
[Event "Casual game"]
[Site "Paris FRA"]
[Date "1858.??.??"]
[Round "-"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0
```
`source` 用 `https://en.wikipedia.org/wiki/Opera_Game`。其余五局照协议自行取谱。

### Task 10: `games-coldwar.js` — 冷战与世界冠军战（7 局）

| id | 对局 | 年份 | 故事要点（简报，需核实） |
|---|---|---|---|
| `byrne-fischer-1956` | Byrne – Fischer「世纪之局」 | 1956 | 13 岁的 Fischer，第 17 回合弃后 |
| `spassky-fischer-1972-g1` | Spassky – Fischer, 第 1 局 | 1972 | Fischer 吃下毒兵而输，改变整场比赛的心理走向 |
| `fischer-spassky-1972-g6` | Fischer – Spassky, 第 6 局 | 1972 | Spassky 起立为对手鼓掌 |
| `tal-botvinnik-1960-g6` | Tal – Botvinnik, 第 6 局 | 1960 | 「魔术师」塔尔的弃子无法用穷举证明，只能用直觉——工具④ 的反面教材 |
| `karpov-kasparov-1985-g16` | Karpov – Kasparov, 第 16 局 | 1985 | d3 上的「章鱼骑士」；22 岁的卡斯帕罗夫夺冠 |
| `karpov-kasparov-1985-g48` | Karpov – Kasparov, 第 48 局 | 1985 | 比赛在 5–3 时被 FIDE 主席无理由中止 —— **这是 1984–85 那场（第一次交锋、48 局后中止），与上一行的第二次交锋不是同一场比赛；写故事时别把两场混着说** |
| `carlsen-nepomniachtchi-2021-g6` | Carlsen – Nepomniachtchi, 第 6 局 | 2021 | 136 回合、近 8 小时，世界冠军赛史上最长一局 |

> `carlsen-nepomniachtchi-2021-g6` 是本工具里最长的一局（约 272 个半步）。它同时是 `Replay.zStep()` 自适应跨度的真实压力测试——加进去之后，务必在浏览器里切到 `trace` 页看它，别只看短棋局。

### Task 11: `games-theory.js` — 理论转折（5 局）

| id | 对局 | 年份 | 故事要点（简报，需核实） |
|---|---|---|---|
| `reti-capablanca-1924` | Réti – Capablanca | 1924 | 终结卡帕布兰卡的长期不败纪录；超现代主义登场——不占中心，而是从远处控制它 |
| `botvinnik-capablanca-1938` | Botvinnik – Capablanca | 1938 | 30.Ba3!! 被引用最多的弃象之一 |
| `steinitz-bardeleben-1895` | Steinitz – von Bardeleben | 1895 | 白方连续多步将军的强制杀；黑方直接离场，从未认输 |
| `kasparov-topalov-1999` | Kasparov – Topalov | 1999 | 「卡氏不朽」：24.Rxd4 弃车，白王一路走进对方阵地 |
| `capablanca-marshall-1918` | Capablanca – Marshall | 1918 | Marshall 新变例首演，卡帕布兰卡当场从零算翻。「憋了八年」是流传的说法，写成「据说」即可 |

> `steinitz-bardeleben-1895` 的记谱在不同来源里长度不一：有的到黑方离场为止，有的把 Steinitz 事后演示的强制杀法接在后面。两种都可以用——**挑一份，然后让故事和 keyMoves 与你挑的那份一致**。若用了含演示杀法的版本，在 `story` 里说一句后半段是赛后演示的。

### Task 12: `games-human.js` — 争议与人性（5 局）

| id | 对局 | 年份 | 故事要点（简报，需核实） |
|---|---|---|---|
| `kasparov-polgar-2002` | Kasparov – Polgar | 2002 | Judit Polgar 击败在位世界第一 |
| `deep-fritz-kramnik-2006-g2` | Deep Fritz – Kramnik, 第 2 局 | 2006 | 34...Qe3?? 直接送一步杀，史上最著名的漏着 |
| `carlsen-niemann-2022` | Carlsen – Niemann, Sinquefield Cup | 2022 | 作弊风波与次日退赛。棋不精彩，它是这项运动信任危机的标本 —— **只写公开事实（哪一天、谁做了什么、官方后来说了什么），不复述未经证实的指控**。这一条不是考据洁癖，是不给一个在世的人扣帽子 |
| `kasparov-world-1999` | Kasparov vs The World | 1999 | 一人对数万名网民投票；互联网时代的集体决策实验 —— 维基百科条目只有夹在正文里的片段走法，得另找完整棋谱 |
| `menchik-euwe-1930` | Menchik – Euwe, Hastings | 1930/31 | Vera Menchik 击败未来世界冠军；「门契克俱乐部」。Hastings 跨年赛横跨两年，PGN 的 `Date` 照来源填 |

### 每个 Task 的步骤（8–12 各自照做）

- [ ] **Step 1: 逐局取谱并通过重放**（上面的取谱协议 1–5）。**每一局单独跑一次 `node -e` 重放，不要一次批量粘 5 局**——批量跑时哪一局报的错很容易看串。
- [ ] **Step 2: 写文案**（上面的文案标准）
- [ ] **Step 3: 跑本组的校验门**

```bash
node chess/games/games.test.js 2>&1 | grep -E "^FAIL|passed"
```
Expected: 属于本组 id 的断言全部通过（其余组尚未填的会因为 `一共 30 局` 等数量断言而失败，那不是你的问题）。

- [ ] **Step 4: 逐局眼看一遍**

```bash
node -e "
const C=require('./chess/core/chess-core.js');
const G=require('./chess/games/games.js');
const list=require('./chess/games/games-<group>.js');
for(const g of list){
  const p=C.parsePGN(g.pgn), h=G.headersOf(g), n=p.moves.length;
  const tail=p.moves.slice(-6).map((m,i)=>C.moveToSAN(p.positions[n-6+i],m)).join(' ');
  console.log(g.id.padEnd(32), (h.White+'–'+h.Black).padEnd(28),
              String(n).padStart(3)+' plies', p.result.padEnd(8),
              p.positions[n].status().padEnd(10), tail);
}
"
```
扫一眼：先后手的名字对不对、结果与你写的故事一致不一致、末局面状态与故事里的说法对不对。**这一步是给人看的**——机器只能保证这些走法合法，看不出你把故事写在了另一局棋上。

- [ ] **Step 5: 提交**

```bash
git status --short          # 只该有 chess/games/games-<group>.js
git add chess/games/games-<group>.js
git commit -m "feat(chess): <分组中文名> N 局棋谱与双语背景故事"
```

---

## Task 13: 工具③ 骨架、`board` 页与传输控件

**Files:**
- Create: `chess/tools/chess-game-replay.html`（从 `_skeleton.html` 复制）

**Interfaces:**
- Consumes: `VizEngine` / `ChessCore` / `BoardRender` / `Replay` / `ChessGames`
- Produces: `TOOL.id = 'chess-game-replay'`；`window.__replayProbe`（见 Step 4 的验收探针）

**顿悟**（规格 §4③）：一局棋是三维里的一条曲线。

- [ ] **Step 1: 复制骨架，补两个 GENERATED 区**

```bash
cp chess/tools/_skeleton.html chess/tools/chess-game-replay.html
```

在 `GENERATED:BOARD-RENDER` 之后追加两个新区间（顺序：`REPLAY` 依赖 `CHESS-CORE`；`GAMES` 不依赖任何模块，但放最后便于阅读）：

```html
/* >>> GENERATED:REPLAY */
/* <<< GENERATED:REPLAY */
/* >>> GENERATED:GAMES */
/* <<< GENERATED:GAMES */
```

改掉 `<title>`、`<meta name="tool-version" content="1.0.0">`、`<meta name="engine-version" content="chess-1.1.0">`，以及头部注释里的占位符。

- [ ] **Step 2: 写四个页签的骨架与 `board` 页**

工具专属 `<script>` 块（GENERATED 区之外）。相机与布局常量：

```js
  var E = window.VizEngine;
  var CC = window.ChessCore;        // 避开 draw(C) 里相机参数名 C 的冲突
  var BR = window.BoardRender;
  var RP = window.Replay;
  var GM = window.ChessGames;

  var canvas = document.getElementById('scene');
  var ctx = canvas.getContext('2d');

  // 画布字面量色值（与 :root 的 --trace-* 令牌同源，Canvas 里不能用 var()）
  var ROSE = '#fb7185', VIOLET = '#a78bfa', EMERALD = '#34d399', ORANGE = '#fb923c',
      CYAN = '#2dd4ea', SLATE = 'rgba(159,176,200,0.55)';

  /* 相机：棋盘铺在世界 x–y 平面、法线是 z（见 board-render.js 头注）。
     顶视是 az=0/el=0，不是 el→π/2 —— 后者会跑到离法线 83° 的地方。
     侧视 az=−π/2 时屏幕水平向右正好是 +z，也就是「回合数」这根轴：
     这是把一局棋读成一张折线图的唯一正确机位，也是本工具的顿悟视角。 */
  var CAM_ISO   = { az: -0.72, el: 0.42, dist: 15 };
  var CAM_SIDE  = { az: -Math.PI / 2, el: 0.06, dist: 17 };   // 顿悟视角
  var CAM_TOP   = { az: 0, el: 0, dist: 14 };

  var L = BR.layout({ files: 8, ranks: 8, cell: 1 });          // 当前局面，z = 0

  /* 当前页签：引擎不导出 curTab，每个场景的 draw() 自己把它写下来（阶段 1
     两个工具是同一手法）。探针与读数都读它。 */
  var myCurTab = 'board';

  /* 棋盘视角翻转（规格 §5.3 的棋盘专属键 F）：不是把棋盘数据翻过来，
     只是把相机绕 z 轴转半圈——数据翻转会让 pickSquare、坐标标签、轨迹
     全部要各自记得翻一次，转相机则一处收口。 */
  var flipped = false;

  function fillSquare(camC, sq, style) {
    var cs = L.squareCorners(CC.fileOf(sq), CC.rankOf(sq));
    var pts = cs.map(function (p) { return E.proj(camC, p); });
    if (pts.some(function (p) { return !p; })) return;   // 近裁剪掉的格不画
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = style;
    ctx.fill();
  }
```

回放状态与棋局选择：

```js
  /* 四个页签共用同一份回放状态：本工具的主题是「同一局棋，四种测量」——
     与工具② 每个 tab 一份独立局面刚好相反，那里的四个 tab 是四个不同的
     教学场景。切页签不该让你回到棋局开头。 */
  var rs = null;
  var currentId = null;

  function loadGame(id) {
    var g = GM.byId[id];
    if (!g) return;
    rs = RP.load({ pgn: g.pgn, keyMoves: g.keyMoves });
    rs.meta = g;
    currentId = id;
    rebuildMoveList();
    syncTransport();
  }
```

页签清单与 `views`（**第一项必须是 `iso`**）：

| tab | views | 说明 |
|---|---|---|
| `board` | `iso`（家）、`side`、`top` | 播放条 + SAN 步表，历史局面沿 −z 堆叠 |
| `trace` | `iso`（家）、`side`（顿悟）、`top` | Task 14 |
| `eval` | `iso`（家）、`side`（图）| Task 15 |
| `heat` | `iso`（家）、`top`（顿悟）| Task 16 |

`board` 页的绘制（画在这里的历史是「框线 + 那一步的连线」，不是完整棋盘）：

```js
  /* 历史沿 −z 后退：z=0 是当前局面，第 i 个半步在 z = −(ply−i)·zStep。
     用负号是因为顶视相机的 eye 在 +z 一侧 —— 正号会让历史糊在镜头前面，
     并且长棋局会一路穿过相机。

     只画最近 GHOST_MAX 层，且只画外框 + 那一步的起讫连线，不画格子、
     不画棋子：272 个半步 × 64 格 = 一万七千个四边形，任何机器上都撑不住
     4ms 的绘制预算，而「一摞正在后退的方框，每一层上有一条线」已经把
     「一局棋是三维里的一条曲线」这件事说清楚了。 */
  var GHOST_MAX = 24;

  function drawHistory(camC) {
    var zs = rs.zStep;
    var lo = Math.max(0, rs.ply - GHOST_MAX);
    for (var i = rs.ply; i > lo; i--) {
      var z = -(rs.ply - i) * zs;
      var k = (rs.ply - i) / GHOST_MAX;            // 0 = 最近，1 = 最远
      var alpha = 0.42 * (1 - k);
      var Lz = BR.layout({ files: 8, ranks: 8, cell: 1, z: z });
      var o = Lz.squareCorners(0, 0)[0];
      E.strokePoly(camC, [o, [o[0] + Lz.w, o[1], z], [o[0] + Lz.w, o[1] + Lz.h, z],
                          [o[0], o[1] + Lz.h, z], o],
                   { color: 'rgba(159,176,200,' + alpha.toFixed(3) + ')', width: 1 });
      var m = rs.moves[i - 1];
      var a = Lz.squareCenter(CC.fileOf(m.from), CC.rankOf(m.from));
      var b = Lz.squareCenter(CC.fileOf(m.to), CC.rankOf(m.to));
      E.line3(camC, a, b, { color: ORANGE, width: 1.6, alpha: 0.25 + 0.55 * (1 - k) });
    }
  }
```

当前局面（z=0）用 `drawBoard` + 逐子 `drawPiece`，**棋子尺寸必须用 `BR.pieceAutoScale`，不要传固定像素值**（阶段 1 用户截图抓出过这个问题）：

```js
  function drawPosition(camC) {
    BR.drawBoard(ctx, camC, E, { layout: L });
    var pos = RP.position(rs);
    // 上一步的起讫格高亮
    var m = rs.ply > 0 ? rs.moves[rs.ply - 1] : null;
    if (m) { fillSquare(camC, m.from, 'rgba(251,146,60,0.18)');
             fillSquare(camC, m.to, 'rgba(251,146,60,0.30)'); }
    for (var r = 0; r < 8; r++) for (var f = 0; f < 8; f++) {
      var v = pos.board[CC.SQ(f, r)];
      if (v === CC.EMPTY) continue;
      var c = L.squareCenter(f, r);
      BR.drawPiece(ctx, camC, E, { code: v, center: c, cell: L.cell });
    }
  }
```

- [ ] **Step 3: 传输控件与 SAN 步表**

传输条挂进 `#recHost`（F4 删除之后它是个空槽，由工具自己填；见 Task 1）。骨架：

```js
  var transportEls = null;   // { play, scrub, speed, counter }

  function buildTransport() {
    var host = document.getElementById('recHost');
    host.innerHTML = '';
    var row = document.createElement('div');
    row.className = 'row recrow';
    function mk(text, fn) {
      var b = document.createElement('button');
      b.className = 'btn';
      b.textContent = text;
      b.addEventListener('click', fn);
      row.appendChild(b);
      return b;
    }
    mk('⏮', function () { RP.rewind(rs); syncTransport(); });
    mk('◀', function () { RP.setPlaying(rs, false); RP.step(rs, -1); syncTransport(); });
    var play = mk('▶', function () { RP.setPlaying(rs, !rs.playing); syncTransport(); });
    mk('▶|', function () { RP.setPlaying(rs, false); RP.step(rs, 1); syncTransport(); });
    var SPEEDS = [0.5, 1, 1.5, 3, 6];
    var speed = mk('1.5×', function () {
      rs.speed = SPEEDS[(SPEEDS.indexOf(rs.speed) + 1) % SPEEDS.length];
      syncTransport();
    });
    host.appendChild(row);

    var scrub = document.createElement('input');
    scrub.type = 'range'; scrub.min = 0; scrub.step = 1;
    /* 你一动它就停在你这一步（规格 §5.1）——「全交互」与「自动演示」
       不是两种模式，是同一条时间轴的两种驱动源。 */
    scrub.addEventListener('input', function () {
      RP.setPlaying(rs, false);
      RP.goto(rs, +scrub.value);
      syncTransport();
    });
    host.appendChild(scrub);

    var counter = document.createElement('div');
    counter.className = 'recinfo';
    host.appendChild(counter);

    transportEls = { play: play, scrub: scrub, speed: speed, counter: counter };
  }

  /* 每帧只改文本、不重建 DOM：重建会打断 range 的拖拽手感，而且每帧
     重建十来个元素本身就吃掉绘制预算。 */
  function syncTransport() {
    if (!transportEls || !rs) return;
    transportEls.play.textContent = rs.playing ? '⏸' : '▶';
    transportEls.speed.textContent = rs.speed + '×';
    transportEls.scrub.max = rs.maxPly;
    if (document.activeElement !== transportEls.scrub) transportEls.scrub.value = rs.ply;
    transportEls.counter.textContent = rs.ply + ' / ' + rs.maxPly +
      (rs.ply > 0 ? '  ' + rs.san[rs.ply - 1] : '');
    highlightMoveRow();
  }
```

- 帧推进在 `draw()` 里：`if (RP.tick(rs, E.state.dt)) syncTransport();`（**用引擎的 `state.dt`，不要自己 `performance.now()`**——Task 1 刚把这条路收口）。
- `rebuildMoveList()`：SAN 步表是一个浮在 canvas 上、可滚动的两列表格（回合号 | 白 黑），载入新棋局时重建一次。点任意一步 → `RP.setPlaying(rs, false); RP.goto(rs, ply); syncTransport();`。
- `highlightMoveRow()`：给当前半步的单元格加高亮 class，并 `scrollIntoView({ block: 'nearest' })`。
- `rs.note` 非空时，在 `#tips` 上方弹出关键步说明卡片（`{en,zh}` 经 `E.t()`）；点卡片或走下一步即消失。
- **`F` 键翻转棋盘视角**（规格 §5.3 的棋盘专属键，引擎不提供，工具自己监听）：`flipped = !flipped`，把当前相机的 `az` 加上 `π` 并 `wrap` 回 `(-π, π]`。键盘监听**必须复用引擎那套焦点保护的判据**——`document.activeElement` 是 `input` / `textarea` / `select` / `isContentEditable` 时一律不响应（否则在 FEN 输入框里打一个 `f` 就会翻转棋盘）。

棋局选择用 `presets`（离散具名内容，**不是 `views`**——`views` 只放相机角度，阶段 1 把两者合并过一次并因此返工）。默认按学习路线排列：

```js
  presetsLabel: { en: 'Game', zh: '棋局' },
  presets: GM.LEARNING_ROUTE.map(function (id) {
    return { key: id,
             label: (function (h) { var s = h.White + '–' + h.Black; return { en: s, zh: s }; })(GM.headersOf(GM.byId[id])),
             onSelect: function () { loadGame(id); } };
  }),
```

> 学习路线只有 11 局，另外 19 局由 Task 18 的棋局浏览器（按分组折叠的列表）进入。`presets` 那一行按钮放 11 个已经很挤，放 30 个会挤爆面板。

- [ ] **Step 4: node 侧先验证数据通路（不依赖浏览器）**

```bash
node -e "
const R=require('./chess/core/replay.js');
const G=require('./chess/games/games.js');
let bad=0;
for(const id of G.LEARNING_ROUTE){
  const g=G.byId[id];
  const rs=R.load({pgn:g.pgn,keyMoves:g.keyMoves});
  const zSpan=rs.zStep*rs.maxPly;
  if(zSpan>R.Z_SPAN_MAX+1e-9){console.error(id+' 的 z 跨度 '+zSpan+' 超过上限');bad++;}
  console.log(id.padEnd(32), String(rs.maxPly).padStart(3)+' plies',
              'zStep='+rs.zStep.toFixed(4), 'zSpan='+zSpan.toFixed(2),
              'keyMoves='+g.keyMoves.length);
}
process.exit(bad?1:0);
"
```
Expected: 11 行全部打印，无错误，每一局的 `zSpan ≤ 14`。

- [ ] **Step 5: 浏览器验收**

用 preview 工具打开 `/chess/tools/chess-game-replay.html`（**每次调用带显式 `tabId`**）。先装一个探针，避免靠截图猜状态（面板 rAF 被节流到约 12 秒一帧，截图可能是十几秒前的旧帧）：

```js
// javascript_exec，带 tabId
(() => { const p = window.__replayProbe && window.__replayProbe();
         return p || 'no probe'; })()
```

工具里导出这个探针（放在工具脚本末尾）：

```js
  /* 验收探针：浏览器面板的 rAF 被节流到约十二秒一帧、document.hidden 恒为真，
     「看几秒没动」什么都证明不了。要验状态就读标志位，要验时序就直接推
     累加器。这个函数是本工具对外的唯一状态出口。 */
  window.__replayProbe = function () {
    return { tool: 'chess-game-replay', tab: myCurTab, gameId: currentId,
             ply: rs && rs.ply, maxPly: rs && rs.maxPly, playing: rs && rs.playing,
             speed: rs && rs.speed, note: rs && rs.note && rs.note.en,
             flipped: flipped, dt: E.state.dt, fen: rs && RP.position(rs).toFEN() };
  };
  /* 直接推时序用的把手：面板的 rAF 被节流到约十二秒一帧，等它自己走完
     一段是不可行的验收方式。给回放态一个出口，验收时直接喂 dt。 */
  window.__rs = function () { return rs; };
  window.__sync = syncTransport;
```

逐条确认：

1. 探针的 `tool` 是 `'chess-game-replay'`（**先断言这一条再信任后面任何测量**——多 agent 共享浏览器会话，探针可能落在别人的页面上）。
2. 四个页签都能切换；每个页签 `views` 的第一项是 `iso`；**双击画布回到 iso**。
3. 点 `▶` 后隔一次调用再读探针，`ply` 变大了；点 `⏸` 后 `ply` 不再变。
4. 直接推时序而不是等（`__rs` / `__sync` 见上面的探针）：
```js
(() => { const rs = __rs(); Replay.setPlaying(rs, true);
         for (let i = 0; i < 40; i++) Replay.tick(rs, 0.05);
         __sync(); return __replayProbe(); })()
```
Expected: `ply` 前进了约 `40 × 0.05 × speed` 个半步（或在中途某个 keyMove 处停下且 `playing === false`）。
5. 拖时间轴到中段 → `playing` 变 `false`，`ply` 等于拖到的值。
6. 按 `F` → 探针的 `flipped` 翻转、画面转了半圈；焦点在 FEN 输入框里时按 `f` **不**翻转。
7. 载入 `morphy-opera-1858`，播放到某个 keyMove 的 ply → `playing === false`，`note` 非空，且页面上确实弹出了说明卡片（这条要**截图**看，探针证明不了「卡片真的画出来了」）。
8. `side` 视角下，历史那一摞方框沿水平方向后退，肉眼能数出层次。
9. 语言切换 EN⇄ZH 生效，**默认是 EN**。
10. 绘制耗时 ≤4ms：用与 `_piece-preview.html` 相同的分项探针，**强制光栅化每帧只做一次**，探针开销单列并排除（这个错误曾把 0.30ms 放大成 6.00ms）。

- [ ] **Step 6: 提交**

```bash
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py; echo "exit=$?"
git status --short
git add chess/tools/chess-game-replay.html
git commit -m "feat(chess): 工具③ 骨架、board 页与传输控件"
```

---

## Task 14: `trace` 页 — 子力轨迹

**Files:**
- Modify: `chess/tools/chess-game-replay.html`

**Interfaces:**
- Consumes: `Replay.traces(rs)`
- Produces: `SCENES.trace`

**这一页是本工具的顿悟视角所在**：一眼看出「这只马走了 9 步，那只象一步没动」。

- [ ] **Step 1: 画轨迹**

```js
  /* 一颗子的一生 = 一条三维折线：x/y 是它站过的格，z 是那一步的回合数。
     只画到当前 ply 为止 —— 回放到一半时把整局的轨迹全画出来等于剧透。 */
  function tracePoints(tr, upto, zs) {
    var pts = [];
    for (var i = 0; i < tr.points.length; i++) {
      var p = tr.points[i];
      if (p.ply > upto) break;
      var c = L.squareCenter(CC.fileOf(p.sq), CC.rankOf(p.sq));
      pts.push([c[0], c[1], -(upto - p.ply) * zs]);
    }
    return pts;
  }
```

- 颜色：白方 `CYAN`、黑方 `ORANGE`；被吃的子在 `capturedAt <= ply` 时整条线降到 `alpha 0.25` 并在末端画一个 `solidDot`（死亡点）。
- **一步没动的子**（`points.length === 1`）画成一根从 `z=-(ply)·zs` 到 `z=0` 的**直线**——这正是「它一步没动」的视觉证据，不画它反而看不出来。
- 当前局面的棋子照常画在 `z=0`（复用 Task 13 的 `drawPosition`），轨迹从棋子脚下长出去。
- 一个 `toggles` 开关 `onlyMoved`（默认关）：只画走过至少一步的子。棋盘上 32 条线在开局阶段会糊成一片，这个开关是给 `trace` 页的可用性兜底。

- [ ] **Step 2: `tips` 与 `readout`**

`tips`（双语，指向一个具体动作，规格要求「解释恰好一个顿悟并点到具体视角或开关」）：

```js
  tips: {
    en: 'Switch to the Side view: the horizontal axis is now the move number, so every piece\'s whole life is one line. The knight that zig-zags across nine moves and the bishop that never left its square are the same object seen along time.',
    zh: '切到「侧视」：水平轴就是回合数，于是每颗子的一生都成了一条线。那只来回折了九步的马，和那只一步没离开原格的象，是同一件东西沿时间轴的两种样子。',
  }
```

`readout` 至少给出：当前 ply / 总 ply、还活着的子数、走得最多的那颗子（`code` + 走了几步）、一步没动的子数。

- [ ] **Step 3: 验证**

node 侧先把「走得最多的子」算出来，浏览器里的读数必须与它一致：

```bash
node -e "
const C=require('./chess/core/chess-core.js');
const R=require('./chess/core/replay.js');
const G=require('./chess/games/games.js');
const g=G.byId['morphy-opera-1858'];
const rs=R.load({pgn:g.pgn});
const tr=R.traces(rs);
const busiest=tr.slice().sort((a,b)=>b.points.length-a.points.length)[0];
console.log('最忙的子:', C.toAlg(busiest.from), 'code', busiest.code, '走了', busiest.points.length-1, '步');
console.log('一步没动:', tr.filter(t=>t.points.length===1).length, '颗');
console.log('被吃:', tr.filter(t=>t.capturedAt!=null).length, '颗');
"
```

浏览器逐条：
1. 探针 `tool === 'chess-game-replay'`、`tab === 'trace'`。
2. `side` 视角下能数出折线沿水平方向的分段。
3. `readout` 的三个数与上面 node 的输出一致。
4. 载入 `carlsen-nepomniachtchi-2021-g6`（272 个半步）后，轨迹**没有超出画面、也没有被近裁剪切掉**——这是 `zStep` 自适应的真实检验。
5. `onlyMoved` 开关确实减少了线条数。
6. 绘制耗时 ≤4ms（在那局 272 半步的棋上测，不要在四步杀上测）。

- [ ] **Step 4: 提交**

```bash
git add chess/tools/chess-game-replay.html
git commit -m "feat(chess): trace 页 —— 每颗子沿 z 的三维折线"
```

---

## Task 15: `eval` 页 — 沿回合的三条曲线

**Files:**
- Modify: `chess/tools/chess-game-replay.html`

**Interfaces:**
- Consumes: `Replay.series(rs)` / `Replay.evalAt(pos)`
- Produces: `SCENES.eval`

- [ ] **Step 1: 画三条曲线**

- 三条曲线用固定顺序的三个颜色：**子力差 rose / 控制格数 violet / 王的安全度 emerald**。
- 每条曲线的 x 轴是 z（回合数），y 轴是数值，画在世界坐标的 `x = 0` 平面上（也就是让曲线立在棋盘的中线上），这样 `side` 视角看到的就是一张标准折线图，`iso` 视角看到的是「三条曲线从棋盘里长出去」。
- 三条曲线的量纲差得远（子力差 ±9 量级，控制格数 ±30 量级，王安全 ±8）。**各自独立归一化到同一屏高，并在图例里标出各自的实际量程**——不要硬塞进同一个刻度（那会让子力差看起来是一条直线），也不要不标注就归一化（那会让人以为它们可比）。
- 三色六处复用（设计系统第 3 条原则）：图例点、曲线体、投影虚线、头部辉光点、读数粗体值、公式标签。当前 ply 处每条曲线画一个 `glowDot`。
  > **`glowDot(s, r, core, mid)` 收的是屏幕坐标，不是世界点**（引擎里唯一一个这样的图元，其余 `solidDot` / `label3` / `line3` 都收世界点）。用法是 `var s = E.proj(camC, world); if (s) E.glowDot(s, 9, core, mid);`——直接把世界点喂进去不会报错，只会把光点画到画布左上角附近。

- [ ] **Step 2: 把「它粗糙在哪」写进界面**

规格 §4③ 要求「工具内会说明它粗糙在哪」。这不是 tips 里一句带过，而是 `readout` 下方一个可折叠的说明块，三条各一段（内容取自 Task 5 表格的第四列，双语）：

```js
  var EVAL_CAVEATS = {
    material: {
      en: 'Material: P=1 N=3 B=3 R=5 Q=9, king 0. Those numbers are a convention that works, not a theorem. Position, pawn structure and king safety are all outside this count — which is exactly why a game can be won while this curve says you are losing.',
      zh: '子力差：兵 1、马 3、象 3、车 5、后 9，王计 0。这套数字是行之有效的约定，不是定理。位置、兵形、王的安全全都不在这个计数里——正因如此，一局棋完全可能在这条曲线说你落后的时候被你赢下来。',
    },
    control: {
      en: 'Control: the number of distinct squares each side attacks, counted from the attack geometry. It includes squares occupied by your own pieces (that is defence, not occupation) and excludes pawn pushes (a pawn does not attack the square in front of it). So it measures reach, not safe occupation.',
      zh: '控制格数：每方攻击到的不同格子数，从攻击几何直接数出来。它把己方棋子占据的格也算进去（那是保护，不是占领），也不含兵的前进（兵不攻击正前方）。所以它量的是火力覆盖，不是安全占据。',
    },
    safety: {
      en: 'King safety: minus the number of squares next to your king that the opponent attacks (only squares actually on the board, so a king in the corner has fewer than eight neighbours). It does not care who is attacking, whether anything is in the way, or whether the attack can ever be delivered. It is deliberately crude, and it is most informative in the middlegame.',
      zh: '王的安全度：己方王的邻格中被对方攻击的格数，取负（只数盘内的格，所以角落里的王邻格不足八个）。它不管攻击者是谁、路上有没有挡子、这攻势能不能真的兑现。它是刻意粗糙的，在中局最有参考价值。',
    },
  };
```

`readout` 里三条曲线的当前值各配一个 `ⓘ`，点开显示对应段落。

- [ ] **Step 3: 验证**

```bash
node -e "
const R=require('./chess/core/replay.js');
const G=require('./chess/games/games.js');
const g=G.byId['byrne-fischer-1956'];
const rs=R.load({pgn:g.pgn});
const S=R.series(rs);
console.log('ply  material control safety');
for(let i=0;i<=rs.maxPly;i+=Math.ceil(rs.maxPly/12))
  console.log(String(i).padStart(3), String(S.material[i]).padStart(8),
              String(S.control[i]).padStart(7), String(S.safety[i]).padStart(6));
console.log('极值 material:', Math.min(...S.material), '..', Math.max(...S.material));
"
```

浏览器逐条：
1. 探针 `tool` 与 `tab === 'eval'`。
2. `side` 视角下三条曲线读得像一张折线图，`iso` 视角下它们从棋盘长出去。
3. 拖时间轴时三个 `glowDot` 跟着走，`readout` 的三个数与上面 node 输出的对应行**逐值一致**。
4. 图例标出了三条各自的实际量程，而不只是「已归一化」。
5. 三个 `ⓘ` 都能展开，中英文都在。
6. `byrne-fischer-1956` 第 17 回合弃后之后，rose 曲线有一个肉眼可见的向下台阶（这是「子力差」这条曲线存在的意义）。

- [ ] **Step 4: 提交**

```bash
git add chess/tools/chess-game-replay.html
git commit -m "feat(chess): eval 页 —— 三条曲线与「它粗糙在哪」的说明块"
```

---

## Task 16: `heat` 页 — 整局累计热力

**Files:**
- Modify: `chess/tools/chess-game-replay.html`

**Interfaces:**
- Consumes: `Replay.heat(rs, uptoPly)`
- Produces: `SCENES.heat`

- [ ] **Step 1: 画热力**

- 每格按 `counts[sq] / max` 填一层 `ORANGE` 半透明色（`alpha = 0.08 + 0.62 * ratio`），并在格心用 `label3` 标数字（`counts[sq] >= 1` 时才标）。
- 计数为 0 的格**不填色**——「哪些格从头到尾没人碰」是这一页的一半信息量，把它们涂成最浅的橙色就把这个信息抹掉了。
- 热力**跟着当前 ply 增长**（`RP.heat(rs, rs.ply)`），拖时间轴能看到战场怎么形成。`toggles` 里给一个 `wholeGame` 开关（默认关）一次看完整局。
- 顿悟视角是 `top`。

- [ ] **Step 2: `readout` 与 `tips`**

`readout`：最热的三格（代数记法 + 次数）、被碰过的格数 / 64、落子总数（**并注明「一步易位算两次落子，所以它不等于半步数」**）。

`tips`：

```js
  tips: {
    en: 'Look from the Top view and read the map: the squares nobody ever touched are as informative as the hot ones. In most games a whole wing stays cold — that is a decision both players made, move after move, without ever discussing it.',
    zh: '切到「俯视」读这张图：从头到尾没人碰过的格子，与最热的格子一样有信息量。多数棋局里整整一翼是冷的——那是双方一步一步共同做出的决定，从没商量过。',
  }
```

- [ ] **Step 3: 验证**

```bash
node -e "
const C=require('./chess/core/chess-core.js');
const R=require('./chess/core/replay.js');
const G=require('./chess/games/games.js');
const g=G.byId['morphy-opera-1858'];
const rs=R.load({pgn:g.pgn});
const h=R.heat(rs, rs.maxPly);
const top=Object.keys(h.counts).map(Number).sort((a,b)=>h.counts[b]-h.counts[a]).slice(0,3);
console.log('最热三格:', top.map(s=>C.toAlg(s)+'×'+h.counts[s]).join(' '));
console.log('被碰过', Object.keys(h.counts).length, '/64 格；落子', h.landings, '次；半步', rs.maxPly);
"
```

浏览器逐条：
1. 探针 `tool` 与 `tab === 'heat'`。
2. `top` 视角下读数三项与 node 输出**逐值一致**。
3. 计数为 0 的格确实没有填色。
4. 拖时间轴时热力在增长，不是一开始就满的。
5. 在一局含易位的棋上，`落子数 > 半步数`，且读数里写明了原因。

- [ ] **Step 4: 提交**

```bash
git add chess/tools/chess-game-replay.html
git commit -m "feat(chess): heat 页 —— 累计落子热力，冷格不填色"
```

---

## Task 17: PGN 拖入、FEN 粘贴、PGN 导出

**Files:**
- Modify: `chess/tools/chess-game-replay.html`

**Interfaces:**
- Consumes: `ChessCore.parsePGN` / `writePGN` / `Position.fromFEN`
- Produces: 三个输入口 + 一个导出口

规格 §4③「输入」与 §1.3「录制格式就是 PGN」。

- [ ] **Step 1: PGN 文件拖入**

- 在 canvas 上监听 `dragover` / `drop`（`preventDefault`），`FileReader.readAsText`，交给 `CC.parsePGN`。
- 成功 → `RP.load({ pgn: text })`，`rs.meta = null`（拖进来的棋没有故事与 keyMoves）。**显示用的棋手与赛事直接读 `rs.headers`**——`parsePGN` 已经把标签对给出来了，与内置的 30 局走的是同一条路，不需要为拖入另造一份元数据。步表、曲线、轨迹、热力全部照常工作。
- **失败要说清楚是哪一步坏了**：`parsePGN` 抛的错本来就带着 `PGN move 23 ("Nf3") is illegal: …`，原样显示在 tips 区，不要吞成「文件无效」。
- `parsed.skipped > 0` 时显示提示（规格 §9：遇到变着时跳过并提示，而不是报错退出）：

```js
  { en: 'This PGN contains variations or comments. They were skipped — only the main line is replayed. (Skipped: N)',
    zh: '这份 PGN 含有变着或注释。它们已被跳过，只回放主线。（跳过 N 段）' }
```

- [ ] **Step 2: FEN 粘贴**

- 一个 `<input>`（面板里，`#recHost` 传输条下方）。回车提交，`CC.Position.fromFEN(text)`。
- 成功 → 造一个 `maxPly = 0` 的回放态。**`eval` / `trace` / `heat` 三页此时只有一个点/一层**，这不是 bug：在这三页的 `tips` 位置显示 `{ en: 'A single position has no history — paste a PGN or pick a game to see the curves.', zh: '单个局面没有历史——粘一份 PGN 或选一局棋才有曲线可看。' }`。
- 失败 → 原样显示 `fromFEN` 的报错。
- **不要在这里传 `requireKings: false`**：使用者粘的是真实局面，无王的 FEN 在回放工具里没有意义，让它照常报错。

> 实现要点：`Replay.load` 只接受 PGN。FEN 走这条路：`RP.load({ pgn: '[FEN "' + fen + '"]\n*' })` —— `parsePGN` 认 `[FEN]` 标签（阶段 0 刻意放宽成不要求 `[SetUp]`），走法表为空，`maxPly = 0`。**不要为 FEN 另写一条 load 分支**，那会立刻长出第二套状态机。

- [ ] **Step 3: PGN 导出**

- 传输条上一个 `⬇ PGN` 按钮：`CC.writePGN(headers, rs.moves)` → `Blob` → `<a download>`。
- `headers` 直接用 `rs.headers`（`parsePGN` 解析出来的那一份，内置棋谱与拖入棋谱同源）。`writePGN` 自己会把缺的七标签补成 `'?'`。
- 文件名：`<id>.pgn`，拖入来的用原文件名，FEN 来的用 `position.pgn`。
- **导出的档案要能被 lichess 打开**（规格 §1.3）。

- [ ] **Step 4: 验证**

先在 node 侧验证往返：

```bash
node -e "
const C=require('./chess/core/chess-core.js');
const G=require('./chess/games/games.js');
let bad=0;
for(const g of G.GAMES){
  const p1=C.parsePGN(g.pgn);
  const out=C.writePGN(p1.headers, p1.moves);       // 标签对原样带出去
  const p2=C.parsePGN(out);
  if(p2.moves.length!==p1.moves.length){console.error(g.id+' 往返后半步数变了');bad++;continue;}
  for(let i=0;i<p1.moves.length;i++) if(!C.sameMove(p1.moves[i],p2.moves[i])){
    console.error(g.id+' 往返后第 '+(i+1)+' 个半步不同');bad++;break;}
  if(p2.result!==p1.result){console.error(g.id+' 往返后结果变了');bad++;}
}
console.log(bad?('✗ '+bad+' 局往返不一致'):'✓ 30 局 PGN 往返逐步一致');
process.exit(bad?1:0);
"
```
Expected: `✓ 30 局 PGN 往返逐步一致`

浏览器逐条：
1. 把 `chess/games/` 之外的任意一份真实 `.pgn`（可以先用导出功能存一份出来）拖进画布 → 载入成功，步表出现。
2. 拖一份**故意改坏一步**的 PGN → tips 区显示的报错**点名了第几步、哪个记号**。
3. 拖一份含变着的 PGN → 载入成功并提示跳过了几段。
4. 粘 `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1` → 棋盘复位，`maxPly = 0`，三页显示「单个局面没有历史」。
5. 粘一个坏 FEN → 报错可读，页面没崩。
6. 点 `⬇ PGN` 下载，用文本编辑器打开：七个标签对齐全、走法与步表一致、结尾有结果。

- [ ] **Step 5: 提交**

```bash
git add chess/tools/chess-game-replay.html
git commit -m "feat(chess): PGN 拖入 / FEN 粘贴 / PGN 导出 —— 存档格式就是 PGN"
```

---

## Task 18: 棋局浏览器、注册表与集成验收

**Files:**
- Modify: `chess/tools/chess-game-replay.html`（棋局浏览器）
- Modify: `chess/chess-tools.json`
- Modify: `chess/index.html`

**Interfaces:**
- Consumes: 前 17 个任务的全部产出
- Produces: 阶段 2 的完整交付

- [ ] **Step 1: 棋局浏览器**

`presets` 那一行只放学习路线的 11 局（Task 13）。另外 19 局通过一个浮层进入：

- 面板上一个 `⊞ All 30 games / 全部 30 局` 按钮打开浮层。
- 浮层内容：先是「学习路线」一节（11 张卡片，按 `LEARNING_ROUTE` 顺序，标 1–11），然后按 `GROUP_ORDER` 分六节，每节标题用 `GROUP_LABEL`。
- 每张卡片：`White – Black`、`Event, Date`（三者都从 `GM.headersOf(game)` 取，不是记录上的字段）、`why`（一句话）、`difficulty` 的三点指示、`tags`。
- 点卡片 → `loadGame(id)`、关浮层、并把 `presets` 的高亮同步掉（不在路线里的局面则清掉 preset 高亮，不要让按钮组停在一个已经不成立的选中态）。
- 浮层里给一个搜索框（按棋手名、赛事、tag 过滤，纯前端 `indexOf`）。

- [ ] **Step 2: 注册表**

`chess/chess-tools.json` 追加：

```json
{
  "id": "chess-game-replay",
  "file": "tools/chess-game-replay.html",
  "accent": "emerald",
  "phase": 2,
  "kicker": { "en": "Games", "zh": "棋局" },
  "title": { "en": "Reading a Game", "zh": "读懂一局棋" },
  "desc": {
    "en": "A whole game is one curve in three dimensions. Stand the move number up as a third axis and every piece's life becomes a line: the knight that zig-zagged across nine moves and the bishop that never left its square are suddenly the same kind of object. Thirty games from 1750 to 2017 come with the story of why each one mattered, and the replay stops itself at the moves that decided them. Three curves — material, squares controlled, king safety — run alongside, and the tool tells you exactly how crude each of them is.",
    "zh": "一整局棋就是三维里的一条曲线。把回合数立成第三根轴，每颗子的一生都成了一条线：那只来回折了九步的马，和那只一步没离开原格的象，忽然成了同一类东西。三十局棋从 1750 年到 2017 年，每一局都带着「它为什么重要」的背景故事，回放走到决定胜负的那一步会自己停下来。旁边跑着三条曲线——子力差、控制格数、王的安全度——而工具会明确告诉你它们各自粗糙在哪。"
  },
  "tag": { "en": "30 games · piece traces · evaluation curves · heat map",
           "zh": "30 局棋谱 · 子力轨迹 · 评估曲线 · 热力图" },
  "version": "1.0.0",
  "engine": "chess-1.1.0",
  "changelog": [
    { "version": "1.0.0", "date": "2026-08-02",
      "en": "First release: board / trace / eval / heat tabs, 30 preset games with bilingual stories and auto-pausing key moves, PGN drag-in, FEN paste and PGN export.",
      "zh": "首发：board / trace / eval / heat 四个页签，30 局预置棋谱与双语故事、关键步自动暂停，PGN 拖入、FEN 粘贴与 PGN 导出。" }
  ]
}
```

`chess/index.html` 的内嵌回退列表加同一条（id / file / accent / phase / 双语 kicker+title），并让阶段 2 的分节出现在页面上。

- [ ] **Step 3: 全量验收**

```bash
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py;            echo "chess gate exit=$?"
python3 scripts/sync_registry.py --check;  echo "main registry exit=$?"
node chess/core/replay.test.js
node chess/games/games.test.js
node -e "
const fs=require('fs');
const j=JSON.parse(fs.readFileSync('chess/chess-tools.json','utf8'));
const h=fs.readFileSync('chess/index.html','utf8');
let bad=0;
for(const t of j.tools){
  if(!fs.existsSync('chess/'+t.file)){console.error('文件不存在: '+t.file);bad++;}
  if(h.indexOf(t.id)<0){console.error('index.html 的回退列表缺少: '+t.id);bad++;}
  for(const k of ['kicker','title','desc','tag'])
    if(!t[k].en||!t[k].zh){console.error(t.id+' 的 '+k+' 缺少 en 或 zh');bad++;}
  if(t.engine!=='chess-1.1.0'){console.error(t.id+' 的 engine 不是 chess-1.1.0');bad++;}
}
console.log(bad?('✗ '+bad+' 处问题'):'✓ 注册表与回退一致，双语完整，引擎版本一致');
process.exit(bad?1:0);
"
git status --short
```
Expected: 两个门都 exit 0；两个测试套件通过；注册表校验 `✓`；`git status --short` 列出的每个路径都是本任务应当改的。

- [ ] **Step 4: 浏览器全量验收（请用户看一眼——这是正式验收环节，不是可选项）**

阶段 0/1 里，用户三次截图各抓出一个多轮代码审核都漏掉的问题（相机偏 83°、棋子不随缩放、控件语义错置）。**视觉与交互缺陷，能读代码的东西抓不到。**

逐条走一遍并各截一张图：

1. `/chess/index.html` — 三张卡片，默认 EN，`?lang=zh` 切中文，`file://` 下也能列出三个工具。
2. 工具③ 四个页签各一张图（`board` iso、`trace` side、`eval` side、`heat` top）。
3. 棋局浏览器浮层打开的样子（学习路线一节 + 六个分组）。
4. 一个 keyMove 自动暂停时说明卡片弹出的样子。
5. 载入 `carlsen-nepomniachtchi-2021-g6` 时 `trace` 页的 side 视角（最长棋局的 z 跨度）。
6. 三处**性能读数**：短棋局、中等棋局、272 半步的长棋局各一次，全部 ≤4ms。

- [ ] **Step 5: 提交**

```bash
git add chess/tools/chess-game-replay.html chess/chess-tools.json chess/index.html
git commit -m "feat(chess): 棋局浏览器、工具③ 注册与导航页入口"
```

---

## 阶段 2 完成标准

- [ ] `python3 chess/scripts/check.py` exit 0（内联一致性 + `node --check` + `core/*.test.js` + `games/*.test.js`）
- [ ] `python3 scripts/sync_registry.py --check` exit 0（主站注册表未被打破）
- [ ] `node chess/core/replay.test.js` 通过
- [ ] `node chess/games/games.test.js` 通过 —— **30 局全部逐步重放成功，标签对齐全，keyMoves 都指向它们标注的那一步**
- [ ] 30 局 PGN 往返（`parsePGN → writePGN → parsePGN`）逐步一致
- [ ] F4 录制骨架已从引擎与全部内联副本中删净；`VizEngine.state.dt` 是帧时钟的唯一出处
- [ ] 工具①② 仍然正常（预置局面巡回、播放/暂停），版本已按 §10 升到 1.0.1 / `chess-1.1.0`
- [ ] 工具③ 四个页签在浏览器里逐条通过各自的验收清单
- [ ] 三个规模的棋局绘制耗时均 ≤4ms（分项探针，强制光栅化每帧一次，探针开销单列排除）
- [ ] 默认语言是 EN，切换与 `?lang=` 均生效
- [ ] `chess/index.html` 在 `http://` 与 `file://` 下都能列出三个工具
- [ ] 30 局的 `story` / `why` / `keyMoves` 双语齐全，每一局都记了来源 URL

**下一阶段**：阶段 3（`interp.js` + `interp.test.js` + `debugger.js` + `editor.js`——算法线的地基，本身不产出可见工具，是全项目风险最集中的一段）。
