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
- **`pf dev` watches `targets/<t>/` only** (the manifest, the icon), not `app/`. After a code
  change, stop it (Ctrl-C) and run it again; for fast UI work use `bun run dev` (`next dev`).
