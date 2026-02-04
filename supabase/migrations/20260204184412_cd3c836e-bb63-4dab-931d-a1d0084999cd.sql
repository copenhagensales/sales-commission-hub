-- Cleanup duplicate watermarks (keep the newest for each unique combo)
-- Handle NULL scope_id properly with IS NOT DISTINCT FROM
DELETE FROM kpi_watermarks w1
WHERE w1.id NOT IN (
  SELECT DISTINCT ON (period_type, scope_type, scope_id) id
  FROM kpi_watermarks
  ORDER BY period_type, scope_type, scope_id, last_processed_at DESC NULLS LAST
);

-- Add unique constraint to prevent future duplicates
-- Use a functional unique index that handles NULL values
CREATE UNIQUE INDEX IF NOT EXISTS unique_watermark_key 
ON kpi_watermarks (period_type, scope_type, (scope_id IS NULL), scope_id)
WHERE scope_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_watermark_key_null 
ON kpi_watermarks (period_type, scope_type)
WHERE scope_id IS NULL;