DROP POLICY "Employees can view their own time entries" ON public.time_entry;
DROP POLICY "Employees can manage their own time entries" ON public.time_entry;

CREATE POLICY "Employees can view their own time entries"
ON public.time_entry FOR SELECT
USING (employee_id IN (
  SELECT e.id FROM public.employee_master_data e
  WHERE e.auth_user_id = auth.uid()
     OR lower(e.private_email) = lower(auth.jwt() ->> 'email')
     OR lower(e.work_email) = lower(auth.jwt() ->> 'email')
));

CREATE POLICY "Employees can manage their own time entries"
ON public.time_entry FOR ALL
USING (employee_id IN (
  SELECT e.id FROM public.employee_master_data e
  WHERE e.auth_user_id = auth.uid()
     OR lower(e.private_email) = lower(auth.jwt() ->> 'email')
     OR lower(e.work_email) = lower(auth.jwt() ->> 'email')
));

DROP POLICY "Owners and teamleders can manage quiz templates" ON public.quiz_templates;

CREATE POLICY "Owners and teamleders can manage quiz templates"
ON public.quiz_templates FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.employee_master_data e
  WHERE (e.auth_user_id = auth.uid()
      OR lower(e.private_email) = lower(auth.jwt() ->> 'email')
      OR lower(e.work_email) = lower(auth.jwt() ->> 'email'))
    AND e.job_title = ANY (ARRAY['Ejer'::text, 'Teamleder'::text])
    AND e.is_active = true
));

CREATE OR REPLACE FUNCTION public.sync_system_role_from_job_title()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _auth_user_id uuid;
  _target_role public.system_role;
  _position_role text;
BEGIN
  _auth_user_id := NEW.auth_user_id;

  IF _auth_user_id IS NULL AND NEW.private_email IS NOT NULL THEN
    SELECT id INTO _auth_user_id FROM auth.users WHERE lower(email) = lower(NEW.private_email) LIMIT 1;
  END IF;

  IF _auth_user_id IS NULL AND NEW.work_email IS NOT NULL THEN
    SELECT id INTO _auth_user_id FROM auth.users WHERE lower(email) = lower(NEW.work_email) LIMIT 1;
  END IF;

  IF _auth_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.position_id IS NOT NULL THEN
    SELECT system_role_key INTO _position_role
    FROM public.job_positions
    WHERE id = NEW.position_id;
  END IF;

  CASE
    WHEN _position_role = 'ejer' THEN _target_role := 'ejer';
    WHEN _position_role IN ('teamleder', 'assisterendetm', 'assisterende_teamleder_fm', 'fm_leder') THEN _target_role := 'teamleder';
    WHEN _position_role = 'rekruttering' THEN _target_role := 'rekruttering';
    WHEN _position_role = 'some' THEN _target_role := 'some';
    WHEN _position_role IN ('medarbejder', 'fm_medarbejder_') THEN _target_role := 'medarbejder';
    ELSE
      CASE NEW.job_title
        WHEN 'Ejer' THEN _target_role := 'ejer';
        WHEN 'Teamleder' THEN _target_role := 'teamleder';
        WHEN 'Assisterende Teamleder' THEN _target_role := 'teamleder';
        WHEN 'Rekruttering' THEN _target_role := 'rekruttering';
        WHEN 'SOME' THEN _target_role := 'some';
        ELSE _target_role := 'medarbejder';
      END CASE;
  END CASE;

  DELETE FROM public.system_roles WHERE user_id = _auth_user_id;
  INSERT INTO public.system_roles (user_id, role)
  VALUES (_auth_user_id, _target_role);

  RETURN NEW;
END;
$function$;