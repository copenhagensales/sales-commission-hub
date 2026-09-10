CREATE OR REPLACE FUNCTION public.resolve_sales_employee_id(p_agent_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT eam.employee_id
      FROM public.agents a
      JOIN public.employee_agent_mapping eam ON eam.agent_id = a.id
      WHERE p_agent_email IS NOT NULL
        AND a.email IS NOT NULL
        AND lower(a.email) = lower(p_agent_email)
        AND eam.employee_id IS NOT NULL
      ORDER BY eam.created_at NULLS LAST, eam.id
      LIMIT 1
    ),
    (
      SELECT emd.id
      FROM public.employee_master_data emd
      WHERE p_agent_email IS NOT NULL
        AND emd.work_email IS NOT NULL
        AND lower(emd.work_email) = lower(p_agent_email)
      ORDER BY emd.is_active DESC NULLS LAST, emd.created_at NULLS LAST, emd.id
      LIMIT 1
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.resolve_sales_employee_id(text) TO authenticated, service_role, anon;

CREATE OR REPLACE FUNCTION public.get_sales_aggregates_v2(
  p_start timestamptz,
  p_end timestamptz,
  p_team_id uuid DEFAULT NULL::uuid,
  p_employee_id uuid DEFAULT NULL::uuid,
  p_client_id uuid DEFAULT NULL::uuid,
  p_group_by text DEFAULT 'none'::text,
  p_agent_emails text[] DEFAULT NULL::text[]
)
RETURNS TABLE(group_key text, group_name text, total_sales bigint, total_commission numeric, total_revenue numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      si.quantity,
      si.mapped_commission,
      si.mapped_revenue,
      p.counts_as_sale,
      s.agent_email,
      (s.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date AS sale_date,
      emp.id AS employee_id,
      emp.first_name,
      emp.last_name,
      emp.team_id,
      ag.name AS agent_name
    FROM sales s
    JOIN sale_items si ON si.sale_id = s.id
    LEFT JOIN products p ON p.id = si.product_id
    LEFT JOIN LATERAL (
      SELECT a.name
      FROM agents a
      WHERE s.agent_email IS NOT NULL AND lower(a.email) = lower(s.agent_email)
      ORDER BY a.id
      LIMIT 1
    ) ag ON true
    LEFT JOIN employee_master_data emp
      ON emp.id = public.resolve_sales_employee_id(s.agent_email)
    WHERE s.sale_datetime >= p_start
      AND s.sale_datetime <= p_end
      AND COALESCE(s.validation_status, 'approved') NOT IN ('rejected', 'cancelled')
      AND (p_team_id IS NULL OR emp.team_id = p_team_id)
      AND (p_employee_id IS NULL OR emp.id = p_employee_id)
      AND (p_client_id IS NULL OR s.client_campaign_id IN (
        SELECT cc.id FROM client_campaigns cc WHERE cc.client_id = p_client_id
      ))
      AND (p_agent_emails IS NULL OR lower(s.agent_email) = ANY(
        SELECT lower(unnest(p_agent_emails))
      ))
  )
  SELECT
    CASE
      WHEN p_group_by = 'employee' THEN COALESCE(b.employee_id::text, lower(b.agent_email))
      WHEN p_group_by = 'date' THEN b.sale_date::text
      WHEN p_group_by = 'both' THEN COALESCE(b.employee_id::text, lower(b.agent_email)) || '|' || b.sale_date::text
      ELSE 'total'
    END AS group_key,
    CASE
      WHEN p_group_by = 'employee' THEN COALESCE(b.first_name || ' ' || b.last_name, b.agent_name, b.agent_email)
      WHEN p_group_by = 'date' THEN b.sale_date::text
      WHEN p_group_by = 'both' THEN COALESCE(b.first_name || ' ' || b.last_name, b.agent_name, b.agent_email) || ' (' || b.sale_date::text || ')'
      ELSE 'Total'
    END AS group_name,
    COALESCE(SUM(CASE WHEN b.counts_as_sale IS NOT FALSE THEN b.quantity ELSE 0 END), 0)::bigint AS total_sales,
    COALESCE(SUM(b.mapped_commission), 0) AS total_commission,
    COALESCE(SUM(b.mapped_revenue), 0) AS total_revenue
  FROM base b
  GROUP BY 1, 2;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_sales_report_detailed(
  p_client_id uuid,
  p_start text,
  p_end text
)
RETURNS TABLE(employee_name text, product_name text, quantity bigint, commission numeric, revenue numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(emp.first_name || ' ' || emp.last_name, ag.name, s.agent_email) AS employee_name,
    COALESCE(p.name, si.adversus_product_title, 'Ukendt produkt') AS product_name,
    COALESCE(SUM(si.quantity), 0)::bigint AS quantity,
    COALESCE(SUM(si.mapped_commission), 0) AS commission,
    COALESCE(SUM(si.mapped_revenue), 0) AS revenue
  FROM sales s
  JOIN sale_items si ON si.sale_id = s.id
  LEFT JOIN products p ON p.id = si.product_id
  LEFT JOIN LATERAL (
    SELECT a.name
    FROM agents a
    WHERE s.agent_email IS NOT NULL AND lower(a.email) = lower(s.agent_email)
    ORDER BY a.id
    LIMIT 1
  ) ag ON true
  LEFT JOIN employee_master_data emp
    ON emp.id = public.resolve_sales_employee_id(s.agent_email)
  LEFT JOIN client_campaigns cc_prod ON cc_prod.id = p.client_campaign_id
  LEFT JOIN client_campaigns cc_sale ON cc_sale.id = s.client_campaign_id
  LEFT JOIN adversus_campaign_mappings acm ON acm.adversus_campaign_id = s.dialer_campaign_id
  LEFT JOIN client_campaigns cc_mapping ON cc_mapping.id = acm.client_campaign_id
  WHERE s.sale_datetime >= p_start::timestamptz
    AND s.sale_datetime <= (p_end::date + interval '1 day' - interval '1 second')::timestamptz
    AND COALESCE(s.validation_status, 'approved') != 'rejected'
    AND COALESCE(cc_prod.client_id, cc_sale.client_id, cc_mapping.client_id) = p_client_id
    AND COALESCE(p.counts_as_sale, true) = true
  GROUP BY 1, 2;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_cs_top20_custom_period_leaderboard(
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(employee_id uuid, employee_name text, avatar_url text, team_name text, sales_count bigint, commission numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    emp.id AS employee_id,
    TRIM(CONCAT(COALESCE(emp.first_name, ''), ' ', COALESCE(emp.last_name, ''))) AS employee_name,
    emp.avatar_url,
    t.name AS team_name,
    COALESCE(SUM(CASE WHEN COALESCE(p.counts_as_sale, true) THEN COALESCE(si.quantity, 1) ELSE 0 END), 0)::bigint AS sales_count,
    COALESCE(SUM(COALESCE(si.mapped_commission, 0)), 0)::numeric AS commission
  FROM public.sales s
  CROSS JOIN has_dashboard_access hda
  JOIN public.sale_items si ON si.sale_id = s.id
  LEFT JOIN public.products p ON p.id = si.product_id
  LEFT JOIN public.employee_master_data emp
    ON emp.id = public.resolve_sales_employee_id(s.agent_email)
  LEFT JOIN public.teams t ON t.id = emp.team_id
  WHERE hda.allowed = true
    AND s.sale_datetime >= p_from
    AND s.sale_datetime <= p_to
    AND COALESCE(s.validation_status, '') <> 'rejected'
    AND emp.id IS NOT NULL
  GROUP BY emp.id, emp.first_name, emp.last_name, emp.avatar_url, t.name
  ORDER BY commission DESC
  LIMIT LEAST(COALESCE(p_limit, 20), 100);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_league_team_provision(
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE(team_id uuid, employee_id uuid, total_commission numeric)
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
  CROSS JOIN LATERAL (
    SELECT public.resolve_sales_employee_id(s.agent_email) AS employee_id
  ) emp
  WHERE s.sale_datetime >= p_start
    AND s.sale_datetime <= p_end
    AND COALESCE(s.validation_status, 'approved') NOT IN ('rejected', 'cancelled')
    AND emp.employee_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.employee_id = emp.employee_id
          AND tm.team_id = tc.team_id
      )
      OR EXISTS (
        SELECT 1 FROM employee_master_data e_hist
        WHERE e_hist.id = emp.employee_id
          AND e_hist.is_active = false
          AND e_hist.last_team_id = tc.team_id
      )
    )
  GROUP BY tc.team_id, emp.employee_id;
$$;