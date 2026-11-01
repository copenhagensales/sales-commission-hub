CREATE TABLE public.tdc_fiber_access (
  employee_id uuid PRIMARY KEY REFERENCES public.employee_master_data(id),
  rolle text NOT NULL DEFAULT 'saelger' CHECK (rolle IN ('saelger','admin')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.tdc_fiber_access IS 'Hvem må taste TDC Erhverv fibersalg (saelger) og vedligeholde listen (admin). Indeholder kun medarbejder-id og rolle.';
GRANT SELECT, INSERT, DELETE ON public.tdc_fiber_access TO authenticated;
GRANT ALL ON public.tdc_fiber_access TO service_role;
ALTER TABLE public.tdc_fiber_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY tdc_fiber_access_laes ON public.tdc_fiber_access FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY tdc_fiber_access_tilfoej ON public.tdc_fiber_access FOR INSERT TO authenticated
  WITH CHECK (
    public.is_owner(auth.uid())
    OR (rolle = 'saelger' AND EXISTS (SELECT 1 FROM public.tdc_fiber_access a WHERE a.employee_id = public.effective_employee_id() AND a.rolle = 'admin'))
  );
CREATE POLICY tdc_fiber_access_fjern ON public.tdc_fiber_access FOR DELETE TO authenticated
  USING (
    public.is_owner(auth.uid())
    OR (rolle = 'saelger' AND EXISTS (SELECT 1 FROM public.tdc_fiber_access a WHERE a.employee_id = public.effective_employee_id() AND a.rolle = 'admin'))
  );

-- Produkterne, der må tastes (eneste sted listen findes).
CREATE OR REPLACE FUNCTION public.tdc_fiber_produkt(p_type text, p_variant text, p_mobilevoice boolean)
RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE p_type || '|' || p_variant || '|' || p_mobilevoice::text
    WHEN 'fuldt|HAP|false'  THEN 'c63708fc-2f10-42a8-82dc-2728979908d9'
    WHEN 'fuldt|HAP|true'   THEN 'adc508fa-d2ba-4fe9-abe4-b0121cb0481f'
    WHEN 'fuldt|VOK|false'  THEN '25e393c0-95ea-4508-925e-0449c79cb023'
    WHEN 'fuldt|VOK|true'   THEN '8d7b6403-28a2-40ee-9877-be42e60e0f36'
    WHEN 'lukket|HAP|false' THEN 'ed0ea287-4e34-417a-98fc-de4e9aecc3bc'
    WHEN 'lukket|HAP|true'  THEN '59f00afb-ce48-4da1-a21c-8fefa93eb11a'
    WHEN 'lukket|VOK|false' THEN '34518fa2-0d01-41f5-9cf4-be8aeda803ff'
    WHEN 'lukket|VOK|true'  THEN '7a792b7d-d5f7-40cf-86d4-12b8165b23e7'
    WHEN 'lead|HAP|false'   THEN 'e63c9da4-3862-49e6-97df-ce5ca9ecc2e6'
    WHEN 'lead|HAP|true'    THEN '4ecf9122-5b57-497f-96b7-adbce0fb6652'
    WHEN 'lead|VOK|false'   THEN 'bd6ae50b-1516-4692-be9e-09b2317bf612'
    WHEN 'lead|VOK|true'    THEN 'b0030dec-23b3-4cf8-9d88-0b4affe1312c'
  END::uuid
$$;

-- Tastede salg: kun egne, kun i dag, kun TDC Erhverv-kampagnen.
CREATE POLICY "TDC fiber saelgere kan oprette tastede salg" ON public.sales FOR INSERT TO authenticated
  WITH CHECK (
    source = 'tdc_fiber_manual'
    AND client_campaign_id = '374ce55d-5b01-41b9-a009-aad5f0feb288'::uuid
    AND sale_datetime::date = (now() AT TIME ZONE 'Europe/Copenhagen')::date
    AND raw_payload->>'registreret_af' = public.effective_employee_id()::text
    AND EXISTS (SELECT 1 FROM public.tdc_fiber_access a WHERE a.employee_id = public.effective_employee_id())
  );
CREATE POLICY "TDC fiber saelgere kan se egne tastede salg" ON public.sales FOR SELECT TO authenticated
  USING (source = 'tdc_fiber_manual' AND raw_payload->>'registreret_af' = public.effective_employee_id()::text);

CREATE POLICY "TDC fiber saelgere kan oprette salgslinjer" ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_id AND s.source = 'tdc_fiber_manual'
      AND s.raw_payload->>'registreret_af' = public.effective_employee_id()::text
      AND s.created_at > now() - interval '10 minutes'
      AND NOT EXISTS (SELECT 1 FROM public.sale_items x WHERE x.sale_id = s.id)
  ));
CREATE POLICY "TDC fiber saelgere kan se egne salgslinjer" ON public.sale_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND s.source = 'tdc_fiber_manual'
    AND s.raw_payload->>'registreret_af' = public.effective_employee_id()::text));

-- Provision/omsætning kan ikke sættes af klienten: stemples fra produktet.
CREATE OR REPLACE FUNCTION public.tdc_fiber_stempl_salgslinje()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_rolle text; v_p record;
BEGIN
  SELECT s.raw_payload->>'rolle' INTO v_rolle FROM public.sales s
   WHERE s.id = NEW.sale_id AND s.source = 'tdc_fiber_manual';
  IF v_rolle IS NULL THEN RETURN NEW; END IF;
  SELECT id, name, commission_dkk, revenue_dkk INTO v_p FROM public.products WHERE id = NEW.product_id;
  IF v_p.id IS NULL OR NOT EXISTS (
     SELECT 1 FROM unnest(ARRAY['fuldt','lukket','lead']) t, unnest(ARRAY['HAP','VOK']) v, unnest(ARRAY[false,true]) m
     WHERE public.tdc_fiber_produkt(t, v, m) = v_p.id AND t = v_rolle) THEN
    RAISE EXCEPTION 'tdc_fiber_ugyldigt_produkt' USING ERRCODE = 'P0001';
  END IF;
  NEW.quantity := 1;
  NEW.unit_price := 0;
  NEW.mapped_commission := v_p.commission_dkk;
  NEW.mapped_revenue := v_p.revenue_dkk;
  NEW.display_name := v_p.name;
  NEW.adversus_product_title := v_p.name;
  NEW.needs_mapping := false;
  NEW.is_immediate_payment := false;
  NEW.manual_pricing_lock := false;
  NEW.matched_pricing_rule_id := NULL;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_tdc_fiber_stempl_salgslinje BEFORE INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.tdc_fiber_stempl_salgslinje();

-- Opret et tastet fibersalg (SECURITY INVOKER; RLS gælder).
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
  IF v_mig IS NULL OR NOT EXISTS (SELECT 1 FROM public.tdc_fiber_access WHERE employee_id = v_mig) THEN
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

  -- Allerede oprettet med samme klient-id: ingen ny registrering.
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
REVOKE ALL ON FUNCTION public.tdc_fiber_opret_salg(uuid, uuid, text, text, boolean, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tdc_fiber_opret_salg(uuid, uuid, text, text, boolean, text, uuid) TO authenticated;

INSERT INTO public.tdc_fiber_access (employee_id, rolle) VALUES
  ('1e843f87-bf0b-47dd-9fb3-91bb5518436b', 'admin'),
  ('c3c81fce-3bbb-4a5f-8250-0611bce0d7f1', 'admin');