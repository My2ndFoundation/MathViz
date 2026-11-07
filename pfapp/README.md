# pfapp

Four PrimeForge Desktop apps (math / chess / crypto / python) built from one Next.js codebase.
The target is chosen with `MATHVIZ_TARGET`; per-target config lives in `targets/<target>/`.
Design: `docs/superpowers/specs/2026-11-07-mathviz-pfapp-design.md`.

Layout: one package here (`package.json`, `bun.lock`); the Next.js project is `app/`; tests are in `tests/`.

```bash
bun install
bun run test
bun run check:content   # 内容门：四个目标的提取 vs 网页版（见根 CLAUDE.md「pfapp/」）
bunx biome check .
```
