CREATE TABLE `ai_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`workflow` text NOT NULL,
	`status` text NOT NULL,
	`ticket` text NOT NULL,
	`platform_job_id` text,
	`error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_jobs_ticket_unique` ON `ai_jobs` (`ticket`);--> statement-breakpoint
CREATE INDEX `ai_jobs_open` ON `ai_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `ai_jobs_thread` ON `ai_jobs` (`thread_id`);--> statement-breakpoint
CREATE TABLE `catalog_items` (
	`id` text PRIMARY KEY NOT NULL,
	`grp` text NOT NULL,
	`ord` integer NOT NULL,
	`title_en` text NOT NULL,
	`title_zh` text NOT NULL,
	`file` text NOT NULL,
	`version` text NOT NULL,
	`accent` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_items_file` ON `catalog_items` (`file`);--> statement-breakpoint
CREATE INDEX `catalog_items_grp` ON `catalog_items` (`grp`,`ord`);--> statement-breakpoint
CREATE TABLE `content_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`addon_version` text,
	`addon_source` text,
	`mv_sha` text,
	CONSTRAINT "content_state_single_row" CHECK("content_state"."id" = 1),
	CONSTRAINT "content_state_source" CHECK("content_state"."addon_source" IN ('store', 'manual'))
);
--> statement-breakpoint
CREATE TABLE `library_docs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`role` text NOT NULL,
	`text` text NOT NULL,
	`citations` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "messages_role" CHECK("messages"."role" IN ('user', 'assistant'))
);
--> statement-breakpoint
CREATE INDEX `messages_thread` ON `messages` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notes_message_id_unique` ON `notes` (`message_id`);--> statement-breakpoint
CREATE INDEX `notes_created` ON `notes` (`created_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `thread_subjects` (
	`thread_id` text NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	PRIMARY KEY(`thread_id`, `subject_type`, `subject_id`),
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "thread_subjects_type" CHECK("thread_subjects"."subject_type" IN ('tool', 'program', 'blank', 'library'))
);
--> statement-breakpoint
CREATE INDEX `thread_subjects_subject` ON `thread_subjects` (`subject_type`,`subject_id`);--> statement-breakpoint
CREATE TABLE `threads` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`archived` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "threads_archived" CHECK("threads"."archived" IN (0, 1))
);
--> statement-breakpoint
CREATE INDEX `threads_updated` ON `threads` (`updated_at`);