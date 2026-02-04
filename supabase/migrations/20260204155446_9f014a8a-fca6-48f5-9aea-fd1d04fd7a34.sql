-- FASE 1.1: Slet salg med pseudo-emails (agent-*@adversus.local)
DELETE FROM sale_items
WHERE sale_id IN (
  SELECT id FROM sales 
  WHERE agent_email LIKE 'agent-%@adversus.local'
);

DELETE FROM sales
WHERE agent_email LIKE 'agent-%@adversus.local';

DELETE FROM agents
WHERE email LIKE 'agent-%@adversus.local';

-- FASE 1.2: Slet Enreach-salg uden agent_email
DELETE FROM sale_items
WHERE sale_id IN (
  SELECT id FROM sales 
  WHERE (agent_email IS NULL OR agent_email = '')
    AND integration_type = 'enreach'
);

DELETE FROM sales
WHERE (agent_email IS NULL OR agent_email = '')
  AND integration_type = 'enreach';

-- FASE 2.1: Fix UNIQUE constraints med NULLS NOT DISTINCT
-- Drop existing constraints
ALTER TABLE kpi_leaderboard_cache 
  DROP CONSTRAINT IF EXISTS kpi_leaderboard_cache_period_type_scope_type_scope_id_key;
ALTER TABLE kpi_leaderboard_cache 
  DROP CONSTRAINT IF EXISTS kpi_leaderboard_cache_unique;
  
ALTER TABLE kpi_cached_values 
  DROP CONSTRAINT IF EXISTS kpi_cached_values_kpi_slug_period_type_scope_type_scope_id_key;
ALTER TABLE kpi_cached_values 
  DROP CONSTRAINT IF EXISTS kpi_cached_values_unique;

-- Add new constraints with NULLS NOT DISTINCT
ALTER TABLE kpi_leaderboard_cache 
  ADD CONSTRAINT kpi_leaderboard_cache_unique 
  UNIQUE NULLS NOT DISTINCT (period_type, scope_type, scope_id);

ALTER TABLE kpi_cached_values 
  ADD CONSTRAINT kpi_cached_values_unique 
  UNIQUE NULLS NOT DISTINCT (kpi_slug, period_type, scope_type, scope_id);

-- FASE 2.2: Ryd eksisterende duplikater fra kpi_leaderboard_cache
DELETE FROM kpi_leaderboard_cache a
USING kpi_leaderboard_cache b
WHERE a.id < b.id
  AND a.period_type = b.period_type
  AND a.scope_type = b.scope_type
  AND COALESCE(a.scope_id::text, '') = COALESCE(b.scope_id::text, '');

-- Ryd duplikater fra kpi_cached_values
DELETE FROM kpi_cached_values a
USING kpi_cached_values b
WHERE a.id < b.id
  AND a.kpi_slug = b.kpi_slug
  AND a.period_type = b.period_type
  AND a.scope_type = b.scope_type
  AND COALESCE(a.scope_id::text, '') = COALESCE(b.scope_id::text, '');

-- FASE 5: Opret RPC get_sales_aggregates for server-side aggregering
CREATE OR REPLACE FUNCTION get_sales_aggregates(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_team_id UUID DEFAULT NULL,
  p_employee_id UUID DEFAULT NULL,
  p_client_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_sales INTEGER,
  total_commission DECIMAL,
  total_revenue DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(si.quantity), 0)::INTEGER AS total_sales,
    COALESCE(SUM(si.mapped_commission * si.quantity), 0) AS total_commission,
    COALESCE(SUM(si.mapped_revenue * si.quantity), 0) AS total_revenue
  FROM sale_items si
  JOIN sales s ON si.sale_id = s.id
  LEFT JOIN client_campaigns cc ON s.client_campaign_id = cc.id
  LEFT JOIN agents a ON s.agent_email = a.email
  LEFT JOIN employee_agent_mapping eam ON a.id = eam.agent_id
  LEFT JOIN team_members tm ON eam.employee_id = tm.employee_id
  WHERE s.sale_datetime BETWEEN p_start AND p_end
    AND (p_team_id IS NULL OR tm.team_id = p_team_id)
    AND (p_employee_id IS NULL OR eam.employee_id = p_employee_id)
    AND (p_client_id IS NULL OR cc.client_id = p_client_id)
    AND COALESCE(s.validation_status, 'approved') NOT IN ('cancelled', 'rejected');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- FASE 7: Cleanup funktion for stale cache
CREATE OR REPLACE FUNCTION cleanup_stale_leaderboard_cache()
RETURNS integer AS $$
DECLARE v_deleted INTEGER;
BEGIN
  DELETE FROM kpi_leaderboard_cache
  WHERE calculated_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;