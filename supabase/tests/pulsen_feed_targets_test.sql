-- Pulsen beslutning B: reaktioner/kommentarer kun på Huset-indhold.
-- Køres med privilegeret forbindelse; alt rulles tilbage via bevidst RAISE til sidst.
DO $$
DECLARE
  u_a uuid; e_a uuid; t_a uuid;
  p_house uuid; p_team uuid; p_hidden uuid; m_house uuid; m_team uuid;
  ok boolean; n int; passes int := 0; fails text[] := '{}';
  r_before int; c_before int; r_vis int; c_vis int;
BEGIN
  SELECT m.id, m.auth_user_id, tm.team_id INTO e_a, u_a, t_a
  FROM public.team_members tm JOIN public.employee_master_data m ON m.id = tm.employee_id
  WHERE m.is_active AND m.auth_user_id IS NOT NULL AND NOT public.is_owner(m.auth_user_id)
    AND public.has_edit_permission(m.auth_user_id, 'action_pulsen_post_house')
  ORDER BY m.created_at LIMIT 1;
  IF e_a IS NULL THEN RAISE EXCEPTION 'fixture-mangel'; END IF;

  SELECT count(*) INTO r_before FROM public.feed_reactions WHERE target_type IN ('birthday','anniversary','league_round');
  SELECT count(*) INTO c_before FROM public.feed_comments WHERE target_type IN ('birthday','anniversary','league_round');

  INSERT INTO public.pulsen_milestones (milestone_type, employee_id, period_key, shown_in_house)
    VALUES ('first_sale', e_a, 'TEST-house', true) RETURNING id INTO m_house;
  INSERT INTO public.pulsen_milestones (milestone_type, employee_id, team_id, period_key, shown_in_house)
    VALUES ('first_sale', e_a, t_a, 'TEST-team', false) RETURNING id INTO m_team;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.pulsen_posts (author_employee_id, audience, post_type, body) VALUES (e_a, 'house', 'question', 'TEST hus') RETURNING id INTO p_house;
  INSERT INTO public.pulsen_posts (author_employee_id, audience, team_id, post_type, body) VALUES (e_a, 'team', t_a, 'question', 'TEST team') RETURNING id INTO p_team;

  -- Huset-indlæg: virker
  INSERT INTO public.feed_reactions (target_type, target_key, user_id, emoji) VALUES ('pulsen_post', 'pulsen_post:' || p_house, u_a, '👏');
  INSERT INTO public.feed_comments (target_type, target_key, user_id, body) VALUES ('pulsen_post', 'pulsen_post:' || p_house, u_a, 'TEST svar');
  SELECT count(*) INTO n FROM public.feed_comments WHERE target_key = 'pulsen_post:' || p_house;
  IF n = 1 THEN passes := passes + 1; ELSE fails := fails || 'Huset-kommentar ikke læsbar'; END IF;
  SELECT count(*) INTO n FROM public.feed_reactions WHERE target_key = 'pulsen_post:' || p_house;
  IF n = 1 THEN passes := passes + 1; ELSE fails := fails || 'Huset-reaktion ikke læsbar'; END IF;
  -- Bedste svar på Huset-spørgsmål
  UPDATE public.pulsen_posts SET best_answer_comment_id = (SELECT id FROM public.feed_comments WHERE target_key = 'pulsen_post:' || p_house) WHERE id = p_house;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 1 THEN passes := passes + 1; ELSE fails := fails || 'Bedste svar kunne ikke sættes'; END IF;

  -- Huset-milepæl: virker
  INSERT INTO public.feed_reactions (target_type, target_key, user_id, emoji) VALUES ('milestone', 'milestone:' || m_house, u_a, '👏');
  passes := passes + 1;

  -- Team-indlæg: afvises (reaktion og kommentar)
  ok := false; BEGIN
    INSERT INTO public.feed_reactions (target_type, target_key, user_id, emoji) VALUES ('pulsen_post', 'pulsen_post:' || p_team, u_a, '👏');
  EXCEPTION WHEN others THEN ok := true; END;
  IF ok THEN passes := passes + 1; ELSE fails := fails || 'Reaktion på team-indlæg tilladt'; END IF;
  ok := false; BEGIN
    INSERT INTO public.feed_comments (target_type, target_key, user_id, body) VALUES ('pulsen_post', 'pulsen_post:' || p_team, u_a, 'TEST');
  EXCEPTION WHEN others THEN ok := true; END;
  IF ok THEN passes := passes + 1; ELSE fails := fails || 'Kommentar på team-indlæg tilladt'; END IF;

  -- Team-milepæl: afvises
  ok := false; BEGIN
    INSERT INTO public.feed_reactions (target_type, target_key, user_id, emoji) VALUES ('milestone', 'milestone:' || m_team, u_a, '👏');
  EXCEPTION WHEN others THEN ok := true; END;
  IF ok THEN passes := passes + 1; ELSE fails := fails || 'Reaktion på team-milepæl tilladt'; END IF;
  ok := false; BEGIN
    INSERT INTO public.feed_comments (target_type, target_key, user_id, body) VALUES ('milestone', 'milestone:' || m_team, u_a, 'TEST');
  EXCEPTION WHEN others THEN ok := true; END;
  IF ok THEN passes := passes + 1; ELSE fails := fails || 'Kommentar på team-milepæl tilladt'; END IF;

  -- Forkert nøgleformat afvises
  ok := false; BEGIN
    INSERT INTO public.feed_reactions (target_type, target_key, user_id, emoji) VALUES ('pulsen_post', 'pulsen_post:' || p_house || ':x', u_a, '👏');
  EXCEPTION WHEN others THEN ok := true; END;
  IF ok THEN passes := passes + 1; ELSE fails := fails || 'Forkert nøgle tilladt'; END IF;

  -- Slettet Huset-indlæg: reaktioner bliver usynlige og nye afvises
  UPDATE public.pulsen_posts SET deleted_at = now() WHERE id = p_house;
  SELECT count(*) INTO n FROM public.feed_reactions WHERE target_key = 'pulsen_post:' || p_house;
  IF n = 0 THEN passes := passes + 1; ELSE fails := fails || 'Reaktion på slettet indlæg synlig'; END IF;
  ok := false; BEGIN
    INSERT INTO public.feed_comments (target_type, target_key, user_id, body) VALUES ('pulsen_post', 'pulsen_post:' || p_house, u_a, 'TEST');
  EXCEPTION WHEN others THEN ok := true; END;
  IF ok THEN passes := passes + 1; ELSE fails := fails || 'Kommentar på slettet indlæg tilladt'; END IF;

  -- Eksisterende typer: uændret synlighed
  SELECT count(*) INTO r_vis FROM public.feed_reactions WHERE target_type IN ('birthday','anniversary','league_round');
  SELECT count(*) INTO c_vis FROM public.feed_comments WHERE target_type IN ('birthday','anniversary','league_round');
  IF r_vis = r_before AND c_vis = c_before THEN passes := passes + 1;
  ELSE fails := fails || format('eksisterende typer ændret r %s/%s c %s/%s', r_vis, r_before, c_vis, c_before); END IF;
  EXECUTE 'RESET ROLE';

  RAISE EXCEPTION 'PULSEN_FEED_TARGETS_TEST (rullet tilbage) pass=% fail=% % | eksisterende r=%/% c=%/%',
    passes, coalesce(array_length(fails, 1), 0), fails, r_vis, r_before, c_vis, c_before;
END $$;
