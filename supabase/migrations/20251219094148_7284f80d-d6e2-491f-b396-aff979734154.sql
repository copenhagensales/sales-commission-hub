-- Fix get_current_employee_id to use case-insensitive email matching
CREATE OR REPLACE FUNCTION public.get_current_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.employee_master_data 
  WHERE LOWER(private_email) = LOWER((auth.jwt()->>'email'))
     OR LOWER(work_email) = LOWER((auth.jwt()->>'email'))
  LIMIT 1
$$;