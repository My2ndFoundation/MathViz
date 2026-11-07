-- Hand-written (drizzle-kit generate --custom): drizzle-kit cannot describe fts5 virtual tables.
-- library_fts indexes library_docs as external content (fts5 reads title/body back by rowid), with
-- the trigram tokenizer so any 3+ character substring matches, Chinese included; Task 6 falls back
-- to LIKE for shorter queries. The triggers are fts5's documented external-content pattern, so the
-- index can never drift from library_docs whoever writes it.
CREATE VIRTUAL TABLE `library_fts` USING fts5(title, body, content='library_docs', tokenize='trigram');
--> statement-breakpoint
CREATE TRIGGER `library_docs_ai` AFTER INSERT ON `library_docs` BEGIN
  INSERT INTO library_fts (rowid, title, body) VALUES (new.rowid, new.title, new.body);
END;
--> statement-breakpoint
CREATE TRIGGER `library_docs_ad` AFTER DELETE ON `library_docs` BEGIN
  INSERT INTO library_fts (library_fts, rowid, title, body) VALUES ('delete', old.rowid, old.title, old.body);
END;
--> statement-breakpoint
CREATE TRIGGER `library_docs_au` AFTER UPDATE ON `library_docs` BEGIN
  INSERT INTO library_fts (library_fts, rowid, title, body) VALUES ('delete', old.rowid, old.title, old.body);
  INSERT INTO library_fts (rowid, title, body) VALUES (new.rowid, new.title, new.body);
END;
