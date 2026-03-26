CREATE OR REPLACE FUNCTION public.get_sales_report_detailed(p_client_id uuid, p_start text, p_end text)
 RETURNS TABLE(employee_name text, product_name text, quantity bigint, commission numeric, revenue numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(emd.first_name || ' ' || emd.last_name, emd_fb.first_name || ' ' || emd_fb.last_name, a.name, s.agent_email) AS employee_name,
    COALESCE(p.name, si.adversus_product_title, 'Ukendt produkt') AS product_name,
    COALESCE(SUM(si.quantity), 0)::bigint AS quantity,
    COALESCE(SUM(si.mapped_commission), 0) AS commission,
    COALESCE(SUM(si.mapped_revenue), 0) AS revenue
  FROM sales s
  JOIN sale_items si ON si.sale_id = s.id
  LEFT JOIN products p ON p.id = si.product_id
  LEFT JOIN agents a ON lower(a.email) = lower(s.agent_email)
  LEFT JOIN employee_agent_mapping eam ON eam.agent_id = a.id
  LEFT JOIN employee_master_data emd ON emd.id = eam.employee_id
  LEFT JOIN employee_master_data emd_fb
    ON eam.employee_id IS NULL
    AND lower(emd_fb.work_email) = lower(s.agent_email)
  LEFT JOIN client_campaigns cc_prod ON cc_prod.id = p.client_campaign_id
  LEFT JOIN client_campaigns cc_sale ON cc_sale.id = s.client_campaign_id
  LEFT JOIN adversus_campaign_mappings acm ON acm.adversus_campaign_id = s.dialer_campaign_id
  LEFT JOIN client_campaigns cc_mapping ON cc_mapping.id = acm.client_campaign_id
  WHERE s.sale_datetime >= p_start::timestamptz
    AND s.sale_datetime <= (p_end::date + interval '1 day' - interval '1 second')::timestamptz
    AND COALESCE(s.validation_status, 'approved') != 'rejected'
    AND COALESCE(cc_prod.client_id, cc_sale.client_id, cc_mapping.client_id) = p_client_id
    AND COALESCE(p.counts_as_sale, true) = true
  GROUP BY
    COALESCE(emd.first_name || ' ' || emd.last_name, emd_fb.first_name || ' ' || emd_fb.last_name, a.name, s.agent_email),
    COALESCE(p.name, si.adversus_product_title, 'Ukendt produkt');
END;
$function$;