-- Add new columns for enhanced salary type definition
ALTER TABLE salary_types
  ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS amount_type TEXT DEFAULT 'fixed' CHECK (amount_type IN ('fixed', 'percentage')),
  ADD COLUMN IF NOT EXISTS calculation_basis TEXT DEFAULT 'fixed' CHECK (calculation_basis IN ('sales', 'hours', 'commission', 'fixed', 'custom')),
  ADD COLUMN IF NOT EXISTS calculation_formula TEXT,
  ADD COLUMN IF NOT EXISTS activation_condition TEXT,
  ADD COLUMN IF NOT EXISTS group_restriction_type TEXT DEFAULT 'all' CHECK (group_restriction_type IN ('all', 'teams', 'positions', 'clients')),
  ADD COLUMN IF NOT EXISTS group_restriction_ids UUID[],
  ADD COLUMN IF NOT EXISTS payout_frequency TEXT DEFAULT 'monthly' CHECK (payout_frequency IN ('per_sale', 'daily', 'weekly', 'monthly', 'period'));

-- Migrate existing code values to amount column
UPDATE salary_types SET 
  amount = CASE 
    WHEN code ~ '^-?[0-9]+(\.[0-9]+)?$' THEN code::DECIMAL
    WHEN code ~ '^-?[0-9]+(\.[0-9]+)?%$' THEN REPLACE(code, '%', '')::DECIMAL
    ELSE NULL 
  END,
  amount_type = CASE 
    WHEN code LIKE '%\%%' THEN 'percentage'
    ELSE 'fixed'
  END
WHERE code IS NOT NULL;

-- Drop old code column
ALTER TABLE salary_types DROP COLUMN IF EXISTS code;