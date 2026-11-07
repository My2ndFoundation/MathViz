// Copied from MathTestBuddy trainer/src/lib/db/sqlite/drizzle.ts (commit d2ff986). Changes: no
// `import "server-only"` (pfapp has no such package and bun test has no stub for it). entityKind names say MathViz.
import * as drizzleOrm from "drizzle-orm";
import {
  type Casing,
  createTableRelationsHelpers,
  DefaultLogger,
  entityKind,
  extractTablesRelationalConfig,
  fillPlaceholders,
  type Logger,
  NoopLogger,
  type Query,
  type RelationalSchemaConfig,
  type SelectedFieldsOrdered as SelectedFieldsOrderedBase,
  sql,
  type TablesRelationalConfig,
} from "drizzle-orm";
import type { BatchItem, BatchResponse } from "drizzle-orm/batch";
import { NoopCache } from "drizzle-orm/cache/core";
import {
  BaseSQLiteDatabase,
  type PreparedQueryConfig as PreparedQueryConfigBase,
  SQLiteAsyncDialect,
  type SQLiteColumn,
  type SQLiteExecuteMethod,
  SQLitePreparedQuery,
  SQLiteSession,
  SQLiteTransaction,
  type SQLiteTransactionConfig,
} from "drizzle-orm/sqlite-core";
import { type ConnectionScope, type ResultSet, SqliteConnection } from "./connection";

/**
 * drizzle's session layer on top of SqliteConnection (ported from Live Studio Lab, ADR-057). drizzle
 * 0.45 has no node:sqlite driver; this ports drizzle-orm/libsql/session.js method by method, only
 * swapping `client.execute` for the synchronous connection, so the query builder, relational
 * queries, `db.run/all/get/values`, nested transactions (savepoints) and batches return the same
 * shapes as the libsql driver.
 *
 * Two deliberate differences from that driver:
 * - with no rows, raw-SQL `db.get()` returns undefined (libsql threw a TypeError);
 * - `db.values()` returns real arrays (libsql returned its Row objects; indexing gives the same).
 */

type SelectedFieldsOrdered = SelectedFieldsOrderedBase<SQLiteColumn>;
type CustomResultMapper = (
  rows: unknown[][],
  mapColumnValue?: (value: unknown) => unknown,
) => unknown;
type PreparedQueryConfig = Omit<PreparedQueryConfigBase, "statement" | "run">;
type QueryMetadata = { type: "select" | "update" | "delete" | "insert"; tables: string[] };

// drizzle-orm exports mapResultRow at run time (every driver uses it); the type declarations omit it.
const mapResultRow = (drizzleOrm as unknown as Record<string, unknown>).mapResultRow as (
  columns: SelectedFieldsOrdered,
  row: unknown[],
  joinsNotNullableMap: Record<string, boolean> | undefined,
) => unknown;
if (typeof mapResultRow !== "function") {
  throw new Error(
    "drizzle-orm no longer exports mapResultRow; app/src/lib/db/sqlite/drizzle.ts needs updating",
  );
}

/** Members drizzle marks @internal and strips from its type declarations (all present at run time). */
interface DrizzleInternals {
  dialect: SQLiteAsyncDialect;
  session: SqliteSession<Record<string, unknown>, TablesRelationalConfig>;
  joinsNotNullableMap: Record<string, boolean> | undefined;
  queryWithCache<R>(queryString: string, params: unknown[], query: () => Promise<R>): Promise<R>;
}
const internals = (o: object) => o as unknown as DrizzleInternals;

export interface SqliteSessionOptions {
  logger?: Logger;
}

/** libsql rowFromSql + drizzle normalizeRow: values by column name; the first of duplicate names wins. */
function rowObject(columns: readonly string[], row: readonly unknown[]): Record<string, unknown> {
  if (columns.length !== row.length) {
    // bun:sqlite's columnNames merges duplicate names, so names and values would misalign; fail instead.
    throw new Error(
      "This query returns columns with duplicate names; alias them (AS …) to read the rows as objects",
    );
  }
  const out: Record<string, unknown> = {};
  for (let i = 0; i < columns.length; i++) {
    const name = columns[i] as string;
    if (!Object.hasOwn(out, name)) {
      Object.defineProperty(out, name, {
        value: row[i],
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
  }
  return out;
}

/** drizzle libsql normalizeFieldValue: a BLOB mapped to a column reaches it as a Buffer. */
function normalizeFieldValue(value: unknown): unknown {
  return value instanceof ArrayBuffer ? Buffer.from(value) : value;
}

export class SqliteSession<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
> extends SQLiteSession<"async", ResultSet, TFullSchema, TSchema> {
  static override readonly [entityKind]: string = "MathVizSqliteSession";
  readonly logger: Logger;

  constructor(
    readonly client: SqliteConnection,
    private readonly sqliteDialect: SQLiteAsyncDialect,
    private readonly schema: RelationalSchemaConfig<TSchema> | undefined,
    private readonly options: SqliteSessionOptions,
    /** The session inside a transaction; undefined outside one (statements queue behind transactions). */
    readonly scope: ConnectionScope | undefined,
  ) {
    super(sqliteDialect);
    this.logger = options.logger ?? new NoopLogger();
  }

  prepareQuery<T extends Omit<PreparedQueryConfig, "run">>(
    query: Query,
    fields: SelectedFieldsOrdered | undefined,
    executeMethod: SQLiteExecuteMethod,
    isResponseInArrayMode: boolean,
    customResultMapper?: CustomResultMapper,
    queryMetadata?: QueryMetadata,
  ): SqlitePreparedQuery<T> {
    return new SqlitePreparedQuery<T>(
      this,
      query,
      queryMetadata,
      fields,
      executeMethod,
      isResponseInArrayMode,
      customResultMapper,
    );
  }

  /** Runs directly inside a transaction, queues outside one. */
  exec(query: Query | string, params: readonly unknown[] = []): Promise<ResultSet> {
    const text = typeof query === "string" ? query : query.sql;
    if (this.scope) {
      try {
        return Promise.resolve(this.client.executeIn(this.scope, text, params));
      } catch (e) {
        return Promise.reject(e);
      }
    }
    return this.client.execute(text, params);
  }

  /** libsql's batch: one connection, one deferred transaction; any failure rolls back the lot. */
  async batch<T extends BatchItem<"sqlite">[] | readonly BatchItem<"sqlite">[]>(
    queries: T,
  ): Promise<unknown[]> {
    return this.#runAll(queries, async (scope, built) => {
      this.client.executeIn(scope, "BEGIN DEFERRED");
      const results = built.map((q) => this.client.executeIn(scope, q.sql, q.params));
      this.client.executeIn(scope, "COMMIT");
      return results;
    });
  }

  /** libsql's migrate: foreign keys off, one deferred transaction, foreign keys back on whatever happens. */
  async migrate<T extends BatchItem<"sqlite">[] | readonly BatchItem<"sqlite">[]>(
    queries: T,
  ): Promise<unknown[]> {
    return this.#runAll(queries, async (scope, built) => {
      this.client.executeIn(scope, "PRAGMA foreign_keys=off");
      try {
        this.client.executeIn(scope, "BEGIN DEFERRED");
        const results = built.map((q) => this.client.executeIn(scope, q.sql, q.params));
        this.client.executeIn(scope, "COMMIT");
        return results;
      } finally {
        if (this.client.inTransaction()) this.client.executeIn(scope, "ROLLBACK");
        this.client.executeIn(scope, "PRAGMA foreign_keys=on");
      }
    });
  }

  async #runAll(
    queries: readonly BatchItem<"sqlite">[],
    run: (scope: ConnectionScope, built: Query[]) => Promise<ResultSet[]>,
  ): Promise<unknown[]> {
    if (this.scope) {
      throw new Error("batch() and migrate() cannot run inside a transaction");
    }
    const prepared = queries.map((q) => (q as unknown as PreparableBatchItem)._prepare());
    const built = prepared.map((p) => p.getQuery());
    const results = await this.client.exclusive((scope) => run(scope, built));
    return results.map((r, i) => (prepared[i] as PreparedBatchItem).mapResult(r, true));
  }

  /**
   * BEGIN IMMEDIATE by default, as libsql's `transaction("write")`: the write lock is taken up front,
   * so the transaction never fails to upgrade midway because another process (a script, a backup) wrote.
   */
  override async transaction<T>(
    transaction: (tx: SqliteTransaction<TFullSchema, TSchema>) => T | Promise<T>,
    config?: SQLiteTransactionConfig,
  ): Promise<T> {
    if (this.scope) {
      // transaction() on a transaction object uses SqliteTransaction's savepoints; the session is never called like this.
      throw new Error("A nested transaction must be opened through the transaction object");
    }
    const behavior = (config?.behavior ?? "immediate").toUpperCase();
    return this.client.exclusive(async (scope) => {
      this.client.executeIn(scope, `BEGIN ${behavior}`);
      const session = new SqliteSession<TFullSchema, TSchema>(
        this.client,
        this.sqliteDialect,
        this.schema,
        this.options,
        scope,
      );
      const tx = new SqliteTransaction<TFullSchema, TSchema>(
        "async",
        this.sqliteDialect,
        session,
        this.schema,
      );
      try {
        const result = await transaction(tx);
        this.client.executeIn(scope, "COMMIT");
        return result;
      } catch (err) {
        // After a failed COMMIT SQLite may still be in the transaction; exclusive() also rolls back before handing the connection on.
        if (this.client.inTransaction()) {
          try {
            this.client.executeIn(scope, "ROLLBACK");
          } catch {
            // keep the original error
          }
        }
        throw err;
      }
    });
  }

  extractRawAllValueFromBatchResult(result: unknown): unknown {
    const r = result as ResultSet;
    return r.rows.map((row) => rowObject(r.columns, row));
  }

  extractRawGetValueFromBatchResult(result: unknown): unknown {
    const r = result as ResultSet;
    const row = r.rows[0];
    return row === undefined ? undefined : rowObject(r.columns, row);
  }

  extractRawValuesValueFromBatchResult(result: unknown): unknown {
    return (result as ResultSet).rows;
  }
}

interface PreparedBatchItem {
  getQuery(): Query;
  mapResult(result: unknown, isFromBatch?: boolean): unknown;
}
interface PreparableBatchItem {
  _prepare(): PreparedBatchItem;
}

export class SqliteTransaction<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
> extends SQLiteTransaction<"async", ResultSet, TFullSchema, TSchema> {
  static override readonly [entityKind]: string = "MathVizSqliteTransaction";

  /** libsql LibSQLTransaction.transaction: savepoint sp<n>; on failure roll back to it and rethrow. */
  override async transaction<T>(
    transaction: (tx: SqliteTransaction<TFullSchema, TSchema>) => Promise<T>,
  ): Promise<T> {
    const savepointName = `sp${this.nestedIndex}`;
    const { dialect, session } = internals(this);
    const tx = new SqliteTransaction<TFullSchema, TSchema>(
      "async",
      dialect,
      session as never,
      this.schema as never,
      this.nestedIndex + 1,
    );
    await session.run(sql.raw(`savepoint ${savepointName}`));
    try {
      const result = await transaction(tx);
      await session.run(sql.raw(`release savepoint ${savepointName}`));
      return result;
    } catch (err) {
      await session.run(sql.raw(`rollback to savepoint ${savepointName}`));
      throw err;
    }
  }
}

export class SqlitePreparedQuery<
  T extends PreparedQueryConfig = PreparedQueryConfig,
> extends SQLitePreparedQuery<{
  type: "async";
  run: ResultSet;
  all: T["all"];
  get: T["get"];
  values: T["values"];
  execute: T["execute"];
}> {
  static override readonly [entityKind]: string = "MathVizSqlitePreparedQuery";

  constructor(
    private readonly session: SqliteSession<Record<string, unknown>, TablesRelationalConfig>,
    query: Query,
    queryMetadata: QueryMetadata | undefined,
    /** @internal */ readonly fields: SelectedFieldsOrdered | undefined,
    executeMethod: SQLiteExecuteMethod,
    private readonly _isResponseInArrayMode: boolean,
    /** @internal */ readonly customResultMapper?: CustomResultMapper,
  ) {
    super("async", executeMethod, query, new NoopCache(), queryMetadata, undefined);
  }

  #exec(placeholderValues: Record<string, unknown> | undefined): Promise<ResultSet> {
    const params = fillPlaceholders(this.query.params, placeholderValues ?? {});
    this.session.logger.logQuery(this.query.sql, params);
    // queryWithCache wraps the underlying error in DrizzleQueryError (cause: SqliteError), as with libsql.
    return internals(this).queryWithCache(this.query.sql, params, () =>
      this.session.exec(this.query, params),
    );
  }

  async run(placeholderValues?: Record<string, unknown>): Promise<ResultSet> {
    return this.#exec(placeholderValues);
  }

  async all(placeholderValues?: Record<string, unknown>): Promise<T["all"]> {
    const result = await this.#exec(placeholderValues);
    return this.mapAllResult(result) as T["all"];
  }

  override mapAllResult(result: unknown, _isFromBatch?: boolean): unknown {
    const { columns, rows } = result as ResultSet;
    if (!this.fields && !this.customResultMapper) {
      return rows.map((row) => rowObject(columns, row));
    }
    if (this.customResultMapper) {
      return this.customResultMapper(rows, normalizeFieldValue);
    }
    return rows.map((row) =>
      mapResultRow(
        this.fields as SelectedFieldsOrdered,
        row.map(normalizeFieldValue),
        internals(this).joinsNotNullableMap,
      ),
    );
  }

  async get(placeholderValues?: Record<string, unknown>): Promise<T["get"]> {
    const result = await this.#exec(placeholderValues);
    return this.mapGetResult(result) as T["get"];
  }

  override mapGetResult(result: unknown, _isFromBatch?: boolean): unknown {
    const { columns, rows } = result as ResultSet;
    const row = rows[0];
    if (!row) return undefined;
    if (!this.fields && !this.customResultMapper) {
      return rowObject(columns, row);
    }
    if (this.customResultMapper) {
      return this.customResultMapper(rows, normalizeFieldValue);
    }
    return mapResultRow(
      this.fields as SelectedFieldsOrdered,
      row.map(normalizeFieldValue),
      internals(this).joinsNotNullableMap,
    );
  }

  async values(placeholderValues?: Record<string, unknown>): Promise<T["values"]> {
    const result = await this.#exec(placeholderValues);
    return result.rows as T["values"];
  }

  /** @internal */
  isResponseInArrayMode(): boolean {
    return this._isResponseInArrayMode;
  }
}

export class SqliteDatabase<
  TSchema extends Record<string, unknown> = Record<string, never>,
> extends BaseSQLiteDatabase<"async", ResultSet, TSchema> {
  static override readonly [entityKind]: string = "MathVizSqliteDatabase";
  declare $client: SqliteConnection;

  async batch<U extends BatchItem<"sqlite">, T extends Readonly<[U, ...U[]]>>(
    batch: T,
  ): Promise<BatchResponse<T>> {
    return internals(this).session.batch(batch) as Promise<BatchResponse<T>>;
  }
}

export interface DrizzleSqliteConfig<TSchema extends Record<string, unknown>> {
  schema?: TSchema;
  casing?: Casing;
  logger?: boolean | Logger;
}

/** The counterpart of drizzle-orm/libsql's construct(). */
export function drizzleSqlite<TSchema extends Record<string, unknown> = Record<string, never>>(
  client: SqliteConnection,
  config: DrizzleSqliteConfig<TSchema> = {},
): SqliteDatabase<TSchema> & { $client: SqliteConnection } {
  const dialect = new SQLiteAsyncDialect({ casing: config.casing });
  const logger = config.logger === true ? new DefaultLogger() : config.logger || undefined;
  let schema: RelationalSchemaConfig<TablesRelationalConfig> | undefined;
  if (config.schema) {
    const tablesConfig = extractTablesRelationalConfig(config.schema, createTableRelationsHelpers);
    schema = {
      fullSchema: config.schema,
      schema: tablesConfig.tables,
      tableNamesMap: tablesConfig.tableNamesMap,
    };
  }
  const session = new SqliteSession(client, dialect, schema, { logger }, undefined);
  const db = new SqliteDatabase<TSchema>("async", dialect, session as never, schema as never);
  db.$client = client;
  return db;
}

export { SqliteConnection };
