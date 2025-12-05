-- Allow employees to view their own employee_master_data record by matching email
CREATE POLICY "Employees can view own record by email"
ON public.employee_master_data
FOR SELECT
USING (
  private_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  OR work_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);