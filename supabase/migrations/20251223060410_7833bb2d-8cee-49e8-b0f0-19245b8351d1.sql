-- Improve employee linking for RLS: make get_current_employee_id robust when auth_user_id is not yet set

CREATE OR REPLACE FUNCTION public.get_current_employee_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_employee_id uuid;
  v_email text;
BEGIN
  -- Primary: auth_user_id already linked
  SELECT id
  INTO v_employee_id
  FROM public.employee_master_data
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  IF v_employee_id IS NOT NULL THEN
    RETURN v_employee_id;
  END IF;

  -- Fallback: link by auth email (private_email or work_email)
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid() LIMIT 1;

  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id
  INTO v_employee_id
  FROM public.employee_master_data
  WHERE (lower(private_email) = lower(v_email) OR lower(work_email) = lower(v_email))
  LIMIT 1;

  -- If found and not yet linked, link it for future calls
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.employee_master_data
    SET auth_user_id = auth.uid(), updated_at = now()
    WHERE id = v_employee_id AND auth_user_id IS NULL;
  END IF;

  RETURN v_employee_id;
END;
$$;