-- Add agent_email column to sales table
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS agent_email text;