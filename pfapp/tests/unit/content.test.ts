import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import type { InstalledAddon } from "../../app/src/lib/addons/client";
import { ensureIndexed, stripBlanks } from "../../app/src/lib/content/index-builder";
import { findContent } from "../../app/src/lib/content/installed";
import { importAddonFile } from "../../app/src/lib/content/manual-import";
import { searchLibrary } from "../../app/src/lib/content/search";
import type { Db } from "../../app/src/lib/db/handle";
import { migrationsDir, openDb } from "../../app/src/lib/db/open";
import { loadTarget } from "../../app/src/lib/target";
import {
  addonJson as addonJsonFor,
  buildPfaddon,
  type Entry,
  extractPayload,
  tmp,
  walk,
} from "../helpers/content-fixtures";

// Input: the real python payload, extracted from this checkout. Every expected count is derived
// from that payload, never hard-coded: a page added to the web version must not turn this red.
const PY = loadTarget("python");
const APP_ID = PY.appId;
const MIGRATIONS = migrationsDir(join(import.meta.dir, "..", ".."));

let PAYLOAD = "";
let ITEMS = 0;
let SOURCES = 0;
const dbs: Db[] = [];

beforeAll(async () => {
  PAYLOAD = await extractPayload("python");
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
  addonJsonFor(APP_ID, version, { title: "MathViz Python content", ...over });

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

/** The real payload as a .pfaddon, plus optional extra (hostile) entries. */
const pfaddon = (version: string, over: Record<string, unknown> = {}, extra: Entry[] = []) =>
  buildPfaddon(PAYLOAD, APP_ID, version, over, extra);

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

  test("fail closed: store rows without PRIMEFORGE_ADDONS_DIR are not used (manual still is)", async () => {
    const dataDir = tmp("data");
    const somewhere = tmp("somewhere");
    const rows = [storeInstall(somewhere, "5.0.0")];
    const events: string[] = [];
    const log = (e: string) => events.push(e);
    for (const addonsDir of [undefined, null, "", "  "]) {
      expect(
        await findContent({ appId: APP_ID, dataDir, addonsDir, addons: fakeClient(rows), log }),
      ).toBeNull();
    }
    await importAddonFile(pfaddon("1.0.0"), dataDir, APP_ID);
    const found = await findContent({ appId: APP_ID, dataDir, addons: fakeClient(rows), log });
    expect(found?.source).toBe("manual");
    expect(found?.version).toBe("1.0.0");
    // the same rows are accepted once the root is named
    expect(
      (
        await findContent({
          appId: APP_ID,
          dataDir,
          addonsDir: somewhere,
          addons: fakeClient(rows),
        })
      )?.version,
    ).toBe("5.0.0");
    expect(events.filter((e) => e === "content.store_no_addons_dir").length).toBeLessThanOrEqual(1);
  });

  test("a store payload whose catalog.json is a symbolic link is ignored", async () => {
    const dataDir = tmp("data");
    const addonsDir = tmp("addons");
    const row = storeInstall(addonsDir, "1.0.0");
    const real = join(tmp("elsewhere"), "catalog.json");
    cpSync(join(row.path, "catalog.json"), real);
    rmSync(join(row.path, "catalog.json"));
    symlinkSync(real, join(row.path, "catalog.json"));
    expect(
      await findContent({ appId: APP_ID, dataDir, addonsDir, addons: fakeClient([row]) }),
    ).toBeNull();
  });
});

// ---- importAddonFile -------------------------------------------------------------------------------

describe("importAddonFile", () => {
  test("reads a .pfaddon written by PFD's own packer (entriesFromDir + writeTar + gzip -9)", async () => {
    // tests/fixtures/pfd-packed-content-0.0.1.pfaddon: PFD 6e5a968 packages/app-installer
    // entriesFromDir + writeTar, then gzipSync level 9 — scripts/pack-addon.ts's own two steps,
    // unsigned. One path is over 100 bytes, so it lands in the ustar prefix field.
    const fixture = join(import.meta.dir, "../fixtures/pfd-packed-content-0.0.1.pfaddon");
    const dataDir = tmp("data");
    expect(await importAddonFile(fixture, dataDir, APP_ID)).toBe("0.0.1");
    const payload = join(dataDir, "addons-manual", "0.0.1", "payload");
    const files = walk(payload).filter((f) => !f.endsWith("/"));
    expect(files).toEqual([
      "catalog.json",
      "provenance.json",
      "source/a-directory-name-long-enough-to-push-the-path-past-the-ustar-name-field/program-with-a-long-name.json",
      "source/hello-name.json",
    ]);
    expect(Buffer.byteLength(`payload/${files[2]}`)).toBeGreaterThan(100);
    expect(JSON.parse(readFileSync(join(payload, files[2] as string), "utf8")).id).toBe(
      "hello-name",
    );
    const found = await findContent({ appId: APP_ID, dataDir, addons: null });
    expect(found).toEqual({ dir: payload, version: "0.0.1", source: "manual" });
  });

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

describe("ensureIndexed refuses symbolic links inside the payload", () => {
  // a program source by position, not by id: a renamed program must not break this
  const firstSource = () =>
    `source/${
      readdirSync(join(PAYLOAD, "source"))
        .filter((f) => f.endsWith(".json"))
        .sort()[0]
    }`;
  for (const which of ["catalog.json", "provenance.json", "a source/ file"]) {
    test(which, () => {
      const rel = which === "a source/ file" ? firstSource() : which;
      const dir = join(tmp("linked"), "payload");
      cpSync(PAYLOAD, dir, { recursive: true });
      const real = join(tmp("real"), basename(rel));
      cpSync(join(dir, rel), real);
      rmSync(join(dir, rel));
      symlinkSync(real, join(dir, rel));
      const db = freshDb();
      expect(ensureIndexed(db, { dir: PAYLOAD, version: "1.0.0", source: "store" })).toBe(true);
      expect(() => ensureIndexed(db, { dir, version: "1.0.1", source: "store" })).toThrow(
        /symbolic link/,
      );
      // the old index stays
      expect(count(db, "catalog_items")).toBe(ITEMS);
      expect(db.prepare("SELECT addon_version FROM content_state").get()).toEqual({
        addon_version: "1.0.0",
      });
    });
  }
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

// ---- the same search on node:sqlite (the packaged app runs under Node 24) -----------------------

const NODE24_LOCAL = "/Users/nickma/.nvm/versions/node/v24.13.0/bin/node";
/** As db.test.ts: MATHVIZ_NODE, else the local v24.13.0, else `node` on PATH; must be >= 24. */
function findNode(): string | null {
  const candidates = [process.env.MATHVIZ_NODE, NODE24_LOCAL, Bun.which("node")].filter(
    (c): c is string => !!c && existsSync(c),
  );
  for (const bin of candidates) {
    const r = spawnSync(bin, ["-p", "process.versions.node"], {
      encoding: "utf8",
      timeout: 10_000,
    });
    if (r.status === 0 && Number(r.stdout.trim().split(".")[0]) >= 24) return bin;
  }
  return null;
}

describe("searchLibrary on node:sqlite", () => {
  const node = findNode();
  if (node === null) {
    test.skip("node:sqlite — skipped: no Node >= 24 binary found; set MATHVIZ_NODE", () => {});
    return;
  }
  test("short, long, two-character Chinese and mixed queries give the same hits as bun:sqlite", async () => {
    const src = join(import.meta.dir, "../../app/src/lib");
    const work = tmp("node");
    const entry = join(work, "entry.ts");
    writeFileSync(
      entry,
      [
        `export { openDb } from ${JSON.stringify(join(src, "db/open.ts"))};`,
        `export { ensureIndexed } from ${JSON.stringify(join(src, "content/index-builder.ts"))};`,
        `export { searchLibrary } from ${JSON.stringify(join(src, "content/search.ts"))};`,
      ].join("\n"),
    );
    const built = await Bun.build({
      entrypoints: [entry],
      target: "node",
      format: "esm",
      outdir: work,
    });
    expect(built.success).toBe(true);
    const queries = ["递归", "recursion", "二分查找", "递归 recursion", "_%", 'a"b'];
    const r = spawnSync(
      node,
      [
        "--input-type=module",
        "-",
        join(work, "entry.js"),
        tmp("ndb"),
        MIGRATIONS,
        PAYLOAD,
        JSON.stringify(queries),
      ],
      {
        input: `const [mod, dataDir, migrationsDir, payload, qs] = process.argv.slice(2);
          const { openDb, ensureIndexed, searchLibrary } = await import(mod);
          const db = openDb(dataDir, { migrationsDir });
          ensureIndexed(db, { dir: payload, version: "1.0.0", source: "store" });
          const out = { backend: db.connection.backend, hits: JSON.parse(qs).map((q) => searchLibrary(db, q, 50)) };
          db.close();
          console.log(JSON.stringify(out));`,
        encoding: "utf8",
        timeout: 30_000,
      },
    );
    expect({ status: r.status, stderr: r.stderr }).toMatchObject({ status: 0 });
    const got = JSON.parse(r.stdout) as { backend: string; hits: { id: string }[][] };
    expect(got.backend).toBe("node:sqlite");
    const db = freshDb();
    ensureIndexed(db, { dir: PAYLOAD, version: "1.0.0", source: "store" });
    for (const [i, q] of queries.entries()) {
      const want = searchLibrary(db, q, 50);
      expect({ q, hits: got.hits[i] }).toEqual({ q, hits: want });
    }
    expect(got.hits[0]?.length).toBeGreaterThan(0);
    expect(got.hits[1]?.length).toBeGreaterThan(0);
    expect(got.hits[3]?.length).toBeGreaterThan(0);
  }, 60_000);
});
