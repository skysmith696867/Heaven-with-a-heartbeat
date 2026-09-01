CREATE TABLE IF NOT EXISTS `chronicle_answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_id` text NOT NULL,
	`player_id` text NOT NULL,
	`question_id` integer NOT NULL,
	`answer` text NOT NULL,
	`points_awarded` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `chronicle_answers_player_question_unique` ON `chronicle_answers` (`player_id`,`question_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `chronicle_answers_room_idx` ON `chronicle_answers` (`room_id`);
