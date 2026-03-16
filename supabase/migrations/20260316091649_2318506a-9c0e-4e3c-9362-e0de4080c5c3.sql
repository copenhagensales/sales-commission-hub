CREATE OR REPLACE FUNCTION public.remove_deactivated_employee_from_teams()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.is_active = true AND NEW.is_active = false THEN
    
    NEW.last_team_id := (
      SELECT tm.team_id FROM public.team_members tm
      WHERE tm.employee_id = NEW.id
      LIMIT 1
    );
    
    INSERT INTO public.historical_employment (
      employee_name, start_date, end_date, team_name
    )
    SELECT 
      NEW.first_name || ' ' || NEW.last_name,
      COALESCE(NEW.employment_start_date, NEW.created_at::date),
      COALESCE(NEW.employment_end_date, CURRENT_DATE),
      t.name
    FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE tm.employee_id = NEW.id
    AND NOT EXISTS (
      SELECT 1 FROM public.historical_employment he
      WHERE he.employee_name = NEW.first_name || ' ' || NEW.last_name
        AND he.team_name = t.name
        AND he.end_date = COALESCE(NEW.employment_end_date, CURRENT_DATE)
    );
    
    DELETE FROM public.team_members WHERE employee_id = NEW.id;
    
    UPDATE public.contracts
    SET status = 'cancelled'
    WHERE employee_id = NEW.id AND status = 'pending_employee';

    -- Deactivate league enrollments
    UPDATE public.league_enrollments
    SET is_active = false
    WHERE employee_id = NEW.id;

    -- Remove league qualification standings
    DELETE FROM public.league_qualification_standings
    WHERE employee_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;