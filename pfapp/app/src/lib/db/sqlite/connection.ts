// Copied from MathTestBuddy trainer/src/lib/db/sqlite/connection.ts (commit d2ff986). Changes: no
// `import "server-only"` (pfapp has no such package and bun test has no stub for it). Node-version message names MathViz.
import type { Database as BunDatabase, Statement as BunStatement } from "bun:sqlite";
import { AsyncLocalStorage } from "node:async_hooks";
import type { DatabaseSync, StatementSync } from "node:sqlite";
import { assertSingleStatement } from "./statement";

/**
 * One SQLite connection. Ported from Live Studio Lab (src/lib/db/sqlite/connection.ts, ADR-057).
 *
 * **Two backends, one set of semantics**: the app runs on PrimeForge's bundled Node 24 and uses the
 * built-in `node:sqlite`; scripts and `bun test` run on Bun, which has no `node:sqlite`, and use the
 * built-in `bun:sqlite`. Both are synchronous and need no native addon, so one .pfapp runs on macOS
 * and Windows. The module is fetched with `process.getBuiltinModule` per runtime, so the bundler never
 * sees it and never tries to resolve the other runtime's module.
 *
 * **Semantics kept from the driver LSL replaced** (@libsql/client 0.18, local driver):
 * - integers are read as bigint and turned into numbers within the safe range, else RangeError;
 * - BLOBs are read as ArrayBuffer;
 * - parameters: booleans become 1/0, Dates milliseconds, ArrayBuffers bytes; undefined, NaN,
 *   Infinity and bigints beyond 64 bits throw;
 * - errors carry `code` (base name, e.g. SQLITE_CONSTRAINT), `extendedCode` (e.g.
 *   SQLITE_CONSTRAINT_UNIQUE) and `rawCode`;
 * - busy_timeout 5000, foreign keys on, double-quoted string literals off.
 *
 * Stricter than that driver in one place: one statement per string (statement.ts).
 *
 * **Isolation on a single connection**: each Db has one connection, so a transaction holds a mutex
 * on it until commit or rollback and statements outside the transaction queue behind it. No request
 * reads another's uncommitted writes, and no write is lost to another's rollback. Statements inside
 * the transaction go through the transaction object and do not queue. Bypassing the transaction
 * object inside its own callback (using the outer `db`) would wait for the lock forever, so that is
 * detected and refused at once instead of hanging.
 */

export type SqlValue = null | number | bigint | string | Uint8Array;

/** Same field names as libsql's ResultSet; `rows` are arrays in column order. */
export interface ResultSet {
  columns: string[];
  rows: unknown[][];
  rowsAffected: number;
  lastInsertRowid: bigint | undefined;
}

export interface OpenOptions {
  /** busy_timeout in milliseconds. Defaults to 5000. */
  timeout?: number;
  /** Open the file read-only (SQLite refuses every write with SQLITE_READONLY). */
  readOnly?: boolean;
}

/** An error shaped like LibsqlError. */
export class SqliteError extends Error {
  override readonly name = "SqliteError";
  constructor(
    message: string,
    readonly code: string,
    readonly extendedCode?: string,
    readonly rawCode?: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

const BASE_CODES: Record<number, string> = {
  1: "SQLITE_ERROR",
  2: "SQLITE_INTERNAL",
  3: "SQLITE_PERM",
  4: "SQLITE_ABORT",
  5: "SQLITE_BUSY",
  6: "SQLITE_LOCKED",
  7: "SQLITE_NOMEM",
  8: "SQLITE_READONLY",
  9: "SQLITE_INTERRUPT",
  10: "SQLITE_IOERR",
  11: "SQLITE_CORRUPT",
  12: "SQLITE_NOTFOUND",
  13: "SQLITE_FULL",
  14: "SQLITE_CANTOPEN",
  15: "SQLITE_PROTOCOL",
  16: "SQLITE_EMPTY",
  17: "SQLITE_SCHEMA",
  18: "SQLITE_TOOBIG",
  19: "SQLITE_CONSTRAINT",
  20: "SQLITE_MISMATCH",
  21: "SQLITE_MISUSE",
  22: "SQLITE_NOLFS",
  23: "SQLITE_AUTH",
  24: "SQLITE_FORMAT",
  25: "SQLITE_RANGE",
  26: "SQLITE_NOTADB",
  27: "SQLITE_NOTICE",
  28: "SQLITE_WARNING",
};

/** node:sqlite gives only numeric codes; the common extended codes are named here, the rest fall back to the base name. bun:sqlite names its own. */
const EXTENDED_CODES: Record<number, string> = {
  261: "SQLITE_BUSY_RECOVERY",
  517: "SQLITE_BUSY_SNAPSHOT",
  773: "SQLITE_BUSY_TIMEOUT",
  262: "SQLITE_LOCKED_SHAREDCACHE",
  518: "SQLITE_LOCKED_VTAB",
  264: "SQLITE_READONLY_RECOVERY",
  520: "SQLITE_READONLY_CANTLOCK",
  776: "SQLITE_READONLY_ROLLBACK",
  1032: "SQLITE_READONLY_DBMOVED",
  270: "SQLITE_CANTOPEN_NOTEMPDIR",
  526: "SQLITE_CANTOPEN_ISDIR",
  782: "SQLITE_CANTOPEN_FULLPATH",
  267: "SQLITE_CORRUPT_VTAB",
  275: "SQLITE_CONSTRAINT_CHECK",
  531: "SQLITE_CONSTRAINT_COMMITHOOK",
  787: "SQLITE_CONSTRAINT_FOREIGNKEY",
  1043: "SQLITE_CONSTRAINT_FUNCTION",
  1299: "SQLITE_CONSTRAINT_NOTNULL",
  1555: "SQLITE_CONSTRAINT_PRIMARYKEY",
  1811: "SQLITE_CONSTRAINT_TRIGGER",
  2067: "SQLITE_CONSTRAINT_UNIQUE",
  2323: "SQLITE_CONSTRAINT_VTAB",
  2579: "SQLITE_CONSTRAINT_ROWID",
  2835: "SQLITE_CONSTRAINT_PINNED",
  3091: "SQLITE_CONSTRAINT_DATATYPE",
  516: "SQLITE_ABORT_ROLLBACK",
};

const baseName = (raw: number) => BASE_CODES[raw & 0xff] ?? `SQLITE_UNKNOWN_${raw & 0xff}`;

/** Both backends' SQLite errors become SqliteError; JS errors such as bad bindings pass through unchanged. */
function mapError(e: unknown): unknown {
  if (!(e instanceof Error)) return e;
  const err = e as Error & { code?: unknown; errcode?: unknown; errno?: unknown };
  // node:sqlite: code is always ERR_SQLITE_ERROR, errcode is the extended code
  if (err.code === "ERR_SQLITE_ERROR" && typeof err.errcode === "number") {
    const raw = err.errcode;
    return new SqliteError(err.message, baseName(raw), EXTENDED_CODES[raw] ?? baseName(raw), raw, {
      cause: e,
    });
  }
  // bun:sqlite: SQLiteError, code is the extended code's name, errno the extended code
  if (err.name === "SQLiteError" && typeof err.errno === "number") {
    const raw = err.errno;
    const ext = typeof err.code === "string" ? err.code : baseName(raw);
    return new SqliteError(err.message, baseName(raw), ext, raw, { cause: e });
  }
  return e;
}

const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_I64 = -9223372036854775808n;
const MAX_I64 = 9223372036854775807n;

/** libsql valueToSql (intMode "number"). */
export function valueToSql(value: unknown): SqlValue {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new RangeError("Only finite numbers (not Infinity or NaN) can be passed as arguments");
    }
    return value;
  }
  if (typeof value === "bigint") {
    if (value < MIN_I64 || value > MAX_I64) {
      throw new RangeError(
        "bigint is too large to be represented as a 64-bit integer and passed as argument",
      );
    }
    return value;
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (value instanceof Date) return value.valueOf();
  if (value === undefined)
    throw new TypeError("undefined cannot be passed as argument to the database");
  if (value === null || typeof value === "string" || value instanceof Uint8Array) return value;
  // libsql handed any other value to SQLite, which refused it; same outcome, clearer message.
  throw new TypeError(`SQLite cannot store a value of type ${typeof value}`);
}

/** libsql valueFromSql (intMode "number"). */
function valueFromSql(value: unknown): unknown {
  if (typeof value === "bigint") {
    if (value < MIN_SAFE || value > MAX_SAFE) {
      throw new RangeError(
        "Received integer which cannot be safely represented as a JavaScript number",
      );
    }
    return Number(value);
  }
  if (value instanceof Uint8Array) {
    // Copy into its own ArrayBuffer: the underlying buffer may be larger than the value.
    return value.slice().buffer;
  }
  return value;
}

interface Backend {
  readonly kind: "node:sqlite" | "bun:sqlite";
  execute(sql: string, args: SqlValue[]): ResultSet;
  inTransaction(): boolean;
  close(): void;
}

type BuiltinLoader = (id: string) => unknown;
const loadBuiltin: BuiltinLoader = (id) =>
  (process as unknown as { getBuiltinModule: BuiltinLoader }).getBuiltinModule(id);

const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";

function rowsFrom(raw: unknown[][]): unknown[][] {
  return raw.map((row) => row.map(valueFromSql));
}

function openNode(file: string, timeout: number, readOnly: boolean): Backend {
  const mod = loadBuiltin("node:sqlite") as typeof import("node:sqlite") | undefined;
  if (!mod) {
    throw new Error(
      `node:sqlite is not available in Node ${process.versions.node}; MathViz needs Node 24 or newer`,
    );
  }
  const db: DatabaseSync = new mod.DatabaseSync(file, {
    timeout,
    readOnly,
    enableForeignKeyConstraints: true,
    enableDoubleQuotedStringLiterals: false,
  });
  return {
    kind: "node:sqlite",
    execute(sql, args) {
      const stmt: StatementSync = db.prepare(sql);
      stmt.setReadBigInts(true);
      const columns = stmt.columns().map((c) => c.name);
      if (columns.length > 0) {
        stmt.setReturnArrays(true);
        const rows = stmt.all(...args) as unknown as unknown[][];
        // Statements that return rows report no affected rows, as libsql did
        return { columns, rows: rowsFrom(rows), rowsAffected: 0, lastInsertRowid: undefined };
      }
      const info = stmt.run(...args);
      return {
        columns: [],
        rows: [],
        rowsAffected: Number(info.changes),
        lastInsertRowid: BigInt(info.lastInsertRowid),
      };
    },
    inTransaction: () => db.isOpen && db.isTransaction,
    close: () => {
      if (db.isOpen) db.close();
    },
  };
}

function openBun(file: string, timeout: number, readOnly: boolean): Backend {
  const mod = loadBuiltin("bun:sqlite") as typeof import("bun:sqlite");
  const db: BunDatabase = readOnly
    ? new mod.Database(file, { readonly: true })
    : new mod.Database(file, { create: true, readwrite: true });
  let open = true;
  // bun:sqlite has no matching constructor options, so PRAGMAs are used. Bun exposes no switch for
  // double-quoted string literals; that only affects tests and scripts under Bun, never the app.
  db.run(`PRAGMA busy_timeout = ${Math.trunc(timeout)}`);
  db.run("PRAGMA foreign_keys = ON");
  return {
    kind: "bun:sqlite",
    execute(sql, args) {
      const stmt: BunStatement = db.prepare(sql);
      try {
        // safeIntegers is missing from bun-types but present at run time (Bun >= 1.1)
        (stmt as unknown as { safeIntegers(on: boolean): unknown }).safeIntegers(true);
        const columns = [...stmt.columnNames];
        if (columns.length > 0) {
          const rows = stmt.values(...(args as never[])) as unknown[][];
          return { columns, rows: rowsFrom(rows), rowsAffected: 0, lastInsertRowid: undefined };
        }
        const info = stmt.run(...(args as never[]));
        return {
          columns: [],
          rows: [],
          rowsAffected: Number(info.changes),
          lastInsertRowid: BigInt(info.lastInsertRowid),
        };
      } finally {
        stmt.finalize();
      }
    },
    inTransaction: () => open && db.inTransaction,
    close: () => {
      if (!open) return;
      open = false;
      db.close();
    },
  };
}

/** The scope in which a transaction (or batch, or migration) holds the connection; its statements do not queue. */
export class ConnectionScope {
  active = true;
  constructor(readonly connection: SqliteConnection) {}
}

const scopes = new AsyncLocalStorage<readonly ConnectionScope[]>();

/**
 * Connections still open in this process. Each holds a handle on the database file; a forgotten one
 * (a startup connection, a file swapped out by a restore) shows up here, and tests assert on it.
 */
const live = new Set<SqliteConnection>();
let nextId = 1;

export function openConnections(): readonly { id: number; file: string }[] {
  return [...live].map((c) => ({ id: c.id, file: c.file }));
}

export class SqliteConnection {
  readonly file: string;
  readonly id = nextId++;
  readonly backend: Backend["kind"];
  readonly readOnly: boolean;
  #db: Backend;
  #closed = false;
  #busy = false;
  #waiters: (() => void)[] = [];
  #syncScope: ConnectionScope | undefined;

  constructor(file: string, options: OpenOptions = {}) {
    const timeout = options.timeout ?? 5000;
    this.file = file;
    this.readOnly = options.readOnly ?? false;
    try {
      this.#db = isBun
        ? openBun(file, timeout, this.readOnly)
        : openNode(file, timeout, this.readOnly);
    } catch (e) {
      throw mapError(e);
    }
    this.backend = this.#db.kind;
    live.add(this);
  }

  get closed(): boolean {
    return this.#closed;
  }

  /** One statement outside a transaction: queues while a transaction is in progress. */
  async execute(sql: string, args: readonly unknown[] = []): Promise<ResultSet> {
    this.#refuseFromOwnScope();
    await this.#acquire();
    try {
      return this.#run(sql, args);
    } finally {
      this.#release();
    }
  }

  /**
   * Runs fn with the connection to itself (transactions, batches, migrations). Statements in fn go
   * through `executeIn(scope, …)`. If SQLite is still in a transaction when fn ends (a failed COMMIT,
   * say), it is rolled back before the connection is handed on — a pool never takes back a
   * connection mid-transaction either.
   */
  async exclusive<T>(fn: (scope: ConnectionScope) => Promise<T>): Promise<T> {
    this.#refuseFromOwnScope();
    await this.#acquire();
    const scope = new ConnectionScope(this);
    try {
      return await scopes.run([...(scopes.getStore() ?? []), scope], () => fn(scope));
    } finally {
      scope.active = false;
      if (!this.#closed && this.#db.inTransaction()) {
        try {
          this.#db.execute("ROLLBACK", []);
        } catch {
          // The connection is unusable; the next statement reports the real error
        }
      }
      this.#release();
    }
  }

  /**
   * Runs fn synchronously with the connection to itself — the synchronous handle's way in
   * (src/lib/db/handle.ts). Re-entrant:
   * a call inside fn reuses the scope. Nothing can queue behind it (fn never yields), so it cannot
   * wait for an asynchronous holder either: while an asynchronous transaction, batch or migration
   * holds the connection it throws CONNECTION_BUSY instead of interleaving with it.
   */
  holdSync<T>(fn: (scope: ConnectionScope) => T): T {
    const own = this.#syncScope;
    if (own?.active) return fn(own);
    if (this.#closed) throw new SqliteError("The client is closed", "CLIENT_CLOSED");
    if (this.#busy) {
      throw new SqliteError(
        "The connection is held by an asynchronous transaction; synchronous statements cannot run until it ends",
        "CONNECTION_BUSY",
      );
    }
    this.#busy = true;
    const scope = new ConnectionScope(this);
    this.#syncScope = scope;
    try {
      const out = fn(scope);
      if (out instanceof Promise) {
        throw new TypeError("holdSync() takes a synchronous function");
      }
      return out;
    } finally {
      scope.active = false;
      this.#syncScope = undefined;
      this.#release();
    }
  }

  /** One statement inside the scope holding the connection. Using a settled scope fails with TRANSACTION_CLOSED, as libsql did. */
  executeIn(scope: ConnectionScope, sql: string, args: readonly unknown[] = []): ResultSet {
    if (scope.connection !== this || !scope.active) {
      throw new SqliteError("The transaction is closed", "TRANSACTION_CLOSED");
    }
    return this.#run(sql, args);
  }

  inTransaction(): boolean {
    return !this.#closed && this.#db.inTransaction();
  }

  /** Closes at once; queued statements then fail with CLIENT_CLOSED. */
  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    live.delete(this);
    this.#db.close();
  }

  #run(sql: string, args: readonly unknown[]): ResultSet {
    if (this.#closed) throw new SqliteError("The client is closed", "CLIENT_CLOSED");
    assertSingleStatement(sql);
    const bound = args.map(valueToSql);
    try {
      return this.#db.execute(sql, bound);
    } catch (e) {
      throw mapError(e);
    }
  }

  #refuseFromOwnScope(): void {
    const mine = scopes.getStore()?.some((s) => s.active && s.connection === this);
    if (mine) {
      throw new Error(
        "This statement was issued on the database inside one of its own transactions, where it would wait for that transaction forever. Run it through the transaction object (`tx`) instead.",
      );
    }
  }

  async #acquire(): Promise<void> {
    if (!this.#busy) {
      this.#busy = true;
      return;
    }
    await new Promise<void>((resolve) => this.#waiters.push(resolve));
  }

  #release(): void {
    const next = this.#waiters.shift();
    if (next) next();
    else this.#busy = false;
  }
}
