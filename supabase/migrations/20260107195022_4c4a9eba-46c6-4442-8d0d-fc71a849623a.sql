-- Add daily_bonus_client_id to employee_master_data (used ONLY for daily bonus calculations)
ALTER TABLE employee_master_data 
ADD COLUMN daily_bonus_client_id uuid REFERENCES clients(id);

COMMENT ON COLUMN employee_master_data.daily_bonus_client_id IS 
'Client ID used ONLY for daily bonus calculations. Does not affect other functionality.';

-- Add daily_bonus_client_id to cohort_members (stores selection when assigning to cohort)
ALTER TABLE cohort_members
ADD COLUMN daily_bonus_client_id uuid REFERENCES clients(id);