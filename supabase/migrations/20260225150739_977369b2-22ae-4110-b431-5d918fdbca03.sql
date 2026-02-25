ALTER TABLE supplier_discount_rules
ADD COLUMN min_days_per_location integer NOT NULL DEFAULT 1;

UPDATE supplier_discount_rules
SET min_days_per_location = 5
WHERE location_type = 'Danske Shoppingcentre';