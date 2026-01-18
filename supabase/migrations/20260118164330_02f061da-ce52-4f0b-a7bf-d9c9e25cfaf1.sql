-- Create personnel_salaries table for managing salaries of team leaders, assistants, and staff
CREATE TABLE public.personnel_salaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  salary_type TEXT NOT NULL CHECK (salary_type IN ('team_leader', 'assistant', 'staff')),
  monthly_salary NUMERIC(10, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, salary_type)
);

-- Create index for faster lookups
CREATE INDEX idx_personnel_salaries_employee ON public.personnel_salaries(employee_id);
CREATE INDEX idx_personnel_salaries_type ON public.personnel_salaries(salary_type);

-- Enable Row Level Security
ALTER TABLE public.personnel_salaries ENABLE ROW LEVEL SECURITY;

-- Create policies for access control (owner/admin only)
CREATE POLICY "Only admins can view personnel salaries"
ON public.personnel_salaries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employee_master_data emp
    JOIN public.job_positions jp ON emp.position_id = jp.id
    WHERE (emp.work_email = (SELECT email FROM auth.users WHERE id = auth.uid())
           OR emp.private_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    AND jp.system_role_key = 'ejer'
  )
);

CREATE POLICY "Only admins can insert personnel salaries"
ON public.personnel_salaries
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employee_master_data emp
    JOIN public.job_positions jp ON emp.position_id = jp.id
    WHERE (emp.work_email = (SELECT email FROM auth.users WHERE id = auth.uid())
           OR emp.private_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    AND jp.system_role_key = 'ejer'
  )
);

CREATE POLICY "Only admins can update personnel salaries"
ON public.personnel_salaries
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employee_master_data emp
    JOIN public.job_positions jp ON emp.position_id = jp.id
    WHERE (emp.work_email = (SELECT email FROM auth.users WHERE id = auth.uid())
           OR emp.private_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    AND jp.system_role_key = 'ejer'
  )
);

CREATE POLICY "Only admins can delete personnel salaries"
ON public.personnel_salaries
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employee_master_data emp
    JOIN public.job_positions jp ON emp.position_id = jp.id
    WHERE (emp.work_email = (SELECT email FROM auth.users WHERE id = auth.uid())
           OR emp.private_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    AND jp.system_role_key = 'ejer'
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_personnel_salaries_updated_at
BEFORE UPDATE ON public.personnel_salaries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();