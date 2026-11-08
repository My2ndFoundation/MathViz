import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const PRELOAD = resolve(import.meta.dir, "../../setup/tmp-root.ts");

const LEAKY_TEST = `
import { test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("leaves a temp dir behind", () => {
  writeFileSync(join(mkdtempSync(join(tmpdir(), "leak-")), "f"), "x");
});
`;

/** Runs `bun test` with the preload against a throwaway TMPDIR; returns that TMPDIR. */
function runSuite(body: string, prepare: (sandbox: string) => void = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), "tmp-root-suite-"));
  const sandbox = join(dir, "tmp");
  mkdirSync(sandbox);
  prepare(sandbox);
  writeFileSync(join(dir, "suite.test.ts"), body);
  const run = Bun.spawnSync([process.execPath, "test", "--preload", PRELOAD, "./suite.test.ts"], {
    cwd: dir,
    env: { ...process.env, TMPDIR: sandbox },
    stdout: "pipe",
    stderr: "pipe",
  });
  return { sandbox, exitCode: run.exitCode };
}

describe("tests/setup/tmp-root.ts", () => {
  test("removes what a passing run left in the temp dir", () => {
    const { sandbox, exitCode } = runSuite(LEAKY_TEST);
    expect(exitCode).toBe(0);
    expect(readdirSync(sandbox)).toEqual([]);
  });

  test("removes what a failing run left in the temp dir", () => {
    const failing = `${LEAKY_TEST}\ntest("fails", () => { throw new Error("boom"); });`;
    const { sandbox, exitCode } = runSuite(failing);
    expect(exitCode).toBe(1);
    expect(readdirSync(sandbox)).toEqual([]);
  });

  test("reclaims a dead run's root and leaves a live run's alone", () => {
    const deadPid = Bun.spawnSync(["true"]).pid;
    const dead = `pfapp-test-run-${deadPid}-abc123`;
    const live = `pfapp-test-run-${process.pid}-abc123`;
    const unrelated = "pfapp-unrelated-abc123";
    const { sandbox } = runSuite(LEAKY_TEST, (s) => {
      for (const name of [dead, live, unrelated]) mkdirSync(join(s, name));
    });
    expect(existsSync(join(sandbox, dead))).toBe(false);
    expect(readdirSync(sandbox).sort()).toEqual([live, unrelated].sort());
  });
});
