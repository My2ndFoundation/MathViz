import { describe, expect, test } from "bun:test";
import { checkManifest, parseTarget } from "../../scripts/build-local";

/**
 * scripts/build-local.ts's preflight: what it refuses before spending a `next build`. The build
 * itself (and the staged layout) is exercised by running it; see the Task 12 report.
 */
describe("build-local", () => {
  test("--target <t> and --target=<t>; anything else is refused", () => {
    expect(parseTarget(["--target", "python"])).toBe("python");
    expect(parseTarget(["--", "--target", "chess"])).toBe("chess");
    expect(parseTarget(["--target=crypto"])).toBe("crypto");
    expect(parseTarget(["--target", "python", "--allow-stale-icon"])).toBe("python");
    expect(() => parseTarget([])).toThrow("Unknown MATHVIZ_TARGET");
    expect(() => parseTarget(["--target", "physics"])).toThrow("Unknown MATHVIZ_TARGET");
  });

  // The icon's freshness against the web version's tokens is the build preflight's (readManifest),
  // not this suite's: a design-token change on the web must not turn `bun run test` red.
  test("every target's manifest agrees with its target.json and the entry", () => {
    for (const t of ["math", "chess", "crypto", "python"] as const) {
      const m = checkManifest(t);
      expect(m.id).toBe(`app.primeforge.mathviz.${t}`);
      expect(m.entry).toBe("primeforge-entry.mjs");
    }
  });
});
