-- Drop the existing INSERT policy and recreate with correct check
DROP POLICY IF EXISTS "Employees can insert own goals" ON public.employee_sales_goals;

-- Create corrected INSERT policy using get_current_employee_id()
CREATE POLICY "Employees can insert own goals" ON public.employee_sales_goals
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.get_current_employee_id());