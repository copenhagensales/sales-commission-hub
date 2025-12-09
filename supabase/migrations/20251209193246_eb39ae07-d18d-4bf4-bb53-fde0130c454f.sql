-- Rename column to JSONB for flexible extraction config
ALTER TABLE public.adversus_campaign_mappings 
DROP COLUMN IF EXISTS external_reference_field_id;

ALTER TABLE public.adversus_campaign_mappings 
ADD COLUMN reference_extraction_config JSONB DEFAULT NULL;

COMMENT ON COLUMN public.adversus_campaign_mappings.reference_extraction_config IS 
'Stores extraction config for external reference field, e.g., {"type": "field_id", "value": "80862"} for Adversus';