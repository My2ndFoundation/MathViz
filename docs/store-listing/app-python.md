# Viz Learn Buddy for Python

> MathViz commit **ac34b59** . Counts: 35 pages (tools in python/python-tools.json), 375 programs (sum of `programs`). **Ships first** (design §10, phase 1). App manifest version 1.0.0.
> App `app.primeforge.mathviz.python`, manifest `pfapp/targets/python/manifest.json` (version 1.0.0, `minDesktopVersion` 1.45.0, capabilities `ai`, `addons`, opens in a PrimeForge window 1280 × 820). In-app name (`target.json`): en “Viz Learn Buddy for Python”, zh “Viz Learn Buddy · Python 练习”.
> Remaining ⟦OWNER DECISION⟧ items are open on purpose; see `README.md` §5. Price, billing and separate add-on products are decided (README, "Owner rulings").

## A. Console → Products → Add a product (creation form, field order of `apps/console/app/products/new/page.tsx`)

| # | Field | Value | Notes |
|---|---|---|---|
| 1 | Product ID (optional) | `mathviz-python-buyout` *(suggestion)* | Blank would derive `python-buyout` (`deriveProductId` takes only the **last** segment of the app id, so all four MathViz targets would get bare `math-…`/`python-…` ids). Never shown to buyers; cannot change after creation (orders reference it). |
| 2 | Kind | **App product (unlocks apps)** | Set once, never changed. On the product page → **Unlocked add-ons** leave `app.primeforge.mathviz.python/content` **unticked**: the content pack is its own add-on product (owner ruling 2026-11-07). |
| 3 | App ID * | `app.primeforge.mathviz.python` | Must already be in the published catalogue: `publish:app` the app first. |
| 4 | Name * | Viz Learn Buddy for Python (26 chars; limit 200) | The store has **one** name field, no Chinese variant. |
| 5 | Description (plain text box) | Paste the first paragraph below, as plain text: “Viz Learn Buddy for Python is a Python practice app: worked programs that you read line by line, fill in where lines have been blanked out, and trace by typing them out yourself.” (178 chars) | This box writes the product's **English** content description (`apps/api/src/store/admin-api.ts:254-257`); the full Markdown descriptions go in section B and overwrite it. Optional. |
| 6 | Price (GBP pence) * | **`0`** (free) | Owner ruling 2026-11-07: all eight products are free. |
| 7 | Payment channels | None (free) | A free product needs no payment channel. |
| 8 | Billing | **Buyout** | Subscription would need a Stripe price ID, a renewal interval and a price above 0. |
| 9 | Stripe price ID | — (buyout) | Subscription only. |
| 10 | Renewal interval | None (buyout) | Subscription only. |

After creation, on the product page (not part of the owner's list, but present in the console — leave for the owner): **Visibility** ⟦OWNER DECISION, Public / Unlisted / Restricted⟧, **Listing** (Listed for sale / Withdrawn), **Category** ⟦OWNER DECISION: which store category; categories are created under Console → Categories⟧, **Trial days** (subscriptions only).

## B. Listing (Console → product → Content)

Slots and limits (PrimeForge-Server console content editor, `apps/console/app/products/[id]/content/content-editor.tsx:36-39,243,260` and `packages/i18n/messages/en.json:1294-1325`): Name 1–200 chars · Icon PNG 512 × 512 ≤ 2 MB · Main image PNG/JPEG/WebP exactly 16:9, 1280 × 720 – 3840 × 2160, ≤ 10 MB · Gallery ≤ 30 items, PNG/JPEG/WebP ≤ 10 MB or MP4 ≤ 200 MB, **the first item is the cover** · Description and Quick start Markdown, EN + zh-CN, ≤ 20,000 chars each.

### B1. Logo (Icon slot)

- **Existing asset — no design work.** `pfapp/targets/python/icon.svg`: SVG, 128 × 128 viewBox, square full-bleed `#05070d` ground, the M/V mark with its sine curve in `#34d399` (emerald), no text, ~1.9 KB; written by `bun run icons` (`pfapp/scripts/icons.ts`) from `docs/logo.png` (sha256 pinned in `docs/brand-assets.json`). It is also the package's `art.icon`, which the store falls back to with no uploaded icon (`apps/store/lib/store-api.ts:35`).
- The store Icon slot takes a PNG of exactly **512 × 512**, ≤ 2 MB, nothing resized (PrimeForge-Server `packages/i18n/messages/en.json:1296`); SVG is refused. Conversion: `rsvg-convert -w 512 -h 512 pfapp/targets/python/icon.svg -o python-512.png`.

### B2. Image skill inputs

The three PrimeForge-Desktop skills (`.claude/skills/store-main-image`, `store-cover-image`, `store-gallery-image`) make the main image, cover and gallery themselves; what each needs and whether it exists is in `README.md` §3. The text inputs, in each skill's own format:

**store-main-image** (1920 × 1080 PNG, no words):

| Input (store-main-image “Inputs to gather”) | Value |
|---|---|
| Product name | Viz Learn Buddy for Python |
| One-line selling point | Read, fill in and trace real Python programs |
| Type | **app** |
| Square logo / icon | `assets/logos/mathviz/python.svg` (to be copied from MathViz `pfapp/targets/python/icon.svg`, B1) |
| Brand colours (read from that SVG) | `#05070d` ground, `#34d399` accent. For the ground's depth, the design system's own radial pair `#0c1526` → `#05070d` (`design-system/math-viz-design-system.md:33-34`) |
| Output folder | `assets/main-images/mathviz/` → `python.svg`, `python-1920x1080.png` |

**store-cover-image** (one `COVERS` entry in `assets/covers/make.py`; 1920 × 1080 PNG; upload first in the gallery):

```python
dict(folder="mathviz", name="python", ground="../main-images/mathviz/python-1920x1080.png", logo="../logos/mathviz/python-512.png", theme={"fg": "#e2e8f0", "muted": "#9fb0c8", "accent": "#34d399"},
     title=['Viz Learn Buddy', 'for Python'], pitch=['Read, fill in and trace', 'real Python programs'],
     points=['375 programs on 35 pages', 'Hints that keep answers hidden', 'Notes stay on your computer']),
```

- Counts: title “Viz Learn Buddy” (15), “for Python” (10); pitch “Read, fill in and trace” (23), “real Python programs” (20) (≈25 per line); points “375 programs on 35 pages” (24), “Hints that keep answers hidden” (30), “Notes stay on your computer” (27) (≤ ≈32).
- Words checked against: python/python-tools.json at ac34b59 (35 tools, sum of programs = 375); python/core/interact.js STR modeRead/modeBlank/modeTrace; pfapp/app/src/lib/ai/context.ts rules + lib/ai/leak.ts; notes in SQLite (pfapp/app/src/lib/db/schema.ts).

**store-gallery-image** (1920 × 1080 PNGs; the skill decides the story): shoot **Viz Learn Buddy for Python 1.0.0** with this pack's published version, interface **English**. Headline claims the code supports, with the screen that proves each (≤ ≈35 chars):

- “Read a program, line by line” (28 chars) — shown by: py-sorting in *Read* mode, the merge-sort program open with its line notes visible; the ask panel closed. Clip to the editor and the notes column.
- “Fill in the lines it hides” (26 chars) — shown by: py-linked-list in *Fill in* mode: one blank answered correctly (green *Correct*), the next with a wrong token and the message “token #2 differs: expected …, you wrote …”. Clip to the editor.
- “Trace it, key by key” (20 chars) — shown by: py-graphs in *Trace* mode with *Shadow* at *Faint 35%*, half the BFS program typed, accuracy and chars/min showing.
- “A hint that keeps the answer hidden” (35 chars) — shown by: py-sorting in *Fill in* mode with a blank focused; the ask panel open showing *Program: …* / *blank …*, the student's “Could I have a hint for blank …?” and one tutor hint that does not contain the line. Beside a 2–3 line headline (narrow panel). *(AI text on that screen would be seed-written)*
- “Ask the whole library” (21 chars) — shown by: *Ask the whole library* with one question (e.g. “How does binary search keep its invariant?”, the page's own placeholder) and an answer whose *From the library* links name two or three real programs. *(AI text on that screen would be seed-written)*
- “Notes you can come back to” (26 chars) — shown by: *Notes*: the two-column page with four or five saved conversations in the list (programs from different modules) and one open on the right with its follow-up box. *(AI text on that screen would be seed-written)*
- “375 programs in 8 modules” (25 chars) — shown by: The sidebar fully expanded beside a page: the eight module groups with their pages and version numbers; ⌘K closed.

### B3. Description — English (Markdown; ≤ 20,000 chars; this text: 3218 chars)

First paragraph = the store card excerpt (cut at 200): 178 chars — fits.

```markdown
**Viz Learn Buddy for Python** is a Python practice app: worked programs that you read line by line, fill in where lines have been blanked out, and trace by typing them out yourself.

### What it does

- **Three modes for every program.** *Read* shows the whole program with notes on each line. *Fill in* hides some lines: type them back and *Check* tells you which token differs and why. *Trace* has you type the program over a shadow of itself, with your accuracy and speed shown.
- **375 programs on 35 pages, in 8 modules:** Language Foundations, Control Flow, Data Structures, Algorithms & Analysis, Applied Projects, Scientific Computing (NumPy, pandas, matplotlib), Graphics & Games (pygame) and Embedded Python (micro:bit, Raspberry Pi Pico).
- **Hints a step at a time.** Each blank has its own hints, each giving a little more than the one before. *Fill it in* shows the answer when you want it; that blank then is not counted as done.
- **Filters.** Narrow a page's programs by level, kind, length and exam board (AQA, OCR, Edexcel, CIE).
- **A tutor that knows where you are.** The ask panel knows which program, mode and blank you have open. In *Fill in* and *Trace* it will not write out a line you have not filled in yet, and *Get a hint* asks it for a hint on the blank you are in. In *Read* mode, or once you have pressed *Fill it in*, it can discuss the whole program.
- **An AI tutor beside every page.** Open the ask panel next to a page and ask about it. Answers come back in one piece after a few seconds, and you can cancel a question that is still waiting.
- **Ask the whole library.** Ask one question across every page and program in the app; the answer links to the programs it drew on.
- **Notes.** Save any answer as a note. The *Notes* page lists your saved conversations, with search, a filter by group, and a box to ask a follow-up.
- **Find a page fast.** The sidebar groups the pages as the website does and shows each page's version; ⌘K (Ctrl+K) filters by title or tag.
- **English and Chinese.** Switch the interface language at any time, and choose the language the tutor answers in.
- **Real Python.** The programs are ordinary Python files, checked with Python itself when the pages are built. Python is not run inside the app: your typing is compared with the program's source.

### What you need

- **PrimeForge Desktop 1.45.0 or newer.**
- **The content pack.** The app holds no programs itself: they come in *Viz Learn Buddy for Python: Content Pack*, an add-on of this app in the store. The first time you open the app it offers to install it (*Install from the store*); you can also do it later in *Settings → Content pack*.
- **An AI engine in PrimeForge** for the tutor: Claude, or Codex if you grant it to this app. The pages themselves work without one.

### Good to know

- Once the content pack is installed, the pages open from your computer; no internet connection is needed to use them.
- Your notes, conversations and settings are kept on your computer, in the app's own data. A question you ask is sent to the AI engine you use in PrimeForge.
- The app opens in its own PrimeForge window. The pages are the same ones published on the MathViz website, unchanged.
```

### B4. Description — 中文（Markdown；≤ 20,000 字符；本文 1387 字符）

第一段 = 商店卡片摘要（200 字符截断）：79 字符，不会被截断。

```markdown
**Viz Learn Buddy for Python** 是一款 Python 练习应用：一段段写好的程序，你可以逐行阅读、把挖掉的行补回去，或者照着自己敲一遍。

### 主要功能

- **每个程序三种练法。** *读*：显示整个程序和逐行注释。*挖空*：挖掉几行，你把它们写回去，点 *检查* 会告诉你从第几个 token 开始不同、为什么不同。*临摹*：在程序的影子上一个键一个键地敲，同时显示正确率和速度。
- **35 页、375 个程序，分 8 个模块**：语言基础、控制逻辑、数据结构、算法分析、综合运用、科学计算与数理统计（NumPy、pandas、matplotlib）、图形与游戏（pygame）、嵌入式 Python（micro:bit、树莓派 Pico）。
- **提示一级一级给。** 每个空都有自己的提示，每一级比上一级多说一点。想看答案时点 *填进去*，这个空就不计入完成。
- **筛选。** 按难度、类型、长度和考试局（AQA、OCR、Edexcel、CIE）筛选一页里的程序。
- **知道你在做哪一题的辅导。** 提问面板知道你打开的是哪个程序、哪种模式、哪个空。在 *挖空* 和 *临摹* 模式下，它不会写出你还没填的那一行；点 *要一条提示*，它就针对你所在的空给一条提示。在 *读* 模式下，或者你点过 *填进去* 之后，它可以讨论整个程序。
- **每一页旁边都有 AI 辅导。** 打开页面旁的提问面板，就这一页提问。回答会在几秒钟后一次给出；还在排队的问题可以取消。
- **问整个库。** 一个问题问遍应用里的所有页面和程序，回答里会链接到它参考过的程序。
- **笔记。** 任何一条回答都可以存为笔记。*笔记* 页列出你保存的对话，可以搜索、按分组筛选，也可以接着追问。
- **快速找到页面。** 侧栏按网站的分组排列页面，并显示每一页的版本号；按 ⌘K（Ctrl+K）可按标题或标签筛选。
- **中英双语。** 界面语言随时切换，AI 辅导用哪种语言回答也可以单独设定。
- **真正的 Python。** 程序都是普通的 Python 文件，在生成页面时用 Python 本身检查过。应用里不运行 Python：你写的内容是和程序源码逐个 token 对照的。

### 使用需要

- **PrimeForge Desktop 1.45.0 或更新版本。**
- **内容包。** 应用本身不含程序，它们在本应用的商店附加内容 *Viz Learn Buddy for Python: Content Pack* 里。第一次打开应用时会提示安装（点 *从商店安装*），以后也可以在 *设置 → 内容包* 里安装或更新。
- **PrimeForge 里的 AI 引擎**（用于 AI 辅导）：Claude；或者把 Codex 授权给本应用。不开 AI，页面本身照样能用。

### 说明

- 内容包装好之后，页面从你的电脑上打开，使用时不需要联网。
- 笔记、对话和设置都保存在你的电脑上（应用自己的数据目录里）。你提的问题会交给你在 PrimeForge 里使用的 AI 引擎来回答。
- 应用在 PrimeForge 自己的窗口里打开。页面与 MathViz 网站上发布的页面完全相同，没有改动。
```

### One-line summaries (where the code shows them)

- Store home card / product page excerpt: the first paragraph of B3/B4 (`apps/store/lib/description.ts:22,50`, `EXCERPT_MAX = 200`). No separate field.
- The app itself has no separate summary field; the catalogue name comes from the manifest (`Viz Learn Buddy for Python`).

### B5. Quick start (optional — in the console, not in the owner's list; shown after purchase and on the store page; Markdown, ≤20,000 chars per language)

English (1012 chars):

```markdown
### Getting started

1. **Install the content pack.** The first time you open the app it says no content pack is installed: press *Install from the store*. You can also do it in *Settings → Content pack → In the PrimeForge store*.
2. **Allow an AI engine for this app** in PrimeForge Desktop: Claude, or grant it Codex. The *AI* button at the top of the window shows whether the tutor is connected; click it to see or cancel questions in progress.
3. **Pick a page** in the sidebar, or press ⌘K (Ctrl+K) and type part of a title or tag.
4. **Choose a program and a mode:** *Read*, *Fill in* or *Trace*. In *Fill in*, click into a blank, and press *Get a hint* in the ask panel when you are stuck.
5. **Ask a question** in the ask panel beside the page. Under any answer, *Save as note* keeps it; find it later under *Notes*.
6. **Ask the whole library** (bottom of the sidebar) for a question that spans several pages.
7. **Languages:** *Settings → General* sets the interface language and the AI reply language.
```

中文（430 字符）：

```markdown
### 快速上手

1. **安装内容包。** 第一次打开应用时会提示还没有安装内容包：点 *从商店安装*。也可以在 *设置 → 内容包 → PrimeForge 商店* 里安装。
2. **在 PrimeForge Desktop 里给本应用开启 AI 引擎**：Claude，或者授权 Codex。窗口顶部的 *AI* 按钮显示辅导是否已连接；点开可以查看或取消正在进行的提问。
3. **选一页**：在侧栏里点，或者按 ⌘K（Ctrl+K）输入标题或标签的一部分。
4. **选一个程序和一种模式**：*读*、*挖空* 或 *临摹*。在 *挖空* 模式下点进一个空，卡住时在提问面板里点 *要一条提示*。
5. **提问**：在页面旁的提问面板里问。任何一条回答下面点 *存为笔记* 就能保存，之后在 *笔记* 里找到。
6. **问整个库**（侧栏底部）：适合跨好几页的问题。
7. **语言**：*设置 → 通用* 里设定界面语言和 AI 回复语言。
```
