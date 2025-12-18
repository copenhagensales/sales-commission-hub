-- Add client_id to booking table for proper client tracking
ALTER TABLE public.booking
ADD COLUMN client_id uuid REFERENCES public.clients(id);

-- Create index for performance
CREATE INDEX idx_booking_client_id ON public.booking(client_id);