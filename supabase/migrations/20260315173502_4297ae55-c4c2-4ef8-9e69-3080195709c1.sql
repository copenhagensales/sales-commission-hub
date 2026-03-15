
CREATE OR REPLACE FUNCTION public.get_cs_top20_custom_period_leaderboard(
  p_from timestamp with time zone,
  p_to timestamp with time zone,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  employee_id uuid,
  employee_name text,
  avatar_url text,
  team_name text,
  sales_count bigint,
  commission numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  RETURN QUERY
  WITH me AS (
    SELECT emd.id
    FROM public.employee_master_data emd
    WHERE emd.auth_user_id = auth.uid()
      AND emd.is_active = true
    LIMIT 1
  ),
  has_dashboard_access AS (
    SELECT EXISTS (
      SELECT 1
      FROM public.team_members tm
      JOIN public.team_dashboard_permissions tdp ON tdp.team_id = tm.team_id
      JOIN me ON me.id = tm.employee_id
      WHERE tdp.dashboard_slug = 'cs-top-20'
        AND tdp.access_level <> 'none'
    ) OR public.is_owner(auth.uid()) AS allowed
  )
  SELECT
    COALESCE(emd_tm.id, emd_fm.id) AS employee_id,
    TRIM(CONCAT(
      COALESCE(COALESCE(emd_tm.first_name, emd_fm.first_name), ''), ' ',
      COALESCE(COALESCE(emd_tm.last_name, emd_fm.last_name), '')
    )) AS employee_name,
    COALESCE(emd_tm.avatar_url, emd_fm.avatar_url) AS avatar_url,
    COALESCE(t_tm.name, t_fm.name) AS team_name,
    COALESCE(SUM(CASE WHEN COALESCE(p.counts_as_sale, true) THEN COALESCE(si.quantity, 1) ELSE 0 END), 0)::bigint AS sales_count,
    COALESCE(SUM(COALESCE(si.mapped_commission, 0)), 0)::numeric AS commission
  FROM public.sales s
  CROSS JOIN has_dashboard_access hda
  JOIN public.sale_items si ON si.sale_id = s.id
  LEFT JOIN public.products p ON p.id = si.product_id
  LEFT JOIN public.agents a ON LOWER(a.email) = LOWER(s.agent_email)
  LEFT JOIN public.employee_agent_mapping eam ON eam.agent_id = a.id
  LEFT JOIN public.employee_master_data emd_tm ON emd_tm.id = eam.employee_id
  LEFT JOIN public.teams t_tm ON t_tm.id = emd_tm.team_id
  LEFT JOIN public.employee_master_data emd_fm
    ON emd_fm.work_email IS NOT NULL
    AND LOWER(emd_fm.work_email) = LOWER(s.agent_email)
    AND emd_tm.id IS NULL
  LEFT JOIN public.teams t_fm ON t_fm.id = emd_fm.team_id
  WHERE hda.allowed = true
    AND s.sale_datetime >= p_from
    AND s.sale_datetime <= p_to
    AND COALESCE(s.validation_status, '') <> 'rejected'
    AND COALESCE(emd_tm.id, emd_fm.id) IS NOT NULL
  GROUP BY COALESCE(emd_tm.id, emd_fm.id),
           COALESCE(emd_tm.first_name, emd_fm.first_name),
           COALESCE(emd_tm.last_name, emd_fm.last_name),
           COALESCE(emd_tm.avatar_url, emd_fm.avatar_url),
           COALESCE(t_tm.name, t_fm.name)
  ORDER BY commission DESC
  LIMIT LEAST(COALESCE(p_limit, 20), 100);
END;
$fn$;
