-- RPC function to get sales with unknown products (adversus_product_title = 'Unknown')
-- Returns comprehensive data for debugging product mapping issues
CREATE OR REPLACE FUNCTION public.get_sales_with_unknown_products()
RETURNS TABLE (
  sale_id uuid,
  sale_external_id text,
  sale_datetime timestamptz,
  agent_name text,
  agent_email text,
  customer_company text,
  customer_phone text,
  source text,
  integration_type text,
  dialer_campaign_id text,
  campaign_name text,
  raw_payload jsonb,
  sale_item_id uuid,
  product_title text,
  product_external_id text,
  quantity integer,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    s.id as sale_id,
    s.adversus_external_id as sale_external_id,
    s.sale_datetime,
    s.agent_name,
    s.agent_email,
    s.customer_company,
    s.customer_phone,
    s.source,
    s.integration_type,
    s.dialer_campaign_id,
    COALESCE(acm.adversus_campaign_name, cc.name) as campaign_name,
    s.raw_payload,
    si.id as sale_item_id,
    si.adversus_product_title as product_title,
    si.adversus_external_id as product_external_id,
    si.quantity,
    si.created_at
  FROM sale_items si
  JOIN sales s ON s.id = si.sale_id
  LEFT JOIN adversus_campaign_mappings acm ON acm.adversus_campaign_id = s.dialer_campaign_id
  LEFT JOIN client_campaigns cc ON cc.id = s.client_campaign_id
  WHERE si.adversus_product_title = 'Unknown'
     OR si.adversus_external_id = 'unknown'
  ORDER BY s.sale_datetime DESC
$$;