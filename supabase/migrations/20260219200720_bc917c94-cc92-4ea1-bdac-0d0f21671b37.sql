-- Forbedring 1: GIN-index på raw_payload JSONB-kolonnen
CREATE INDEX IF NOT EXISTS idx_sales_raw_payload ON sales USING gin (raw_payload jsonb_path_ops);

-- Forbedring 2: Composite index for source + sale_datetime queries
CREATE INDEX IF NOT EXISTS idx_sales_source_datetime ON sales (source, sale_datetime DESC);

-- Forbedring 3: Unique constraint på leaderboard cache for at muliggøre UPSERT
CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_cache_unique 
ON kpi_leaderboard_cache (period_type, scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'));