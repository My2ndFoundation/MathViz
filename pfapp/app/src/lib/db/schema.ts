import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * The pfapp's local database (`<PRIMEFORGE_DATA_DIR>/mathviz.sqlite`). drizzle-kit generates
 * drizzle/ from this file (`bun run db:generate`); the column names here are the SQL names
 * (snake_case written out, no casing option). Timestamps are ISO-8601 text, as in MathTestBuddy.
 *
 * Not in this file: `library_fts`, an fts5 virtual table drizzle-kit cannot describe. It and the
 * triggers that keep it in step with `library_docs` are hand-written in
 * drizzle/0001_library_fts.sql (a `drizzle-kit generate --custom` migration).
 */

/** Key/value preferences. Keys: `lang` ('en' | 'zh'). */
export const settings = sqliteTable("settings", {
  key: text().primaryKey(),
  value: text().notNull(),
});

/** Which content add-on the catalog and library index were built from (one row, id = 1). */
export const content_state = sqliteTable(
  "content_state",
  {
    id: integer().primaryKey(),
    addon_version: text(),
    addon_source: text(),
    mv_sha: text(),
  },
  (t) => [
    check("content_state_single_row", sql`${t.id} = 1`),
    check("content_state_source", sql`${t.addon_source} IN ('store', 'manual')`),
  ],
);

/** The sidebar: one row per tool page in the installed content add-on. */
export const catalog_items = sqliteTable(
  "catalog_items",
  {
    id: text().primaryKey(),
    grp: text().notNull(),
    ord: integer().notNull(),
    title_en: text().notNull(),
    title_zh: text().notNull(),
    file: text().notNull(),
    version: text().notNull(),
    accent: text().notNull(),
    /** The catalog's `tag` (⌘K filters on it); null when the item has none. */
    tag_en: text(),
    tag_zh: text(),
  },
  (t) => [
    uniqueIndex("catalog_items_file").on(t.file),
    index("catalog_items_grp").on(t.grp, t.ord),
  ],
);

/**
 * The sidebar's groups, in the web navigation page's own order (catalog.json `groups`), with
 * their labels. catalog_items.grp refers to id (no foreign key: both are rebuilt together).
 */
export const catalog_groups = sqliteTable("catalog_groups", {
  id: text().primaryKey(),
  ord: integer().notNull(),
  label_en: text().notNull(),
  label_zh: text().notNull(),
});

/**
 * What "ask the whole library" searches: `tool:<id>` and `program:<id>` documents. Indexed by
 * library_fts (external content: fts5 reads title/body from here by rowid).
 */
export const library_docs = sqliteTable("library_docs", {
  id: text().primaryKey(),
  /** 'tool' | 'program' (no CHECK: phase 2 targets may add kinds). */
  kind: text().notNull(),
  title: text().notNull(),
  body: text().notNull(),
});

/** A Q&A conversation. id is a ULID. */
export const threads = sqliteTable(
  "threads",
  {
    id: text().primaryKey(),
    title: text().notNull(),
    archived: integer().notNull().default(0),
    created_at: text().notNull(),
    updated_at: text().notNull(),
  },
  (t) => [
    check("threads_archived", sql`${t.archived} IN (0, 1)`),
    index("threads_updated").on(t.updated_at),
  ],
);

/** What a thread is about: a tool, a program, a blank, or the whole library. */
export const thread_subjects = sqliteTable(
  "thread_subjects",
  {
    thread_id: text()
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    subject_type: text().notNull(),
    subject_id: text().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.thread_id, t.subject_type, t.subject_id] }),
    check(
      "thread_subjects_type",
      sql`${t.subject_type} IN ('tool', 'program', 'blank', 'library')`,
    ),
    index("thread_subjects_subject").on(t.subject_type, t.subject_id),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text().primaryKey(),
    thread_id: text()
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    role: text().notNull(),
    text: text().notNull(),
    /** JSON string[] of library_docs ids. */
    citations: text().notNull().default("[]"),
    created_at: text().notNull(),
  },
  (t) => [
    check("messages_role", sql`${t.role} IN ('user', 'assistant')`),
    index("messages_thread").on(t.thread_id, t.created_at),
  ],
);

/** A saved answer. One note per message. */
export const notes = sqliteTable(
  "notes",
  {
    id: text().primaryKey(),
    message_id: text()
      .notNull()
      .unique()
      .references(() => messages.id, { onDelete: "cascade" }),
    created_at: text().notNull(),
  },
  (t) => [index("notes_created").on(t.created_at)],
);

/**
 * Agent jobs on the PrimeForge platform. `status` follows MathTestBuddy's jobs.ts state machine:
 * queued → running → completed | failed | timed_out | cancelled (and submit_failed); no CHECK, so
 * Task 10's port can add states without a table rebuild. `ticket` is single-use and unique.
 */
export const ai_jobs = sqliteTable(
  "ai_jobs",
  {
    id: text().primaryKey(),
    thread_id: text()
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    workflow: text().notNull(),
    status: text().notNull(),
    ticket: text().notNull().unique(),
    platform_job_id: text(),
    error: text(),
    created_at: text().notNull(),
    updated_at: text().notNull(),
  },
  (t) => [index("ai_jobs_open").on(t.status), index("ai_jobs_thread").on(t.thread_id)],
);

export type SettingRow = typeof settings.$inferSelect;
export type ContentStateRow = typeof content_state.$inferSelect;
export type CatalogItemRow = typeof catalog_items.$inferSelect;
export type CatalogGroupRow = typeof catalog_groups.$inferSelect;
export type LibraryDocRow = typeof library_docs.$inferSelect;
export type ThreadRow = typeof threads.$inferSelect;
export type ThreadSubjectRow = typeof thread_subjects.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type NoteRow = typeof notes.$inferSelect;
export type AiJobRow = typeof ai_jobs.$inferSelect;
