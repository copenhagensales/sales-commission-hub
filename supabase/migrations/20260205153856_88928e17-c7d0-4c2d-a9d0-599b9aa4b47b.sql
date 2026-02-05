-- Add is_immediate_payment column to sale_items table
ALTER TABLE sale_items ADD COLUMN is_immediate_payment boolean DEFAULT false;