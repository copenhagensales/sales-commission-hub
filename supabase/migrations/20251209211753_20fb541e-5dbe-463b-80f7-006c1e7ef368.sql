-- Update the provider check constraint on dialer_integrations to allow 'enreach'
ALTER TABLE public.dialer_integrations DROP CONSTRAINT IF EXISTS dialer_integrations_provider_check;
ALTER TABLE public.dialer_integrations ADD CONSTRAINT dialer_integrations_provider_check CHECK (provider IN ('adversus', 'enreach'));