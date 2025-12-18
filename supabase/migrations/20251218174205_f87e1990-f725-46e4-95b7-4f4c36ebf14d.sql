-- Create table for campaign-specific commission and revenue overrides
CREATE TABLE public.product_campaign_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  campaign_mapping_id UUID NOT NULL REFERENCES public.adversus_campaign_mappings(id) ON DELETE CASCADE,
  commission_dkk NUMERIC DEFAULT 0,
  revenue_dkk NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, campaign_mapping_id)
);

-- Enable RLS
ALTER TABLE public.product_campaign_overrides ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view overrides
CREATE POLICY "Authenticated users can view overrides" 
ON public.product_campaign_overrides 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Allow authenticated users to manage overrides
CREATE POLICY "Authenticated users can manage overrides" 
ON public.product_campaign_overrides 
FOR ALL 
USING (auth.role() = 'authenticated');

-- Add index for faster lookups
CREATE INDEX idx_product_campaign_overrides_product ON public.product_campaign_overrides(product_id);
CREATE INDEX idx_product_campaign_overrides_campaign ON public.product_campaign_overrides(campaign_mapping_id);

-- Comment on table
COMMENT ON TABLE public.product_campaign_overrides IS 'Stores campaign-specific commission and revenue overrides for products';