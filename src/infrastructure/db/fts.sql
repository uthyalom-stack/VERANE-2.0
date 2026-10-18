-- Applied idempotently by scripts/migrate.ts AFTER drizzle migrations (Drizzle cannot model FTS5 virtual tables).
CREATE VIRTUAL TABLE IF NOT EXISTS product_search USING fts5(
  product_id UNINDEXED, brand_id UNINDEXED, name, subtitle, description, product_type, style, occasion, categories,
  tokenize = 'unicode61 remove_diacritics 2'
);
