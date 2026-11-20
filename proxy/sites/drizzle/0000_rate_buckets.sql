CREATE TABLE `rate_buckets` (
  `bucket` text PRIMARY KEY NOT NULL,
  `requests` integer NOT NULL DEFAULT 0,
  `expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_buckets_expires_at_idx` ON `rate_buckets` (`expires_at`);
