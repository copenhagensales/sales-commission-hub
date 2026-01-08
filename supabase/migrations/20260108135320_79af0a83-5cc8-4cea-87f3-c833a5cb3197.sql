-- Add manager position columns to job_positions
ALTER TABLE public.job_positions 
ADD COLUMN is_manager boolean NOT NULL DEFAULT false,
ADD COLUMN manager_data_access jsonb DEFAULT '{"sales": false, "employees": false, "calls": false, "contracts": false, "finance": false}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.job_positions.is_manager IS 'Whether this position has manager-level access';
COMMENT ON COLUMN public.job_positions.manager_data_access IS 'JSON object specifying which data types this manager position can access';