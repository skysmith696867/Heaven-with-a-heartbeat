UPDATE `rooms`
SET `code` = `code` || ' · past ' || substr(`id`, 1, 6),
    `updated_at` = CURRENT_TIMESTAMP
WHERE `phase` IN ('closed', 'finished')
  AND instr(`code`, ' · past ') = 0;
--> statement-breakpoint
UPDATE `rooms`
SET `code` = 'Kingdom of thoughts',
    `updated_at` = CURRENT_TIMESTAMP
WHERE lower(`code`) = 'heavenly kingdom dreams'
  AND `phase` = 'waiting';
