CREATE OR REPLACE FUNCTION public.tdc_fiber_admin_opret_salg(
  p_salg_id uuid, p_lead_salg_id uuid, p_type text, p_variant text,
  p_mobilevoice boolean, p_cvr text, p_lukker uuid, p_leadgiver uuid, p_dato date)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_admin uuid := public.effective_employee_id();
  v_mail text; v_navn text; v_lg_mail text; v_lg_navn text;
  v_cvr text := regexp_replace(coalesce(p_cvr,''), '\s', '', 'g');
  v_tid timestamptz;
BEGIN
  IF v_admin IS NULL OR NOT public.tdc_fiber_er_admin() THEN
    RAISE EXCEPTION 'tdc_fiber_ingen_adgang' USING ERRCODE = 'P0001';
  END IF;
  IF p_type NOT IN ('fuldt','lukket','kun_lead') OR p_variant NOT IN ('HAP','VOK') OR p_mobilevoice IS NULL THEN
    RAISE EXCEPTION 'tdc_fiber_ugyldig_type' USING ERRCODE = 'P0001';
  END IF;
  IF v_cvr !~ '^[0-9]{8}$' THEN RAISE EXCEPTION 'tdc_fiber_ugyldigt_cvr' USING ERRCODE = 'P0001'; END IF;
  IF p_dato IS NULL OR p_dato < public.tdc_fiber_periode_start() OR p_dato > (now() AT TIME ZONE 'Europe/Copenhagen')::date THEN
    RAISE EXCEPTION 'tdc_fiber_ugyldig_dato' USING ERRCODE = 'P0001';
  END IF;
  IF p_type = 'kun_lead' THEN
    IF p_lukker IS NOT NULL THEN RAISE EXCEPTION 'tdc_fiber_ugyldig_type' USING ERRCODE = 'P0001'; END IF;
    IF p_leadgiver IS NULL THEN RAISE EXCEPTION 'tdc_fiber_leadgiver_mangler' USING ERRCODE = 'P0001'; END IF;
  ELSE
    IF p_lukker IS NULL OR NOT EXISTS (SELECT 1 FROM public.tdc_fiber_access WHERE employee_id = p_lukker) THEN
      RAISE EXCEPTION 'tdc_fiber_lukker_ikke_paa_listen' USING ERRCODE = 'P0001';
    END IF;
    IF p_type = 'fuldt' AND p_leadgiver IS NOT NULL THEN RAISE EXCEPTION 'tdc_fiber_leadgiver_ikke_tilladt' USING ERRCODE = 'P0001'; END IF;
    IF p_type = 'lukket' AND (p_leadgiver IS NULL OR p_lead_salg_id IS NULL) THEN RAISE EXCEPTION 'tdc_fiber_leadgiver_mangler' USING ERRCODE = 'P0001'; END IF;
    IF p_leadgiver = p_lukker THEN RAISE EXCEPTION 'tdc_fiber_leadgiver_er_saelger' USING ERRCODE = 'P0001'; END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.sales WHERE id = p_salg_id) THEN
    RETURN jsonb_build_object('status', 'findes');
  END IF;

  IF p_type IN ('lukket','kun_lead') THEN
    SELECT lower(e.work_email), trim(e.first_name || ' ' || coalesce(e.last_name,'')) INTO v_lg_mail, v_lg_navn
      FROM public.employee_master_data e
     WHERE e.id = p_leadgiver AND e.is_active AND e.work_email IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.team_members tm JOIN public.teams t ON t.id = tm.team_id
                   WHERE tm.employee_id = e.id AND t.name IN ('Relatel','TDC Erhverv'));
    IF v_lg_mail IS NULL THEN RAISE EXCEPTION 'tdc_fiber_ugyldig_leadgiver' USING ERRCODE = 'P0001'; END IF;
  END IF;

  v_tid := CASE WHEN p_dato = (now() AT TIME ZONE 'Europe/Copenhagen')::date THEN now()
                ELSE (p_dato + time '12:00') AT TIME ZONE 'Europe/Copenhagen' END;

  IF p_type = 'kun_lead' THEN
    INSERT INTO public.sales (id, client_campaign_id, agent_name, agent_email, sale_datetime, source, integration_type, validation_status, raw_payload)
    VALUES (p_salg_id, '374ce55d-5b01-41b9-a009-aad5f0feb288', v_lg_navn, v_lg_mail, v_tid, 'tdc_fiber_manual', 'manual', 'pending',
      jsonb_build_object('kilde','tdc_fiber_manual','rolle','lead','kun_lead',true,'registreret_af',v_admin::text,
        'oprettet_af', v_admin::text, 'oprettet_af_admin', true,
        'leadResultFields', jsonb_build_object('OPP nr', v_cvr),
        'leadgiver_employee_id', p_leadgiver));
    INSERT INTO public.sale_items (sale_id, product_id) VALUES (p_salg_id, public.tdc_fiber_produkt('lead', p_variant, p_mobilevoice));
    RETURN jsonb_build_object('status', 'oprettet');
  END IF;

  SELECT lower(work_email), trim(first_name || ' ' || coalesce(last_name,'')) INTO v_mail, v_navn
    FROM public.employee_master_data WHERE id = p_lukker AND is_active;
  IF v_mail IS NULL THEN RAISE EXCEPTION 'tdc_fiber_mangler_arbejdsmail' USING ERRCODE = 'P0001'; END IF;

  INSERT INTO public.sales (id, client_campaign_id, agent_name, agent_email, sale_datetime, source, integration_type, validation_status, raw_payload)
  VALUES (p_salg_id, '374ce55d-5b01-41b9-a009-aad5f0feb288', v_navn, v_mail, v_tid, 'tdc_fiber_manual', 'manual', 'pending',
    jsonb_build_object('kilde','tdc_fiber_manual','rolle',p_type,'registreret_af',p_lukker::text,
      'oprettet_af', v_admin::text, 'oprettet_af_admin', true,
      'leadResultFields', jsonb_build_object('OPP nr', v_cvr),
      'leadgiver_employee_id', p_leadgiver, 'lead_salg_id', p_lead_salg_id));
  INSERT INTO public.sale_items (sale_id, product_id) VALUES (p_salg_id, public.tdc_fiber_produkt(p_type, p_variant, p_mobilevoice));

  IF p_type = 'lukket' THEN
    INSERT INTO public.sales (id, client_campaign_id, agent_name, agent_email, sale_datetime, source, integration_type, validation_status, raw_payload)
    VALUES (p_lead_salg_id, '374ce55d-5b01-41b9-a009-aad5f0feb288', v_lg_navn, v_lg_mail, v_tid, 'tdc_fiber_manual', 'manual', 'pending',
      jsonb_build_object('kilde','tdc_fiber_manual','rolle','lead','registreret_af',p_lukker::text,
        'oprettet_af', v_admin::text, 'oprettet_af_admin', true,
        'leadResultFields', jsonb_build_object('OPP nr', v_cvr),
        'lukker_employee_id', p_lukker, 'lukket_salg_id', p_salg_id));
    INSERT INTO public.sale_items (sale_id, product_id) VALUES (p_lead_salg_id, public.tdc_fiber_produkt('lead', p_variant, p_mobilevoice));
  END IF;

  RETURN jsonb_build_object('status', 'oprettet');
END $$;

CREATE OR REPLACE FUNCTION public.tdc_fiber_slet_salg(p_salg_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_admin uuid := public.effective_employee_id();
  v_s record;
  v_lead_id uuid;
BEGIN
  IF NOT public.tdc_fiber_er_admin() OR v_admin IS NULL THEN
    RAISE EXCEPTION 'Kun fiberadmins kan slette salg' USING ERRCODE = 'P0001';
  END IF;
  SELECT id, raw_payload, validation_status INTO v_s FROM public.sales
   WHERE id = p_salg_id AND source = 'tdc_fiber_manual'
     AND (raw_payload->>'rolle' IN ('fuldt','lukket') OR (raw_payload->>'rolle' = 'lead' AND raw_payload->>'kun_lead' = 'true'))
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
END $$;