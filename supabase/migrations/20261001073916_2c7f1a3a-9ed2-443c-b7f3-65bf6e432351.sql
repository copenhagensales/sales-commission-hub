CREATE OR REPLACE FUNCTION public.league_start_new_season(p_qualification_start date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qual_start timestamptz;
  v_qual_end timestamptz;
  v_config jsonb;
  v_next int;
  v_id uuid;
BEGIN
  IF NOT public.has_page_permission(auth.uid(), 'menu_league_admin', true) THEN
    RAISE EXCEPTION 'Du har ikke rettighed til at starte en ny sæson';
  END IF;
  IF p_qualification_start IS NULL OR extract(isodow from p_qualification_start) <> 1 THEN
    RAISE EXCEPTION 'Kvalifikationen skal starte på en mandag';
  END IF;
  IF EXISTS (SELECT 1 FROM league_seasons WHERE status IN ('qualification','active','draft')) THEN
    RAISE EXCEPTION 'Der kører allerede en sæson. Den skal være afsluttet først';
  END IF;

  v_qual_start := (p_qualification_start::timestamp) AT TIME ZONE 'Europe/Copenhagen';
  v_qual_end := ((p_qualification_start + 6)::timestamp + interval '23 hours 55 minutes 59 seconds') AT TIME ZONE 'Europe/Copenhagen';

  SELECT config, season_number + 1 INTO v_config, v_next
  FROM league_seasons ORDER BY season_number DESC LIMIT 1;

  v_config := COALESCE(v_config, '{"division_bonus_base":18,"division_bonus_step":5,"players_per_division":10}'::jsonb)
    || '{"round_end_hour":23,"round_end_minute":55}'::jsonb;

  UPDATE league_seasons SET is_active = false WHERE is_active = true;

  INSERT INTO league_seasons (season_number, qualification_source_start, qualification_source_end,
    qualification_start_at, qualification_end_at, start_date, end_date, is_active, status, config)
  VALUES (COALESCE(v_next, 1), v_qual_start, v_qual_end, v_qual_start, v_qual_end,
    p_qualification_start + 7, p_qualification_start + 48, true, 'qualification', v_config)
  RETURNING id INTO v_id;

  PERFORM public.league_enroll_from_sales(v_id, v_qual_start);
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.league_start_new_season(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.league_start_new_season(date) TO authenticated;