-- Add source column to agents table to support multiple dialers
ALTER TABLE public.agents 
ADD COLUMN source text DEFAULT 'adversus';

-- Rename column for clarity (external_id is more generic than external_adversus_id)
-- Keep the old column for backwards compatibility, add new generic one
ALTER TABLE public.agents 
ADD COLUMN external_dialer_id text;

-- Copy existing adversus IDs to the new generic column
UPDATE public.agents 
SET external_dialer_id = external_adversus_id 
WHERE external_adversus_id IS NOT NULL;

-- Create index for faster lookups by source and external_dialer_id
CREATE INDEX IF NOT EXISTS idx_agents_source ON public.agents(source);
CREATE INDEX IF NOT EXISTS idx_agents_external_dialer_id ON public.agents(external_dialer_id);
CREATE INDEX IF NOT EXISTS idx_agents_source_external_id ON public.agents(source, external_dialer_id);

-- Add comment for documentation
COMMENT ON COLUMN public.agents.source IS 'Dialer source: adversus, enreach, etc.';
COMMENT ON COLUMN public.agents.external_dialer_id IS 'External ID from the dialer system';