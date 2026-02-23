
CREATE TABLE public.payroll_error_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  payroll_period_start date NOT NULL,
  payroll_period_end date NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_error_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can insert own reports"
ON public.payroll_error_reports FOR INSERT
TO authenticated
WITH CHECK (employee_id = public.get_current_employee_id());

CREATE POLICY "Employees can view own reports"
ON public.payroll_error_reports FOR SELECT
TO authenticated
USING (
  employee_id = public.get_current_employee_id()
  OR public.is_teamleder_or_above(auth.uid())
);
