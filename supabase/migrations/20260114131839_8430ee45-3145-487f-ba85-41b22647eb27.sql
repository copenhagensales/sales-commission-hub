-- Optimize get_aggregated_product_types using DISTINCT ON instead of ROW_NUMBER()
CREATE OR REPLACE FUNCTION public.get_aggregated_product_types()
 RETURNS TABLE(adversus_external_id text, adversus_product_title text, product_id uuid, product_name text, commission_dkk numeric, revenue_dkk numeric, product_client_campaign_id uuid, counts_as_sale boolean, is_hidden boolean, client_id uuid, client_name text, sale_source text)
 LANGUAGE sql
 STABLE
AS $$
  SELECT DISTINCT ON (si.adversus_external_id, si.adversus_product_title)
    si.adversus_external_id,
    si.adversus_product_title,
    si.product_id,
    p.name as product_name,
    p.commission_dkk,
    p.revenue_dkk,
    p.client_campaign_id as product_client_campaign_id,
    COALESCE(p.counts_as_sale, true) as counts_as_sale,
    COALESCE(p.is_hidden, false) as is_hidden,
    COALESCE(cc_prod.client_id, cc_sale.client_id) as client_id,
    c.name as client_name,
    s.source as sale_source
  FROM sale_items si
  LEFT JOIN products p ON p.id = si.product_id
  LEFT JOIN sales s ON s.id = si.sale_id
  LEFT JOIN client_campaigns cc_prod ON cc_prod.id = p.client_campaign_id
  LEFT JOIN client_campaigns cc_sale ON cc_sale.id = s.client_campaign_id
  LEFT JOIN clients c ON c.id = COALESCE(cc_prod.client_id, cc_sale.client_id)
  WHERE si.adversus_product_title IS NOT NULL
  ORDER BY 
    si.adversus_external_id,
    si.adversus_product_title,
    CASE WHEN si.product_id IS NOT NULL THEN 0 ELSE 1 END,
    si.created_at DESC;
$$;