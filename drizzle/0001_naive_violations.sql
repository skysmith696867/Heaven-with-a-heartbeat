CREATE TABLE `archived_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`player_id` text NOT NULL,
	`history_token` text NOT NULL,
	`opponent_name` text NOT NULL,
	`archived_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`result` text NOT NULL,
	`forfeit` integer DEFAULT false NOT NULL,
	`scoreboard` text NOT NULL,
	`prompts` text NOT NULL,
	`messages` text NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_players` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`token` text,
	`history_token` text NOT NULL,
	`name` text NOT NULL,
	`seat` integer NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_players`("id", "room_id", "token", "history_token", "name", "seat", "joined_at") SELECT "id", "room_id", "token", lower(hex(randomblob(16))), "name", "seat", "joined_at" FROM `players`;--> statement-breakpoint
DROP TABLE `players`;--> statement-breakpoint
ALTER TABLE `__new_players` RENAME TO `players`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `players_token_unique` ON `players` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `players_history_token_unique` ON `players` (`history_token`);