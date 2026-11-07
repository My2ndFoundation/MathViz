// Copied from MathTestBuddy trainer/src/lib/db/learner.ts (commit d2ff986). Changes: the class is
// `Db` (was LearnerDb), no `import "server-only"`, wording no longer says "learner".
import { type ConnectionScope, type SqliteConnection, SqliteError } from "./sqlite/connection";

/**
 * The app's handle on the database: synchronous, with the shape of node:sqlite's DatabaseSync —
 * `prepare(sql).get/all/run` and `exec(sql)` — as MathTestBuddy's learner layer, whose jobs.ts
 * state machine Task 10 ports with its transaction boundaries intact.
 *
 * Every statement goes through the driver layer (sqlite/connection.ts): one statement per string,
 * the same value conversions on both runtimes, SqliteError codes. Each call holds the connection for
 * its own duration (`holdSync`); a transaction (`transaction()`) holds it from BEGIN to COMMIT, and
 * because the data layer never yields inside one, no other request can interleave with it — exactly
 * the guarantee the reference app had from synchronous node:sqlite.
 *
 * Read-only mode (a database from a newer app version): every write is refused with ReadOnlyError
 * before it reaches SQLite, and SQLite's own SQLITE_READONLY errors are reported the same way.
 */

export type SqlArg = null | number | bigint | string | boolean | Uint8Array;
/** A value as read: integers within the safe range are numbers, BLOBs ArrayBuffers. */
export type SqlRead = null | number | string | ArrayBuffer;
export type Row = Record<string, SqlRead>;

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export class ReadOnlyError extends Error {
  override readonly name = "ReadOnlyError";
  readonly code = "read_only";
  constructor() {
    super(
      "The database comes from a newer version of the app; it is open read-only and cannot be changed.",
    );
  }
}

const WRITE_SQL =
  /^\s*(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|BEGIN|COMMIT|END|ROLLBACK|SAVEPOINT|RELEASE|REINDEX|ANALYZE|ATTACH|DETACH|VACUUM(?!\s+INTO\b))\b/i;
const SQLITE_READONLY = 8;

function translate<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof SqliteError && ((e.rawCode ?? 0) & 0xff) === SQLITE_READONLY) {
      throw new ReadOnlyError();
    }
    throw e;
  }
}

function toObject(columns: readonly string[], row: readonly unknown[]): Row {
  const out: Row = {};
  for (let i = 0; i < columns.length; i++) {
    const name = columns[i] as string;
    if (!Object.hasOwn(out, name)) out[name] = row[i] as SqlRead;
  }
  return out;
}

/** A statement bound to its SQL text; it runs through the driver each time (no cached handle). */
export class Statement {
  constructor(
    private readonly db: Db,
    readonly sql: string,
  ) {}

  /** The first row, or undefined. */
  get<T extends object = Row>(...args: SqlArg[]): T | undefined {
    const r = this.db.execute(this.sql, args);
    const row = r.rows[0];
    return row === undefined ? undefined : (toObject(r.columns, row) as T);
  }

  all<T extends object = Row>(...args: SqlArg[]): T[] {
    const r = this.db.execute(this.sql, args);
    return r.rows.map((row) => toObject(r.columns, row) as T);
  }

  run(...args: SqlArg[]): RunResult {
    const r = this.db.execute(this.sql, args);
    return { changes: r.rowsAffected, lastInsertRowid: Number(r.lastInsertRowid ?? 0) };
  }
}

export class Db {
  /** Depth of transaction() calls in progress; nested calls join the outermost one. */
  #depth = 0;

  constructor(
    readonly connection: SqliteConnection,
    readonly readOnly: boolean = connection.readOnly,
  ) {}

  get file(): string {
    return this.connection.file;
  }

  prepare(sql: string): Statement {
    if (this.readOnly && WRITE_SQL.test(sql)) throw new ReadOnlyError();
    return new Statement(this, sql);
  }

  /** One statement, results discarded. */
  exec(sql: string): void {
    if (this.readOnly && WRITE_SQL.test(sql)) throw new ReadOnlyError();
    this.execute(sql, []);
  }

  /** @internal Statement and exec go through here. */
  execute(sql: string, args: readonly SqlArg[]) {
    if (this.readOnly && WRITE_SQL.test(sql)) throw new ReadOnlyError();
    return translate(() =>
      this.connection.holdSync((scope) => this.connection.executeIn(scope, sql, args)),
    );
  }

  /**
   * Run fn inside a transaction (BEGIN IMMEDIATE / COMMIT, ROLLBACK on throw), holding the
   * connection throughout. Nested calls join the outer transaction. fn must be synchronous.
   */
  transaction<T>(fn: () => T): T {
    if (this.#depth > 0) {
      this.#depth++;
      try {
        return fn();
      } finally {
        this.#depth--;
      }
    }
    if (this.readOnly) throw new ReadOnlyError();
    return this.connection.holdSync((scope: ConnectionScope) => {
      this.connection.executeIn(scope, "BEGIN IMMEDIATE");
      this.#depth = 1;
      try {
        const out = fn();
        if (out instanceof Promise)
          throw new TypeError("transaction() takes a synchronous function");
        this.connection.executeIn(scope, "COMMIT");
        return out;
      } catch (e) {
        try {
          if (this.connection.inTransaction()) this.connection.executeIn(scope, "ROLLBACK");
        } catch {
          // already rolled back
        }
        throw e;
      } finally {
        this.#depth = 0;
      }
    });
  }

  /** Whether a transaction() is in progress on this handle. */
  get inTransaction(): boolean {
    return this.#depth > 0;
  }

  close(): void {
    this.connection.close();
  }
}

/** Run fn inside a transaction on db; nested calls join the outer one. */
export function transaction<T>(db: Db, fn: () => T): T {
  return db.transaction(fn);
}
