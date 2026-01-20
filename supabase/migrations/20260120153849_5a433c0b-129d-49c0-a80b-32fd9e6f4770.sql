-- Drop den eksisterende foreign key constraint
ALTER TABLE sale_items 
DROP CONSTRAINT sale_items_matched_pricing_rule_id_fkey;

-- Opret den igen med ON DELETE SET NULL
ALTER TABLE sale_items
ADD CONSTRAINT sale_items_matched_pricing_rule_id_fkey
FOREIGN KEY (matched_pricing_rule_id)
REFERENCES product_pricing_rules(id)
ON DELETE SET NULL;