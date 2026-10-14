ALTER TABLE public.ramp_risk_flag ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT 'cumulative';
ALTER TABLE public.ramp_risk_flag ADD COLUMN IF NOT EXISTS week_required numeric;
ALTER TABLE public.ramp_risk_flag ADD COLUMN IF NOT EXISTS week_iso integer;

-- Krav for opstartsuge (1-baseret). Sidste tal gaelder for senere uger.
CREATE OR REPLACE FUNCTION public.ramp_week_target(p_week int)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH t AS (
    SELECT coalesce((SELECT weekly_min_targets FROM public.ramp_settings ORDER BY created_at LIMIT 1),
                    '[5,8,11,14,17]'::jsonb) AS j
  )
  SELECT (j ->> (least(greatest(p_week,1), jsonb_array_length(j)) - 1))::numeric FROM t
$$;

-- Eneste beregning af ugemodellen. Maaler til og med dagen foer p_as_of.
CREATE OR REPLACE FUNCTION public.ramp_week_status(
  p_start date, p_campaigns uuid[], p_email text, p_end date, p_as_of date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_monday date := date_trunc('week', p_as_of::timestamp)::date;
  v_week int := ((v_monday - date_trunc('week', p_start::timestamp)::date) / 7) + 1;
  v_target numeric; v_wd int; v_req numeric; v_done int; v_exp numeric;
  v_sales int; v_live int;
  v_pmon date; v_pwd int; v_preq numeric; v_psales int; v_prev numeric;
  v_status text; v_hist jsonb := '[]'::jsonb; i int; m date; hwd int; hreq numeric; hs int;
BEGIN
  IF p_start IS NULL OR p_start > p_as_of THEN RETURN NULL; END IF;
  v_target := public.ramp_week_target(v_week);
  v_wd := public.ramp_week_workdays(p_start, v_monday, p_end);
  v_req := v_target * v_wd / 5.0;
  v_done := CASE WHEN p_as_of - 1 < v_monday THEN 0
                 ELSE public.ramp_week_workdays(p_start, v_monday, least(coalesce(p_end, p_as_of - 1), p_as_of - 1)) END;
  v_exp := CASE WHEN v_wd > 0 THEN v_req * v_done / v_wd ELSE 0 END;
  v_sales := CASE WHEN v_done = 0 THEN 0
                  ELSE public.ramp_product_count(p_campaigns, p_email, greatest(v_monday, p_start), p_as_of - 1) END;
  v_live := public.ramp_product_count(p_campaigns, p_email, greatest(v_monday, p_start), p_as_of);

  IF v_week >= 2 THEN
    v_pmon := v_monday - 7;
    v_pwd := public.ramp_week_workdays(p_start, v_pmon, p_end);
    v_preq := public.ramp_week_target(v_week - 1) * v_pwd / 5.0;
    v_psales := public.ramp_product_count(p_campaigns, p_email, greatest(v_pmon, p_start), v_pmon + 6);
    v_prev := CASE WHEN v_preq > 0 THEN v_psales / v_preq END;
  END IF;

  v_status := CASE
    WHEN v_done = 0 OR v_exp <= 0 THEN 'ny_uge'
    WHEN v_sales >= v_exp THEN 'paa_sporet'
    WHEN v_prev IS NULL THEN 'hold_fast'           -- opstartsuge 1: ingen forrige uge
    WHEN v_sales / v_exp > v_prev THEN 'hold_fast'
    ELSE 'start_her' END;

  FOR i IN REVERSE 4..1 LOOP
    IF v_week - i >= 1 THEN
      m := v_monday - 7 * i;
      hwd := public.ramp_week_workdays(p_start, m, p_end);
      hreq := public.ramp_week_target(v_week - i) * hwd / 5.0;
      hs := public.ramp_product_count(p_campaigns, p_email, greatest(m, p_start), m + 6);
      v_hist := v_hist || jsonb_build_object('iso_week', extract(week FROM m)::int,
                 'iso_year', extract(isoyear FROM m)::int, 'start_week', v_week - i,
                 'sales', hs, 'required', round(hreq, 2), 'met', hs >= hreq);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'iso_week', extract(week FROM v_monday)::int, 'iso_year', extract(isoyear FROM v_monday)::int,
    'start_week', v_week, 'week_target', v_target, 'workdays', v_wd,
    'partial_start', p_start > v_monday, 'start_weekday', extract(isodow FROM p_start)::int,
    'required', round(v_req, 2), 'done_days', v_done, 'expected_now', round(v_exp, 2),
    'sales', v_sales, 'sales_live', v_live,
    'prev_ratio', round(v_prev, 4), 'pace_ratio', CASE WHEN v_exp > 0 THEN round(v_sales / v_exp, 4) END,
    'status', v_status, 'history', v_hist);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ramp_week_status(date, uuid[], text, date, date) FROM PUBLIC, anon;

-- Hvilke flag ville blive oprettet ved en koersel paa p_as_of (bruges til toerkoersel og oprettelse).
CREATE OR REPLACE FUNCTION public.ramp_risk_flag_candidates(p_as_of date)
RETURNS TABLE(employee_id uuid, client_campaign_id uuid, curve_version int, day_no int,
              sales int, expected_now numeric, required numeric, iso_week int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH en AS (
    SELECT en.employee_id, en.client_campaign_id, en.curve_version, en.start_date,
           e.employment_end_date,
           lower(coalesce(e.work_email, e.private_email)) AS email,
           public.ramp_workday_no(en.start_date, p_as_of - 1) AS day_done
    FROM public.employee_ramp_enrollment en
    JOIN public.employee_master_data e ON e.id = en.employee_id
    WHERE coalesce(e.work_email, e.private_email) IS NOT NULL
      AND e.employment_end_date IS NULL
  ), s AS (
    SELECT en.*, cp.d AS flag_day,
           public.ramp_week_status(en.start_date, public.ramp_campaign_ids(en.client_campaign_id),
                                   en.email, en.employment_end_date, p_as_of) AS w
    FROM en CROSS JOIN (VALUES (10),(15)) cp(d)
    WHERE en.day_done = cp.d
  )
  SELECT s.employee_id, s.client_campaign_id, s.curve_version, s.flag_day,
         (s.w->>'sales')::int, (s.w->>'expected_now')::numeric, (s.w->>'required')::numeric, (s.w->>'iso_week')::int
  FROM s
  WHERE s.w->>'status' = 'start_her'
    AND EXISTS (SELECT 1 FROM public.ramp_curve c WHERE c.client_campaign_id = s.client_campaign_id
                 AND c.curve_version = s.curve_version AND c.day_no = s.flag_day)
    AND NOT EXISTS (SELECT 1 FROM public.ramp_risk_flag f WHERE f.employee_id = s.employee_id AND f.day_no = s.flag_day)
$$;
REVOKE EXECUTE ON FUNCTION public.ramp_risk_flag_candidates(date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ramp_create_risk_flags()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_created int := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM public.ramp_settings WHERE risk_flags_paused) THEN RETURN 0; END IF;
  WITH ins AS (
    INSERT INTO public.ramp_risk_flag (employee_id, client_campaign_id, day_no, cum_sales, threshold_value,
                                       curve_version, model, week_required, week_iso)
    SELECT c.employee_id, c.client_campaign_id, c.day_no, c.sales, c.expected_now, c.curve_version,
           'week', c.required, c.iso_week
    FROM public.ramp_risk_flag_candidates((now() AT TIME ZONE 'Europe/Copenhagen')::date) c
    ON CONFLICT (employee_id, day_no) DO NOTHING
    RETURNING 1)
  SELECT count(*)::int INTO v_created FROM ins;
  RETURN v_created;
END;
$$;