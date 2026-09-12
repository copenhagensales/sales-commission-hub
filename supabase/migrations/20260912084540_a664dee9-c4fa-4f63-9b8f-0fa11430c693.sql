-- 1) Adgangsregel for Opstartshold
CREATE OR REPLACE FUNCTION public.can_view_ramp_team()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.am_i_superadmin()
    OR public.is_owner(auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.teams t
      JOIN public.team_clients tc ON tc.team_id = t.id
      JOIN public.client_campaigns cc ON cc.client_id = tc.client_id
      WHERE cc.ramp_enabled = true
        AND (
          t.team_leader_id = public.get_employee_id_for_user(auth.uid())
          OR t.assistant_team_leader_id = public.get_employee_id_for_user(auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.team_assistant_leaders al
            WHERE al.team_id = t.id
              AND al.employee_id = public.get_employee_id_for_user(auth.uid())
          )
        )
    )
$function$;

-- 2) Observerede risikotal, beregnet af data
CREATE TABLE public.ramp_risk_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_campaign_id uuid NOT NULL REFERENCES public.client_campaigns(id),
  day_no int NOT NULL CHECK (day_no IN (10, 15)),
  threshold_p25 numeric NOT NULL,
  n_below int NOT NULL,
  n_below_stopped int NOT NULL,
  n_above int NOT NULL,
  n_above_stopped int NOT NULL,
  curve_version int NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_campaign_id, day_no)
);

GRANT SELECT ON public.ramp_risk_stats TO authenticated;
GRANT ALL ON public.ramp_risk_stats TO service_role;

ALTER TABLE public.ramp_risk_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaders can read ramp risk stats"
ON public.ramp_risk_stats
FOR SELECT
TO authenticated
USING (public.can_view_ramp_team());

CREATE POLICY "Service role manages ramp risk stats"
ON public.ramp_risk_stats
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 3) Beregning af de observerede tal
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
           e.employment_start_date,
           e.employment_end_date,
           lower(coalesce(e.work_email, e.private_email)) AS email
    FROM public.employee_master_data e
    WHERE e.employment_start_date IS NOT NULL
      AND coalesce(e.work_email, e.private_email) IS NOT NULL
  ),
  days AS (
    SELECT s.id, s.email, s.employment_end_date, d::date AS work_date, day_no
    FROM sellers s
    CROSS JOIN LATERAL (
      SELECT d, row_number() OVER (ORDER BY d) AS day_no
      FROM generate_series(s.employment_start_date::timestamp,
                           s.employment_start_date::timestamp + interval '150 days',
                           interval '1 day') d
      WHERE extract(isodow FROM d) < 6
        AND NOT EXISTS (SELECT 1 FROM public.danish_holiday h WHERE h.date = d::date)
    ) w
    WHERE day_no <= 40
  ),
  d1 AS (SELECT id, work_date AS dt FROM days WHERE day_no = 1),
  d40 AS (SELECT id, work_date AS dt FROM days WHERE day_no = 40),
  cohort AS (
    SELECT s.id, s.email, s.employment_end_date, f.dt AS date1, l.dt AS date40
    FROM sellers s
    JOIN d1 f ON f.id = s.id
    JOIN d40 l ON l.id = s.id
    WHERE l.dt < current_date
      AND v_coverage_from <= f.dt
      AND EXISTS (
        SELECT 1 FROM public.sales sa
        WHERE sa.client_campaign_id = p_campaign
          AND sa.agent_email = s.email
      )
  ),
  points AS (
    SELECT c.id,
           cp.day_no,
           (SELECT work_date FROM days dd WHERE dd.id = c.id AND dd.day_no = cp.day_no) AS measure_date,
           c.date1,
           c.email,
           c.employment_end_date,
           (c.employment_end_date IS NOT NULL AND c.employment_end_date < c.date40) AS stopped
    FROM cohort c
    CROSS JOIN (VALUES (10), (15)) AS cp(day_no)
  ),
  measured AS (
    SELECT p.day_no,
           p.stopped,
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
    -- Kun saelgere der stadig var ansat paa selve maalepunktet
    WHERE p.measure_date IS NOT NULL
      AND (p.employment_end_date IS NULL OR p.employment_end_date >= p.measure_date)
  ),
  agg AS (
    SELECT day_no,
           max(p25) AS p25,
           count(*) FILTER (WHERE cum_sales < p25) AS n_below,
           count(*) FILTER (WHERE cum_sales < p25 AND stopped) AS n_below_stopped,
           count(*) FILTER (WHERE cum_sales >= p25) AS n_above,
           count(*) FILTER (WHERE cum_sales >= p25 AND stopped) AS n_above_stopped
    FROM measured
    WHERE p25 IS NOT NULL
    GROUP BY day_no
  ),
  upsert AS (
    INSERT INTO public.ramp_risk_stats
      (client_campaign_id, day_no, threshold_p25, n_below, n_below_stopped, n_above, n_above_stopped, curve_version, computed_at)
    SELECT p_campaign, day_no, p25, n_below, n_below_stopped, n_above, n_above_stopped, v_version, now()
    FROM agg
    ON CONFLICT (client_campaign_id, day_no) DO UPDATE
      SET threshold_p25 = excluded.threshold_p25,
          n_below = excluded.n_below,
          n_below_stopped = excluded.n_below_stopped,
          n_above = excluded.n_above,
          n_above_stopped = excluded.n_above_stopped,
          curve_version = excluded.curve_version,
          computed_at = excluded.computed_at
    RETURNING 1
  )
  SELECT count(*)::int INTO v_rows FROM upsert;

  RETURN v_rows;
END;
$function$;

-- 4) Handlingsplaner paa enhver saelger, ikke kun paa et flag
ALTER TABLE public.ramp_flag_action ALTER COLUMN flag_id DROP NOT NULL;
ALTER TABLE public.ramp_flag_action ADD COLUMN IF NOT EXISTS employee_id uuid;

UPDATE public.ramp_flag_action a
SET employee_id = f.employee_id
FROM public.ramp_risk_flag f
WHERE a.flag_id = f.id AND a.employee_id IS NULL;

DELETE FROM public.ramp_flag_action WHERE employee_id IS NULL;

ALTER TABLE public.ramp_flag_action ALTER COLUMN employee_id SET NOT NULL;
ALTER TABLE public.ramp_flag_action
  ADD CONSTRAINT ramp_flag_action_employee_fk
  FOREIGN KEY (employee_id) REFERENCES public.employee_master_data(id);

CREATE INDEX IF NOT EXISTS idx_ramp_flag_action_employee ON public.ramp_flag_action(employee_id, performed_at DESC);

DROP POLICY IF EXISTS "Leaders can log ramp flag actions" ON public.ramp_flag_action;
DROP POLICY IF EXISTS "Leaders can read ramp flag actions" ON public.ramp_flag_action;

CREATE POLICY "Leaders can read ramp actions"
ON public.ramp_flag_action
FOR SELECT
TO authenticated
USING (
  public.can_view_ramp_team()
  AND employee_id IS DISTINCT FROM public.get_employee_id_for_user(auth.uid())
);

CREATE POLICY "Leaders can log ramp actions"
ON public.ramp_flag_action
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_view_ramp_team()
  AND performed_by = public.get_employee_id_for_user(auth.uid())
  AND employee_id IS DISTINCT FROM public.get_employee_id_for_user(auth.uid())
);

-- 5) Overblik over alle saelgere i deres foerste 40 arbejdsdage
CREATE OR REPLACE FUNCTION public.get_ramp_team_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := public.get_employee_id_for_user(auth.uid());
  v_all boolean := public.is_owner(auth.uid())
                   OR public.am_i_superadmin()
                   OR public.has_role(auth.uid(), 'admin');
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
           lower(coalesce(e.work_email, e.private_email)) AS email,
           trim(concat_ws(' ', e.first_name, e.last_name)) AS employee_name,
           public.ramp_workday_no(en.start_date, (now() AT TIME ZONE 'Europe/Copenhagen')::date) AS day_no
    FROM public.employee_ramp_enrollment en
    JOIN public.employee_master_data e ON e.id = en.employee_id
    JOIN public.client_campaigns cc ON cc.id = en.client_campaign_id AND cc.ramp_enabled = true
    WHERE coalesce(e.is_active, true) = true
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
  detail AS (
    SELECT a.employee_id,
           a.employee_name,
           a.day_no,
           cc.name AS campaign_name,
           (SELECT count(*) FROM public.sales sa
              WHERE sa.client_campaign_id = a.client_campaign_id
                AND sa.agent_email = a.email
                AND (sa.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date >= a.start_date
                AND (sa.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date
                    <= (now() AT TIME ZONE 'Europe/Copenhagen')::date
           )::int AS cum_sales,
           c.p25, c.p50, c.p75,
           f.id AS flag_id,
           f.created_at AS flag_created_at,
           CASE WHEN f.id IS NULL THEN NULL
                ELSE greatest(0, (date_part('epoch', now() - f.created_at) / 86400)::int)
           END AS flag_days_open,
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
    LEFT JOIN public.ramp_risk_flag f
      ON f.employee_id = a.employee_id AND f.status = 'open'
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'employee_id', d.employee_id,
           'employee_name', d.employee_name,
           'campaign_name', d.campaign_name,
           'day_no', d.day_no,
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
           'actions', d.actions
         )), '[]'::jsonb)
    INTO v_result
  FROM detail d;

  RETURN v_result;
END;
$function$;

-- 6) Natligt job: beregn ogsaa risikotallene den 1. i maaneden
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
           sa.client_campaign_id,
           e.employment_start_date,
           l.curve_version
    FROM public.employee_master_data e
    JOIN public.sales sa
      ON sa.agent_email = lower(coalesce(e.work_email, e.private_email))
    JOIN latest l ON l.client_campaign_id = sa.client_campaign_id
    WHERE e.employment_start_date IS NOT NULL
      AND coalesce(e.is_active, true) = true
      AND public.ramp_workday_no(e.employment_start_date,
            (now() AT TIME ZONE 'Europe/Copenhagen')::date) BETWEEN 1 AND 40
      AND NOT EXISTS (
        SELECT 1 FROM public.employee_ramp_enrollment en WHERE en.employee_id = e.id
      )
    ORDER BY e.id, sa.sale_datetime
  ),
  ins AS (
    INSERT INTO public.employee_ramp_enrollment
      (employee_id, client_campaign_id, start_date, curve_version)
    SELECT employee_id, client_campaign_id, employment_start_date, curve_version
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

-- 7) Mail-payload: brug de beregnede tal i stedet for indtastede
CREATE OR REPLACE FUNCTION public.ramp_risk_mail_payload()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;