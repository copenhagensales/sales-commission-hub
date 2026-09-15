CREATE TABLE IF NOT EXISTS public.ramp_campaign_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ramp_campaign_id uuid NOT NULL REFERENCES public.client_campaigns(id) ON DELETE CASCADE,
  included_campaign_id uuid NOT NULL REFERENCES public.client_campaigns(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ramp_campaign_id, included_campaign_id),
  CHECK (ramp_campaign_id <> included_campaign_id)
);

GRANT SELECT ON public.ramp_campaign_link TO authenticated;
GRANT ALL ON public.ramp_campaign_link TO service_role;

ALTER TABLE public.ramp_campaign_link ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ledere kan se ramp kampagne links"
  ON public.ramp_campaign_link FOR SELECT TO authenticated
  USING (public.can_view_ramp_team());

CREATE POLICY "Ejere kan administrere ramp kampagne links"
  ON public.ramp_campaign_link FOR ALL TO authenticated
  USING (public.effective_is_owner() OR public.effective_is_superadmin())
  WITH CHECK (public.effective_is_owner() OR public.effective_is_superadmin());

CREATE OR REPLACE FUNCTION public.ramp_campaign_ids(p_campaign uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT array_append(
           coalesce((SELECT array_agg(l.included_campaign_id)
                     FROM public.ramp_campaign_link l
                     WHERE l.ramp_campaign_id = p_campaign), '{}'::uuid[]),
           p_campaign)
$function$;

INSERT INTO public.ramp_campaign_link (ramp_campaign_id, included_campaign_id)
SELECT 'd031126c-aec0-4b80-bbe2-bbc31c4f04ba'::uuid, '9e267bce-6679-4c37-ae42-5e68c420c34f'::uuid
ON CONFLICT DO NOTHING;

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
  v_campaigns uuid[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.client_campaigns
    WHERE id = p_campaign AND ramp_enabled = true
  ) THEN
    RETURN NULL;
  END IF;

  v_campaigns := public.ramp_campaign_ids(p_campaign);

  SELECT coalesce(max(curve_version), 0) + 1 INTO v_version
  FROM public.ramp_curve WHERE client_campaign_id = p_campaign;

  SELECT coalesce(min(lookback_months), 8) INTO v_lookback_months
  FROM public.ramp_settings;

  WITH covered AS (
    SELECT DISTINCT (sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date AS d
    FROM public.sales WHERE client_campaign_id = ANY(v_campaigns)
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
    SELECT e.id,
           e.employment_end_date,
           lower(coalesce(e.work_email, e.private_email)) AS email,
           e.employment_start_date AS start_date
    FROM public.employee_master_data e
    CROSS JOIN LATERAL (
      SELECT min((sa.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date) AS first_sale
      FROM public.sales sa
      WHERE sa.client_campaign_id = ANY(v_campaigns)
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
             WHERE sa.client_campaign_id = ANY(v_campaigns)
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
  v_campaigns uuid[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.client_campaigns
    WHERE id = p_campaign AND ramp_enabled = true
  ) THEN
    RETURN 0;
  END IF;

  v_campaigns := public.ramp_campaign_ids(p_campaign);

  WITH covered AS (
    SELECT DISTINCT (sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date AS d
    FROM public.sales WHERE client_campaign_id = ANY(v_campaigns)
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
    CROSS JOIN LATERAL (
      SELECT min((sa.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date) AS first_sale
      FROM public.sales sa
      WHERE sa.client_campaign_id = ANY(v_campaigns)
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
              WHERE sa.client_campaign_id = ANY(v_campaigns)
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

CREATE OR REPLACE FUNCTION public.get_ramp_for_employee(p_employee_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed boolean;
  v_enroll record;
  v_campaign_name text;
  v_current int;
  v_result jsonb;
  v_campaigns uuid[];
BEGIN
  v_allowed := (public.effective_employee_id() = p_employee_id)
    OR public.effective_is_teamleder_or_above()
    OR public.effective_is_owner()
    OR public.effective_is_superadmin();

  IF coalesce(v_allowed, false) = false THEN
    RAISE EXCEPTION 'Ingen adgang';
  END IF;

  SELECT er.*, lower(coalesce(e.work_email, e.private_email)) AS email
  INTO v_enroll
  FROM public.employee_ramp_enrollment er
  JOIN public.employee_master_data e ON e.id = er.employee_id
  WHERE er.employee_id = p_employee_id;

  IF v_enroll IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  v_campaigns := public.ramp_campaign_ids(v_enroll.client_campaign_id);

  SELECT cc.name INTO v_campaign_name
  FROM public.client_campaigns cc WHERE cc.id = v_enroll.client_campaign_id;

  v_current := public.ramp_workday_no(v_enroll.start_date, current_date);

  WITH days AS (
    SELECT d::date AS work_date, day_no
    FROM (
      SELECT d, row_number() OVER (ORDER BY d) AS day_no
      FROM generate_series(v_enroll.start_date::timestamp,
                           v_enroll.start_date::timestamp + interval '150 days',
                           interval '1 day') d
      WHERE extract(isodow FROM d) < 6
        AND NOT EXISTS (SELECT 1 FROM public.danish_holiday h WHERE h.date = d::date)
    ) w
    WHERE day_no <= 40
  ),
  daily AS (
    SELECT d.day_no,
           (SELECT count(*) FROM public.sales sa
             WHERE sa.client_campaign_id = ANY(v_campaigns)
               AND sa.agent_email = v_enroll.email
               AND (sa.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date = d.work_date
           ) AS sales_count
    FROM days d
    WHERE d.day_no <= least(v_current, 40)
  ),
  cum AS (
    SELECT day_no, sum(sales_count) OVER (ORDER BY day_no)::int AS cum_sales
    FROM daily
  ),
  band AS (
    SELECT day_no, p25, p50, p75, n_sellers
    FROM public.ramp_curve
    WHERE client_campaign_id = v_enroll.client_campaign_id
      AND curve_version = v_enroll.curve_version
    ORDER BY day_no
  )
  SELECT jsonb_build_object(
    'employee_id', p_employee_id,
    'client_campaign_id', v_enroll.client_campaign_id,
    'campaign_name', v_campaign_name,
    'start_date', v_enroll.start_date,
    'curve_version', v_enroll.curve_version,
    'current_day_no', v_current,
    'er_aktiv', (v_current <= 40),
    'n_sellers', (SELECT max(n_sellers) FROM band),
    'my_days', coalesce((SELECT jsonb_agg(jsonb_build_object('day_no', day_no, 'cum_sales', cum_sales) ORDER BY day_no) FROM cum), '[]'::jsonb),
    'band', coalesce((SELECT jsonb_agg(jsonb_build_object('day_no', day_no, 'p25', p25, 'p50', p50, 'p75', p75) ORDER BY day_no) FROM band), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
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
              WHERE sa.client_campaign_id = ANY(public.ramp_campaign_ids(d.client_campaign_id))
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

CREATE OR REPLACE FUNCTION public.get_ramp_team_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := public.effective_employee_id();
  v_all boolean := public.effective_is_owner()
                   OR public.effective_is_superadmin()
                   OR public.effective_has_app_role('admin');
  v_today date := (now() AT TIME ZONE 'Europe/Copenhagen')::date;
  v_monday date := date_trunc('week', (now() AT TIME ZONE 'Europe/Copenhagen'))::date;
  v_program_start date := (SELECT weekly_program_start_date FROM public.ramp_settings ORDER BY created_at LIMIT 1);
  v_result jsonb;
BEGIN
  IF NOT public.can_view_ramp_team() THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH enrolled AS (
    SELECT en.employee_id,
           en.client_campaign_id,
           public.ramp_campaign_ids(en.client_campaign_id) AS campaign_ids,
           en.start_date,
           en.curve_version,
           e.employment_end_date,
           lower(coalesce(e.work_email, e.private_email)) AS email,
           trim(concat_ws(' ', e.first_name, e.last_name)) AS employee_name,
           public.ramp_workday_no(en.start_date, v_today) AS day_no
    FROM public.employee_ramp_enrollment en
    JOIN public.employee_master_data e ON e.id = en.employee_id
    JOIN public.client_campaigns cc ON cc.id = en.client_campaign_id AND cc.ramp_enabled = true
    WHERE coalesce(e.is_active, true) = true
      AND (e.employment_end_date IS NULL OR e.employment_end_date > v_today)
      AND en.employee_id IS DISTINCT FROM v_me
      AND (
        v_all
        OR EXISTS (
          SELECT 1
          FROM public.team_members tm
          JOIN public.teams t ON t.id = tm.team_id
          WHERE tm.employee_id = en.employee_id
            AND (
              t.team_leader_id = v_me
              OR t.assistant_team_leader_id = v_me
              OR EXISTS (SELECT 1 FROM public.team_assistant_leaders al
                          WHERE al.team_id = t.id AND al.employee_id = v_me)
            )
        )
      )
  ),
  active AS (
    SELECT * FROM enrolled WHERE day_no BETWEEN 1 AND 40
  ),
  weeks_raw AS (
    SELECT a.employee_id,
           a.client_campaign_id,
           a.campaign_ids,
           a.curve_version,
           a.start_date,
           a.email,
           w.monday::date AS monday,
           row_number() OVER (PARTITION BY a.employee_id ORDER BY w.monday) AS week_no,
           row_number() OVER (PARTITION BY a.employee_id ORDER BY w.monday DESC) AS week_rev
    FROM active a
    CROSS JOIN LATERAL generate_series(
      date_trunc('week', a.start_date::timestamp),
      date_trunc('week', v_today::timestamp),
      interval '7 days'
    ) w(monday)
  ),
  weeks AS (
    SELECT wr.*,
           least(wr.monday + 6, v_today) AS week_end,
           least(public.ramp_workday_no(wr.start_date, least(wr.monday + 6, v_today)), 40) AS day_end,
           CASE WHEN wr.monday <= wr.start_date THEN 0
                ELSE least(public.ramp_workday_no(wr.start_date, wr.monday - 1), 40) END AS day_prev
    FROM weeks_raw wr
    WHERE wr.week_rev <= 6
  ),
  weeks_metrics AS (
    SELECT w.employee_id,
           w.week_no,
           extract(isoyear FROM w.monday)::int AS iso_year,
           extract(week FROM w.monday)::int AS iso_week,
           (SELECT count(*) FROM public.sales sa
              WHERE sa.client_campaign_id = ANY(w.campaign_ids)
                AND sa.agent_email = w.email
                AND (sa.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date
                    BETWEEN greatest(w.monday, w.start_date) AND w.week_end
           )::int AS sales,
           greatest(0, coalesce(ce.p25, 0) - coalesce(cp.p25, 0)) AS p25,
           greatest(0, coalesce(ce.p50, 0) - coalesce(cp.p50, 0)) AS p50,
           greatest(0, coalesce(ce.p75, 0) - coalesce(cp.p75, 0)) AS p75
    FROM weeks w
    LEFT JOIN public.ramp_curve ce
      ON ce.client_campaign_id = w.client_campaign_id
     AND ce.curve_version = w.curve_version
     AND ce.day_no = w.day_end
    LEFT JOIN public.ramp_curve cp
      ON cp.client_campaign_id = w.client_campaign_id
     AND cp.curve_version = w.curve_version
     AND cp.day_no = w.day_prev
  ),
  detail AS (
    SELECT a.employee_id,
           a.employee_name,
           a.day_no,
           greatest(0, 40 - a.day_no) AS days_left,
           cc.name AS campaign_name,
           (SELECT t.name FROM public.team_members tm
              JOIN public.teams t ON t.id = tm.team_id
             WHERE tm.employee_id = a.employee_id
             ORDER BY t.name LIMIT 1) AS team_name,
           (SELECT count(*) FROM public.sales sa
              WHERE sa.client_campaign_id = ANY(a.campaign_ids)
                AND sa.agent_email = a.email
                AND (sa.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date >= a.start_date
                AND (sa.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date <= v_today
           )::int AS cum_sales,
           c.p25, c.p50, c.p75,
           f.id AS flag_id,
           f.created_at AS flag_created_at,
           CASE WHEN f.id IS NULL THEN NULL
                ELSE greatest(0, (date_part('epoch', now() - f.created_at) / 86400)::int)
           END AS flag_days_open,
           public.ramp_week_workdays(a.start_date, v_monday, a.employment_end_date) AS workdays_this_week,
           EXISTS (SELECT 1 FROM public.ramp_flag_action ac
                    WHERE ac.employee_id = a.employee_id
                      AND ac.action_type = '1-1 samtale'
                      AND (ac.performed_at AT TIME ZONE 'Europe/Copenhagen')::date
                          BETWEEN v_monday AND v_monday + 6) AS has_coaching,
           EXISTS (SELECT 1 FROM public.ramp_flag_action ac
                    WHERE ac.employee_id = a.employee_id
                      AND ac.action_type = 'medlyt med feedback'
                      AND (ac.performed_at AT TIME ZONE 'Europe/Copenhagen')::date
                          BETWEEN v_monday AND v_monday + 6) AS has_listen,
           EXISTS (SELECT 1 FROM public.ramp_flag_action ac
                    WHERE ac.employee_id = a.employee_id
                      AND ac.action_type = 'fravær hele ugen'
                      AND (ac.performed_at AT TIME ZONE 'Europe/Copenhagen')::date
                          BETWEEN v_monday AND v_monday + 6) AS has_absence,
           coalesce((
             SELECT jsonb_agg(jsonb_build_object(
                      'week_no', wm.week_no,
                      'iso_year', wm.iso_year,
                      'iso_week', wm.iso_week,
                      'sales', wm.sales,
                      'p25', wm.p25,
                      'p50', wm.p50,
                      'p75', wm.p75
                    ) ORDER BY wm.week_no)
             FROM weeks_metrics wm WHERE wm.employee_id = a.employee_id
           ), '[]'::jsonb) AS weeks,
           coalesce((
             SELECT jsonb_agg(jsonb_build_object(
                      'action_type', ac.action_type,
                      'performed_at', ac.performed_at,
                      'performed_by_name', trim(concat_ws(' ', p.first_name, p.last_name)),
                      'note', ac.note,
                      'recipients', coalesce(ac.recipients, ARRAY[]::text[])
                    ) ORDER BY ac.performed_at DESC)
             FROM public.ramp_flag_action ac
             LEFT JOIN public.employee_master_data p ON p.id = ac.performed_by
             WHERE ac.employee_id = a.employee_id
           ), '[]'::jsonb) AS actions
    FROM active a
    LEFT JOIN public.client_campaigns cc ON cc.id = a.client_campaign_id
    LEFT JOIN public.ramp_curve c
      ON c.client_campaign_id = a.client_campaign_id
     AND c.curve_version = a.curve_version
     AND c.day_no = a.day_no
    LEFT JOIN LATERAL (
      SELECT rf.id, rf.created_at
      FROM public.ramp_risk_flag rf
      WHERE rf.employee_id = a.employee_id AND rf.status = 'open'
      ORDER BY rf.created_at ASC
      LIMIT 1
    ) f ON true
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'employee_id', d.employee_id,
           'employee_name', d.employee_name,
           'campaign_name', d.campaign_name,
           'team_name', d.team_name,
           'day_no', d.day_no,
           'days_left', d.days_left,
           'cum_sales', d.cum_sales,
           'p25', d.p25,
           'p50', d.p50,
           'p75', d.p75,
           'status', CASE
                       WHEN d.p25 IS NULL THEN 'ukendt'
                       WHEN d.cum_sales > d.p75 THEN 'over'
                       WHEN d.cum_sales < d.p25 THEN 'under'
                       ELSE 'midt'
                     END,
           'flag_id', d.flag_id,
           'flag_created_at', d.flag_created_at,
           'flag_days_open', d.flag_days_open,
           'iso_year', extract(isoyear FROM v_monday)::int,
           'iso_week', extract(week FROM v_monday)::int,
           'workdays_this_week', d.workdays_this_week,
           'has_coaching', d.has_coaching,
           'has_listen', d.has_listen,
           'has_absence', d.has_absence,
           'weekly_program_start_date', v_program_start,
           'weekly_program_active', (v_program_start IS NOT NULL AND v_monday >= v_program_start),
           'week_required', (
             d.workdays_this_week >= 2
             AND NOT d.has_absence
             AND v_program_start IS NOT NULL
             AND v_monday >= v_program_start
           ),
           'week_complete', (d.has_absence OR (d.has_coaching AND d.has_listen)),
           'weeks', d.weeks,
           'actions', d.actions
         )), '[]'::jsonb)
    INTO v_result
  FROM detail d;

  RETURN v_result;
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
    SELECT DISTINCT ON (e.id)
           e.id AS employee_id,
           l.client_campaign_id,
           e.employment_start_date AS start_date,
           l.curve_version
    FROM public.employee_master_data e
    JOIN public.sales sa
      ON sa.agent_email = lower(coalesce(e.work_email, e.private_email))
    JOIN latest l ON sa.client_campaign_id = ANY(public.ramp_campaign_ids(l.client_campaign_id))
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
        WHERE s2.client_campaign_id = ANY(public.ramp_campaign_ids(l.client_campaign_id))
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