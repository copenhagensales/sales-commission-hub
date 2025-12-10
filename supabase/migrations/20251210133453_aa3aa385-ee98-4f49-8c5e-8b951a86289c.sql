-- Add dialer_campaign_id column to track raw campaign ID from dialers
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS dialer_campaign_id text;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_sales_dialer_campaign_id ON public.sales(dialer_campaign_id);