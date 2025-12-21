-- Add is_staff_employee column to employee_master_data table
ALTER TABLE public.employee_master_data 
ADD COLUMN is_staff_employee boolean NOT NULL DEFAULT false;

-- Create index for efficient filtering
CREATE INDEX idx_employee_master_data_is_staff_employee ON public.employee_master_data(is_staff_employee);