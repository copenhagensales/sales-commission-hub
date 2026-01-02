-- Drop all existing policies and recreate with proper permissions
DROP POLICY IF EXISTS "Employees can insert own goals" ON public.employee_sales_goals;
DROP POLICY IF EXISTS "Users can insert their own goals" ON public.employee_sales_goals;
DROP POLICY IF EXISTS "Users can view their own goals" ON public.employee_sales_goals;
DROP POLICY IF EXISTS "Users can update their own goals" ON public.employee_sales_goals;
DROP POLICY IF EXISTS "Users can delete their own goals" ON public.employee_sales_goals;

-- Employees can manage their own goals
CREATE POLICY "Users can view own goals" ON public.employee_sales_goals
  FOR SELECT TO authenticated
  USING (employee_id = public.get_current_employee_id());

CREATE POLICY "Users can insert own goals" ON public.employee_sales_goals
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.get_current_employee_id());

CREATE POLICY "Users can update own goals" ON public.employee_sales_goals
  FOR UPDATE TO authenticated
  USING (employee_id = public.get_current_employee_id());

CREATE POLICY "Users can delete own goals" ON public.employee_sales_goals
  FOR DELETE TO authenticated
  USING (employee_id = public.get_current_employee_id());

-- Managers can manage all goals (for role preview and team management)
CREATE POLICY "Managers can manage all goals" ON public.employee_sales_goals
  FOR ALL TO authenticated
  USING (public.is_teamleder_or_above(auth.uid()))
  WITH CHECK (public.is_teamleder_or_above(auth.uid()));