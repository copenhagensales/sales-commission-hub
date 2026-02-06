-- Add use_rule_name_as_display to product_pricing_rules
ALTER TABLE public.product_pricing_rules 
ADD COLUMN IF NOT EXISTS use_rule_name_as_display BOOLEAN DEFAULT false;

-- Add display_name to sale_items for storing the overridden name
ALTER TABLE public.sale_items 
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.product_pricing_rules.use_rule_name_as_display IS 'If true, the rule name will be used as display name instead of product name';
COMMENT ON COLUMN public.sale_items.display_name IS 'Override display name from matched pricing rule. NULL = use product name';