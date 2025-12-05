
-- Drop the problematic RLS policy that queries auth.users directly
DROP POLICY IF EXISTS "Employees can view own record by email" ON public.employee_master_data;

-- Create new policy using auth.jwt() instead of querying auth.users
CREATE POLICY "Employees can view own record by email" 
ON public.employee_master_data 
FOR SELECT 
USING (
  private_email = (auth.jwt()->>'email')::text 
  OR work_email = (auth.jwt()->>'email')::text
);
