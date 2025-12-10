-- First delete booking_assignments that reference employees not in employee_master_data
DELETE FROM public.booking_assignment 
WHERE employee_id NOT IN (SELECT id FROM public.employee_master_data);

-- Delete employee_absences that reference employees not in employee_master_data
DELETE FROM public.employee_absence 
WHERE employee_id NOT IN (SELECT id FROM public.employee_master_data);

-- Now drop the old foreign key constraint on booking_assignment
ALTER TABLE public.booking_assignment 
DROP CONSTRAINT IF EXISTS booking_assignment_employee_id_fkey;

-- Add new foreign key to employee_master_data
ALTER TABLE public.booking_assignment
ADD CONSTRAINT booking_assignment_employee_id_fkey 
FOREIGN KEY (employee_id) REFERENCES public.employee_master_data(id) ON DELETE CASCADE;

-- Also update employee_absence to use employee_master_data
ALTER TABLE public.employee_absence 
DROP CONSTRAINT IF EXISTS employee_absence_employee_id_fkey;

ALTER TABLE public.employee_absence
ADD CONSTRAINT employee_absence_employee_id_fkey 
FOREIGN KEY (employee_id) REFERENCES public.employee_master_data(id) ON DELETE CASCADE;