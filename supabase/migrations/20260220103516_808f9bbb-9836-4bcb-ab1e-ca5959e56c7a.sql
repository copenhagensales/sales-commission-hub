-- Add is_active column to products table (referenced by create_fm_sale_items trigger)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Also add priority column if missing (used in ORDER BY in trigger)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS priority integer DEFAULT 0;