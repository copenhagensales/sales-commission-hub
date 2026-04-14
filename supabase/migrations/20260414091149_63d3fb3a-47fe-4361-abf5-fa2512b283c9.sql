
-- Add unit_price column to adversus_product_mappings for price-based differentiation
ALTER TABLE public.adversus_product_mappings
ADD COLUMN unit_price numeric DEFAULT NULL;

-- Add a comment explaining the purpose
COMMENT ON COLUMN public.adversus_product_mappings.unit_price IS 'Optional unit price filter. When set, this mapping only applies to sale items with this specific unit price. NULL means match any price.';

-- Create a unique index that allows price-specific AND price-agnostic mappings
-- (adversus_external_id + unit_price must be unique, with NULLs treated as distinct)
CREATE UNIQUE INDEX idx_adversus_product_mappings_ext_id_price 
ON public.adversus_product_mappings (adversus_external_id, COALESCE(unit_price, -1));
