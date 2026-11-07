// Ported from MathTestBuddy trainer/src/lib/db/open.ts and migrate.ts (commit d2ff986). Kept: the
// journal reader and checksums, one transaction per migration with foreign keys off, the
// foreign_key_check, VACUUM INTO backups before pending migrations with the newest 5 kept, WAL,
// read-only on a newer schema, migrations read from the working directory. Changed: no `app_meta`
// table — the schema version is the number of applied migrations and "newer" means an applied
// migration this code does not ship; file names say mathviz; no `import "server-only"`.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { Db, ReadOnlyError } from "./handle";
import { SqliteConnection } from "./sqlite/connection";

export { Db, ReadOnlyError };

/**
 * Opening the pfapp's database: `<dataDir>/mathviz.sqlite`, created and migrated at startup.
 *
 * Bookkeeping is drizzle's `__drizzle_migrations` table (`hash` = sha256 of the migration file, as
 * drizzle computes it; `created_at` = the journal's `when`), so drizzle's own migrator
 * (sqlite/migrator.ts) sees the same state and finds nothing pending.
 *
 * Migrations are read at run time from the working directory, never bundled: the install directory
 * is read-only and holds `drizzle/` beside the entry script (MathTestBuddy's arrangement).
 */

export const DB_FILE = "mathviz.sqlite";
export const KEEP_BACKUPS = 5;
const MIGRATIONS_TABLE = "__drizzle_migrations";
const BREAKPOINT = "--> statement-breakpoint";

export class MigrationError extends Error {
  override readonly name = "MigrationError";
  constructor(
    readonly code: string,
    detail?: string,
  ) {
    super(`Migration error: ${code}${detail ? ` (${detail})` : ""}`);
  }
}

/**
 * The shipped migrations folder: `<cwd>/drizzle` in the packaged app (cwd = install dir), else
 * `<cwd>/app/drizzle` — the source layout, where tests and `next dev app` run from pfapp/.
 */
export function migrationsDir(cwd: string = process.cwd()): string {
  const packaged = path.join(cwd, "drizzle");
  if (existsSync(path.join(packaged, "meta", "_journal.json"))) return packaged;
  return path.join(cwd, "app", "drizzle");
}

const journalSchema = z.object({
  entries: z.array(
    z.object({
      idx: z.number().int().nonnegative(),
      when: z.number().int(),
      tag: z.string().regex(/^[A-Za-z0-9_-]+$/),
    }),
  ),
});

export interface Migration {
  /** journal index + 1 */
  version: number;
  tag: string;
  when: number;
  hash: string;
  statements: string[];
}

/** The migrations in a drizzle folder, in journal order (hash as drizzle-orm/migrator computes it). */
export function listMigrations(dir: string): Migration[] {
  const journal = journalSchema.parse(
    JSON.parse(readFileSync(path.join(dir, "meta", "_journal.json"), "utf8")),
  );
  return journal.entries.map((e) => {
    const text = readFileSync(path.join(dir, `${e.tag}.sql`), "utf8");
    return {
      version: e.idx + 1,
      tag: e.tag,
      when: e.when,
      hash: createHash("sha256").update(text).digest("hex"),
      statements: text
        .split(BREAKPOINT)
        .map((s) => s.trim())
        .filter((s) => s !== ""),
    };
  });
}

function hasTable(db: Db, name: string): boolean {
  return !!db
    .prepare("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name);
}

/** Applied migrations: journal `when` → file hash. */
function appliedMigrations(db: Db): Map<number, string> {
  if (!hasTable(db, MIGRATIONS_TABLE)) return new Map();
  return new Map(
    db
      .prepare(`SELECT hash, created_at FROM ${MIGRATIONS_TABLE}`)
      .all<{ hash: string; created_at: number | string }>()
      .map((r) => [Number(r.created_at), r.hash]),
  );
}

function applyPragmas(db: Db): void {
  db.prepare("PRAGMA journal_mode = WAL").get();
  db.exec("PRAGMA foreign_keys = ON");
  // Already on from the connection (sqlite/connection.ts); restated because library_fts depends on
  // it — without it INSERT OR REPLACE into library_docs leaves a stale index entry behind.
  db.exec("PRAGMA recursive_triggers = ON");
}

/** ISO timestamp → 20261107T090000000Z */
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:.]/g, "");

/** Consistent copy with VACUUM INTO (safe under WAL; allowed in read-only mode). */
export function backup(db: Db, destPath: string): void {
  db.exec(`VACUUM INTO '${destPath.replaceAll("'", "''")}'`);
}

const BACKUP_NAME = /^mathviz-(\d+)-(\d{8}T\d{9}Z)(?:-(\d+))?\.sqlite$/;

function backupBeforeMigration(db: Db, dataDir: string, schema: number, nowIso: string): void {
  const dir = path.join(dataDir, "backups");
  mkdirSync(dir, { recursive: true });
  let dest = path.join(dir, `mathviz-${schema}-${stamp(nowIso)}.sqlite`);
  for (let n = 2; existsSync(dest); n++) {
    dest = path.join(dir, `mathviz-${schema}-${stamp(nowIso)}-${n}.sqlite`);
  }
  backup(db, dest);
  const files = readdirSync(dir)
    .map((f) => ({ f, m: BACKUP_NAME.exec(f) }))
    .filter((x): x is { f: string; m: RegExpExecArray } => x.m !== null)
    .sort((a, b) => {
      const ta = a.m[2] as string;
      const tb = b.m[2] as string;
      if (ta !== tb) return ta < tb ? -1 : 1;
      return Number(a.m[3] ?? 1) - Number(b.m[3] ?? 1);
    });
  for (const { f } of files.slice(0, Math.max(0, files.length - KEEP_BACKUPS))) {
    rmSync(path.join(dir, f));
  }
}

/** One migration in one transaction, foreign keys off around it (drizzle's rule for table rebuilds). */
function applyMigration(db: Db, m: Migration): void {
  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.transaction(() => {
      // drizzle's own definition of the table, so its migrator recognises the state
      db.exec(
        `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`,
      );
      for (const s of m.statements) db.exec(s);
      const broken = db.prepare("PRAGMA foreign_key_check").all();
      if (broken.length > 0) {
        throw new MigrationError("foreign_key_check", `${m.tag}: ${broken.length} rows`);
      }
      db.prepare(`INSERT INTO ${MIGRATIONS_TABLE} (hash, created_at) VALUES (?, ?)`).run(
        m.hash,
        m.when,
      );
    });
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

export interface OpenOptions {
  /** A drizzle migrations folder; defaults to the shipped one (migrationsDir()). */
  migrationsDir?: string;
  /** Clock for backup names. */
  now?: () => string;
}

/**
 * Open (creating and migrating if needed) `<dataDir>/mathviz.sqlite`. A database that has applied a
 * migration this code does not ship (written by a newer app) opens read-only; an applied migration
 * whose file has changed refuses to open.
 */
export function openDb(dataDir: string, options: OpenOptions = {}): Db {
  const now = options.now ?? (() => new Date().toISOString());
  mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, DB_FILE);
  const migrations = listMigrations(options.migrationsDir ?? migrationsDir());
  const known = new Set(migrations.map((m) => m.when));

  if (existsSync(file)) {
    const probe = new Db(new SqliteConnection(file, { readOnly: true }));
    let newer: boolean;
    try {
      newer = [...appliedMigrations(probe).keys()].some((when) => !known.has(when));
    } finally {
      probe.close();
    }
    if (newer) return new Db(new SqliteConnection(file, { readOnly: true }));
  }

  const db = new Db(new SqliteConnection(file));
  try {
    applyPragmas(db);
    const applied = appliedMigrations(db);
    for (const m of migrations) {
      const hash = applied.get(m.when);
      if (hash !== undefined && hash !== m.hash) {
        throw new MigrationError("checksum_changed", m.tag);
      }
    }
    const pending = migrations.filter((m) => !applied.has(m.when));
    if (pending.length > 0 && applied.size > 0) {
      backupBeforeMigration(db, dataDir, applied.size, now());
    }
    for (const m of pending) applyMigration(db, m);
    return db;
  } catch (e) {
    db.close();
    throw e;
  }
}
