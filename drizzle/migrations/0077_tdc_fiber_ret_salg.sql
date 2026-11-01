CREATE OR REPLACE FUNCTION public.tdc_fiber_er_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT public.is_owner(auth.uid())
      OR EXISTS (SELECT 1 FROM public.tdc_fiber_access a WHERE a.employee_id = public.effective_employee_id() AND a.rolle = 'admin')
$$;

CREATE TABLE public.tdc_fiber_rettelser (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salg_id uuid NOT NULL,
  rettet_af uuid NOT NULL,
  rettet_at timestamptz NOT NULL DEFAULT now(),
  foer jsonb NOT NULL,
  efter jsonb NOT NULL
);
COMMENT ON TABLE public.tdc_fiber_rettelser IS 'Log over admin-rettelser af tastede TDC fibersalg. Kun tilføjelse.';
GRANT SELECT, INSERT ON public.tdc_fiber_rettelser TO authenticated;
GRANT ALL ON public.tdc_fiber_rettelser TO service_role;
ALTER TABLE public.tdc_fiber_rettelser ENABLE ROW LEVEL SECURITY;
CREATE POLICY tdc_fiber_rettelser_laes ON public.tdc_fiber_rettelser FOR SELECT TO authenticated USING (public.tdc_fiber_er_admin());
CREATE POLICY tdc_fiber_rettelser_skriv ON public.tdc_fiber_rettelser FOR INSERT TO authenticated
  WITH CHECK (public.tdc_fiber_er_admin() AND rettet_af = public.effective_employee_id());

-- Admins: se alle tastede fibersalg, rette/oprette dagens.
CREATE POLICY "TDC fiber admins kan se tastede salg" ON public.sales FOR SELECT TO authenticated
  USING (source = 'tdc_fiber_manual' AND public.tdc_fiber_er_admin());
CREATE POLICY "TDC fiber admins kan rette dagens salg" ON public.sales FOR UPDATE TO authenticated
  USING (source = 'tdc_fiber_manual' AND sale_datetime::date = (now() AT TIME ZONE 'Europe/Copenhagen')::date AND public.tdc_fiber_er_admin())
  WITH CHECK (source = 'tdc_fiber_manual' AND client_campaign_id = '374ce55d-5b01-41b9-a009-aad5f0feb288'::uuid
    AND sale_datetime::date = (now() AT TIME ZONE 'Europe/Copenhagen')::date AND public.tdc_fiber_er_admin());
CREATE POLICY "TDC fiber admins kan oprette leaddel" ON public.sales FOR INSERT TO authenticated
  WITH CHECK (source = 'tdc_fiber_manual' AND client_campaign_id = '374ce55d-5b01-41b9-a009-aad5f0feb288'::uuid
    AND sale_datetime::date = (now() AT TIME ZONE 'Europe/Copenhagen')::date AND public.tdc_fiber_er_admin());

CREATE POLICY "TDC fiber admins kan se salgslinjer" ON public.sale_items FOR SELECT TO authenticated
  USING (public.tdc_fiber_er_admin() AND EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND s.source = 'tdc_fiber_manual'));
CREATE POLICY "TDC fiber admins kan rette dagens salgslinjer" ON public.sale_items FOR UPDATE TO authenticated
  USING (public.tdc_fiber_er_admin() AND EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND s.source = 'tdc_fiber_manual'
    AND s.sale_datetime::date = (now() AT TIME ZONE 'Europe/Copenhagen')::date))
  WITH CHECK (public.tdc_fiber_er_admin() AND EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND s.source = 'tdc_fiber_manual'
    AND s.sale_datetime::date = (now() AT TIME ZONE 'Europe/Copenhagen')::date));
CREATE POLICY "TDC fiber admins kan oprette salgslinje" ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (public.tdc_fiber_er_admin() AND EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND s.source = 'tdc_fiber_manual'
    AND s.sale_datetime::date = (now() AT TIME ZONE 'Europe/Copenhagen')::date
    AND NOT EXISTS (SELECT 1 FROM public.sale_items x WHERE x.sale_id = s.id)));

-- Stempling også ved produktskift.
CREATE TRIGGER trg_tdc_fiber_stempl_salgslinje_upd BEFORE UPDATE OF product_id ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.tdc_fiber_stempl_salgslinje();

CREATE OR REPLACE FUNCTION public.tdc_fiber_ret_salg(
  p_salg_id uuid, p_ny_lead_id uuid, p_type text, p_variant text,
  p_mobilevoice boolean, p_cvr text, p_leadgiver uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_admin uuid := public.effective_employee_id();
  v_s record; v_lead record;
  v_saelger uuid; v_lead_id uuid;
  v_cvr text := regexp_replace(coalesce(p_cvr,''), '\s', '', 'g');
  v_lg_mail text; v_lg_navn text;
  v_foer jsonb; v_efter jsonb;
BEGIN
  IF v_admin IS NULL OR NOT public.tdc_fiber_er_admin() THEN
    RAISE EXCEPTION 'tdc_fiber_ingen_adgang' USING ERRCODE = 'P0001';
  END IF;
  SELECT id, raw_payload, sale_datetime INTO v_s FROM public.sales
   WHERE id = p_salg_id AND source = 'tdc_fiber_manual' AND raw_payload->>'rolle' IN ('fuldt','lukket') FOR UPDATE;
  IF v_s.id IS NULL THEN RAISE EXCEPTION 'tdc_fiber_salg_findes_ikke' USING ERRCODE = 'P0001'; END IF;
  IF v_s.sale_datetime::date <> (now() AT TIME ZONE 'Europe/Copenhagen')::date THEN
    RAISE EXCEPTION 'tdc_fiber_kun_i_dag' USING ERRCODE = 'P0001';
  END IF;
  IF p_type NOT IN ('fuldt','lukket') OR p_variant NOT IN ('HAP','VOK') OR p_mobilevoice IS NULL THEN
    RAISE EXCEPTION 'tdc_fiber_ugyldig_type' USING ERRCODE = 'P0001';
  END IF;
  IF v_cvr !~ '^[0-9]{8}$' THEN RAISE EXCEPTION 'tdc_fiber_ugyldigt_cvr' USING ERRCODE = 'P0001'; END IF;
  IF p_type = 'fuldt' AND p_leadgiver IS NOT NULL THEN RAISE EXCEPTION 'tdc_fiber_leadgiver_ikke_tilladt' USING ERRCODE = 'P0001'; END IF;
  IF p_type = 'lukket' AND p_leadgiver IS NULL THEN RAISE EXCEPTION 'tdc_fiber_leadgiver_mangler' USING ERRCODE = 'P0001'; END IF;
  v_saelger := (v_s.raw_payload->>'registreret_af')::uuid;
  IF p_leadgiver = v_saelger THEN RAISE EXCEPTION 'tdc_fiber_leadgiver_er_saelger' USING ERRCODE = 'P0001'; END IF;

  v_lead_id := nullif(v_s.raw_payload->>'lead_salg_id','')::uuid;
  IF v_lead_id IS NOT NULL THEN
    SELECT id, agent_email, validation_status INTO v_lead FROM public.sales WHERE id = v_lead_id FOR UPDATE;
  END IF;

  IF p_type = 'lukket' THEN
    SELECT lower(e.work_email), trim(e.first_name || ' ' || coalesce(e.last_name,'')) INTO v_lg_mail, v_lg_navn
      FROM public.employee_master_data e
     WHERE e.id = p_leadgiver AND e.is_active AND e.work_email IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.team_members tm JOIN public.teams t ON t.id = tm.team_id
                   WHERE tm.employee_id = e.id AND t.name IN ('Relatel','TDC Erhverv'));
    IF v_lg_mail IS NULL THEN RAISE EXCEPTION 'tdc_fiber_ugyldig_leadgiver' USING ERRCODE = 'P0001'; END IF;
    IF v_lead_id IS NULL THEN
      IF p_ny_lead_id IS NULL THEN RAISE EXCEPTION 'tdc_fiber_leadgiver_mangler' USING ERRCODE = 'P0001'; END IF;
      v_lead_id := p_ny_lead_id;
    END IF;
  END IF;

  v_foer := jsonb_build_object('salg', v_s.raw_payload, 'lead_agent', v_lead.agent_email, 'lead_status', v_lead.validation_status,
    'produkt', (SELECT product_id FROM public.sale_items WHERE sale_id = p_salg_id LIMIT 1));

  UPDATE public.sales SET raw_payload = raw_payload || jsonb_build_object(
      'rolle', p_type, 'leadResultFields', jsonb_build_object('OPP nr', v_cvr),
      'leadgiver_employee_id', p_leadgiver, 'lead_salg_id', v_lead_id)
   WHERE id = p_salg_id;
  UPDATE public.sale_items SET product_id = public.tdc_fiber_produkt(p_type, p_variant, p_mobilevoice) WHERE sale_id = p_salg_id;

  IF p_type = 'lukket' THEN
    IF v_lead.id IS NOT NULL THEN
      UPDATE public.sales SET agent_email = v_lg_mail, agent_name = v_lg_navn, validation_status = 'pending',
        raw_payload = raw_payload || jsonb_build_object('leadResultFields', jsonb_build_object('OPP nr', v_cvr))
       WHERE id = v_lead_id;
      UPDATE public.sale_items SET product_id = public.tdc_fiber_produkt('lead', p_variant, p_mobilevoice) WHERE sale_id = v_lead_id;
    ELSE
      INSERT INTO public.sales (id, client_campaign_id, agent_name, agent_email, sale_datetime, source, integration_type, validation_status, raw_payload)
      VALUES (v_lead_id, '374ce55d-5b01-41b9-a009-aad5f0feb288', v_lg_navn, v_lg_mail, v_s.sale_datetime, 'tdc_fiber_manual', 'manual', 'pending',
        jsonb_build_object('kilde','tdc_fiber_manual','rolle','lead','registreret_af',v_saelger::text,
          'leadResultFields', jsonb_build_object('OPP nr', v_cvr), 'lukker_employee_id', v_saelger, 'lukket_salg_id', p_salg_id));
      INSERT INTO public.sale_items (sale_id, product_id) VALUES (v_lead_id, public.tdc_fiber_produkt('lead', p_variant, p_mobilevoice));
    END IF;
  ELSIF v_lead.id IS NOT NULL THEN
    -- Fuldt salg: leaddelen bevares, men afvises så den giver 0 kr. alle steder.
    UPDATE public.sales SET validation_status = 'rejected',
      raw_payload = raw_payload || jsonb_build_object('leadResultFields', jsonb_build_object('OPP nr', v_cvr))
     WHERE id = v_lead_id;
  END IF;

  v_efter := jsonb_build_object('type', p_type, 'variant', p_variant, 'mobilevoice', p_mobilevoice, 'cvr', v_cvr,
    'leadgiver', p_leadgiver, 'lead_salg_id', v_lead_id);
  INSERT INTO public.tdc_fiber_rettelser (salg_id, rettet_af, foer, efter) VALUES (p_salg_id, v_admin, v_foer, v_efter);
  RETURN jsonb_build_object('status', 'rettet');
END $$;
REVOKE ALL ON FUNCTION public.tdc_fiber_ret_salg(uuid, uuid, text, text, boolean, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tdc_fiber_ret_salg(uuid, uuid, text, text, boolean, text, uuid) TO authenticated;