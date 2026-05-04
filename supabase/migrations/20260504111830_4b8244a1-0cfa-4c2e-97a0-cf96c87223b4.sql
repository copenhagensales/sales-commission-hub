-- 1. Datafix: luk runde 6 i Sæson 1 (sæsonen er allerede completed)
UPDATE public.league_rounds
SET status = 'completed'
WHERE season_id = '1413d941-ed9f-4c55-a7ff-d1bc948eb5da'
  AND status = 'active';

UPDATE public.league_seasons
SET is_active = false
WHERE id = '1413d941-ed9f-4c55-a7ff-d1bc948eb5da'
  AND is_active = true;

-- 2. Auto-advance funktion
CREATE OR REPLACE FUNCTION public.league_auto_advance_seasons()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_promoted_qual int := 0;
  v_promoted_active int := 0;
  v_completed int := 0;
  v_season record;
  v_active_exists boolean;
BEGIN
  -- draft -> qualification (når tilmeldingsperioden starter)
  FOR v_season IN
    SELECT id FROM public.league_seasons
    WHERE status = 'draft'
      AND qualification_start_at IS NOT NULL
      AND qualification_start_at <= v_now
  LOOP
    UPDATE public.league_seasons
    SET status = 'qualification', is_active = true
    WHERE id = v_season.id;
    v_promoted_qual := v_promoted_qual + 1;
  END LOOP;

  -- qualification -> active (når kval er slut OG sæson er startet)
  FOR v_season IN
    SELECT id FROM public.league_seasons
    WHERE status = 'qualification'
      AND qualification_end_at IS NOT NULL
      AND qualification_end_at <= v_now
      AND start_date IS NOT NULL
      AND start_date <= v_now::date
  LOOP
    -- Garanti: maks. 1 aktiv sæson - luk evt. eksisterende
    SELECT EXISTS (
      SELECT 1 FROM public.league_seasons
      WHERE status = 'active' AND id <> v_season.id
    ) INTO v_active_exists;

    IF v_active_exists THEN
      UPDATE public.league_seasons
      SET status = 'completed', is_active = false
      WHERE status = 'active' AND id <> v_season.id;
    END IF;

    UPDATE public.league_seasons
    SET status = 'active', is_active = true
    WHERE id = v_season.id;
    v_promoted_active := v_promoted_active + 1;
  END LOOP;

  -- active -> completed (når slutdato er passeret)
  FOR v_season IN
    SELECT id FROM public.league_seasons
    WHERE status = 'active'
      AND end_date IS NOT NULL
      AND end_date < v_now::date
  LOOP
    UPDATE public.league_seasons
    SET status = 'completed', is_active = false
    WHERE id = v_season.id;

    -- Luk åbne runder i sæsonen
    UPDATE public.league_rounds
    SET status = 'completed'
    WHERE season_id = v_season.id
      AND status = 'active';

    v_completed := v_completed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ran_at', v_now,
    'promoted_to_qualification', v_promoted_qual,
    'promoted_to_active', v_promoted_active,
    'completed', v_completed
  );
END;
$$;

COMMENT ON FUNCTION public.league_auto_advance_seasons() IS
  'Skifter automatisk liga-sæsoner mellem draft -> qualification -> active -> completed baseret på konfigurerede datoer. Køres af pg_cron hvert 5. minut.';