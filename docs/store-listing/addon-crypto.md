# Viz Learn Buddy for Cryptography: Content Pack

> MathViz commit **ac34b59** . Counts: 27 pages (cryptography/cryptography-tools.json). Follows python (design §10, phase 2). App manifest version 0.1.0.
> Content add-on `app.primeforge.mathviz.crypto/content` of **Viz Learn Buddy for Cryptography** (`app.primeforge.mathviz.crypto`). `addon.json` is written by PrimeForge-Desktop `scripts/build-mathviz-addon.ts`: `kind: "content"`, title “Viz Learn Buddy for Cryptography content”, first version `1.0.0`, `minAppVersion` = the app manifest's version (0.1.0 today) (`docs/build-manual.md:880-920`).
> Remaining ⟦OWNER DECISION⟧ items are open on purpose; see `README.md` §5. Price, billing and separate add-on products are decided (README, "Owner rulings").

## A. Console → Products → Add a product (creation form, field order of `apps/console/app/products/new/page.tsx`)

| # | Field | Value | Notes |
|---|---|---|---|
| 1 | Product ID (optional) | `mathviz-crypto-addon-buyout` *(suggestion)* | Blank would derive `crypto-addon-buyout` (`deriveProductId` takes only the **last** segment of the app id, so all four MathViz targets would get bare `math-…`/`python-…` ids). Never shown to buyers; cannot change after creation (orders reference it). |
| 2 | Kind | **Add-on product (unlocks add-ons of one app)** | Set once, never changed. The buyer needs the app already. After creating it, on the product page → **Unlocked add-ons**, tick `app.primeforge.mathviz.crypto/content` (the only add-on of this app). |
| 3 | App ID * | `app.primeforge.mathviz.crypto` | Must already be in the published catalogue: `publish:app` the app first (and `publish:addon` the pack before ticking it). |
| 4 | Name * | Viz Learn Buddy for Cryptography: Content Pack (46 chars; limit 200) | The store has **one** name field, no Chinese variant. |
| 5 | Description (plain text box) | Paste the first paragraph below, as plain text: “The 27 interactive pages of Viz Learn Buddy for Cryptography. This content pack is what the app shows: install it to use the app, which holds no pages of its own.” (162 chars) | This box writes the product's **English** content description (`apps/api/src/store/admin-api.ts:254-257`); the full Markdown descriptions go in section B and overwrite it. Optional. |
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
- Source: the parent app's `pfapp/targets/crypto/icon.svg` (128 × 128 viewBox, square full-bleed `#05070d` ground, the M/V mark in `#fb7185`, no text; written by `pfapp/scripts/icons.ts` from `docs/logo.png` via `docs/brand-assets.json`).
- Conversion: `rsvg-convert -w 512 -h 512 pfapp/targets/crypto/icon.svg -o crypto-content-512.png`.
- ⟦OWNER DECISION⟧ whether the pack's icon is that file unchanged or, following Math Test Buddy's packs (`PrimeForge-Desktop/assets/addon-icons/mathtestbuddy/README.md`), the app icon with the red ADD-ON ribbon. The image skills expect an add-on icon at `assets/addon-icons/mathviz/crypto-content.svg` either way (README §3).

### B2. Image skill inputs

The three PrimeForge-Desktop skills (`.claude/skills/store-main-image`, `store-cover-image`, `store-gallery-image`) make the main image, cover and gallery themselves; what each needs and whether it exists is in `README.md` §3. The text inputs, in each skill's own format:

**store-main-image** (1920 × 1080 PNG, no words, ADD-ON tag):

| Input (store-main-image “Inputs to gather”) | Value |
|---|---|
| Product name | Viz Learn Buddy for Cryptography: Content Pack |
| One-line selling point | All of Viz Learn Buddy for Cryptography's 27 pages, in one pack |
| Type | **add-on**, parent app Viz Learn Buddy for Cryptography |
| Square logo / icon | `assets/addon-icons/mathviz/crypto-content.svg` (to be created, B1) |
| Brand colours (read from that SVG) | `#05070d` ground, `#fb7185` accent. For the ground's depth, the design system's own radial pair `#0c1526` → `#05070d` (`design-system/math-viz-design-system.md:33-34`) |
| Output folder | `assets/main-images/mathviz/` → `crypto-content.svg`, `crypto-content-1920x1080.png` |

**store-cover-image** (one `COVERS` entry in `assets/covers/make.py`; 1920 × 1080 PNG; upload first in the gallery):

```python
dict(folder="mathviz", name="crypto-content", ground="../main-images/mathviz/crypto-content-1920x1080.png", logo="../addon-icons/mathviz/crypto-content-512.png", theme={"fg": "#e2e8f0", "muted": "#9fb0c8", "accent": "#fb7185"}, addon="Viz Learn Buddy for Cryptography",
     title=['Cryptography', 'Content Pack'], pitch=['27 pages in 5 chapters'],
     points=['13 classical ciphers', 'Enigma, AES, RSA, BB84', 'The pages the app needs']),
```

- Counts: title “Cryptography” (12), “Content Pack” (12); pitch “27 pages in 5 chapters” (22) (≈25 per line); points “13 classical ciphers” (20), “Enigma, AES, RSA, BB84” (22), “The pages the app needs” (23) (≤ ≈32).
- Words checked against: 27 pages (cryptography/cryptography-tools.json) at ac34b59. The skill must recount against the built `payload/` of the pack being published.

**store-gallery-image** (1920 × 1080 PNGs; the skill decides the story): shoot **Viz Learn Buddy for Cryptography 0.1.0** with this pack's published version, interface **English**. Headline claims the code supports, with the screen that proves each (≤ ≈35 chars):

- “27 pages in 5 chapters” (22 chars) — shown by: The sidebar with the five chapters fully expanded beside *Caesar Cipher*.
- “Enigma, wheel by wheel” (22 chars) — shown by: *Enigma* with the rotor stepping visible.
- “From DES to post-quantum” (24 chars) — shown by: *Post-Quantum Cryptography* (crypto-post-quantum) at its default tab.

### B3. Description — English (Markdown; ≤ 20,000 chars; this text: 1070 chars)

First paragraph = the store card excerpt (cut at 200)and the Desktop add-on row's `summary` (cut at 280): 162 chars — fits.

```markdown
**The 27 interactive pages of Viz Learn Buddy for Cryptography.** This content pack is what the app shows: install it to use the app, which holds no pages of its own.

### What's inside

- **27 pages in 5 chapters:** Classical Cryptography (13 pages), Mechanical Cryptography (2), Cryptanalysis (1), Modern Cryptography (6) and Quantum-Era Cryptography (5).
- **Pages such as** *Caesar Cipher*, *The Playfair Family*, *Enigma*, *Cryptanalysis Workbench*, *DES & the Feistel Structure*, *RSA*, *BB84 Quantum Key Distribution* and *Post-Quantum Cryptography*.
- **The page descriptions the AI tutor reads,** so it can answer about each page and link to it.

### Good to know

- **Needs Viz Learn Buddy for Cryptography** (version 0.1.0 or newer), installed from the store first.
- **Installs from inside the app:** the first time you open the app, press *Install from the store*; updates appear in *Settings → Content pack*.
- **The same pages as the MathViz website,** byte for byte. New and updated pages arrive as updates to this pack, without a new version of the app.
```

### B4. Description — 中文（Markdown；≤ 20,000 字符；本文 502 字符）

第一段 = 商店卡片摘要（200 字符截断），也是 Desktop 附加内容列表的 `summaryZh`（280 截断）：79 字符，不会被截断。

```markdown
**Viz Learn Buddy for Cryptography 的 27 个交互页面。** 应用里显示的就是这个内容包的内容：应用本身不含页面，要装上它才能用。

### 包含什么

- **27 页，分 5 章**：古典密码（13 页）、机械密码（2 页）、密码分析（1 页）、现代密码学（6 页）、量子时代密码学（5 页）。
- **页面举例**：*凯撒密码*、*Playfair 家族*、*恩尼格玛*、*密码分析工作台*、*DES 与 Feistel 结构*、*RSA*、*BB84 量子密钥分发*、*后量子密码*。
- **供 AI 辅导参考的页面说明**，辅导据此回答关于每一页的问题，并链接到那一页。

### 说明

- **需要 Viz Learn Buddy for Cryptography**（0.1.0 或更新版本），请先从商店安装应用。
- **在应用里就能安装**：第一次打开应用时点 *从商店安装*；有更新时会出现在 *设置 → 内容包* 里。
- **与 MathViz 网站上的页面逐字节相同。** 新增和更新的页面会作为这个内容包的更新推出，不需要等应用发新版。
```

### One-line summaries (where the code shows them)

- Store home card / product page excerpt: the first paragraph of B3/B4 (`apps/store/lib/description.ts:22,50`, `EXCERPT_MAX = 200`). No separate field.
- Desktop add-on row (`packages/platform-service/src/store-client.ts:212-216`: title / summary / summaryZh / iconUrl / priceGbpPence): **title** = the product name “Viz Learn Buddy for Cryptography: Content Pack”; **summary** / **summaryZh** = first paragraph of B3 / B4 (`apps/api/src/store/addon-list.ts:32-35,59-60`, `SUMMARY_MAX = 280`) — 162 / 79 chars. These only come from an **add-on-kind** product: if the pack were instead bundled under the app product, the row would show the add-on's `addon.json` title “Viz Learn Buddy for Cryptography content” and no summary (`addon-list.ts:169-174`).
