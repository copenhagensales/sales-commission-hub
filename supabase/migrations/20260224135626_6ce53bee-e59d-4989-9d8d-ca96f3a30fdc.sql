
-- Join table for salary types <-> employees
CREATE TABLE public.salary_type_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_type_id UUID NOT NULL REFERENCES public.salary_types(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(salary_type_id, employee_id)
);

ALTER TABLE public.salary_type_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read salary_type_employees"
  ON public.salary_type_employees FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owners and teamleders can manage salary_type_employees"
  ON public.salary_type_employees FOR ALL
  USING (public.is_teamleder_or_above(auth.uid()));
