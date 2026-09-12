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
    -- Kun AKTIVE saelgere: ingen flag paa nogen med fratraedelsesdato.
    SELECT en.employee_id, en.client_campaign_id, en.start_date, en.curve_version,
           lower(coalesce(e.work_email, e.private_email)) AS email,
           public.ramp_workday_no(en.start_date, v_today) AS current_day_no
    FROM public.employee_ramp_enrollment en
    JOIN public.employee_master_data e ON e.id = en.employee_id
    WHERE coalesce(e.work_email, e.private_email) IS NOT NULL
      AND e.employment_end_date IS NULL
  ),
  -- "Har passeret" i stedet for "staar paa": jobbet bliver selvhelbredende,
  -- saa en forsoemt nat indhentes automatisk naeste gang.
  passed AS (
    SELECT en.*, cp.day_no
    FROM enrolled en
    CROSS JOIN (VALUES (10), (15)) AS cp(day_no)
    WHERE en.current_day_no >= cp.day_no
      AND en.current_day_no <= 40
  ),
  dated AS (
    -- datoen for saelgerens arbejdsdag 10 henholdsvis 15
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
           -- kumulerede salg PR. MAALEPUNKTETS DATO, ikke pr. i dag
           (SELECT count(*) FROM public.sales sa
              WHERE sa.client_campaign_id = d.client_campaign_id
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