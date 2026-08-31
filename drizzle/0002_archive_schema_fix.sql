ALTER TABLE `players` ADD COLUMN `history_token` text;
--> statement-breakpoint
UPDATE `players` SET `history_token` = lower(hex(randomblob(16))) WHERE `history_token` IS NULL OR trim(`history_token`) = '';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `players_history_token_unique` ON `players` (`history_token`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `archived_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`player_id` text NOT NULL,
	`history_token` text NOT NULL,
	`opponent_name` text NOT NULL,
	`archived_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`result` text NOT NULL,
	`forfeit` integer DEFAULT 0 NOT NULL,
	`scoreboard` text NOT NULL,
	`prompts` text NOT NULL,
	`messages` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `archived_matches_history_token_idx` ON `archived_matches` (`history_token`);
