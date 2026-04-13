-- Add UNIQUE constraint to enforce one standard shift per employee
ALTER TABLE public.employee_standard_shifts
ADD CONSTRAINT unique_employee_standard_shift UNIQUE (employee_id);