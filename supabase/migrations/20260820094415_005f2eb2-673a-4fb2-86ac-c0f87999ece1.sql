CREATE OR REPLACE FUNCTION public.get_churn_trend_windows(p_as_of_date date DEFAULT NULL::date, p_horizon_days integer DEFAULT NULL::integer, p_window_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_settings public.churn_dashboard_settings;
  v_as_of date;
  v_horizon integer;
  v_win integer;
  v_anchor date;
  v_result jsonb;
BEGIN
  IF NOT (public.is_manager_or_above(auth.uid()) OR public.is_owner(auth.uid())) THEN
    RAISE EXCEPTION 'Ingen adgang til churn-dashboard metrics';
  END IF;

  SELECT * INTO v_settings FROM public.churn_dashboard_settings ORDER BY created_at LIMIT 1;

  v_as_of   := coalesce(p_as_of_date, (now() AT TIME ZONE coalesce(v_settings.timezone,'Europe/Copenhagen'))::date);
  v_horizon := coalesce(p_horizon_days, v_settings.official_horizon_days, 60);
  v_win     := coalesce(p_window_days, 30);
  v_anchor  := v_as_of - v_horizon;

  WITH valid_spells AS (
    SELECT s.*, coalesce(s.team_at_start_name, 'Øvrige / ukendt team') AS team_key
    FROM public.v_employment_spells_clean s
    WHERE s.data_quality_status = 'valid'
      AND s.is_future_start = false
      AND s.start_date IS NOT NULL
      AND s.start_date <= v_as_of
  ),
  windowed AS (
    SELECT
      team_key,
      CASE
        WHEN start_date > (v_anchor - v_win) AND start_date <= v_anchor THEN 'recent'
        WHEN start_date > (v_anchor - 2 * v_win) AND start_date <= (v_anchor - v_win) THEN 'previous'
      END AS bucket,
      CASE WHEN exit_date IS NOT NULL AND exit_day BETWEEN 0 AND v_horizon THEN 1 ELSE 0 END AS is_exit
    FROM valid_spells
  ),
  buckets AS (
    SELECT * FROM windowed WHERE bucket IS NOT NULL
  ),
  team_rows AS (
    SELECT
      team_key,
      count(*) FILTER (WHERE bucket = 'recent')::int AS recent_n,
      coalesce(sum(is_exit) FILTER (WHERE bucket = 'recent'), 0)::int AS recent_x,
      count(*) FILTER (WHERE bucket = 'previous')::int AS previous_n,
      coalesce(sum(is_exit) FILTER (WHERE bucket = 'previous'), 0)::int AS previous_x
    FROM buckets GROUP BY 1
  ),
  total_row AS (
    SELECT
      count(*) FILTER (WHERE bucket = 'recent')::int AS recent_n,
      coalesce(sum(is_exit) FILTER (WHERE bucket = 'recent'), 0)::int AS recent_x,
      count(*) FILTER (WHERE bucket = 'previous')::int AS previous_n,
      coalesce(sum(is_exit) FILTER (WHERE bucket = 'previous'), 0)::int AS previous_x
    FROM buckets
  )
  SELECT jsonb_build_object(
    'as_of_date', v_as_of,
    'horizon_days', v_horizon,
    'window_days', v_win,
    'recent_start', (v_anchor - v_win + 1),
    'recent_end', v_anchor,
    'previous_start', (v_anchor - 2 * v_win + 1),
    'previous_end', (v_anchor - v_win),
    'total', (SELECT to_jsonb(x) FROM total_row x),
    'teams', (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) FROM team_rows x)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_churn_trend_windows(date, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_churn_trend_windows(date, integer, integer) TO authenticated;