-- FASE 2.2: Fix UNIQUE constraints med NULLS NOT DISTINCT
ALTER TABLE kpi_leaderboard_cache 
  DROP CONSTRAINT IF EXISTS kpi_leaderboard_cache_period_type_scope_type_scope_id_key;
ALTER TABLE kpi_leaderboard_cache 
  DROP CONSTRAINT IF EXISTS kpi_leaderboard_cache_unique;
ALTER TABLE kpi_leaderboard_cache 
  ADD CONSTRAINT kpi_leaderboard_cache_unique 
  UNIQUE NULLS NOT DISTINCT (period_type, scope_type, scope_id);

ALTER TABLE kpi_cached_values 
  DROP CONSTRAINT IF EXISTS kpi_cached_values_kpi_slug_period_type_scope_type_scope_id_key;
ALTER TABLE kpi_cached_values 
  DROP CONSTRAINT IF EXISTS kpi_cached_values_unique;
ALTER TABLE kpi_cached_values 
  ADD CONSTRAINT kpi_cached_values_unique 
  UNIQUE NULLS NOT DISTINCT (kpi_slug, period_type, scope_type, scope_id);

-- FASE 2.3: Opret RPC-funktion til server-side aggregering
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
    COALESCE(SUM(si.quantity), 0)::INTEGER,
    COALESCE(SUM(si.mapped_commission * si.quantity), 0),
    COALESCE(SUM(si.mapped_revenue * si.quantity), 0)
  FROM sale_items si
  JOIN sales s ON si.sale_id = s.id
  LEFT JOIN client_campaigns cc ON s.client_campaign_id = cc.id
  LEFT JOIN employee_agent_mapping eam ON (
    s.agent_email = (SELECT email FROM agents WHERE id = eam.agent_id)
  )
  LEFT JOIN team_members tm ON eam.employee_id = tm.employee_id
  WHERE s.sale_datetime BETWEEN p_start AND p_end
    AND (p_team_id IS NULL OR tm.team_id = p_team_id)
    AND (p_employee_id IS NULL OR eam.employee_id = p_employee_id)
    AND (p_client_id IS NULL OR cc.client_id = p_client_id)
    AND COALESCE(s.validation_status, 'approved') NOT IN ('cancelled', 'rejected');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- FASE 7: Opret cleanup-funktion for leaderboard cache
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