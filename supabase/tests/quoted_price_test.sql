-- "Spørg om pris"-lokationer (outside_agreement). Ruller altid tilbage.
-- Resultat 'OK ...' i fejlbeskeden = alle tests bestået.
DO $$
DECLARE
  v_src public.booking%ROWTYPE;
  v_ros uuid := '9fc6e634-62ad-4e34-a797-62b9c2a19c68';
  v_id uuid;
  v_b public.booking%ROWTYPE;
  v_before numeric;
  v_ok boolean := false;
BEGIN
  SELECT * INTO v_src FROM public.booking WHERE id = '5c4b3541-3f2c-44f2-afe3-9362400761b6';

  -- 1) Insert uden pris afvises
  BEGIN
    INSERT INTO public.booking(location_id, client_id, campaign_id, brand_id, start_date, end_date, week_number, year, status)
    VALUES (v_ros, v_src.client_id, v_src.campaign_id, v_src.brand_id, '2026-11-09', '2026-11-13', 46, 2026, 'draft');
  EXCEPTION WHEN raise_exception THEN
    v_ok := SQLERRM LIKE 'Lokationen er ''spørg om pris''%';
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FEJL 1: insert uden pris blev ikke afvist korrekt'; END IF;

  -- 2) Insert med pris stemples quoted
  INSERT INTO public.booking(location_id, client_id, campaign_id, brand_id, start_date, end_date, week_number, year, status, total_price, quoted_price_date, quoted_price_ref)
  VALUES (v_ros, v_src.client_id, v_src.campaign_id, v_src.brand_id, '2026-11-09', '2026-11-13', 46, 2026, 'draft', 12345, '2026-10-20', 'test')
  RETURNING * INTO v_b;
  IF v_b.price_model <> 'quoted' OR v_b.total_price <> 12345 THEN RAISE EXCEPTION 'FEJL 2: ikke stemplet quoted'; END IF;
  v_id := v_b.id;

  -- 3) Ændring af lokationens dagspris ændrer ikke eksisterende brutto
  v_before := public.booking_gross_amount('f3e7cbfd-a2e6-4a4f-94e5-ae65b3beaafb');
  UPDATE public.location SET daily_rate = 99999 WHERE id = v_ros;
  UPDATE public.location SET daily_rate = 99999 WHERE id = '6cba8ee4-eb4d-491b-898e-660f9de06c80'; -- Esbjerg (manuel total_price)
  IF public.booking_gross_amount('f3e7cbfd-a2e6-4a4f-94e5-ae65b3beaafb') <> v_before
     OR public.booking_gross_amount(v_id) <> 12345
     OR public.booking_gross_amount('7f2df1db-7564-456a-a5fd-ff3b70fc6109') <> 6219 THEN
    RAISE EXCEPTION 'FEJL 3: dagspris-ændring påvirkede brutto';
  END IF;

  -- 4) Datoændring sætter price_review_needed uden at ændre pris
  UPDATE public.booking SET end_date = '2026-11-12', booked_days = ARRAY[0,1,2,3] WHERE id = v_id RETURNING * INTO v_b;
  IF NOT v_b.price_review_needed OR v_b.total_price <> 12345
     OR v_b.price_note <> 'Periode ændret – bekræft pris med Ocean' THEN
    RAISE EXCEPTION 'FEJL 4: datoændring håndteret forkert';
  END IF;

  -- 5) Listepris-triggeren ignorerer outside_agreement (placering med listepris på Rosengård)
  INSERT INTO public.location_placements(location_id, name, daily_rate, list_day_price, list_week_price, list_4day_price, list_5day_price)
  VALUES (v_ros, 'TEST', 1000, 1000, 5000, 4000, 4500) RETURNING id INTO v_id;
  INSERT INTO public.booking(location_id, placement_id, client_id, campaign_id, brand_id, start_date, end_date, week_number, year, status, total_price)
  VALUES (v_ros, v_id, v_src.client_id, v_src.campaign_id, v_src.brand_id, '2026-11-16', '2026-11-20', 47, 2026, 'draft', 7777)
  RETURNING * INTO v_b;
  IF v_b.total_price <> 7777 OR v_b.price_model <> 'quoted' THEN RAISE EXCEPTION 'FEJL 5: listepris rørte quoted-booking'; END IF;

  RAISE EXCEPTION 'OK: alle spørg-om-pris-tests bestået (rulles tilbage)';
END $$;
