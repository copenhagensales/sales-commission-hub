-- "FDM eksisterende" ligger i samme Enreach-opsætning som Tryg Kanvas.
INSERT INTO public.weekly_lead_report_campaign_map
  (account, adversus_campaign_id, adversus_campaign_name, report_line, is_confirmed, confirmed_at)
VALUES
  ('enreach', 'CAMP20182S3064', 'FDM eksisterende', 'FDM 1+', true, now())
ON CONFLICT (account, adversus_campaign_id) DO UPDATE
  SET adversus_campaign_name = EXCLUDED.adversus_campaign_name,
      report_line = EXCLUDED.report_line,
      is_confirmed = true,
      confirmed_at = now(),
      updated_at = now();

-- "CPH sales redning" er en Enreach-kampagne, ikke Adversus. Ingen rapportlinje.
DELETE FROM public.weekly_lead_report_campaign_map
WHERE account = 'main' AND adversus_campaign_id = 'CAMP20068S3064';

INSERT INTO public.weekly_lead_report_campaign_map
  (account, adversus_campaign_id, adversus_campaign_name, report_line, is_confirmed)
VALUES
  ('enreach', 'CAMP20068S3064', 'CPH sales redning', NULL, false)
ON CONFLICT (account, adversus_campaign_id) DO UPDATE
  SET adversus_campaign_name = EXCLUDED.adversus_campaign_name,
      updated_at = now();