// Copied from MathTestBuddy trainer/src/lib/db/sqlite/migrator.ts (commit d2ff986). Changes: no
// `import "server-only"` (pfapp has no such package and bun test has no stub for it).
import { sql } from "drizzle-orm";
import { type MigrationConfig, readMigrationFiles } from "drizzle-orm/migrator";
import type { SQLiteRaw } from "drizzle-orm/sqlite-core/query-builders/raw";
import type { SqliteDatabase, SqliteSession } from "./drizzle";

/**
 * A line-by-line port of drizzle-orm/libsql/migrator.js (via Live Studio Lab, ADR-057): the same
 * `__drizzle_migrations` table, the same rule (a migration is pending when the last applied
 * created_at is less than its `when`), and every pending statement in one transaction (foreign keys
 * off first, see SqliteSession.migrate). No child process and no native binary: migrations run in
 * the app's own process.
 */
export async function migrate<TSchema extends Record<string, unknown>>(
  db: SqliteDatabase<TSchema>,
  config: MigrationConfig,
): Promise<void> {
  const migrations = readMigrationFiles(config);
  const migrationsTable = config.migrationsTable ?? "__drizzle_migrations";
  const session = (db as unknown as { session: SqliteSession<TSchema, never> }).session;
  await session.run(sql`
		CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsTable)} (
			id SERIAL PRIMARY KEY,
			hash text NOT NULL,
			created_at numeric
		)
	`);
  const dbMigrations = await db.values<[number, string, string]>(
    sql`SELECT id, hash, created_at FROM ${sql.identifier(migrationsTable)} ORDER BY created_at DESC LIMIT 1`,
  );
  const lastDbMigration = dbMigrations[0];
  const statementToBatch: SQLiteRaw<unknown>[] = [];
  for (const migration of migrations) {
    if (!lastDbMigration || Number(lastDbMigration[2]) < migration.folderMillis) {
      for (const stmt of migration.sql) {
        statementToBatch.push(db.run(sql.raw(stmt)));
      }
      statementToBatch.push(
        db.run(
          sql`INSERT INTO ${sql.identifier(migrationsTable)} ("hash", "created_at") VALUES(${migration.hash}, ${migration.folderMillis})`,
        ),
      );
    }
  }
  await session.migrate(statementToBatch);
}
