DO $$
DECLARE
  v_client_id uuid;
  v_campaign_id uuid;
  v_product_forwarder uuid;
  v_product_closer uuid;
  v_team_id uuid := '0cb1b854-e7b5-4f49-8fdf-30e54e7d2f95'; -- Eesy TM
BEGIN
  -- 1. Client
  INSERT INTO public.clients (name)
  VALUES ('Hiper')
  RETURNING id INTO v_client_id;

  -- 2. Campaign
  INSERT INTO public.client_campaigns (client_id, name)
  VALUES (v_client_id, 'Hiper Bredbånd')
  RETURNING id INTO v_campaign_id;

  -- 3. Products
  INSERT INTO public.products (client_campaign_id, name, commission_dkk, revenue_dkk, counts_as_sale, is_active, priority, external_product_code)
  VALUES (v_campaign_id, 'Hiper Viderestilling', 400, 0, true, true, 100, 'HIPER_FORWARDER')
  RETURNING id INTO v_product_forwarder;

  INSERT INTO public.products (client_campaign_id, name, commission_dkk, revenue_dkk, counts_as_sale, is_active, priority, external_product_code)
  VALUES (v_campaign_id, 'Hiper Lukning', 200, 0, true, true, 100, 'HIPER_CLOSER')
  RETURNING id INTO v_product_closer;

  -- 4. Pricing rules (locks the price so rematch does not overwrite)
  INSERT INTO public.product_pricing_rules (product_id, name, conditions, commission_dkk, revenue_dkk, priority, is_active, campaign_match_mode)
  VALUES
    (v_product_forwarder, 'Hiper Viderestilling - default', '{}'::jsonb, 400, 0, 100, true, 'include'),
    (v_product_closer,    'Hiper Lukning - default',       '{}'::jsonb, 200, 0, 100, true, 'include');

  -- 5. Assign Hiper to Eesy TM's team
  INSERT INTO public.team_clients (team_id, client_id)
  VALUES (v_team_id, v_client_id)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Created Hiper client=% campaign=% forwarder=% closer=%',
    v_client_id, v_campaign_id, v_product_forwarder, v_product_closer;
END $$;