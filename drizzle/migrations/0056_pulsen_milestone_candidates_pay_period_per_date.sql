-- Ydelse: pay_period_start kaldes pr. dato i stedet for pr. salgslinje.
-- Ydelse: p_types lader edge-funktionen hente én type pr. kald (holder hvert kald under statement-timeout).
-- Ydelse: resolver kaldes én gang pr. agent_email; vinduesfunktioner i stedet for korrelerede delforespørgsler.
-- Pulsen trin 6: kandidat-beregning til milepæle. LÆSER kun salg/stamdata, skriver intet.
-- Salgsdefinition pr. medarbejder = recalc_employee_profile_stats (samme resolver, filtre, lønperiode, stribe-regler).
-- Team-/husdefinition = get_sales_aggregates_v2 / kpi sales_count (quantity, counts_as_sale, klientens team).
CREATE OR REPLACE FUNCTION public.pulsen_milestone_candidates(p_from date, p_to date, p_types text[])
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
em AS (
  SELECT a.email, public.resolve_sales_employee_id(a.email) AS emp
  FROM (SELECT DISTINCT agent_email AS email FROM sales WHERE agent_email IS NOT NULL) a
),
s AS (
  SELECT x.emp, (x.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date AS d, x.sale_id, x.comm
  FROM (
    SELECT em.emp, sa.sale_datetime, sa.id AS sale_id, COALESCE(si.mapped_commission,0) AS comm
    FROM sales sa
    JOIN em ON em.email = sa.agent_email
    LEFT JOIN sale_items si ON si.sale_id = sa.id AND COALESCE(si.is_cancelled,false) = false
    WHERE COALESCE(sa.validation_status,'') NOT IN ('rejected','cancelled') AND sa.agent_email IS NOT NULL
      AND sa.sale_datetime < ((p_to + 1)::timestamp AT TIME ZONE 'Europe/Copenhagen')
  ) x
  JOIN employee_master_data e ON e.id = x.emp
  WHERE COALESCE(e.sales_history_from, e.employment_start_date) IS NULL
     OR (x.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date >= COALESCE(e.sales_history_from, e.employment_start_date)
),
-- Lønperiode via den fælles pay_period_start, kaldt én gang pr. dato (afhænger kun af dansk dato)
pm AS (SELECT z.d, public.pay_period_start((z.d + time '12:00') AT TIME ZONE 'Europe/Copenhagen') AS pp FROM (SELECT DISTINCT d FROM s) z),
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
pp AS (SELECT dd.emp, dd.d, dd.comm, pm.pp::date::text AS k FROM day dd JOIN pm ON pm.d = dd.d),
roll AS (
  SELECT 'record_week'::text AS t, emp, d, k, SUM(comm) OVER (PARTITION BY emp,k ORDER BY d) AS cum FROM wk
  UNION ALL
  SELECT 'record_pay_period', emp, d, k, SUM(comm) OVER (PARTITION BY emp,k ORDER BY d) FROM pp
),
tot AS (SELECT t, emp, k, MAX(cum) AS total, MIN(d) AS first_d FROM roll GROUP BY 1,2,3),
prev AS (
  SELECT t, emp, k,
    MAX(total) OVER w AS prev_best,
    COUNT(*) FILTER (WHERE total > 0) OVER w AS prev_n
  FROM tot WINDOW w AS (PARTITION BY t, emp ORDER BY first_d ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)
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
    c.val, c.prev_best, c.d
  FROM cross_d c LEFT JOIN emp_team et ON et.emp = c.emp
  WHERE c.d BETWEEN p_from AND p_to
),
-- Klub: løbende lønperiodesum krydser niveau
pp_roll AS (SELECT emp, d, k, SUM(comm) OVER (PARTITION BY emp,k ORDER BY d) AS cum FROM pp),
pp_max AS (SELECT emp, k, MAX(cum) AS mx FROM pp_roll GROUP BY 1,2),
c_club AS (
  SELECT 'club'::text, r.emp, et.team_id, r.k, club.lvl::int, MAX(m.mx), NULL::numeric, MIN(r.d)
  FROM pp_roll r CROSS JOIN club JOIN pp_max m ON m.emp=r.emp AND m.k=r.k LEFT JOIN emp_team et ON et.emp = r.emp
  WHERE r.cum >= club.lvl
  GROUP BY r.emp, et.team_id, r.k, club.lvl
  HAVING MIN(r.d) BETWEEN p_from AND p_to
),
-- Stribe (samme regler som profilstatistikken: min. 1500 kr, weekend/fravær springes over)
span AS (SELECT emp, GREATEST(MIN(d), p_from - 400) AS mn, p_to AS mx FROM day GROUP BY 1),
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
SELECT * FROM c_first WHERE 'first_sale' = ANY(p_types)
UNION ALL SELECT * FROM c_day WHERE 'record_day' = ANY(p_types)
UNION ALL SELECT * FROM c_period WHERE 'record_period' = ANY(p_types)
UNION ALL SELECT * FROM c_club WHERE 'club' = ANY(p_types)
UNION ALL SELECT * FROM c_streak WHERE 'streak' = ANY(p_types)
UNION ALL SELECT * FROM c_team WHERE 'team_day_sales' = ANY(p_types)
UNION ALL SELECT * FROM c_house WHERE 'house_record' = ANY(p_types)
$$;

REVOKE ALL ON FUNCTION public.pulsen_milestone_candidates(date, date, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulsen_milestone_candidates(date, date, text[]) TO service_role;