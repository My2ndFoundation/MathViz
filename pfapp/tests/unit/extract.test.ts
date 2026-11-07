import { beforeAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadTarget, type TargetId } from "../../app/src/lib/target";
import { assertCleanCheckout, extract } from "../../extract/index";
import { readGroupLabels } from "../../extract/labels";
import { readPythonSources } from "../../extract/python-source";

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

const IDS: TargetId[] = ["math", "chess", "crypto", "python"];

// Expected counts are derived from the web version itself, never hard-coded: adding a page to
// the web version must not turn pfapp's gate red. The group field names are restated here on
// purpose (independent of catalog.ts): tools.json says `category`, the subprojects match.
const REG_FIELD: Record<TargetId, string> = {
  math: "category",
  chess: "phase",
  crypto: "chapter",
  python: "module",
};
const registryOf = (id: TargetId) =>
  JSON.parse(readFileSync(join(MV, loadTarget(id).registry), "utf8")).tools as Record<
    string,
    unknown
  >[];
const expected = (id: TargetId) => {
  const reg = registryOf(id);
  return { tools: reg.length, groups: new Set(reg.map((e) => String(e[REG_FIELD[id]]))).size };
};
/** Program entries across every python chapter.json whose tool is registered. */
function expectedPrograms(): number {
  const tools = new Set(registryOf("python").map((e) => e.id));
  const root = join(MV, "python/programs");
  let n = 0;
  for (const ch of readdirSync(root).filter((d) => d.startsWith("ch"))) {
    const c = JSON.parse(readFileSync(join(root, ch, "chapter.json"), "utf8"));
    if (tools.has(c.tool)) n += c.programs.length;
  }
  return n;
}

const outs = {} as Record<TargetId, { dir: string; fingerprint: string; files: string[] }>;

beforeAll(async () => {
  for (const id of IDS) {
    const dir = tmp(id);
    const r = await extract(loadTarget(id), MV, dir, NO_CLEAN);
    expect(r.tools).toBe(expected(id).tools);
    outs[id] = { dir, fingerprint: r.fingerprint, files: r.files };
  }
}, 60_000);

const catalogOf = (id: TargetId): Catalog =>
  JSON.parse(readFileSync(join(outs[id].dir, "payload/catalog.json"), "utf8"));

describe("catalog", () => {
  for (const id of IDS) {
    test(`${id}: one item per registry entry, one group per group value, files byte-identical`, () => {
      const want = expected(id);
      expect(want.tools).toBeGreaterThan(0);
      const t = loadTarget(id);
      const cat = catalogOf(id);
      expect(cat.target).toBe(id);
      expect(cat.items.length).toBe(want.tools);
      expect(cat.groups.length).toBe(want.groups);
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
      expect(toolFiles.length).toBe(want.tools);
    });
  }

  test("files outside the registry are not packed", () => {
    expect(walk(join(outs.python.dir, "payload")).some((f) => f.includes("_skeleton"))).toBe(false);
  });
});

describe("group labels", () => {
  // No label text is restated here (a relabel on the web must not break pfapp). Every group value
  // in the registry has a label; that the labels come from the page (not the extractor) is shown
  // below by relabelling a copy of the page. No "occurs verbatim on the page" check: a label
  // written with an escape in source evaluates to a string the raw page does not contain.
  const PAGE: Record<TargetId, string> = {
    math: "index.html",
    chess: "chess/app.html",
    crypto: "cryptography/app.html",
    python: "python/app.html",
  };
  for (const id of IDS) {
    test(`${id}: every registry group has a label taken from ${PAGE[id]}`, () => {
      const labels = readGroupLabels(loadTarget(id), MV);
      for (const g of new Set(registryOf(id).map((e) => String(e[REG_FIELD[id]])))) {
        const l = labels[g];
        expect(l).toBeDefined();
        expect((l?.en.length ?? 0) > 0 && (l?.zh.length ?? 0) > 0).toBe(true);
      }
    });
  }

  test("the page's literal is what the labels are, escapes and either quote style included", () => {
    // A synthetic page, not chess/app.html: how the web version happens to quote its labels today
    // is the web version's business (a reformat there must not turn this red).
    const mv = tmp("relabel");
    mkdirSync(join(mv, "chess"), { recursive: true });
    const page = [
      "<script>",
      "var NOT_IT = { 1: { en: 'decoy', zh: '诱饵' } };",
      "// a comment with a { brace and a 'quote",
      "var PHASE_LABELS = {",
      "  1: { en: 'Bob\\'s \\u00b7 X', zh: '阶段 1' },",
      '  2: { en: "Say \\"hi\\" } ]", zh: "阶段 \\u4e8c" }, /* } */',
      "  3: { en: `Back`, zh: '三' },",
      "};",
      "var AFTER = { 1: { en: 'not this either', zh: '也不是' } };",
      "</script>",
    ].join("\n");
    writeFileSync(join(mv, "chess/app.html"), page);
    expect(readGroupLabels(loadTarget("chess"), mv)).toEqual({
      "1": { en: "Bob's \u00b7 X", zh: "阶段 1" },
      "2": { en: 'Say "hi" } ]', zh: "阶段 二" },
      "3": { en: "Back", zh: "三" },
    });
  });
});

describe("python source", () => {
  test("one source per registered program, none carries run", () => {
    const dir = join(outs.python.dir, "payload/source");
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);
    expect(files.length).toBe(expectedPrograms());
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

  test("non-python targets have no source/ in phase 1", () => {
    expect(walk(join(outs.math.dir, "payload")).some((f) => f.startsWith("source/"))).toBe(false);
  });
});

describe("python source completeness", () => {
  // A throwaway python/programs tree: one good chapter, then the two ways a registered tool
  // can end up with missing sources.
  function fakeMv(): string {
    const mv = tmp("pyfake");
    const ch = join(mv, "python/programs/ch01-a");
    mkdirSync(ch, { recursive: true });
    writeFileSync(
      join(ch, "chapter.json"),
      JSON.stringify({ module: 1, tool: "py-a", programs: [{ id: "p1", file: "p1.py" }] }),
    );
    writeFileSync(join(ch, "p1.py"), "print(1)\n");
    return mv;
  }

  test("a complete tree passes", () => {
    expect(readPythonSources(fakeMv(), new Map([["py-a", 1]])).map((p) => p.id)).toEqual(["p1"]);
  });

  test("a registered tool with no chapter throws, naming the tool", () => {
    expect(() =>
      readPythonSources(
        fakeMv(),
        new Map<string, number | undefined>([
          ["py-a", 1],
          ["py-ghost", undefined],
        ]),
      ),
    ).toThrow(/py-ghost/);
  });

  test("a chapter naming a missing .py throws, naming the tool", () => {
    const mv = fakeMv();
    const ch = join(mv, "python/programs/ch01-a");
    writeFileSync(
      join(ch, "chapter.json"),
      JSON.stringify({
        module: 1,
        tool: "py-a",
        programs: [
          { id: "p1", file: "p1.py" },
          { id: "p2", file: "p2.py" },
        ],
      }),
    );
    expect(() => readPythonSources(mv, new Map([["py-a", 2]]))).toThrow(/py-a.*p2/);
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
