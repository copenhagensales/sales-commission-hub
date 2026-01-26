-- Fix: Remove tenure_days from INSERT statement as it's a GENERATED ALWAYS column
-- The database calculates tenure_days automatically as (end_date - start_date)
CREATE OR REPLACE FUNCTION public.remove_deactivated_employee_from_teams()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Kun trigger når is_active ændres fra true til false
  IF OLD.is_active = true AND NEW.is_active = false THEN
    
    -- Gem team-historik i historical_employment før sletning
    -- Note: tenure_days er en GENERATED kolonne og beregnes automatisk
    INSERT INTO public.historical_employment (
      employee_name,
      start_date,
      end_date,
      team_name
    )
    SELECT 
      NEW.first_name || ' ' || NEW.last_name,
      COALESCE(NEW.employment_start_date, NEW.created_at::date),
      COALESCE(NEW.employment_end_date, CURRENT_DATE),
      t.name
    FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE tm.employee_id = NEW.id
    -- Undgå dubletter hvis historik allerede eksisterer
    AND NOT EXISTS (
      SELECT 1 FROM public.historical_employment he
      WHERE he.employee_name = NEW.first_name || ' ' || NEW.last_name
        AND he.team_name = t.name
        AND he.end_date = COALESCE(NEW.employment_end_date, CURRENT_DATE)
    );
    
    -- Slet fra team_members
    DELETE FROM public.team_members WHERE employee_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;