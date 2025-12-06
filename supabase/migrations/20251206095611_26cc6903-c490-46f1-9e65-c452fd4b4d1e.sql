-- Create table to store car quiz completions
CREATE TABLE public.car_quiz_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  passed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT car_quiz_unique_employee UNIQUE (employee_id)
);

-- Enable RLS
ALTER TABLE public.car_quiz_completions ENABLE ROW LEVEL SECURITY;

-- Employees can view their own completion
CREATE POLICY "Employees can view own quiz completion"
ON public.car_quiz_completions
FOR SELECT
USING (employee_id = get_current_employee_id());

-- Employees can insert their own completion
CREATE POLICY "Employees can insert own quiz completion"
ON public.car_quiz_completions
FOR INSERT
WITH CHECK (employee_id = get_current_employee_id());

-- Managers can view all completions
CREATE POLICY "Managers can view all quiz completions"
ON public.car_quiz_completions
FOR SELECT
USING (is_manager_or_above(auth.uid()));

-- Managers can manage all completions
CREATE POLICY "Managers can manage quiz completions"
ON public.car_quiz_completions
FOR ALL
USING (is_manager_or_above(auth.uid()));