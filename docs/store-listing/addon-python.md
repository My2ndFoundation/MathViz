# Viz Learn Buddy for Python: Content Pack

> MathViz commit **ac34b59** . Counts: 35 pages (tools in python/python-tools.json), 375 programs (sum of `programs`). **Ships first** (design §10, phase 1). App manifest version 1.0.0.
> Content add-on `app.primeforge.mathviz.python/content` of **Viz Learn Buddy for Python** (`app.primeforge.mathviz.python`). `addon.json` is written by PrimeForge-Desktop `scripts/build-mathviz-addon.ts`: `kind: "content"`, title “Viz Learn Buddy for Python content”, first version `1.0.0`, `minAppVersion` = the app manifest's version (1.0.0 today) (`docs/build-manual.md:880-920`).
> Remaining ⟦OWNER DECISION⟧ items are open on purpose; see `README.md` §5. Price, billing and separate add-on products are decided (README, "Owner rulings").

## A. Console → Products → Add a product (creation form, field order of `apps/console/app/products/new/page.tsx`)

| # | Field | Value | Notes |
|---|---|---|---|
| 1 | Product ID (optional) | `mathviz-python-addon-buyout` *(suggestion)* | Blank would derive `python-addon-buyout` (`deriveProductId` takes only the **last** segment of the app id, so all four MathViz targets would get bare `math-…`/`python-…` ids). Never shown to buyers; cannot change after creation (orders reference it). |
| 2 | Kind | **Add-on product (unlocks add-ons of one app)** | Set once, never changed. The buyer needs the app already. After creating it, on the product page → **Unlocked add-ons**, tick `app.primeforge.mathviz.python/content` (the only add-on of this app). |
| 3 | App ID * | `app.primeforge.mathviz.python` | Must already be in the published catalogue: `publish:app` the app first (and `publish:addon` the pack before ticking it). |
| 4 | Name * | Viz Learn Buddy for Python: Content Pack (40 chars; limit 200) | The store has **one** name field, no Chinese variant. |
| 5 | Description (plain text box) | Paste the first paragraph below, as plain text: “The 35 practice pages and 375 programs of Viz Learn Buddy for Python. This content pack is what the app shows: install it to use the app, which holds no programs of its own.” (173 chars) | This box writes the product's **English** content description (`apps/api/src/store/admin-api.ts:254-257`); the full Markdown descriptions go in section B and overwrite it. Optional. |
| 6 | Price (GBP pence) * | **`0`** (free) | Owner ruling 2026-11-07: all eight products are free. |
| 7 | Payment channels | None (free) | A free product needs no payment channel. |
| 8 | Billing | **Buyout** | Subscription would need a Stripe price ID, a renewal interval and a price above 0. |
| 9 | Stripe price ID | — (buyout) | Subscription only. |
| 10 | Renewal interval | None (buyout) | Subscription only. |

After creation, on the product page (not part of the owner's list, but present in the console — leave for the owner): **Visibility** ⟦OWNER DECISION, Public / Unlisted / Restricted⟧, **Listing** (Listed for sale / Withdrawn), **Category** ⟦OWNER DECISION: which store category; categories are created under Console → Categories⟧, **Trial days** (subscriptions only).

## B. Listing (Console → product → Content)

Slots and limits (PrimeForge-Server console content editor, `apps/console/app/products/[id]/content/content-editor.tsx:36-39,243,260` and `packages/i18n/messages/en.json:1294-1325`): Name 1–200 chars · Icon PNG 512 × 512 ≤ 2 MB · Main image PNG/JPEG/WebP exactly 16:9, 1280 × 720 – 3840 × 2160, ≤ 10 MB · Gallery ≤ 30 items, PNG/JPEG/WebP ≤ 10 MB or MP4 ≤ 200 MB, **the first item is the cover** · Description and Quick start Markdown, EN + zh-CN, ≤ 20,000 chars each.

### B1. Logo (Icon slot)

- **Existing asset — no design work.** The store Icon slot takes a PNG of exactly **512 × 512**, ≤ 2 MB, nothing resized (PrimeForge-Server `packages/i18n/messages/en.json:1296`); SVG is refused (`console.content.error.svg_refused`).
- Source: the parent app's `pfapp/targets/python/icon.svg` (128 × 128 viewBox, square full-bleed `#05070d` ground, the M/V mark in `#34d399`, no text; written by `pfapp/scripts/icons.ts` from `docs/logo.png` via `docs/brand-assets.json`).
- Conversion: `rsvg-convert -w 512 -h 512 pfapp/targets/python/icon.svg -o python-content-512.png`.
- ⟦OWNER DECISION⟧ whether the pack's icon is that file unchanged or, following Math Test Buddy's packs (`PrimeForge-Desktop/assets/addon-icons/mathtestbuddy/README.md`), the app icon with the red ADD-ON ribbon. The image skills expect an add-on icon at `assets/addon-icons/mathviz/python-content.svg` either way (README §3).

### B2. Image skill inputs

The three PrimeForge-Desktop skills (`.claude/skills/store-main-image`, `store-cover-image`, `store-gallery-image`) make the main image, cover and gallery themselves; what each needs and whether it exists is in `README.md` §3. The text inputs, in each skill's own format:

**store-main-image** (1920 × 1080 PNG, no words, ADD-ON tag):

| Input (store-main-image “Inputs to gather”) | Value |
|---|---|
| Product name | Viz Learn Buddy for Python: Content Pack |
| One-line selling point | All of Viz Learn Buddy for Python's 35 pages, in one pack |
| Type | **add-on**, parent app Viz Learn Buddy for Python |
| Square logo / icon | `assets/addon-icons/mathviz/python-content.svg` (to be created, B1) |
| Brand colours (read from that SVG) | `#05070d` ground, `#34d399` accent. For the ground's depth, the design system's own radial pair `#0c1526` → `#05070d` (`design-system/math-viz-design-system.md:33-34`) |
| Output folder | `assets/main-images/mathviz/` → `python-content.svg`, `python-content-1920x1080.png` |

**store-cover-image** (one `COVERS` entry in `assets/covers/make.py`; 1920 × 1080 PNG; upload first in the gallery):

```python
dict(folder="mathviz", name="python-content", ground="../main-images/mathviz/python-content-1920x1080.png", logo="../addon-icons/mathviz/python-content-512.png", theme={"fg": "#e2e8f0", "muted": "#9fb0c8", "accent": "#34d399"}, addon="Viz Learn Buddy for Python",
     title=['Python', 'Content Pack'], pitch=['35 pages, 375 programs'],
     points=['8 modules, basics to embedded', 'Read, fill-in and trace modes', 'The pages the app needs']),
```

- Counts: title “Python” (6), “Content Pack” (12); pitch “35 pages, 375 programs” (22) (≈25 per line); points “8 modules, basics to embedded” (29), “Read, fill-in and trace modes” (29), “The pages the app needs” (23) (≤ ≈32).
- Words checked against: 35 pages (tools in python/python-tools.json), 375 programs (sum of `programs`) at ac34b59. The skill must recount against the built `payload/` of the pack being published.

**store-gallery-image** (1920 × 1080 PNGs; the skill decides the story): shoot **Viz Learn Buddy for Python 1.0.0** with this pack's published version, interface **English**. Headline claims the code supports, with the screen that proves each (≤ ≈35 chars):

- “35 pages in 8 modules” (21 chars) — shown by: The sidebar fully expanded, all eight module groups visible, *Content version …* at its foot.
- “375 programs to practise” (24 chars) — shown by: py-trees-heaps in *Read* mode with a program and its line notes.
- “Read, fill in, trace” (20 chars) — shown by: py-dicts-sets in *Fill in* mode with the three mode tabs visible and one blank answered.

### B3. Description — English (Markdown; ≤ 20,000 chars; this text: 1297 chars)

First paragraph = the store card excerpt (cut at 200)and the Desktop add-on row's `summary` (cut at 280): 173 chars — fits.

```markdown
**The 35 practice pages and 375 programs of Viz Learn Buddy for Python.** This content pack is what the app shows: install it to use the app, which holds no programs of its own.

### What's inside

- **35 pages in 8 modules:** Language Foundations (5 pages), Control Flow (4), Data Structures (5), Algorithms & Analysis (5), Applied Projects (4), Scientific Computing (5), Graphics & Games (4) and Embedded Python (3).
- **375 programs**, each with notes on its lines, blanks to fill in with their own step-by-step hints, and the *Read*, *Fill in* and *Trace* modes.
- **Pages such as** *Strings: Text as Data*, *Classes & Objects*, *Recursion*, *Linked Lists*, *Sorting*, *Graph Algorithms*, *pandas DataFrames*, *Pygame Basics* and *micro:bit*.
- **What the AI tutor reads:** each program's source, notes and hints, so the tutor can answer about it. A program's output is not included.

### Good to know

- **Needs Viz Learn Buddy for Python** (version 1.0.0 or newer), installed from the store first.
- **Installs from inside the app:** the first time you open the app, press *Install from the store*; updates appear in *Settings → Content pack*.
- **The same pages as the MathViz website,** byte for byte. New and updated pages arrive as updates to this pack, without a new version of the app.
```

### B4. Description — 中文（Markdown；≤ 20,000 字符；本文 602 字符）

第一段 = 商店卡片摘要（200 字符截断），也是 Desktop 附加内容列表的 `summaryZh`（280 截断）：81 字符，不会被截断。

```markdown
**Viz Learn Buddy for Python 的 35 个练习页和 375 个程序。** 应用里显示的就是这个内容包的内容：应用本身不含程序，要装上它才能用。

### 包含什么

- **35 页，分 8 个模块**：语言基础（5 页）、控制逻辑（4 页）、数据结构（5 页）、算法分析（5 页）、综合运用（4 页）、科学计算与数理统计（5 页）、图形与游戏（4 页）、嵌入式 Python（3 页）。
- **375 个程序**，每个都有逐行注释、带分级提示的挖空，以及 *读*、*挖空*、*临摹* 三种模式。
- **页面举例**：*字符串：把文本当数据*、*类与对象*、*递归*、*链表*、*排序*、*图算法*、*pandas 数据表*、*pygame 入门*、*micro:bit*。
- **供 AI 辅导参考的材料**：每个程序的源码、注释和提示，辅导据此回答关于这个程序的问题。程序的运行输出不在包里。

### 说明

- **需要 Viz Learn Buddy for Python**（1.0.0 或更新版本），请先从商店安装应用。
- **在应用里就能安装**：第一次打开应用时点 *从商店安装*；有更新时会出现在 *设置 → 内容包* 里。
- **与 MathViz 网站上的页面逐字节相同。** 新增和更新的页面会作为这个内容包的更新推出，不需要等应用发新版。
```

### One-line summaries (where the code shows them)

- Store home card / product page excerpt: the first paragraph of B3/B4 (`apps/store/lib/description.ts:22,50`, `EXCERPT_MAX = 200`). No separate field.
- Desktop add-on row (`packages/platform-service/src/store-client.ts:212-216`: title / summary / summaryZh / iconUrl / priceGbpPence): **title** = the product name “Viz Learn Buddy for Python: Content Pack”; **summary** / **summaryZh** = first paragraph of B3 / B4 (`apps/api/src/store/addon-list.ts:32-35,59-60`, `SUMMARY_MAX = 280`) — 173 / 81 chars. These only come from an **add-on-kind** product: if the pack were instead bundled under the app product, the row would show the add-on's `addon.json` title “Viz Learn Buddy for Python content” and no summary (`addon-list.ts:169-174`).
