-- Add raw_payload column to sales table to store the complete JSON from each sale
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS raw_payload JSONB DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.sales.raw_payload IS 'Complete raw JSON payload received from the dialer integration (Adversus, Enreach, etc.)';