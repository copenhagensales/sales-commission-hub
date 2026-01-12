-- Create employee_standard_shifts junction table
-- Links specific employees to specific standard shifts (for special shift assignments)

CREATE TABLE public.employee_standard_shifts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES public.team_standard_shifts(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Each employee can only be assigned to one shift per team
  UNIQUE (employee_id, shift_id)
);

-- Create index for faster lookups
CREATE INDEX idx_employee_standard_shifts_employee ON public.employee_standard_shifts(employee_id);
CREATE INDEX idx_employee_standard_shifts_shift ON public.employee_standard_shifts(shift_id);

-- Enable RLS
ALTER TABLE public.employee_standard_shifts ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only managers and owners can manage employee shift assignments
CREATE POLICY "Managers can view employee shift assignments"
ON public.employee_standard_shifts
FOR SELECT
USING (public.is_manager_or_above(auth.uid()));

CREATE POLICY "Managers can create employee shift assignments"
ON public.employee_standard_shifts
FOR INSERT
WITH CHECK (public.is_manager_or_above(auth.uid()));

CREATE POLICY "Managers can update employee shift assignments"
ON public.employee_standard_shifts
FOR UPDATE
USING (public.is_manager_or_above(auth.uid()));

CREATE POLICY "Managers can delete employee shift assignments"
ON public.employee_standard_shifts
FOR DELETE
USING (public.is_manager_or_above(auth.uid()));

-- Add comment for documentation
COMMENT ON TABLE public.employee_standard_shifts IS 'Junction table linking employees to specific standard shifts. Used for "special shifts" where individual employees need different shift configurations than the team default.';