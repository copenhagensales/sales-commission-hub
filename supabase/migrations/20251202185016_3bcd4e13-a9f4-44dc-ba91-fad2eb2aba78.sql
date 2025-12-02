-- Add outcome column to campaign_product_mappings
ALTER TABLE public.campaign_product_mappings 
ADD COLUMN adversus_outcome text;

-- Drop the old unique constraint on just campaign_id
ALTER TABLE public.campaign_product_mappings 
DROP CONSTRAINT IF EXISTS campaign_product_mappings_adversus_campaign_id_key;

-- Create new unique constraint on campaign_id + outcome combination
ALTER TABLE public.campaign_product_mappings 
ADD CONSTRAINT campaign_product_mappings_campaign_outcome_key 
UNIQUE (adversus_campaign_id, adversus_outcome);

-- Add index for faster lookups
CREATE INDEX idx_campaign_mappings_outcome ON public.campaign_product_mappings(adversus_outcome);