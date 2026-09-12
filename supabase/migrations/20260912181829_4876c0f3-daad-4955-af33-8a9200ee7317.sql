-- Rollback: dag 1 = employment_start_date. Ny udelukkelsesregel: foerste kampagnesalg mere end 7 dage foer ansaettelsesdato.
DROP FUNCTION IF EXISTS public.ramp_day1(uuid, uuid);

CREATE OR REPLACE FUNCTION public.compute_ramp_curve(p_campaign uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_version int;
  v_coverage_from date;
  v_lookback_months int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.client_campaigns
    WHERE id = p_campaign AND ramp_enabled = true
  ) THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(max(curve_version), 0) + 1 INTO v_version
  FROM public.ramp_curve WHERE client_campaign_id = p_campaign;

  SELECT coalesce(min(lookback_months), 8) INTO v_lookback_months
  FROM public.ramp_settings;

  WITH covered AS (
    SELECT DISTINCT (sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date AS d
    FROM public.sales WHERE client_campaign_id = p_campaign
  ),
  gaps AS (
    SELECT d, d - lag(d) OVER (ORDER BY d) AS gap FROM covered
  )
  SELECT greatest(
           coalesce(
             (SELECT max(d) FROM gaps WHERE gap > 14),
             (SELECT min(d) FROM covered)
           ),
           (current_date - make_interval(months => v_lookback_months))::date
         )
    INTO v_coverage_from;

  IF v_coverage_from IS NULL THEN
    RETURN NULL;
  END IF;

  WITH sellers AS (
    -- Dag 1 = ansaettelsesdatoen. Udeluk sælgere med kampagnesalg mere end 7 dage foer ansaettelse.
    SELECT e.id,
           e.employment_end_date,
           lower(coalesce(e.work_email, e.private_email)) AS email,
           e.employment_start_date AS start_date
    FROM public.employee_master_data e
    CROSS JOIN LATERAL (
      SELECT min((sa.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date) AS first_sale
      FROM public.sales sa
      WHERE sa.client_campaign_id = p_campaign
        AND sa.agent_email = lower(coalesce(e.work_email, e.private_email))
    ) fs
    WHERE e.employment_start_date IS NOT NULL
      AND coalesce(e.work_email, e.private_email) IS NOT NULL
      AND fs.first_sale IS NOT NULL
      AND fs.first_sale >= e.employment_start_date - 7
  ),
  days AS (
    SELECT s.id, s.email, s.employment_end_date, d::date AS work_date, day_no
    FROM sellers s
    CROSS JOIN LATERAL (
      SELECT d, row_number() OVER (ORDER BY d) AS day_no
      FROM generate_series(s.start_date::timestamp,
                           s.start_date::timestamp + interval '150 days',
                           interval '1 day') d
      WHERE extract(isodow FROM d) < 6
        AND NOT EXISTS (SELECT 1 FROM public.danish_holiday h WHERE h.date = d::date)
    ) w
    WHERE day_no <= 40
  ),
  day1 AS (
    SELECT id, work_date AS d1 FROM days WHERE day_no = 1
  ),
  day40 AS (
    SELECT id, email, employment_end_date, work_date AS d40 FROM days WHERE day_no = 40
  ),
  eligible AS (
    SELECT d.id, d.email
    FROM day40 d
    JOIN day1 f ON f.id = d.id
    WHERE d.d40 < current_date
      AND (d.employment_end_date IS NULL OR d.employment_end_date >= d.d40)
      AND v_coverage_from <= f.d1
  ),
  daily AS (
    SELECT d.id, d.day_no,
           (SELECT count(*) FROM public.sales sa
             WHERE sa.client_campaign_id = p_campaign
               AND sa.agent_email = d.email
               AND (sa.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date = d.work_date
           ) AS sales_count
    FROM days d
    JOIN eligible e ON e.id = d.id
  ),
  cum AS (
    SELECT id, day_no,
           sum(sales_count) OVER (PARTITION BY id ORDER BY day_no) AS cum_sales
    FROM daily
  ),
  pooled AS (
    SELECT g.day_no, c.cum_sales
    FROM generate_series(1, 40) g(day_no)
    JOIN cum c ON c.day_no BETWEEN greatest(1, g.day_no - 2) AND least(40, g.day_no + 2)
  )
  INSERT INTO public.ramp_curve (client_campaign_id, day_no, p25, p50, p75, n_sellers, curve_version)
  SELECT p_campaign,
         p.day_no,
         percentile_cont(0.25) WITHIN GROUP (ORDER BY p.cum_sales),
         percentile_cont(0.50) WITHIN GROUP (ORDER BY p.cum_sales),
         percentile_cont(0.75) WITHIN GROUP (ORDER BY p.cum_sales),
         (SELECT count(DISTINCT id)::int FROM cum),
         v_version
  FROM pooled p
  GROUP BY p.day_no;

  IF NOT EXISTS (SELECT 1 FROM public.ramp_curve WHERE client_campaign_id = p_campaign AND curve_version = v_version) THEN
    RETURN NULL;
  END IF;

  RETURN v_version;
END;
$function$;

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
    -- Dag 1 = ansaettelsesdatoen. Udeluk sælgere med kampagnesalg mere end 7 dage foer ansaettelse.
    SELECT e.id,
           e.employment_start_date AS sd,
           e.employment_end_date AS ed,
           lower(coalesce(e.work_email, e.private_email)) AS email
    FROM public.employee_master_data e
    CROSS JOIN LATERAL (
      SELECT min((sa.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date) AS first_sale
      FROM public.sales sa
      WHERE sa.client_campaign_id = p_campaign
        AND sa.agent_email = lower(coalesce(e.work_email, e.private_email))
    ) fs
    WHERE e.employment_start_date IS NOT NULL
      AND coalesce(e.work_email, e.private_email) IS NOT NULL
      AND fs.first_sale IS NOT NULL
      AND fs.first_sale >= e.employment_start_date - 7
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
    SELECT s.id, s.email, s.ed, f.dt AS date1, l.dt AS date40,
           (s.ed IS NOT NULL AND s.ed < l.dt) AS stopped,
           (s.ed IS NULL AND l.dt > current_date) AS pending
    FROM sellers s
    JOIN d1 f ON f.id = s.id
    JOIN d40 l ON l.id = s.id
    WHERE v_coverage_from <= f.dt
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

CREATE OR REPLACE FUNCTION public.ramp_create_risk_flags()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_created int := 0;
  v_today date := (now() AT TIME ZONE 'Europe/Copenhagen')::date;
BEGIN
  WITH enrolled AS (
    -- Dag 1 = indrulleringens start_date (ansaettelsesdatoen).
    SELECT en.employee_id, en.client_campaign_id, en.curve_version,
           en.start_date,
           lower(coalesce(e.work_email, e.private_email)) AS email
    FROM public.employee_ramp_enrollment en
    JOIN public.employee_master_data e ON e.id = en.employee_id
    WHERE coalesce(e.work_email, e.private_email) IS NOT NULL
      AND e.employment_end_date IS NULL
  ),
  windowed AS (
    SELECT en.*, public.ramp_workday_no(en.start_date, v_today) AS current_day_no
    FROM enrolled en
  ),
  passed AS (
    SELECT w.*, cp.day_no
    FROM windowed w
    CROSS JOIN (VALUES (10), (15)) AS cp(day_no)
    WHERE w.current_day_no >= cp.day_no
      AND w.current_day_no <= 40
  ),
  dated AS (
    SELECT p.*, w.measure_date
    FROM passed p
    CROSS JOIN LATERAL (
      SELECT d::date AS measure_date
      FROM (
        SELECT d, row_number() OVER (ORDER BY d) AS n
        FROM generate_series(p.start_date::timestamp,
                             p.start_date::timestamp + interval '150 days',
                             interval '1 day') d
        WHERE extract(isodow FROM d) < 6
          AND NOT EXISTS (SELECT 1 FROM public.danish_holiday h WHERE h.date = d::date)
      ) s
      WHERE s.n = p.day_no
    ) w
  ),
  measured AS (
    SELECT d.*,
           (SELECT count(*) FROM public.sales sa
              WHERE sa.client_campaign_id = d.client_campaign_id
                AND sa.agent_email = d.email
                AND (sa.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date >= d.start_date
                AND (sa.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date <= d.measure_date
           ) AS cum_sales,
           (SELECT c.p25 FROM public.ramp_curve c
              WHERE c.client_campaign_id = d.client_campaign_id
                AND c.curve_version = d.curve_version
                AND c.day_no = d.day_no
           ) AS threshold_value
    FROM dated d
  ),
  inserted AS (
    INSERT INTO public.ramp_risk_flag
      (employee_id, client_campaign_id, day_no, cum_sales, threshold_value, curve_version)
    SELECT m.employee_id, m.client_campaign_id, m.day_no, m.cum_sales, m.threshold_value, m.curve_version
    FROM measured m
    WHERE m.threshold_value IS NOT NULL
      AND m.cum_sales < m.threshold_value
    ON CONFLICT (employee_id, day_no) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::int INTO v_created FROM inserted;

  RETURN v_created;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ramp_nightly_maintenance()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_enrolled int := 0;
  v_recomputed int := 0;
  v_flags int := 0;
  v_stats int := 0;
  v_campaign uuid;
BEGIN
  IF extract(day FROM current_date) = 1 THEN
    FOR v_campaign IN
      SELECT id FROM public.client_campaigns WHERE ramp_enabled = true
    LOOP
      PERFORM public.compute_ramp_curve(v_campaign);
      v_stats := v_stats + coalesce(public.compute_ramp_risk_stats(v_campaign), 0);
      v_recomputed := v_recomputed + 1;
    END LOOP;
  END IF;

  WITH latest AS (
    SELECT rc.client_campaign_id, max(rc.curve_version) AS curve_version
    FROM public.ramp_curve rc
    JOIN public.client_campaigns cc
      ON cc.id = rc.client_campaign_id AND cc.ramp_enabled = true
    GROUP BY rc.client_campaign_id
  ),
  candidates AS (
    -- Dag 1 = ansaettelsesdatoen. Udeluk sælgere med kampagnesalg mere end 7 dage foer ansaettelse.
    SELECT DISTINCT ON (e.id)
           e.id AS employee_id,
           sa.client_campaign_id,
           e.employment_start_date AS start_date,
           l.curve_version
    FROM public.employee_master_data e
    JOIN public.sales sa
      ON sa.agent_email = lower(coalesce(e.work_email, e.private_email))
    JOIN latest l ON l.client_campaign_id = sa.client_campaign_id
    WHERE e.employment_start_date IS NOT NULL
      AND coalesce(e.is_active, true) = true
      AND public.ramp_workday_no(
            e.employment_start_date,
            (now() AT TIME ZONE 'Europe/Copenhagen')::date) BETWEEN 1 AND 40
      AND NOT EXISTS (
        SELECT 1 FROM public.employee_ramp_enrollment en WHERE en.employee_id = e.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.sales s2
        WHERE s2.client_campaign_id = sa.client_campaign_id
          AND s2.agent_email = lower(coalesce(e.work_email, e.private_email))
          AND (s2.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date < e.employment_start_date - 7
      )
    ORDER BY e.id, sa.sale_datetime
  ),
  ins AS (
    INSERT INTO public.employee_ramp_enrollment
      (employee_id, client_campaign_id, start_date, curve_version)
    SELECT employee_id, client_campaign_id, start_date, curve_version
    FROM candidates
    ON CONFLICT (employee_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::int INTO v_enrolled FROM ins;

  v_flags := public.ramp_create_risk_flags();

  RETURN jsonb_build_object('enrolled', v_enrolled, 'recomputed', v_recomputed,
                            'risk_stat_rows', v_stats, 'flags_created', v_flags);
END;
$function$;