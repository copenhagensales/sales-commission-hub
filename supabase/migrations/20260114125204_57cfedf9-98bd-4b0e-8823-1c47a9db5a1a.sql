-- Add counts_as_sale and applied_at columns to product_price_history
ALTER TABLE product_price_history 
ADD COLUMN IF NOT EXISTS counts_as_sale boolean,
ADD COLUMN IF NOT EXISTS applied_at timestamp with time zone;