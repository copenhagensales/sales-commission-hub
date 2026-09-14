DROP FUNCTION IF EXISTS public.get_quality_queue(date[]);

CREATE OR REPLACE FUNCTION public.get_quality_queue(p_dates date[])
 RETURNS TABLE(sale_id uuid, sale_datetime timestamp with time zone, call_start_at timestamp with time zone, sale_date date, client_campaign_id uuid, campaign_name text, employee_id uuid, seller_name text, team_id uuid, team_name text, search_key text, search_key_type text, is_cancelled boolean, status text, last_review_id uuid, last_reviewed_at timestamp with time zone, dialer_campaign_label text, product_label text, reason_labels text[], review_comment text)
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
    s.product_label,
    reasons.labels,
    l.comment
  FROM scope s
  LEFT JOIN latest l ON l.sale_id = s.sale_id AND l.rn = 1
  LEFT JOIN LATERAL (
    SELECT array_agg(DISTINCT lbl) AS labels
    FROM (
      SELECT ec.label AS lbl
      FROM public.quality_review_error_codes rec
      JOIN public.quality_error_codes ec ON ec.id = rec.error_code_id
      WHERE rec.review_id = l.id
      UNION
      SELECT ci.label AS lbl
      FROM public.quality_review_items ri
      JOIN public.quality_checklist_items ci ON ci.id = ri.checklist_item_id
      WHERE ri.review_id = l.id AND ri.state = 'mangler'
    ) u
  ) reasons ON l.id IS NOT NULL
  WHERE v_all OR (s.team_id IS NOT NULL AND s.team_id IN (SELECT public.quality_my_leader_team_ids()))
  ORDER BY COALESCE(s.call_start_at, s.sale_datetime) DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_quality_queue(date[]) TO authenticated;