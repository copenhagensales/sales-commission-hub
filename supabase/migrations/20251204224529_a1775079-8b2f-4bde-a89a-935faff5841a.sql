-- Create table for tracking employee lateness/delays
CREATE TABLE public.lateness_record (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  date date NOT NULL,
  minutes integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);

-- Enable RLS
ALTER TABLE public.lateness_record ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Employees can view their own lateness records"
ON public.lateness_record
FOR SELECT
USING (employee_id = get_current_employee_id());

CREATE POLICY "Managers can manage all lateness records"
ON public.lateness_record
FOR ALL
USING (is_manager_or_above(auth.uid()));