-- Add revenue_amount column to products table
ALTER TABLE public.products
ADD COLUMN revenue_amount numeric DEFAULT 0;