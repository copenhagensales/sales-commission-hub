-- Add matched_pricing_rule_id column to sale_items for tracking which pricing rule was applied
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS matched_pricing_rule_id UUID REFERENCES product_pricing_rules(id);

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_sale_items_matched_pricing_rule_id ON sale_items(matched_pricing_rule_id) WHERE matched_pricing_rule_id IS NOT NULL;