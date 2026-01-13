-- Create function to enforce single team for non-staff employees
CREATE OR REPLACE FUNCTION public.check_single_team_for_non_staff()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if employee is a staff employee
  IF NOT EXISTS (
    SELECT 1 FROM public.employee_master_data 
    WHERE id = NEW.employee_id 
    AND is_staff_employee = true
  ) THEN
    -- Not a staff employee - remove from other teams before allowing insert
    DELETE FROM public.team_members 
    WHERE employee_id = NEW.employee_id 
    AND team_id != NEW.team_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to enforce the rule
DROP TRIGGER IF EXISTS enforce_single_team_for_non_staff ON public.team_members;
CREATE TRIGGER enforce_single_team_for_non_staff
BEFORE INSERT ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.check_single_team_for_non_staff();