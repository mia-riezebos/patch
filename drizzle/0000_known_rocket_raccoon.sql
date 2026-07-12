CREATE TABLE `external_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`kind` text DEFAULT 'mixed' NOT NULL,
	`description` text,
	`enabled` integer DEFAULT true NOT NULL,
	`sync_interval_minutes` integer DEFAULT 360 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `interest_aliases` (
	`interest_id` integer NOT NULL,
	`alias` text NOT NULL,
	`normalized_alias` text NOT NULL,
	PRIMARY KEY(`interest_id`, `normalized_alias`),
	FOREIGN KEY (`interest_id`) REFERENCES `interests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `interest_aliases_normalized_alias_idx` ON `interest_aliases` (`normalized_alias`);--> statement-breakpoint
CREATE TABLE `interest_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`interest_id` integer NOT NULL,
	`source_id` text NOT NULL,
	`event_type` text NOT NULL,
	`occurred_at` text NOT NULL,
	`observed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`weight` real DEFAULT 1 NOT NULL,
	`properties_json` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`interest_id`) REFERENCES `interests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `external_sources`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `interest_events_interest_occurred_at_idx` ON `interest_events` (`interest_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `interest_events_source_occurred_at_idx` ON `interest_events` (`source_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `interest_events_event_type_idx` ON `interest_events` (`event_type`);--> statement-breakpoint
CREATE TABLE `interest_external_refs` (
	`interest_id` integer NOT NULL,
	`source_id` text NOT NULL,
	`external_id` text NOT NULL,
	`external_url` text,
	`properties_json` text DEFAULT '{}' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`interest_id`, `source_id`),
	FOREIGN KEY (`interest_id`) REFERENCES `interests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `external_sources`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `interest_external_refs_source_external_id_unique` ON `interest_external_refs` (`source_id`,`external_id`);--> statement-breakpoint
CREATE TABLE `interest_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`interest_id` integer NOT NULL,
	`kind` text NOT NULL,
	`note` text NOT NULL,
	`source` text DEFAULT 'seed' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`interest_id`) REFERENCES `interests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `interest_notes_interest_kind_idx` ON `interest_notes` (`interest_id`,`kind`);--> statement-breakpoint
CREATE TABLE `interest_relations` (
	`source_interest_id` integer NOT NULL,
	`target_interest_id` integer NOT NULL,
	`relation_type_id` text NOT NULL,
	`description` text,
	`properties_json` text DEFAULT '{}' NOT NULL,
	`weight` real DEFAULT 1 NOT NULL,
	`source` text DEFAULT 'seed' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`source_interest_id`, `target_interest_id`, `relation_type_id`),
	FOREIGN KEY (`source_interest_id`) REFERENCES `interests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_interest_id`) REFERENCES `interests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`relation_type_id`) REFERENCES `relation_types`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `interest_relations_source_idx` ON `interest_relations` (`source_interest_id`,`relation_type_id`,`weight`);--> statement-breakpoint
CREATE INDEX `interest_relations_target_idx` ON `interest_relations` (`target_interest_id`,`relation_type_id`,`weight`);--> statement-breakpoint
CREATE INDEX `interest_relations_relation_type_idx` ON `interest_relations` (`relation_type_id`);--> statement-breakpoint
CREATE TABLE `interest_roles` (
	`interest_id` integer NOT NULL,
	`role_id` text NOT NULL,
	`source` text DEFAULT 'seed' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`interest_id`, `role_id`),
	FOREIGN KEY (`interest_id`) REFERENCES `interests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `role_types`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `interest_roles_role_idx` ON `interest_roles` (`role_id`);--> statement-breakpoint
CREATE TABLE `interest_scores` (
	`interest_id` integer NOT NULL,
	`score_type` text NOT NULL,
	`scope` text DEFAULT 'global' NOT NULL,
	`value` real NOT NULL,
	`computed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`window_started_at` text,
	`window_ended_at` text,
	`properties_json` text DEFAULT '{}' NOT NULL,
	PRIMARY KEY(`interest_id`, `score_type`, `scope`),
	FOREIGN KEY (`interest_id`) REFERENCES `interests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `interest_scores_score_value_idx` ON `interest_scores` (`score_type`,`scope`,`value`);--> statement-breakpoint
CREATE TABLE `interest_tags` (
	`interest_id` integer NOT NULL,
	`tag` text NOT NULL,
	PRIMARY KEY(`interest_id`, `tag`),
	FOREIGN KEY (`interest_id`) REFERENCES `interests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `interest_tags_tag_idx` ON `interest_tags` (`tag`);--> statement-breakpoint
CREATE TABLE `interest_types` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `interests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`domain` text NOT NULL,
	`type_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`disambiguation` text,
	`properties_json` text DEFAULT '{}' NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`rating` integer DEFAULT 0 NOT NULL,
	`last_observed_at` text,
	`source` text DEFAULT 'seed' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`type_id`) REFERENCES `interest_types`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `interests_domain_type_idx` ON `interests` (`domain`,`type_id`);--> statement-breakpoint
CREATE INDEX `interests_priority_idx` ON `interests` (`priority`);--> statement-breakpoint
CREATE INDEX `interests_rating_idx` ON `interests` (`rating`);--> statement-breakpoint
CREATE INDEX `interests_last_observed_at_idx` ON `interests` (`last_observed_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `interests_domain_type_slug_unique` ON `interests` (`domain`,`type_id`,`slug`);--> statement-breakpoint
CREATE TABLE `relation_types` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`description` text,
	`directed` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `role_types` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_cursors` (
	`source_id` text PRIMARY KEY NOT NULL,
	`cursor_json` text DEFAULT '{}' NOT NULL,
	`synced_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `external_sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`finished_at` text,
	`cursor_json` text DEFAULT '{}' NOT NULL,
	`error` text,
	FOREIGN KEY (`source_id`) REFERENCES `external_sources`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `sync_runs_source_started_at_idx` ON `sync_runs` (`source_id`,`started_at`);