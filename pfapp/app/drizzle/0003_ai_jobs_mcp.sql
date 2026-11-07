ALTER TABLE `ai_jobs` ADD `mcp_segment` text;--> statement-breakpoint
ALTER TABLE `ai_jobs` ADD `input` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_jobs` ADD `leak_rejections` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_jobs` ADD `read_programs` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_jobs` ADD `platform_status` text;--> statement-breakpoint
ALTER TABLE `ai_jobs` ADD `engine` text;--> statement-breakpoint
ALTER TABLE `ai_jobs` ADD `model` text;--> statement-breakpoint
ALTER TABLE `ai_jobs` ADD `deadline_at` text;--> statement-breakpoint
ALTER TABLE `ai_jobs` ADD `settled_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `ai_jobs_mcp_segment` ON `ai_jobs` (`mcp_segment`);