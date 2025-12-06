-- Create table to store car quiz submissions with full audit trail
CREATE TABLE public.car_quiz_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  passed boolean NOT NULL DEFAULT false,
  answers jsonb NOT NULL,
  gps_accepted boolean NOT NULL DEFAULT false,
  summary_accepted boolean NOT NULL DEFAULT false,
  ip_address text,
  user_agent text,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.car_quiz_submissions ENABLE ROW LEVEL SECURITY;

-- Employees can insert their own submissions
CREATE POLICY "Employees can insert own quiz submissions"
ON public.car_quiz_submissions
FOR INSERT
WITH CHECK (employee_id = get_current_employee_id());

-- Employees can view their own submissions
CREATE POLICY "Employees can view own quiz submissions"
ON public.car_quiz_submissions
FOR SELECT
USING (employee_id = get_current_employee_id());

-- Managers can view all submissions
CREATE POLICY "Managers can view all quiz submissions"
ON public.car_quiz_submissions
FOR SELECT
USING (is_manager_or_above(auth.uid()));

-- Managers can manage all submissions
CREATE POLICY "Managers can manage quiz submissions"
ON public.car_quiz_submissions
FOR ALL
USING (is_manager_or_above(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_car_quiz_submissions_employee_id ON public.car_quiz_submissions(employee_id);
CREATE INDEX idx_car_quiz_submissions_submitted_at ON public.car_quiz_submissions(submitted_at DESC);