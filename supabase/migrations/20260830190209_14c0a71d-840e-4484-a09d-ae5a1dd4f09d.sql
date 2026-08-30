-- =====================================================================
-- 1. SUPERADMIN: data-seedet rolle over det eksisterende rollehierarki
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.superadmins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  granted_by uuid NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS superadmins_email_key
  ON public.superadmins (lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.superadmins TO authenticated;
GRANT ALL ON public.superadmins TO service_role;

ALTER TABLE public.superadmins ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_superadmins_updated_at ON public.superadmins;
CREATE TRIGGER update_superadmins_updated_at
  BEFORE UPDATE ON public.superadmins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed de tre navngivne brugere (data, ikke kode)
INSERT INTO public.superadmins (email, notes)
VALUES
  ('km@copenhagensales.dk', 'Seedet superadmin'),
  ('mg@copenhagensales.dk', 'Seedet superadmin'),
  ('lm@copenhagensales.dk', 'Seedet superadmin')
ON CONFLICT (lower(email)) DO UPDATE
  SET is_active = true, updated_at = now();

-- Rollekontrol: matcher paa e-mail i auth.users ELLER paa medarbejderens
-- arbejds-/privatmail, saa rollen virker uanset hvilken mail der logges ind med.
CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.superadmins sa
      JOIN auth.users u ON lower(u.email) = lower(sa.email)
      WHERE sa.is_active = true AND u.id = _user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.superadmins sa
      JOIN public.employee_master_data e
        ON lower(sa.email) IN (lower(COALESCE(e.work_email, '')), lower(COALESCE(e.private_email, '')))
      WHERE sa.is_active = true
        AND e.auth_user_id = _user_id
        AND e.is_active = true
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.is_superadmin(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_superadmin(uuid) TO authenticated, service_role;

-- Bruges af brugerfladen: er JEG superadmin?
CREATE OR REPLACE FUNCTION public.am_i_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_superadmin(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.am_i_superadmin() FROM public;
GRANT EXECUTE ON FUNCTION public.am_i_superadmin() TO authenticated, service_role;

-- Kun superadmins kan se og administrere rollen
DROP POLICY IF EXISTS "Superadmins can view superadmins" ON public.superadmins;
CREATE POLICY "Superadmins can view superadmins"
  ON public.superadmins FOR SELECT TO authenticated
  USING (public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Superadmins can insert superadmins" ON public.superadmins;
CREATE POLICY "Superadmins can insert superadmins"
  ON public.superadmins FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Superadmins can update superadmins" ON public.superadmins;
CREATE POLICY "Superadmins can update superadmins"
  ON public.superadmins FOR UPDATE TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Superadmins can delete superadmins" ON public.superadmins;
CREATE POLICY "Superadmins can delete superadmins"
  ON public.superadmins FOR DELETE TO authenticated
  USING (public.is_superadmin(auth.uid()));

-- =====================================================================
-- 2. Logning af opslag i loendata
-- =====================================================================
CREATE OR REPLACE FUNCTION public.log_salary_access(
  p_employee_id uuid,
  p_field text,
  p_access_type text DEFAULT 'view'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_employee_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.sensitive_data_access_log (user_id, employee_id, field_accessed, access_type)
  VALUES (auth.uid(), p_employee_id, COALESCE(p_field, 'salary'), COALESCE(p_access_type, 'view'));
END;
$$;

REVOKE ALL ON FUNCTION public.log_salary_access(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.log_salary_access(uuid, text, text) TO authenticated, service_role;

-- =====================================================================
-- 3. personnel_salaries: kun superadmin + egen loen
-- =====================================================================
DROP POLICY IF EXISTS "Only admins can view personnel salaries" ON public.personnel_salaries;
DROP POLICY IF EXISTS "Superadmins can view personnel salaries" ON public.personnel_salaries;
CREATE POLICY "Superadmins can view personnel salaries"
  ON public.personnel_salaries FOR SELECT TO authenticated
  USING (
    public.is_superadmin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.employee_master_data e
      WHERE e.id = personnel_salaries.employee_id
        AND e.auth_user_id = auth.uid()
    )
  );

-- =====================================================================
-- 4. calculation_settings: kun superadmin
-- =====================================================================
DROP POLICY IF EXISTS "Authenticated can read calculation settings" ON public.calculation_settings;
DROP POLICY IF EXISTS "Permitted users can insert calculation settings" ON public.calculation_settings;
DROP POLICY IF EXISTS "Permitted users can update calculation settings" ON public.calculation_settings;
DROP POLICY IF EXISTS "Superadmins can read calculation settings" ON public.calculation_settings;
DROP POLICY IF EXISTS "Superadmins can insert calculation settings" ON public.calculation_settings;
DROP POLICY IF EXISTS "Superadmins can update calculation settings" ON public.calculation_settings;

CREATE POLICY "Superadmins can read calculation settings"
  ON public.calculation_settings FOR SELECT TO authenticated
  USING (public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can insert calculation settings"
  ON public.calculation_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can update calculation settings"
  ON public.calculation_settings FOR UPDATE TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

-- =====================================================================
-- 5. client_adjustment_percents / fixed_costs / team_expenses: kun superadmin
-- =====================================================================
DROP POLICY IF EXISTS "Authenticated users can read client_adjustment_percents" ON public.client_adjustment_percents;
DROP POLICY IF EXISTS "Authenticated users can insert client_adjustment_percents" ON public.client_adjustment_percents;
DROP POLICY IF EXISTS "Authenticated users can update client_adjustment_percents" ON public.client_adjustment_percents;
DROP POLICY IF EXISTS "Superadmins can manage client_adjustment_percents" ON public.client_adjustment_percents;

CREATE POLICY "Superadmins can manage client_adjustment_percents"
  ON public.client_adjustment_percents FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view fixed_costs" ON public.fixed_costs;
DROP POLICY IF EXISTS "Managers can manage fixed_costs" ON public.fixed_costs;
DROP POLICY IF EXISTS "Superadmins can manage fixed_costs" ON public.fixed_costs;

CREATE POLICY "Superadmins can manage fixed_costs"
  ON public.fixed_costs FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "owners_full_access" ON public.team_expenses;
DROP POLICY IF EXISTS "Superadmins can manage team_expenses" ON public.team_expenses;

CREATE POLICY "Superadmins can manage team_expenses"
  ON public.team_expenses FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));