-- Add RLS policy for fieldmarketing leaders to view all employee data
-- This allows people with job_title 'Fieldmarketing leder' to see employee names

CREATE OR REPLACE FUNCTION public.is_fieldmarketing_leder(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employee_master_data
    WHERE auth_user_id = _user_id 
    AND job_title ILIKE '%fieldmarketing%leder%'
    AND is_active = true
  )
$$;

-- Policy for fieldmarketing leaders to view all employees
CREATE POLICY "Fieldmarketing leder can view all employee data"
ON public.employee_master_data
FOR SELECT
USING (is_fieldmarketing_leder(auth.uid()));