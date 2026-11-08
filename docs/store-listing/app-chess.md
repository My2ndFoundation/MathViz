# Viz Learn Buddy for Chess

> MathViz commit **ac34b59** . Counts: 5 pages (chess/chess-tools.json). Follows python (design §10, phase 2). App manifest version 0.1.0.
> App `app.primeforge.mathviz.chess`, manifest `pfapp/targets/chess/manifest.json` (version 0.1.0, `minDesktopVersion` 1.45.0, capabilities `ai`, `addons`, opens in a PrimeForge window 1280 × 820). In-app name (`target.json`): en “Viz Learn Buddy for Chess”, zh “Viz Learn Buddy · 国际象棋算法”.
> Remaining ⟦OWNER DECISION⟧ items are open on purpose; see `README.md` §5. Price, billing and separate add-on products are decided (README, "Owner rulings").

## A. Console → Products → Add a product (creation form, field order of `apps/console/app/products/new/page.tsx`)

| # | Field | Value | Notes |
|---|---|---|---|
| 1 | Product ID (optional) | `mathviz-chess-buyout` *(suggestion)* | Blank would derive `chess-buyout` (`deriveProductId` takes only the **last** segment of the app id, so all four MathViz targets would get bare `math-…`/`python-…` ids). Never shown to buyers; cannot change after creation (orders reference it). |
| 2 | Kind | **App product (unlocks apps)** | Set once, never changed. On the product page → **Unlocked add-ons** leave `app.primeforge.mathviz.chess/content` **unticked**: the content pack is its own add-on product (owner ruling 2026-11-07). |
| 3 | App ID * | `app.primeforge.mathviz.chess` | Must already be in the published catalogue: `publish:app` the app first. |
| 4 | Name * | Viz Learn Buddy for Chess (25 chars; limit 200) | The store has **one** name field, no Chinese variant. |
| 5 | Description (plain text box) | Paste the first paragraph below, as plain text: “Viz Learn Buddy for Chess looks at chess through geometry, search and algorithms: five interactive pages, from how the pieces move to how a program searches a game tree.” (169 chars) | This box writes the product's **English** content description (`apps/api/src/store/admin-api.ts:254-257`); the full Markdown descriptions go in section B and overwrite it. Optional. |
| 6 | Price (GBP pence) * | **`0`** (free) | Owner ruling 2026-11-07: all eight products are free. |
| 7 | Payment channels | None (free) | A free product needs no payment channel. |
| 8 | Billing | **Buyout** | Subscription would need a Stripe price ID, a renewal interval and a price above 0. |
| 9 | Stripe price ID | — (buyout) | Subscription only. |
| 10 | Renewal interval | None (buyout) | Subscription only. |

After creation, on the product page (not part of the owner's list, but present in the console — leave for the owner): **Visibility** ⟦OWNER DECISION, Public / Unlisted / Restricted⟧, **Listing** (Listed for sale / Withdrawn), **Category** ⟦OWNER DECISION: which store category; categories are created under Console → Categories⟧, **Trial days** (subscriptions only).

## B. Listing (Console → product → Content)

Slots and limits (PrimeForge-Server console content editor, `apps/console/app/products/[id]/content/content-editor.tsx:36-39,243,260` and `packages/i18n/messages/en.json:1294-1325`): Name 1–200 chars · Icon PNG 512 × 512 ≤ 2 MB · Main image PNG/JPEG/WebP exactly 16:9, 1280 × 720 – 3840 × 2160, ≤ 10 MB · Gallery ≤ 30 items, PNG/JPEG/WebP ≤ 10 MB or MP4 ≤ 200 MB, **the first item is the cover** · Description and Quick start Markdown, EN + zh-CN, ≤ 20,000 chars each.

### B1. Logo (Icon slot)

- **Existing asset — no design work.** `pfapp/targets/chess/icon.svg`: SVG, 128 × 128 viewBox, square full-bleed `#05070d` ground, the M/V mark with its sine curve in `#a78bfa` (violet), no text, ~1.9 KB; written by `bun run icons` (`pfapp/scripts/icons.ts`) from `docs/logo.png` (sha256 pinned in `docs/brand-assets.json`). It is also the package's `art.icon`, which the store falls back to with no uploaded icon (`apps/store/lib/store-api.ts:35`).
- The store Icon slot takes a PNG of exactly **512 × 512**, ≤ 2 MB, nothing resized (PrimeForge-Server `packages/i18n/messages/en.json:1296`); SVG is refused. Conversion: `rsvg-convert -w 512 -h 512 pfapp/targets/chess/icon.svg -o chess-512.png`.

### B2. Image skill inputs

The three PrimeForge-Desktop skills (`.claude/skills/store-main-image`, `store-cover-image`, `store-gallery-image`) make the main image, cover and gallery themselves; what each needs and whether it exists is in `README.md` §3. The text inputs, in each skill's own format:

**store-main-image** (1920 × 1080 PNG, no words):

| Input (store-main-image “Inputs to gather”) | Value |
|---|---|
| Product name | Viz Learn Buddy for Chess |
| One-line selling point | Chess as geometry, search and algorithms |
| Type | **app** |
| Square logo / icon | `assets/logos/mathviz/chess.svg` (to be copied from MathViz `pfapp/targets/chess/icon.svg`, B1) |
| Brand colours (read from that SVG) | `#05070d` ground, `#a78bfa` accent. For the ground's depth, the design system's own radial pair `#0c1526` → `#05070d` (`design-system/math-viz-design-system.md:33-34`) |
| Output folder | `assets/main-images/mathviz/` → `chess.svg`, `chess-1920x1080.png` |

**store-cover-image** (one `COVERS` entry in `assets/covers/make.py`; 1920 × 1080 PNG; upload first in the gallery):

```python
dict(folder="mathviz", name="chess", ground="../main-images/mathviz/chess-1920x1080.png", logo="../logos/mathviz/chess-512.png", theme={"fg": "#e2e8f0", "muted": "#9fb0c8", "accent": "#a78bfa"},
     title=['Viz Learn Buddy', 'for Chess'], pitch=['Chess as geometry,', 'search and algorithms'],
     points=['5 pages, rules to search', '30 games from 1750 to 2017', 'Source code beside the board']),
```

- Counts: title “Viz Learn Buddy” (15), “for Chess” (9); pitch “Chess as geometry,” (18), “search and algorithms” (21) (≈25 per line); points “5 pages, rules to search” (24), “30 games from 1750 to 2017” (26), “Source code beside the board” (28) (≤ ≈32).
- Words checked against: chess/chess-tools.json at ac34b59 (5 tools; desc of chess-game-replay: 30 games 1750–2017; chess-search-minimax and chess-board-algorithms: source stepping).

**store-gallery-image** (1920 × 1080 PNGs; the skill decides the story): shoot **Viz Learn Buddy for Chess 0.1.0** with this pack's published version, interface **English**. Headline claims the code supports, with the screen that proves each (≤ ≈35 chars):

- “A piece is a set of vectors” (27 chars) — shown by: *Geometry of Movement* (chess-moves-geometry) with a knight on d4 and the minimum-move field stood up as columns.
- “Thirty games, one line per piece” (32 chars) — shown by: *Reading a Game* (chess-game-replay) with a game loaded and the piece traces drawn along the move axis; the evaluation curves visible.
- “Watch alpha-beta prune the tree” (31 chars) — shown by: *Game Trees and Search* (chess-search-minimax) stopped on `if (beta <= alpha) break;` with a limb collapsed in the tree.
- “Classic problems, step by step” (30 chars) — shown by: *Classic Problems on the Board* (chess-board-algorithms) on N-Queens mid-backtrack, source on the left, board and depth tower on the right.
- “Ask about the page you're on” (28 chars) — shown by: *Rules, Legality and Mate* with the ask panel open, one question about pins and one tutor answer. Narrow panel beside a 2–3 line headline. *(AI text on that screen would be seed-written)*
- “Keep answers as notes” (21 chars) — shown by: *Notes* with three or four saved conversations from different pages, one open. *(AI text on that screen would be seed-written)*

### B3. Description — English (Markdown; ≤ 20,000 chars; this text: 2703 chars)

First paragraph = the store card excerpt (cut at 200): 169 chars — fits.

```markdown
**Viz Learn Buddy for Chess** looks at chess through geometry, search and algorithms: five interactive pages, from how the pieces move to how a program searches a game tree.

### What it does

- **Geometry of Movement.** Each piece as a set of vectors: place one anywhere to see its attack domain, then stand the minimum-move field up as a third axis.
- **Rules, Legality and Mate.** Pseudo-legal and legal moves drawn at once in two colours, so a pin is the difference between them; castling's four conditions each get their own indicator.
- **Reading a Game.** Thirty games from 1750 to 2017, each with the story of why it mattered. With the move number as a third axis, every piece's life becomes a line, and curves for material, squares controlled and king safety run alongside.
- **Game Trees and Search.** The source of minimax and alpha-beta steps line by line on one side while the game tree it builds grows on the other.
- **Classic Problems on the Board.** Nine problems, from N-Queens and the Knight's Tour to bitboards, each with its source code stepping beside a real board.
- **An AI tutor beside every page.** Open the ask panel next to a page and ask about it. Answers come back in one piece after a few seconds, and you can cancel a question that is still waiting.
- **Ask the whole library.** Ask one question across every page in the app; the answer links to the pages it drew on.
- **Notes.** Save any answer as a note. The *Notes* page lists your saved conversations, with search, a filter by group, and a box to ask a follow-up.
- **Find a page fast.** The sidebar groups the pages as the website does and shows each page's version; ⌘K (Ctrl+K) filters by title or tag.
- **English and Chinese.** Switch the interface language at any time, and choose the language the tutor answers in.

### What you need

- **PrimeForge Desktop 1.45.0 or newer.**
- **The content pack.** The app holds no pages itself: they come in *Viz Learn Buddy for Chess: Content Pack*, an add-on of this app in the store. The first time you open the app it offers to install it (*Install from the store*); you can also do it later in *Settings → Content pack*.
- **An AI engine in PrimeForge** for the tutor: Claude, or Codex if you grant it to this app. The pages themselves work without one.

### Good to know

- Once the content pack is installed, the pages open from your computer; no internet connection is needed to use them.
- Your notes, conversations and settings are kept on your computer, in the app's own data. A question you ask is sent to the AI engine you use in PrimeForge.
- The app opens in its own PrimeForge window. The pages are the same ones published on the MathViz website, unchanged.
```

### B4. Description — 中文（Markdown；≤ 20,000 字符；本文 1114 字符）

第一段 = 商店卡片摘要（200 字符截断）：71 字符，不会被截断。

```markdown
**Viz Learn Buddy for Chess** 从几何、搜索和算法的角度看国际象棋：五个可交互的页面，从棋子怎么走，到程序怎么搜索博弈树。

### 主要功能

- **走法的几何本质。** 每个棋子都是一组向量：把它放在任意一格，看它的攻击范围；再把「最少步数场」立起来当第三个轴。
- **规则、合法性与将杀。** 伪合法着法和合法着法用两种颜色同时画出，两者之差正是牵制；王车易位的四个条件各有一个指示灯。
- **读懂一局棋。** 1750 到 2017 年的三十局棋，每局都讲了它为什么重要。把着数立成第三个轴，每个棋子的一生就是一条线；子力、控制格数和王的安全三条曲线同步显示。
- **博弈树与搜索。** 一边逐行执行 minimax 与 alpha-beta 的源码，另一边是它正在长出的博弈树。
- **棋盘上的经典算法。** 九个问题，从 N 皇后、骑士巡游到位棋盘，每个都是源码一步步执行，旁边是一张真实的棋盘。
- **每一页旁边都有 AI 辅导。** 打开页面旁的提问面板，就这一页提问。回答会在几秒钟后一次给出；还在排队的问题可以取消。
- **问整个库。** 一个问题问遍应用里的所有页面，回答里会链接到它参考过的页面。
- **笔记。** 任何一条回答都可以存为笔记。*笔记* 页列出你保存的对话，可以搜索、按分组筛选，也可以接着追问。
- **快速找到页面。** 侧栏按网站的分组排列页面，并显示每一页的版本号；按 ⌘K（Ctrl+K）可按标题或标签筛选。
- **中英双语。** 界面语言随时切换，AI 辅导用哪种语言回答也可以单独设定。

### 使用需要

- **PrimeForge Desktop 1.45.0 或更新版本。**
- **内容包。** 应用本身不含页面，它们在本应用的商店附加内容 *Viz Learn Buddy for Chess: Content Pack* 里。第一次打开应用时会提示安装（点 *从商店安装*），以后也可以在 *设置 → 内容包* 里安装或更新。
- **PrimeForge 里的 AI 引擎**（用于 AI 辅导）：Claude；或者把 Codex 授权给本应用。不开 AI，页面本身照样能用。

### 说明

- 内容包装好之后，页面从你的电脑上打开，使用时不需要联网。
- 笔记、对话和设置都保存在你的电脑上（应用自己的数据目录里）。你提的问题会交给你在 PrimeForge 里使用的 AI 引擎来回答。
- 应用在 PrimeForge 自己的窗口里打开。页面与 MathViz 网站上发布的页面完全相同，没有改动。
```

### One-line summaries (where the code shows them)

- Store home card / product page excerpt: the first paragraph of B3/B4 (`apps/store/lib/description.ts:22,50`, `EXCERPT_MAX = 200`). No separate field.
- The app itself has no separate summary field; the catalogue name comes from the manifest (`Viz Learn Buddy for Chess`).

### B5. Quick start (optional — in the console, not in the owner's list; shown after purchase and on the store page; Markdown, ≤20,000 chars per language)

English (1059 chars):

```markdown
### Getting started

1. **Install the content pack.** The first time you open the app it says no content pack is installed: press *Install from the store*. You can also do it in *Settings → Content pack → In the PrimeForge store*.
2. **Allow an AI engine for this app** in PrimeForge Desktop: Claude, or grant it Codex. The *AI* button at the top of the window shows whether the tutor is connected; click it to see or cancel questions in progress.
3. **Pick a page** in the sidebar, or press ⌘K (Ctrl+K) and type part of a title or tag.
4. **Work through the phases in order:** the rules pages first, then *Reading a Game*, then search and the classic problems. On the code pages, step through the source and watch the board or tree beside it.
5. **Ask a question** in the ask panel beside the page. Under any answer, *Save as note* keeps it; find it later under *Notes*.
6. **Ask the whole library** (bottom of the sidebar) for a question that spans several pages.
7. **Languages:** *Settings → General* sets the interface language and the AI reply language.
```

中文（432 字符）：

```markdown
### 快速上手

1. **安装内容包。** 第一次打开应用时会提示还没有安装内容包：点 *从商店安装*。也可以在 *设置 → 内容包 → PrimeForge 商店* 里安装。
2. **在 PrimeForge Desktop 里给本应用开启 AI 引擎**：Claude，或者授权 Codex。窗口顶部的 *AI* 按钮显示辅导是否已连接；点开可以查看或取消正在进行的提问。
3. **选一页**：在侧栏里点，或者按 ⌘K（Ctrl+K）输入标题或标签的一部分。
4. **按阶段顺序来**：先看规则两页，再看 *读懂一局棋*，然后是搜索和经典算法。在带源码的页面上一步步执行，看旁边的棋盘或博弈树怎么变。
5. **提问**：在页面旁的提问面板里问。任何一条回答下面点 *存为笔记* 就能保存，之后在 *笔记* 里找到。
6. **问整个库**（侧栏底部）：适合跨好几页的问题。
7. **语言**：*设置 → 通用* 里设定界面语言和 AI 回复语言。
```
