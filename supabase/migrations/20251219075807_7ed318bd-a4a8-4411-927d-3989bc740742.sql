-- Add must_change_password flag to employee_master_data
ALTER TABLE employee_master_data 
ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false;