/**
 * bun run extract <target> [--mathviz <path>] [--out <dir>] [--compare <dir>]
 *
 * Writes `<out>/payload/` (default out: pfapp/build/content/<target>, gitignored) and prints the
 * tool count, the fingerprint, and — with --compare — which payload files were added, removed or
 * changed relative to an earlier extraction's `<dir>/payload/`. Always requires a clean checkout.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadTarget } from "../app/src/lib/target";
import { extract } from "./index";
import { sha256 } from "./provenance";

const PFAPP = resolve(import.meta.dir, "..");

function hashTree(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (rel: string) => {
    for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
      const p = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(p);
      else out.set(p, sha256(readFileSync(join(root, p))));
    }
  };
  walk("");
  return out;
}

function usage(msg?: string): never {
  if (msg) console.error(msg);
  console.error(
    "usage: bun run extract <math|chess|crypto|python> [--mathviz <path>] [--out <dir>] [--compare <dir>]",
  );
  process.exit(2);
}

async function main(argv: string[]) {
  const flags: Record<string, string> = {};
  const pos: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === "--mathviz" || a === "--out" || a === "--compare") {
      const v = argv[++i];
      if (!v) usage(`${a} needs a value`);
      flags[a.slice(2)] = v;
    } else if (a.startsWith("--")) usage(`unknown flag ${a}`);
    else pos.push(a);
  }
  if (pos.length !== 1) usage();
  const target = loadTarget(pos[0]);
  const mv = resolve(flags.mathviz ?? join(PFAPP, ".."));
  const out = resolve(flags.out ?? join(PFAPP, "build/content", target.id));

  // Snapshot the comparison tree first: --compare may point at the same dir as --out.
  let before: Map<string, string> | undefined;
  if (flags.compare) {
    const prev = join(resolve(flags.compare), "payload");
    if (!existsSync(prev)) usage(`--compare: ${prev} does not exist`);
    before = hashTree(prev);
  }

  const r = await extract(target, mv, out, { requireClean: true });
  console.log(`target       ${target.id}`);
  console.log(`tools        ${r.tools}`);
  console.log(`files        ${r.files.length}`);
  console.log(`fingerprint  ${r.fingerprint}`);
  console.log(`payload      ${join(out, "payload")}`);

  if (before) {
    const after = hashTree(join(out, "payload"));
    const changes: string[] = [];
    for (const p of [...new Set([...before.keys(), ...after.keys()])].sort()) {
      if (p === "provenance.json") continue;
      const a = before.get(p);
      const b = after.get(p);
      if (a === undefined) changes.push(`  + ${p}`);
      else if (b === undefined) changes.push(`  - ${p}`);
      else if (a !== b) changes.push(`  ~ ${p}`);
    }
    console.log(`changed      ${changes.length} vs ${resolve(flags.compare as string)}`);
    for (const c of changes) console.log(c);
  }
}

main(process.argv.slice(2)).catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
