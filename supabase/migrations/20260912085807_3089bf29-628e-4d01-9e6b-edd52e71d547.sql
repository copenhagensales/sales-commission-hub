-- ============================================================
-- "Se som": serverside laesekontekst for superadmins.
-- Der udstedes ALDRIG tokens eller sessions for andre brugere.
-- ============================================================
CREATE TABLE public.admin_view_as (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id uuid NOT NULL,
  target_employee_id uuid NOT NULL REFERENCES public.employee_master_data(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 minutes'),
  ended_at timestamptz
);

CREATE INDEX idx_admin_view_as_active ON public.admin_view_as (admin_user_id, ended_at, expires_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.admin_view_as TO authenticated;
GRANT ALL ON public.admin_view_as TO service_role;

ALTER TABLE public.admin_view_as ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins read own view-as rows"
ON public.admin_view_as FOR SELECT TO authenticated
USING (admin_user_id = auth.uid() AND public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmins start own view-as"
ON public.admin_view_as FOR INSERT TO authenticated
WITH CHECK (
  admin_user_id = auth.uid()
  AND public.is_superadmin(auth.uid())
  -- Man maa ikke se som en anden superadmin
  AND NOT EXISTS (
    SELECT 1 FROM public.employee_master_data e
    WHERE e.id = target_employee_id
      AND (
        public.is_superadmin(e.auth_user_id)
        OR EXISTS (
          SELECT 1 FROM public.superadmins sa
          WHERE sa.is_active = true
            AND lower(sa.email) IN (lower(coalesce(e.work_email, '')), lower(coalesce(e.private_email, '')))
        )
      )
  )
  AND EXISTS (
    SELECT 1 FROM public.employee_master_data e
    WHERE e.id = target_employee_id AND coalesce(e.is_active, true) = true
  )
);

CREATE POLICY "Superadmins end own view-as"
ON public.admin_view_as FOR UPDATE TO authenticated
USING (admin_user_id = auth.uid() AND public.is_superadmin(auth.uid()))
WITH CHECK (admin_user_id = auth.uid() AND public.is_superadmin(auth.uid()));

CREATE POLICY "Service role manages view-as"
ON public.admin_view_as FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- Kerne-hjaelpere.
--
-- NB til den naeste der bygger noget i Stork: brug
-- public.effective_employee_id() og public.effective_roles()
-- i stedet for get_employee_id_for_user(auth.uid()) / auth.uid(),
-- saa din funktion ogsaa virker naar en superadmin ser systemet
-- som en anden bruger. Funktioner der ikke bruger hjaelperne,
-- viser fortsat superadminens egne data.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.view_as_target()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT v.target_employee_id
  FROM public.admin_view_as v
  WHERE v.admin_user_id = auth.uid()
    AND v.ended_at IS NULL
    AND v.expires_at > now()
    AND public.is_superadmin(auth.uid())
  ORDER BY v.started_at DESC
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.is_view_as_active()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.view_as_target() IS NOT NULL
$function$;

CREATE OR REPLACE FUNCTION public.effective_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT coalesce(public.view_as_target(), public.get_employee_id_for_user(auth.uid()))
$function$;

CREATE OR REPLACE FUNCTION public.effective_auth_user_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN public.view_as_target() IS NULL THEN auth.uid()
    ELSE (SELECT e.auth_user_id FROM public.employee_master_data e WHERE e.id = public.view_as_target())
  END
$function$;

-- Rollerne for den person systemet svarer som.
-- Under "se som" indgaar superadmin ALDRIG — "se som" maa ikke give
-- mere adgang end maalpersonen selv har.
CREATE OR REPLACE FUNCTION public.effective_roles()
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT array_remove(array(
    SELECT DISTINCT r FROM (
      SELECT lower(e.job_title) AS r
      FROM public.employee_master_data e
      WHERE e.id = public.effective_employee_id()
      UNION
      SELECT lower(sr.role::text)
      FROM public.system_roles sr
      WHERE sr.user_id = public.effective_auth_user_id()
      UNION
      SELECT lower(ur.role::text)
      FROM public.user_roles ur
      WHERE ur.user_id = public.effective_auth_user_id()
      UNION
      SELECT 'superadmin'
      WHERE public.view_as_target() IS NULL AND public.is_superadmin(auth.uid())
    ) q
  ), NULL)
$function$;

CREATE OR REPLACE FUNCTION public.effective_is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.view_as_target() IS NULL AND public.is_superadmin(auth.uid())
$function$;

CREATE OR REPLACE FUNCTION public.effective_is_owner()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 'ejer' = ANY (public.effective_roles())
$function$;

CREATE OR REPLACE FUNCTION public.effective_is_teamleder_or_above()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.effective_roles() && ARRAY[
    'ejer',
    'teamleder',
    'assisterende teamleder',
    'assisterende teamleder fm',
    'fieldmarketing leder',
    'rekruttering'
  ]
$function$;

CREATE OR REPLACE FUNCTION public.effective_has_app_role(_role text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT lower(_role) = ANY (public.effective_roles())
$function$;

-- ------------------------------------------------------------
-- Opstartsfunktionerne bruger nu hjaelperne
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_ramp()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_employee_id uuid := public.effective_employee_id();
BEGIN
  IF v_employee_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  RETURN public.get_ramp_for_employee(v_employee_id);
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
             WHERE sa.client_campaign_id = v_enroll.client_campaign_id
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

CREATE OR REPLACE FUNCTION public.can_view_ramp_risk_flags()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.effective_is_teamleder_or_above()
      OR public.effective_is_owner()
      OR public.effective_is_superadmin()
$function$;

CREATE OR REPLACE FUNCTION public.can_view_ramp_team()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.effective_is_superadmin()
    OR public.effective_is_owner()
    OR public.effective_has_app_role('admin')
    OR EXISTS (
      SELECT 1
      FROM public.teams t
      JOIN public.team_clients tc ON tc.team_id = t.id
      JOIN public.client_campaigns cc ON cc.client_id = tc.client_id
      WHERE cc.ramp_enabled = true
        AND (
          t.team_leader_id = public.effective_employee_id()
          OR t.assistant_team_leader_id = public.effective_employee_id()
          OR EXISTS (
            SELECT 1 FROM public.team_assistant_leaders al
            WHERE al.team_id = t.id
              AND al.employee_id = public.effective_employee_id()
          )
        )
    )
$function$;

CREATE OR REPLACE FUNCTION public.get_ramp_risk_flags()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := public.effective_employee_id();
  v_all boolean := public.effective_is_owner() OR public.effective_is_superadmin();
  v_result jsonb;
BEGIN
  IF NOT public.can_view_ramp_risk_flags() THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.created_at), '[]'::jsonb)
    INTO v_result
  FROM (
    SELECT f.id,
           f.employee_id,
           trim(concat_ws(' ', e.first_name, e.last_name)) AS employee_name,
           cc.name AS campaign_name,
           f.day_no,
           f.cum_sales,
           f.threshold_value,
           c.p75 AS typical_upper,
           c.p50 AS typical_median,
           f.created_at,
           greatest(0, (date_part('epoch', now() - f.created_at) / 86400)::int) AS days_open,
           coalesce((
             SELECT jsonb_agg(jsonb_build_object(
                      'action_type', a.action_type,
                      'performed_at', a.performed_at,
                      'performed_by_name', trim(concat_ws(' ', p.first_name, p.last_name))
                    ) ORDER BY a.performed_at)
             FROM public.ramp_flag_action a
             LEFT JOIN public.employee_master_data p ON p.id = a.performed_by
             WHERE a.flag_id = f.id
           ), '[]'::jsonb) AS actions
    FROM public.ramp_risk_flag f
    JOIN public.employee_master_data e ON e.id = f.employee_id
    LEFT JOIN public.client_campaigns cc ON cc.id = f.client_campaign_id
    LEFT JOIN public.ramp_curve c
      ON c.client_campaign_id = f.client_campaign_id
     AND c.curve_version = f.curve_version
     AND c.day_no = f.day_no
    WHERE f.status = 'open'
      AND f.employee_id IS DISTINCT FROM v_me
      AND (
        v_all
        OR EXISTS (
          SELECT 1
          FROM public.team_members tm
          JOIN public.teams t ON t.id = tm.team_id
          WHERE tm.employee_id = f.employee_id
            AND (
              t.team_leader_id = v_me
              OR t.assistant_team_leader_id = v_me
              OR EXISTS (SELECT 1 FROM public.team_assistant_leaders al
                          WHERE al.team_id = t.id AND al.employee_id = v_me)
            )
        )
      )
  ) x;

  RETURN v_result;
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

-- Sikker liste over mulige maalpersoner (aktive, ikke superadmins)
CREATE OR REPLACE FUNCTION public.view_as_candidates()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.is_superadmin(auth.uid()) THEN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'employee_id', e.id,
             'name', trim(concat_ws(' ', e.first_name, e.last_name)),
             'job_title', e.job_title
           ) ORDER BY e.first_name, e.last_name)
    FROM public.employee_master_data e
    WHERE coalesce(e.is_active, true) = true
      AND NOT public.is_superadmin(e.auth_user_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.superadmins sa
        WHERE sa.is_active = true
          AND lower(sa.email) IN (lower(coalesce(e.work_email, '')), lower(coalesce(e.private_email, '')))
      )
  ), '[]'::jsonb) ELSE '[]'::jsonb END
$function$;

-- Status til banneret
CREATE OR REPLACE FUNCTION public.view_as_status()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT coalesce((
    SELECT jsonb_build_object(
             'id', v.id,
             'active', true,
             'target_employee_id', v.target_employee_id,
             'target_name', trim(concat_ws(' ', e.first_name, e.last_name)),
             'started_at', v.started_at,
             'expires_at', v.expires_at
           )
    FROM public.admin_view_as v
    JOIN public.employee_master_data e ON e.id = v.target_employee_id
    WHERE v.admin_user_id = auth.uid()
      AND v.ended_at IS NULL
      AND v.expires_at > now()
      AND public.is_superadmin(auth.uid())
    ORDER BY v.started_at DESC
    LIMIT 1
  ), jsonb_build_object('active', false))
$function$;