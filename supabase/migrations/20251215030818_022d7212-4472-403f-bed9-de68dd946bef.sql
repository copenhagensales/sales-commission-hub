
-- Fix the RPC function - the top_sellers query had a bug with LATERAL join
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
  WITH sale_items_with_client AS (
    -- Get client from product table directly (via product_id -> client_campaign -> client)
    SELECT 
      si.id,
      si.adversus_product_title,
      si.quantity,
      s.sale_datetime,
      s.agent_name,
      cc.client_id as final_client_id,
      COALESCE(p.counts_as_sale, true) as counts_as_sale,
      COALESCE(p.commission_dkk, 0) as commission_dkk,
      COALESCE(p.revenue_dkk, 0) as revenue_dkk
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    JOIN products p ON p.id = si.product_id
    JOIN client_campaigns cc ON cc.id = p.client_campaign_id
    WHERE s.sale_datetime >= v_start_month
      AND s.sale_datetime <= v_end_date
      AND cc.client_id IS NOT NULL
  ),
  -- Aggregate by client
  client_stats AS (
    SELECT 
      sic.final_client_id as cid,
      -- Today stats
      COUNT(*) FILTER (WHERE sic.sale_datetime >= v_start_today AND sic.counts_as_sale = true) as today_count,
      COALESCE(SUM(sic.revenue_dkk * COALESCE(sic.quantity, 1)) FILTER (WHERE sic.sale_datetime >= v_start_today), 0) as today_revenue,
      COALESCE(SUM(sic.commission_dkk * COALESCE(sic.quantity, 1)) FILTER (WHERE sic.sale_datetime >= v_start_today), 0) as today_commission,
      -- Month stats
      COUNT(*) FILTER (WHERE sic.counts_as_sale = true) as month_count,
      COALESCE(SUM(sic.revenue_dkk * COALESCE(sic.quantity, 1)), 0) as month_revenue,
      COALESCE(SUM(sic.commission_dkk * COALESCE(sic.quantity, 1)), 0) as month_commission
    FROM sale_items_with_client sic
    GROUP BY sic.final_client_id
  ),
  -- Get top 3 sellers per client
  seller_counts AS (
    SELECT 
      sic.final_client_id as cid,
      sic.agent_name,
      COUNT(*) as sale_count
    FROM sale_items_with_client sic
    WHERE sic.agent_name IS NOT NULL
      AND sic.counts_as_sale = true
    GROUP BY sic.final_client_id, sic.agent_name
  ),
  ranked_sellers AS (
    SELECT 
      cid,
      agent_name,
      sale_count,
      ROW_NUMBER() OVER (PARTITION BY cid ORDER BY sale_count DESC) as rn
    FROM seller_counts
  ),
  top_sellers_by_client AS (
    SELECT 
      cid,
      jsonb_agg(
        jsonb_build_object('agent_name', agent_name, 'count', sale_count)
        ORDER BY sale_count DESC
      ) as sellers
    FROM ranked_sellers
    WHERE rn <= 3
    GROUP BY cid
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
