CREATE OR REPLACE FUNCTION public.get_churn_dashboard_metrics(p_as_of_date date DEFAULT NULL::date, p_horizon_days integer DEFAULT NULL::integer, p_month_count integer DEFAULT NULL::integer, p_team_keys text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_settings public.churn_dashboard_settings;
  v_as_of date;
  v_horizon integer;
  v_months integer;
  v_min_n integer;
  v_target numeric;
  v_result jsonb;
BEGIN
  IF NOT (public.is_manager_or_above(auth.uid()) OR public.is_owner(auth.uid())) THEN
    RAISE EXCEPTION 'Ingen adgang til churn-dashboard metrics';
  END IF;

  SELECT * INTO v_settings FROM public.churn_dashboard_settings ORDER BY created_at LIMIT 1;

  v_as_of   := coalesce(p_as_of_date, (now() AT TIME ZONE coalesce(v_settings.timezone,'Europe/Copenhagen'))::date);
  v_horizon := coalesce(p_horizon_days, v_settings.official_horizon_days, 60);
  v_months  := coalesce(p_month_count, v_settings.official_month_count, 12);
  v_min_n   := coalesce(v_settings.minimum_n, 15);
  v_target  := v_settings.target_60d_rate;

  WITH spells AS (
    SELECT
      s.*,
      coalesce(s.team_at_start_name, 'Øvrige / ukendt team') AS team_key,
      date_trunc('month', s.start_date)::date AS start_month
    FROM public.v_employment_spells_clean s
  ),
  valid_spells AS (
    SELECT * FROM spells
    WHERE data_quality_status = 'valid'
      AND is_future_start = false
      AND start_date IS NOT NULL
      AND start_date <= v_as_of
      AND (p_team_keys IS NULL OR team_key = ANY(p_team_keys))
  ),
  all_months AS (
    SELECT generate_series(
             date_trunc('month', (SELECT min(start_date) FROM valid_spells))::date,
             date_trunc('month', v_as_of)::date,
             interval '1 month'
           )::date AS m
  ),
  mature AS (
    SELECT m FROM all_months
    WHERE ((m + interval '1 month - 1 day')::date + v_horizon) <= v_as_of
  ),
  mature_sel AS (
    SELECT m, row_number() OVER (ORDER BY m DESC) AS rn
    FROM mature
  ),
  chosen AS (
    SELECT m, rn FROM mature_sel WHERE rn <= v_months
  ),
  base AS (
    SELECT
      v.*,
      c.rn,
      CASE WHEN v.exit_day IS NOT NULL AND v.exit_day BETWEEN 0 AND v_horizon THEN 1 ELSE 0 END AS is_exit,
      CASE WHEN v.exit_day BETWEEN 0 AND 7 THEN 1 ELSE 0 END AS b0_7,
      CASE WHEN v.exit_day BETWEEN 8 AND 14 THEN 1 ELSE 0 END AS b8_14,
      CASE WHEN v.exit_day BETWEEN 15 AND 30 THEN 1 ELSE 0 END AS b15_30,
      CASE WHEN v.exit_day BETWEEN 31 AND 60 THEN 1 ELSE 0 END AS b31_60
    FROM valid_spells v
    JOIN chosen c ON c.m = date_trunc('month', v.start_date)::date
  ),
  immature AS (
    SELECT v.*
    FROM valid_spells v
    WHERE date_trunc('month', v.start_date)::date > (SELECT coalesce(max(m), '1900-01-01'::date) FROM chosen)
  ),
  immature_team AS (
    SELECT team_key,
           count(*)::int AS starters,
           count(*) FILTER (WHERE exit_date IS NOT NULL)::int AS exits_so_far
    FROM immature GROUP BY 1
  ),
  company AS (
    SELECT
      count(*)::int AS starters,
      coalesce(sum(is_exit),0)::int AS exits,
      coalesce(sum(b0_7),0)::int AS b0_7,
      coalesce(sum(b8_14),0)::int AS b8_14,
      coalesce(sum(b15_30),0)::int AS b15_30,
      coalesce(sum(b31_60),0)::int AS b31_60,
      coalesce(sum(CASE WHEN rn <= 3 THEN 1 ELSE 0 END),0)::int AS recent_n,
      coalesce(sum(CASE WHEN rn <= 3 THEN is_exit ELSE 0 END),0)::int AS recent_x,
      coalesce(sum(CASE WHEN rn BETWEEN 4 AND 6 THEN 1 ELSE 0 END),0)::int AS prev_n,
      coalesce(sum(CASE WHEN rn BETWEEN 4 AND 6 THEN is_exit ELSE 0 END),0)::int AS prev_x
    FROM base
  ),
  monthly AS (
    SELECT date_trunc('month', start_date)::date AS m,
           count(*)::int AS starters,
           coalesce(sum(is_exit),0)::int AS exits
    FROM base GROUP BY 1
  ),
  team_month AS (
    SELECT team_key, date_trunc('month', start_date)::date AS m,
           count(*)::int AS starters,
           coalesce(sum(is_exit),0)::int AS exits,
           coalesce(sum(b0_7),0)::int AS b0_7,
           coalesce(sum(b8_14),0)::int AS b8_14,
           coalesce(sum(b15_30),0)::int AS b15_30,
           coalesce(sum(b31_60),0)::int AS b31_60
    FROM base GROUP BY 1,2
  ),
  team_tot AS (
    SELECT team_key,
           count(*)::int AS starters,
           coalesce(sum(is_exit),0)::int AS exits,
           coalesce(sum(b0_7),0)::int AS b0_7,
           coalesce(sum(b8_14),0)::int AS b8_14,
           coalesce(sum(b15_30),0)::int AS b15_30,
           coalesce(sum(b31_60),0)::int AS b31_60,
           coalesce(sum(CASE WHEN rn <= 3 THEN 1 ELSE 0 END),0)::int AS recent_n,
           coalesce(sum(CASE WHEN rn <= 3 THEN is_exit ELSE 0 END),0)::int AS recent_x,
           coalesce(sum(CASE WHEN rn BETWEEN 4 AND 6 THEN 1 ELSE 0 END),0)::int AS prev_n,
           coalesce(sum(CASE WHEN rn BETWEEN 4 AND 6 THEN is_exit ELSE 0 END),0)::int AS prev_x,
           count(DISTINCT date_trunc('month', start_date))::int AS months_with_data
    FROM base GROUP BY 1
  ),
  leader_tot AS (
    SELECT coalesce(leader_at_start_id::text, 'unknown') AS leader_key,
           count(*)::int AS starters,
           coalesce(sum(is_exit),0)::int AS exits
    FROM base GROUP BY 1
  ),
  h14 AS (
    SELECT count(*)::int AS n,
           coalesce(sum(CASE WHEN exit_day BETWEEN 0 AND 14 THEN 1 ELSE 0 END),0)::int AS x
    FROM valid_spells
    WHERE ((date_trunc('month', start_date)::date + interval '1 month - 1 day')::date + 14) <= v_as_of
  ),
  h30 AS (
    SELECT count(*)::int AS n,
           coalesce(sum(CASE WHEN exit_day BETWEEN 0 AND 30 THEN 1 ELSE 0 END),0)::int AS x
    FROM valid_spells
    WHERE ((date_trunc('month', start_date)::date + interval '1 month - 1 day')::date + 30) <= v_as_of
  ),
  observation AS (
    SELECT
      count(*) FILTER (WHERE exit_date IS NULL AND tenure_days_as_of BETWEEN 0 AND 13)::int AS d0_13,
      count(*) FILTER (WHERE exit_date IS NULL AND tenure_days_as_of BETWEEN 14 AND 29)::int AS d14_29,
      count(*) FILTER (WHERE exit_date IS NULL AND tenure_days_as_of BETWEEN 30 AND 59)::int AS d30_59
    FROM valid_spells
  ),
  quality AS (
    SELECT
      count(*)::int AS total_rows,
      count(*) FILTER (WHERE data_quality_status = 'duplicate')::int AS duplicates,
      count(*) FILTER (WHERE data_quality_status = 'missing_start_date')::int AS missing_start_date,
      count(*) FILTER (WHERE data_quality_status = 'exit_before_start')::int AS exit_before_start,
      count(*) FILTER (WHERE data_quality_status = 'outside_scope')::int AS outside_scope,
      count(*) FILTER (WHERE data_quality_status = 'valid' AND is_future_start)::int AS future_start,
      count(*) FILTER (WHERE data_quality_status = 'valid' AND NOT is_future_start)::int AS valid_spells_n,
      count(*) FILTER (WHERE data_quality_status = 'valid' AND NOT is_future_start AND team_at_start_name IS NULL)::int AS unknown_team,
      count(*) FILTER (WHERE data_quality_status = 'valid' AND NOT is_future_start AND leader_at_start_id IS NULL)::int AS unknown_leader,
      count(*) FILTER (WHERE data_quality_status = 'valid' AND NOT is_future_start AND exit_date IS NOT NULL AND exit_reason_category = 'Ukendt')::int AS unknown_exit_reason,
      count(*) FILTER (WHERE data_quality_status = 'valid' AND NOT is_future_start AND exit_date IS NOT NULL)::int AS total_exits_all
    FROM spells
  ),
  headcount AS (
    SELECT
      count(*) FILTER (WHERE is_active)::int AS all_active_profiles,
      count(*) FILTER (WHERE is_active AND is_future_start)::int AS upcoming_starters,
      count(*) FILTER (WHERE is_active AND data_quality_status = 'outside_scope')::int AS staff_out_of_scope,
      count(*) FILTER (WHERE is_active AND data_quality_status IN ('missing_start_date','exit_before_start','duplicate'))::int AS invalid_dates,
      count(*) FILTER (WHERE is_active AND data_quality_status = 'valid' AND NOT is_future_start)::int AS official_headcount
    FROM spells
  )
  SELECT jsonb_build_object(
    'as_of_date', v_as_of,
    'as_of_source', 'server_copenhagen_date',
    'timezone', coalesce(v_settings.timezone,'Europe/Copenhagen'),
    'settings', jsonb_build_object(
      'official_horizon_days', v_horizon,
      'official_month_count', v_months,
      'target_60d_rate', v_target,
      'minimum_n', v_min_n,
      'yellow_threshold_pp', v_settings.yellow_threshold_pp,
      'orange_threshold_pp', v_settings.orange_threshold_pp,
      'material_trend_pp', v_settings.material_trend_pp,
      'benchmark_min_n', v_settings.benchmark_min_n,
      'benchmark_min_months', v_settings.benchmark_min_months
    ),
    'mature_months', (SELECT coalesce(jsonb_agg(m ORDER BY m), '[]'::jsonb) FROM chosen),
    'mature_months_available', (SELECT count(*)::int FROM mature),
    'latest_mature_month', (SELECT max(m) FROM chosen),
    'company', (SELECT to_jsonb(c) FROM company c),
    'monthly', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.m), '[]'::jsonb) FROM monthly x),
    'team_totals', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.exits DESC), '[]'::jsonb) FROM team_tot x),
    'team_months', (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) FROM team_month x),
    'leader_totals', (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) FROM leader_tot x),
    'leader_dimension_available', false,
    'exit_reason_available', false,
    'horizon_14', (SELECT to_jsonb(x) FROM h14 x),
    'horizon_30', (SELECT to_jsonb(x) FROM h30 x),
    'observation', (SELECT to_jsonb(x) FROM observation x),
    'upcoming_starters', (SELECT upcoming_starters FROM headcount),
    'immature_total', (SELECT count(*)::int FROM immature),
    'immature_teams', (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) FROM immature_team x),
    'quality', (SELECT to_jsonb(x) FROM quality x),
    'headcount_bridge', (SELECT to_jsonb(x) FROM headcount x)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;