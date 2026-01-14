-- Add is_hidden column to products table
ALTER TABLE public.products 
ADD COLUMN is_hidden BOOLEAN DEFAULT false;