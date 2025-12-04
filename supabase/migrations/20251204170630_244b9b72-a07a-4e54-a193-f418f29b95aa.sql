-- Change standard_start_time from time to text to allow time ranges like "8.00-16.30"
ALTER TABLE employee_master_data 
ALTER COLUMN standard_start_time TYPE text 
USING standard_start_time::text;