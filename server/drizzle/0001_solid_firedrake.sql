CREATE TABLE IF NOT EXISTS `sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`signature` text NOT NULL,
	`roots_json` text NOT NULL,
	`last_scanned_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `sources_signature_unique` ON `sources` (`signature`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `files_taken_at_idx` ON `files` (`taken_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `files_mtime_idx` ON `files` (`mtime`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `files_size_idx` ON `files` (`size`);