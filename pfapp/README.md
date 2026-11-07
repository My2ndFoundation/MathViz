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
