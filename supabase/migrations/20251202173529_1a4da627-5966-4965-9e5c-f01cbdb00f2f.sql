
-- Create table for campaign to product mappings
CREATE TABLE public.campaign_product_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  adversus_campaign_id TEXT NOT NULL UNIQUE,
  adversus_campaign_name TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaign_product_mappings ENABLE ROW LEVEL SECURITY;

-- Admins can manage mappings
CREATE POLICY "Admins can manage campaign mappings" 
ON public.campaign_product_mappings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can view mappings
CREATE POLICY "Authenticated users can view mappings" 
ON public.campaign_product_mappings 
FOR SELECT 
USING (true);

-- Add updated_at trigger
CREATE TRIGGER update_campaign_product_mappings_updated_at
BEFORE UPDATE ON public.campaign_product_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
