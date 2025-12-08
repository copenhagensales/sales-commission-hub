-- Create time_stamps table for clock in/out records
CREATE TABLE public.time_stamps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  clock_in TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  clock_out TIMESTAMP WITH TIME ZONE,
  shift_id UUID REFERENCES public.shift(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.time_stamps ENABLE ROW LEVEL SECURITY;

-- Employees can view their own time stamps
CREATE POLICY "Employees can view own time stamps"
ON public.time_stamps
FOR SELECT
USING (employee_id = get_current_employee_id());

-- Employees can insert their own time stamps
CREATE POLICY "Employees can insert own time stamps"
ON public.time_stamps
FOR INSERT
WITH CHECK (employee_id = get_current_employee_id());

-- Employees can update their own time stamps (for clock out)
CREATE POLICY "Employees can update own time stamps"
ON public.time_stamps
FOR UPDATE
USING (employee_id = get_current_employee_id());

-- Owners can manage all time stamps
CREATE POLICY "Owners can manage all time stamps"
ON public.time_stamps
FOR ALL
USING (is_owner(auth.uid()));

-- Teamledere can view team time stamps
CREATE POLICY "Teamledere can view team time stamps"
ON public.time_stamps
FOR SELECT
USING (is_teamleder_or_above(auth.uid()) AND can_view_employee(employee_id, auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_time_stamps_employee_id ON public.time_stamps(employee_id);
CREATE INDEX idx_time_stamps_clock_in ON public.time_stamps(clock_in DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_time_stamps_updated_at
  BEFORE UPDATE ON public.time_stamps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();