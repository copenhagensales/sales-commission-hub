-- Add work_email column to employee_master_data
ALTER TABLE public.employee_master_data 
ADD COLUMN work_email text;