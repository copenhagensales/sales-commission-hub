
-- Backfill Eesy TM cohorts with the correct client_campaign_id
UPDATE client_forecast_cohorts 
SET client_campaign_id = 'd031126c-aec0-4b80-bbe2-bbc31c4f04ba'
WHERE client_id = '81993a7b-ff24-46b8-8ffb-37a83138ddba'
  AND client_campaign_id IS NULL;

-- Backfill Eesy FM cohorts with the primary FM campaign (eesy FM Gaden Products)
UPDATE client_forecast_cohorts 
SET client_campaign_id = '5b563e97-4bad-459e-9255-5c6970f4c14c'
WHERE client_id = '9a92ea4c-6404-4b58-be08-065e7552d552'
  AND client_campaign_id IS NULL;
