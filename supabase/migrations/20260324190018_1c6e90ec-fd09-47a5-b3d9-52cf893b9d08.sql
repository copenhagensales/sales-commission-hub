DROP FUNCTION IF EXISTS public.get_sales_report_raw(uuid, text, text);
DROP FUNCTION IF EXISTS public.get_sales_report_raw(uuid, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_sales_report_raw(p_client_id uuid, p_start text, p_end text)
 RETURNS TABLE(employee_name text, sale_datetime timestamp with time zone, product_name text, quantity numeric, commission numeric, revenue numeric, customer_phone text, customer_company text, status text, internal_reference text, adversus_opp_number text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    s.agent_name AS employee_name,
    s.sale_datetime AS sale_datetime,
    COALESCE(p2.name, si.adversus_product_title, 'Ukendt') AS product_name,
    COALESCE(si.quantity, 1)::numeric AS quantity,
    COALESCE(si.mapped_commission, 0) AS commission,
    COALESCE(si.mapped_revenue, 0) AS revenue,
    s.customer_phone AS customer_phone,
    s.customer_company AS customer_company,
    COALESCE(s.validation_status, 'pending') AS status,
    s.internal_reference AS internal_reference,
    COALESCE(
      s.raw_payload->>'legacy_opp_number',
      s.raw_payload->'leadResultFields'->>'OPP nr',
      (SELECT elem->>'value' FROM jsonb_array_elements(COALESCE(s.raw_payload->'leadResultData','[]'::jsonb)) elem WHERE elem->>'label' = 'OPP nr' LIMIT 1),
      s.raw_payload->'leadResultFields'->>'OPP-nr',
      (SELECT elem->>'value' FROM jsonb_array_elements(COALESCE(s.raw_payload->'leadResultData','[]'::jsonb)) elem WHERE elem->>'label' = 'OPP-nr' LIMIT 1)
    ) AS adversus_opp_number
  FROM sale_items si
  JOIN sales s ON s.id = si.sale_id
  LEFT JOIN products p2 ON p2.id = si.product_id
  LEFT JOIN client_campaigns cc_prod ON cc_prod.id = p2.client_campaign_id
  LEFT JOIN client_campaigns cc_sale ON cc_sale.id = s.client_campaign_id
  LEFT JOIN adversus_campaign_mappings acm ON acm.adversus_campaign_id = s.dialer_campaign_id
  LEFT JOIN client_campaigns cc_mapping ON cc_mapping.id = acm.client_campaign_id
  WHERE COALESCE(cc_prod.client_id, cc_sale.client_id, cc_mapping.client_id) = p_client_id
    AND s.sale_datetime >= p_start::timestamptz
    AND s.sale_datetime < (p_end::date + 1)::timestamptz
    AND COALESCE(p2.counts_as_sale, true) = true
  ORDER BY s.sale_datetime DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_sales_report_raw(p_client_id uuid, p_start text, p_end text, p_limit integer DEFAULT 5000, p_offset integer DEFAULT 0)
 RETURNS TABLE(employee_name text, sale_datetime timestamp with time zone, product_name text, quantity numeric, commission numeric, revenue numeric, customer_phone text, customer_company text, status text, internal_reference text, adversus_opp_number text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    s.agent_name AS employee_name,
    s.sale_datetime AS sale_datetime,
    COALESCE(p2.name, si.adversus_product_title, 'Ukendt') AS product_name,
    COALESCE(si.quantity, 1)::numeric AS quantity,
    COALESCE(si.mapped_commission, 0) AS commission,
    COALESCE(si.mapped_revenue, 0) AS revenue,
    s.customer_phone AS customer_phone,
    s.customer_company AS customer_company,
    COALESCE(s.validation_status, 'pending') AS status,
    s.internal_reference AS internal_reference,
    COALESCE(
      s.raw_payload->>'legacy_opp_number',
      s.raw_payload->'leadResultFields'->>'OPP nr',
      (SELECT elem->>'value' FROM jsonb_array_elements(COALESCE(s.raw_payload->'leadResultData','[]'::jsonb)) elem WHERE elem->>'label' = 'OPP nr' LIMIT 1),
      s.raw_payload->'leadResultFields'->>'OPP-nr',
      (SELECT elem->>'value' FROM jsonb_array_elements(COALESCE(s.raw_payload->'leadResultData','[]'::jsonb)) elem WHERE elem->>'label' = 'OPP-nr' LIMIT 1)
    ) AS adversus_opp_number
  FROM sale_items si
  JOIN sales s ON s.id = si.sale_id
  LEFT JOIN products p2 ON p2.id = si.product_id
  LEFT JOIN client_campaigns cc_prod ON cc_prod.id = p2.client_campaign_id
  LEFT JOIN client_campaigns cc_sale ON cc_sale.id = s.client_campaign_id
  LEFT JOIN adversus_campaign_mappings acm ON acm.adversus_campaign_id = s.dialer_campaign_id
  LEFT JOIN client_campaigns cc_mapping ON cc_mapping.id = acm.client_campaign_id
  WHERE COALESCE(cc_prod.client_id, cc_sale.client_id, cc_mapping.client_id) = p_client_id
    AND s.sale_datetime >= p_start::timestamptz
    AND s.sale_datetime < (p_end::date + 1)::timestamptz
    AND COALESCE(p2.counts_as_sale, true) = true
  ORDER BY s.sale_datetime DESC
  LIMIT p_limit OFFSET p_offset;
END;
$function$;