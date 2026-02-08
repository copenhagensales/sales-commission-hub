-- ============================================
-- FASE 7-8: LANGSIGTET SETUP
-- ============================================

-- Opret materialized view for daglige salgsaggregater
-- Dette reducerer belastningen på dashboards ved at præ-aggregere data
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_sales_stats AS
SELECT 
  DATE(s.sale_datetime) as sale_date,
  s.client_campaign_id,
  s.agent_email,
  cc.client_id,
  COUNT(*) as sale_row_count,
  COALESCE(SUM(si.quantity), 0) as total_quantity,
  COALESCE(SUM(si.mapped_commission), 0) as total_commission,
  COALESCE(SUM(si.mapped_revenue), 0) as total_revenue
FROM sales s
LEFT JOIN sale_items si ON si.sale_id = s.id
LEFT JOIN client_campaigns cc ON cc.id = s.client_campaign_id
WHERE s.sale_datetime >= NOW() - INTERVAL '90 days'
GROUP BY DATE(s.sale_datetime), s.client_campaign_id, s.agent_email, cc.client_id
WITH DATA;

-- Opret unik index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_agg_unique 
ON mv_daily_sales_stats(sale_date, client_campaign_id, COALESCE(agent_email, ''), COALESCE(client_id, '00000000-0000-0000-0000-000000000000'));

-- Opret additional indexes for common queries
CREATE INDEX IF NOT EXISTS idx_mv_daily_stats_date ON mv_daily_sales_stats(sale_date);
CREATE INDEX IF NOT EXISTS idx_mv_daily_stats_client ON mv_daily_sales_stats(client_id);

-- Opret cron job til hourly refresh af materialized view
SELECT cron.schedule(
  'refresh-daily-sales-stats',
  '5 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_sales_stats;$$
);