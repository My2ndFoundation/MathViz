ALTER TABLE `ai_jobs` ADD `ended_at` text;--> statement-breakpoint
-- jobs that ended before this column: their best known end (settlement, else their last change)
UPDATE `ai_jobs` SET `ended_at` = coalesce(`settled_at`, `updated_at`) WHERE `status` NOT IN ('queued', 'running');
