ALTER TABLE `shipping_records` ADD `brand_id` text REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE set null;--> statement-breakpoint
CREATE INDEX `shipping_records_brand_idx` ON `shipping_records` (`brand_id`,`order_id`);
