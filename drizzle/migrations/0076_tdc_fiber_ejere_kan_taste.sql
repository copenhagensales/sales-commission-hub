DROP POLICY "TDC fiber saelgere kan oprette tastede salg" ON public.sales;
CREATE POLICY "TDC fiber saelgere kan oprette tastede salg" ON public.sales FOR INSERT TO authenticated
  WITH CHECK (
    source = 'tdc_fiber_manual'
    AND client_campaign_id = '374ce55d-5b01-41b9-a009-aad5f0feb288'::uuid
    AND sale_datetime::date = (now() AT TIME ZONE 'Europe/Copenhagen')::date
    AND raw_payload->>'registreret_af' = public.effective_employee_id()::text
    AND (public.is_owner(auth.uid())
         OR EXISTS (SELECT 1 FROM public.tdc_fiber_access a WHERE a.employee_id = public.effective_employee_id()))
  );

CREATE OR REPLACE FUNCTION public.tdc_fiber_opret_salg(
  p_salg_id uuid, p_lead_salg_id uuid, p_type text, p_variant text,
  p_mobilevoice boolean, p_cvr text, p_leadgiver uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_mig uuid := public.effective_employee_id();
  v_mig_mail text; v_mig_navn text;
  v_lg_mail text; v_lg_navn text;
  v_cvr text := regexp_replace(coalesce(p_cvr,''), '\s', '', 'g');
  v_nu timestamptz := now();
BEGIN
  IF v_mig IS NULL OR NOT (public.is_owner(auth.uid()) OR EXISTS (SELECT 1 FROM public.tdc_fiber_access WHERE employee_id = v_mig)) THEN
    RAISE EXCEPTION 'tdc_fiber_ingen_adgang' USING ERRCODE = 'P0001';
  END IF;
  IF p_type NOT IN ('fuldt','lukket') OR p_variant NOT IN ('HAP','VOK') OR p_mobilevoice IS NULL THEN
    RAISE EXCEPTION 'tdc_fiber_ugyldig_type' USING ERRCODE = 'P0001';
  END IF;
  IF v_cvr !~ '^[0-9]{8}$' THEN
    RAISE EXCEPTION 'tdc_fiber_ugyldigt_cvr' USING ERRCODE = 'P0001';
  END IF;
  IF p_type = 'fuldt' AND p_leadgiver IS NOT NULL THEN
    RAISE EXCEPTION 'tdc_fiber_leadgiver_ikke_tilladt' USING ERRCODE = 'P0001';
  END IF;
  IF p_type = 'lukket' AND (p_leadgiver IS NULL OR p_lead_salg_id IS NULL) THEN
    RAISE EXCEPTION 'tdc_fiber_leadgiver_mangler' USING ERRCODE = 'P0001';
  END IF;
  IF p_leadgiver = v_mig THEN
    RAISE EXCEPTION 'tdc_fiber_leadgiver_er_dig' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM public.sales WHERE id = p_salg_id) THEN
    RETURN jsonb_build_object('status', 'findes');
  END IF;

  SELECT lower(work_email), trim(first_name || ' ' || coalesce(last_name,'')) INTO v_mig_mail, v_mig_navn
    FROM public.employee_master_data WHERE id = v_mig AND is_active;
  IF v_mig_mail IS NULL THEN
    RAISE EXCEPTION 'tdc_fiber_mangler_arbejdsmail' USING ERRCODE = 'P0001';
  END IF;

  IF p_type = 'lukket' THEN
    SELECT lower(e.work_email), trim(e.first_name || ' ' || coalesce(e.last_name,'')) INTO v_lg_mail, v_lg_navn
      FROM public.employee_master_data e
     WHERE e.id = p_leadgiver AND e.is_active AND e.work_email IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.team_members tm JOIN public.teams t ON t.id = tm.team_id
                   WHERE tm.employee_id = e.id AND t.name IN ('Relatel','TDC Erhverv'));
    IF v_lg_mail IS NULL THEN
      RAISE EXCEPTION 'tdc_fiber_ugyldig_leadgiver' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.sales (id, client_campaign_id, agent_name, agent_email, sale_datetime, source, integration_type, validation_status, raw_payload)
  VALUES (p_salg_id, '374ce55d-5b01-41b9-a009-aad5f0feb288', v_mig_navn, v_mig_mail, v_nu, 'tdc_fiber_manual', 'manual', 'pending',
    jsonb_build_object('kilde','tdc_fiber_manual','rolle',p_type,'registreret_af',v_mig::text,
      'leadResultFields', jsonb_build_object('OPP nr', v_cvr),
      'leadgiver_employee_id', p_leadgiver, 'lead_salg_id', p_lead_salg_id));
  INSERT INTO public.sale_items (sale_id, product_id) VALUES (p_salg_id, public.tdc_fiber_produkt(p_type, p_variant, p_mobilevoice));

  IF p_type = 'lukket' THEN
    INSERT INTO public.sales (id, client_campaign_id, agent_name, agent_email, sale_datetime, source, integration_type, validation_status, raw_payload)
    VALUES (p_lead_salg_id, '374ce55d-5b01-41b9-a009-aad5f0feb288', v_lg_navn, v_lg_mail, v_nu, 'tdc_fiber_manual', 'manual', 'pending',
      jsonb_build_object('kilde','tdc_fiber_manual','rolle','lead','registreret_af',v_mig::text,
        'leadResultFields', jsonb_build_object('OPP nr', v_cvr),
        'lukker_employee_id', v_mig, 'lukket_salg_id', p_salg_id));
    INSERT INTO public.sale_items (sale_id, product_id) VALUES (p_lead_salg_id, public.tdc_fiber_produkt('lead', p_variant, p_mobilevoice));
  END IF;

  RETURN jsonb_build_object('status', 'oprettet');
END $$;