-- =====================================================================
-- Fase 0: fundament for CEO churn-dashboard
-- =====================================================================

-- 1) Settings ---------------------------------------------------------
CREATE TABLE public.churn_dashboard_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  official_horizon_days integer NOT NULL DEFAULT 60,
  official_month_count integer NOT NULL DEFAULT 12,
  target_60d_rate numeric NULL,
  minimum_n integer NOT NULL DEFAULT 15,
  yellow_threshold_pp numeric NOT NULL DEFAULT 5,
  orange_threshold_pp numeric NOT NULL DEFAULT 10,
  material_trend_pp numeric NOT NULL DEFAULT 5,
  benchmark_min_n integer NOT NULL DEFAULT 40,
  benchmark_min_months integer NOT NULL DEFAULT 6,
  timezone text NOT NULL DEFAULT 'Europe/Copenhagen',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.churn_dashboard_settings TO authenticated;
GRANT ALL ON public.churn_dashboard_settings TO service_role;

ALTER TABLE public.churn_dashboard_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read churn settings"
  ON public.churn_dashboard_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can insert churn settings"
  ON public.churn_dashboard_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_above(auth.uid()) OR public.is_owner(auth.uid()));

CREATE POLICY "Managers can update churn settings"
  ON public.churn_dashboard_settings FOR UPDATE TO authenticated
  USING (public.is_manager_or_above(auth.uid()) OR public.is_owner(auth.uid()))
  WITH CHECK (public.is_manager_or_above(auth.uid()) OR public.is_owner(auth.uid()));

CREATE TRIGGER update_churn_dashboard_settings_updated_at
  BEFORE UPDATE ON public.churn_dashboard_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.churn_dashboard_settings (target_60d_rate) VALUES (NULL);

-- 2) Handlingsregister ------------------------------------------------
CREATE TABLE public.churn_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope_type text NOT NULL DEFAULT 'team',
  team_key text NULL,
  team_id uuid NULL,
  leader_id uuid NULL,
  problem_statement text NOT NULL,
  hypothesis text NULL,
  action_description text NOT NULL,
  owner_user_id uuid NULL,
  owner_name text NULL,
  start_date date NOT NULL,
  due_date date NULL,
  expected_effect_pp numeric NULL,
  first_measurable_cohort_month date NULL,
  status text NOT NULL DEFAULT 'Planlagt',
  actual_effect_pp numeric NULL,
  decision text NOT NULL DEFAULT 'Ikke vurderet',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NULL,
  CONSTRAINT churn_actions_scope_type_chk CHECK (scope_type IN ('company','team','leader')),
  CONSTRAINT churn_actions_status_chk CHECK (status IN ('Planlagt','I gang','Afventer moden kohorte','Effekt måles','Afsluttet','Stoppet')),
  CONSTRAINT churn_actions_decision_chk CHECK (decision IN ('Fortsæt','Justér','Skalér','Stop','Ikke vurderet'))
);

CREATE INDEX idx_churn_actions_team_key ON public.churn_actions (team_key);
CREATE INDEX idx_churn_actions_start_date ON public.churn_actions (start_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.churn_actions TO authenticated;
GRANT ALL ON public.churn_actions TO service_role;

ALTER TABLE public.churn_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read churn actions"
  ON public.churn_actions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can insert churn actions"
  ON public.churn_actions FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_above(auth.uid()) OR public.is_owner(auth.uid()));

CREATE POLICY "Managers can update churn actions"
  ON public.churn_actions FOR UPDATE TO authenticated
  USING (public.is_manager_or_above(auth.uid()) OR public.is_owner(auth.uid()))
  WITH CHECK (public.is_manager_or_above(auth.uid()) OR public.is_owner(auth.uid()));

CREATE POLICY "Managers can delete churn actions"
  ON public.churn_actions FOR DELETE TO authenticated
  USING (public.is_manager_or_above(auth.uid()) OR public.is_owner(auth.uid()));

CREATE TRIGGER update_churn_actions_updated_at
  BEFORE UPDATE ON public.churn_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Team-normalisering ------------------------------------------------
CREATE OR REPLACE FUNCTION public.churn_normalize_team(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_name IS NULL OR btrim(p_name) = '' THEN NULL
    WHEN lower(p_name) LIKE '%eesy fm%' THEN 'Eesy FM'
    WHEN lower(p_name) LIKE '%eesy tm%' THEN 'Eesy TM'
    WHEN lower(p_name) LIKE '%yousee fm%' THEN 'YouSee FM'
    WHEN lower(p_name) LIKE '%fieldmarketing%' THEN 'Fieldmarketing'
    WHEN lower(p_name) LIKE '%relatel%' THEN 'Relatel'
    WHEN lower(p_name) LIKE '%tdc erhverv%' THEN 'TDC Erhverv'
    WHEN lower(p_name) LIKE '%united%' THEN 'United'
    WHEN lower(p_name) LIKE '%stab%' THEN 'Stab'
    ELSE btrim(p_name)
  END
$$;

-- 4) Renset ansættelsesforløb-view ------------------------------------
CREATE OR REPLACE VIEW public.v_employment_spells_clean
WITH (security_invoker = false)
AS
WITH emd AS (
  SELECT
    e.id AS employee_id,
    btrim(coalesce(e.first_name,'') || ' ' || coalesce(e.last_name,'')) AS employee_name,
    e.employment_start_date AS start_date,
    CASE WHEN e.is_active THEN NULL ELSE e.employment_end_date END AS exit_date,
    e.is_active,
    e.is_staff_employee,
    e.job_title,
    coalesce(t_direct.name, t_member.name, t_last.name) AS raw_team_name,
    coalesce(e.team_id, tm.team_id, e.last_team_id) AS team_id,
    coalesce(t_direct.team_leader_id, t_member.team_leader_id, t_last.team_leader_id) AS current_leader_id
  FROM public.employee_master_data e
  LEFT JOIN public.teams t_direct ON t_direct.id = e.team_id
  LEFT JOIN LATERAL (
    SELECT team_id FROM public.team_members WHERE employee_id = e.id ORDER BY created_at LIMIT 1
  ) tm ON true
  LEFT JOIN public.teams t_member ON t_member.id = tm.team_id
  LEFT JOIN public.teams t_last ON t_last.id = e.last_team_id
),
emd_spells AS (
  SELECT
    md5('emd:' || employee_id::text)::uuid AS employment_spell_id,
    employee_id,
    employee_name,
    start_date,
    exit_date,
    is_active,
    is_staff_employee,
    job_title,
    public.churn_normalize_team(raw_team_name) AS team_name,
    team_id,
    current_leader_id,
    'employee_master_data'::text AS source,
    EXISTS (
      SELECT 1 FROM public.historical_employment h
      WHERE lower(btrim(h.employee_name)) = lower(emd.employee_name)
    ) AS has_historical_twin
  FROM emd
),
he_spells AS (
  SELECT
    md5('he:' || h.id::text)::uuid AS employment_spell_id,
    NULL::uuid AS employee_id,
    btrim(h.employee_name) AS employee_name,
    h.start_date,
    h.end_date AS exit_date,
    false AS is_active,
    NULL::boolean AS is_staff_employee,
    NULL::text AS job_title,
    public.churn_normalize_team(h.team_name) AS team_name,
    NULL::uuid AS team_id,
    NULL::uuid AS current_leader_id,
    'historical_employment'::text AS source,
    false AS has_historical_twin
  FROM public.historical_employment h
),
unioned AS (
  SELECT * FROM he_spells
  UNION ALL
  SELECT employment_spell_id, employee_id, employee_name, start_date, exit_date, is_active,
         is_staff_employee, job_title, team_name, team_id, current_leader_id, source, has_historical_twin
  FROM emd_spells
)
SELECT
  u.employment_spell_id,
  u.employee_id,
  u.employee_name,
  u.start_date,
  u.exit_date,
  u.is_active,
  u.source,
  u.team_name AS team_at_start_name,
  u.team_id AS current_team_id,
  u.current_leader_id,
  NULL::uuid AS leader_at_start_id,
  NULL::text AS leader_at_start_name,
  NULL::text AS employment_type,
  NULL::uuid AS campaign_id,
  NULL::text AS campaign_name,
  NULL::text AS recruitment_source,
  'Ukendt'::text AS exit_reason_category,
  NULL::text AS exit_reason_detail,
  CASE
    WHEN u.source = 'employee_master_data' AND NOT u.is_active AND u.has_historical_twin THEN 'duplicate'
    WHEN u.start_date IS NULL THEN 'missing_start_date'
    WHEN u.exit_date IS NOT NULL AND u.exit_date < u.start_date THEN 'exit_before_start'
    WHEN coalesce(u.team_name,'') = 'Stab' OR u.is_staff_employee IS TRUE THEN 'outside_scope'
    ELSE 'valid'
  END AS data_quality_status,
  (u.start_date IS NOT NULL AND u.start_date > ((now() AT TIME ZONE 'Europe/Copenhagen')::date)) AS is_future_start,
  CASE
    WHEN u.start_date IS NULL THEN NULL
    ELSE ((now() AT TIME ZONE 'Europe/Copenhagen')::date - u.start_date)
  END AS tenure_days_as_of,
  CASE
    WHEN u.start_date IS NULL OR u.exit_date IS NULL THEN NULL
    ELSE (u.exit_date - u.start_date)
  END AS exit_day
FROM unioned u;

REVOKE ALL ON public.v_employment_spells_clean FROM anon, authenticated;
GRANT SELECT ON public.v_employment_spells_clean TO service_role;

-- 5) Central metrics-funktion -----------------------------------------
CREATE OR REPLACE FUNCTION public.get_churn_dashboard_metrics(
  p_as_of_date date DEFAULT NULL,
  p_horizon_days integer DEFAULT NULL,
  p_month_count integer DEFAULT NULL,
  p_team_keys text[] DEFAULT NULL,
  p_leader_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.churn_dashboard_settings;
  v_as_of date;
  v_horizon integer;
  v_months integer;
  v_min_n integer;
  v_target numeric;
  v_result jsonb;
BEGIN
  IF NOT (public.is_manager_or_above(auth.uid()) OR public.is_owner(auth.uid())) THEN
    RAISE EXCEPTION 'Ingen adgang til churn-dashboard metrics';
  END IF;

  SELECT * INTO v_settings FROM public.churn_dashboard_settings ORDER BY created_at LIMIT 1;

  v_as_of   := coalesce(p_as_of_date, (now() AT TIME ZONE coalesce(v_settings.timezone,'Europe/Copenhagen'))::date);
  v_horizon := coalesce(p_horizon_days, v_settings.official_horizon_days, 60);
  v_months  := coalesce(p_month_count, v_settings.official_month_count, 12);
  v_min_n   := coalesce(v_settings.minimum_n, 15);
  v_target  := v_settings.target_60d_rate;

  WITH spells AS (
    SELECT
      s.*,
      coalesce(s.team_at_start_name, 'Øvrige / ukendt team') AS team_key,
      date_trunc('month', s.start_date)::date AS start_month
    FROM public.v_employment_spells_clean s
  ),
  valid_spells AS (
    SELECT * FROM spells
    WHERE data_quality_status = 'valid'
      AND is_future_start = false
      AND start_date IS NOT NULL
      AND start_date <= v_as_of
      AND (p_team_keys IS NULL OR team_key = ANY(p_team_keys))
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
  mature_sel AS (
    SELECT m, row_number() OVER (ORDER BY m DESC) AS rn
    FROM mature
  ),
  chosen AS (
    SELECT m, rn FROM mature_sel WHERE rn <= v_months
  ),
  base AS (
    SELECT
      v.*,
      c.rn,
      CASE WHEN v.exit_day IS NOT NULL AND v.exit_day BETWEEN 0 AND v_horizon THEN 1 ELSE 0 END AS is_exit,
      CASE WHEN v.exit_day BETWEEN 0 AND 7 THEN 1 ELSE 0 END AS b0_7,
      CASE WHEN v.exit_day BETWEEN 8 AND 14 THEN 1 ELSE 0 END AS b8_14,
      CASE WHEN v.exit_day BETWEEN 15 AND 30 THEN 1 ELSE 0 END AS b15_30,
      CASE WHEN v.exit_day BETWEEN 31 AND 60 THEN 1 ELSE 0 END AS b31_60
    FROM valid_spells v
    JOIN chosen c ON c.m = date_trunc('month', v.start_date)::date
  ),
  company AS (
    SELECT
      count(*)::int AS starters,
      coalesce(sum(is_exit),0)::int AS exits,
      coalesce(sum(b0_7),0)::int AS b0_7,
      coalesce(sum(b8_14),0)::int AS b8_14,
      coalesce(sum(b15_30),0)::int AS b15_30,
      coalesce(sum(b31_60),0)::int AS b31_60,
      coalesce(sum(CASE WHEN rn <= 3 THEN 1 ELSE 0 END),0)::int AS recent_n,
      coalesce(sum(CASE WHEN rn <= 3 THEN is_exit ELSE 0 END),0)::int AS recent_x,
      coalesce(sum(CASE WHEN rn BETWEEN 4 AND 6 THEN 1 ELSE 0 END),0)::int AS prev_n,
      coalesce(sum(CASE WHEN rn BETWEEN 4 AND 6 THEN is_exit ELSE 0 END),0)::int AS prev_x
    FROM base
  ),
  monthly AS (
    SELECT date_trunc('month', start_date)::date AS m,
           count(*)::int AS starters,
           coalesce(sum(is_exit),0)::int AS exits
    FROM base GROUP BY 1
  ),
  team_month AS (
    SELECT team_key, date_trunc('month', start_date)::date AS m,
           count(*)::int AS starters,
           coalesce(sum(is_exit),0)::int AS exits,
           coalesce(sum(b0_7),0)::int AS b0_7,
           coalesce(sum(b8_14),0)::int AS b8_14,
           coalesce(sum(b15_30),0)::int AS b15_30,
           coalesce(sum(b31_60),0)::int AS b31_60
    FROM base GROUP BY 1,2
  ),
  team_tot AS (
    SELECT team_key,
           count(*)::int AS starters,
           coalesce(sum(is_exit),0)::int AS exits,
           coalesce(sum(b0_7),0)::int AS b0_7,
           coalesce(sum(b8_14),0)::int AS b8_14,
           coalesce(sum(b15_30),0)::int AS b15_30,
           coalesce(sum(b31_60),0)::int AS b31_60,
           coalesce(sum(CASE WHEN rn <= 3 THEN 1 ELSE 0 END),0)::int AS recent_n,
           coalesce(sum(CASE WHEN rn <= 3 THEN is_exit ELSE 0 END),0)::int AS recent_x,
           coalesce(sum(CASE WHEN rn BETWEEN 4 AND 6 THEN 1 ELSE 0 END),0)::int AS prev_n,
           coalesce(sum(CASE WHEN rn BETWEEN 4 AND 6 THEN is_exit ELSE 0 END),0)::int AS prev_x,
           count(DISTINCT date_trunc('month', start_date))::int AS months_with_data
    FROM base GROUP BY 1
  ),
  leader_tot AS (
    SELECT coalesce(leader_at_start_id::text, 'unknown') AS leader_key,
           count(*)::int AS starters,
           coalesce(sum(is_exit),0)::int AS exits
    FROM base GROUP BY 1
  ),
  h14 AS (
    SELECT count(*)::int AS n,
           coalesce(sum(CASE WHEN exit_day BETWEEN 0 AND 14 THEN 1 ELSE 0 END),0)::int AS x
    FROM valid_spells
    WHERE ((date_trunc('month', start_date)::date + interval '1 month - 1 day')::date + 14) <= v_as_of
  ),
  h30 AS (
    SELECT count(*)::int AS n,
           coalesce(sum(CASE WHEN exit_day BETWEEN 0 AND 30 THEN 1 ELSE 0 END),0)::int AS x
    FROM valid_spells
    WHERE ((date_trunc('month', start_date)::date + interval '1 month - 1 day')::date + 30) <= v_as_of
  ),
  observation AS (
    SELECT
      count(*) FILTER (WHERE exit_date IS NULL AND tenure_days_as_of BETWEEN 0 AND 13)::int AS d0_13,
      count(*) FILTER (WHERE exit_date IS NULL AND tenure_days_as_of BETWEEN 14 AND 29)::int AS d14_29,
      count(*) FILTER (WHERE exit_date IS NULL AND tenure_days_as_of BETWEEN 30 AND 59)::int AS d30_59
    FROM valid_spells
  ),
  quality AS (
    SELECT
      count(*)::int AS total_rows,
      count(*) FILTER (WHERE data_quality_status = 'duplicate')::int AS duplicates,
      count(*) FILTER (WHERE data_quality_status = 'missing_start_date')::int AS missing_start_date,
      count(*) FILTER (WHERE data_quality_status = 'exit_before_start')::int AS exit_before_start,
      count(*) FILTER (WHERE data_quality_status = 'outside_scope')::int AS outside_scope,
      count(*) FILTER (WHERE data_quality_status = 'valid' AND is_future_start)::int AS future_start,
      count(*) FILTER (WHERE data_quality_status = 'valid' AND NOT is_future_start)::int AS valid_spells_n,
      count(*) FILTER (WHERE data_quality_status = 'valid' AND NOT is_future_start AND team_at_start_name IS NULL)::int AS unknown_team,
      count(*) FILTER (WHERE data_quality_status = 'valid' AND NOT is_future_start AND leader_at_start_id IS NULL)::int AS unknown_leader,
      count(*) FILTER (WHERE data_quality_status = 'valid' AND NOT is_future_start AND exit_date IS NOT NULL AND exit_reason_category = 'Ukendt')::int AS unknown_exit_reason,
      count(*) FILTER (WHERE data_quality_status = 'valid' AND NOT is_future_start AND exit_date IS NOT NULL)::int AS total_exits_all
    FROM spells
  ),
  headcount AS (
    SELECT
      count(*) FILTER (WHERE is_active)::int AS all_active_profiles,
      count(*) FILTER (WHERE is_active AND is_future_start)::int AS upcoming_starters,
      count(*) FILTER (WHERE is_active AND data_quality_status = 'outside_scope')::int AS staff_out_of_scope,
      count(*) FILTER (WHERE is_active AND data_quality_status IN ('missing_start_date','exit_before_start','duplicate'))::int AS invalid_dates,
      count(*) FILTER (WHERE is_active AND data_quality_status = 'valid' AND NOT is_future_start)::int AS official_headcount
    FROM spells
  )
  SELECT jsonb_build_object(
    'as_of_date', v_as_of,
    'as_of_source', 'server_copenhagen_date',
    'timezone', coalesce(v_settings.timezone,'Europe/Copenhagen'),
    'settings', jsonb_build_object(
      'official_horizon_days', v_horizon,
      'official_month_count', v_months,
      'target_60d_rate', v_target,
      'minimum_n', v_min_n,
      'yellow_threshold_pp', v_settings.yellow_threshold_pp,
      'orange_threshold_pp', v_settings.orange_threshold_pp,
      'material_trend_pp', v_settings.material_trend_pp,
      'benchmark_min_n', v_settings.benchmark_min_n,
      'benchmark_min_months', v_settings.benchmark_min_months
    ),
    'mature_months', (SELECT coalesce(jsonb_agg(m ORDER BY m), '[]'::jsonb) FROM chosen),
    'mature_months_available', (SELECT count(*)::int FROM mature),
    'latest_mature_month', (SELECT max(m) FROM chosen),
    'company', (SELECT to_jsonb(c) FROM company c),
    'monthly', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.m), '[]'::jsonb) FROM monthly x),
    'team_totals', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.exits DESC), '[]'::jsonb) FROM team_tot x),
    'team_months', (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) FROM team_month x),
    'leader_totals', (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) FROM leader_tot x),
    'leader_dimension_available', false,
    'exit_reason_available', false,
    'horizon_14', (SELECT to_jsonb(x) FROM h14 x),
    'horizon_30', (SELECT to_jsonb(x) FROM h30 x),
    'observation', (SELECT to_jsonb(x) FROM observation x),
    'upcoming_starters', (SELECT upcoming_starters FROM headcount),
    'quality', (SELECT to_jsonb(x) FROM quality x),
    'headcount_bridge', (SELECT to_jsonb(x) FROM headcount x)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_churn_dashboard_metrics(date, integer, integer, text[], uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_churn_dashboard_metrics(date, integer, integer, text[], uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_churn_dashboard_metrics(date, integer, integer, text[], uuid[]) TO service_role;