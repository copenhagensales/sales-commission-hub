-- Pulsen milepæle v2: occurred_at = tidspunktet for salget, der krydsede tærsklen.
-- Personlige milepæle har intet team_id (team afgøres ved læsning via team_members).
-- Stribe via fælles public.sales_streak_runs. Teamtrin pr. team fra pulsen_config.team_day_steps. Ny type team_record.
-- Læser kun salg/stamdata/config; skriver intet.
CREATE OR REPLACE FUNCTION public.pulsen_milestone_candidates_v2(p_from date, p_to date, p_types text[])
RETURNS TABLE(milestone_type text, employee_id uuid, team_id uuid, period_key text, level integer, value numeric, previous numeric, occurred_on date, occurred_at timestamptz, tier integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
WITH cfg AS (
  SELECT
    COALESCE((SELECT (value)::text::int FROM pulsen_config WHERE key='record_min_sales_days'),20) AS min_days,
    COALESCE((SELECT (value)::text::int FROM pulsen_config WHERE key='record_min_weeks'),8) AS min_weeks,
    COALESCE((SELECT (value)::text::int FROM pulsen_config WHERE key='record_min_pay_periods'),3) AS min_periods,
    COALESCE((SELECT (value)::text::int FROM pulsen_config WHERE key='first_sale_max_days_since_start'),60) AS first_max,
    COALESCE((SELECT (value)::text::int FROM pulsen_config WHERE key='streak_step'),10) AS streak_step,
    COALESCE((SELECT (value)::text::int FROM pulsen_config WHERE key='team_record_min_days'),40) AS team_min_days,
    ((p_to + 1)::timestamp AT TIME ZONE 'Europe/Copenhagen') AS t_end,
    ((p_from - 40)::timestamp AT TIME ZONE 'Europe/Copenhagen') AS t_roll
),
club AS (
  SELECT (jsonb_array_elements_text(COALESCE((SELECT value FROM pulsen_config WHERE key='club_levels'),'[50000,100000,200000]'::jsonb)))::numeric AS lvl
),
steps AS (
  SELECT (kv.key)::uuid AS team_id, s.ord::int AS tier, (s.v)::int AS lvl
  FROM jsonb_each(COALESCE((SELECT value FROM pulsen_config WHERE key='team_day_steps'),'{}'::jsonb)) kv,
       jsonb_array_elements_text(kv.value) WITH ORDINALITY s(v, ord)
),
em AS MATERIALIZED (
  SELECT a.email, public.resolve_sales_employee_id(a.email) AS emp
  FROM (SELECT DISTINCT agent_email AS email FROM sales WHERE agent_email IS NOT NULL) a
),
-- Salg pr. medarbejder (samme definition som recalc_employee_profile_stats), ét niveau pr. salg
ss AS MATERIALIZED (
  SELECT em.emp, sa.id AS sale_id, sa.sale_datetime AS ts, (sa.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date AS d,
         COALESCE(SUM(si.mapped_commission),0) AS comm
  FROM sales sa
  JOIN em ON em.email = sa.agent_email
  JOIN employee_master_data e ON e.id = em.emp
  LEFT JOIN sale_items si ON si.sale_id = sa.id AND COALESCE(si.is_cancelled,false) = false
  CROSS JOIN cfg
  WHERE COALESCE(sa.validation_status,'') NOT IN ('rejected','cancelled')
    AND sa.sale_datetime < cfg.t_end
    AND (COALESCE(e.sales_history_from, e.employment_start_date) IS NULL
         OR (sa.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date >= COALESCE(e.sales_history_from, e.employment_start_date))
  GROUP BY 1,2,3,4
),
pm AS MATERIALIZED (SELECT z.d, public.pay_period_start((z.d + time '12:00') AT TIME ZONE 'Europe/Copenhagen')::date AS pp FROM (SELECT DISTINCT d FROM ss) z),
day AS MATERIALIZED (SELECT emp, d, SUM(comm) AS comm, COUNT(*) AS sales FROM ss GROUP BY 1,2),
-- Løbende summer kun for de seneste ~40 dage (dækker uge og lønperiode omkring vinduet)
ssr AS MATERIALIZED (
  SELECT x.*,
    SUM(x.comm) OVER (PARTITION BY x.emp, x.d ORDER BY x.ts, x.sale_id) AS cum_d,
    SUM(x.comm) OVER (PARTITION BY x.emp, x.wk ORDER BY x.ts, x.sale_id) AS cum_w,
    SUM(x.comm) OVER (PARTITION BY x.emp, x.pp ORDER BY x.ts, x.sale_id) AS cum_p
  FROM (SELECT ss.*, to_char(ss.d,'IYYY-"W"IW') AS wk, pm.pp::text AS pp FROM ss JOIN pm ON pm.d = ss.d, cfg WHERE ss.ts >= cfg.t_roll) x
),
-- Første salg
c_first AS (
  SELECT 'first_sale'::text, f.emp, NULL::uuid, f.d::text, 0, NULL::numeric, NULL::numeric, f.d, f.ts, 0
  FROM (SELECT DISTINCT ON (emp) emp, d, ts FROM ss ORDER BY emp, ts, sale_id) f
  JOIN employee_master_data e ON e.id = f.emp, cfg
  WHERE f.d BETWEEN p_from AND p_to AND e.employment_start_date IS NOT NULL
    AND f.d - e.employment_start_date BETWEEN 0 AND cfg.first_max
    AND (e.sales_history_from IS NULL OR e.sales_history_from <= e.employment_start_date)
),
-- Dagsrekord
day_hist AS (
  SELECT d.*, MAX(comm) OVER w AS prev_best, COUNT(*) FILTER (WHERE sales > 0) OVER w AS prev_days
  FROM day d WINDOW w AS (PARTITION BY emp ORDER BY d ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)
),
c_day AS (
  SELECT 'record_day'::text, h.emp, NULL::uuid, h.d::text, 0, h.comm, h.prev_best, h.d,
    (SELECT MIN(r.ts) FROM ssr r WHERE r.emp = h.emp AND r.d = h.d AND r.cum_d > h.prev_best), 0
  FROM day_hist h, cfg
  WHERE h.d BETWEEN p_from AND p_to AND h.prev_days >= cfg.min_days AND h.prev_best > 0 AND h.comm > h.prev_best
),
-- Uge- og lønperioderekord
keys AS (
  SELECT 'record_week'::text AS t, emp, to_char(d,'IYYY-"W"IW') AS k, d, comm FROM day
  UNION ALL
  SELECT 'record_pay_period', dd.emp, pm.pp::text, dd.d, dd.comm FROM day dd JOIN pm ON pm.d = dd.d
),
tot AS (SELECT t, emp, k, SUM(comm) AS total, MIN(d) AS first_d FROM keys GROUP BY 1,2,3),
prev AS (
  SELECT t, emp, k, total,
    MAX(total) OVER w AS prev_best, COUNT(*) FILTER (WHERE total > 0) OVER w AS prev_n
  FROM tot WINDOW w AS (PARTITION BY t, emp ORDER BY first_d ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)
),
c_period AS (
  SELECT x.t, x.emp, NULL::uuid, x.k, 0, x.total, x.prev_best, (x.ts AT TIME ZONE 'Europe/Copenhagen')::date, x.ts, 0
  FROM (
    SELECT p.t, p.emp, p.k, p.total, p.prev_best,
      (SELECT MIN(r.ts) FROM ssr r WHERE r.emp = p.emp
         AND (CASE WHEN p.t = 'record_week' THEN r.wk ELSE r.pp END) = p.k
         AND (CASE WHEN p.t = 'record_week' THEN r.cum_w ELSE r.cum_p END) > p.prev_best) AS ts
    FROM prev p, cfg
    WHERE p.prev_best > 0 AND p.total > p.prev_best
      AND p.prev_n >= CASE WHEN p.t = 'record_week' THEN cfg.min_weeks ELSE cfg.min_periods END
      AND p.t = ANY (CASE WHEN 'record_period' = ANY(p_types) THEN ARRAY['record_week','record_pay_period'] ELSE ARRAY[]::text[] END)
  ) x
  WHERE x.ts IS NOT NULL AND (x.ts AT TIME ZONE 'Europe/Copenhagen')::date BETWEEN p_from AND p_to
),
-- Klub: løbende lønperiodesum krydser niveau; value = periodens sum
c_club AS (
  SELECT 'club'::text, r.emp, NULL::uuid, r.pp, club.lvl::int,
    (SELECT SUM(dd.comm) FROM day dd JOIN pm ON pm.d = dd.d WHERE dd.emp = r.emp AND pm.pp::text = r.pp),
    NULL::numeric, (MIN(r.ts) AT TIME ZONE 'Europe/Copenhagen')::date, MIN(r.ts), 0
  FROM ssr r CROSS JOIN club
  WHERE r.cum_p >= club.lvl AND 'club' = ANY(p_types)
  GROUP BY r.emp, r.pp, club.lvl
  HAVING (MIN(r.ts) AT TIME ZONE 'Europe/Copenhagen')::date BETWEEN p_from AND p_to
),
-- Stribe: fælles regel
streak_in AS (
  SELECT array_agg(emp ORDER BY emp, d) AS a_emp, array_agg(d ORDER BY emp, d) AS a_d, array_agg(comm ORDER BY emp, d) AS a_comm
  FROM day WHERE 'streak' = ANY(p_types)
),
c_streak AS (
  SELECT 'streak'::text, r.emp, NULL::uuid, r.island_start::text, r.pos, r.pos::numeric, NULL::numeric, r.d,
    (SELECT MIN(x.ts) FROM ssr x WHERE x.emp = r.emp AND x.d = r.d AND x.cum_d >= public.sales_streak_min_commission()), 0
  FROM streak_in si, LATERAL public.sales_streak_runs(si.a_emp, si.a_d, si.a_comm, NULL, p_to + 1) r, cfg
  WHERE si.a_emp IS NOT NULL AND r.d BETWEEN p_from AND p_to AND r.pos % cfg.streak_step = 0
),
-- Team og hus: samme tælling som get_sales_aggregates_v2 / kpi sales_count (klientens team)
tss AS MATERIALIZED (
  SELECT sa.id, sa.sale_datetime AS ts, (sa.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date AS d, tc.team_id,
         SUM(CASE WHEN p.counts_as_sale IS NOT FALSE THEN si.quantity ELSE 0 END) AS n
  FROM sales sa JOIN sale_items si ON si.sale_id = sa.id LEFT JOIN products p ON p.id = si.product_id
  LEFT JOIN client_campaigns cc ON cc.id = sa.client_campaign_id LEFT JOIN team_clients tc ON tc.client_id = cc.client_id
  CROSS JOIN cfg
  WHERE COALESCE(sa.validation_status,'approved') NOT IN ('rejected','cancelled')
    AND sa.sale_datetime < cfg.t_end
    AND ('team_day_sales' = ANY(p_types) OR 'team_record' = ANY(p_types) OR 'house_record' = ANY(p_types))
  GROUP BY 1,2,3,4
),
tday AS (SELECT d, team_id, SUM(n) AS n FROM tss GROUP BY 1,2),
tssr AS (
  SELECT t.*, SUM(t.n) OVER (PARTITION BY t.team_id, t.d ORDER BY t.ts, t.id) AS cum_t,
              SUM(t.n) OVER (PARTITION BY t.d ORDER BY t.ts, t.id) AS cum_h
  FROM tss t WHERE t.d BETWEEN p_from AND p_to
),
c_team AS (
  SELECT 'team_day_sales'::text, NULL::uuid, t.team_id, t.d::text, st.lvl, t.n::numeric, NULL::numeric, t.d,
    (SELECT MIN(r.ts) FROM tssr r WHERE r.team_id = t.team_id AND r.d = t.d AND r.cum_t >= st.lvl), st.tier
  FROM tday t JOIN steps st ON st.team_id = t.team_id
  WHERE t.d BETWEEN p_from AND p_to AND t.n >= st.lvl AND 'team_day_sales' = ANY(p_types)
),
tday_h AS (
  SELECT t.*, MAX(n) OVER w AS prev, COUNT(*) FILTER (WHERE n > 0) OVER w AS prev_days
  FROM tday t WHERE t.team_id IS NOT NULL
  WINDOW w AS (PARTITION BY team_id ORDER BY d ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)
),
c_team_rec AS (
  SELECT 'team_record'::text, NULL::uuid, h.team_id, h.d::text, 0, h.n::numeric, h.prev::numeric, h.d,
    (SELECT MIN(r.ts) FROM tssr r WHERE r.team_id = h.team_id AND r.d = h.d AND r.cum_t > h.prev), 0
  FROM tday_h h, cfg
  WHERE h.d BETWEEN p_from AND p_to AND h.prev > 0 AND h.n > h.prev AND h.prev_days >= cfg.team_min_days
    AND 'team_record' = ANY(p_types)
),
house AS (SELECT d, SUM(n) AS n FROM tday GROUP BY 1),
house_h AS (SELECT d, n, MAX(n) OVER (ORDER BY d ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev FROM house),
c_house AS (
  SELECT 'house_record'::text, NULL::uuid, NULL::uuid, h.d::text, 0, h.n::numeric, h.prev::numeric, h.d,
    (SELECT MIN(r.ts) FROM tssr r WHERE r.d = h.d AND r.cum_h > h.prev), 0
  FROM house_h h WHERE h.d BETWEEN p_from AND p_to AND h.prev > 0 AND h.n > h.prev AND 'house_record' = ANY(p_types)
)
SELECT * FROM c_first WHERE 'first_sale' = ANY(p_types)
UNION ALL SELECT * FROM c_day WHERE 'record_day' = ANY(p_types)
UNION ALL SELECT * FROM c_period
UNION ALL SELECT * FROM c_club
UNION ALL SELECT * FROM c_streak
UNION ALL SELECT * FROM c_team
UNION ALL SELECT * FROM c_team_rec
UNION ALL SELECT * FROM c_house
$$;
REVOKE ALL ON FUNCTION public.pulsen_milestone_candidates_v2(date, date, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulsen_milestone_candidates_v2(date, date, text[]) TO service_role;
COMMENT ON FUNCTION public.pulsen_milestone_candidates(date, date, text[]) IS 'DEPRECATED: erstattet af pulsen_milestone_candidates_v2';