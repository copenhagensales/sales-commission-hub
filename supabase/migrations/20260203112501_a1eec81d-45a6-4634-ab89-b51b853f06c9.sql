-- Add counts_as_cross_sale column to products table
ALTER TABLE products 
ADD COLUMN counts_as_cross_sale BOOLEAN NOT NULL DEFAULT false;

-- Add counts_as_cross_sale column to product_price_history for historical tracking
ALTER TABLE product_price_history 
ADD COLUMN counts_as_cross_sale BOOLEAN DEFAULT false;