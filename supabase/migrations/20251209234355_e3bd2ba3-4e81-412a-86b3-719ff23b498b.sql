-- Add source column to sales table to track which dialer system the sale came from
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS source text DEFAULT 'adversus';

-- Update existing rows to have 'adversus' as the source (they all came from Adversus before)
UPDATE public.sales SET source = 'adversus' WHERE source IS NULL;

-- Add an index for efficient filtering by source
CREATE INDEX IF NOT EXISTS idx_sales_source ON public.sales(source);