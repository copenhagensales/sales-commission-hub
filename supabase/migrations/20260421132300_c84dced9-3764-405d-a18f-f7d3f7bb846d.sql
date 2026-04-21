ALTER TABLE public.product_pricing_rules
  ADD COLUMN IF NOT EXISTS campaign_match_mode TEXT NOT NULL DEFAULT 'include'
  CHECK (campaign_match_mode IN ('include', 'exclude'));

ALTER TABLE public.pricing_rule_history
  ADD COLUMN IF NOT EXISTS campaign_match_mode TEXT NOT NULL DEFAULT 'include'
  CHECK (campaign_match_mode IN ('include', 'exclude'));

COMMENT ON COLUMN public.product_pricing_rules.campaign_match_mode IS
  'How campaign_mapping_ids is interpreted: include = match only listed campaigns; exclude = match all EXCEPT listed campaigns. Universal (null/empty list) ignores this field.';