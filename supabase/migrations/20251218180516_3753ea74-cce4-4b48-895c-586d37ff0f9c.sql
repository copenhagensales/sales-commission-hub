-- Add column to store campaign mapping per client
ALTER TABLE public.location
ADD COLUMN IF NOT EXISTS client_campaign_mapping JSONB DEFAULT '{}'::jsonb;

-- Add comment
COMMENT ON COLUMN public.location.client_campaign_mapping IS 'Maps client_id to campaign_id for booking purposes';