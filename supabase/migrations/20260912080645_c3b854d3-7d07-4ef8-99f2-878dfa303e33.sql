ALTER TABLE public.client_campaigns
  ADD COLUMN IF NOT EXISTS ramp_enabled boolean NOT NULL DEFAULT false;

UPDATE public.client_campaigns
   SET ramp_enabled = true
 WHERE id = 'd031126c-aec0-4b80-bbe2-bbc31c4f04ba';

CREATE TABLE IF NOT EXISTS public.ramp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lookback_months int NOT NULL DEFAULT 8,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ramp_settings TO authenticated;
GRANT ALL ON public.ramp_settings TO service_role;

ALTER TABLE public.ramp_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read ramp settings" ON public.ramp_settings;
CREATE POLICY "Authenticated can read ramp settings"
  ON public.ramp_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owners can manage ramp settings" ON public.ramp_settings;
CREATE POLICY "Owners can manage ramp settings"
  ON public.ramp_settings FOR ALL TO authenticated
  USING (public.is_owner(auth.uid()) OR public.am_i_superadmin())
  WITH CHECK (public.is_owner(auth.uid()) OR public.am_i_superadmin());

DROP TRIGGER IF EXISTS update_ramp_settings_updated_at ON public.ramp_settings;
CREATE TRIGGER update_ramp_settings_updated_at
  BEFORE UPDATE ON public.ramp_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ramp_settings (lookback_months)
SELECT 8 WHERE NOT EXISTS (SELECT 1 FROM public.ramp_settings);

CREATE OR REPLACE FUNCTION public.compute_ramp_curve(p_campaign uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_version int;
  v_coverage_from date;
  v_lookback_months int;
BEGIN
  -- Kurven maa kun beregnes for kampagner hvor den er slaaet til (data, ikke kode).
  IF NOT EXISTS (
    SELECT 1 FROM public.client_campaigns
    WHERE id = p_campaign AND ramp_enabled = true
  ) THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(max(curve_version), 0) + 1 INTO v_version
  FROM public.ramp_curve WHERE client_campaign_id = p_campaign;

  SELECT coalesce(min(lookback_months), 8) INTO v_lookback_months
  FROM public.ramp_settings;

  -- Nedre graense = den strengeste af:
  --   a) dagen efter kampagnens sidste store datahul (> 14 dage uden salg)
  --   b) de seneste N maaneder (indstilling i ramp_settings)
  WITH covered AS (
    SELECT DISTINCT (sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date AS d
    FROM public.sales WHERE client_campaign_id = p_campaign
  ),
  gaps AS (
    SELECT d, d - lag(d) OVER (ORDER BY d) AS gap FROM covered
  )
  SELECT greatest(
           coalesce(
             (SELECT max(d) FROM gaps WHERE gap > 14),
             (SELECT min(d) FROM covered)
           ),
           (current_date - make_interval(months => v_lookback_months))::date
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
  v_campaign uuid;
BEGIN
  IF extract(day FROM current_date) = 1 THEN
    FOR v_campaign IN
      SELECT id FROM public.client_campaigns WHERE ramp_enabled = true
    LOOP
      PERFORM public.compute_ramp_curve(v_campaign);
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

  RETURN jsonb_build_object('enrolled', v_enrolled, 'recomputed', v_recomputed, 'flags_created', v_flags);
END;
$function$;