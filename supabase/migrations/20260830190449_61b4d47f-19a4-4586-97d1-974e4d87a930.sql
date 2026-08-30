-- =====================================================================
-- 1. Ny beskyttet tabel til selve loenbeloebene (1:1 med medarbejderen)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.employee_salary_details (
  employee_id uuid NOT NULL PRIMARY KEY
    REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  amount numeric NULL,            -- maanedsloen eller timesats, jf. salary_type paa stamkortet
  percentage_rate numeric NULL,   -- kun ved provisionsloen (procent af DB)
  minimum_salary numeric NULL,    -- gulv ved provisionsloen
  notes text NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_salary_details TO authenticated;
GRANT ALL ON public.employee_salary_details TO service_role;

ALTER TABLE public.employee_salary_details ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_employee_salary_details_updated_at ON public.employee_salary_details;
CREATE TRIGGER update_employee_salary_details_updated_at
  BEFORE UPDATE ON public.employee_salary_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Flyt eksisterende beloeb med over
INSERT INTO public.employee_salary_details (employee_id, amount, percentage_rate, minimum_salary, notes)
SELECT e.id, e.salary_amount, e.salary_percentage_rate, e.salary_minimum, e.salary_notes
FROM public.employee_master_data e
WHERE e.salary_amount IS NOT NULL
   OR e.salary_percentage_rate IS NOT NULL
   OR e.salary_minimum IS NOT NULL
   OR e.salary_notes IS NOT NULL
ON CONFLICT (employee_id) DO UPDATE
  SET amount          = EXCLUDED.amount,
      percentage_rate = EXCLUDED.percentage_rate,
      minimum_salary  = EXCLUDED.minimum_salary,
      notes           = EXCLUDED.notes,
      updated_at      = now();

-- =====================================================================
-- 2. Hjaelpefunktion: er medarbejderens loen superadmin-beskyttet?
-- =====================================================================
CREATE OR REPLACE FUNCTION public.is_protected_salary_employee(p_employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employee_master_data e
    WHERE e.id = p_employee_id
      AND e.personnel_category IN ('staff', 'team_leader', 'assistant')
  );
$$;

REVOKE ALL ON FUNCTION public.is_protected_salary_employee(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.is_protected_salary_employee(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_protected_salary_employee(uuid) TO authenticated, service_role;

-- =====================================================================
-- 3. Faelles sync: stamkort + loenbeloeb  ->  personnel_salaries (afledt)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.sync_personnel_salary(p_employee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp   public.employee_master_data;
  v_det   public.employee_salary_details;
  v_model text;
BEGIN
  SELECT * INTO v_emp FROM public.employee_master_data WHERE id = p_employee_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT * INTO v_det FROM public.employee_salary_details WHERE employee_id = p_employee_id;

  -- Ingen kategori: deaktiver evt. gamle raekker og stop.
  IF v_emp.personnel_category IS NULL THEN
    UPDATE public.personnel_salaries
    SET is_active = false, updated_at = now()
    WHERE employee_id = p_employee_id AND is_active = true;
    RETURN;
  END IF;

  v_model := public.map_salary_type_to_compensation_model(v_emp.salary_type::text);

  -- Kategoriskift: gamle raekker deaktiveres (historikken bevares).
  UPDATE public.personnel_salaries
  SET is_active = false, updated_at = now()
  WHERE employee_id = p_employee_id
    AND salary_type <> v_emp.personnel_category
    AND is_active = true;

  INSERT INTO public.personnel_salaries (
    employee_id, salary_type, compensation_model,
    monthly_salary, hourly_rate, percentage_rate, minimum_salary,
    hours_source, start_date, notes, is_active
  )
  VALUES (
    p_employee_id,
    v_emp.personnel_category,
    v_model,
    CASE WHEN v_model = 'monthly_fixed' THEN COALESCE(v_det.amount, 0) ELSE 0 END,
    CASE WHEN v_model = 'hourly'        THEN v_det.amount ELSE NULL END,
    CASE WHEN v_model = 'percentage'    THEN COALESCE(v_det.percentage_rate, 0) ELSE 0 END,
    CASE WHEN v_model = 'percentage'    THEN COALESCE(v_det.minimum_salary, 0) ELSE 0 END,
    COALESCE(v_emp.salary_hours_source, 'shift'),
    v_emp.salary_start_date,
    v_det.notes,
    COALESCE(v_emp.is_active, true)
  )
  ON CONFLICT (employee_id, salary_type) DO UPDATE
  SET compensation_model = EXCLUDED.compensation_model,
      monthly_salary     = EXCLUDED.monthly_salary,
      hourly_rate        = EXCLUDED.hourly_rate,
      percentage_rate    = EXCLUDED.percentage_rate,
      minimum_salary     = EXCLUDED.minimum_salary,
      hours_source       = EXCLUDED.hours_source,
      start_date         = EXCLUDED.start_date,
      notes              = EXCLUDED.notes,
      is_active          = EXCLUDED.is_active,
      updated_at         = now();
END;
$$;

REVOKE ALL ON FUNCTION public.sync_personnel_salary(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.sync_personnel_salary(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_personnel_salary(uuid) TO service_role;

-- Trigger paa stamkortet (kategori, loentype, timekilde, startdato, aktiv)
CREATE OR REPLACE FUNCTION public.sync_personnel_salary_from_master()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_personnel_salary(NEW.id);
  RETURN NEW;
END;
$$;

-- Trigger paa loenbeloebene
CREATE OR REPLACE FUNCTION public.sync_personnel_salary_from_details()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_personnel_salary(OLD.employee_id);
    RETURN OLD;
  END IF;
  PERFORM public.sync_personnel_salary(NEW.employee_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_personnel_salary_from_details_trg ON public.employee_salary_details;
CREATE TRIGGER sync_personnel_salary_from_details_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.employee_salary_details
  FOR EACH ROW EXECUTE FUNCTION public.sync_personnel_salary_from_details();

-- =====================================================================
-- 4. Fjern beloebskolonnerne fra det bredt laesbare stamkort
-- =====================================================================
DROP TRIGGER IF EXISTS sync_personnel_salary_from_master_trg ON public.employee_master_data;

ALTER TABLE public.employee_master_data
  DROP COLUMN IF EXISTS salary_amount,
  DROP COLUMN IF EXISTS salary_percentage_rate,
  DROP COLUMN IF EXISTS salary_minimum,
  DROP COLUMN IF EXISTS salary_notes;

CREATE TRIGGER sync_personnel_salary_from_master_trg
  AFTER INSERT OR UPDATE OF personnel_category, salary_type, salary_hours_source, salary_start_date, is_active
  ON public.employee_master_data
  FOR EACH ROW EXECUTE FUNCTION public.sync_personnel_salary_from_master();

-- Genkoer sync, saa personnel_salaries matcher den nye kilde
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.employee_master_data WHERE personnel_category IS NOT NULL LOOP
    PERFORM public.sync_personnel_salary(r.id);
  END LOOP;
END $$;

-- =====================================================================
-- 5. RLS paa loenbeloeb
-- =====================================================================
DROP POLICY IF EXISTS "Salary details are readable by authorised users" ON public.employee_salary_details;
CREATE POLICY "Salary details are readable by authorised users"
  ON public.employee_salary_details FOR SELECT TO authenticated
  USING (
    public.is_superadmin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.employee_master_data e
      WHERE e.id = employee_salary_details.employee_id
        AND e.auth_user_id = auth.uid()
    )
    OR (
      NOT public.is_protected_salary_employee(employee_salary_details.employee_id)
      AND (
        public.is_owner(auth.uid())
        OR public.is_rekruttering(auth.uid())
        OR public.is_fieldmarketing_leder(auth.uid())
        OR (
          public.is_teamleder_or_above(auth.uid())
          AND public.can_view_employee(employee_salary_details.employee_id, auth.uid())
        )
      )
    )
  );

DROP POLICY IF EXISTS "Salary details insert" ON public.employee_salary_details;
CREATE POLICY "Salary details insert"
  ON public.employee_salary_details FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin(auth.uid())
    OR (
      NOT public.is_protected_salary_employee(employee_salary_details.employee_id)
      AND (
        public.is_owner(auth.uid())
        OR public.is_rekruttering(auth.uid())
        OR (
          public.is_teamleder_or_above(auth.uid())
          AND public.can_view_employee(employee_salary_details.employee_id, auth.uid())
        )
      )
    )
  );

DROP POLICY IF EXISTS "Salary details update" ON public.employee_salary_details;
CREATE POLICY "Salary details update"
  ON public.employee_salary_details FOR UPDATE TO authenticated
  USING (
    public.is_superadmin(auth.uid())
    OR (
      NOT public.is_protected_salary_employee(employee_salary_details.employee_id)
      AND (
        public.is_owner(auth.uid())
        OR public.is_rekruttering(auth.uid())
        OR (
          public.is_teamleder_or_above(auth.uid())
          AND public.can_view_employee(employee_salary_details.employee_id, auth.uid())
        )
      )
    )
  )
  WITH CHECK (
    public.is_superadmin(auth.uid())
    OR (
      NOT public.is_protected_salary_employee(employee_salary_details.employee_id)
      AND (
        public.is_owner(auth.uid())
        OR public.is_rekruttering(auth.uid())
        OR (
          public.is_teamleder_or_above(auth.uid())
          AND public.can_view_employee(employee_salary_details.employee_id, auth.uid())
        )
      )
    )
  );

DROP POLICY IF EXISTS "Salary details delete" ON public.employee_salary_details;
CREATE POLICY "Salary details delete"
  ON public.employee_salary_details FOR DELETE TO authenticated
  USING (public.is_superadmin(auth.uid()));