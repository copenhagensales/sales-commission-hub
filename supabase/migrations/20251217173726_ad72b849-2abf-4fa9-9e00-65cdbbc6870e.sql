-- Add forfeited_at column to track when someone forfeits/withdraws
ALTER TABLE h2h_challenges ADD COLUMN IF NOT EXISTS forfeited_at timestamp with time zone;
ALTER TABLE h2h_challenges ADD COLUMN IF NOT EXISTS forfeited_by uuid REFERENCES employee_master_data(id);