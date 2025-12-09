-- Add external_reference_field_id column to adversus_campaign_mappings
-- This stores the Adversus Field ID where the Order ID (OPP) is located for each campaign
ALTER TABLE public.adversus_campaign_mappings 
ADD COLUMN external_reference_field_id text;