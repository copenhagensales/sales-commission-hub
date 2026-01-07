-- Create salary schemes table
CREATE TABLE public.salary_schemes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  scheme_type TEXT NOT NULL CHECK (scheme_type IN ('fixed', 'percentage_db', 'hourly', 'commission')),
  percentage_value NUMERIC,
  fixed_amount NUMERIC,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create employee salary scheme assignments
CREATE TABLE public.employee_salary_schemes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employee(id) ON DELETE CASCADE,
  salary_scheme_id UUID NOT NULL REFERENCES public.salary_schemes(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (employee_id, salary_scheme_id, effective_from)
);

-- Enable RLS
ALTER TABLE public.salary_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_salary_schemes ENABLE ROW LEVEL SECURITY;

-- RLS policies for salary_schemes (read for authenticated, write for admins)
CREATE POLICY "Authenticated users can view salary schemes"
ON public.salary_schemes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage salary schemes"
ON public.salary_schemes FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employee_master_data emd
    JOIN public.job_positions jp ON emd.job_title = jp.name
    WHERE emd.auth_user_id = auth.uid()
    AND (jp.permissions->>'menu_mg_test')::boolean = true
  )
);

-- RLS policies for employee_salary_schemes
CREATE POLICY "Authenticated users can view employee salary schemes"
ON public.employee_salary_schemes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage employee salary schemes"
ON public.employee_salary_schemes FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employee_master_data emd
    JOIN public.job_positions jp ON emd.job_title = jp.name
    WHERE emd.auth_user_id = auth.uid()
    AND (jp.permissions->>'menu_mg_test')::boolean = true
  )
);

-- Insert default salary schemes
INSERT INTO public.salary_schemes (name, description, scheme_type, percentage_value)
VALUES 
  ('DB-procent for leder', 'Leder får en procent af teamets samlede dækningsbidrag', 'percentage_db', 5.0),
  ('Fast løn', 'Fast månedlig løn uden provision', 'fixed', NULL),
  ('Provision', 'Ren provisionsbaseret aflønning', 'commission', NULL);