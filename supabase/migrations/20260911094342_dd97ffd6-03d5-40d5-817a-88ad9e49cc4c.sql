CREATE OR REPLACE FUNCTION public.recalc_employee_profile_stats()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rows integer;
  v_streak_min_commission numeric := 1500;
BEGIN
  CREATE TEMP TABLE tmp_eps_sales ON COMMIT DROP AS
  SELECT
    x.emp,
    (x.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date AS d,
    x.sale_id,
    public.pay_period_start(x.sale_datetime) AS pp,
    x.comm
  FROM (
    SELECT
      public.resolve_sales_employee_id(sa.agent_email) AS emp,
      sa.sale_datetime,
      sa.id AS sale_id,
      COALESCE(si.mapped_commission, 0) AS comm
    FROM public.sales sa
    LEFT JOIN public.sale_items si
      ON si.sale_id = sa.id AND COALESCE(si.is_cancelled, false) = false
    WHERE COALESCE(sa.validation_status, '') NOT IN ('rejected', 'cancelled')
      AND sa.agent_email IS NOT NULL
  ) x
  JOIN public.employee_master_data e ON e.id = x.emp
  WHERE COALESCE(e.sales_history_from, e.employment_start_date) IS NULL
     OR (x.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date
         >= COALESCE(e.sales_history_from, e.employment_start_date);

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
    current_streak_days, current_streak_start,
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
  today AS (
    SELECT (now() AT TIME ZONE 'Europe/Copenhagen')::date AS d
  ),
  span AS (
    SELECT emp, MIN(d) AS mn, GREATEST(MAX(d), (SELECT d FROM today)) AS mx
    FROM tmp_eps_day GROUP BY 1
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
      (COALESCE(sd.comm, 0) >= v_streak_min_commission) AS has_sale,
      CASE
        WHEN COALESCE(sd.comm, 0) >= v_streak_min_commission THEN false
        WHEN ad.d IS NOT NULL THEN true
        ELSE EXTRACT(isodow FROM c.d) IN (6, 7)
      END AS skipped
    FROM cal c
    LEFT JOIN tmp_eps_day sd ON sd.emp = c.emp AND sd.d = c.d
    LEFT JOIN abs_days ad ON ad.emp = c.emp AND ad.d = c.d
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
  last_island AS (
    SELECT DISTINCT ON (emp) emp, len, sd, ed FROM islands
    ORDER BY emp, ed DESC
  ),
  current_streak AS (
    SELECT li.emp, li.len, li.sd
    FROM last_island li
    WHERE NOT EXISTS (
      SELECT 1 FROM marked m
      WHERE m.emp = li.emp
        AND m.d > li.ed
        AND m.d < (SELECT d FROM today)
        AND NOT m.skipped
        AND NOT m.has_sale
    )
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
    COALESCE(cs.len, 0), cs.sd,
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
  LEFT JOIN current_streak cs ON cs.emp = e.id
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
    current_streak_days = EXCLUDED.current_streak_days,
    current_streak_start = EXCLUDED.current_streak_start,
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
$function$;

COMMENT ON COLUMN public.employee_profile_stats.longest_streak_days IS
  'Længste stribe af sammenhængende dage med mindst 1.500 kr i provision. Godkendt fravær og weekender springes over; dage under grænsen bryder striben.';
COMMENT ON COLUMN public.employee_profile_stats.current_streak_days IS
  'Igangværende stribe af dage med mindst 1.500 kr i provision (samme regel som rekordstriben).';