
ALTER TABLE public.data_field_definitions
  ADD COLUMN dialer_retention_days integer DEFAULT 180;

ALTER TABLE public.campaign_retention_policies
  ADD COLUMN no_data_held boolean NOT NULL DEFAULT false;
