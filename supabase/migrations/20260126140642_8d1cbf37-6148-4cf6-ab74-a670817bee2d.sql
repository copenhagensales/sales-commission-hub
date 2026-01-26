-- Opdater trigger-funktionen til at bruge korrekt UPSERT med den eksisterende unique constraint på user_id
CREATE OR REPLACE FUNCTION public.sync_system_role_from_job_title()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  
  -- UPSERT the role - update if user already has a role, insert if not
  INSERT INTO public.system_roles (user_id, role)
  VALUES (_auth_user_id, _target_role)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = now();
  
  RETURN NEW;
END;
$function$;