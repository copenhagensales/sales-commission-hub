-- Add outcome column to sales table for storing the closing code from Adversus
ALTER TABLE public.sales ADD COLUMN outcome text;