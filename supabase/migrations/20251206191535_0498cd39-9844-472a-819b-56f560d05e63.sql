-- Add enabled_sources field to store which data sources are enabled for each integration
ALTER TABLE public.api_integrations 
ADD COLUMN enabled_sources JSONB DEFAULT '[]'::jsonb;

-- Update existing integrations with their available data sources
UPDATE public.api_integrations 
SET enabled_sources = '["campaigns", "sales", "users"]'::jsonb
WHERE type = 'adversus';

UPDATE public.api_integrations 
SET enabled_sources = '["journal_entries", "accounts"]'::jsonb
WHERE type = 'economic';

UPDATE public.api_integrations 
SET enabled_sources = '["send_emails"]'::jsonb
WHERE type = 'm365';