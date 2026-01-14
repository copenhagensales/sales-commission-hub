-- Create product_pricing_rules table for advanced conditional pricing
CREATE TABLE product_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  campaign_mapping_id UUID REFERENCES adversus_campaign_mappings(id) ON DELETE SET NULL,
  
  -- Conditions as JSONB for flexibility
  -- Example: {"Tilskud": "100%", "Hoved oms trin": "ATL"}
  conditions JSONB NOT NULL DEFAULT '{}',
  
  -- Resulting pricing
  commission_dkk NUMERIC(12,2) NOT NULL,
  revenue_dkk NUMERIC(12,2) NOT NULL,
  
  -- Priority (higher = matches first)
  priority INTEGER DEFAULT 0,
  
  -- Metadata
  name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX idx_pricing_rules_product ON product_pricing_rules(product_id);
CREATE INDEX idx_pricing_rules_campaign ON product_pricing_rules(campaign_mapping_id);
CREATE INDEX idx_pricing_rules_active ON product_pricing_rules(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE product_pricing_rules ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Authenticated users can read pricing rules" 
ON product_pricing_rules FOR SELECT 
TO authenticated
USING (true);

-- Allow owners/teamleaders to manage
CREATE POLICY "Managers can manage pricing rules" 
ON product_pricing_rules FOR ALL 
TO authenticated
USING (is_teamleder_or_above(auth.uid()))
WITH CHECK (is_teamleder_or_above(auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_product_pricing_rules_updated_at
BEFORE UPDATE ON product_pricing_rules
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();