-- Fix get_current_employee_id to check both private_email and work_email
CREATE OR REPLACE FUNCTION public.get_current_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.employee_master_data 
  WHERE private_email = (auth.jwt()->>'email')
     OR work_email = (auth.jwt()->>'email')
  LIMIT 1
$$;