-- Add allows_immediate_payment column to product_pricing_rules
ALTER TABLE product_pricing_rules 
ADD COLUMN allows_immediate_payment BOOLEAN DEFAULT false;