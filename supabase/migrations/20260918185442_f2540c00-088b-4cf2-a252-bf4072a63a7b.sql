ALTER TABLE public.weekly_lead_report_campaign_map
  DROP CONSTRAINT IF EXISTS weekly_lead_report_campaign_map_account_check;
ALTER TABLE public.weekly_lead_report_campaign_map
  ADD CONSTRAINT weekly_lead_report_campaign_map_account_check
  CHECK (account IN ('main', 'lederne', 'enreach'));

ALTER TABLE public.weekly_lead_closure_stats
  DROP CONSTRAINT IF EXISTS weekly_lead_closure_stats_account_check;
ALTER TABLE public.weekly_lead_closure_stats
  ADD CONSTRAINT weekly_lead_closure_stats_account_check
  CHECK (account IN ('main', 'lederne', 'enreach'));