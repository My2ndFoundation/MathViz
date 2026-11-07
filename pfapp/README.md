# pfapp

Four PrimeForge Desktop apps (math / chess / crypto / python) built from one Next.js codebase.
The target is chosen with `MATHVIZ_TARGET`; per-target config lives in `targets/<target>/`.
Design: `docs/superpowers/specs/2026-11-07-mathviz-pfapp-design.md`.

Layout: one package here (`package.json`, `bun.lock`); the Next.js project is `app/`; tests are in `tests/`.

```bash
bun install
bun run test
bunx biome check .
```
