-- ============================================================================
-- ÉN SANDHED FOR LØN: medarbejderens stamkort (employee_master_data)
--
-- Før: løn kunne indtastes to steder — `employee_master_data.salary_type` /
-- `salary_amount` OG `personnel_salaries`. De var ude af sync.
-- Efter: stamkortet er den eneste skrivbare kilde. `personnel_salaries`
-- vedligeholdes automatisk af en trigger og er skrivebeskyttet for brugere,
-- så de to steder ikke kan vise forskellige tal.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) De manglende lønfelter flyttes over på stamkortet
-- ---------------------------------------------------------------------------
ALTER TABLE public.employee_master_data
  ADD COLUMN IF NOT EXISTS personnel_category    text,
  ADD COLUMN IF NOT EXISTS salary_percentage_rate numeric,
  ADD COLUMN IF NOT EXISTS salary_minimum        numeric,
  ADD COLUMN IF NOT EXISTS salary_hours_source   text,
  ADD COLUMN IF NOT EXISTS salary_start_date     date,
  ADD COLUMN IF NOT EXISTS salary_notes          text;

ALTER TABLE public.employee_master_data
  DROP CONSTRAINT IF EXISTS employee_master_data_personnel_category_check;
ALTER TABLE public.employee_master_data
  ADD CONSTRAINT employee_master_data_personnel_category_check
  CHECK (personnel_category IS NULL
         OR personnel_category IN ('team_leader', 'assistant', 'staff'));

ALTER TABLE public.employee_master_data
  DROP CONSTRAINT IF EXISTS employee_master_data_salary_hours_source_check;
ALTER TABLE public.employee_master_data
  ADD CONSTRAINT employee_master_data_salary_hours_source_check
  CHECK (salary_hours_source IS NULL
         OR salary_hours_source IN ('shift', 'timestamp'));

COMMENT ON COLUMN public.employee_master_data.personnel_category IS
  'Personalekategori for DB-beregningen: team_leader | assistant | staff. NULL = almindelig saelger uden personalelonraekke. Styrer om der findes en raekke i personnel_salaries.';
COMMENT ON COLUMN public.employee_master_data.salary_percentage_rate IS
  'Procentsats af DB (16 = 16 %). Kun relevant naar salary_type = provision (lonmodel "Procent af DB").';
COMMENT ON COLUMN public.employee_master_data.salary_minimum IS
  'Minimumslon pr. maaned. Bruges som gulv for procentlon (ikke laegges oveni).';
COMMENT ON COLUMN public.employee_master_data.salary_hours_source IS
  'Kilde til timer ved timelon: shift (vagtplan) eller timestamp (stempelur).';
COMMENT ON COLUMN public.employee_master_data.salary_type IS
  'Lonmodel paa stamkortet — den ENESTE kilde. fixed = fast maanedslon, hourly = timelon, provision = provision/procent af DB. Mappes til personnel_salaries.compensation_model.';

-- ---------------------------------------------------------------------------
-- 2) Datamigrering: personnel_salaries -> stamkortet
-- ---------------------------------------------------------------------------

-- 2a) Personalekategori. En raekke der kun er inaktiv fordi medarbejderen er
--     fratraadt bevarer sin kategori; en raekke der er deaktiveret mens
--     medarbejderen fortsat er aktiv (Thomas Wehage) gor det IKKE.
UPDATE public.employee_master_data e
SET personnel_category = ps.salary_type
FROM public.personnel_salaries ps
WHERE ps.employee_id = e.id
  AND (ps.is_active = true OR e.is_active = false);

-- 2b) Beloeb: kun hvor stamkortet manglede det. Stamkortet vinder ellers.
UPDATE public.employee_master_data e
SET salary_amount = ps.hourly_rate
FROM public.personnel_salaries ps
WHERE ps.employee_id = e.id
  AND e.salary_amount IS NULL
  AND e.salary_type = 'hourly'
  AND ps.compensation_model = 'hourly'
  AND COALESCE(ps.hourly_rate, 0) > 0;

UPDATE public.employee_master_data e
SET salary_amount = ps.monthly_salary
FROM public.personnel_salaries ps
WHERE ps.employee_id = e.id
  AND e.salary_amount IS NULL
  AND e.salary_type = 'fixed'
  AND ps.compensation_model = 'monthly_fixed'
  AND COALESCE(ps.monthly_salary, 0) > 0;

-- 2c) Procentsats + minimumslon (teamledere)
UPDATE public.employee_master_data e
SET salary_percentage_rate = ps.percentage_rate,
    salary_minimum         = ps.minimum_salary
FROM public.personnel_salaries ps
WHERE ps.employee_id = e.id
  AND ps.compensation_model = 'percentage';

-- 2d) Timekilde, startdato og noter
UPDATE public.employee_master_data e
SET salary_hours_source = COALESCE(ps.hours_source, 'shift'),
    salary_start_date   = ps.start_date,
    salary_notes        = ps.notes
FROM public.personnel_salaries ps
WHERE ps.employee_id = e.id;

-- 2e) Assisterende teamledere der HAR en lon paa stamkortet men manglede
--     lonraekke helt (deres lon indgik derfor ikke i DB pr. klient).
UPDATE public.employee_master_data e
SET personnel_category = 'assistant'
WHERE e.is_active = true
  AND e.personnel_category IS NULL
  AND e.salary_amount IS NOT NULL
  AND e.salary_type IN ('fixed', 'hourly')
  AND EXISTS (SELECT 1 FROM public.team_assistant_leaders tal WHERE tal.employee_id = e.id)
  AND NOT EXISTS (SELECT 1 FROM public.personnel_salaries ps WHERE ps.employee_id = e.id);

-- ---------------------------------------------------------------------------
-- 3) Spejling: stamkort -> personnel_salaries (afledt, aldrig indtastet)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.map_salary_type_to_compensation_model(_salary_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _salary_type
           WHEN 'fixed'     THEN 'monthly_fixed'
           WHEN 'hourly'    THEN 'hourly'
           WHEN 'provision' THEN 'percentage'
           ELSE 'monthly_fixed'
         END
$$;

COMMENT ON FUNCTION public.map_salary_type_to_compensation_model(text) IS
  'Oversaetter stamkortets salary_type til lonmodellen i personnel_salaries. Én mapping, ét sted.';

CREATE OR REPLACE FUNCTION public.sync_personnel_salary_from_master()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_model text;
BEGIN
  -- Ingen kategori: deaktiver evt. gamle raekker og stop.
  IF NEW.personnel_category IS NULL THEN
    UPDATE public.personnel_salaries
    SET is_active = false, updated_at = now()
    WHERE employee_id = NEW.id AND is_active = true;
    RETURN NEW;
  END IF;

  v_model := public.map_salary_type_to_compensation_model(NEW.salary_type::text);

  -- Kategoriskift: den gamle raekke deaktiveres (historikken bevares).
  UPDATE public.personnel_salaries
  SET is_active = false, updated_at = now()
  WHERE employee_id = NEW.id
    AND salary_type <> NEW.personnel_category
    AND is_active = true;

  INSERT INTO public.personnel_salaries (
    employee_id, salary_type, compensation_model,
    monthly_salary, hourly_rate, percentage_rate, minimum_salary,
    hours_source, start_date, notes, is_active
  )
  VALUES (
    NEW.id,
    NEW.personnel_category,
    v_model,
    CASE WHEN v_model = 'monthly_fixed' THEN COALESCE(NEW.salary_amount, 0) ELSE 0 END,
    CASE WHEN v_model = 'hourly'        THEN NEW.salary_amount ELSE NULL END,
    CASE WHEN v_model = 'percentage'    THEN COALESCE(NEW.salary_percentage_rate, 0) ELSE 0 END,
    CASE WHEN v_model = 'percentage'    THEN COALESCE(NEW.salary_minimum, 0) ELSE 0 END,
    COALESCE(NEW.salary_hours_source, 'shift'),
    NEW.salary_start_date,
    NEW.salary_notes,
    COALESCE(NEW.is_active, true)
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

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_personnel_salary_from_master() IS
  'Holder personnel_salaries 1:1 med medarbejderens stamkort. personnel_salaries er afledt og maa ikke skrives direkte.';

DROP TRIGGER IF EXISTS sync_personnel_salary_from_master_trg ON public.employee_master_data;
CREATE TRIGGER sync_personnel_salary_from_master_trg
AFTER INSERT OR UPDATE OF
  personnel_category, salary_type, salary_amount, salary_percentage_rate,
  salary_minimum, salary_hours_source, salary_start_date, salary_notes, is_active
ON public.employee_master_data
FOR EACH ROW
EXECUTE FUNCTION public.sync_personnel_salary_from_master();

-- ---------------------------------------------------------------------------
-- 4) Foerste fulde spejling af alle stamkort med en personalekategori
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.employee_master_data
    WHERE personnel_category IS NOT NULL
       OR EXISTS (SELECT 1 FROM public.personnel_salaries ps WHERE ps.employee_id = employee_master_data.id)
  LOOP
    UPDATE public.employee_master_data SET updated_at = now() WHERE id = r.id;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) personnel_salaries bliver skrivebeskyttet for brugere
--    (triggeren er SECURITY DEFINER og rammes ikke af RLS)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Only admins can insert personnel salaries" ON public.personnel_salaries;
DROP POLICY IF EXISTS "Only admins can update personnel salaries" ON public.personnel_salaries;
DROP POLICY IF EXISTS "Only admins can delete personnel salaries" ON public.personnel_salaries;

CREATE POLICY "Personnel salaries are derived - no direct insert"
  ON public.personnel_salaries FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "Personnel salaries are derived - no direct update"
  ON public.personnel_salaries FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Personnel salaries are derived - no direct delete"
  ON public.personnel_salaries FOR DELETE TO authenticated
  USING (false);

COMMENT ON TABLE public.personnel_salaries IS
  'AFLEDT tabel. Vedligeholdes udelukkende af trigger sync_personnel_salary_from_master() ud fra employee_master_data. Skriv aldrig direkte — ret lonnen paa medarbejderens stamkort.';
