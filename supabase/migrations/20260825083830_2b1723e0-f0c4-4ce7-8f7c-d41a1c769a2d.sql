CREATE OR REPLACE FUNCTION public.get_churn_30d_monthly_trend(p_as_of_date date DEFAULT NULL::date, p_months integer DEFAULT 6)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_settings public.churn_dashboard_settings;
  v_as_of date;
  v_horizon integer := 30;
  v_months integer := greatest(coalesce(p_months, 6), 1);
  v_result jsonb;
BEGIN
  IF NOT (public.is_manager_or_above(auth.uid()) OR public.is_owner(auth.uid())) THEN
    RAISE EXCEPTION 'Ingen adgang til churn-dashboard metrics';
  END IF;

  SELECT * INTO v_settings FROM public.churn_dashboard_settings ORDER BY created_at LIMIT 1;
  v_as_of := coalesce(p_as_of_date, (now() AT TIME ZONE coalesce(v_settings.timezone,'Europe/Copenhagen'))::date);

  WITH spells AS (
    SELECT s.*, coalesce(s.team_at_start_name, 'Øvrige / ukendt team') AS team_key
    FROM public.v_employment_spells_clean s
  ),
  valid_spells AS (
    SELECT * FROM spells
    WHERE data_quality_status = 'valid'
      AND is_future_start = false
      AND start_date IS NOT NULL
      AND start_date <= v_as_of
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
  chosen AS (
    SELECT m FROM (
      SELECT m, row_number() OVER (ORDER BY m DESC) AS rn FROM mature
    ) x WHERE rn <= v_months
  ),
  base AS (
    SELECT c.m,
           CASE WHEN v.exit_day IS NOT NULL AND v.exit_day BETWEEN 0 AND v_horizon THEN 1 ELSE 0 END AS is_exit
    FROM valid_spells v
    JOIN chosen c ON c.m = date_trunc('month', v.start_date)::date
  ),
  monthly AS (
    SELECT m,
           count(*)::int AS starters,
           coalesce(sum(is_exit),0)::int AS exits
    FROM base GROUP BY 1
  )
  SELECT jsonb_build_object(
    'as_of_date', v_as_of,
    'horizon_days', v_horizon,
    'months_requested', v_months,
    'months', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
                'm', c.m,
                'starters', coalesce(mo.starters, 0),
                'exits', coalesce(mo.exits, 0)
              ) ORDER BY c.m), '[]'::jsonb)
      FROM chosen c
      LEFT JOIN monthly mo ON mo.m = c.m
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_churn_30d_monthly_trend(date, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_churn_30d_monthly_trend(date, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_churn_30d_monthly_trend(date, integer) TO service_role;