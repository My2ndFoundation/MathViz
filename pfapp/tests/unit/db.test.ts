import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ReadOnlyError } from "../../app/src/lib/db/handle";
import {
  DB_FILE,
  KEEP_BACKUPS,
  listMigrations,
  MigrationError,
  migrationsDir,
  openDb,
} from "../../app/src/lib/db/open";
import { openConnections, SqliteConnection } from "../../app/src/lib/db/sqlite/connection";
import { drizzleSqlite } from "../../app/src/lib/db/sqlite/drizzle";
import { migrate } from "../../app/src/lib/db/sqlite/migrator";

/**
 * fts5 + trigram, checked on each runtime before the schema relied on it (2026-11-07):
 * - bun:sqlite (Bun 1.3.5): `create virtual table t using fts5(x, tokenize='trigram')` works and a
 *   3-character query matches — the first test below.
 * - node:sqlite (Node v24.13.0, /Users/nickma/.nvm/versions/node/v24.13.0/bin/node; also Node v25.4):
 *   the same `new DatabaseSync(':memory:').exec(...)` works and a 3-character query matches — the
 *   "node:sqlite" tests below re-run it, and run the shipped migration files themselves, on a Node
 *   ≥ 24 binary (MATHVIZ_NODE, else that local v24.13.0, else `node` on PATH; CI sets up Node 24).
 *   Without one they skip, and the skipped test's name says why.
 * So `library_fts` is a real fts5 table; Task 6's LIKE path is only for queries under 3 characters.
 */

const DIR = migrationsDir(path.join(import.meta.dir, "..", ".."));
const tmps: string[] = [];
const tmp = () => {
  const d = mkdtempSync(path.join(tmpdir(), "mv-db-"));
  tmps.push(d);
  return d;
};

afterEach(() => {
  for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true });
});

const TABLES = [
  "settings",
  "content_state",
  "catalog_items",
  "library_docs",
  "library_fts",
  "threads",
  "thread_subjects",
  "messages",
  "notes",
  "ai_jobs",
];

const NODE24_LOCAL = "/Users/nickma/.nvm/versions/node/v24.13.0/bin/node";

/** A Node ≥ 24 binary to run node:sqlite checks with, or why there is none. */
function findNode(): { bin: string } | { skip: string } {
  // PrimeForge bundles Node 24, so a 24.x is preferred over a newer `node` on PATH.
  const candidates = [process.env.MATHVIZ_NODE, NODE24_LOCAL, Bun.which("node")].filter(
    (c): c is string => !!c && existsSync(c),
  );
  for (const bin of candidates) {
    const r = spawnSync(bin, ["-p", "process.versions.node"], {
      encoding: "utf8",
      timeout: 10_000,
    });
    const major = Number(r.stdout?.trim().split(".")[0]);
    if (r.status === 0 && major >= 24) return { bin };
  }
  return {
    skip: `no Node >= 24 binary found (tried ${candidates.join(", ") || "nothing"}); set MATHVIZ_NODE`,
  };
}

function runNode(bin: string, script: string, args: string[] = []) {
  return spawnSync(bin, ["--input-type=module", "-", ...args], {
    input: script,
    encoding: "utf8",
    timeout: 20_000,
  });
}

describe("fts5 + trigram support", () => {
  test("bun:sqlite", () => {
    const db = new Database(":memory:");
    db.run("create virtual table t using fts5(x, tokenize='trigram')");
    db.run("insert into t values ('binary search tree'), ('递归函数的基例')");
    expect(db.query("select x from t where t match 'sea'").all()).toEqual([
      { x: "binary search tree" },
    ]);
    expect(db.query("select x from t where t match '递归函'").all()).toEqual([
      { x: "递归函数的基例" },
    ]);
    db.close();
  });

  const node = findNode();
  if ("skip" in node) {
    test.skip(`node:sqlite — skipped: ${node.skip}`, () => {});
  } else {
    test("node:sqlite", () => {
      const r = runNode(
        node.bin,
        `import { DatabaseSync } from "node:sqlite";
         const db = new DatabaseSync(":memory:");
         db.exec("create virtual table t using fts5(x, tokenize='trigram')");
         db.exec("insert into t values ('binary search tree'), ('递归函数的基例')");
         console.log(JSON.stringify([
           db.prepare("select x from t where t match 'sea'").all().map((r) => r.x),
           db.prepare("select x from t where t match '递归函'").all().map((r) => r.x),
         ]));`,
      );
      expect(r.stderr.replace(/^.*ExperimentalWarning.*\n?|^.*--trace-warnings.*\n?/gm, "")).toBe(
        "",
      );
      expect(r.status).toBe(0);
      expect(JSON.parse(r.stdout)).toEqual([["binary search tree"], ["递归函数的基例"]]);
    });

    test("node:sqlite runs the shipped migrations and library_fts matches", () => {
      const statements = listMigrations(DIR).flatMap((m) => m.statements);
      const writeTemp = (name: string, text: string) => {
        const f = path.join(tmp(), name);
        writeFileSync(f, text);
        return f;
      };
      const r = runNode(
        node.bin,
        `import { DatabaseSync } from "node:sqlite";
         import { readFileSync } from "node:fs";
         const statements = JSON.parse(readFileSync(process.argv[2], "utf8"));
         const db = new DatabaseSync(":memory:", { enableForeignKeyConstraints: true });
         for (const s of statements) db.exec(s);
         db.prepare("insert into library_docs (id, kind, title, body) values (?, ?, ?, ?)")
           .run("program:fact", "program", "Factorial", "递归函数的基例 recursion");
         console.log(JSON.stringify(db.prepare(
           "select d.id from library_fts f join library_docs d on d.rowid = f.rowid where library_fts match ?"
         ).all("递归函").map((r) => r.id)));`,
        // A file, not argv: Linux caps one argv element at 128 KiB (MAX_ARG_STRLEN).
        [writeTemp("statements.json", JSON.stringify(statements))],
      );
      expect(r.status).toBe(0);
      expect(JSON.parse(r.stdout)).toEqual(["program:fact"]);
    });

    test("node:sqlite runs openDb itself (bundled for node), twice, and searches", async () => {
      // The app's runtime path: connection.ts's openNode branch, not just the SQL.
      const out = tmp();
      const built = await Bun.build({
        entrypoints: [path.join(import.meta.dir, "../../app/src/lib/db/open.ts")],
        target: "node",
        format: "esm",
        outdir: out,
      });
      expect(built.success).toBe(true);
      const r = runNode(
        node.bin,
        `const { openDb } = await import(process.argv[2]);
         const [dataDir, migrationsDir] = process.argv.slice(3);
         const first = openDb(dataDir, { migrationsDir });
         const backend = first.connection.backend;
         first.prepare("INSERT INTO library_docs (id, kind, title, body) VALUES (?, ?, ?, ?)")
           .run("program:fact", "program", "Factorial", "递归函数的基例");
         first.close();
         const db = openDb(dataDir, { migrationsDir });
         const ids = db.prepare(
           "SELECT d.id FROM library_fts f JOIN library_docs d ON d.rowid = f.rowid WHERE library_fts MATCH ?"
         ).all("递归函").map((r) => r.id);
         const applied = db.prepare("SELECT count(*) AS n FROM __drizzle_migrations").get().n;
         db.close();
         console.log(JSON.stringify({ backend, ids, applied }));`,
        [path.join(out, "open.js"), tmp(), DIR],
      );
      expect(r.status).toBe(0);
      expect(JSON.parse(r.stdout)).toEqual({
        backend: "node:sqlite",
        ids: ["program:fact"],
        applied: listMigrations(DIR).length,
      });
    });
  }
});

describe("openDb", () => {
  test("creates <dataDir>/mathviz.sqlite with every table", () => {
    const dir = tmp();
    const db = openDb(dir, { migrationsDir: DIR });
    try {
      expect(DB_FILE).toBe("mathviz.sqlite");
      expect(existsSync(path.join(dir, "mathviz.sqlite"))).toBe(true);
      const names = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all<{ name: string }>()
        .map((r) => r.name);
      for (const t of TABLES) expect(names).toContain(t);
      expect(db.readOnly).toBe(false);
      expect(db.prepare("PRAGMA journal_mode").get<{ journal_mode: string }>()?.journal_mode).toBe(
        "wal",
      );
    } finally {
      db.close();
    }
  });

  test("the default migrations folder is the shipped one", () => {
    // pfapp/ (tests, `next dev app`) and the packaged install dir (drizzle/ at its root) both resolve.
    expect(migrationsDir(path.join(import.meta.dir, "..", ".."))).toBe(
      path.join(import.meta.dir, "..", "..", "app", "drizzle"),
    );
    expect(migrationsDir(path.join(import.meta.dir, "..", "..", "app"))).toBe(
      path.join(import.meta.dir, "..", "..", "app", "drizzle"),
    );
    expect(listMigrations(DIR).length).toBeGreaterThanOrEqual(1);
    expect(listMigrations(DIR)[0]?.tag).toBe("0000_init");
  });

  test("library_fts follows library_docs (insert, update, delete) and matches 3-char substrings", () => {
    const db = openDb(tmp(), { migrationsDir: DIR });
    try {
      const ins = db.prepare(
        "INSERT INTO library_docs (id, kind, title, body) VALUES (?, ?, ?, ?)",
      );
      ins.run("program:fact", "program", "Factorial", "递归函数的基例 recursion base case");
      ins.run("tool:py-sorting", "tool", "Sorting", "bubble sort and insertion sort");
      const hits = (q: string) =>
        db
          .prepare(
            "SELECT d.id FROM library_fts f JOIN library_docs d ON d.rowid = f.rowid WHERE library_fts MATCH ? ORDER BY d.id",
          )
          .all<{ id: string }>(q)
          .map((r) => r.id);
      expect(hits("递归函")).toEqual(["program:fact"]);
      expect(hits("cursio")).toEqual(["program:fact"]);
      expect(hits("sort")).toEqual(["tool:py-sorting"]);
      expect(hits("Facto")).toEqual(["program:fact"]); // title is indexed too

      db.prepare("UPDATE library_docs SET body = ? WHERE id = ?").run("merge sort", "program:fact");
      expect(hits("递归函")).toEqual([]);
      expect(hits("merge")).toEqual(["program:fact"]);

      db.prepare("DELETE FROM library_docs WHERE id = ?").run("tool:py-sorting");
      expect(hits("sort")).toEqual(["program:fact"]);
      expect(
        db.prepare("INSERT INTO library_fts(library_fts) VALUES('integrity-check')").run().changes,
      ).toBeGreaterThanOrEqual(0);
    } finally {
      db.close();
    }
  });

  test("migrating twice is idempotent: no re-run, no backup, data kept", () => {
    const dir = tmp();
    const first = openDb(dir, { migrationsDir: DIR });
    first.prepare("INSERT INTO settings (key, value) VALUES ('lang', 'zh')").run();
    first.close();
    const second = openDb(dir, { migrationsDir: DIR });
    try {
      expect(
        second.prepare("SELECT count(*) AS n FROM __drizzle_migrations").get<{ n: number }>()?.n,
      ).toBe(listMigrations(DIR).length);
      expect(
        second.prepare("SELECT value FROM settings WHERE key = 'lang'").get<{ value: string }>()
          ?.value,
      ).toBe("zh");
      expect(existsSync(path.join(dir, "backups"))).toBe(false);
    } finally {
      second.close();
    }
    expect(openConnections().filter((c) => c.file.startsWith(dir))).toEqual([]);
  });

  test("drizzle's migrator agrees with openDb's bookkeeping (finds nothing pending)", async () => {
    const dir = tmp();
    openDb(dir, { migrationsDir: DIR }).close();
    const conn = new SqliteConnection(path.join(dir, DB_FILE));
    try {
      await migrate(drizzleSqlite(conn), { migrationsFolder: DIR });
      const r = await conn.execute("SELECT count(*) AS n FROM __drizzle_migrations");
      expect(r.rows[0]?.[0]).toBe(listMigrations(DIR).length);
    } finally {
      conn.close();
    }
  });

  /** A copy of the shipped migrations plus `extra` new ones (a schema change on upgrade). */
  function migrationsPlus(extra: number, start = Date.now()): string {
    const out = path.join(tmp(), "drizzle");
    cpSync(DIR, out, { recursive: true });
    const journalFile = path.join(out, "meta", "_journal.json");
    const journal = JSON.parse(readFileSync(journalFile, "utf8"));
    for (let i = 0; i < extra; i++) {
      const idx = journal.entries.length;
      const tag = `${String(idx).padStart(4, "0")}_extra_${i}`;
      journal.entries.push({ idx, version: "6", when: start + i, tag, breakpoints: true });
      writeFileSync(path.join(out, `${tag}.sql`), `CREATE TABLE extra_${i} (id integer);\n`);
    }
    writeFileSync(journalFile, JSON.stringify(journal));
    return out;
  }

  test("backs up before pending migrations and keeps the newest KEEP_BACKUPS", () => {
    const dir = tmp();
    openDb(dir, { migrationsDir: DIR }).close();
    const upgrades = migrationsPlus(KEEP_BACKUPS + 2);
    const journal = JSON.parse(readFileSync(path.join(upgrades, "meta", "_journal.json"), "utf8"));
    // One more migration per open: each open finds one pending and backs up first.
    for (let n = 1; n <= KEEP_BACKUPS + 2; n++) {
      const step = path.join(tmp(), "drizzle");
      cpSync(upgrades, step, { recursive: true });
      const shipped = listMigrations(DIR).length;
      writeFileSync(
        path.join(step, "meta", "_journal.json"),
        JSON.stringify({ ...journal, entries: journal.entries.slice(0, shipped + n) }),
      );
      let t = 0;
      openDb(dir, {
        migrationsDir: step,
        now: () => new Date(Date.UTC(2026, 10, 7, 9, 0, n, t++)).toISOString(),
      }).close();
    }
    const backups = readdirSync(path.join(dir, "backups")).sort();
    expect(backups.length).toBe(KEEP_BACKUPS);
    for (const f of backups) expect(f).toMatch(/^mathviz-\d+-\d{8}T\d{9}Z(?:-\d+)?\.sqlite$/);
    // The oldest two were rotated out; the newest names the schema it was taken at.
    const shipped = listMigrations(DIR).length;
    expect(backups.at(-1)).toStartWith(`mathviz-${shipped + KEEP_BACKUPS + 1}-`);
    // A backup is a real database at that schema.
    const b = new Database(path.join(dir, "backups", backups.at(-1) as string), { readonly: true });
    expect(b.query("SELECT count(*) AS n FROM __drizzle_migrations").get()).toEqual({
      n: shipped + KEEP_BACKUPS + 1,
    });
    b.close();
  });

  test("an applied migration whose file changed refuses to open", () => {
    const dir = tmp();
    const changed = migrationsPlus(1);
    openDb(dir, { migrationsDir: changed }).close();
    const tag = listMigrations(changed).at(-1)?.tag as string;
    writeFileSync(path.join(changed, `${tag}.sql`), "CREATE TABLE extra_0 (id text);\n");
    expect(() => openDb(dir, { migrationsDir: changed })).toThrow(MigrationError);
    expect(openConnections().filter((c) => c.file.startsWith(dir))).toEqual([]);
  });

  test("a database from a newer app opens read-only", () => {
    const dir = tmp();
    openDb(dir, { migrationsDir: migrationsPlus(1) }).close();
    const db = openDb(dir, { migrationsDir: DIR });
    try {
      expect(db.readOnly).toBe(true);
      expect(db.prepare("SELECT count(*) AS n FROM settings").get<{ n: number }>()?.n).toBe(0);
      expect(() => db.prepare("INSERT INTO settings (key, value) VALUES ('lang', 'en')")).toThrow(
        ReadOnlyError,
      );
    } finally {
      db.close();
    }
  });
});

describe("schema constraints", () => {
  test("content_state is a single row; addon_source is store|manual", () => {
    const db = openDb(tmp(), { migrationsDir: DIR });
    try {
      const ins = db.prepare(
        "INSERT INTO content_state (id, addon_version, addon_source, mv_sha) VALUES (?, ?, ?, ?)",
      );
      ins.run(1, "1.0.0", "store", "abc");
      expect(() => ins.run(2, "1.0.0", "store", "abc")).toThrow(/CHECK/i);
      expect(() =>
        db.prepare("UPDATE content_state SET addon_source = 'web' WHERE id = 1").run(),
      ).toThrow(/CHECK/i);
    } finally {
      db.close();
    }
  });

  test("threads own their subjects, messages, notes and jobs", () => {
    const db = openDb(tmp(), { migrationsDir: DIR });
    try {
      const at = "2026-11-07T09:00:00.000Z";
      db.prepare(
        "INSERT INTO threads (id, title, archived, created_at, updated_at) VALUES (?, ?, 0, ?, ?)",
      ).run("t1", "Why recursion?", at, at);
      db.prepare(
        "INSERT INTO thread_subjects (thread_id, subject_type, subject_id) VALUES (?, ?, ?)",
      ).run("t1", "program", "fact");
      expect(() =>
        db
          .prepare(
            "INSERT INTO thread_subjects (thread_id, subject_type, subject_id) VALUES (?, ?, ?)",
          )
          .run("t1", "chapter", "x"),
      ).toThrow(/CHECK/i);
      db.prepare(
        "INSERT INTO messages (id, thread_id, role, text, citations, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run("m1", "t1", "assistant", "Because…", JSON.stringify(["program:fact"]), at);
      expect(() =>
        db
          .prepare(
            "INSERT INTO messages (id, thread_id, role, text, citations, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .run("m2", "t1", "system", "x", "[]", at),
      ).toThrow(/CHECK/i);
      db.prepare("INSERT INTO notes (id, message_id, created_at) VALUES (?, ?, ?)").run(
        "n1",
        "m1",
        at,
      );
      db.prepare(
        "INSERT INTO ai_jobs (id, thread_id, workflow, status, ticket, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).run("j1", "t1", "ask", "queued", "tk1", at, at);
      expect(() =>
        db
          .prepare(
            "INSERT INTO ai_jobs (id, thread_id, workflow, status, ticket, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          )
          .run("j2", "t1", "ask", "queued", "tk1", at, at),
      ).toThrow(/UNIQUE/i);
      expect(() =>
        db
          .prepare("INSERT INTO notes (id, message_id, created_at) VALUES (?, ?, ?)")
          .run("n2", "nope", at),
      ).toThrow(/FOREIGN KEY/i);

      db.prepare("DELETE FROM threads WHERE id = 't1'").run();
      for (const t of ["thread_subjects", "messages", "notes", "ai_jobs"]) {
        expect(db.prepare(`SELECT count(*) AS n FROM ${t}`).get<{ n: number }>()?.n).toBe(0);
      }
    } finally {
      db.close();
    }
  });

  test("one statement per string", () => {
    const db = openDb(tmp(), { migrationsDir: DIR });
    try {
      expect(() => db.exec("SELECT 1; SELECT 2")).toThrow(/more than one statement/);
    } finally {
      db.close();
    }
  });
});
