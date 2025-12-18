-- Add campaign_id column to booking table
ALTER TABLE public.booking 
ADD COLUMN campaign_id uuid REFERENCES public.client_campaigns(id);

-- Create index for better performance
CREATE INDEX idx_booking_campaign_id ON public.booking(campaign_id);