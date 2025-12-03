-- Add customer reference to campaign mappings
ALTER TABLE public.campaign_product_mappings 
ADD COLUMN liquidity_customer_id uuid REFERENCES public.liquidity_customers(id);

-- Create index for faster lookups
CREATE INDEX idx_campaign_mappings_customer ON public.campaign_product_mappings(liquidity_customer_id);