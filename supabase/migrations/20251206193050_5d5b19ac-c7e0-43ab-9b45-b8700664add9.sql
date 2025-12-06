-- Create webhook_endpoints table for managing incoming webhooks
CREATE TABLE public.webhook_endpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  endpoint_path TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  last_received_at TIMESTAMP WITH TIME ZONE,
  total_requests INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

-- Only owners can manage webhooks
CREATE POLICY "Owners can manage webhook_endpoints"
  ON public.webhook_endpoints
  FOR ALL
  USING (is_owner(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_webhook_endpoints_updated_at
  BEFORE UPDATE ON public.webhook_endpoints
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default Adversus webhook
INSERT INTO public.webhook_endpoints (name, type, endpoint_path, description)
VALUES (
  'Adversus Webhook',
  'adversus',
  'adversus-webhook',
  'Modtager salgsdata fra Adversus'
);