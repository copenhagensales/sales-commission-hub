-- ============================================
-- FASE 1: AKUT DATABASE CLEANUP (Final)
-- ============================================

-- 1.4 Drop ubrugte indekser og constraints
DROP INDEX IF EXISTS idx_sale_items_product_aggregation;
ALTER TABLE adversus_events DROP CONSTRAINT IF EXISTS adversus_events_external_id_key;
DROP INDEX IF EXISTS idx_sales_adversus_external_id;

-- 1.5 Opret automatisk cleanup cron job (forebygger fremtidig bloat)
SELECT cron.schedule(
  'cleanup-old-logs',
  '0 4 * * *',
  $$
    DELETE FROM login_events WHERE logged_in_at < NOW() - INTERVAL '30 days';
    DELETE FROM integration_logs WHERE created_at < NOW() - INTERVAL '30 days';
    DELETE FROM adversus_events WHERE received_at < NOW() - INTERVAL '30 days';
    DELETE FROM cron.job_run_details WHERE end_time < NOW() - INTERVAL '7 days';
  $$
);