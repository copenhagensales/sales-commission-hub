CREATE OR REPLACE FUNCTION public.get_sales_aggregates_v2(p_start timestamp with time zone, p_end timestamp with time zone, p_team_id uuid DEFAULT NULL::uuid, p_employee_id uuid DEFAULT NULL::uuid, p_client_id uuid DEFAULT NULL::uuid, p_group_by text DEFAULT 'none'::text, p_agent_emails text[] DEFAULT NULL::text[])
 RETURNS TABLE(group_key text, group_name text, total_sales bigint, total_commission numeric, total_revenue numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN p_group_by = 'employee' THEN COALESCE(eam.employee_id::text, emd_fb.id::text, lower(s.agent_email))
      WHEN p_group_by = 'date' THEN (s.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date::text
      WHEN p_group_by = 'both' THEN COALESCE(eam.employee_id::text, emd_fb.id::text, lower(s.agent_email)) || '|' || (s.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date::text
      ELSE 'total'
    END AS group_key,
    CASE
      WHEN p_group_by = 'employee' THEN COALESCE(emd.first_name || ' ' || emd.last_name, emd_fb.first_name || ' ' || emd_fb.last_name, a.name, s.agent_email)
      WHEN p_group_by = 'date' THEN (s.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date::text
      WHEN p_group_by = 'both' THEN COALESCE(emd.first_name || ' ' || emd.last_name, emd_fb.first_name || ' ' || emd_fb.last_name, a.name, s.agent_email) || ' (' || (s.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date::text || ')'
      ELSE 'Total'
    END AS group_name,
    COALESCE(SUM(
      CASE WHEN p.counts_as_sale IS NOT FALSE THEN si.quantity ELSE 0 END
    ), 0)::bigint AS total_sales,
    COALESCE(SUM(si.mapped_commission), 0) AS total_commission,
    COALESCE(SUM(si.mapped_revenue), 0) AS total_revenue
  FROM sales s
  JOIN sale_items si ON si.sale_id = s.id
  LEFT JOIN products p ON p.id = si.product_id
  LEFT JOIN agents a ON lower(a.email) = lower(s.agent_email)
  LEFT JOIN employee_agent_mapping eam ON eam.agent_id = a.id
  LEFT JOIN employee_master_data emd ON emd.id = eam.employee_id
  LEFT JOIN employee_master_data emd_fb 
    ON eam.employee_id IS NULL 
    AND lower(emd_fb.work_email) = lower(s.agent_email)
  WHERE s.sale_datetime >= p_start
    AND s.sale_datetime <= p_end
    AND COALESCE(s.validation_status, 'approved') NOT IN ('rejected', 'cancelled')
    AND (p_team_id IS NULL OR COALESCE(emd.team_id, emd_fb.team_id) = p_team_id)
    AND (p_employee_id IS NULL OR COALESCE(eam.employee_id, emd_fb.id) = p_employee_id)
    AND (p_client_id IS NULL OR s.client_campaign_id IN (
      SELECT cc.id FROM client_campaigns cc WHERE cc.client_id = p_client_id
    ))
    AND (p_agent_emails IS NULL OR lower(s.agent_email) = ANY(
      SELECT lower(unnest(p_agent_emails))
    ))
  GROUP BY
    CASE
      WHEN p_group_by = 'employee' THEN COALESCE(eam.employee_id::text, emd_fb.id::text, lower(s.agent_email))
      WHEN p_group_by = 'date' THEN (s.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date::text
      WHEN p_group_by = 'both' THEN COALESCE(eam.employee_id::text, emd_fb.id::text, lower(s.agent_email)) || '|' || (s.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date::text
      ELSE 'total'
    END,
    CASE
      WHEN p_group_by = 'employee' THEN COALESCE(emd.first_name || ' ' || emd.last_name, emd_fb.first_name || ' ' || emd_fb.last_name, a.name, s.agent_email)
      WHEN p_group_by = 'date' THEN (s.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date::text
      WHEN p_group_by = 'both' THEN COALESCE(emd.first_name || ' ' || emd.last_name, emd_fb.first_name || ' ' || emd_fb.last_name, a.name, s.agent_email) || ' (' || (s.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date::text || ')'
      ELSE 'Total'
    END;
END;
$function$;