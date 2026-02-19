
CREATE OR REPLACE FUNCTION public.get_team_performance_summary(p_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
  v_week_start date;
  v_month_start date;
  v_today text;
BEGIN
  -- Access check
  IF NOT (is_teamleder_or_above(auth.uid()) OR is_owner(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_today := p_date::text;
  v_week_start := p_date - ((EXTRACT(ISODOW FROM p_date)::int - 1) || ' days')::interval;
  v_month_start := date_trunc('month', p_date)::date;

  WITH active_teams AS (
    SELECT id, name FROM teams WHERE name != 'Stab'
  ),
  team_emp AS (
    SELECT tm.team_id, tm.employee_id
    FROM team_members tm
    JOIN active_teams at ON at.id = tm.team_id
  ),
  team_emp_count AS (
    SELECT team_id, COUNT(*)::int AS emp_count
    FROM team_emp
    GROUP BY team_id
  ),
  -- Build agent mapping: agent_id -> employee_id with email/name info
  agent_map AS (
    SELECT 
      eam.employee_id,
      LOWER(a.email) AS agent_email,
      LOWER(SPLIT_PART(a.email, '@', 1)) AS agent_email_prefix,
      LOWER(a.name) AS agent_name
    FROM employee_agent_mapping eam
    JOIN agents a ON a.id = eam.agent_id
  ),
  -- Sales in month range, not rejected, with items that count
  month_sales AS (
    SELECT 
      s.id AS sale_id,
      LOWER(s.agent_email) AS sale_agent_email,
      LOWER(s.agent_name) AS sale_agent_name,
      (s.sale_datetime AT TIME ZONE 'UTC')::date AS sale_date,
      cc.client_id AS sale_client_id,
      cl.name AS sale_client_name
    FROM sales s
    LEFT JOIN client_campaigns cc ON cc.id = s.client_campaign_id
    LEFT JOIN clients cl ON cl.id = cc.client_id
    WHERE s.sale_datetime >= (v_month_start || 'T00:00:00')::timestamptz
      AND s.sale_datetime <= (v_today || 'T23:59:59')::timestamptz
      AND COALESCE(s.validation_status, '') != 'rejected'
  ),
  sale_counts AS (
    SELECT 
      ms.sale_id,
      ms.sale_agent_email,
      ms.sale_agent_name,
      ms.sale_date,
      ms.sale_client_name,
      SUM(si.quantity) AS qty
    FROM month_sales ms
    JOIN sale_items si ON si.sale_id = ms.sale_id
    LEFT JOIN products p ON p.id = si.product_id
    WHERE COALESCE(p.counts_as_sale, true) = true
    GROUP BY ms.sale_id, ms.sale_agent_email, ms.sale_agent_name, ms.sale_date, ms.sale_client_name
    HAVING SUM(si.quantity) > 0
  ),
  -- Map sales to employees via agent fallback
  sale_with_employee AS (
    SELECT 
      sc.*,
      COALESCE(
        am_email.employee_id,
        am_prefix.employee_id,
        am_name.employee_id,
        am_name_prefix.employee_id
      ) AS employee_id
    FROM sale_counts sc
    LEFT JOIN agent_map am_email ON am_email.agent_email = sc.sale_agent_email
    LEFT JOIN agent_map am_prefix ON am_prefix.agent_email_prefix = SPLIT_PART(sc.sale_agent_email, '@', 1)
      AND am_email.employee_id IS NULL
    LEFT JOIN agent_map am_name ON am_name.agent_name = sc.sale_agent_name
      AND am_email.employee_id IS NULL AND am_prefix.employee_id IS NULL
    LEFT JOIN agent_map am_name_prefix ON am_name_prefix.agent_email_prefix = SPLIT_PART(sc.sale_agent_name, '@', 1)
      AND am_email.employee_id IS NULL AND am_prefix.employee_id IS NULL AND am_name.employee_id IS NULL
  ),
  -- Aggregate sales by team
  team_sale_agg AS (
    SELECT 
      te.team_id,
      COALESCE(SUM(swe.qty) FILTER (WHERE swe.sale_date = p_date), 0)::int AS day_sales,
      COALESCE(SUM(swe.qty) FILTER (WHERE swe.sale_date >= v_week_start), 0)::int AS week_sales,
      COALESCE(SUM(swe.qty), 0)::int AS month_sales
    FROM sale_with_employee swe
    JOIN team_emp te ON te.employee_id = swe.employee_id
    GROUP BY te.team_id
  ),
  -- Team clients mapping
  team_client_map AS (
    SELECT tc.team_id, tc.client_id, cl.name AS client_name
    FROM team_clients tc
    JOIN clients cl ON cl.id = tc.client_id
  ),
  -- Aggregate sales by team + client
  client_sale_agg AS (
    SELECT 
      te.team_id,
      swe.sale_client_name,
      COALESCE(SUM(swe.qty) FILTER (WHERE swe.sale_date = p_date), 0)::int AS day_sales,
      COALESCE(SUM(swe.qty) FILTER (WHERE swe.sale_date >= v_week_start), 0)::int AS week_sales,
      COALESCE(SUM(swe.qty), 0)::int AS month_sales
    FROM sale_with_employee swe
    JOIN team_emp te ON te.employee_id = swe.employee_id
    WHERE swe.sale_client_name IS NOT NULL
    GROUP BY te.team_id, swe.sale_client_name
  ),
  -- Absence work-day overlap calculation
  absence_raw AS (
    SELECT 
      a.employee_id,
      a.type,
      a.start_date::date AS abs_start,
      a.end_date::date AS abs_end
    FROM absence_request_v2 a
    WHERE a.status = 'approved'
      AND a.type IN ('sick', 'vacation')
      AND a.start_date::date <= p_date
      AND a.end_date::date >= v_month_start
  ),
  -- Generate date series for work-day counting
  absence_days AS (
    SELECT 
      ar.employee_id,
      ar.type,
      d::date AS absence_date
    FROM absence_raw ar
    CROSS JOIN generate_series(
      GREATEST(ar.abs_start, v_month_start),
      LEAST(ar.abs_end, p_date),
      '1 day'::interval
    ) AS d
    WHERE EXTRACT(ISODOW FROM d) <= 5  -- Monday-Friday only
  ),
  absence_agg AS (
    SELECT 
      te.team_id,
      ad.type,
      COUNT(*) FILTER (WHERE ad.absence_date = p_date) AS day_count,
      COUNT(*) FILTER (WHERE ad.absence_date >= v_week_start) AS week_count,
      COUNT(*) AS month_count
    FROM absence_days ad
    JOIN team_emp te ON te.employee_id = ad.employee_id
    GROUP BY te.team_id, ad.type
  ),
  -- Build client sales JSON per team
  client_json AS (
    SELECT 
      tcm.team_id,
      jsonb_agg(
        jsonb_build_object(
          'clientName', tcm.client_name,
          'sales', jsonb_build_object(
            'day', COALESCE(csa.day_sales, 0),
            'week', COALESCE(csa.week_sales, 0),
            'month', COALESCE(csa.month_sales, 0)
          )
        )
      ) AS clients
    FROM team_client_map tcm
    LEFT JOIN client_sale_agg csa ON csa.team_id = tcm.team_id AND csa.sale_client_name = tcm.client_name
    GROUP BY tcm.team_id
  ),
  -- Final assembly
  final AS (
    SELECT 
      jsonb_agg(
        jsonb_build_object(
          'id', at.id,
          'name', at.name,
          'employeeCount', COALESCE(tec.emp_count, 0),
          'sales', jsonb_build_object(
            'day', COALESCE(tsa.day_sales, 0),
            'week', COALESCE(tsa.week_sales, 0),
            'month', COALESCE(tsa.month_sales, 0)
          ),
          'clients', COALESCE(cj.clients, '[]'::jsonb),
          'sick', jsonb_build_object(
            'day', COALESCE(abs_sick.day_count, 0),
            'week', COALESCE(abs_sick.week_count, 0),
            'month', COALESCE(abs_sick.month_count, 0)
          ),
          'vacation', jsonb_build_object(
            'day', COALESCE(abs_vac.day_count, 0),
            'week', COALESCE(abs_vac.week_count, 0),
            'month', COALESCE(abs_vac.month_count, 0)
          )
        )
      ) AS result
    FROM active_teams at
    LEFT JOIN team_emp_count tec ON tec.team_id = at.id
    LEFT JOIN team_sale_agg tsa ON tsa.team_id = at.id
    LEFT JOIN client_json cj ON cj.team_id = at.id
    LEFT JOIN absence_agg abs_sick ON abs_sick.team_id = at.id AND abs_sick.type = 'sick'
    LEFT JOIN absence_agg abs_vac ON abs_vac.team_id = at.id AND abs_vac.type = 'vacation'
  )
  SELECT COALESCE(result, '[]'::jsonb) INTO v_result FROM final;

  RETURN v_result;
END;
$$;
