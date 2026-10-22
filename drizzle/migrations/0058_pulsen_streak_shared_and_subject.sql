-- Fælles stribe-regel (profilstatistik + Pulsen). Én definition af tærskel og regler.
CREATE OR REPLACE FUNCTION public.sales_streak_min_commission() RETURNS numeric
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path TO 'public' AS $$ SELECT 1500::numeric $$;

-- Input: dagsprovision pr. medarbejder (emp, dansk dato, sum). Output: én række pr. dag i en stribe.
-- Regler: dag tæller ved >= sales_streak_min_commission(); weekend og godkendt fravær (day_off/sick/vacation) springes over.
CREATE OR REPLACE FUNCTION public.sales_streak_runs(p_emp uuid[], p_d date[], p_comm numeric[], p_min date, p_today date)
RETURNS TABLE(emp uuid, d date, pos integer, island_start date, island_end date, island_len integer, is_current boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
WITH day AS (SELECT u.emp, u.d, u.comm FROM unnest(p_emp, p_d, p_comm) AS u(emp, d, comm)),
thr AS (SELECT public.sales_streak_min_commission() AS v),
span AS (SELECT day.emp, GREATEST(MIN(day.d), COALESCE(p_min, MIN(day.d))) AS mn, GREATEST(MAX(day.d), p_today) AS mx FROM day GROUP BY 1),
cal AS (SELECT sp.emp, g::date AS d FROM span sp, generate_series(sp.mn, sp.mx, interval '1 day') g),
abs_days AS (
  SELECT a.employee_id AS emp, g::date AS d
  FROM public.absence_request_v2 a, generate_series(a.start_date, a.end_date, interval '1 day') g
  WHERE a.status = 'approved' AND a.type IN ('day_off', 'sick', 'vacation')
),
marked AS (
  SELECT c.emp, c.d,
    (COALESCE(sd.comm, 0) >= thr.v) AS has_sale,
    CASE WHEN COALESCE(sd.comm, 0) >= thr.v THEN false
         WHEN ad.d IS NOT NULL THEN true
         ELSE EXTRACT(isodow FROM c.d) IN (6, 7) END AS skipped
  FROM cal c CROSS JOIN thr
  LEFT JOIN day sd ON sd.emp = c.emp AND sd.d = c.d
  LEFT JOIN abs_days ad ON ad.emp = c.emp AND ad.d = c.d
),
seq AS (
  SELECT m.emp, m.d, m.has_sale,
         SUM(CASE WHEN m.has_sale THEN 0 ELSE 1 END) OVER (PARTITION BY m.emp ORDER BY m.d) AS grp
  FROM marked m WHERE NOT m.skipped
),
runs AS (
  SELECT s.emp, s.d, s.grp,
    ROW_NUMBER() OVER (PARTITION BY s.emp, s.grp ORDER BY s.d) AS pos,
    COUNT(*) OVER (PARTITION BY s.emp, s.grp) AS len,
    MIN(s.d) OVER (PARTITION BY s.emp, s.grp) AS sd,
    MAX(s.d) OVER (PARTITION BY s.emp, s.grp) AS ed
  FROM seq s WHERE s.has_sale
),
last AS (SELECT r.emp, MAX(r.ed) AS led FROM runs r GROUP BY 1),
cur AS (
  SELECT l.emp, l.led, NOT EXISTS (
    SELECT 1 FROM marked m WHERE m.emp = l.emp AND m.d > l.led AND m.d < p_today AND NOT m.skipped AND NOT m.has_sale
  ) AS ok FROM last l
)
SELECT r.emp, r.d, r.pos::int, r.sd, r.ed, r.len::int, (r.ed = c.led AND c.ok)
FROM runs r JOIN cur c ON c.emp = r.emp
$$;
REVOKE ALL ON FUNCTION public.sales_streak_runs(uuid[], date[], numeric[], date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sales_streak_runs(uuid[], date[], numeric[], date, date) TO service_role;

-- Milepæle: rigtig nøglekolonne til upsert, ny type teamrekord.
ALTER TABLE public.pulsen_milestones
  ADD COLUMN subject_id uuid GENERATED ALWAYS AS (COALESCE(employee_id, team_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED NOT NULL;
DROP INDEX IF EXISTS public.pulsen_milestones_unique_idx;
ALTER TABLE public.pulsen_milestones ADD CONSTRAINT pulsen_milestones_unique UNIQUE (milestone_type, subject_id, period_key, level);
ALTER TABLE public.pulsen_milestones DROP CONSTRAINT pulsen_milestones_milestone_type_check;
ALTER TABLE public.pulsen_milestones ADD CONSTRAINT pulsen_milestones_milestone_type_check CHECK (milestone_type IN
  ('first_sale','record_day','record_week','record_pay_period','club','team_day_sales','team_record','streak','house_record'));
CREATE INDEX IF NOT EXISTS pulsen_milestones_employee_idx ON public.pulsen_milestones (employee_id);

-- Personlige milepæle vises i alle sælgerens teams (afgøres ved læsning via team_members).
DROP POLICY pulsen_milestones_read ON public.pulsen_milestones;
CREATE POLICY pulsen_milestones_read ON public.pulsen_milestones FOR SELECT TO authenticated USING (
  shown_in_house
  OR team_id = ANY (public.pulsen_visible_team_ids())
  OR (employee_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.employee_id = pulsen_milestones.employee_id AND tm.team_id = ANY (public.pulsen_visible_team_ids())))
  OR public.effective_is_owner()
);

-- Upsert (kun service_role). occurred_at og shown_in_house ændres ikke ved gentagne kørsler.
CREATE OR REPLACE FUNCTION public.pulsen_upsert_milestones(p_rows jsonb) RETURNS integer
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public' AS $$
WITH ins AS (
  INSERT INTO public.pulsen_milestones (milestone_type, employee_id, team_id, period_key, level, value, payload, rarity, shown_in_house, occurred_at)
  SELECT r.milestone_type, r.employee_id, r.team_id, r.period_key, r.level, COALESCE(r.value, 0), COALESCE(r.payload, '{}'::jsonb), COALESCE(r.rarity, 0), COALESCE(r.shown_in_house, false), r.occurred_at
  FROM jsonb_to_recordset(p_rows) AS r(milestone_type text, employee_id uuid, team_id uuid, period_key text, level int, value numeric, payload jsonb, rarity int, shown_in_house boolean, occurred_at timestamptz)
  ON CONFLICT (milestone_type, subject_id, period_key, level)
  DO UPDATE SET value = EXCLUDED.value, payload = EXCLUDED.payload, updated_at = now()
  RETURNING 1
) SELECT count(*)::int FROM ins
$$;
REVOKE ALL ON FUNCTION public.pulsen_upsert_milestones(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulsen_upsert_milestones(jsonb) TO service_role;