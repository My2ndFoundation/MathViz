# Viz Learn Buddy for Math: Content Pack

> MathViz commit **ac34b59** . Counts: 62 pages (tools.json). Follows python (design §10, phase 2). App manifest version 1.0.0.
> Content add-on `app.primeforge.mathviz.math/content` of **Viz Learn Buddy for Math** (`app.primeforge.mathviz.math`). `addon.json` is written by PrimeForge-Desktop `scripts/build-mathviz-addon.ts`: `kind: "content"`, title “Viz Learn Buddy for Math content”, first version `1.0.0`, `minAppVersion` = the app manifest's version (1.0.0 today) (`docs/build-manual.md:880-920`).
> Remaining ⟦OWNER DECISION⟧ items are open on purpose; see `README.md` §5. Price, billing and separate add-on products are decided (README, "Owner rulings").

## A. Console → Products → Add a product (creation form, field order of `apps/console/app/products/new/page.tsx`)

| # | Field | Value | Notes |
|---|---|---|---|
| 1 | Product ID (optional) | `mathviz-math-addon-buyout` *(suggestion)* | Blank would derive `math-addon-buyout` (`deriveProductId` takes only the **last** segment of the app id, so all four MathViz targets would get bare `math-…`/`python-…` ids). Never shown to buyers; cannot change after creation (orders reference it). |
| 2 | Kind | **Add-on product (unlocks add-ons of one app)** | Set once, never changed. The buyer needs the app already. After creating it, on the product page → **Unlocked add-ons**, tick `app.primeforge.mathviz.math/content` (the only add-on of this app). |
| 3 | App ID * | `app.primeforge.mathviz.math` | Must already be in the published catalogue: `publish:app` the app first (and `publish:addon` the pack before ticking it). |
| 4 | Name * | Viz Learn Buddy for Math: Content Pack (38 chars; limit 200) | The store has **one** name field, no Chinese variant. |
| 5 | Description (plain text box) | Paste the first paragraph below, as plain text: “The 62 interactive pages of Viz Learn Buddy for Math. This content pack is what the app shows: install it to use the app, which holds no pages of its own.” (154 chars) | This box writes the product's **English** content description (`apps/api/src/store/admin-api.ts:254-257`); the full Markdown descriptions go in section B and overwrite it. Optional. |
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
- Source: the parent app's `pfapp/targets/math/icon.svg` (128 × 128 viewBox, square full-bleed `#05070d` ground, the M/V mark in `#2dd4ea`, no text; written by `pfapp/scripts/icons.ts` from `docs/logo.png` via `docs/brand-assets.json`).
- Conversion: `rsvg-convert -w 512 -h 512 pfapp/targets/math/icon.svg -o math-content-512.png`.
- ⟦OWNER DECISION⟧ whether the pack's icon is that file unchanged or, following Math Test Buddy's packs (`PrimeForge-Desktop/assets/addon-icons/mathtestbuddy/README.md`), the app icon with the red ADD-ON ribbon. The image skills expect an add-on icon at `assets/addon-icons/mathviz/math-content.svg` either way (README §3).

### B2. Image skill inputs

The three PrimeForge-Desktop skills (`.claude/skills/store-main-image`, `store-cover-image`, `store-gallery-image`) make the main image, cover and gallery themselves; what each needs and whether it exists is in `README.md` §3. The text inputs, in each skill's own format:

**store-main-image** (1920 × 1080 PNG, no words, ADD-ON tag):

| Input (store-main-image “Inputs to gather”) | Value |
|---|---|
| Product name | Viz Learn Buddy for Math: Content Pack |
| One-line selling point | All of Viz Learn Buddy for Math's 62 pages, in one pack |
| Type | **add-on**, parent app Viz Learn Buddy for Math |
| Square logo / icon | `assets/addon-icons/mathviz/math-content.svg` (to be created, B1) |
| Brand colours (read from that SVG) | `#05070d` ground, `#2dd4ea` accent. For the ground's depth, the design system's own radial pair `#0c1526` → `#05070d` (`design-system/math-viz-design-system.md:33-34`) |
| Output folder | `assets/main-images/mathviz/` → `math-content.svg`, `math-content-1920x1080.png` |

**store-cover-image** (one `COVERS` entry in `assets/covers/make.py`; 1920 × 1080 PNG; upload first in the gallery):

```python
dict(folder="mathviz", name="math-content", ground="../main-images/mathviz/math-content-1920x1080.png", logo="../addon-icons/mathviz/math-content-512.png", theme={"fg": "#e2e8f0", "muted": "#9fb0c8", "accent": "#2dd4ea"}, addon="Viz Learn Buddy for Math",
     title=['Math', 'Content Pack'], pitch=['62 interactive pages'],
     points=['13 topics, trig to relativity', 'A 3D scene on every page', 'The pages the app needs']),
```

- Counts: title “Math” (4), “Content Pack” (12); pitch “62 interactive pages” (20) (≈25 per line); points “13 topics, trig to relativity” (29), “A 3D scene on every page” (24), “The pages the app needs” (23) (≤ ≈32).
- Words checked against: 62 pages (tools.json) at ac34b59. The skill must recount against the built `payload/` of the pack being published.

**store-gallery-image** (1920 × 1080 PNGs; the skill decides the story): shoot **Viz Learn Buddy for Math 1.0.0** with this pack's published version, interface **English**. Headline claims the code supports, with the screen that proves each (≤ ≈35 chars):

- “62 pages in 13 groups” (21 chars) — shown by: The sidebar fully expanded with the thirteen groups, beside *The Essence of Complex Multiplication*.
- “A 3D scene on every page” (24 chars) — shown by: *The Three-Body Problem* (three-body-problem-3d) drawn mid-run.
- “One view for each idea” (22 chars) — shown by: *The Essence of e* (e-essence-3d) in its orthographic preset view.

### B3. Description — English (Markdown; ≤ 20,000 chars; this text: 1234 chars)

First paragraph = the store card excerpt (cut at 200)and the Desktop add-on row's `summary` (cut at 280): 154 chars — fits.

```markdown
**The 62 interactive pages of Viz Learn Buddy for Math.** This content pack is what the app shows: install it to use the app, which holds no pages of its own.

### What's inside

- **62 pages in 13 groups,** from Trig & Hyperbolic Functions and Calculus & Analysis to Relativity & Spacetime, Cybernetics & Feedback and Signal Processing.
- **Each page a 3D scene** with its own parameters, switches and preset views, one of them chosen to make the page's key idea visible.
- **Pages such as** *The Essence of the Fourier Transform*, *The Essence of Complex Multiplication*, *The Essence of Taylor Expansion*, *Conditional Probability & Bayesian Updating*, *The Three-Body Problem* and *Standing a Pendulum Up · Feedback and PID*.
- **The page descriptions the AI tutor reads,** so it can answer about each page and link to it.

### Good to know

- **Needs Viz Learn Buddy for Math** (version 1.0.0 or newer), installed from the store first.
- **Installs from inside the app:** the first time you open the app, press *Install from the store*; updates appear in *Settings → Content pack*.
- **The same pages as the MathViz website,** byte for byte. New and updated pages arrive as updates to this pack, without a new version of the app.
```

### B4. Description — 中文（Markdown；≤ 20,000 字符；本文 508 字符）

第一段 = 商店卡片摘要（200 字符截断），也是 Desktop 附加内容列表的 `summaryZh`（280 截断）：71 字符，不会被截断。

```markdown
**Viz Learn Buddy for Math 的 62 个交互页面。** 应用里显示的就是这个内容包的内容：应用本身不含页面，要装上它才能用。

### 包含什么

- **62 页，分 13 组**，从三角与双曲函数、微积分与分析，到相对论与时空、控制论与反馈、信号处理。
- **每页一个三维场景**，有自己的参数、开关和预设视角，其中一个视角专门用来让这一页的关键道理看得见。
- **页面举例**：*傅立叶变换的本质*、*复数乘法的本质*、*泰勒展开的本质*、*条件概率与贝叶斯更新*、*三体问题*、*让倒立摆站起来 · 反馈与 PID*。
- **供 AI 辅导参考的页面说明**，辅导据此回答关于每一页的问题，并链接到那一页。

### 说明

- **需要 Viz Learn Buddy for Math**（1.0.0 或更新版本），请先从商店安装应用。
- **在应用里就能安装**：第一次打开应用时点 *从商店安装*；有更新时会出现在 *设置 → 内容包* 里。
- **与 MathViz 网站上的页面逐字节相同。** 新增和更新的页面会作为这个内容包的更新推出，不需要等应用发新版。
```

### One-line summaries (where the code shows them)

- Store home card / product page excerpt: the first paragraph of B3/B4 (`apps/store/lib/description.ts:22,50`, `EXCERPT_MAX = 200`). No separate field.
- Desktop add-on row (`packages/platform-service/src/store-client.ts:212-216`: title / summary / summaryZh / iconUrl / priceGbpPence): **title** = the product name “Viz Learn Buddy for Math: Content Pack”; **summary** / **summaryZh** = first paragraph of B3 / B4 (`apps/api/src/store/addon-list.ts:32-35,59-60`, `SUMMARY_MAX = 280`) — 154 / 71 chars. These only come from an **add-on-kind** product: if the pack were instead bundled under the app product, the row would show the add-on's `addon.json` title “Viz Learn Buddy for Math content” and no summary (`addon-list.ts:169-174`).
