
-- Add last_team_id to employee_master_data for tracking team after deactivation
ALTER TABLE public.employee_master_data
ADD COLUMN last_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- Backfill: set last_team_id for currently active employees from team_members
UPDATE public.employee_master_data e
SET last_team_id = (
  SELECT tm.team_id FROM public.team_members tm
  WHERE tm.employee_id = e.id
  LIMIT 1
)
WHERE e.is_active = true
  AND e.last_team_id IS NULL;

-- Backfill: set last_team_id for inactive employees from historical_employment (best effort by name)
UPDATE public.employee_master_data e
SET last_team_id = t.id
FROM public.historical_employment he
JOIN public.teams t ON t.name = he.team_name
WHERE e.is_active = false
  AND e.last_team_id IS NULL
  AND he.employee_name = e.first_name || ' ' || e.last_name
  AND he.end_date = (
    SELECT MAX(he2.end_date) FROM public.historical_employment he2
    WHERE he2.employee_name = e.first_name || ' ' || e.last_name
  );

-- Update trigger to set last_team_id before deleting team_members
CREATE OR REPLACE FUNCTION public.remove_deactivated_employee_from_teams()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_active = true AND NEW.is_active = false THEN
    
    -- Save last_team_id before removing from team_members
    NEW.last_team_id := (
      SELECT tm.team_id FROM public.team_members tm
      WHERE tm.employee_id = NEW.id
      LIMIT 1
    );
    
    -- Archive to historical_employment
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
    
    -- Delete from team_members
    DELETE FROM public.team_members WHERE employee_id = NEW.id;
    
    -- Cancel pending contracts
    UPDATE public.contracts
    SET status = 'cancelled'
    WHERE employee_id = NEW.id AND status = 'pending_employee';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Also keep last_team_id in sync when team_members changes for active employees
CREATE OR REPLACE FUNCTION public.sync_last_team_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.employee_master_data
    SET last_team_id = NEW.team_id
    WHERE id = NEW.employee_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Only clear if no other team_members exist
    UPDATE public.employee_master_data
    SET last_team_id = (
      SELECT tm.team_id FROM public.team_members tm
      WHERE tm.employee_id = OLD.employee_id AND tm.id != OLD.id
      LIMIT 1
    )
    WHERE id = OLD.employee_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER sync_last_team_id_trigger
AFTER INSERT OR DELETE ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_last_team_id();
