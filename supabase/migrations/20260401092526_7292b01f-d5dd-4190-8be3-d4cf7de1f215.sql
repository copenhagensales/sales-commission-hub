-- Map the 5 Eesy TM Adversus campaigns to the Eesy TM Products client campaign
UPDATE adversus_campaign_mappings 
SET client_campaign_id = 'd031126c-aec0-4b80-bbe2-bbc31c4f04ba', updated_at = now() 
WHERE adversus_campaign_id IN ('108534','108545','108546','108919','111930') 
AND client_campaign_id IS NULL;

-- Backfill existing Eesy TM sales with the correct client_campaign_id
UPDATE sales 
SET client_campaign_id = 'd031126c-aec0-4b80-bbe2-bbc31c4f04ba', updated_at = now() 
WHERE source = 'Eesy TM' AND client_campaign_id IS NULL;