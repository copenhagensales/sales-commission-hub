-- Drop existing problematic policies on shift table
DROP POLICY IF EXISTS "Employees can view their own shifts" ON public.shift;
DROP POLICY IF EXISTS "Managers can manage all shifts" ON public.shift;

-- Drop existing problematic policies on absence_request_v2 table
DROP POLICY IF EXISTS "Employees can create their own absence requests" ON public.absence_request_v2;
DROP POLICY IF EXISTS "Employees can view their own absence requests" ON public.absence_request_v2;
DROP POLICY IF EXISTS "Managers can manage all absence requests" ON public.absence_request_v2;

-- Create helper function to get employee_id for current user (avoiding auth.users query)
CREATE OR REPLACE FUNCTION public.get_current_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.employee_master_data 
  WHERE private_email = (auth.jwt()->>'email')
  LIMIT 1
$$;

-- Recreate shift policies using the helper function
CREATE POLICY "Employees can view their own shifts" 
ON public.shift 
FOR SELECT 
USING (employee_id = public.get_current_employee_id());

CREATE POLICY "Managers can manage all shifts" 
ON public.shift 
FOR ALL 
USING (public.is_manager_or_above(auth.uid()));

-- Recreate absence_request_v2 policies using the helper function
CREATE POLICY "Employees can view their own absence requests" 
ON public.absence_request_v2 
FOR SELECT 
USING (employee_id = public.get_current_employee_id());

CREATE POLICY "Employees can create their own absence requests" 
ON public.absence_request_v2 
FOR INSERT 
WITH CHECK (employee_id = public.get_current_employee_id());

CREATE POLICY "Managers can manage all absence requests" 
ON public.absence_request_v2 
FOR ALL 
USING (public.is_manager_or_above(auth.uid()));