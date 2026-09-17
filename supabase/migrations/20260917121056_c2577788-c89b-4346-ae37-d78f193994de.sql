ALTER TABLE public.dialer_integrations DROP CONSTRAINT dialer_integrations_provider_check;
ALTER TABLE public.dialer_integrations ADD CONSTRAINT dialer_integrations_provider_check
  CHECK (provider = ANY (ARRAY['adversus'::text, 'enreach'::text, 'adversus_lederne'::text]));