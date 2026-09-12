CREATE OR REPLACE FUNCTION public.compute_ramp_risk_stats(p_campaign uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_coverage_from date;
  v_version int;
  v_rows int := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.client_campaigns
    WHERE id = p_campaign AND ramp_enabled = true
  ) THEN
    RETURN 0;
  END IF;

  -- Samme huldetektion som i compute_ramp_curve, men UDEN lookback:
  -- til risikostatistikken vil vi have saa mange observationer som muligt.
  WITH covered AS (
    SELECT DISTINCT (sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date AS d
    FROM public.sales WHERE client_campaign_id = p_campaign
  ),
  gaps AS (
    SELECT d, d - lag(d) OVER (ORDER BY d) AS gap FROM covered
  )
  SELECT coalesce(
           (SELECT max(d) FROM gaps WHERE gap > 14),
           (SELECT min(d) FROM covered)
         )
    INTO v_coverage_from;

  IF v_coverage_from IS NULL THEN
    RETURN 0;
  END IF;

  SELECT max(curve_version) INTO v_version
  FROM public.ramp_curve WHERE client_campaign_id = p_campaign;

  IF v_version IS NULL THEN
    RETURN 0;
  END IF;

  WITH sellers AS (
    SELECT e.id,
           e.employment_start_date AS sd,
           e.employment_end_date AS ed,
           lower(coalesce(e.work_email, e.private_email)) AS email
    FROM public.employee_master_data e
    WHERE e.employment_start_date IS NOT NULL
      AND coalesce(e.work_email, e.private_email) IS NOT NULL
  ),
  days AS (
    SELECT s.id, s.email, s.ed, d::date AS work_date, day_no
    FROM sellers s
    CROSS JOIN LATERAL (
      SELECT d, row_number() OVER (ORDER BY d) AS day_no
      FROM generate_series(s.sd::timestamp,
                           s.sd::timestamp + interval '150 days',
                           interval '1 day') d
      WHERE extract(isodow FROM d) < 6
        AND NOT EXISTS (SELECT 1 FROM public.danish_holiday h WHERE h.date = d::date)
    ) w
    WHERE day_no <= 40
  ),
  d1 AS (SELECT id, work_date AS dt FROM days WHERE day_no = 1),
  d40 AS (SELECT id, work_date AS dt FROM days WHERE day_no = 40),
  cohort AS (
    -- Population uaendret: kraever mindst eet salg paa kampagnen og at
    -- opstarten ligger inden for den periode Stork har salgsdata for.
    -- Kravet om at dag 40 skal vaere passeret er fjernet: udfaldet for
    -- dem der allerede er stoppet er kendt og skal taelle med.
    SELECT s.id, s.email, s.ed, f.dt AS date1, l.dt AS date40,
           (s.ed IS NOT NULL AND s.ed < l.dt) AS stopped,
           (s.ed IS NULL AND l.dt > current_date) AS pending
    FROM sellers s
    JOIN d1 f ON f.id = s.id
    JOIN d40 l ON l.id = s.id
    WHERE v_coverage_from <= f.dt
      AND EXISTS (
        SELECT 1 FROM public.sales sa
        WHERE sa.client_campaign_id = p_campaign
          AND sa.agent_email = s.email
      )
  ),
  points AS (
    SELECT c.*, cp.day_no,
           (SELECT work_date FROM days dd WHERE dd.id = c.id AND dd.day_no = cp.day_no) AS measure_date
    FROM cohort c
    CROSS JOIN (VALUES (10), (15)) AS cp(day_no)
  ),
  measured AS (
    SELECT p.day_no, p.stopped, p.pending,
           (SELECT count(*) FROM public.sales sa
              WHERE sa.client_campaign_id = p_campaign
                AND sa.agent_email = p.email
                AND (sa.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date >= p.date1
                AND (sa.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date <= p.measure_date
           ) AS cum_sales,
           (SELECT c.p25 FROM public.ramp_curve c
              WHERE c.client_campaign_id = p_campaign
                AND c.curve_version = v_version
                AND c.day_no = p.day_no) AS p25
    FROM points p
    -- kun maalbar hvis saelgeren faktisk naaede dette antal arbejdsdage
    WHERE p.measure_date IS NOT NULL
      AND p.measure_date <= coalesce(p.ed, current_date)
  ),
  agg AS (
    SELECT day_no,
           max(p25) AS p25,
           count(*) FILTER (WHERE cum_sales < p25 AND NOT pending) AS n_below,
           count(*) FILTER (WHERE cum_sales < p25 AND NOT pending AND stopped) AS n_below_stopped,
           count(*) FILTER (WHERE cum_sales < p25 AND pending) AS n_below_pending,
           count(*) FILTER (WHERE cum_sales >= p25 AND NOT pending) AS n_above,
           count(*) FILTER (WHERE cum_sales >= p25 AND NOT pending AND stopped) AS n_above_stopped,
           count(*) FILTER (WHERE cum_sales >= p25 AND pending) AS n_above_pending
    FROM measured
    WHERE p25 IS NOT NULL
    GROUP BY day_no
  ),
  upsert AS (
    INSERT INTO public.ramp_risk_stats
      (client_campaign_id, day_no, threshold_p25, n_below, n_below_stopped, n_below_pending,
       n_above, n_above_stopped, n_above_pending, curve_version, computed_at)
    SELECT p_campaign, day_no, p25, n_below, n_below_stopped, n_below_pending,
           n_above, n_above_stopped, n_above_pending, v_version, now()
    FROM agg
    ON CONFLICT (client_campaign_id, day_no) DO UPDATE
      SET threshold_p25 = excluded.threshold_p25,
          n_below = excluded.n_below,
          n_below_stopped = excluded.n_below_stopped,
          n_below_pending = excluded.n_below_pending,
          n_above = excluded.n_above,
          n_above_stopped = excluded.n_above_stopped,
          n_above_pending = excluded.n_above_pending,
          curve_version = excluded.curve_version,
          computed_at = excluded.computed_at
    RETURNING 1
  )
  SELECT count(*)::int INTO v_rows FROM upsert;

  RETURN v_rows;
END;
$function$;