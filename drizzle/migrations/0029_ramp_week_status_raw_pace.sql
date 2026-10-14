CREATE OR REPLACE FUNCTION public.ramp_week_status(p_start date, p_campaigns uuid[], p_email text, p_end date, p_as_of date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_monday date := date_trunc('week', p_as_of::timestamp)::date;
  v_week int := ((v_monday - date_trunc('week', p_start::timestamp)::date) / 7) + 1;
  v_target numeric; v_wd int; v_req numeric; v_done int; v_exp numeric;
  v_sales int; v_live int;
  v_pmon date; v_pwd int; v_preq numeric; v_psales int; v_prev numeric;
  v_per_day numeric; v_prev_per_day numeric;
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
  v_per_day := CASE WHEN v_done > 0 THEN v_sales::numeric / v_done END;

  IF v_week >= 2 THEN
    v_pmon := v_monday - 7;
    v_pwd := public.ramp_week_workdays(p_start, v_pmon, p_end);
    v_preq := public.ramp_week_target(v_week - 1) * v_pwd / 5.0;
    v_psales := public.ramp_product_count(p_campaigns, p_email, greatest(v_pmon, p_start), v_pmon + 6);
    v_prev := CASE WHEN v_preq > 0 THEN v_psales / v_preq END;
    v_prev_per_day := CASE WHEN v_pwd > 0 THEN v_psales::numeric / v_pwd END;
  END IF;

  -- "Bedre end sidste uge" = flere salg pr. arbejdsdag end sidste uge (raa tempo, ikke ift. kravet).
  v_status := CASE
    WHEN v_done = 0 OR v_exp <= 0 THEN 'ny_uge'
    WHEN v_sales >= v_exp THEN 'paa_sporet'
    WHEN v_prev_per_day IS NULL THEN 'hold_fast'   -- opstartsuge 1 / ingen arbejdsdage sidste uge
    WHEN v_per_day > v_prev_per_day THEN 'hold_fast'
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
    'per_day', round(v_per_day, 4), 'prev_per_day', round(v_prev_per_day, 4),
    'status', v_status, 'history', v_hist);
END;
$function$;