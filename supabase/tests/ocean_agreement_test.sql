-- Ocean Outdoor: aftalevindue, "uden for aftale" og listepriser.
-- Kører i én DO-blok og ruller altid tilbage (afsluttes med RAISE EXCEPTION 'OK ...').
-- Resultat: fejlbesked der starter med 'OK' = alle tests bestået.
DO $$
DECLARE
  v_at timestamptz := '2026-10-01 12:00+02';
  v_base numeric;
  v_now numeric;
  v_src public.booking%ROWTYPE;
  v_h uuid;
  v_r uuid := '6bd924e2-3e73-4775-83cf-f8b52cd89726';
  v_hp numeric;
BEGIN
  SELECT * INTO v_src FROM public.booking WHERE id = '5c4b3541-3f2c-44f2-afe3-9362400761b6';
  v_base := public.supplier_discount_basis('Ocean Outdoor', v_at, NULL, false);

  -- 1) Booking oprettet før 11/3-2026 tæller ikke
  INSERT INTO public.booking(location_id, client_id, campaign_id, brand_id, start_date, end_date, week_number, year, status, total_price, created_at)
  VALUES (v_src.location_id, v_src.client_id, v_src.campaign_id, v_src.brand_id, '2026-03-02', '2026-03-06', 10, 2026, 'confirmed', 100000, '2026-03-10 12:00+01');
  v_now := public.supplier_discount_basis('Ocean Outdoor', v_at, NULL, false);
  IF v_now <> v_base THEN RAISE EXCEPTION 'FEJL 1: booking før aftalestart talte med (% -> %)', v_base, v_now; END IF;

  -- 2) Booking oprettet 11/3-2026 tæller
  INSERT INTO public.booking(location_id, client_id, campaign_id, brand_id, start_date, end_date, week_number, year, status, total_price, created_at)
  VALUES (v_src.location_id, v_src.client_id, v_src.campaign_id, v_src.brand_id, '2026-03-16', '2026-03-20', 12, 2026, 'confirmed', 1000, '2026-03-11 09:00+01');
  v_now := public.supplier_discount_basis('Ocean Outdoor', v_at, NULL, false);
  IF v_now <> v_base + 1000 THEN RAISE EXCEPTION 'FEJL 2: booking i aftalevinduet talte ikke (% -> %)', v_base, v_now; END IF;
  v_base := v_now;

  -- 3) "Uden for aftale" (Rosengårdcentret) tæller ikke og får 0 %
  INSERT INTO public.booking(location_id, client_id, campaign_id, brand_id, start_date, end_date, week_number, year, status, total_price, created_at)
  VALUES ('9fc6e634-62ad-4e34-a797-62b9c2a19c68', v_src.client_id, v_src.campaign_id, v_src.brand_id, '2026-04-06', '2026-04-10', 15, 2026, 'confirmed', 50000, '2026-04-01 12:00+02');
  v_now := public.supplier_discount_basis('Ocean Outdoor', v_at, NULL, false);
  IF v_now <> v_base THEN RAISE EXCEPTION 'FEJL 3: uden-for-aftale talte med (% -> %)', v_base, v_now; END IF;
  IF (SELECT discount_percent FROM public.calc_supplier_discount_at('9fc6e634-62ad-4e34-a797-62b9c2a19c68', v_at, NULL)) <> 0 THEN
    RAISE EXCEPTION 'FEJL 3b: uden-for-aftale fik trapperabat';
  END IF;

  -- 4) Listepriser: Hørsholm K1 og Ro's Torv K1 (uge 43: man 19/10 .. søn 25/10)
  SELECT id INTO v_h FROM public.location_placements
   WHERE location_id = '51b28ee3-0e64-4cc7-bf41-4d45d734169d' AND name = 'K1 - Indgang hovedgade';
  IF public.list_price_gross(v_h, '2026-10-19', '2026-10-19', ARRAY[0]) <> 2163 THEN RAISE EXCEPTION 'FEJL 4: Hørsholm 1 dag'; END IF;
  IF public.list_price_gross(v_h, '2026-10-19', '2026-10-21', ARRAY[0,1,2]) <> 6489 THEN RAISE EXCEPTION 'FEJL 4: Hørsholm 3 dage'; END IF;
  IF public.list_price_gross(v_h, '2026-10-19', '2026-10-22', ARRAY[0,1,2,3]) <> 3785 THEN RAISE EXCEPTION 'FEJL 4: Hørsholm 4 dage'; END IF;
  IF public.list_price_gross(v_h, '2026-10-19', '2026-10-23', ARRAY[0,1,2,3,4]) <> 4732 THEN RAISE EXCEPTION 'FEJL 4: Hørsholm 5 dage'; END IF;
  IF public.list_price_gross(v_h, '2026-10-19', '2026-10-25', ARRAY[0,1,2,3,4,5,6]) <> 6489 THEN RAISE EXCEPTION 'FEJL 4: Hørsholm 7 dage'; END IF;
  IF public.list_price_gross(v_r, '2026-10-19', '2026-10-19', ARRAY[0]) <> 3245 THEN RAISE EXCEPTION 'FEJL 4: Ro K1 1 dag'; END IF;
  IF public.list_price_gross(v_r, '2026-10-19', '2026-10-21', ARRAY[0,1,2]) <> 9735 THEN RAISE EXCEPTION 'FEJL 4: Ro K1 3 dage'; END IF;
  IF public.list_price_gross(v_r, '2026-10-19', '2026-10-22', ARRAY[0,1,2,3]) <> 12978 THEN RAISE EXCEPTION 'FEJL 4: Ro K1 4 dage'; END IF;
  IF public.list_price_gross(v_r, '2026-10-19', '2026-10-23', ARRAY[0,1,2,3,4]) <> 16223 THEN RAISE EXCEPTION 'FEJL 4: Ro K1 5 dage'; END IF;
  IF public.list_price_gross(v_r, '2026-10-19', '2026-10-25', ARRAY[0,1,2,3,4,5,6]) <> 16223 THEN RAISE EXCEPTION 'FEJL 4: Ro K1 7 dage'; END IF;

  -- 5) Ny booking på placering med listepris stemples med listeprisen
  INSERT INTO public.booking(location_id, placement_id, client_id, campaign_id, brand_id, start_date, end_date, week_number, year, status, booked_days)
  VALUES ('51b28ee3-0e64-4cc7-bf41-4d45d734169d', v_h, v_src.client_id, v_src.campaign_id, v_src.brand_id, '2026-11-02', '2026-11-05', 45, 2026, 'draft', ARRAY[0,1,2,3])
  RETURNING total_price INTO v_hp;
  IF v_hp <> 3785 THEN RAISE EXCEPTION 'FEJL 5: ny booking fik ikke 4-dagespris (%)', v_hp; END IF;

  -- 6) Eksisterende brutto uændret (stikprøve: Hørsholm 5-9/10 uden placering = 946 x 5)
  IF public.booking_gross_amount('5c4b3541-3f2c-44f2-afe3-9362400761b6') <> 4730 THEN RAISE EXCEPTION 'FEJL 6: eksisterende brutto ændret'; END IF;

  RAISE EXCEPTION 'OK: alle Ocean-aftaletests bestået (rulles tilbage)';
END $$;
