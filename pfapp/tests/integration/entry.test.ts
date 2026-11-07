import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * app/primeforge-entry.mjs refuses to start a wrong package before it loads Next: these run the
 * entry under Node (the runtime PrimeForge bundles) with what the platform would give it. The
 * started-and-serving path is the e2e suite's (tests/e2e/setup.ts starts every app through it).
 */

const ENTRY = resolve(import.meta.dir, "..", "..", "app", "primeforge-entry.mjs");

function run(env: Record<string, string>, entry = ENTRY) {
  const all: Record<string, string> = {
    HOME: tmpdir(),
    TMPDIR: tmpdir(),
    PATH: process.env.PATH ?? "",
    ...env,
  };
  const r = spawnSync("node", [entry], {
    env: all as NodeJS.ProcessEnv,
    encoding: "utf8",
    timeout: 20_000,
  });
  return { code: r.status, err: r.stderr };
}

const platform = (over: Record<string, string> = {}) => ({
  PRIMEFORGE_APP_ID: "app.primeforge.mathviz.python",
  PRIMEFORGE_DATA_DIR: mkdtempSync(join(tmpdir(), "pfapp-entry-data-")),
  PRIMEFORGE_PORT: "1",
  ...over,
});

/** A package root holding a copy of the entry, a manifest and a stamped (empty) .next. */
function packageRoot(manifestId: string, stamp: string | null): string {
  const dir = mkdtempSync(join(tmpdir(), "pfapp-entry-pkg-"));
  copyFileSync(ENTRY, join(dir, "primeforge-entry.mjs"));
  writeFileSync(join(dir, "manifest.json"), JSON.stringify({ id: manifestId }));
  if (stamp !== null) {
    mkdirSync(join(dir, ".next"));
    writeFileSync(join(dir, ".next", "mathviz-target"), `${stamp}\n`);
  }
  return join(dir, "primeforge-entry.mjs");
}

describe("primeforge-entry.mjs refuses", () => {
  test("without the platform's app id, data dir or port", () => {
    for (const drop of ["PRIMEFORGE_APP_ID", "PRIMEFORGE_DATA_DIR", "PRIMEFORGE_PORT"]) {
      const env: Record<string, string> = platform();
      delete env[drop];
      const r = run(env);
      expect([drop, r.code]).toEqual([drop, 1]);
      expect(r.err).toContain(`not provided by the platform: ${drop}`);
    }
  });

  test("an app id that is not one of the four MathViz apps", () => {
    for (const id of [
      "app.primeforge.mathtestbuddy",
      "app.primeforge.mathviz.",
      "app.primeforge.mathviz.physics",
    ]) {
      const r = run(platform({ PRIMEFORGE_APP_ID: id }));
      expect([id, r.code]).toEqual([id, 1]);
      expect(r.err).toContain("is not a MathViz app");
    }
  });

  test("a MATHVIZ_TARGET that contradicts the app id", () => {
    const r = run(platform({ MATHVIZ_TARGET: "math" }));
    expect(r.code).toBe(1);
    expect(r.err).toContain("MATHVIZ_TARGET=math but PRIMEFORGE_APP_ID names python");
  });

  test("a port that is not a port", () => {
    for (const p of ["0", "65536", "80.5", "x"]) {
      const r = run(platform({ PRIMEFORGE_PORT: p }));
      expect([p, r.code]).toEqual([p, 1]);
      expect(r.err).toContain("is not a port");
    }
  });

  test("a package whose manifest names another app", () => {
    const r = run(platform(), packageRoot("app.primeforge.mathviz.chess", "python"));
    expect(r.code).toBe(1);
    expect(r.err).toContain(
      "this package is app.primeforge.mathviz.chess, started as app.primeforge.mathviz.python",
    );
  });

  test("a build stamped for another target, or not stamped", () => {
    const other = run(platform(), packageRoot("app.primeforge.mathviz.python", "math"));
    expect(other.code).toBe(1);
    expect(other.err).toContain(".next is a math build, not python's");
    const none = run(platform(), packageRoot("app.primeforge.mathviz.python", null));
    expect(none.code).toBe(1);
    expect(none.err).toContain(".next is not a stamped build, not python's");
  });
});
