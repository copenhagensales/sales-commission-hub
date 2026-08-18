CREATE OR REPLACE FUNCTION public.get_league_team_provision(
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE (team_id uuid, employee_id uuid, total_commission numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    tc.team_id,
    emp.employee_id,
    COALESCE(SUM(si.mapped_commission), 0) AS total_commission
  FROM sales s
  JOIN sale_items si ON si.sale_id = s.id
  JOIN client_campaigns cc ON cc.id = s.client_campaign_id
  JOIN team_clients tc ON tc.client_id = cc.client_id
  LEFT JOIN agents a ON lower(a.email) = lower(s.agent_email)
  LEFT JOIN employee_agent_mapping eam ON eam.agent_id = a.id
  LEFT JOIN employee_master_data emd_fb
    ON eam.employee_id IS NULL
   AND lower(emd_fb.work_email) = lower(s.agent_email)
  CROSS JOIN LATERAL (SELECT COALESCE(eam.employee_id, emd_fb.id) AS employee_id) emp
  WHERE s.sale_datetime >= p_start
    AND s.sale_datetime <= p_end
    AND COALESCE(s.validation_status, 'approved') NOT IN ('rejected', 'cancelled')
    AND emp.employee_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.employee_id = emp.employee_id
        AND tm.team_id = tc.team_id
    )
  GROUP BY tc.team_id, emp.employee_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_league_team_provision(timestamptz, timestamptz) TO authenticated;