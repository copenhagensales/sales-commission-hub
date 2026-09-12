ALTER TABLE public.ramp_risk_stats
  ADD COLUMN IF NOT EXISTS n_below_pending integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS n_above_pending integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.compute_ramp_risk_stats(p_campaign uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_version int;
  v_lookback int;
  v_team_pattern text;
  v_rows int := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.client_campaigns
    WHERE id = p_campaign AND ramp_enabled = true
  ) THEN
    RETURN 0;
  END IF;

  SELECT max(curve_version) INTO v_version
  FROM public.ramp_curve WHERE client_campaign_id = p_campaign;

  IF v_version IS NULL THEN
    RETURN 0;
  END IF;

  SELECT coalesce((SELECT lookback_months FROM public.ramp_settings LIMIT 1), 8)
    INTO v_lookback;

  -- Kampagnens hold: kampagnenavnet uden produkt-suffiks, fx
  -- "Eesy TM Products" -> "%eesy tm%". Data-drevet, ingen hardkodning.
  SELECT '%' || lower(btrim(regexp_replace(name, '\s+products?$', '', 'i'))) || '%'
    INTO v_team_pattern
  FROM public.client_campaigns WHERE id = p_campaign;

  WITH sellers AS (
    SELECT e.id,
           e.employment_start_date AS sd,
           e.employment_end_date AS ed,
           lower(coalesce(e.work_email, e.private_email)) AS email
    FROM public.employee_master_data e
    WHERE e.employment_start_date IS NOT NULL
      AND coalesce(e.work_email, e.private_email) IS NOT NULL
      AND e.employment_start_date >= (current_date - (v_lookback || ' months')::interval)
      AND (
        -- (a) tilknyttet kampagnens hold, ogsaa uden salg
        EXISTS (
          SELECT 1 FROM public.employee_team_attribution a
          WHERE a.employee_id = e.id
            AND lower(a.team_name) LIKE v_team_pattern
        )
        -- (b) eller mindst eet salg paa kampagnen
        OR EXISTS (
          SELECT 1 FROM public.sales sa
          WHERE sa.client_campaign_id = p_campaign
            AND sa.agent_email = lower(coalesce(e.work_email, e.private_email))
        )
      )
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
  base AS (
    SELECT s.id, s.email, s.ed, f.dt AS date1, l.dt AS date40,
           -- stoppet: fratraadt foer arbejdsdag 40
           (s.ed IS NOT NULL AND s.ed < l.dt) AS stopped,
           -- undervejs: stadig ansat, endnu ikke naaet dag 40
           (s.ed IS NULL AND l.dt > current_date) AS pending
    FROM sellers s
    JOIN d1 f ON f.id = s.id
    JOIN d40 l ON l.id = s.id
  ),
  points AS (
    SELECT b.*, cp.day_no,
           (SELECT work_date FROM days dd WHERE dd.id = b.id AND dd.day_no = cp.day_no) AS measure_date
    FROM base b
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
    -- kun maalbar hvis sael­geren faktisk naaede dette antal arbejdsdage
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