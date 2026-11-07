import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureIndexed } from "../../app/src/lib/content/index-builder";
import type { Db } from "../../app/src/lib/db/handle";
import { migrationsDir, openDb } from "../../app/src/lib/db/open";
import { filterCatalog, loadCatalog } from "../../app/src/lib/server/catalog";
import { extractPayload, tmp } from "../helpers/content-fixtures";

// The sidebar's data, from the real python payload. Expected groups, orders, labels and tags are
// read from the payload's catalog.json, never hard-coded.
const MIGRATIONS = migrationsDir(join(import.meta.dir, "..", ".."));

type Bi = { en: string; zh: string };
interface PackCatalog {
  items: { id: string; group: string; order: number; title: Bi; tag?: Bi; version: string }[];
  groups: { id: string; label: Bi }[];
}

let PACK: PackCatalog;
let PAYLOAD = "";
let db: Db;

beforeAll(async () => {
  PAYLOAD = await extractPayload("python");
  PACK = JSON.parse(readFileSync(join(PAYLOAD, "catalog.json"), "utf8"));
  db = openDb(tmp("shell-db"), { migrationsDir: MIGRATIONS });
  ensureIndexed(db, { dir: PAYLOAD, version: "1.0.0", source: "manual" });
}, 60_000);

afterAll(() => db.close());

describe("loadCatalog", () => {
  test("groups in the pack's order, with both labels; items grouped and in registry order", () => {
    const groups = loadCatalog(db);
    expect(groups.map((g) => g.id)).toEqual(PACK.groups.map((g) => g.id));
    expect(groups.map((g) => g.label)).toEqual(PACK.groups.map((g) => g.label));
    for (const g of groups) {
      const want = PACK.items
        .filter((i) => i.group === g.id)
        .sort((a, b) => a.order - b.order)
        .map((i) => i.id);
      expect(g.items.map((i) => i.id)).toEqual(want);
    }
    expect(groups.flatMap((g) => g.items).length).toBe(PACK.items.length);
  });

  test("each item carries its titles, version, and tag (null when the pack has none)", () => {
    const byId = new Map(
      loadCatalog(db)
        .flatMap((g) => g.items)
        .map((i) => [i.id, i]),
    );
    for (const it of PACK.items) {
      const got = byId.get(it.id);
      expect(got?.title).toEqual(it.title);
      expect(got?.version).toBe(it.version);
      expect(got?.tag ?? null).toEqual(it.tag ?? null);
    }
  });

  test("an empty database → no groups", () => {
    const empty = openDb(tmp("shell-empty"), { migrationsDir: MIGRATIONS });
    expect(loadCatalog(empty)).toEqual([]);
    empty.close();
  });
});

describe("upgrading a database indexed before catalog_groups existed", () => {
  test("0002 forgets content_state, so the same pack is indexed again with groups and tags", () => {
    // the shipped migrations as they were before 0002
    const old = join(tmp("shell-mig"), "drizzle");
    cpSync(MIGRATIONS, old, { recursive: true });
    const journalFile = join(old, "meta", "_journal.json");
    const journal = JSON.parse(readFileSync(journalFile, "utf8"));
    const at = journal.entries.findIndex((e: { tag: string }) => e.tag === "0002_catalog_groups");
    expect(at).toBeGreaterThan(0);
    writeFileSync(
      journalFile,
      JSON.stringify({ ...journal, entries: journal.entries.slice(0, at) }),
    );

    const dir = tmp("shell-upgrade");
    const before = openDb(dir, { migrationsDir: old });
    // index the pack the way the pre-0002 code did (only what its schema had)
    before
      .prepare(
        "INSERT INTO content_state (id, addon_version, addon_source, mv_sha) VALUES (1, '1.0.0', 'manual', NULL)",
      )
      .run();
    before.close();

    const after = openDb(dir, { migrationsDir: MIGRATIONS });
    expect(after.prepare("SELECT count(*) AS n FROM content_state").get<{ n: number }>()?.n).toBe(
      0,
    );
    expect(ensureIndexed(after, { dir: PAYLOAD, version: "1.0.0", source: "manual" })).toBe(true);
    expect(loadCatalog(after).map((g) => g.id)).toEqual(PACK.groups.map((g) => g.id));
    after.close();
  });
});

describe("a catalog with no items", () => {
  test("is refused at index time; the old index stays", () => {
    const dir = join(tmp("shell-noitems"), "payload");
    cpSync(PAYLOAD, dir, { recursive: true });
    writeFileSync(join(dir, "catalog.json"), JSON.stringify({ ...PACK, items: [], groups: [] }));
    const d = openDb(tmp("shell-noitems-db"), { migrationsDir: MIGRATIONS });
    expect(ensureIndexed(d, { dir: PAYLOAD, version: "1.0.0", source: "manual" })).toBe(true);
    expect(() => ensureIndexed(d, { dir, version: "1.0.1", source: "manual" })).toThrow();
    expect(loadCatalog(d).flatMap((g) => g.items).length).toBe(PACK.items.length);
    d.close();
  });
});

describe("filterCatalog (⌘K)", () => {
  test("an empty query keeps everything", () => {
    const all = loadCatalog(db).flatMap((g) => g.items);
    expect(filterCatalog(all, "", "en")).toEqual(all);
  });

  test("matches the title in the current language, case-insensitively", () => {
    const all = loadCatalog(db).flatMap((g) => g.items);
    const first = all[0];
    if (!first) throw new Error("no items");
    const q = first.title.en.slice(0, 6).toUpperCase();
    const got = filterCatalog(all, q, "en");
    expect(got.map((i) => i.id)).toContain(first.id);
    for (const i of got) {
      const hay = `${i.title.en} ${i.tag?.en ?? ""}`.toLowerCase();
      expect(hay).toContain(q.toLowerCase());
    }
    expect(filterCatalog(all, first.title.zh, "zh").map((i) => i.id)).toContain(first.id);
  });

  test("matches the tag", () => {
    const all = loadCatalog(db).flatMap((g) => g.items);
    // a word of some tag that is in no title: only the tag can make it match
    const titles = all.map((i) => i.title.en.toLowerCase()).join("\n");
    let hit: { id: string; word: string } | null = null;
    for (const i of all) {
      for (const w of (i.tag?.en ?? "").split(/[^A-Za-z]+/)) {
        if (w.length >= 5 && !titles.includes(w.toLowerCase())) hit ??= { id: i.id, word: w };
      }
    }
    expect(hit).not.toBeNull();
    const h = hit as { id: string; word: string };
    expect(filterCatalog(all, h.word, "en").map((i) => i.id)).toContain(h.id);
  });

  test("nothing matches → empty", () => {
    const all = loadCatalog(db).flatMap((g) => g.items);
    expect(filterCatalog(all, "\u0000no-such-thing\u0000", "en")).toEqual([]);
  });
});
