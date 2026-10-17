ALTER TABLE `products` ADD `custom_sizing_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `pre_order_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `fulfillment_time` text;--> statement-breakpoint
ALTER TABLE `order_items` ADD `custom_measurements` text;--> statement-breakpoint
ALTER TABLE `order_items` ADD `is_pre_order` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE `back_in_stock_subscriptions` (
  `id` text PRIMARY KEY NOT NULL,
  `product_id` text NOT NULL,
  `variant_id` text,
  `user_id` text,
  `email` text NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `notified_at` integer,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
CREATE INDEX `back_in_stock_product_status_idx` ON `back_in_stock_subscriptions` (`product_id`,`status`);--> statement-breakpoint
CREATE INDEX `back_in_stock_variant_status_idx` ON `back_in_stock_subscriptions` (`variant_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `back_in_stock_email_product_variant_uq` ON `back_in_stock_subscriptions` (`email`,`product_id`,`variant_id`);--> statement-breakpoint
CREATE TABLE `brand_collaboration_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `from_brand_id` text NOT NULL,
  `to_brand_id` text NOT NULL,
  `title` text NOT NULL,
  `message` text,
  `status` text DEFAULT 'pending' NOT NULL,
  `reviewed_by` text,
  `reviewed_at` integer,
  `collaboration_id` text,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`from_brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`to_brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
CREATE INDEX `brand_collab_request_from_idx` ON `brand_collaboration_requests` (`from_brand_id`,`status`);--> statement-breakpoint
CREATE INDEX `brand_collab_request_to_idx` ON `brand_collaboration_requests` (`to_brand_id`,`status`);--> statement-breakpoint
CREATE INDEX `brand_collab_request_status_idx` ON `brand_collaboration_requests` (`status`);--> statement-breakpoint
CREATE TABLE `brand_collaboration_products` (
  `id` text PRIMARY KEY NOT NULL,
  `collaboration_id` text NOT NULL,
  `brand_a_product_id` text NOT NULL,
  `brand_b_product_id` text NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `price` integer NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`brand_a_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`brand_b_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict
);--> statement-breakpoint
CREATE INDEX `brand_collab_product_collab_idx` ON `brand_collaboration_products` (`collaboration_id`);--> statement-breakpoint
CREATE INDEX `brand_collab_product_a_idx` ON `brand_collaboration_products` (`brand_a_product_id`);--> statement-breakpoint
CREATE INDEX `brand_collab_product_b_idx` ON `brand_collaboration_products` (`brand_b_product_id`);--> statement-breakpoint
CREATE INDEX `brand_collab_product_status_idx` ON `brand_collaboration_products` (`status`);--> statement-breakpoint
CREATE TABLE `brand_collaboration_variants` (
  `id` text PRIMARY KEY NOT NULL,
  `collaboration_product_id` text NOT NULL,
  `brand_a_variant_id` text,
  `brand_b_variant_id` text,
  `brand_a_size` text,
  `brand_a_color` text,
  `brand_b_size` text,
  `brand_b_color` text,
  `on_hand` integer DEFAULT 0 NOT NULL,
  `reserved` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`collaboration_product_id`) REFERENCES `brand_collaboration_products`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`brand_a_variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`brand_b_variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
CREATE INDEX `brand_collab_variant_product_idx` ON `brand_collaboration_variants` (`collaboration_product_id`);--> statement-breakpoint
CREATE INDEX `brand_collab_variant_a_idx` ON `brand_collaboration_variants` (`brand_a_variant_id`);--> statement-breakpoint
CREATE INDEX `brand_collab_variant_b_idx` ON `brand_collaboration_variants` (`brand_b_variant_id`);--> statement-breakpoint
CREATE TABLE `tracking_campaigns` (
  `id` text PRIMARY KEY NOT NULL,
  `brand_id` text,
  `name` text NOT NULL,
  `slug` text NOT NULL,
  `platform` text DEFAULT 'Other' NOT NULL,
  `source` text,
  `medium` text,
  `destination` text DEFAULT '/' NOT NULL,
  `is_active` integer DEFAULT true NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE restrict
);--> statement-breakpoint
CREATE UNIQUE INDEX `tracking_campaigns_slug_unique` ON `tracking_campaigns` (`slug`);--> statement-breakpoint
CREATE INDEX `tracking_campaign_brand_idx` ON `tracking_campaigns` (`brand_id`);--> statement-breakpoint
CREATE INDEX `tracking_campaign_active_idx` ON `tracking_campaigns` (`is_active`);--> statement-breakpoint
CREATE TABLE `tracking_campaign_visits` (
  `id` text PRIMARY KEY NOT NULL,
  `campaign_id` text NOT NULL,
  `brand_id` text,
  `visitor_hash` text NOT NULL,
  `destination` text NOT NULL,
  `referrer_host` text,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`campaign_id`) REFERENCES `tracking_campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
CREATE INDEX `tracking_visit_campaign_idx` ON `tracking_campaign_visits` (`campaign_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `tracking_visit_visitor_idx` ON `tracking_campaign_visits` (`visitor_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `order_attributions` (
  `id` text PRIMARY KEY NOT NULL,
  `order_id` text NOT NULL,
  `campaign_id` text NOT NULL,
  `brand_id` text,
  `visitor_hash` text,
  `model` text DEFAULT 'last_touch' NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`campaign_id`) REFERENCES `tracking_campaigns`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
CREATE UNIQUE INDEX `order_attributions_order_id_unique` ON `order_attributions` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_attribution_campaign_idx` ON `order_attributions` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `order_attribution_brand_idx` ON `order_attributions` (`brand_id`);--> statement-breakpoint
CREATE TABLE `pickup_locations` (
  `id` text PRIMARY KEY NOT NULL,
  `brand_id` text NOT NULL,
  `name` text NOT NULL,
  `address_line1` text NOT NULL,
  `address_line2` text,
  `city` text NOT NULL,
  `state` text NOT NULL,
  `postal_code` text,
  `country` text DEFAULT 'NG' NOT NULL,
  `instructions` text,
  `is_active` integer DEFAULT true NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE restrict
);--> statement-breakpoint
CREATE INDEX `pickup_locations_brand_active_idx` ON `pickup_locations` (`brand_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `order_brand_fulfilments` (
  `id` text PRIMARY KEY NOT NULL,
  `order_id` text NOT NULL,
  `brand_id` text NOT NULL,
  `method` text DEFAULT 'delivery' NOT NULL,
  `status` text DEFAULT 'unfulfilled' NOT NULL,
  `pickup_location_id` text,
  `pickup_location_snapshot` text,
  `carrier` text,
  `tracking_number` text,
  `tracking_url` text,
  `fulfilled_at` integer,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`pickup_location_id`) REFERENCES `pickup_locations`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
CREATE UNIQUE INDEX `order_brand_fulfilment_order_brand_uq` ON `order_brand_fulfilments` (`order_id`,`brand_id`);--> statement-breakpoint
CREATE INDEX `order_brand_fulfilment_brand_status_idx` ON `order_brand_fulfilments` (`brand_id`,`status`);
