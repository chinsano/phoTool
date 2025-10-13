CREATE TABLE IF NOT EXISTS `files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`path` text NOT NULL,
	`dir` text NOT NULL,
	`name` text NOT NULL,
	`ext` text NOT NULL,
	`size` integer NOT NULL,
	`mtime` integer NOT NULL,
	`ctime` integer NOT NULL,
	`width` integer,
	`height` integer,
	`duration` real,
	`lat` real,
	`lon` real,
	`taken_at` text,
	`xmp_path` text,
	`xmp_mtime` integer,
	`last_indexed_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `file_tags` (
	`file_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`file_id`, `tag_id`),
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`color` text,
	`group` text,
	`parent_id` integer,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `files_path_unique` ON `files` (`path`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `files_dir_idx` ON `files` (`dir`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `files_ext_name_idx` ON `files` (`ext`,`name`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ft_tag_file_idx` ON `file_tags` (`tag_id`,`file_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `tags_slug_unique` ON `tags` (`slug`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tags_parent_idx` ON `tags` (`parent_id`);