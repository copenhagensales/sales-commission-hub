-- Drop the old manager_data_access column and add manager_data_scope
ALTER TABLE public.job_positions DROP COLUMN IF EXISTS manager_data_access;

-- Add the new manager_data_scope column with text type for the scope values
ALTER TABLE public.job_positions ADD COLUMN IF NOT EXISTS manager_data_scope text DEFAULT 'team';

-- Add a check constraint to ensure valid values
ALTER TABLE public.job_positions ADD CONSTRAINT job_positions_manager_data_scope_check 
  CHECK (manager_data_scope IN ('all', 'team', 'self'));