-- Løs agent_email -> employee_id med samme kobling som get_sales_aggregates_v2
CREATE OR REPLACE FUNCTION public.league_resolve_employee_from_agent_email(p_agent_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT eam.employee_id
      FROM agents a
      JOIN employee_agent_mapping eam ON eam.agent_id = a.id
      WHERE lower(a.email) = lower(p_agent_email)
      LIMIT 1
    ),
    (
      SELECT emd.id
      FROM employee_master_data emd
      WHERE lower(emd.work_email) = lower(p_agent_email)
      ORDER BY emd.is_active DESC
      LIMIT 1
    )
  )
$$;

-- Aktiv sæson (kvalifikation eller igangværende)
CREATE OR REPLACE FUNCTION public.league_current_open_season()
RETURNS SETOF public.league_seasons
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM league_seasons
  WHERE status IN ('qualification', 'active')
  ORDER BY season_number DESC
  LIMIT 1
$$;

-- Tilmeld alle sælgere med salg fra p_from i den angivne sæson
CREATE OR REPLACE FUNCTION public.league_enroll_from_sales(p_season_id uuid, p_from timestamptz)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  WITH sellers AS (
    SELECT DISTINCT public.league_resolve_employee_from_agent_email(s.agent_email) AS employee_id
    FROM sales s
    WHERE s.sale_datetime >= p_from
      AND s.agent_email IS NOT NULL
  ), ins AS (
    INSERT INTO league_enrollments (season_id, employee_id, is_active, is_spectator)
    SELECT p_season_id, employee_id, true, false
    FROM sellers
    WHERE employee_id IS NOT NULL
    ON CONFLICT (employee_id, season_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM ins;

  RETURN v_inserted;
END;
$$;

-- Trigger-funktion: tilmeld sælger ved første salg i sæsonen
CREATE OR REPLACE FUNCTION public.league_enroll_on_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season record;
  v_employee_id uuid;
BEGIN
  IF NEW.agent_email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_season FROM public.league_current_open_season();

  IF v_season.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.sale_datetime, now()) < v_season.qualification_source_start THEN
    RETURN NEW;
  END IF;

  v_employee_id := public.league_resolve_employee_from_agent_email(NEW.agent_email);

  IF v_employee_id IS NULL THEN
    RAISE LOG '[league_enroll_on_sale] Kunne ikke koble agent_email % til medarbejder', NEW.agent_email;
    RETURN NEW;
  END IF;

  INSERT INTO league_enrollments (season_id, employee_id, is_active, is_spectator)
  VALUES (v_season.id, v_employee_id, true, false)
  ON CONFLICT (employee_id, season_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG '[league_enroll_on_sale] Fejl ignoreret: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_league_enroll_on_sale ON public.sales;
CREATE TRIGGER trg_league_enroll_on_sale
AFTER INSERT ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.league_enroll_on_sale();