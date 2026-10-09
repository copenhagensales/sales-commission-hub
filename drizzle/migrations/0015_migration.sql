CREATE OR REPLACE FUNCTION public.get_cancellation_candidate_sales(
  _campaign_ids uuid[],
  _null_campaign_eesy_enreach boolean DEFAULT false,
  _offset integer DEFAULT 0,
  _limit integer DEFAULT 1000
)
RETURNS TABLE (
  id uuid, sale_datetime timestamptz, customer_phone text, customer_company text,
  validation_status text, agent_name text, agent_email text, raw_payload jsonb, normalized_data jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '60s'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_manager boolean;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  _is_manager := public.is_manager_or_above(_uid);

  RETURN QUERY
  SELECT s.id, s.sale_datetime, s.customer_phone, s.customer_company,
         s.validation_status, s.agent_name, s.agent_email, s.raw_payload, s.normalized_data
  FROM public.sales s
  WHERE s.validation_status <> 'cancelled'
    AND (
      (NOT _null_campaign_eesy_enreach AND s.client_campaign_id = ANY(_campaign_ids))
      OR (_null_campaign_eesy_enreach AND s.client_campaign_id IS NULL AND s.source = 'Eesy' AND s.integration_type = 'enreach')
    )
    AND (
      _is_manager
      OR public.can_view_sale_as_employee(s.id, _uid)
      OR (s.source = 'fieldmarketing' AND EXISTS (SELECT 1 FROM public.employee_master_data e WHERE e.auth_user_id = _uid AND e.is_active))
      OR (public.can_edit_tdc_erhverv_sales(_uid) AND public.sale_is_tdc_erhverv(s.id))
      OR (public.can_edit_tryg_sales(_uid) AND public.sale_is_united_client(s.id))
    )
  ORDER BY s.sale_datetime DESC, s.id
  OFFSET GREATEST(_offset, 0)
  LIMIT LEAST(GREATEST(_limit, 1), 1000);
END;
$$;