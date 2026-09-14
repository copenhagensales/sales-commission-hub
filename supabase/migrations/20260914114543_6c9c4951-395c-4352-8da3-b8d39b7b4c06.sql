CREATE OR REPLACE FUNCTION public.quality_sales_scope(p_from date, p_to date)
 RETURNS TABLE(sale_id uuid, sale_datetime timestamp with time zone, sale_date date, client_campaign_id uuid, campaign_name text, employee_id uuid, seller_name text, team_id uuid, team_name text, search_key text, search_key_type text, is_cancelled boolean, dialer_campaign_label text, product_label text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    s.id,
    s.sale_datetime,
    (s.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date,
    s.client_campaign_id,
    cc.name,
    emp.id,
    COALESCE(NULLIF(TRIM(CONCAT(emp.first_name, ' ', emp.last_name)), ''), s.agent_name, s.agent_email),
    tm.team_id,
    t.name,
    COALESCE(
      NULLIF(s.customer_phone, ''),
      NULLIF(s.external_reference_number, ''),
      NULLIF(s.external_sales_id, ''),
      NULLIF(s.normalized_data->>'lead_id', ''),
      NULLIF(s.adversus_external_id, '')
    ),
    CASE
      WHEN NULLIF(s.customer_phone, '') IS NOT NULL THEN 'telefon'
      WHEN NULLIF(s.external_reference_number, '') IS NOT NULL THEN 'reference'
      WHEN NULLIF(s.external_sales_id, '') IS NOT NULL THEN 'salgs-id'
      WHEN NULLIF(s.normalized_data->>'lead_id', '') IS NOT NULL THEN 'lead-id'
      WHEN NULLIF(s.adversus_external_id, '') IS NOT NULL THEN 'salgsnr.'
      ELSE NULL
    END,
    EXISTS (SELECT 1 FROM public.cancellation_queue cq WHERE cq.sale_id = s.id AND cq.status <> 'rejected'),
    dc.label,
    pl.label
  FROM public.sales s
  LEFT JOIN public.client_campaigns cc ON cc.id = s.client_campaign_id
  LEFT JOIN public.employee_master_data emp ON emp.id = public.resolve_sales_employee_id(s.agent_email)
  LEFT JOIN LATERAL (
    SELECT tm2.team_id
    FROM public.team_members tm2
    WHERE tm2.employee_id = emp.id
    ORDER BY tm2.created_at DESC NULLS LAST, tm2.team_id
    LIMIT 1
  ) tm ON TRUE
  LEFT JOIN public.teams t ON t.id = tm.team_id
  LEFT JOIN LATERAL (
    SELECT NULLIF(TRIM(acm.adversus_campaign_name), '') AS label
    FROM public.adversus_campaign_mappings acm
    WHERE s.dialer_campaign_id IS NOT NULL
      AND acm.adversus_campaign_id = s.dialer_campaign_id
    LIMIT 1
  ) dc ON TRUE
  LEFT JOIN LATERAL (
    SELECT CASE
             WHEN COUNT(*) = 0 THEN NULL
             WHEN COUNT(*) > 2 THEN string_agg(x.name, ' + ') || ' ...'
             ELSE string_agg(x.name, ' + ')
           END AS label
    FROM (
      SELECT DISTINCT p.name
      FROM public.sale_items si
      JOIN public.products p ON p.id = si.product_id
      WHERE si.sale_id = s.id AND NULLIF(TRIM(p.name), '') IS NOT NULL
      ORDER BY p.name
      LIMIT 3
    ) x
  ) pl ON TRUE
  WHERE (s.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date BETWEEN p_from AND p_to;
$function$;