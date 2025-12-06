-- Create table for API integrations configuration
CREATE TABLE public.api_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  sync_frequency_minutes INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  secrets JSONB DEFAULT '[]'::jsonb,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_integrations ENABLE ROW LEVEL SECURITY;

-- Only owners can manage API integrations
CREATE POLICY "Owners can manage API integrations"
ON public.api_integrations
FOR ALL
USING (public.is_owner(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_api_integrations_updated_at
BEFORE UPDATE ON public.api_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default integrations
INSERT INTO public.api_integrations (name, type, secrets, sync_frequency_minutes) VALUES
('Adversus', 'adversus', '["ADVERSUS_API_USERNAME", "ADVERSUS_API_PASSWORD"]', 60),
('e-conomic', 'economic', '["ECONOMIC_APP_SECRET_TOKEN", "ECONOMIC_AGREEMENT_GRANT_TOKEN"]', 1440),
('Microsoft 365', 'm365', '["M365_TENANT_ID", "M365_CLIENT_ID", "M365_CLIENT_SECRET", "M365_SENDER_EMAIL"]', null);