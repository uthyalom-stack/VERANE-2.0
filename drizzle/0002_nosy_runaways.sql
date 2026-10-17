CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`parent_id` text,
	`brand_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_categories_slug` ON `categories` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_categories_parent_id` ON `categories` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_categories_brand_id` ON `categories` (`brand_id`);--> statement-breakpoint
CREATE TABLE `collection_products` (
	`collection_id` text NOT NULL,
	`product_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`collection_id`, `product_id`),
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_collection_products_collection_id` ON `collection_products` (`collection_id`);--> statement-breakpoint
CREATE INDEX `idx_collection_products_product_id` ON `collection_products` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_collection_products_position` ON `collection_products` (`position`);--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`is_featured` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collections_slug_unique` ON `collections` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_collections_brand_id` ON `collections` (`brand_id`);--> statement-breakpoint
CREATE INDEX `idx_collections_slug` ON `collections` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_collections_status` ON `collections` (`status`);--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`reserved_quantity` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_variant_id_unique` ON `inventory` (`variant_id`);--> statement-breakpoint
CREATE INDEX `idx_inventory_variant_id` ON `inventory` (`variant_id`);--> statement-breakpoint
CREATE TABLE `inventory_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`type` text NOT NULL,
	`quantity_change` integer NOT NULL,
	`previous_quantity` integer NOT NULL,
	`new_quantity` integer NOT NULL,
	`reason` text,
	`actor_user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_inventory_tx_variant_id` ON `inventory_transactions` (`variant_id`);--> statement-breakpoint
CREATE INDEX `idx_inventory_tx_actor_id` ON `inventory_transactions` (`actor_user_id`);--> statement-breakpoint
CREATE TABLE `product_categories` (
	`product_id` text NOT NULL,
	`category_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`product_id`, `category_id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_product_categories_product_id` ON `product_categories` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_product_categories_category_id` ON `product_categories` (`category_id`);--> statement-breakpoint
CREATE TABLE `product_media` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`variant_id` text,
	`media_type` text NOT NULL,
	`url` text NOT NULL,
	`alt_text` text,
	`width` integer,
	`height` integer,
	`duration_seconds` integer,
	`poster_url` text,
	`position` integer DEFAULT 0 NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_product_media_product_id` ON `product_media` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_product_media_variant_id` ON `product_media` (`variant_id`);--> statement-breakpoint
CREATE INDEX `idx_product_media_position` ON `product_media` (`position`);--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`sku` text NOT NULL,
	`size` text,
	`color` text,
	`color_code` text,
	`price_override_cents` integer,
	`currency` text DEFAULT 'NGN' NOT NULL,
	`barcode` text,
	`weight_grams` integer,
	`dimensions` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_variants_sku_unique` ON `product_variants` (`sku`);--> statement-breakpoint
CREATE INDEX `idx_product_variants_product_id` ON `product_variants` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_product_variants_sku` ON `product_variants` (`sku`);--> statement-breakpoint
CREATE INDEX `idx_product_variants_status` ON `product_variants` (`status`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`short_description` text,
	`full_description` text,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`materials` text,
	`care_info` text,
	`fit_info` text,
	`sizing_info` text,
	`seo_title` text,
	`seo_description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_products_brand_id` ON `products` (`brand_id`);--> statement-breakpoint
CREATE INDEX `idx_products_slug` ON `products` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_products_status` ON `products` (`status`);