
-- Drop both functions first, then recreate
DROP FUNCTION IF EXISTS public.get_sales_aggregates(timestamptz, timestamptz, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.get_sales_aggregates_v2(timestamptz, timestamptz, uuid, uuid, uuid, text, text[]);

-- Recreate v1 - only exclude 'rejected'
CREATE OR REPLACE FUNCTION public.get_sales_aggregates(
  p_start timestamptz,
  p_end timestamptz,
  p_team_id uuid DEFAULT NULL,
  p_employee_id uuid DEFAULT NULL,
  p_client_id uuid DEFAULT NULL
)
RETURNS TABLE(
  total_sales bigint,
  total_commission numeric,
  total_revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(
      CASE WHEN p.counts_as_sale IS NOT FALSE THEN si.quantity ELSE 0 END
    ), 0)::bigint AS total_sales,
    COALESCE(SUM(si.mapped_commission), 0) AS total_commission,
    COALESCE(SUM(si.mapped_revenue), 0) AS total_revenue
  FROM sales s
  JOIN sale_items si ON si.sale_id = s.id
  LEFT JOIN products p ON p.id = si.product_id
  LEFT JOIN employee_agent_mapping eam ON eam.id = (
    SELECT eam2.id FROM employee_agent_mapping eam2
    JOIN agents a ON a.id = eam2.agent_id
    WHERE lower(a.email) = lower(s.agent_email)
    LIMIT 1
  )
  WHERE s.sale_datetime >= p_start
    AND s.sale_datetime <= p_end
    AND s.source != 'fieldmarketing'
    AND COALESCE(s.validation_status, 'approved') != 'rejected'
    AND (p_team_id IS NULL OR eam.team_id = p_team_id)
    AND (p_employee_id IS NULL OR eam.employee_id = p_employee_id)
    AND (p_client_id IS NULL OR s.client_campaign_id IN (
      SELECT cc.id FROM client_campaigns cc WHERE cc.client_id = p_client_id
    ));
END;
$$;

-- Recreate v2 - only exclude 'rejected'
CREATE OR REPLACE FUNCTION public.get_sales_aggregates_v2(
  p_start timestamptz,
  p_end timestamptz,
  p_team_id uuid DEFAULT NULL,
  p_employee_id uuid DEFAULT NULL,
  p_client_id uuid DEFAULT NULL,
  p_group_by text DEFAULT 'none',
  p_agent_emails text[] DEFAULT NULL
)
RETURNS TABLE(
  group_key text,
  group_name text,
  total_sales bigint,
  total_commission numeric,
  total_revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN p_group_by = 'employee' THEN COALESCE(eam.employee_id::text, lower(s.agent_email))
      WHEN p_group_by = 'date' THEN (s.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date::text
      WHEN p_group_by = 'both' THEN COALESCE(eam.employee_id::text, lower(s.agent_email)) || '|' || (s.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date::text
      ELSE 'total'
    END AS group_key,
    CASE
      WHEN p_group_by = 'employee' THEN COALESCE(a.name, s.agent_email)
      WHEN p_group_by = 'date' THEN (s.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date::text
      WHEN p_group_by = 'both' THEN COALESCE(a.name, s.agent_email) || ' (' || (s.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date::text || ')'
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
  WHERE s.sale_datetime >= p_start
    AND s.sale_datetime <= p_end
    AND COALESCE(s.validation_status, 'approved') != 'rejected'
    AND (p_team_id IS NULL OR eam.team_id = p_team_id)
    AND (p_employee_id IS NULL OR eam.employee_id = p_employee_id)
    AND (p_client_id IS NULL OR s.client_campaign_id IN (
      SELECT cc.id FROM client_campaigns cc WHERE cc.client_id = p_client_id
    ))
    AND (p_agent_emails IS NULL OR lower(s.agent_email) = ANY(
      SELECT lower(unnest(p_agent_emails))
    ))
  GROUP BY
    CASE
      WHEN p_group_by = 'employee' THEN COALESCE(eam.employee_id::text, lower(s.agent_email))
      WHEN p_group_by = 'date' THEN (s.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date::text
      WHEN p_group_by = 'both' THEN COALESCE(eam.employee_id::text, lower(s.agent_email)) || '|' || (s.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date::text
      ELSE 'total'
    END,
    CASE
      WHEN p_group_by = 'employee' THEN COALESCE(a.name, s.agent_email)
      WHEN p_group_by = 'date' THEN (s.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date::text
      WHEN p_group_by = 'both' THEN COALESCE(a.name, s.agent_email) || ' (' || (s.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date::text || ')'
      ELSE 'Total'
    END;
END;
$$;
