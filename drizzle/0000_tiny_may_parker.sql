CREATE TABLE `infrastructure_smoke_tests` (
	`id` text PRIMARY KEY NOT NULL,
	`test_key` text NOT NULL,
	`value` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `infrastructure_smoke_tests_test_key_unique` ON `infrastructure_smoke_tests` (`test_key`);