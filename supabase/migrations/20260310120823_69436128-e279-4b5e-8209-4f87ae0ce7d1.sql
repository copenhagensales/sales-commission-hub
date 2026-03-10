
-- Drop the overly restrictive check constraint
ALTER TABLE public.integration_logs DROP CONSTRAINT IF EXISTS integration_logs_integration_type_check;

-- Add updated constraint with all used types
ALTER TABLE public.integration_logs ADD CONSTRAINT integration_logs_integration_type_check 
  CHECK (integration_type IN ('dialer', 'crm', 'fieldmarketing', 'webhook', 'healer', 'system', 'manual'));
