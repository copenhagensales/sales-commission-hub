
-- Create function to sync system role based on job title
CREATE OR REPLACE FUNCTION public.sync_system_role_from_job_title()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _auth_user_id uuid;
  _target_role system_role;
BEGIN
  -- Get auth user id from email
  SELECT id INTO _auth_user_id FROM auth.users WHERE email = NEW.private_email LIMIT 1;
  
  -- If no auth user, skip
  IF _auth_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Map job_title to system_role
  CASE NEW.job_title
    WHEN 'Ejer' THEN _target_role := 'ejer';
    WHEN 'Teamleder' THEN _target_role := 'teamleder';
    WHEN 'Assisterende Teamleder' THEN _target_role := 'teamleder';
    WHEN 'Rekruttering' THEN _target_role := 'rekruttering';
    WHEN 'SOME' THEN _target_role := 'some';
    ELSE _target_role := 'medarbejder';
  END CASE;
  
  -- Delete all existing roles for this user
  DELETE FROM public.system_roles WHERE user_id = _auth_user_id;
  
  -- Insert the new role
  INSERT INTO public.system_roles (user_id, role)
  VALUES (_auth_user_id, _target_role);
  
  RETURN NEW;
END;
$$;

-- Create trigger on employee_master_data
DROP TRIGGER IF EXISTS sync_role_on_job_title_change ON public.employee_master_data;
CREATE TRIGGER sync_role_on_job_title_change
  AFTER INSERT OR UPDATE OF job_title ON public.employee_master_data
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_system_role_from_job_title();
