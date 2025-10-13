CREATE TABLE `tag_groups` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tag_group_items` (
  `group_id` integer NOT NULL,
  `tag_id` integer NOT NULL,
  PRIMARY KEY(`group_id`, `tag_id`),
  FOREIGN KEY (`group_id`) REFERENCES `tag_groups`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);

