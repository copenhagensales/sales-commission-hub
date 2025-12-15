-- Add counts_as_sale column to products table
ALTER TABLE public.products
ADD COLUMN counts_as_sale boolean NOT NULL DEFAULT true;