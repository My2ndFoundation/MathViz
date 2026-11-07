import { beforeAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadTarget, type TargetId } from "../../app/src/lib/target";
import { assertCleanCheckout, extract } from "../../extract/index";
import { readGroupLabels } from "../../extract/labels";

// The extractor's input is a real MathViz checkout. Default: the repo this package lives in.
const MV = resolve(process.env.MATHVIZ_PATH ?? join(import.meta.dir, "../../.."));

// These tests pass {requireClean: false}: they must run on a developer's tree that has
// uncommitted work, and they only write to temp dirs. The clean-checkout rule itself is
// tested separately below against a throwaway git repo; the CLI always enforces it.
const NO_CLEAN = { requireClean: false } as const;

const sha256 = (buf: Buffer | string) => createHash("sha256").update(buf).digest("hex");
const tmp = (tag: string) => mkdtempSync(join(tmpdir(), `pfapp-extract-${tag}-`));

function walk(dir: string, base = ""): string[] {
  const out: string[] = [];
  for (const e of readdirSync(join(dir, base), { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(dir, rel));
    else out.push(rel);
  }
  return out.sort();
}

interface Catalog {
  target: string;
  items: { id: string; file: string; group: string; groupLabel: { en: string; zh: string } }[];
  groups: { id: string; label: { en: string; zh: string } }[];
}

const COUNTS: Record<TargetId, { tools: number; groups: number }> = {
  math: { tools: 62, groups: 13 },
  chess: { tools: 5, groups: 4 },
  crypto: { tools: 27, groups: 5 },
  python: { tools: 35, groups: 8 },
};

const outs = {} as Record<TargetId, { dir: string; fingerprint: string; files: string[] }>;

beforeAll(async () => {
  for (const id of Object.keys(COUNTS) as TargetId[]) {
    const dir = tmp(id);
    const r = await extract(loadTarget(id), MV, dir, NO_CLEAN);
    expect(r.tools).toBe(COUNTS[id].tools);
    outs[id] = { dir, fingerprint: r.fingerprint, files: r.files };
  }
}, 60_000);

const catalogOf = (id: TargetId): Catalog =>
  JSON.parse(readFileSync(join(outs[id].dir, "payload/catalog.json"), "utf8"));

describe("catalog", () => {
  for (const id of Object.keys(COUNTS) as TargetId[]) {
    test(`${id}: ${COUNTS[id].tools} tools, ${COUNTS[id].groups} groups, tool files byte-identical`, () => {
      const t = loadTarget(id);
      const cat = catalogOf(id);
      expect(cat.target).toBe(id);
      expect(cat.items.length).toBe(COUNTS[id].tools);
      expect(cat.groups.length).toBe(COUNTS[id].groups);
      const reg = JSON.parse(readFileSync(join(MV, t.registry), "utf8")).tools as {
        id: string;
        file: string;
      }[];
      const regDir = join(MV, t.registry, "..");
      for (const [i, item] of cat.items.entries()) {
        const src = reg[i];
        expect(item.id).toBe(src?.id as string);
        expect(item.file).toMatch(/^tools\/[^/]+\.html$/);
        const copied = readFileSync(join(outs[id].dir, "payload", item.file));
        const orig = readFileSync(join(regDir, src?.file as string));
        expect(sha256(copied)).toBe(sha256(orig));
        expect(cat.groups.some((g) => g.id === item.group)).toBe(true);
        expect(item.groupLabel.en.length > 0 && item.groupLabel.zh.length > 0).toBe(true);
      }
      const toolFiles = walk(join(outs[id].dir, "payload")).filter((f) => f.startsWith("tools/"));
      expect(toolFiles.length).toBe(COUNTS[id].tools);
    });
  }

  test("files outside the registry are not packed", () => {
    expect(walk(join(outs.python.dir, "payload")).some((f) => f.includes("_skeleton"))).toBe(false);
  });
});

describe("group labels", () => {
  test("read from the web pages' own literals", () => {
    expect(readGroupLabels(loadTarget("python"), MV)["1"]).toEqual({
      en: "Language Foundations",
      zh: "语言基础",
    });
    expect(Object.keys(readGroupLabels(loadTarget("python"), MV)).length).toBe(8);
    expect(readGroupLabels(loadTarget("crypto"), MV)["3"]?.en).toBe("Chapter 3 · Cryptanalysis");
    expect(readGroupLabels(loadTarget("chess"), MV)["4"]?.zh).toBe("阶段 4 · 搜索与博弈树");
    expect(readGroupLabels(loadTarget("math"), MV).trig).toEqual({
      en: "Trig & Hyperbolic Functions",
      zh: "三角与双曲函数",
    });
  });
});

describe("python source", () => {
  test("375 programs, none carries run", () => {
    const dir = join(outs.python.dir, "payload/source");
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBe(375);
    for (const f of files) {
      const obj = JSON.parse(readFileSync(join(dir, f), "utf8"));
      expect("run" in obj).toBe(false);
      expect(Object.keys(obj)).toEqual([
        "id",
        "tool",
        "title",
        "blurb",
        "notes",
        "lineNotes",
        "tags",
        "boards",
        "level",
        "source",
      ]);
      expect(typeof obj.source).toBe("string");
      expect(obj.source.length).toBeGreaterThan(0);
    }
  });

  test("source is the .py text verbatim", () => {
    const obj = JSON.parse(
      readFileSync(join(outs.python.dir, "payload/source/hello-name.json"), "utf8"),
    );
    const py = readFileSync(join(MV, "python/programs/ch01-basics/hello-name.py"), "utf8");
    expect(obj.source).toBe(py);
    expect(obj.tool).toBe("py-basics");
  });

  test("non-python targets have no source/ in phase 1", () => {
    expect(walk(join(outs.math.dir, "payload")).some((f) => f.startsWith("source/"))).toBe(false);
  });
});

describe("provenance and determinism", () => {
  test("provenance has no time-like keys and records HEAD", () => {
    const text = readFileSync(join(outs.python.dir, "payload/provenance.json"), "utf8");
    const keys: string[] = [];
    JSON.parse(text, (k, v) => {
      if (k) keys.push(k);
      return v;
    });
    expect(keys.filter((k) => /time|date/i.test(k))).toEqual([]);
    const prov = JSON.parse(text);
    const head = execFileSync("git", ["-C", MV, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    expect(prov.sha).toBe(head);
    expect(prov.fingerprint).toBe(outs.python.fingerprint);
    // Every payload file except provenance itself is listed with its hash.
    const listed = (prov.files as { path: string; sha256: string }[]).map((f) => f.path);
    expect(listed).toEqual(
      walk(join(outs.python.dir, "payload")).filter((f) => f !== "provenance.json"),
    );
  });

  test("fingerprint is the hash of the sorted (sha256, path) list, excluding provenance", () => {
    const root = join(outs.chess.dir, "payload");
    const lines = walk(root)
      .filter((f) => f !== "provenance.json")
      .map((f) => `${sha256(readFileSync(join(root, f)))}  ${f}\n`)
      .join("");
    expect(outs.chess.fingerprint).toBe(sha256(lines));
  });

  test("same checkout extracted twice is byte-identical", async () => {
    for (const id of ["python", "math"] as TargetId[]) {
      const again = tmp(`${id}-again`);
      const r = await extract(loadTarget(id), MV, again, NO_CLEAN);
      expect(r.fingerprint).toBe(outs[id].fingerprint);
      const a = walk(join(outs[id].dir, "payload"));
      const b = walk(join(again, "payload"));
      expect(b).toEqual(a);
      for (const f of a) {
        expect(sha256(readFileSync(join(again, "payload", f)))).toBe(
          sha256(readFileSync(join(outs[id].dir, "payload", f))),
        );
      }
    }
  }, 60_000);

  test("returned files are sorted payload-relative paths", () => {
    const f = outs.crypto.files;
    expect(f).toEqual([...f].sort());
    expect(f).toEqual(walk(join(outs.crypto.dir, "payload")));
  });
});

describe("clean checkout", () => {
  test("a dirty checkout is refused; a clean one passes", async () => {
    const repo = tmp("git");
    const git = (...a: string[]) =>
      execFileSync("git", ["-C", repo, ...a], { encoding: "utf8", stdio: "pipe" });
    git("init", "-q");
    writeFileSync(join(repo, "a.txt"), "a\n");
    git("add", "a.txt");
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "a");
    expect(() => assertCleanCheckout(repo)).not.toThrow();
    mkdirSync(join(repo, "d"));
    writeFileSync(join(repo, "d/b.txt"), "b\n");
    expect(() => assertCleanCheckout(repo)).toThrow(/not clean/);
    // extract() enforces it by default.
    await expect(extract(loadTarget("chess"), repo, tmp("dirty"))).rejects.toThrow(/not clean/);
  });
});
