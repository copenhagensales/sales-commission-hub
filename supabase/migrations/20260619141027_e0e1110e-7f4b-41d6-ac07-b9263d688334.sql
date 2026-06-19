CREATE POLICY "Employees can update own quiz completion"
ON public.car_quiz_completions
FOR UPDATE
USING (employee_id = get_current_employee_id())
WITH CHECK (employee_id = get_current_employee_id());