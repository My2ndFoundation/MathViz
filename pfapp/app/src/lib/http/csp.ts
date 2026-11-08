// Shell policy ported from MathTestBuddy trainer/src/lib/http/csp.ts (commit c7df343), with
// `frame-src 'self'` added (the shell frames /c/…). The tool-page policy is this app's own
// (design 2026-11-07 §7.3; task 7 brief, verbatim).

/**
 * The shell pages' Content-Security-Policy, set by src/proxy.ts on every page response. Everything
 * comes from the app itself; images also from data: and blob:. Scripts and styles allow
 * 'unsafe-inline' (Next's inline bootstrap scripts and React style attributes; no per-request
 * nonces). 'unsafe-eval' only under `next dev` (React's debugging stacks).
 *
 * `frame-src 'self'`: the tool view is a same-origin iframe of /c/<ver>/tools/<file>. Without it
 * frame-src falls back to default-src, which is also 'self' — written out so that tightening
 * default-src later cannot silently blank every tool.
 *
 * No frame-ancestors on the shell (as MTB): the PrimeForge window decides how it shows the app.
 */
const shellPolicy = (dev: boolean) =>
  [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

export const SHELL_CSP = shellPolicy(false);
export const SHELL_CSP_DEV = shellPolicy(true);

/** The shell policy for this process (development: with 'unsafe-eval'). */
export const shellCsp = (): string =>
  process.env.NODE_ENV === "development" ? SHELL_CSP_DEV : SHELL_CSP;

/**
 * A tool page's policy, served by /c/<ver>/tools/<file>. The pages are the web version's
 * single-file, zero-dependency HTML: inline scripts and styles, data: images and fonts (the
 * favicon is a data: URI), blob: images (canvas exports). `frame-ancestors 'self'`: only the shell
 * may frame them.
 */
export const TOOL_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self'";

/**
 * TOOL_CSP plus 'unsafe-eval', for the targets whose tool pages need it (EVAL_TARGETS). The shell
 * keeps its own policy without it; these pages come from the signed content pack (owner rulings
 * 2026-11-08: math, then chess).
 */
export const TOOL_CSP_EVAL = TOOL_CSP.replace(
  "script-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
);

/**
 * Whose tool pages may eval, and why:
 * - math: the shell's video recorder (the web shell's, components/recorder.tsx) reads a tool's
 *   top-level `const`s — its state, camera and draw function — with `contentWindow.eval`, which
 *   runs under the tool page's policy; that is how it renders a recording frame by frame.
 * - chess: the algorithm stepper of chess-board-algorithms and chess-search-minimax compiles the
 *   source it shows with `new Function`; without it the pages cannot run (chess 1.0.0 shipped so).
 * Cryptography and python pages need neither (e2e pages.spec / python.spec: every page opens with
 * 0 CSP violations).
 */
export const EVAL_TARGETS: ReadonlySet<string> = new Set(["math", "chess"]);

/** The tool pages' policy for a target. */
export const toolCsp = (target: string): string =>
  EVAL_TARGETS.has(target) ? TOOL_CSP_EVAL : TOOL_CSP;

/** The URL carries the content version, so a tool page never changes under its URL. */
export const TOOL_CACHE_CONTROL = "public, max-age=31536000, immutable";
