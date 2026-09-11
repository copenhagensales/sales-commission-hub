-- 1) Lønperiodens definition ét sted
CREATE OR REPLACE FUNCTION public.pay_period_start(ts timestamptz)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXTRACT(DAY FROM (ts AT TIME ZONE 'Europe/Copenhagen')) >= 15
      THEN (date_trunc('month', ts AT TIME ZONE 'Europe/Copenhagen')::date + 14)
    ELSE ((date_trunc('month', ts AT TIME ZONE 'Europe/Copenhagen') - interval '1 month')::date + 14)
  END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_period_start(timestamptz) TO authenticated, service_role;

-- 2) Præberegnet statistik pr. medarbejder
CREATE TABLE IF NOT EXISTS public.employee_profile_stats (
  employee_id uuid PRIMARY KEY REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  total_sales integer NOT NULL DEFAULT 0,
  pay_periods integer NOT NULL DEFAULT 0,
  total_commission numeric NOT NULL DEFAULT 0,
  avg_per_pay_period numeric NOT NULL DEFAULT 0,
  best_day_amount numeric,
  best_day_date date,
  best_week_amount numeric,
  best_week_iso integer,
  best_week_year integer,
  best_period_amount numeric,
  best_period_start date,
  longest_streak_days integer NOT NULL DEFAULT 0,
  streak_start date,
  streak_end date,
  club_50_count integer NOT NULL DEFAULT 0,
  club_100_count integer NOT NULL DEFAULT 0,
  club_200_count integer NOT NULL DEFAULT 0,
  league_best_division integer,
  league_round_wins integer NOT NULL DEFAULT 0,
  league_seasons integer NOT NULL DEFAULT 0,
  uses_weekday_fallback boolean NOT NULL DEFAULT false,
  computed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.employee_profile_stats TO authenticated;
GRANT ALL ON public.employee_profile_stats TO service_role;

ALTER TABLE public.employee_profile_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read profile stats"
ON public.employee_profile_stats FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role manages profile stats"
ON public.employee_profile_stats FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3) Genberegning
CREATE OR REPLACE FUNCTION public.recalc_employee_profile_stats()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer;
BEGIN
  CREATE TEMP TABLE tmp_eps_sales ON COMMIT DROP AS
  SELECT
    public.resolve_sales_employee_id(sa.agent_email) AS emp,
    (sa.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date AS d,
    sa.id AS sale_id,
    public.pay_period_start(sa.sale_datetime) AS pp,
    COALESCE(si.mapped_commission, 0) AS comm
  FROM public.sales sa
  LEFT JOIN public.sale_items si
    ON si.sale_id = sa.id AND COALESCE(si.is_cancelled, false) = false
  WHERE COALESCE(sa.validation_status, '') NOT IN ('rejected', 'cancelled')
    AND sa.agent_email IS NOT NULL;

  DELETE FROM tmp_eps_sales WHERE emp IS NULL;
  CREATE INDEX ON tmp_eps_sales (emp, d);

  CREATE TEMP TABLE tmp_eps_day ON COMMIT DROP AS
  SELECT emp, d, SUM(comm) AS comm, COUNT(DISTINCT sale_id) AS sales
  FROM tmp_eps_sales GROUP BY 1, 2;
  CREATE INDEX ON tmp_eps_day (emp, d);

  CREATE TEMP TABLE tmp_eps_period ON COMMIT DROP AS
  SELECT emp, pp, SUM(comm) AS comm
  FROM tmp_eps_sales GROUP BY 1, 2;

  INSERT INTO public.employee_profile_stats AS t (
    employee_id, total_sales, pay_periods, total_commission, avg_per_pay_period,
    best_day_amount, best_day_date,
    best_week_amount, best_week_iso, best_week_year,
    best_period_amount, best_period_start,
    longest_streak_days, streak_start, streak_end,
    club_50_count, club_100_count, club_200_count,
    league_best_division, league_round_wins, league_seasons,
    uses_weekday_fallback, computed_at
  )
  WITH totals AS (
    SELECT emp, SUM(sales)::int AS sales, SUM(comm) AS comm
    FROM tmp_eps_day GROUP BY 1
  ),
  periods AS (
    SELECT emp, COUNT(*)::int AS periods,
           COUNT(*) FILTER (WHERE comm >= 50000)::int AS c50,
           COUNT(*) FILTER (WHERE comm >= 100000)::int AS c100,
           COUNT(*) FILTER (WHERE comm >= 200000)::int AS c200
    FROM tmp_eps_period GROUP BY 1
  ),
  best_day AS (
    SELECT DISTINCT ON (emp) emp, comm, d FROM tmp_eps_day
    WHERE comm > 0 ORDER BY emp, comm DESC, d DESC
  ),
  weeks AS (
    SELECT emp, EXTRACT(isoyear FROM d)::int AS yr, EXTRACT(week FROM d)::int AS wk, SUM(comm) AS comm
    FROM tmp_eps_day GROUP BY 1, 2, 3
  ),
  best_week AS (
    SELECT DISTINCT ON (emp) emp, comm, wk, yr FROM weeks
    WHERE comm > 0 ORDER BY emp, comm DESC, yr DESC, wk DESC
  ),
  best_period AS (
    SELECT DISTINCT ON (emp) emp, comm, pp FROM tmp_eps_period
    WHERE comm > 0 ORDER BY emp, comm DESC, pp DESC
  ),
  shift_emp AS (
    SELECT DISTINCT employee_id FROM public.shift
  ),
  span AS (
    SELECT emp, MIN(d) AS mn, MAX(d) AS mx FROM tmp_eps_day GROUP BY 1
  ),
  cal AS (
    SELECT sp.emp, g::date AS d
    FROM span sp, generate_series(sp.mn, sp.mx, interval '1 day') g
  ),
  abs_days AS (
    SELECT a.employee_id AS emp, g::date AS d
    FROM public.absence_request_v2 a,
         generate_series(a.start_date, a.end_date, interval '1 day') g
    WHERE a.status = 'approved'
      AND a.type IN ('day_off', 'sick', 'vacation')
  ),
  marked AS (
    SELECT c.emp, c.d,
      (sd.d IS NOT NULL) AS has_sale,
      CASE
        WHEN sd.d IS NOT NULL THEN false
        WHEN ad.d IS NOT NULL THEN true
        WHEN se.employee_id IS NOT NULL THEN (sh.id IS NULL)
        ELSE EXTRACT(isodow FROM c.d) IN (6, 7)
      END AS skipped
    FROM cal c
    LEFT JOIN tmp_eps_day sd ON sd.emp = c.emp AND sd.d = c.d
    LEFT JOIN abs_days ad ON ad.emp = c.emp AND ad.d = c.d
    LEFT JOIN shift_emp se ON se.employee_id = c.emp
    LEFT JOIN public.shift sh
      ON sh.employee_id = c.emp AND sh.date = c.d
     AND sh.status IS DISTINCT FROM 'cancelled'::shift_status
  ),
  seq AS (
    SELECT emp, d, has_sale,
           SUM(CASE WHEN has_sale THEN 0 ELSE 1 END) OVER (PARTITION BY emp ORDER BY d) AS grp
    FROM marked WHERE NOT skipped
  ),
  islands AS (
    SELECT emp, grp, COUNT(*)::int AS len, MIN(d) AS sd, MAX(d) AS ed
    FROM seq WHERE has_sale GROUP BY 1, 2
  ),
  best_streak AS (
    SELECT DISTINCT ON (emp) emp, len, sd, ed FROM islands
    ORDER BY emp, len DESC, ed DESC
  ),
  lg AS (
    SELECT employee_id AS emp,
           MIN(LEAST(COALESCE(current_division, 99), COALESCE(previous_division, 99))) AS best_div,
           COUNT(DISTINCT season_id)::int AS seasons
    FROM public.league_season_standings GROUP BY 1
  ),
  lw AS (
    SELECT employee_id AS emp, COUNT(*)::int AS wins
    FROM public.league_round_standings WHERE rank_in_division = 1 GROUP BY 1
  )
  SELECT
    e.id,
    COALESCE(tt.sales, 0),
    COALESCE(p.periods, 0),
    COALESCE(tt.comm, 0),
    CASE WHEN COALESCE(p.periods, 0) > 0 THEN COALESCE(tt.comm, 0) / p.periods ELSE 0 END,
    bd.comm, bd.d,
    bw.comm, bw.wk, bw.yr,
    bp.comm, bp.pp,
    COALESCE(bs.len, 0), bs.sd, bs.ed,
    COALESCE(p.c50, 0), COALESCE(p.c100, 0), COALESCE(p.c200, 0),
    NULLIF(lg.best_div, 99),
    COALESCE(lw.wins, 0),
    COALESCE(lg.seasons, 0),
    (se2.employee_id IS NULL),
    now()
  FROM public.employee_master_data e
  LEFT JOIN totals tt ON tt.emp = e.id
  LEFT JOIN periods p ON p.emp = e.id
  LEFT JOIN best_day bd ON bd.emp = e.id
  LEFT JOIN best_week bw ON bw.emp = e.id
  LEFT JOIN best_period bp ON bp.emp = e.id
  LEFT JOIN best_streak bs ON bs.emp = e.id
  LEFT JOIN lg ON lg.emp = e.id
  LEFT JOIN lw ON lw.emp = e.id
  LEFT JOIN shift_emp se2 ON se2.employee_id = e.id
  ON CONFLICT (employee_id) DO UPDATE SET
    total_sales = EXCLUDED.total_sales,
    pay_periods = EXCLUDED.pay_periods,
    total_commission = EXCLUDED.total_commission,
    avg_per_pay_period = EXCLUDED.avg_per_pay_period,
    best_day_amount = EXCLUDED.best_day_amount,
    best_day_date = EXCLUDED.best_day_date,
    best_week_amount = EXCLUDED.best_week_amount,
    best_week_iso = EXCLUDED.best_week_iso,
    best_week_year = EXCLUDED.best_week_year,
    best_period_amount = EXCLUDED.best_period_amount,
    best_period_start = EXCLUDED.best_period_start,
    longest_streak_days = EXCLUDED.longest_streak_days,
    streak_start = EXCLUDED.streak_start,
    streak_end = EXCLUDED.streak_end,
    club_50_count = EXCLUDED.club_50_count,
    club_100_count = EXCLUDED.club_100_count,
    club_200_count = EXCLUDED.club_200_count,
    league_best_division = EXCLUDED.league_best_division,
    league_round_wins = EXCLUDED.league_round_wins,
    league_seasons = EXCLUDED.league_seasons,
    uses_weekday_fallback = EXCLUDED.uses_weekday_fallback,
    computed_at = EXCLUDED.computed_at;

  SELECT COUNT(*) INTO v_rows FROM public.employee_profile_stats;
  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.recalc_employee_profile_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalc_employee_profile_stats() TO service_role;

-- 4) Dagligt cron-job
SELECT cron.unschedule('recalc-employee-profile-stats')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'recalc-employee-profile-stats');

SELECT cron.schedule(
  'recalc-employee-profile-stats',
  '20 3 * * *',
  $cron$SELECT public.recalc_employee_profile_stats();$cron$
);
