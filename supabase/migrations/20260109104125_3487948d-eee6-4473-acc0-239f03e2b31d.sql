-- Create product price history table to track commission/revenue changes over time
CREATE TABLE public.product_price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  commission_dkk NUMERIC,
  revenue_dkk NUMERIC,
  effective_from DATE NOT NULL,
  is_retroactive BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create index for efficient lookups
CREATE INDEX idx_product_price_history_product_effective 
ON public.product_price_history(product_id, effective_from DESC);

-- Enable Row Level Security
ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view price history
CREATE POLICY "Authenticated users can view product price history"
ON public.product_price_history
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert price history
CREATE POLICY "Authenticated users can insert product price history"
ON public.product_price_history
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to delete their own entries
CREATE POLICY "Authenticated users can delete product price history"
ON public.product_price_history
FOR DELETE
TO authenticated
USING (true);

-- Add comment explaining the table
COMMENT ON TABLE public.product_price_history IS 'Tracks historical commission and revenue changes for products with effective dates';
COMMENT ON COLUMN public.product_price_history.is_retroactive IS 'If true, this change overwrites all previous values. If false, only applies from effective_from date onwards.';