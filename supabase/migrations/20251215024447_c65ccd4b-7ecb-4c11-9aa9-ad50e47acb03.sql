
-- Fix get_aggregated_product_types to avoid duplicate products
-- Products without explicit campaign mapping will show under "missing mapping" (null client)
CREATE OR REPLACE FUNCTION public.get_aggregated_product_types()
 RETURNS TABLE(adversus_external_id text, adversus_product_title text, product_id uuid, product_name text, commission_dkk numeric, revenue_dkk numeric, product_client_campaign_id uuid, counts_as_sale boolean, client_id uuid, client_name text, sale_source text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      s.source as sale_source,
      -- Determine client_id ONLY from explicit campaign mappings
      -- First from product's campaign, then from sale's campaign
      -- NO fallback to source name matching - if no mapping, it's null (missing mapping)
      COALESCE(
        (SELECT cc.client_id FROM client_campaigns cc WHERE cc.id = p.client_campaign_id),
        (SELECT cc.client_id FROM client_campaigns cc WHERE cc.id = s.client_campaign_id)
      ) as derived_client_id,
      -- Prioritize rows that already have product_id assigned
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
    ri.derived_client_id as client_id,
    (SELECT name FROM clients WHERE id = ri.derived_client_id) as client_name,
    ri.sale_source
  FROM ranked_items ri
  WHERE ri.rn = 1
  ORDER BY 
    ri.derived_client_id NULLS FIRST,
    ri.adversus_product_title;
$function$;
