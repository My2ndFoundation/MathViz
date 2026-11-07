import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import type { InstalledAddon } from "../../app/src/lib/addons/client";
import { ensureIndexed, stripBlanks } from "../../app/src/lib/content/index-builder";
import { findContent } from "../../app/src/lib/content/installed";
import { importAddonFile } from "../../app/src/lib/content/manual-import";
import { searchLibrary } from "../../app/src/lib/content/search";
import type { Db } from "../../app/src/lib/db/handle";
import { migrationsDir, openDb } from "../../app/src/lib/db/open";
import { loadTarget } from "../../app/src/lib/target";
import { extract } from "../../extract/index";

// Input: the real python payload, extracted from this checkout. Every expected count is derived
// from that payload, never hard-coded: a page added to the web version must not turn this red.
const MV = resolve(process.env.MATHVIZ_PATH ?? join(import.meta.dir, "../../.."));
const PY = loadTarget("python");
const APP_ID = PY.appId;
const MIGRATIONS = migrationsDir(join(import.meta.dir, "..", ".."));
const tmp = (tag: string) => mkdtempSync(join(tmpdir(), `pfapp-content-${tag}-`));

let PAYLOAD = "";
let ITEMS = 0;
let SOURCES = 0;
const dbs: Db[] = [];

beforeAll(async () => {
  const out = tmp("payload");
  await extract(PY, MV, out, { requireClean: false });
  PAYLOAD = join(out, "payload");
  ITEMS = (JSON.parse(readFileSync(join(PAYLOAD, "catalog.json"), "utf8")).items as unknown[])
    .length;
  SOURCES = readdirSync(join(PAYLOAD, "source")).filter((f) => f.endsWith(".json")).length;
}, 60_000);

afterAll(() => {
  for (const db of dbs) db.close();
});

function freshDb(): Db {
  const db = openDb(tmp("db"), { migrationsDir: MIGRATIONS });
  dbs.push(db);
  return db;
}

// ---- fixtures: a store-installed add-on (PFD's layout) and a .pfaddon file ---------------------

const addonJson = (version: string, over: Record<string, unknown> = {}) =>
  JSON.stringify({
    format: 1,
    id: `${APP_ID}/content`,
    appId: APP_ID,
    version,
    kind: "content",
    title: "MathViz Python content",
    unpackedBytes: 1024 * 1024 * 1024,
    ...over,
  });

/** PFD's app-installer layout under PRIMEFORGE_ADDONS_DIR (= <addonsRoot>/<appId>). */
function storeInstall(addonsDir: string, version: string): InstalledAddon {
  const dir = join(addonsDir, "content", version);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "addon.json"), addonJson(version));
  cpSync(PAYLOAD, join(dir, "payload"), { recursive: true });
  return {
    addonId: `${APP_ID}/content`,
    kind: "content",
    version,
    path: join(dir, "payload"),
  };
}

const fakeClient = (list: InstalledAddon[] | "unsupported") => ({
  installed: async () => list,
});

/** A raw ustar header: no path checks, any typeflag (so tests can build hostile archives). */
function header(path: string, size: number, type: string, link = ""): Buffer {
  const h = Buffer.alloc(512);
  h.write(path, 0, 100, "utf8");
  h.write("0000644\0", 100, 8, "latin1");
  h.write("0000000\0", 108, 8, "latin1");
  h.write("0000000\0", 116, 8, "latin1");
  h.write(`${size.toString(8).padStart(11, "0")}\0`, 124, 12, "latin1");
  h.write("00000000000\0", 136, 12, "latin1");
  h.write(type, 156, 1, "latin1");
  h.write(link, 157, 100, "utf8");
  h.write("ustar\0", 257, 6, "latin1");
  h.write("00", 263, 2, "latin1");
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 0x20 : (h[i] as number);
  h.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, 8, "latin1");
  return h;
}

type Entry = { path: string; data?: Buffer; type?: string; link?: string };

function tarOf(entries: Entry[]): Buffer {
  const blocks: Buffer[] = [];
  for (const e of entries) {
    const data = e.data ?? Buffer.alloc(0);
    blocks.push(header(e.path, data.length, e.type ?? (e.data ? "0" : "5"), e.link));
    if (data.length) {
      const padded = Buffer.alloc(Math.ceil(data.length / 512) * 512);
      data.copy(padded);
      blocks.push(padded);
    }
  }
  blocks.push(Buffer.alloc(1024));
  return Buffer.concat(blocks);
}

/** Payload-relative paths under dir, directories with a trailing slash, sorted. */
function walk(dir: string, base = ""): string[] {
  const out: string[] = [];
  for (const e of readdirSync(join(dir, base), { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(`${rel}/`, ...walk(dir, rel));
    else out.push(rel);
  }
  return out.sort();
}

/** The real payload as a .pfaddon, plus optional extra (hostile) entries. */
function pfaddon(version: string, over: Record<string, unknown> = {}, extra: Entry[] = []): string {
  const entries: Entry[] = [
    { path: "addon.json", data: Buffer.from(addonJson(version, over)) },
    { path: "payload/" },
  ];
  for (const rel of walk(PAYLOAD)) {
    entries.push(
      rel.endsWith("/")
        ? { path: `payload/${rel}` }
        : { path: `payload/${rel}`, data: readFileSync(join(PAYLOAD, rel)) },
    );
  }
  entries.push(...extra);
  const file = join(tmp("pfaddon"), `content-${version}.pfaddon`);
  writeFileSync(file, gzipSync(tarOf(entries)));
  return file;
}

// ---- findContent ---------------------------------------------------------------------------------

describe("findContent", () => {
  test("版本取高: store 1.0.3 vs manual 1.0.4 → manual; then store 1.0.5 → store", async () => {
    const dataDir = tmp("data");
    const addonsDir = tmp("addons");
    const installed = [storeInstall(addonsDir, "1.0.3")];
    expect(await importAddonFile(pfaddon("1.0.4"), dataDir, APP_ID)).toBe("1.0.4");
    const env = { appId: APP_ID, dataDir, addonsDir, addons: fakeClient(installed) };

    const first = await findContent(env);
    expect(first?.source).toBe("manual");
    expect(first?.version).toBe("1.0.4");
    expect(existsSync(join(first?.dir as string, "catalog.json"))).toBe(true);

    installed.splice(0, 1, storeInstall(addonsDir, "1.0.5"));
    const second = await findContent(env);
    expect(second).toEqual({
      dir: installed[0]?.path as string,
      version: "1.0.5",
      source: "store",
    });
  });

  test("semver, not string order: 1.0.10 beats 1.0.9", async () => {
    const dataDir = tmp("data");
    const addonsDir = tmp("addons");
    await importAddonFile(pfaddon("1.0.9"), dataDir, APP_ID);
    const env = {
      appId: APP_ID,
      dataDir,
      addonsDir,
      addons: fakeClient([storeInstall(addonsDir, "1.0.10")]),
    };
    expect((await findContent(env))?.source).toBe("store");
  });

  test("nothing installed → null; unsupported desktop → manual only", async () => {
    const dataDir = tmp("data");
    expect(await findContent({ appId: APP_ID, dataDir, addons: null })).toBeNull();
    expect(
      await findContent({ appId: APP_ID, dataDir, addons: fakeClient("unsupported") }),
    ).toBeNull();
    await importAddonFile(pfaddon("1.0.1"), dataDir, APP_ID);
    expect(
      (await findContent({ appId: APP_ID, dataDir, addons: fakeClient("unsupported") }))?.version,
    ).toBe("1.0.1");
  });

  test("a store row that is not ours, not the content pack, or outside PRIMEFORGE_ADDONS_DIR is ignored", async () => {
    const dataDir = tmp("data");
    const addonsDir = tmp("addons");
    const elsewhere = tmp("elsewhere");
    const good = storeInstall(addonsDir, "1.0.0");
    const outside = storeInstall(elsewhere, "2.0.0");
    const rows: InstalledAddon[] = [
      { ...good, version: "3.0.0", addonId: "app.primeforge.mathviz.math/content" },
      { ...good, version: "3.0.1", addonId: `${APP_ID}/other` },
      outside,
      { ...good, version: "3.0.2", path: "relative/payload" },
      good,
    ];
    const env = { appId: APP_ID, dataDir, addonsDir, addons: fakeClient(rows) };
    expect(await findContent(env)).toEqual({ dir: good.path, version: "1.0.0", source: "store" });
  });

  test("a symlinked payload directory is ignored", async () => {
    const dataDir = tmp("data");
    const addonsDir = tmp("addons");
    const real = storeInstall(addonsDir, "1.0.0");
    const link = join(addonsDir, "content", "9.9.9");
    mkdirSync(link, { recursive: true });
    symlinkSync(real.path, join(link, "payload"));
    const rows = [{ ...real, version: "9.9.9", path: join(link, "payload") }];
    expect(
      await findContent({ appId: APP_ID, dataDir, addonsDir, addons: fakeClient(rows) }),
    ).toBeNull();
  });
});

// ---- importAddonFile -------------------------------------------------------------------------------

describe("importAddonFile", () => {
  test("unpacks to addons-manual/<ver>/ with addon.json and payload/", async () => {
    const dataDir = tmp("data");
    const v = await importAddonFile(pfaddon("1.2.3"), dataDir, APP_ID);
    expect(v).toBe("1.2.3");
    const root = join(dataDir, "addons-manual", "1.2.3");
    expect(JSON.parse(readFileSync(join(root, "addon.json"), "utf8")).version).toBe("1.2.3");
    expect(walk(join(root, "payload"))).toEqual(walk(PAYLOAD));
    expect(readFileSync(join(root, "payload/catalog.json"))).toEqual(
      readFileSync(join(PAYLOAD, "catalog.json")),
    );
  });

  const refused = async (file: string, reason?: RegExp) => {
    const dataDir = tmp("data");
    await expect(importAddonFile(file, dataDir, APP_ID)).rejects.toThrow(reason);
    const manual = join(dataDir, "addons-manual");
    expect(existsSync(manual) ? readdirSync(manual).filter((n) => !n.startsWith(".")) : []).toEqual(
      [],
    );
  };

  test("导入拒收别的应用的包: appId mismatch throws, nothing installed", async () => {
    const other = "app.primeforge.mathviz.math";
    await refused(
      pfaddon("1.0.0", { appId: other, id: `${other}/content` }),
      /is for app\.primeforge\.mathviz\.math,/,
    );
  });

  test("not the content pack (another slug of our app) is refused", async () => {
    await refused(pfaddon("1.0.0", { id: `${APP_ID}/extras` }));
  });

  test("hostile entries are refused: .., absolute, symlink", async () => {
    await refused(
      pfaddon("1.0.0", {}, [{ path: "payload/../../evil.txt", data: Buffer.from("x") }]),
    );
    await refused(pfaddon("1.0.0", {}, [{ path: "/tmp/evil.txt", data: Buffer.from("x") }]));
    await refused(pfaddon("1.0.0", {}, [{ path: "payload/link", type: "2", link: "/etc/passwd" }]));
  });

  test("not gzip is refused", async () => {
    const f = join(tmp("bad"), "x.pfaddon");
    writeFileSync(f, "not an archive");
    await refused(f);
  });
});

// ---- ensureIndexed --------------------------------------------------------------------------------

const count = (db: Db, table: string) =>
  (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;

describe("ensureIndexed", () => {
  test("重建: a new version rebuilds; the same version does not", () => {
    const db = freshDb();
    expect(ensureIndexed(db, { dir: PAYLOAD, version: "1.0.0", source: "store" })).toBe(true);
    expect(ITEMS).toBeGreaterThan(0);
    expect(SOURCES).toBeGreaterThan(0);
    expect(count(db, "catalog_items")).toBe(ITEMS);
    expect(count(db, "library_docs")).toBe(ITEMS + SOURCES);
    expect(
      (
        db.prepare("SELECT count(*) AS n FROM library_docs WHERE kind = 'program'").get() as {
          n: number;
        }
      ).n,
    ).toBe(SOURCES);
    const state = db
      .prepare("SELECT addon_version, addon_source FROM content_state WHERE id = 1")
      .get();
    expect(state).toEqual({ addon_version: "1.0.0", addon_source: "store" });

    // Same version: no rebuild — a row removed behind its back stays removed.
    db.prepare(
      "DELETE FROM catalog_items WHERE rowid = (SELECT min(rowid) FROM catalog_items)",
    ).run();
    expect(ensureIndexed(db, { dir: PAYLOAD, version: "1.0.0", source: "store" })).toBe(false);
    expect(count(db, "catalog_items")).toBe(ITEMS - 1);

    // New version: full rebuild, counts restored, fts consistent with its content table.
    expect(ensureIndexed(db, { dir: PAYLOAD, version: "1.0.1", source: "manual" })).toBe(true);
    expect(count(db, "catalog_items")).toBe(ITEMS);
    expect(count(db, "library_docs")).toBe(ITEMS + SOURCES);
    db.exec("INSERT INTO library_fts(library_fts, rank) VALUES('integrity-check', 1)");
  });
});

// ---- searchLibrary --------------------------------------------------------------------------------

const BLANK_OPEN = /^\s*#\s*>>>\s*BLANK\s+(.*)$/;
const BLANK_CLOSE = /^\s*#\s*<<<\s*BLANK\s*$/;

/** Every blanked answer line (trimmed) and every BLANK directive line, per program, from the payload. */
function blanks(): { id: string; answers: string[]; directives: string[]; source: string }[] {
  const dir = join(PAYLOAD, "source");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const p = JSON.parse(readFileSync(join(dir, f), "utf8")) as { id: string; source: string };
      const answers: string[] = [];
      const directives: string[] = [];
      let inBlank = false;
      for (const line of p.source.split("\n")) {
        if (BLANK_OPEN.test(line)) {
          inBlank = true;
          directives.push(line.trim());
        } else if (BLANK_CLOSE.test(line)) inBlank = false;
        else if (inBlank && line.trim() !== "") answers.push(line.trim());
      }
      return { id: p.id, answers, directives, source: p.source };
    });
}

describe("searchLibrary", () => {
  let db: Db;
  beforeAll(() => {
    db = freshDb();
    ensureIndexed(db, { dir: PAYLOAD, version: "1.0.0", source: "store" });
  });

  test("两字中文 and English: 递归 and recursion both find something", () => {
    const zh = searchLibrary(db, "递归");
    expect(zh.length).toBeGreaterThan(0);
    expect(zh.length).toBeLessThanOrEqual(8);
    for (const r of zh) expect(r.id).toMatch(/^(tool|program):/);
    expect(searchLibrary(db, "recursion").length).toBeGreaterThan(0);
    expect(searchLibrary(db, "Recursion").length).toBeGreaterThan(0);
    expect(searchLibrary(db, "递归", 3).length).toBeLessThanOrEqual(3);
  });

  test("terms combine with AND, short and long alike", () => {
    const both = searchLibrary(db, "递归 recursion", 1000).map((r) => r.id);
    const zh = new Set(searchLibrary(db, "递归", 1000).map((r) => r.id));
    const en = new Set(searchLibrary(db, "recursion", 1000).map((r) => r.id));
    expect(both.length).toBeGreaterThan(0);
    for (const id of both) expect(zh.has(id) && en.has(id)).toBe(true);
    // the short term must still narrow a long one (Task 5's probe: inside one trigram query it did not)
    const narrowed = searchLibrary(db, "recursion zz", 1000);
    expect(narrowed.length).toBeLessThan(en.size);
  });

  test("user input never reaches fts5 as syntax; LIKE wildcards are literal", () => {
    for (const q of ['"', 'a"b"c', "NOT AND OR", "(((", "x*", "col:val", "-", "^abc"]) {
      expect(() => searchLibrary(db, q)).not.toThrow();
    }
    expect(searchLibrary(db, "")).toEqual([]);
    expect(searchLibrary(db, "   ")).toEqual([]);
    // "_" as a LIKE wildcard would match every document; literal it matches only those holding it
    const all = count(db, "library_docs");
    const under = searchLibrary(db, "_%", 10_000);
    expect(under.length).toBeLessThan(all);
  });

  test("stripBlanks removes exactly the blanked regions and their directive lines", () => {
    const progs = blanks();
    let removed = 0;
    for (const p of progs) {
      // independent split: lines outside every BLANK region, directives excluded
      const outside: string[] = [];
      let inBlank = false;
      for (const line of p.source.split("\n")) {
        if (BLANK_OPEN.test(line)) inBlank = true;
        else if (BLANK_CLOSE.test(line)) inBlank = false;
        else if (!inBlank) outside.push(line);
      }
      const got = stripBlanks(p.source);
      expect(got.kept).toBe(outside.join("\n"));
      expect(got.answers).toEqual(p.answers);
      removed += p.source.split("\n").length - outside.length;
    }
    expect(removed).toBeGreaterThan(0);
  });

  test("检索不泄题: no indexed body, and no snippet, holds a blanked answer line", () => {
    const progs = blanks();
    const long = progs.flatMap((p) =>
      p.answers.filter((a) => [...a].length >= 12).map((a) => ({ id: p.id, a, p })),
    );
    expect(long.length).toBeGreaterThan(0);
    const bodies = db.prepare("SELECT id, body FROM library_docs").all() as {
      id: string;
      body: string;
    }[];
    const byId = new Map(bodies.map((b) => [b.id, b.body]));
    for (const { id, a, p } of long) {
      // control: the payload itself does carry the answer (else this loop would prove nothing)
      expect(p.source.includes(a)).toBe(true);
      expect(byId.get(`program:${id}`)?.includes(a)).toBe(false);
    }
    // directives (which carry the hints) are not indexed either
    for (const p of progs)
      for (const d of p.directives) expect(byId.get(`program:${p.id}`)?.includes(d)).toBe(false);
    // and across all documents: searching for the answer itself never shows it in a snippet
    for (const { a } of long) {
      for (const r of searchLibrary(db, a, 20)) expect(r.snippet.includes(a)).toBe(false);
    }
    // the program's own text is still searchable (notes are kept)
    expect(byId.get(`program:${progs[0]?.id}`)?.length).toBeGreaterThan(0);
  });

  test("snippets come from the matching text", () => {
    const [hit] = searchLibrary(db, "递归");
    expect(hit?.snippet.length).toBeGreaterThan(0);
    const [en] = searchLibrary(db, "recursion");
    expect(
      en?.snippet.toLowerCase().includes("recursion") ||
        en?.title.toLowerCase().includes("recursion"),
    ).toBe(true);
  });
});
