
-- Reescribir la función get_client_sales_stats para contar correctamente
-- Ahora usa sales.client_campaign_id como fuente primaria, no solo product.client_campaign_id
CREATE OR REPLACE FUNCTION public.get_client_sales_stats(
  p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, 
  p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(
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
STABLE SECURITY DEFINER
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
  WITH sale_items_extended AS (
    -- Obtener sale_items con cliente derivado de múltiples fuentes
    SELECT 
      si.id as item_id,
      si.adversus_product_title,
      si.quantity,
      s.id as sale_id,
      s.sale_datetime,
      s.agent_name,
      -- Prioridad: 1) producto.client_campaign, 2) sale.client_campaign
      COALESCE(
        cc_prod.client_id,
        cc_sale.client_id
      ) as final_client_id,
      -- counts_as_sale del producto mapeado, o true si no hay producto
      COALESCE(p.counts_as_sale, true) as counts_as_sale,
      -- commission y revenue del producto mapeado, o 0 si no hay
      COALESCE(p.commission_dkk, 0) as commission_dkk,
      COALESCE(p.revenue_dkk, 0) as revenue_dkk
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    LEFT JOIN products p ON p.id = si.product_id
    LEFT JOIN client_campaigns cc_prod ON cc_prod.id = p.client_campaign_id
    LEFT JOIN client_campaigns cc_sale ON cc_sale.id = s.client_campaign_id
    WHERE s.sale_datetime >= v_start_month
      AND s.sale_datetime <= v_end_date
  ),
  -- También contar ventas sin sale_items (por si acaso)
  sales_without_items AS (
    SELECT 
      s.id as sale_id,
      s.sale_datetime,
      s.agent_name,
      cc.client_id as final_client_id
    FROM sales s
    LEFT JOIN client_campaigns cc ON cc.id = s.client_campaign_id
    WHERE s.sale_datetime >= v_start_month
      AND s.sale_datetime <= v_end_date
      AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id)
      AND cc.client_id IS NOT NULL
  ),
  -- Combinar ambas fuentes
  all_countable_items AS (
    -- Sale items con cliente
    SELECT 
      item_id,
      sale_datetime,
      agent_name,
      final_client_id,
      counts_as_sale,
      commission_dkk,
      revenue_dkk,
      quantity
    FROM sale_items_extended
    WHERE final_client_id IS NOT NULL
    
    UNION ALL
    
    -- Sales sin items (contar como 1 venta cada una)
    SELECT 
      sale_id as item_id,
      sale_datetime,
      agent_name,
      final_client_id,
      true as counts_as_sale,
      0 as commission_dkk,
      0 as revenue_dkk,
      1 as quantity
    FROM sales_without_items
  ),
  -- Aggregate by client
  client_stats AS (
    SELECT 
      aci.final_client_id as cid,
      -- Today stats (solo items que cuentan como venta)
      COUNT(*) FILTER (WHERE aci.sale_datetime >= v_start_today AND aci.counts_as_sale = true) as today_count,
      COALESCE(SUM(aci.revenue_dkk * COALESCE(aci.quantity, 1)) FILTER (WHERE aci.sale_datetime >= v_start_today), 0) as today_revenue,
      COALESCE(SUM(aci.commission_dkk * COALESCE(aci.quantity, 1)) FILTER (WHERE aci.sale_datetime >= v_start_today), 0) as today_commission,
      -- Month stats
      COUNT(*) FILTER (WHERE aci.counts_as_sale = true) as month_count,
      COALESCE(SUM(aci.revenue_dkk * COALESCE(aci.quantity, 1)), 0) as month_revenue,
      COALESCE(SUM(aci.commission_dkk * COALESCE(aci.quantity, 1)), 0) as month_commission
    FROM all_countable_items aci
    GROUP BY aci.final_client_id
  ),
  -- Get top 3 sellers per client
  seller_counts AS (
    SELECT 
      aci.final_client_id as cid,
      aci.agent_name,
      COUNT(*) as sale_count
    FROM all_countable_items aci
    WHERE aci.agent_name IS NOT NULL 
      AND aci.agent_name != ''
      AND aci.counts_as_sale = true
    GROUP BY aci.final_client_id, aci.agent_name
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
