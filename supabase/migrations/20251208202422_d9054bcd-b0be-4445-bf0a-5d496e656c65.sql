-- Create table for multi-tenant dialer integrations
CREATE TABLE public.dialer_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('adversus', 'enreach')),
  encrypted_credentials TEXT NOT NULL,
  api_url TEXT,
  is_active BOOLEAN DEFAULT true,
  sync_frequency_minutes INTEGER DEFAULT 60,
  last_sync_at TIMESTAMPTZ,
  last_status TEXT,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add comments
COMMENT ON TABLE public.dialer_integrations IS 'Multi-tenant dialer integrations (Adversus, Enreach, etc.)';
COMMENT ON COLUMN public.dialer_integrations.name IS 'Friendly name e.g. "Adversus CPH Team"';
COMMENT ON COLUMN public.dialer_integrations.provider IS 'Dialer provider type';
COMMENT ON COLUMN public.dialer_integrations.encrypted_credentials IS 'Encrypted API credentials JSON';

-- Enable RLS
ALTER TABLE public.dialer_integrations ENABLE ROW LEVEL SECURITY;

-- Only owners can manage dialer integrations
CREATE POLICY "Owners can manage dialer integrations"
ON public.dialer_integrations
FOR ALL
USING (is_owner(auth.uid()))
WITH CHECK (is_owner(auth.uid()));

-- Create index for active integrations
CREATE INDEX idx_dialer_integrations_active ON public.dialer_integrations(is_active) WHERE is_active = true;