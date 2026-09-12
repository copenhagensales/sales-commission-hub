ALTER TABLE public.ramp_settings
  ADD COLUMN IF NOT EXISTS weekly_program_start_date date;

CREATE OR REPLACE FUNCTION public.get_ramp_team_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
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
              WHERE sa.client_campaign_id = w.client_campaign_id
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
              WHERE sa.client_campaign_id = a.client_campaign_id
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
                      'performed_by_name', trim(concat_ws(' ', p.first_name, p.last_name))
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
    -- Én raekke pr. saelger: en saelger kan have baade dag 10- og dag 15-flag aabent
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
$fn$;

CREATE OR REPLACE FUNCTION public.ramp_weekly_missing_payload()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH cfg AS (
    SELECT (now() AT TIME ZONE 'Europe/Copenhagen')::date AS today,
           date_trunc('week', (now() AT TIME ZONE 'Europe/Copenhagen'))::date AS monday,
           (SELECT weekly_program_start_date FROM public.ramp_settings ORDER BY created_at LIMIT 1) AS program_start
  ),
  enrolled AS (
    SELECT en.employee_id,
           trim(concat_ws(' ', e.first_name, e.last_name)) AS employee_name,
           public.ramp_workday_no(en.start_date, cfg.today) AS day_no,
           public.ramp_week_workdays(en.start_date, cfg.monday, e.employment_end_date) AS workdays,
           cfg.monday,
           cfg.program_start,
           EXISTS (SELECT 1 FROM public.ramp_flag_action ac
                    WHERE ac.employee_id = en.employee_id AND ac.action_type = '1-1 samtale'
                      AND (ac.performed_at AT TIME ZONE 'Europe/Copenhagen')::date
                          BETWEEN cfg.monday AND cfg.monday + 6) AS has_coaching,
           EXISTS (SELECT 1 FROM public.ramp_flag_action ac
                    WHERE ac.employee_id = en.employee_id AND ac.action_type = 'medlyt med feedback'
                      AND (ac.performed_at AT TIME ZONE 'Europe/Copenhagen')::date
                          BETWEEN cfg.monday AND cfg.monday + 6) AS has_listen,
           EXISTS (SELECT 1 FROM public.ramp_flag_action ac
                    WHERE ac.employee_id = en.employee_id AND ac.action_type = 'fravær hele ugen'
                      AND (ac.performed_at AT TIME ZONE 'Europe/Copenhagen')::date
                          BETWEEN cfg.monday AND cfg.monday + 6) AS has_absence
    FROM public.employee_ramp_enrollment en
    JOIN public.employee_master_data e ON e.id = en.employee_id
    JOIN public.client_campaigns cc ON cc.id = en.client_campaign_id AND cc.ramp_enabled = true
    CROSS JOIN cfg
    WHERE coalesce(e.is_active, true) = true
      AND (e.employment_end_date IS NULL OR e.employment_end_date > cfg.today)
  ),
  missing AS (
    SELECT en.employee_id,
           en.employee_name,
           en.day_no,
           NOT en.has_coaching AS missing_coaching,
           NOT en.has_listen AS missing_listen,
           (SELECT t.name FROM public.team_members tm JOIN public.teams t ON t.id = tm.team_id
             WHERE tm.employee_id = en.employee_id ORDER BY t.name LIMIT 1) AS team_name,
           (SELECT trim(concat_ws(' ', l.first_name, l.last_name))
              FROM public.team_members tm
              JOIN public.teams t ON t.id = tm.team_id
              JOIN public.employee_master_data l ON l.id = t.team_leader_id
             WHERE tm.employee_id = en.employee_id ORDER BY t.name LIMIT 1) AS leader_name
    FROM enrolled en
    WHERE en.day_no BETWEEN 1 AND 40
      AND en.workdays >= 2
      AND en.program_start IS NOT NULL
      AND en.monday >= en.program_start
      AND NOT en.has_absence
      AND NOT (en.has_coaching AND en.has_listen)
  ),
  leader_team AS (
    SELECT t.id AS team_id, t.team_leader_id AS employee_id FROM public.teams t WHERE t.team_leader_id IS NOT NULL
    UNION
    SELECT t.id, t.assistant_team_leader_id FROM public.teams t WHERE t.assistant_team_leader_id IS NOT NULL
    UNION
    SELECT al.team_id, al.employee_id FROM public.team_assistant_leaders al
  ),
  pairs AS (
    SELECT lt.employee_id AS recipient_id, m.*, false AS is_escalation
    FROM missing m
    JOIN public.team_members tm ON tm.employee_id = m.employee_id
    JOIN leader_team lt ON lt.team_id = tm.team_id
    WHERE lt.employee_id <> m.employee_id
    UNION
    SELECT r.employee_id, m.*, true
    FROM missing m
    CROSS JOIN public.ramp_escalation_recipients r
    WHERE r.is_active = true AND r.employee_id <> m.employee_id
  )
  SELECT coalesce(jsonb_agg(payload), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
             'recipient_id', p.recipient_id,
             'recipient_name', trim(concat_ws(' ', l.first_name, l.last_name)),
             'recipient_email', l.work_email,
             'is_escalation', bool_and(p.is_escalation),
             'sellers', jsonb_agg(DISTINCT jsonb_build_object(
                 'employee_name', p.employee_name,
                 'team_name', p.team_name,
                 'leader_name', p.leader_name,
                 'day_no', p.day_no,
                 'missing_coaching', p.missing_coaching,
                 'missing_listen', p.missing_listen
               ))
           ) AS payload
    FROM pairs p
    JOIN public.employee_master_data l ON l.id = p.recipient_id
    WHERE l.work_email IS NOT NULL
      AND coalesce(l.is_active, true) = true
    GROUP BY p.recipient_id, l.first_name, l.last_name, l.work_email
  ) q;
$fn$;

REVOKE EXECUTE ON FUNCTION public.ramp_weekly_missing_payload() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.ramp_risk_mail_payload()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH leader_team AS (
    SELECT t.id AS team_id, t.team_leader_id AS employee_id FROM public.teams t WHERE t.team_leader_id IS NOT NULL
    UNION
    SELECT t.id, t.assistant_team_leader_id FROM public.teams t WHERE t.assistant_team_leader_id IS NOT NULL
    UNION
    SELECT al.team_id, al.employee_id FROM public.team_assistant_leaders al
  ),
  open_flags AS (
    SELECT lt.employee_id AS leader_id,
           f.id AS flag_id,
           trim(concat_ws(' ', e.first_name, e.last_name)) AS employee_name,
           cc.name AS campaign_name,
           f.day_no, f.cum_sales, f.threshold_value, f.created_at
    FROM public.ramp_risk_flag f
    JOIN public.team_members tm ON tm.employee_id = f.employee_id
    JOIN leader_team lt ON lt.team_id = tm.team_id
    JOIN public.employee_master_data e ON e.id = f.employee_id
    LEFT JOIN public.client_campaigns cc ON cc.id = f.client_campaign_id
    WHERE f.status = 'open'
      AND f.employee_id <> lt.employee_id
      AND coalesce(e.is_active, true) = true
      AND (e.employment_end_date IS NULL
           OR e.employment_end_date > (now() AT TIME ZONE 'Europe/Copenhagen')::date)
  )
  SELECT coalesce(jsonb_agg(payload), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
             'leader_id', o.leader_id,
             'leader_name', trim(concat_ws(' ', l.first_name, l.last_name)),
             'leader_email', l.work_email,
             'stats', coalesce((
               SELECT jsonb_agg(jsonb_build_object(
                        'day_no', rs.day_no,
                        'campaign_name', c2.name,
                        'n_below', rs.n_below,
                        'n_below_stopped', rs.n_below_stopped,
                        'n_above', rs.n_above,
                        'n_above_stopped', rs.n_above_stopped
                      ) ORDER BY rs.day_no)
               FROM public.ramp_risk_stats rs
               JOIN public.client_campaigns c2 ON c2.id = rs.client_campaign_id
             ), '[]'::jsonb),
             'sellers', jsonb_agg(DISTINCT jsonb_build_object(
                 'employee_name', o.employee_name,
                 'campaign_name', o.campaign_name,
                 'day_no', o.day_no,
                 'cum_sales', o.cum_sales,
                 'threshold_value', o.threshold_value,
                 'created_at', o.created_at
               ))
           ) AS payload
    FROM open_flags o
    JOIN public.employee_master_data l ON l.id = o.leader_id
    WHERE l.work_email IS NOT NULL
      AND coalesce(l.is_active, true) = true
    GROUP BY o.leader_id, l.first_name, l.last_name, l.work_email
  ) q;
$fn$;