-- Create function to remove employee from team_members when deactivated
CREATE OR REPLACE FUNCTION public.remove_deactivated_employee_from_teams()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when is_active changes from true to false
  IF OLD.is_active = true AND NEW.is_active = false THEN
    DELETE FROM public.team_members WHERE employee_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on employee_master_data
DROP TRIGGER IF EXISTS on_employee_deactivated_remove_from_teams ON public.employee_master_data;
CREATE TRIGGER on_employee_deactivated_remove_from_teams
  AFTER UPDATE OF is_active ON public.employee_master_data
  FOR EACH ROW
  EXECUTE FUNCTION public.remove_deactivated_employee_from_teams();

-- Clean up existing inactive employees from team_members
DELETE FROM public.team_members 
WHERE employee_id IN (
  SELECT id FROM public.employee_master_data WHERE is_active = false
);