CREATE TABLE IF NOT EXISTS public.quality_review_voids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.quality_reviews(id) ON DELETE RESTRICT,
  sale_id uuid NOT NULL,
  voided_by uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id)
);

GRANT SELECT, INSERT ON public.quality_review_voids TO authenticated;
GRANT ALL ON public.quality_review_voids TO service_role;

ALTER TABLE public.quality_review_voids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kvalitetsmodul kan se tilbagetrukne kontroller"
ON public.quality_review_voids FOR SELECT TO authenticated
USING (public.quality_has_module_access());

CREATE POLICY "Kontrollanter kan trakke kontroller tilbage"
ON public.quality_review_voids FOR INSERT TO authenticated
WITH CHECK (public.is_quality_controller() OR public.am_i_superadmin());

CREATE INDEX IF NOT EXISTS idx_quality_review_voids_sale ON public.quality_review_voids(sale_id);

-- Tilbagetrukne kontroller er ogsaa immutable
CREATE OR REPLACE FUNCTION public.quality_block_void_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Tilbagetrukne kvalitetskontroller kan ikke aendres eller slettes';
END;
$$;

DROP TRIGGER IF EXISTS trg_quality_review_voids_immutable ON public.quality_review_voids;
CREATE TRIGGER trg_quality_review_voids_immutable
BEFORE UPDATE OR DELETE ON public.quality_review_voids
FOR EACH ROW EXECUTE FUNCTION public.quality_block_void_mutation();

-- RPC: traek alle kontroller paa et salg tilbage
CREATE OR REPLACE FUNCTION public.void_quality_review(p_sale_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_count int;
BEGIN
  IF NOT (public.is_quality_controller() OR public.am_i_superadmin()) THEN
    RAISE EXCEPTION 'Ingen adgang til at fortryde kvalitetskontroller';
  END IF;

  v_me := public.get_current_employee_id();

  INSERT INTO public.quality_review_voids (review_id, sale_id, voided_by, reason)
  SELECT r.id, r.sale_id, v_me, NULLIF(left(btrim(COALESCE(p_reason, '')), 500), '')
  FROM public.quality_reviews r
  WHERE r.sale_id = p_sale_id
    AND NOT EXISTS (SELECT 1 FROM public.quality_review_voids v WHERE v.review_id = r.id)
  ON CONFLICT (review_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('voided', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.void_quality_review(uuid, text) TO authenticated;

-- Koen ser bort fra tilbagetrukne kontroller
CREATE OR REPLACE FUNCTION public.get_quality_queue(p_dates date[])
 RETURNS TABLE(sale_id uuid, sale_datetime timestamp with time zone, sale_date date, client_campaign_id uuid, campaign_name text, employee_id uuid, seller_name text, team_id uuid, team_name text, search_key text, search_key_type text, is_cancelled boolean, status text, last_review_id uuid, last_reviewed_at timestamp with time zone, dialer_campaign_label text, product_label text)
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
    s.sale_id, s.sale_datetime, s.sale_date, s.client_campaign_id, s.campaign_name,
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
  ORDER BY s.sale_datetime DESC;
END;
$function$;

-- Scorekort ser bort fra tilbagetrukne kontroller
CREATE OR REPLACE FUNCTION public.get_quality_overview(p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_all boolean := public.quality_can_view_all();
  v_result jsonb;
  v_from date := p_date - 59;
BEGIN
  IF NOT public.quality_has_module_access() THEN
    RAISE EXCEPTION 'Ingen adgang til kvalitetsmodulet';
  END IF;

  WITH scope AS (
    SELECT q.* FROM public.quality_sales_scope(v_from, p_date) q
    WHERE v_all OR (q.team_id IS NOT NULL AND q.team_id IN (SELECT public.quality_my_leader_team_ids()))
  ),
  latest AS (
    SELECT r.sale_id, r.result, r.employee_id, r.team_id, r.sale_date,
           ROW_NUMBER() OVER (PARTITION BY r.sale_id ORDER BY r.completed_at DESC) rn
    FROM public.quality_reviews r
    WHERE r.sale_date BETWEEN v_from AND p_date
      AND NOT EXISTS (SELECT 1 FROM public.quality_review_voids v WHERE v.review_id = r.id)
  ),
  rev AS (
    SELECT s.sale_id, s.sale_date, s.team_id, s.team_name, s.employee_id, s.seller_name, l.result
    FROM scope s
    LEFT JOIN latest l ON l.sale_id = s.sale_id AND l.rn = 1
  ),
  periods AS (
    SELECT 'day'::text AS period, p_date AS d_from, p_date AS d_to
    UNION ALL SELECT 'prev_day', p_date - 1, p_date - 1
    UNION ALL SELECT 'd30', p_date - 29, p_date
    UNION ALL SELECT 'prev_d30', p_date - 59, p_date - 30
  ),
  team_agg AS (
    SELECT p.period, r.team_id, MAX(r.team_name) AS team_name,
      COUNT(*) AS total_sales,
      COUNT(r.result) AS reviewed,
      COUNT(*) FILTER (WHERE r.result = 'afvist') AS rejected,
      COUNT(*) FILTER (WHERE r.result = 'godkendt_med_bemaerkning') AS remarked
    FROM rev r JOIN periods p ON r.sale_date BETWEEN p.d_from AND p.d_to
    GROUP BY p.period, r.team_id
  ),
  total_agg AS (
    SELECT p.period,
      COUNT(*) AS total_sales,
      COUNT(r.result) AS reviewed,
      COUNT(*) FILTER (WHERE r.result = 'afvist') AS rejected,
      COUNT(*) FILTER (WHERE r.result = 'godkendt_med_bemaerkning') AS remarked
    FROM rev r JOIN periods p ON r.sale_date BETWEEN p.d_from AND p.d_to
    GROUP BY p.period
  ),
  seller_agg AS (
    SELECT p.period, r.employee_id, MAX(r.seller_name) AS seller_name, MAX(r.team_id::text)::uuid AS team_id,
      COUNT(*) AS total_sales,
      COUNT(r.result) AS reviewed,
      COUNT(*) FILTER (WHERE r.result = 'afvist') AS rejected,
      COUNT(*) FILTER (WHERE r.result = 'godkendt_med_bemaerkning') AS remarked
    FROM rev r JOIN periods p ON r.sale_date BETWEEN p.d_from AND p.d_to
    WHERE r.employee_id IS NOT NULL AND p.period IN ('day','d30')
    GROUP BY p.period, r.employee_id
  ),
  code_agg AS (
    SELECT p.period, ec.code, ec.label, ec.item_type, COUNT(DISTINCT qr.id) AS cnt
    FROM public.quality_reviews qr
    JOIN public.quality_review_error_codes rec ON rec.review_id = qr.id
    JOIN public.quality_error_codes ec ON ec.id = rec.error_code_id
    JOIN periods p ON qr.sale_date BETWEEN p.d_from AND p.d_to
    WHERE p.period IN ('day','d30')
      AND NOT EXISTS (SELECT 1 FROM public.quality_review_voids v WHERE v.review_id = qr.id)
      AND (v_all OR (qr.team_id IS NOT NULL AND qr.team_id IN (SELECT public.quality_my_leader_team_ids())))
    GROUP BY p.period, ec.code, ec.label, ec.item_type
  )
  SELECT jsonb_build_object(
    'date', p_date,
    'teams', COALESCE((SELECT jsonb_agg(x) FROM (
        SELECT team_id, MAX(team_name) AS team_name,
          jsonb_object_agg(period, jsonb_build_object(
            'total_sales', total_sales, 'reviewed', reviewed, 'rejected', rejected, 'remarked', remarked
          )) AS stats
        FROM team_agg GROUP BY team_id
      ) x), '[]'::jsonb),
    'totals', COALESCE((SELECT jsonb_object_agg(period, jsonb_build_object(
        'total_sales', total_sales, 'reviewed', reviewed, 'rejected', rejected, 'remarked', remarked
      )) FROM total_agg), '{}'::jsonb),
    'sellers', COALESCE((SELECT jsonb_agg(y) FROM (
        SELECT employee_id, MAX(seller_name) AS seller_name, MAX(team_id::text)::uuid AS team_id,
          jsonb_object_agg(period, jsonb_build_object(
            'total_sales', total_sales, 'reviewed', reviewed, 'rejected', rejected, 'remarked', remarked
          )) AS stats
        FROM seller_agg GROUP BY employee_id
      ) y), '[]'::jsonb),
    'error_codes', COALESCE((SELECT jsonb_agg(z) FROM (
        SELECT code, MAX(label) AS label, MAX(item_type) AS item_type,
          jsonb_object_agg(period, cnt) AS counts
        FROM code_agg GROUP BY code
      ) z), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Kontrollantens egne tal ser bort fra tilbagetrukne kontroller
CREATE OR REPLACE FUNCTION public.get_quality_reviewer_stats(p_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_date date := COALESCE(p_date, (now() AT TIME ZONE 'Europe/Copenhagen')::date);
  v_me uuid := public.get_current_employee_id();
  v_super boolean := public.is_superadmin(auth.uid());
  v_goal integer;
  v_result jsonb;
BEGIN
  IF NOT public.quality_can_view_all() THEN
    RAISE EXCEPTION 'Ingen adgang til kvalitetsmodulet';
  END IF;

  SELECT daily_goal INTO v_goal FROM public.quality_settings LIMIT 1;

  WITH base AS (
    SELECT r.reviewer_employee_id,
           (r.completed_at AT TIME ZONE 'Europe/Copenhagen')::date AS d,
           EXTRACT(EPOCH FROM (r.completed_at - r.started_at)) AS secs
    FROM public.quality_reviews r
    WHERE (r.completed_at AT TIME ZONE 'Europe/Copenhagen')::date BETWEEN v_date - 29 AND v_date
      AND NOT EXISTS (SELECT 1 FROM public.quality_review_voids v WHERE v.review_id = r.id)
  ),
  per_reviewer AS (
    SELECT b.reviewer_employee_id,
      COUNT(*) FILTER (WHERE b.d = v_date) AS today_count,
      AVG(b.secs) FILTER (WHERE b.d = v_date) AS avg_secs_today,
      AVG(b.secs) AS avg_secs_30d,
      COUNT(*) AS count_30d
    FROM base b GROUP BY b.reviewer_employee_id
  )
  SELECT jsonb_build_object(
    'date', v_date,
    'daily_goal', COALESCE(v_goal, 40),
    'me', COALESCE((SELECT to_jsonb(pr) FROM per_reviewer pr WHERE pr.reviewer_employee_id = v_me), '{}'::jsonb),
    'my_daily', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', d, 'count', c) ORDER BY d)
        FROM (SELECT b.d, COUNT(*) c FROM base b WHERE b.reviewer_employee_id = v_me GROUP BY b.d) q(d, c)), '[]'::jsonb),
    'reviewers', CASE WHEN v_super THEN COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'employee_id', pr.reviewer_employee_id,
          'name', TRIM(CONCAT(e.first_name, ' ', e.last_name)),
          'today_count', pr.today_count,
          'avg_secs_today', pr.avg_secs_today,
          'avg_secs_30d', pr.avg_secs_30d,
          'count_30d', pr.count_30d))
        FROM per_reviewer pr LEFT JOIN public.employee_master_data e ON e.id = pr.reviewer_employee_id), '[]'::jsonb)
      ELSE '[]'::jsonb END
  ) INTO v_result;

  RETURN v_result;
END;
$function$;