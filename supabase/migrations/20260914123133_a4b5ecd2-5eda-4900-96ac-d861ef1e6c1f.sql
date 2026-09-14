DROP FUNCTION IF EXISTS public.get_quality_queue(date[]);
DROP FUNCTION IF EXISTS public.quality_sales_scope(date, date);

CREATE OR REPLACE FUNCTION public.quality_sales_scope(p_from date, p_to date)
 RETURNS TABLE(sale_id uuid, sale_datetime timestamp with time zone, call_start_at timestamp with time zone, sale_date date, client_campaign_id uuid, campaign_name text, employee_id uuid, seller_name text, team_id uuid, team_name text, search_key text, search_key_type text, is_cancelled boolean, dialer_campaign_label text, product_label text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    s.id,
    s.sale_datetime,
    call_ref.start_time,
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
    SELECT c.start_time
    FROM public.dialer_calls c
    WHERE c.lead_external_id = COALESCE(NULLIF(s.normalized_data->>'lead_id', ''), NULLIF(s.raw_payload->>'leadId', ''))
      AND c.start_time IS NOT NULL
      AND c.start_time <= s.sale_datetime
      AND c.start_time >= s.sale_datetime - interval '6 hours'
    ORDER BY c.start_time DESC
    LIMIT 1
  ) call_ref ON TRUE
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

CREATE OR REPLACE FUNCTION public.get_quality_queue(p_dates date[])
 RETURNS TABLE(sale_id uuid, sale_datetime timestamp with time zone, call_start_at timestamp with time zone, sale_date date, client_campaign_id uuid, campaign_name text, employee_id uuid, seller_name text, team_id uuid, team_name text, search_key text, search_key_type text, is_cancelled boolean, status text, last_review_id uuid, last_reviewed_at timestamp with time zone, dialer_campaign_label text, product_label text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_all boolean := public.quality_can_view_all();
BEGIN
  IF NOT public.quality_has_module_access() THEN
    RAISE EXCEPTION 'Ingen adgang til kvalitetsmodulet';
  END IF;

  RETURN QUERY
  WITH scope AS (
    SELECT * FROM public.quality_sales_scope(
      (SELECT MIN(d) FROM unnest(p_dates) d),
      (SELECT MAX(d) FROM unnest(p_dates) d)
    ) q
    WHERE q.sale_date = ANY(p_dates)
  ),
  latest AS (
    SELECT r.*, ROW_NUMBER() OVER (PARTITION BY r.sale_id ORDER BY r.completed_at DESC) rn
    FROM public.quality_reviews r
    WHERE r.sale_id IN (SELECT s.sale_id FROM scope s)
      AND NOT EXISTS (SELECT 1 FROM public.quality_review_voids v WHERE v.review_id = r.id)
  )
  SELECT
    s.sale_id, s.sale_datetime, s.call_start_at, s.sale_date, s.client_campaign_id, s.campaign_name,
    s.employee_id, s.seller_name, s.team_id, s.team_name,
    s.search_key, s.search_key_type, s.is_cancelled,
    COALESCE(l.result, 'ikke_kontrolleret'),
    l.id,
    l.completed_at,
    s.dialer_campaign_label,
    s.product_label
  FROM scope s
  LEFT JOIN latest l ON l.sale_id = s.sale_id AND l.rn = 1
  WHERE v_all OR (s.team_id IS NOT NULL AND s.team_id IN (SELECT public.quality_my_leader_team_ids()))
  ORDER BY COALESCE(s.call_start_at, s.sale_datetime) DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.quality_sales_scope(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quality_queue(date[]) TO authenticated;