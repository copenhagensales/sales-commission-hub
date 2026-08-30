-- =====================================================================
-- 1) Eksplicit lønmodel på personnel_salaries (erstatter 1000-kr-gættet)
-- =====================================================================
ALTER TABLE public.personnel_salaries
  ADD COLUMN IF NOT EXISTS compensation_model text;

COMMENT ON COLUMN public.personnel_salaries.compensation_model IS
  'Eksplicit lønmodel: monthly_fixed (fast månedsløn i monthly_salary), hourly (timesats i hourly_rate) eller percentage (procent af DB i percentage_rate med minimum_salary som gulv).';

-- Teamledere aflønnes med procent af DB
UPDATE public.personnel_salaries
SET compensation_model = 'percentage'
WHERE compensation_model IS NULL
  AND salary_type = 'team_leader';

-- Timelønnede: eksisterende timesats, eller beløb under 1000 kr. der i dag
-- ligger i monthly_salary men reelt er en timesats. Beløbet flyttes til
-- hourly_rate, så monthly_salary ikke længere er tvetydig.
UPDATE public.personnel_salaries
SET compensation_model = 'hourly',
    hourly_rate = COALESCE(NULLIF(hourly_rate, 0), monthly_salary, 0),
    monthly_salary = 0
WHERE compensation_model IS NULL
  AND salary_type <> 'team_leader'
  AND (COALESCE(hourly_rate, 0) > 0 OR COALESCE(monthly_salary, 0) < 1000);

-- Resten er fast månedsløn
UPDATE public.personnel_salaries
SET compensation_model = 'monthly_fixed'
WHERE compensation_model IS NULL;

ALTER TABLE public.personnel_salaries
  ALTER COLUMN compensation_model SET DEFAULT 'monthly_fixed';

ALTER TABLE public.personnel_salaries
  ALTER COLUMN compensation_model SET NOT NULL;

ALTER TABLE public.personnel_salaries
  ADD CONSTRAINT personnel_salaries_compensation_model_check
  CHECK (compensation_model IN ('monthly_fixed', 'hourly', 'percentage'));

-- =====================================================================
-- 2) Lokationsudgifter styres af et felt på klienten (ikke klientnavnet)
-- =====================================================================
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS has_location_costs boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clients.has_location_costs IS
  'True når klientens salg medfører lokationsudgifter (fieldmarketing). Erstatter tidligere navnematch paa "Eesy FM"/"Yousee".';

UPDATE public.clients
SET has_location_costs = true
WHERE id IN (
    '9a92ea4c-6404-4b58-be08-065e7552d552'::uuid, -- Eesy FM
    '5011a7cd-bf07-4838-a63f-55a12c604b40'::uuid  -- Yousee
  )
  OR name IN ('Eesy FM', 'Yousee');

-- =====================================================================
-- 3) Globale beregningsindstillinger + ændringslog
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.calculation_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  label text NOT NULL,
  description text,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.calculation_settings IS
  'Globale satser til løn- og DB-beregning. Læses af useCalculationSettings(); frontend falder tilbage til DEFAULT_CALCULATION_SETTINGS hvis tabellen ikke kan læses.';

CREATE TABLE IF NOT EXISTS public.calculation_settings_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid,
  changed_by_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calculation_settings_audit_created_at
  ON public.calculation_settings_audit (created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.calculation_settings TO authenticated;
GRANT ALL ON public.calculation_settings TO service_role;
GRANT SELECT ON public.calculation_settings_audit TO authenticated;
GRANT ALL ON public.calculation_settings_audit TO service_role;

ALTER TABLE public.calculation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculation_settings_audit ENABLE ROW LEVEL SECURITY;

-- Satserne bruges i lønvisninger for alle medarbejdere -> læseadgang for alle indloggede
CREATE POLICY "Authenticated can read calculation settings"
  ON public.calculation_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitted users can update calculation settings"
  ON public.calculation_settings
  FOR UPDATE
  TO authenticated
  USING (public.has_page_permission(auth.uid(), 'menu_salary_calculation_settings', true))
  WITH CHECK (public.has_page_permission(auth.uid(), 'menu_salary_calculation_settings', true));

CREATE POLICY "Permitted users can insert calculation settings"
  ON public.calculation_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_page_permission(auth.uid(), 'menu_salary_calculation_settings', true));

CREATE POLICY "Permitted users can read calculation settings audit"
  ON public.calculation_settings_audit
  FOR SELECT
  TO authenticated
  USING (public.has_page_permission(auth.uid(), 'menu_salary_calculation_settings', false));

-- updated_at vedligeholdes af databasen
CREATE OR REPLACE FUNCTION public.set_calculation_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calculation_settings_updated_at ON public.calculation_settings;
CREATE TRIGGER trg_calculation_settings_updated_at
  BEFORE UPDATE ON public.calculation_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_calculation_settings_updated_at();

-- Hver ændring logges (uændret værdi logges ikke)
CREATE OR REPLACE FUNCTION public.log_calculation_settings_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.value IS NOT DISTINCT FROM NEW.value THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(work_email, private_email)
  INTO v_email
  FROM public.employee_master_data
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  INSERT INTO public.calculation_settings_audit (key, old_value, new_value, changed_by, changed_by_email)
  VALUES (
    NEW.key,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.value ELSE NULL END,
    NEW.value,
    auth.uid(),
    v_email
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calculation_settings_audit ON public.calculation_settings;
CREATE TRIGGER trg_calculation_settings_audit
  AFTER INSERT OR UPDATE ON public.calculation_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.log_calculation_settings_change();

-- Seed med præcis de værdier der i dag ligger hardkodet i koden
INSERT INTO public.calculation_settings (key, value, label, description)
VALUES
  (
    'vacation_pay_rates',
    jsonb_build_object('seller', 0.125, 'assistant', 0.125, 'staff', 0.125, 'leader', 0.01),
    'Feriepengesatser',
    'Feriegodtgørelse oveni grundlønnen. Sælgere, assistenter og stab får 12,5 % udbetalt feriegodtgørelse. Teamledere har ferie med løn og tillægges 1 %.'
  ),
  (
    'workdays_per_month',
    jsonb_build_object('days', 22),
    'Arbejdsdage pr. måned',
    'Normtal brugt til at proratere faste beløb (månedslønninger, minimumsløn, ATP og faste udgifter) ned til den valgte periode.'
  ),
  (
    'atp_barsel_rate',
    jsonb_build_object('amount', 381),
    'ATP og barsel pr. medarbejder',
    'Kroner pr. AKTIV medarbejder pr. måned. Bruges kun hvis der ikke findes en aktiv ATP/barsel-lønart; ellers vinder lønarten.'
  ),
  (
    'stab_team_id',
    jsonb_build_object(
      'team_id',
      COALESCE(
        (SELECT id::text FROM public.teams WHERE lower(name) = 'stab' ORDER BY created_at LIMIT 1),
        '09012ce9-e307-4f6d-a51e-f72af7200d74'
      )
    ),
    'Stab-team',
    'Teamet der bærer stabs- og fællesomkostninger. Udgifter på dette team fordeles ud på klienterne efter omsætningsandel og indgår ikke som teamudgift.'
  )
ON CONFLICT (key) DO NOTHING;