
-- Create table for tracking completed Code of Conduct tests
CREATE TABLE public.code_of_conduct_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employee_master_data(id) ON DELETE CASCADE NOT NULL UNIQUE,
  passed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create table for tracking all attempts (including wrong answers for retry logic)
CREATE TABLE public.code_of_conduct_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employee_master_data(id) ON DELETE CASCADE NOT NULL,
  attempt_number int NOT NULL DEFAULT 1,
  answers jsonb NOT NULL,
  wrong_question_numbers int[] NOT NULL DEFAULT '{}',
  passed boolean NOT NULL DEFAULT false,
  ip_address text,
  user_agent text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.code_of_conduct_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_of_conduct_attempts ENABLE ROW LEVEL SECURITY;

-- RLS policies for completions
CREATE POLICY "Employees can view own completion"
ON public.code_of_conduct_completions
FOR SELECT
USING (employee_id = get_current_employee_id());

CREATE POLICY "Employees can insert own completion"
ON public.code_of_conduct_completions
FOR INSERT
WITH CHECK (employee_id = get_current_employee_id());

CREATE POLICY "Employees can update own completion"
ON public.code_of_conduct_completions
FOR UPDATE
USING (employee_id = get_current_employee_id());

CREATE POLICY "Managers can manage completions"
ON public.code_of_conduct_completions
FOR ALL
USING (is_manager_or_above(auth.uid()));

-- RLS policies for attempts
CREATE POLICY "Employees can view own attempts"
ON public.code_of_conduct_attempts
FOR SELECT
USING (employee_id = get_current_employee_id());

CREATE POLICY "Employees can insert own attempts"
ON public.code_of_conduct_attempts
FOR INSERT
WITH CHECK (employee_id = get_current_employee_id());

CREATE POLICY "Managers can manage attempts"
ON public.code_of_conduct_attempts
FOR ALL
USING (is_manager_or_above(auth.uid()));

-- Create indexes
CREATE INDEX idx_code_of_conduct_completions_employee ON public.code_of_conduct_completions(employee_id);
CREATE INDEX idx_code_of_conduct_attempts_employee ON public.code_of_conduct_attempts(employee_id);
CREATE INDEX idx_code_of_conduct_attempts_passed ON public.code_of_conduct_attempts(employee_id, passed);
