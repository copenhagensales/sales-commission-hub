-- Create extra_work table for tracking extra work registrations
CREATE TABLE public.extra_work (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES public.shift(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  from_time TIME NOT NULL,
  to_time TIME NOT NULL,
  hours NUMERIC GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (to_time - from_time)) / 3600
  ) STORED,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_by UUID REFERENCES public.employee_master_data(id),
  approved_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.extra_work ENABLE ROW LEVEL SECURITY;

-- Employees can view their own extra work entries
CREATE POLICY "Employees can view own extra work"
ON public.extra_work
FOR SELECT
USING (employee_id = get_current_employee_id());

-- Employees can create their own extra work entries
CREATE POLICY "Employees can create own extra work"
ON public.extra_work
FOR INSERT
WITH CHECK (employee_id = get_current_employee_id());

-- Employees can update their own pending extra work entries
CREATE POLICY "Employees can update own pending extra work"
ON public.extra_work
FOR UPDATE
USING (employee_id = get_current_employee_id() AND status = 'pending')
WITH CHECK (employee_id = get_current_employee_id());

-- Employees can delete their own pending extra work entries
CREATE POLICY "Employees can delete own pending extra work"
ON public.extra_work
FOR DELETE
USING (employee_id = get_current_employee_id() AND status = 'pending');

-- Owners can manage all extra work entries
CREATE POLICY "Owners can manage all extra work"
ON public.extra_work
FOR ALL
USING (is_owner(auth.uid()));

-- Teamledere can view and manage their team's extra work
CREATE POLICY "Teamledere can manage team extra work"
ON public.extra_work
FOR ALL
USING (is_teamleder_or_above(auth.uid()) AND can_view_employee(employee_id, auth.uid()));

-- Create index for common queries
CREATE INDEX idx_extra_work_employee_date ON public.extra_work(employee_id, date);
CREATE INDEX idx_extra_work_status ON public.extra_work(status);

-- Create trigger for updated_at
CREATE TRIGGER update_extra_work_updated_at
BEFORE UPDATE ON public.extra_work
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();