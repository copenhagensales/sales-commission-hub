-- Pulsen trin 6: kandidat-beregning til milepæle. LÆSER kun salg/stamdata, skriver intet.
-- Salgsdefinition pr. medarbejder = recalc_employee_profile_stats (samme resolver, filtre, lønperiode, stribe-regler).
-- Team-/husdefinition = get_sales_aggregates_v2 / kpi sales_count (quantity, counts_as_sale, klientens team).
CREATE OR REPLACE FUNCTION public.pulsen_milestone_candidates(p_from date, p_to date)
RETURNS TABLE(milestone_type text, employee_id uuid, team_id uuid, period_key text, level integer, value numeric, previous numeric, occurred_on date)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
WITH cfg AS (
  SELECT
    COALESCE((SELECT (value)::text::int FROM pulsen_config WHERE key='record_min_sales_days'),20) AS min_days,
    COALESCE((SELECT (value)::text::int FROM pulsen_config WHERE key='record_min_weeks'),8) AS min_weeks,
    COALESCE((SELECT (value)::text::int FROM pulsen_config WHERE key='record_min_pay_periods'),3) AS min_periods,
    COALESCE((SELECT (value)::text::int FROM pulsen_config WHERE key='first_sale_max_days_since_start'),60) AS first_max,
    COALESCE((SELECT (value)::text::int FROM pulsen_config WHERE key='streak_step'),10) AS streak_step,
    COALESCE((SELECT (value)::text::int FROM pulsen_config WHERE key='team_day_sales_step'),50) AS team_step
),
club AS (
  SELECT (jsonb_array_elements_text(COALESCE((SELECT value FROM pulsen_config WHERE key='club_levels'),'[50000,100000,200000]'::jsonb)))::numeric AS lvl
),
s AS (
  SELECT x.emp, (x.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date AS d, x.sale_id,
         public.pay_period_start(x.sale_datetime) AS pp, x.comm
  FROM (
    SELECT public.resolve_sales_employee_id(sa.agent_email) AS emp, sa.sale_datetime, sa.id AS sale_id,
           COALESCE(si.mapped_commission,0) AS comm
    FROM sales sa
    LEFT JOIN sale_items si ON si.sale_id = sa.id AND COALESCE(si.is_cancelled,false) = false
    WHERE COALESCE(sa.validation_status,'') NOT IN ('rejected','cancelled') AND sa.agent_email IS NOT NULL
      AND sa.sale_datetime < ((p_to + 1)::timestamp AT TIME ZONE 'Europe/Copenhagen')
  ) x
  JOIN employee_master_data e ON e.id = x.emp
  WHERE COALESCE(e.sales_history_from, e.employment_start_date) IS NULL
     OR (x.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date >= COALESCE(e.sales_history_from, e.employment_start_date)
),
day AS (SELECT emp, d, SUM(comm) AS comm, COUNT(DISTINCT sale_id) AS sales FROM s GROUP BY 1,2),
emp_team AS (SELECT tm.employee_id AS emp, MIN(tm.team_id::text)::uuid AS team_id FROM team_members tm GROUP BY 1),
-- Første salg
first_sale AS (
  SELECT d.emp, MIN(d.d) AS d FROM day d GROUP BY 1
),
c_first AS (
  SELECT 'first_sale'::text, f.emp, et.team_id, f.d::text, 0, NULL::numeric, NULL::numeric, f.d
  FROM first_sale f JOIN employee_master_data e ON e.id = f.emp LEFT JOIN emp_team et ON et.emp = f.emp, cfg
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
  SELECT 'record_day'::text, h.emp, et.team_id, h.d::text, 0, h.comm, h.prev_best, h.d
  FROM day_hist h LEFT JOIN emp_team et ON et.emp = h.emp, cfg
  WHERE h.d BETWEEN p_from AND p_to AND h.prev_days >= cfg.min_days AND h.comm > COALESCE(h.prev_best,0) AND h.prev_best > 0
),
-- Uge- og lønperioderekord: første dag hvor løbende sum overstiger tidligere bedste
wk AS (SELECT emp, d, comm, to_char(d,'IYYY-"W"IW') AS k FROM day),
pp AS (SELECT s.emp, s.d, SUM(s.comm) AS comm, s.pp::date::text AS k FROM s GROUP BY s.emp, s.d, s.pp),
roll AS (
  SELECT 'record_week'::text AS t, emp, d, k, SUM(comm) OVER (PARTITION BY emp,k ORDER BY d) AS cum FROM wk
  UNION ALL
  SELECT 'record_pay_period', emp, d, k, SUM(comm) OVER (PARTITION BY emp,k ORDER BY d) FROM pp
),
tot AS (SELECT t, emp, k, MAX(cum) AS total, MIN(d) AS first_d FROM roll GROUP BY 1,2,3),
prev AS (
  SELECT a.t, a.emp, a.k,
    (SELECT MAX(b.total) FROM tot b WHERE b.t=a.t AND b.emp=a.emp AND b.first_d < a.first_d) AS prev_best,
    (SELECT COUNT(*) FROM tot b WHERE b.t=a.t AND b.emp=a.emp AND b.first_d < a.first_d AND b.total > 0) AS prev_n
  FROM tot a
),
cross_d AS (
  SELECT r.t, r.emp, r.k, MIN(r.d) AS d, MAX(r.cum) AS val, p.prev_best
  FROM roll r JOIN prev p USING (t, emp, k), cfg
  WHERE r.cum > p.prev_best AND p.prev_best > 0
    AND p.prev_n >= CASE WHEN r.t='record_week' THEN cfg.min_weeks ELSE cfg.min_periods END
  GROUP BY r.t, r.emp, r.k, p.prev_best
),
c_period AS (
  SELECT c.t, c.emp, et.team_id, c.k, 0,
    (SELECT MAX(r2.cum) FROM roll r2 WHERE r2.t=c.t AND r2.emp=c.emp AND r2.k=c.k AND r2.d <= p_to), c.prev_best, c.d
  FROM cross_d c LEFT JOIN emp_team et ON et.emp = c.emp
  WHERE c.d BETWEEN p_from AND p_to
),
-- Klub: løbende lønperiodesum krydser niveau
pp_roll AS (SELECT emp, d, k, SUM(comm) OVER (PARTITION BY emp,k ORDER BY d) AS cum FROM pp),
c_club AS (
  SELECT 'club'::text, r.emp, et.team_id, r.k, club.lvl::int, MAX(r2.cum), NULL::numeric, MIN(r.d)
  FROM pp_roll r CROSS JOIN club LEFT JOIN emp_team et ON et.emp = r.emp
  JOIN LATERAL (SELECT MAX(cum) AS cum FROM pp_roll x WHERE x.emp=r.emp AND x.k=r.k AND x.d <= p_to) r2 ON true
  WHERE r.cum >= club.lvl
  GROUP BY r.emp, et.team_id, r.k, club.lvl
  HAVING MIN(r.d) BETWEEN p_from AND p_to
),
-- Stribe (samme regler som profilstatistikken: min. 1500 kr, weekend/fravær springes over)
span AS (SELECT emp, MIN(d) AS mn, p_to AS mx FROM day GROUP BY 1),
cal AS (SELECT sp.emp, g::date AS d FROM span sp, generate_series(sp.mn, sp.mx, interval '1 day') g),
abs_days AS (
  SELECT a.employee_id AS emp, g::date AS d FROM absence_request_v2 a,
    generate_series(a.start_date, a.end_date, interval '1 day') g
  WHERE a.status='approved' AND a.type IN ('day_off','sick','vacation')
),
marked AS (
  SELECT c.emp, c.d, (COALESCE(sd.comm,0) >= 1500) AS has_sale,
    CASE WHEN COALESCE(sd.comm,0) >= 1500 THEN false WHEN ad.d IS NOT NULL THEN true ELSE EXTRACT(isodow FROM c.d) IN (6,7) END AS skipped
  FROM cal c LEFT JOIN day sd ON sd.emp=c.emp AND sd.d=c.d LEFT JOIN (SELECT DISTINCT emp, d FROM abs_days) ad ON ad.emp=c.emp AND ad.d=c.d
),
seq AS (
  SELECT emp, d, has_sale, SUM(CASE WHEN has_sale THEN 0 ELSE 1 END) OVER (PARTITION BY emp ORDER BY d) AS grp
  FROM marked WHERE NOT skipped
),
run AS (
  SELECT emp, d, grp, ROW_NUMBER() OVER (PARTITION BY emp, grp ORDER BY d) AS n, MIN(d) OVER (PARTITION BY emp, grp) AS sd
  FROM seq WHERE has_sale
),
c_streak AS (
  SELECT 'streak'::text, r.emp, et.team_id, r.sd::text, r.n::int, r.n::numeric, NULL::numeric, r.d
  FROM run r LEFT JOIN emp_team et ON et.emp = r.emp, cfg
  WHERE r.d BETWEEN p_from AND p_to AND r.n % cfg.streak_step = 0
),
-- Team og hus: samme tælling som get_sales_aggregates_v2 / kpi sales_count
tsales AS (
  SELECT (sa.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date AS d, tc.team_id,
         SUM(CASE WHEN p.counts_as_sale IS NOT FALSE THEN si.quantity ELSE 0 END) AS n
  FROM sales sa JOIN sale_items si ON si.sale_id = sa.id LEFT JOIN products p ON p.id = si.product_id
  LEFT JOIN client_campaigns cc ON cc.id = sa.client_campaign_id LEFT JOIN team_clients tc ON tc.client_id = cc.client_id
  WHERE COALESCE(sa.validation_status,'approved') NOT IN ('rejected','cancelled')
    AND sa.sale_datetime < ((p_to + 1)::timestamp AT TIME ZONE 'Europe/Copenhagen')
  GROUP BY 1,2
),
c_team AS (
  SELECT 'team_day_sales'::text, NULL::uuid, t.team_id, t.d::text, (g * cfg.team_step)::int, t.n::numeric, NULL::numeric, t.d
  FROM tsales t, cfg, generate_series(1, GREATEST(floor(t.n / cfg.team_step)::int, 0)) g
  WHERE t.team_id IS NOT NULL AND t.d BETWEEN p_from AND p_to
),
house AS (SELECT d, SUM(n) AS n FROM tsales GROUP BY 1),
house_h AS (SELECT d, n, MAX(n) OVER (ORDER BY d ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev FROM house),
c_house AS (
  SELECT 'house_record'::text, NULL::uuid, NULL::uuid, h.d::text, 0, h.n::numeric, h.prev::numeric, h.d
  FROM house_h h WHERE h.d BETWEEN p_from AND p_to AND h.n > COALESCE(h.prev,0) AND h.prev > 0
)
SELECT * FROM c_first UNION ALL SELECT * FROM c_day UNION ALL SELECT * FROM c_period
UNION ALL SELECT * FROM c_club UNION ALL SELECT * FROM c_streak UNION ALL SELECT * FROM c_team UNION ALL SELECT * FROM c_house
$$;

REVOKE ALL ON FUNCTION public.pulsen_milestone_candidates(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulsen_milestone_candidates(date, date) TO service_role;

-- Pulsen trin 7: toplinje (kun aggregater, ingen persondata). Samme tælling som kpi sales_count / get_sales_aggregates_v2.
CREATE OR REPLACE FUNCTION public.pulsen_topline()
RETURNS TABLE(team_id uuid, team_name text, today bigint, last_week_same_time bigint, yesterday bigint, last_30d bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
WITH b AS (
  SELECT sa.sale_datetime, tc.team_id,
         CASE WHEN p.counts_as_sale IS NOT FALSE THEN si.quantity ELSE 0 END AS q
  FROM sales sa JOIN sale_items si ON si.sale_id = sa.id LEFT JOIN products p ON p.id = si.product_id
  LEFT JOIN client_campaigns cc ON cc.id = sa.client_campaign_id LEFT JOIN team_clients tc ON tc.client_id = cc.client_id
  WHERE COALESCE(sa.validation_status,'approved') NOT IN ('rejected','cancelled')
    AND sa.sale_datetime >= now() - interval '31 days'
),
k AS (
  SELECT (date_trunc('day', now() AT TIME ZONE 'Europe/Copenhagen') AT TIME ZONE 'Europe/Copenhagen') AS today0
)
SELECT b.team_id, t.name,
  SUM(q) FILTER (WHERE sale_datetime >= k.today0)::bigint,
  SUM(q) FILTER (WHERE sale_datetime >= k.today0 - interval '7 days' AND sale_datetime <= now() - interval '7 days')::bigint,
  SUM(q) FILTER (WHERE sale_datetime >= k.today0 - interval '1 day' AND sale_datetime < k.today0)::bigint,
  SUM(q) FILTER (WHERE sale_datetime >= k.today0 - interval '30 days')::bigint
FROM b CROSS JOIN k LEFT JOIN teams t ON t.id = b.team_id
GROUP BY b.team_id, t.name
$$;

REVOKE ALL ON FUNCTION public.pulsen_topline() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulsen_topline() TO service_role;