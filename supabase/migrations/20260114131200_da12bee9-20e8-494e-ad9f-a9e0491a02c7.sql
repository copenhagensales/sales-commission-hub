DROP FUNCTION IF EXISTS get_aggregated_product_types();

CREATE OR REPLACE FUNCTION get_aggregated_product_types()
RETURNS TABLE (
  adversus_external_id TEXT,
  adversus_product_title TEXT,
  product_id UUID,
  product_name TEXT,
  commission_dkk NUMERIC,
  revenue_dkk NUMERIC,
  product_client_campaign_id UUID,
  counts_as_sale BOOLEAN,
  is_hidden BOOLEAN,
  client_id UUID,
  client_name TEXT,
  sale_source TEXT
) AS $$
  WITH ranked_items AS (
    SELECT 
      si.adversus_external_id,
      si.adversus_product_title,
      si.product_id,
      p.name as product_name,
      p.commission_dkk,
      p.revenue_dkk,
      p.client_campaign_id as product_client_campaign_id,
      COALESCE(p.counts_as_sale, true) as counts_as_sale,
      COALESCE(p.is_hidden, false) as is_hidden,
      s.source as sale_source,
      cc_prod.client_id as prod_client_id,
      cc_sale.client_id as sale_client_id,
      ROW_NUMBER() OVER (
        PARTITION BY 
          COALESCE(si.adversus_external_id, ''),
          COALESCE(si.adversus_product_title, '')
        ORDER BY 
          CASE WHEN si.product_id IS NOT NULL THEN 0 ELSE 1 END,
          si.created_at DESC
      ) as rn
    FROM sale_items si
    LEFT JOIN products p ON p.id = si.product_id
    LEFT JOIN sales s ON s.id = si.sale_id
    LEFT JOIN client_campaigns cc_prod ON cc_prod.id = p.client_campaign_id
    LEFT JOIN client_campaigns cc_sale ON cc_sale.id = s.client_campaign_id
    WHERE si.adversus_product_title IS NOT NULL
  )
  SELECT 
    ri.adversus_external_id,
    ri.adversus_product_title,
    ri.product_id,
    ri.product_name,
    ri.commission_dkk,
    ri.revenue_dkk,
    ri.product_client_campaign_id,
    ri.counts_as_sale,
    ri.is_hidden,
    COALESCE(ri.prod_client_id, ri.sale_client_id) as client_id,
    c.name as client_name,
    ri.sale_source
  FROM ranked_items ri
  LEFT JOIN clients c ON c.id = COALESCE(ri.prod_client_id, ri.sale_client_id)
  WHERE ri.rn = 1
  ORDER BY 
    COALESCE(ri.prod_client_id, ri.sale_client_id) NULLS FIRST,
    ri.adversus_product_title;
$$ LANGUAGE SQL STABLE;