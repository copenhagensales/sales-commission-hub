-- 1) ramp_curve
CREATE TABLE public.ramp_curve (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_campaign_id uuid NOT NULL REFERENCES public.client_campaigns(id),
  day_no int NOT NULL CHECK (day_no BETWEEN 1 AND 40),
  p25 numeric NOT NULL,
  p50 numeric NOT NULL,
  p75 numeric NOT NULL,
  n_sellers int NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  curve_version int NOT NULL DEFAULT 1,
  CONSTRAINT ramp_curve_unique_day UNIQUE (client_campaign_id, day_no, curve_version)
);
CREATE INDEX idx_ramp_curve_campaign_version ON public.ramp_curve (client_campaign_id, curve_version);

GRANT SELECT ON public.ramp_curve TO authenticated;
GRANT ALL ON public.ramp_curve TO service_role;
ALTER TABLE public.ramp_curve ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read ramp curve"
ON public.ramp_curve FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role manages ramp curve"
ON public.ramp_curve FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2) employee_ramp_enrollment
CREATE TABLE public.employee_ramp_enrollment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL UNIQUE REFERENCES public.employee_master_data(id),
  client_campaign_id uuid NOT NULL REFERENCES public.client_campaigns(id),
  start_date date NOT NULL,
  curve_version int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ramp_enrollment_campaign ON public.employee_ramp_enrollment (client_campaign_id);

GRANT SELECT ON public.employee_ramp_enrollment TO authenticated;
GRANT ALL ON public.employee_ramp_enrollment TO service_role;
ALTER TABLE public.employee_ramp_enrollment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own or leaders can read ramp enrollment"
ON public.employee_ramp_enrollment FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employee_master_data e
    WHERE e.id = employee_ramp_enrollment.employee_id
      AND e.auth_user_id = auth.uid()
  )
  OR public.is_teamleder_or_above(auth.uid())
  OR public.is_owner(auth.uid())
  OR public.am_i_superadmin()
);

CREATE POLICY "Service role manages ramp enrollment"
ON public.employee_ramp_enrollment FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Helper: workday number (1-based) for a date relative to an employment start date
CREATE OR REPLACE FUNCTION public.ramp_workday_no(p_start date, p_target date)
RETURNS int
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM generate_series(p_start, p_target, interval '1 day') d
  WHERE extract(isodow FROM d) < 6
    AND NOT EXISTS (SELECT 1 FROM public.danish_holiday h WHERE h.date = d::date)
$$;

-- 3) compute_ramp_curve
CREATE OR REPLACE FUNCTION public.compute_ramp_curve(p_campaign uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version int;
BEGIN
  SELECT coalesce(max(curve_version), 0) + 1 INTO v_version
  FROM public.ramp_curve WHERE client_campaign_id = p_campaign;

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
  day40 AS (
    SELECT id, email, employment_end_date, work_date AS d40
    FROM days WHERE day_no = 40
  ),
  eligible AS (
    SELECT d.id, d.email
    FROM day40 d
    WHERE d.d40 < current_date
      AND (d.employment_end_date IS NULL OR d.employment_end_date >= d.d40)
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
$$;

REVOKE ALL ON FUNCTION public.compute_ramp_curve(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_ramp_curve(uuid) TO service_role;

-- 4) get_ramp_for_employee / get_my_ramp
CREATE OR REPLACE FUNCTION public.get_ramp_for_employee(p_employee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean;
  v_enroll record;
  v_campaign_name text;
  v_current int;
  v_result jsonb;
BEGIN
  SELECT (e.auth_user_id = auth.uid())
    OR public.is_teamleder_or_above(auth.uid())
    OR public.is_owner(auth.uid())
    OR public.am_i_superadmin()
  INTO v_allowed
  FROM public.employee_master_data e
  WHERE e.id = p_employee_id;

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
$$;

GRANT EXECUTE ON FUNCTION public.get_ramp_for_employee(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_ramp()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id uuid;
BEGIN
  SELECT id INTO v_employee_id
  FROM public.employee_master_data
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  RETURN public.get_ramp_for_employee(v_employee_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_ramp() TO authenticated;

-- 5) nightly maintenance
CREATE OR REPLACE FUNCTION public.ramp_nightly_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrolled int := 0;
  v_recomputed int := 0;
  v_campaign uuid;
BEGIN
  -- Monthly recompute (1st of month) for campaigns that already have a curve
  IF extract(day FROM current_date) = 1 THEN
    FOR v_campaign IN
      SELECT DISTINCT client_campaign_id FROM public.ramp_curve
    LOOP
      PERFORM public.compute_ramp_curve(v_campaign);
      v_recomputed := v_recomputed + 1;
    END LOOP;
  END IF;

  -- Enroll new sellers still inside their first 40 workdays
  WITH latest AS (
    SELECT client_campaign_id, max(curve_version) AS curve_version
    FROM public.ramp_curve GROUP BY client_campaign_id
  ),
  candidates AS (
    SELECT e.id AS employee_id,
           sa.client_campaign_id,
           e.employment_start_date,
           l.curve_version,
           count(*) AS sales_count
    FROM public.employee_master_data e
    JOIN public.sales sa
      ON sa.agent_email = lower(coalesce(e.work_email, e.private_email))
    JOIN latest l ON l.client_campaign_id = sa.client_campaign_id
    WHERE e.employment_start_date IS NOT NULL
      AND coalesce(e.work_email, e.private_email) IS NOT NULL
      AND public.ramp_workday_no(e.employment_start_date, current_date) BETWEEN 1 AND 40
      AND NOT EXISTS (
        SELECT 1 FROM public.employee_ramp_enrollment er WHERE er.employee_id = e.id
      )
    GROUP BY e.id, sa.client_campaign_id, e.employment_start_date, l.curve_version
  ),
  picked AS (
    SELECT DISTINCT ON (employee_id) employee_id, client_campaign_id, employment_start_date, curve_version
    FROM candidates
    ORDER BY employee_id, sales_count DESC, client_campaign_id
  ),
  ins AS (
    INSERT INTO public.employee_ramp_enrollment (employee_id, client_campaign_id, start_date, curve_version)
    SELECT employee_id, client_campaign_id, employment_start_date, curve_version FROM picked
    ON CONFLICT (employee_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::int INTO v_enrolled FROM ins;

  RETURN jsonb_build_object('enrollments_created', v_enrolled, 'curves_recomputed', v_recomputed);
END;
$$;

REVOKE ALL ON FUNCTION public.ramp_nightly_maintenance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ramp_nightly_maintenance() TO service_role;

SELECT cron.schedule(
  'ramp-curve-nightly',
  '50 3 * * *',
  $$SELECT public.ramp_nightly_maintenance();$$
);