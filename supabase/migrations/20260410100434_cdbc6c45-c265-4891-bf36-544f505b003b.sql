
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
    
    -- NOTE: We no longer delete from team_members here.
    -- Inactive employees keep their team association so they
    -- continue to appear in daily reports and payroll reports.

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

    -- Auto-reject referrals if employee was hired less than 60 days ago
    UPDATE public.employee_referrals
    SET status = 'rejected',
        notes = COALESCE(notes || E'\n', '') || 'Automatisk afvist: Medarbejder stoppede før 60 dages ansættelse (' || COALESCE((CURRENT_DATE - hired_date::date)::text, '?') || ' dage).',
        updated_at = now()
    WHERE hired_employee_id = NEW.id
      AND status IN ('hired', 'eligible_for_bonus')
      AND hired_date IS NOT NULL
      AND (CURRENT_DATE - hired_date::date) < 60;
  END IF;
  
  RETURN NEW;
END;
$function$;
