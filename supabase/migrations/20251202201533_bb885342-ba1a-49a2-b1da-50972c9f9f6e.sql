-- Add campaign_name and customer_phone columns to sales table
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS campaign_name text,
ADD COLUMN IF NOT EXISTS customer_phone text;

-- Add comment for documentation
COMMENT ON COLUMN public.sales.campaign_name IS 'Adversus campaign name at time of sale';
COMMENT ON COLUMN public.sales.customer_phone IS 'Customer phone number from Adversus lead';