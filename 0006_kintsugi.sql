CREATE TABLE `kintsugi_fragments` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `room_id` text NOT NULL REFERENCES `rooms`(`id`) ON DELETE cascade,
  `subject_player_id` text NOT NULL REFERENCES `players`(`id`) ON DELETE cascade,
  `question_id` integer NOT NULL,
  `word` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `kintsugi_fragment_subject_question_unique` ON `kintsugi_fragments` (`subject_player_id`,`question_id`);
CREATE TABLE `kintsugi_portraits` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `room_id` text NOT NULL REFERENCES `rooms`(`id`) ON DELETE cascade,
  `subject_player_id` text NOT NULL REFERENCES `players`(`id`) ON DELETE cascade,
  `author_player_id` text NOT NULL REFERENCES `players`(`id`) ON DELETE cascade,
  `body` text DEFAULT '' NOT NULL,
  `sealed_at` text,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `kintsugi_portrait_subject_unique` ON `kintsugi_portraits` (`subject_player_id`);
