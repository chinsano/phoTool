CREATE TABLE IF NOT EXISTS `geo_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lat_rounded` real NOT NULL,
	`lon_rounded` real NOT NULL,
	`precision` integer NOT NULL,
	`country` text,
	`state` text,
	`city` text,
	`source` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `geo_cache_key_unique` ON `geo_cache` (`lat_rounded`,`lon_rounded`,`precision`);


