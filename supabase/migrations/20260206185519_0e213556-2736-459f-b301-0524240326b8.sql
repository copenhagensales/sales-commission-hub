-- Migration: Add date-based validity to pricing rules + pricing rule history table

-- Add effective_from and effective_to columns to product_pricing_rules
ALTER TABLE product_pricing_rules 
ADD COLUMN IF NOT EXISTS effective_from DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS effective_to DATE DEFAULT NULL;

COMMENT ON COLUMN product_pricing_rules.effective_from IS 'Reglen gælder fra denne dato (inklusiv)';
COMMENT ON COLUMN product_pricing_rules.effective_to IS 'Reglen gælder til denne dato (eksklusiv). NULL = ingen slutdato';

-- Create index for date-based queries
CREATE INDEX IF NOT EXISTS idx_pricing_rules_effective_dates 
ON product_pricing_rules (product_id, effective_from, effective_to);

-- Create pricing_rule_history table for tracking rule changes
CREATE TABLE IF NOT EXISTS pricing_rule_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_rule_id UUID REFERENCES product_pricing_rules(id) ON DELETE CASCADE,
  name TEXT,
  commission_dkk NUMERIC,
  revenue_dkk NUMERIC,
  conditions JSONB,
  campaign_mapping_ids UUID[],
  effective_from DATE,
  effective_to DATE,
  priority INTEGER,
  is_active BOOLEAN,
  allows_immediate_payment BOOLEAN,
  immediate_payment_commission_dkk NUMERIC,
  immediate_payment_revenue_dkk NUMERIC,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  changed_by UUID REFERENCES auth.users(id),
  change_type TEXT DEFAULT 'update' -- 'create', 'update', 'delete'
);

-- Enable RLS on pricing_rule_history
ALTER TABLE pricing_rule_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for pricing_rule_history
CREATE POLICY "Authenticated can read pricing rule history" 
ON pricing_rule_history 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated can insert pricing rule history" 
ON pricing_rule_history 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Create index for faster history lookups
CREATE INDEX IF NOT EXISTS idx_pricing_rule_history_rule_id 
ON pricing_rule_history (pricing_rule_id);

CREATE INDEX IF NOT EXISTS idx_pricing_rule_history_changed_at 
ON pricing_rule_history (changed_at DESC);