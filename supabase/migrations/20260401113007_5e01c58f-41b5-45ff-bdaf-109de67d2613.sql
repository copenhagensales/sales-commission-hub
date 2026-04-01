
-- Add merged_into_product_id column to products
ALTER TABLE public.products ADD COLUMN merged_into_product_id UUID REFERENCES public.products(id);

-- Create product_merge_history audit table
CREATE TABLE public.product_merge_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_product_id UUID NOT NULL,
  target_product_id UUID NOT NULL REFERENCES public.products(id),
  merged_by UUID REFERENCES auth.users(id),
  merged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_product_name TEXT,
  adversus_mappings_moved INT DEFAULT 0,
  sale_items_moved INT DEFAULT 0,
  pricing_rules_moved INT DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.product_merge_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read and insert
CREATE POLICY "Authenticated users can read merge history"
  ON public.product_merge_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert merge history"
  ON public.product_merge_history FOR INSERT TO authenticated WITH CHECK (true);
