ALTER TABLE `products` ADD `size_guide_media_id` text REFERENCES media_assets(id) ON DELETE SET NULL;--> statement-breakpoint
