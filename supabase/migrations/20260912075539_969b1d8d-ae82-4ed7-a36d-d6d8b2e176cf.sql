CREATE OR REPLACE FUNCTION public.compute_ramp_curve(p_campaign uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_version int;
  v_coverage_from date;
BEGIN
  SELECT coalesce(max(curve_version), 0) + 1 INTO v_version
  FROM public.ramp_curve WHERE client_campaign_id = p_campaign;

  -- Nedre graense: dagen efter kampagnens sidste store datahul (> 14 dage uden salg).
  -- Beregnes én gang, saa reglen ogsaa virker for kampagner der har vaeret paa pause.
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
    RETURN NULL;
  END IF;

  WITH sellers AS (
    SELECT e.id,
           e.employment_end_date,
           lower(coalesce(e.work_email, e.private_email)) AS email,
           e.employment_start_date
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
  day1 AS (
    SELECT id, work_date AS d1
    FROM days WHERE day_no = 1
  ),
  day40 AS (
    SELECT id, email, employment_end_date, work_date AS d40
    FROM days WHERE day_no = 40
  ),
  eligible AS (
    SELECT d.id, d.email
    FROM day40 d
    JOIN day1 f ON f.id = d.id
    WHERE d.d40 < current_date
      AND (d.employment_end_date IS NULL OR d.employment_end_date >= d.d40)
      AND v_coverage_from <= f.d1
      AND EXISTS (
        SELECT 1 FROM public.sales sa
        WHERE sa.client_campaign_id = p_campaign
          AND sa.agent_email = d.email
      )
  ),
  daily AS (
    SELECT d.id, d.day_no,
           (SELECT count(*) FROM public.sales sa
             WHERE sa.client_campaign_id = p_campaign
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