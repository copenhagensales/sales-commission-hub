ALTER TABLE public.weekly_lead_closure_settings
  ADD COLUMN flow_status boolean NOT NULL DEFAULT false;
ALTER TABLE public.weekly_lead_closure_settings
  ADD CONSTRAINT weekly_lead_closure_settings_flow_internal_only
  CHECK (NOT flow_status OR lower(recipient_email) LIKE '%@copenhagensales.dk');
COMMENT ON COLUMN public.weekly_lead_closure_settings.flow_status IS 'Modtager den interne mail Leveringsstatus Tryg. Kun @copenhagensales.dk (intern rapport, aldrig til kunden).';