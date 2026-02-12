CREATE OR REPLACE FUNCTION get_sales_aggregates_v2(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_team_id UUID DEFAULT NULL,
  p_employee_id UUID DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_group_by TEXT DEFAULT 'none',
  p_agent_emails TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  group_key TEXT,
  group_name TEXT,
  total_sales INTEGER,
  total_commission DECIMAL,
  total_revenue DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_sales AS (
    SELECT 
      s.id,
      s.agent_email,
      s.sale_datetime,
      si.quantity,
      si.mapped_commission,
      si.mapped_revenue,
      p.counts_as_sale
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    LEFT JOIN products p ON si.product_id = p.id
    LEFT JOIN client_campaigns cc ON s.client_campaign_id = cc.id
    LEFT JOIN agents a ON LOWER(s.agent_email) = LOWER(a.email)
    LEFT JOIN employee_agent_mapping eam ON a.id = eam.agent_id
    LEFT JOIN team_members tm ON eam.employee_id = tm.employee_id
    WHERE s.sale_datetime >= p_start
      AND s.sale_datetime <= p_end
      AND (p_team_id IS NULL OR tm.team_id = p_team_id)
      AND (p_employee_id IS NULL OR eam.employee_id = p_employee_id)
      AND (p_client_id IS NULL OR cc.client_id = p_client_id)
      AND (p_agent_emails IS NULL OR LOWER(s.agent_email) = ANY(SELECT LOWER(unnest(p_agent_emails))))
      AND COALESCE(s.validation_status, 'approved') NOT IN ('cancelled', 'rejected')
  )
  SELECT 
    CASE 
      WHEN p_group_by = 'employee' THEN fs.agent_email
      WHEN p_group_by = 'date' THEN DATE(fs.sale_datetime)::TEXT
      WHEN p_group_by = 'both' THEN fs.agent_email || '|' || DATE(fs.sale_datetime)::TEXT
      ELSE 'total'
    END AS group_key,
    CASE 
      WHEN p_group_by = 'employee' THEN SPLIT_PART(fs.agent_email, '@', 1)
      WHEN p_group_by = 'date' THEN TO_CHAR(DATE(fs.sale_datetime), 'YYYY-MM-DD')
      WHEN p_group_by = 'both' THEN SPLIT_PART(fs.agent_email, '@', 1) || ' (' || TO_CHAR(DATE(fs.sale_datetime), 'YYYY-MM-DD') || ')'
      ELSE 'Total'
    END AS group_name,
    COALESCE(SUM(CASE WHEN COALESCE(fs.counts_as_sale, true) THEN fs.quantity ELSE 0 END), 0)::INTEGER AS total_sales,
    COALESCE(SUM(fs.mapped_commission), 0) AS total_commission,
    COALESCE(SUM(fs.mapped_revenue), 0) AS total_revenue
  FROM filtered_sales fs
  GROUP BY 
    CASE 
      WHEN p_group_by = 'employee' THEN fs.agent_email
      WHEN p_group_by = 'date' THEN DATE(fs.sale_datetime)::TEXT
      WHEN p_group_by = 'both' THEN fs.agent_email || '|' || DATE(fs.sale_datetime)::TEXT
      ELSE 'total'
    END,
    CASE 
      WHEN p_group_by = 'employee' THEN SPLIT_PART(fs.agent_email, '@', 1)
      WHEN p_group_by = 'date' THEN TO_CHAR(DATE(fs.sale_datetime), 'YYYY-MM-DD')
      WHEN p_group_by = 'both' THEN SPLIT_PART(fs.agent_email, '@', 1) || ' (' || TO_CHAR(DATE(fs.sale_datetime), 'YYYY-MM-DD') || ')'
      ELSE 'Total'
    END
  ORDER BY total_commission DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;