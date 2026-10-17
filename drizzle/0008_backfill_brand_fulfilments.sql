INSERT OR IGNORE INTO `order_brand_fulfilments` (`id`, `order_id`, `brand_id`, `method`, `status`, `created_at`, `updated_at`)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-a' || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
  oi.`order_id`,
  oi.`brand_id`,
  'delivery',
  CASE
    WHEN o.`status` = 'delivered' THEN 'delivered'
    WHEN o.`status` = 'shipped' THEN 'shipped'
    WHEN o.`status` = 'processing' THEN 'processing'
    WHEN o.`status` IN ('cancelled', 'refunded') THEN 'cancelled'
    ELSE 'unfulfilled'
  END,
  unixepoch() * 1000,
  unixepoch() * 1000
FROM (SELECT DISTINCT `order_id`, `brand_id` FROM `order_items`) oi
INNER JOIN `orders` o ON o.`id` = oi.`order_id`
WHERE NOT EXISTS (
  SELECT 1 FROM `order_brand_fulfilments` f
  WHERE f.`order_id` = oi.`order_id` AND f.`brand_id` = oi.`brand_id`
);--> statement-breakpoint
UPDATE `shipping_records`
SET `brand_id` = (
  SELECT MIN(oi.`brand_id`) FROM `order_items` oi WHERE oi.`order_id` = `shipping_records`.`order_id`
)
WHERE `brand_id` IS NULL
  AND (SELECT COUNT(DISTINCT oi.`brand_id`) FROM `order_items` oi WHERE oi.`order_id` = `shipping_records`.`order_id`) = 1;
