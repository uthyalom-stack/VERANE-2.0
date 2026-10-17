ALTER TABLE `products` ADD `base_price_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `currency` text DEFAULT 'NGN' NOT NULL;