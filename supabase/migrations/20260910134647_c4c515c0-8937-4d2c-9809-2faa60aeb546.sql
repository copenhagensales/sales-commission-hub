CREATE OR REPLACE FUNCTION public.get_client_daily_sales_counts(
  p_client_id uuid,
  p_start date,
  p_end date
)
RETURNS TABLE(sale_date date, product_name text, quantity bigint, sale_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (s.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date AS sale_date,
    COALESCE(p.client_display_name, p.name, si.display_name, si.adversus_product_title, 'Andet') AS product_name,
    COALESCE(SUM(si.quantity), 0)::bigint AS quantity,
    COUNT(DISTINCT s.id)::bigint AS sale_count
  FROM sales s
  JOIN sale_items si ON si.sale_id = s.id
  LEFT JOIN products p ON p.id = si.product_id
  LEFT JOIN client_campaigns cc_prod ON cc_prod.id = p.client_campaign_id
  LEFT JOIN client_campaigns cc_sale ON cc_sale.id = s.client_campaign_id
  LEFT JOIN adversus_campaign_mappings acm ON acm.adversus_campaign_id = s.dialer_campaign_id
  LEFT JOIN client_campaigns cc_mapping ON cc_mapping.id = acm.client_campaign_id
  WHERE (s.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date BETWEEN p_start AND p_end
    AND COALESCE(s.validation_status, 'approved') NOT IN ('rejected', 'cancelled')
    AND COALESCE(si.is_cancelled, false) = false
    AND COALESCE(cc_prod.client_id, cc_sale.client_id, cc_mapping.client_id) = p_client_id
  GROUP BY 1, 2
$$;

REVOKE ALL ON FUNCTION public.get_client_daily_sales_counts(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_daily_sales_counts(uuid, date, date) TO service_role;