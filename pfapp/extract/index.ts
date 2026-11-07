import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Target } from "../app/src/lib/target";
import { buildCatalog, readRegistry } from "./catalog";
import {
  assertCleanCheckout,
  buildProvenance,
  type FileHash,
  fingerprintOf,
  headSha,
  isClean,
  sha256,
} from "./provenance";
import { readPythonSources } from "./python-source";

export type { Catalog, CatalogItem } from "./catalog";
export { readGroupLabels } from "./labels";
export { assertCleanCheckout } from "./provenance";

export interface ExtractOptions {
  /**
   * Refuse a checkout with uncommitted changes (default true). Only unit tests turn this off,
   * so they can run on a working tree; the CLI always enforces it. Provenance records whether the tree
   * actually was clean.
   */
  requireClean?: boolean;
}

export interface ExtractResult {
  tools: number;
  /** Every written payload-relative path, sorted (provenance.json included). */
  files: string[];
  fingerprint: string;
}

const json = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;

/**
 * MathViz checkout → `<outDir>/payload/` for one target (design §6). `outDir/payload` is replaced
 * wholesale so stale files from an earlier run never survive. Deterministic: same commit gives
 * byte-identical output.
 */
export async function extract(
  target: Target,
  mvPath: string,
  outDir: string,
  opts: ExtractOptions = {},
): Promise<ExtractResult> {
  const requireClean = opts.requireClean ?? true;
  if (requireClean) assertCleanCheckout(mvPath);
  const sha = headSha(mvPath);
  const clean = requireClean || isClean(mvPath);

  const tools = readRegistry(target, mvPath);
  const catalog = buildCatalog(target, mvPath, tools);

  const content = new Map<string, Buffer>();
  content.set("catalog.json", Buffer.from(json(catalog)));
  for (const t of tools) content.set(t.file, readFileSync(t.srcPath));
  if (target.id === "python") {
    const registered = new Map(
      tools.map((t) => {
        const n = t.entry.programs;
        return [t.entry.id as string, typeof n === "number" ? n : undefined] as const;
      }),
    );
    for (const p of readPythonSources(mvPath, registered)) {
      content.set(`source/${p.id}.json`, Buffer.from(json(p)));
    }
  }

  const paths = [...content.keys()].sort();
  const hashes: FileHash[] = paths.map((path) => ({
    path,
    sha256: sha256(content.get(path) as Buffer),
  }));
  const fingerprint = fingerprintOf(hashes);
  content.set(
    "provenance.json",
    Buffer.from(
      json(buildProvenance({ target: target.id, sha, clean, fingerprint, files: hashes })),
    ),
  );

  const root = join(outDir, "payload");
  rmSync(root, { recursive: true, force: true });
  const files = [...content.keys()].sort();
  for (const f of files) {
    const dest = join(root, f);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content.get(f) as Buffer);
  }
  return { tools: tools.length, files, fingerprint };
}
