CREATE TABLE `catalog_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`ord` integer NOT NULL,
	`label_en` text NOT NULL,
	`label_zh` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `catalog_items` ADD `tag_en` text;--> statement-breakpoint
ALTER TABLE `catalog_items` ADD `tag_zh` text;--> statement-breakpoint
-- Forget which pack the index was built from, so the next start rebuilds it and fills the new
-- catalog_groups table and tag columns (ensureIndexed skips a pack content_state already records).
DELETE FROM `content_state`;
