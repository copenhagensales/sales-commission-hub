
-- Create RPC function to get sales statistics by client for a date range
CREATE OR REPLACE FUNCTION public.get_client_sales_stats(
  p_start_date timestamp with time zone DEFAULT NULL,
  p_end_date timestamp with time zone DEFAULT NULL
)
RETURNS TABLE (
  client_id uuid,
  client_name text,
  sales_today bigint,
  sales_month bigint,
  revenue_today numeric,
  revenue_month numeric,
  commission_today numeric,
  commission_month numeric,
  top_sellers jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_start_today timestamp with time zone;
  v_start_month timestamp with time zone;
  v_end_date timestamp with time zone;
BEGIN
  -- Set default date ranges
  v_end_date := COALESCE(p_end_date, now());
  v_start_today := date_trunc('day', v_end_date);
  v_start_month := COALESCE(p_start_date, date_trunc('month', v_end_date));

  RETURN QUERY
  WITH product_mapping AS (
    -- Get product info from aggregated view, prioritizing mapped products
    SELECT DISTINCT ON (apt.adversus_product_title)
      apt.adversus_product_title,
      COALESCE(
        -- First try: product's campaign -> client
        (SELECT cc.client_id FROM client_campaigns cc WHERE cc.id = p.client_campaign_id),
        -- Second try: explicit mapping client
        apt.product_id
      ) as mapped_client_id,
      COALESCE(p.counts_as_sale, true) as counts_as_sale,
      COALESCE(p.commission_dkk, 0) as commission_dkk,
      COALESCE(p.revenue_dkk, 0) as revenue_dkk
    FROM adversus_product_mappings apt
    LEFT JOIN products p ON p.id = apt.product_id
    WHERE apt.adversus_product_title IS NOT NULL
  ),
  -- Get client from product mapping
  sale_items_with_client AS (
    SELECT 
      si.id,
      si.adversus_product_title,
      si.quantity,
      s.sale_datetime,
      s.agent_name,
      pm.mapped_client_id,
      pm.counts_as_sale,
      pm.commission_dkk,
      pm.revenue_dkk,
      -- Also check product table directly for client
      COALESCE(
        pm.mapped_client_id,
        (SELECT cc.client_id FROM products p2 
         JOIN client_campaigns cc ON cc.id = p2.client_campaign_id 
         WHERE p2.id = si.product_id)
      ) as final_client_id
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    LEFT JOIN product_mapping pm ON pm.adversus_product_title = si.adversus_product_title
    WHERE s.sale_datetime >= v_start_month
      AND s.sale_datetime <= v_end_date
  ),
  -- Aggregate by client
  client_stats AS (
    SELECT 
      sic.final_client_id as cid,
      -- Today stats
      COUNT(*) FILTER (WHERE sic.sale_datetime >= v_start_today AND COALESCE(sic.counts_as_sale, true) = true) as today_count,
      COALESCE(SUM(COALESCE(sic.revenue_dkk, 0) * COALESCE(sic.quantity, 1)) FILTER (WHERE sic.sale_datetime >= v_start_today), 0) as today_revenue,
      COALESCE(SUM(COALESCE(sic.commission_dkk, 0) * COALESCE(sic.quantity, 1)) FILTER (WHERE sic.sale_datetime >= v_start_today), 0) as today_commission,
      -- Month stats
      COUNT(*) FILTER (WHERE COALESCE(sic.counts_as_sale, true) = true) as month_count,
      COALESCE(SUM(COALESCE(sic.revenue_dkk, 0) * COALESCE(sic.quantity, 1)), 0) as month_revenue,
      COALESCE(SUM(COALESCE(sic.commission_dkk, 0) * COALESCE(sic.quantity, 1)), 0) as month_commission
    FROM sale_items_with_client sic
    WHERE sic.final_client_id IS NOT NULL
    GROUP BY sic.final_client_id
  ),
  -- Get top 3 sellers per client
  top_sellers_by_client AS (
    SELECT 
      sic.final_client_id as cid,
      jsonb_agg(
        jsonb_build_object('agent_name', seller.agent_name, 'count', seller.sale_count)
        ORDER BY seller.sale_count DESC
      ) FILTER (WHERE seller.rn <= 3) as sellers
    FROM sale_items_with_client sic
    JOIN LATERAL (
      SELECT 
        sic2.agent_name,
        COUNT(*) as sale_count,
        ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) as rn
      FROM sale_items_with_client sic2
      WHERE sic2.final_client_id = sic.final_client_id
        AND sic2.agent_name IS NOT NULL
        AND COALESCE(sic2.counts_as_sale, true) = true
      GROUP BY sic2.agent_name
    ) seller ON true
    WHERE sic.final_client_id IS NOT NULL
    GROUP BY sic.final_client_id
  )
  SELECT 
    c.id as client_id,
    c.name as client_name,
    COALESCE(cs.today_count, 0)::bigint as sales_today,
    COALESCE(cs.month_count, 0)::bigint as sales_month,
    COALESCE(cs.today_revenue, 0)::numeric as revenue_today,
    COALESCE(cs.month_revenue, 0)::numeric as revenue_month,
    COALESCE(cs.today_commission, 0)::numeric as commission_today,
    COALESCE(cs.month_commission, 0)::numeric as commission_month,
    COALESCE(ts.sellers, '[]'::jsonb) as top_sellers
  FROM clients c
  LEFT JOIN client_stats cs ON cs.cid = c.id
  LEFT JOIN top_sellers_by_client ts ON ts.cid = c.id
  ORDER BY c.name;
END;
$function$;
