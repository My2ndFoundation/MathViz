# pfapp

Four PrimeForge Desktop apps (math / chess / crypto / python) built from one Next.js codebase.
The target is chosen with `MATHVIZ_TARGET`; per-target config lives in `targets/<target>/`.
Design: `docs/superpowers/specs/2026-11-07-mathviz-pfapp-design.md`.

Layout: one package here (`package.json`, `bun.lock`); the Next.js project is `app/`; tests are in `tests/`.

```bash
bun install
bun run check           # lint + typecheck + unit + integration
bun run check:content   # 内容门：四个目标的提取 vs 网页版（见根 CLAUDE.md「pfapp/」）
bun run test:e2e        # Playwright: the built python app through its PrimeForge entry
bun run build -- --target python   # → build/python/, a PrimeForge package root (below)
bun run icons           # regenerate targets/*/icon.svg (the build preflight refuses a stale one;
                        # tests/unit/icons.test.ts checks the committed SVGs against the icon rules)
```

**Entry.** PrimeForge runs `primeforge-entry.mjs` (`app/primeforge-entry.mjs`) with cwd = the
read-only install directory and only the `PRIMEFORGE_*` variables. It starts Next in-process on
`127.0.0.1:$PRIMEFORGE_PORT`, takes the target from `PRIMEFORGE_APP_ID`
(`app.primeforge.mathviz.<target>`), refuses a manifest or a build (`.next/mathviz-target`) for
another target, and on SIGTERM closes the database within 4 s.

**Build layout.** `bun run build -- --target <t>` runs `next build app` with `MATHVIZ_TARGET=<t>`
and stages `build/<t>/`: `.next/` (without `cache/`, `dev/`), `drizzle/`, `primeforge-entry.mjs`,
`next.config.mjs`, `package.json` (its `version` set to the target manifest's), `bun.lock`,
`public/` (when `app/public` exists), `manifest.json`, `icon.svg`. PrimeForge-Desktop's
`scripts/build-mathviz.ts` takes it from there: frozen production install, checks, signing.
`build/` is gitignored. `--allow-stale-icon` turns the preflight's stale-icon refusal into a warning; CI uses it
(a web design-token change must not turn pfapp red), the signing build does not.

**The development store.** Outside PrimeForge there is no `/addons/v1`, so Settings → Content
pack and the empty state's one-click install show "needs PrimeForge". To try them, start the app
with `MATHVIZ_FAKE_ADDONS=1 MATHVIZ_FAKE_ADDONS_DIR=<dir>` where `<dir>/content/` holds an
unpacked content pack (`addon.json` + `payload/`; `bun tests/e2e/prepare.ts store <pfaddon> <dir>`
writes one). `MATHVIZ_FAKE_ADDONS_INSTALL_MS` sets how long an install takes,
`MATHVIZ_FAKE_ADDONS_PAID=content` makes it unowned (Get → the store-window note). A production
build honours these only with `MATHVIZ_E2E=1` (the e2e harness), after Math Test Buddy's
`MTB_FAKE_ADDONS` / `MTB_E2E` (`app/src/lib/addons/fake.ts`, `app/src/lib/server/context.ts`).

## Developing with pf

Each target is its own project for pf, PrimeForge-SDK's CLI:
`targets/<t>/primeforge.json` builds with `bun ../../scripts/stage-pfapp.ts --target <t>`
(`bun run stage:pfapp -- --target <t>` from here) into the stage `targets/<t>/dist/pfapp/`
(`targets/*/dist/` is gitignored; `pf pack` writes into `targets/<t>/dist/packages/`). That
script runs `bun install --frozen-lockfile`, `build-local` (so `build/<t>/` is unchanged), copies `build/<t>/` into the stage, holds it to the target's manifest and to
`bun.lock`, and runs the production install PrimeForge-Desktop's `build:mathviz` runs — so no
PrimeForge-Desktop checkout is needed. Run pf **from the target's folder**:

```bash
cd pfapp/targets/math          # or chess / crypto / python
pf dev                         # build, link into PrimeForge (Developer mode on), start, follow the log
pf check                       # every gate over the stage that exists
pf build                       # build, then pack: dist/packages/app.primeforge.mathviz.math-<v>.pfapp
pf publish <file.pfapp>        # needs the store's admin key
```

- **Certificate namespace:** `app.primeforge.mathviz.` covers all four apps
  (`app.primeforge.mathviz.{math,chess,crypto,python}`). A developer-certificate pack raises the
  package's `minDesktopVersion` to 1.47.0.
- **Versions** stay per target, in `targets/<t>/manifest.json`; `pfapp/package.json`'s `1.0.0` is
  not compared (the project folder has no package.json; the stage's carries the target's version).
- **A release is built from a clean checkout.** pf's clean-git gate sees only `targets/<t>/`, so the
  whole-checkout rule is the stage script's: `bun run stage:pfapp -- --target <t> --release`
  refuses any uncommitted change in MathViz (before and after the build), then `pf pack` packs that
  stage. Without `--release` a dirty checkout is only a warning, because `pf dev` builds while you
  edit.
- **`pf dev` also watches `app/` and `scripts/`** (`"watch"` in each `targets/<t>/primeforge.json`;
  pf from 2026-11-10 on): a code change rebuilds and restarts the app. For fast UI work `bun run dev`
  (`next dev`) is still quicker. The content packs watch their own sources the same way
  (`content/<t>/primeforge.json`; math watches the whole checkout, since its pages include files at the root).

### The content packs with pf

Each target's content pack (`app.primeforge.mathviz.<t>/content`) is a pf add-on project of its
own, `content/<t>/primeforge.json`, built by `scripts/stage-addon.ts` into `content/<t>/dist/addon/`
(`addon.json` + `payload/`, the extractor's output). It is PrimeForge-Desktop's
`build:mathviz-addon` without the signing, with the same payload, the same `addon.json` and the same
version rule — and the release record now lives here, in **`content/releases.json`** (seeded with the
desktop's `scripts/mathviz-content-releases.json` as it stood on 2026-11-10).

- **The version is decided from the record**: content whose fingerprint equals the last recorded
  release's is that release, never a new version; anything else is a patch above it (`1.0.0` for a
  first). `bun run stage:addon -- --target <t> --status` prints the fingerprint, the last release,
  what changed and the version a build would make, and exits 2 when there is nothing to release.
- **Only a published pack moves the record.** pf has no hook after `pf publish`, so the build prints
  the command; it reads the version and fingerprint from the signed package and is safe to repeat.

```bash
cd pfapp/content/math          # or chess / crypto / python
pf dev                         # with the app already linked by pf dev: build and link the pack
# a release, from a clean checkout:
cd ../.. && bun run stage:addon -- --target math --release   # in pfapp/
cd content/math && pf pack     # → dist/packages/content-<v>.pfaddon (+ .sig)
pf publish dist/packages/content-<v>.pfaddon
cd ../.. && bun run record:addon -- "$PWD/content/math/dist/packages/content-<v>.pfaddon"
git add content/releases.json && git commit -m "content(math): <v> published"
```

- `--release` refuses a dirty checkout (the payload's provenance must say `clean: true`, and
  `record:addon` refuses one that does not) and exits 2, leaving no stage, when nothing changed.
- A package already built for the decided version with other bytes is refused (it may be the
  published, unrecorded one): record it, or delete it and its `.sig`.
- The namespace is the apps' own: `app.primeforge.mathviz.` covers all four packs.
- **Until PrimeForge-Desktop's `build:mathviz-addon` is retired, two records exist.** A pack
  published from the desktop (`publish:addon`) is recorded only there; record it here too
  (`bun run record:addon -- <that .pfaddon>`, it reads the same package) or this build will decide
  that version again.
