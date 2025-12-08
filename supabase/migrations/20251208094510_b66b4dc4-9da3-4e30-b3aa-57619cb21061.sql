-- Set default weekly_hours to 37.5 for new employees
ALTER TABLE public.employee_master_data 
ALTER COLUMN weekly_hours SET DEFAULT 37.5;