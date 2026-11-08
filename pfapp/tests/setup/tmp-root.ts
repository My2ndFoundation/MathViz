import { afterAll } from "bun:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Tests make temp dirs freely (extracted payloads, data dirs, ...) and never remove them, which
// once left over 60 GB behind in a day. Each run gets one root instead, and every tmpdir() call
// lands inside it.
//
// A global afterAll covers passing and failing runs. It does not run after --bail, Ctrl-C or a
// crash (nor does process.on("exit") under bun test), so each run also reclaims the roots of
// runs whose process is gone.
const PREFIX = "pfapp-test-run-";
const base = tmpdir();

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

for (const name of readdirSync(base)) {
  const pid = name.startsWith(PREFIX) ? Number.parseInt(name.slice(PREFIX.length), 10) : Number.NaN;
  if (!Number.isNaN(pid) && !isRunning(pid)) {
    rmSync(join(base, name), { recursive: true, force: true });
  }
}

const root = mkdtempSync(join(base, `${PREFIX}${process.pid}-`));
process.env.TMPDIR = root;

afterAll(() => rmSync(root, { recursive: true, force: true }));
