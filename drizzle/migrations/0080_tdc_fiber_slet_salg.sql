CREATE OR REPLACE FUNCTION public.tdc_fiber_slet_salg(p_salg_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := public.effective_employee_id();
  v_s record;
  v_lead_id uuid;
BEGIN
  IF NOT public.tdc_fiber_er_admin() OR v_admin IS NULL THEN
    RAISE EXCEPTION 'Kun fiberadmins kan slette salg' USING ERRCODE = 'P0001';
  END IF;
  SELECT id, raw_payload, validation_status INTO v_s FROM public.sales
   WHERE id = p_salg_id AND source = 'tdc_fiber_manual' AND raw_payload->>'rolle' IN ('fuldt','lukket')
     AND sale_datetime::date = (now() AT TIME ZONE 'Europe/Copenhagen')::date
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Salget findes ikke eller er ikke fra i dag' USING ERRCODE = 'P0001';
  END IF;
  IF v_s.validation_status = 'rejected' THEN
    RETURN jsonb_build_object('status', 'allerede_slettet');
  END IF;
  v_lead_id := nullif(v_s.raw_payload->>'lead_salg_id','')::uuid;
  UPDATE public.sales SET validation_status = 'rejected' WHERE id = p_salg_id;
  IF v_lead_id IS NOT NULL THEN
    UPDATE public.sales SET validation_status = 'rejected'
     WHERE id = v_lead_id AND source = 'tdc_fiber_manual' AND raw_payload->>'rolle' = 'lead';
  END IF;
  INSERT INTO public.tdc_fiber_rettelser (salg_id, rettet_af, foer, efter)
  VALUES (p_salg_id, v_admin,
    jsonb_build_object('validation_status', v_s.validation_status, 'lead_salg_id', v_lead_id),
    jsonb_build_object('handling', 'slettet', 'validation_status', 'rejected'));
  RETURN jsonb_build_object('status', 'slettet');
END;
$$;
REVOKE ALL ON FUNCTION public.tdc_fiber_slet_salg(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tdc_fiber_slet_salg(uuid) TO authenticated;