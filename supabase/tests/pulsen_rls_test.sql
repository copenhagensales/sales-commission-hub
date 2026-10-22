-- Pulsen RLS-test (genkørbar). Kører i én transaktion og slutter ALTID med RAISE EXCEPTION,
-- så intet gemmes. Resultatet står i fejlbeskeden: "PULSEN_RLS_TEST ... pass=X fail=Y [fejlliste]".
-- Kræver en privilegeret forbindelse (kan skifte til rollen authenticated).
-- Bruger rigtige medarbejdere som testpersoner, men udskriver aldrig id'er eller navne.
-- v1 (Kasper 22/10): team-indhold har ingen reaktioner/kommentarer; feed-tabellerne er uændrede.
-- Forventet baseline for eksisterende feed-typer: alle rækker synlige for en almindelig medarbejder.
DO $$
DECLARE
  team_a uuid; team_b uuid;
  u_emp_a uuid; e_emp_a uuid;   -- kun medlem af A
  u_emp_b uuid; e_emp_b uuid;   -- kun medlem af B
  u_lead_a uuid; e_lead_a uuid; -- teamleder for A (ikke B)
  u_owner uuid; e_owner uuid;
  u_two uuid; e_two uuid; two_t1 uuid; two_t2 uuid;
  u_none uuid; e_none uuid;
  p_house uuid; p_a uuid; p_b uuid; p_two1 uuid; p_two2 uuid;
  n int; ok boolean;
  passes int := 0; fails text[] := '{}';
  old_r_total int; old_c_total int; old_r_vis int; old_c_vis int;
BEGIN
  -- Fixtures (som privilegeret rolle)
  SELECT t.id, t.team_leader_id, e.auth_user_id INTO team_a, e_lead_a, u_lead_a
  FROM public.teams t JOIN public.employee_master_data e ON e.id = t.team_leader_id
  WHERE e.is_active AND e.auth_user_id IS NOT NULL AND NOT public.is_owner(e.auth_user_id)
    AND public.has_edit_permission(e.auth_user_id, 'action_pulsen_moderate')
    AND EXISTS (SELECT 1 FROM public.team_members tm JOIN public.employee_master_data m ON m.id = tm.employee_id
                WHERE tm.team_id = t.id AND m.is_active AND m.auth_user_id IS NOT NULL AND m.id <> e.id
                  AND (SELECT count(*) FROM public.team_members x WHERE x.employee_id = m.id) = 1)
  ORDER BY t.name LIMIT 1;

  SELECT m.id, m.auth_user_id INTO e_emp_a, u_emp_a
  FROM public.team_members tm JOIN public.employee_master_data m ON m.id = tm.employee_id
  WHERE tm.team_id = team_a AND m.is_active AND m.auth_user_id IS NOT NULL AND m.id <> e_lead_a
    AND NOT public.is_owner(m.auth_user_id)
    AND (SELECT count(*) FROM public.team_members x WHERE x.employee_id = m.id) = 1
    AND NOT EXISTS (SELECT 1 FROM public.teams t2 WHERE t2.team_leader_id = m.id)
    AND NOT EXISTS (SELECT 1 FROM public.team_assistant_leaders a WHERE a.employee_id = m.id)
  ORDER BY m.created_at LIMIT 1;

  SELECT tm.team_id, m.id, m.auth_user_id INTO team_b, e_emp_b, u_emp_b
  FROM public.team_members tm JOIN public.employee_master_data m ON m.id = tm.employee_id
  WHERE tm.team_id <> team_a AND m.is_active AND m.auth_user_id IS NOT NULL
    AND NOT public.is_owner(m.auth_user_id)
    AND (SELECT count(*) FROM public.team_members x WHERE x.employee_id = m.id) = 1
    AND NOT EXISTS (SELECT 1 FROM public.teams t2 WHERE t2.team_leader_id = m.id)
    AND NOT EXISTS (SELECT 1 FROM public.team_assistant_leaders a WHERE a.employee_id = m.id)
    AND NOT EXISTS (SELECT 1 FROM public.team_members y WHERE y.employee_id = e_lead_a AND y.team_id = tm.team_id)
    AND NOT EXISTS (SELECT 1 FROM public.teams t3 WHERE t3.id = tm.team_id AND t3.team_leader_id = e_lead_a)
    AND NOT EXISTS (SELECT 1 FROM public.team_assistant_leaders a2 WHERE a2.team_id = tm.team_id AND a2.employee_id = e_lead_a)
  ORDER BY m.created_at LIMIT 1;

  SELECT m.id, m.auth_user_id INTO e_owner, u_owner FROM public.employee_master_data m
  WHERE m.is_active AND m.auth_user_id IS NOT NULL AND public.is_owner(m.auth_user_id)
  ORDER BY m.created_at LIMIT 1;

  SELECT m.id, m.auth_user_id INTO e_two, u_two FROM public.employee_master_data m
  WHERE m.is_active AND m.auth_user_id IS NOT NULL AND NOT public.is_owner(m.auth_user_id)
    AND (SELECT count(*) FROM public.team_members x WHERE x.employee_id = m.id) >= 2
  ORDER BY m.created_at LIMIT 1;
  SELECT (array_agg(team_id ORDER BY team_id))[1], (array_agg(team_id ORDER BY team_id))[2] INTO two_t1, two_t2
  FROM public.team_members WHERE employee_id = e_two;

  SELECT m.id, m.auth_user_id INTO e_none, u_none FROM public.employee_master_data m
  WHERE m.is_active AND m.auth_user_id IS NOT NULL AND NOT public.is_owner(m.auth_user_id)
    AND NOT EXISTS (SELECT 1 FROM public.team_members x WHERE x.employee_id = m.id)
    AND NOT EXISTS (SELECT 1 FROM public.teams t WHERE t.team_leader_id = m.id)
    AND NOT EXISTS (SELECT 1 FROM public.team_assistant_leaders a WHERE a.employee_id = m.id)
  ORDER BY m.created_at LIMIT 1;

  IF team_a IS NULL OR e_emp_a IS NULL OR team_b IS NULL OR e_owner IS NULL OR e_two IS NULL OR e_none IS NULL THEN
    RAISE EXCEPTION 'PULSEN_RLS_TEST fixture-mangel: A=% empA=% B=% owner=% two=% none=%',
      team_a IS NOT NULL, e_emp_a IS NOT NULL, team_b IS NOT NULL, e_owner IS NOT NULL, e_two IS NOT NULL, e_none IS NOT NULL;
  END IF;

  SELECT count(*) INTO old_r_total FROM public.feed_reactions WHERE target_type IN ('birthday','anniversary','league_round');
  SELECT count(*) INTO old_c_total FROM public.feed_comments WHERE target_type IN ('birthday','anniversary','league_round');

  -- ===== Medarbejder A opretter indlæg =====
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_emp_a, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.pulsen_posts (author_employee_id, audience, post_type, body)
    VALUES (e_emp_a, 'house', 'post', 'TEST hus') RETURNING id INTO p_house;
  INSERT INTO public.pulsen_posts (author_employee_id, audience, team_id, post_type, body)
    VALUES (e_emp_a, 'team', team_a, 'post', 'TEST A') RETURNING id INTO p_a;
  -- A må ikke poste i B
  ok := false;
  BEGIN
    INSERT INTO public.pulsen_posts (author_employee_id, audience, team_id, post_type, body)
      VALUES (e_emp_a, 'team', team_b, 'post', 'TEST forbudt');
  EXCEPTION WHEN others THEN ok := true; END;
  IF ok THEN passes := passes + 1; ELSE fails := fails || 'A kunne poste i team B'; END IF;
  -- A må ikke poste som en anden
  ok := false;
  BEGIN
    INSERT INTO public.pulsen_posts (author_employee_id, audience, post_type, body)
      VALUES (e_emp_b, 'house', 'post', 'TEST falsk forfatter');
  EXCEPTION WHEN others THEN ok := true; END;
  IF ok THEN passes := passes + 1; ELSE fails := fails || 'A kunne poste som B'; END IF;
  EXECUTE 'RESET ROLE';

  -- ===== Medarbejder B opretter indlæg =====
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_emp_b, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.pulsen_posts (author_employee_id, audience, team_id, post_type, body)
    VALUES (e_emp_b, 'team', team_b, 'post', 'TEST B') RETURNING id INTO p_b;
  SELECT count(*) INTO n FROM public.pulsen_posts WHERE id = p_a;
  IF n = 0 THEN passes := passes + 1; ELSE fails := fails || 'B ser A-indlæg'; END IF;
  EXECUTE 'RESET ROLE';

  -- ===== Medarbejder A læser =====
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_emp_a, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.pulsen_posts WHERE id IN (p_house, p_a);
  IF n = 2 THEN passes := passes + 1; ELSE fails := fails || 'A ser ikke egne hus/team-indlæg'; END IF;
  SELECT count(*) INTO n FROM public.pulsen_posts WHERE id = p_b;
  IF n = 0 THEN passes := passes + 1; ELSE fails := fails || 'A ser B-indlæg'; END IF;
  ok := false;
  BEGIN
    INSERT INTO public.feed_comments (target_type, target_key, user_id, body)
      VALUES ('pulsen_post', 'pulsen_post:' || p_b, u_emp_a, 'TEST forbudt');
  EXCEPTION WHEN others THEN ok := true; END;
  IF ok THEN passes := passes + 1; ELSE fails := fails || 'Pulsen-indhold kunne kommenteres via feed_comments (v1 forbyder det)'; END IF;
  ok := false;
  BEGIN
    INSERT INTO public.feed_reactions (target_type, target_key, user_id, emoji)
      VALUES ('pulsen_post', 'pulsen_post:' || p_a, u_emp_a, '👏');
  EXCEPTION WHEN others THEN ok := true; END;
  IF ok THEN passes := passes + 1; ELSE fails := fails || 'Pulsen-indhold kunne få reaktioner via feed_reactions (v1 forbyder det)'; END IF;
  -- Almindelig medarbejder må ikke skjule
  ok := false;
  BEGIN
    UPDATE public.pulsen_posts SET hidden_at = now() WHERE id = p_house;
  EXCEPTION WHEN others THEN ok := true; END;
  IF ok THEN passes := passes + 1; ELSE fails := fails || 'A kunne skjule eget husindlæg uden moderatorret'; END IF;
  -- Eksisterende typer: uændret synlighed
  SELECT count(*) INTO old_r_vis FROM public.feed_reactions WHERE target_type IN ('birthday','anniversary','league_round');
  SELECT count(*) INTO old_c_vis FROM public.feed_comments WHERE target_type IN ('birthday','anniversary','league_round');
  IF old_r_vis = old_r_total AND old_c_vis = old_c_total THEN passes := passes + 1;
  ELSE fails := fails || format('eksisterende typer ændret: r %s/%s c %s/%s', old_r_vis, old_r_total, old_c_vis, old_c_total); END IF;
  EXECUTE 'RESET ROLE';

  -- ===== Teamleder A modererer =====
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_lead_a, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.pulsen_posts SET hidden_at = now() WHERE id = p_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 1 THEN passes := passes + 1; ELSE fails := fails || 'Leder A kunne ikke skjule A-indlæg'; END IF;
  SELECT count(*) INTO n FROM public.pulsen_posts WHERE id = p_a AND hidden_at IS NOT NULL;
  IF n = 1 THEN passes := passes + 1; ELSE fails := fails || 'Leder A ser ikke skjult A-indlæg'; END IF;
  n := 0;
  BEGIN
    UPDATE public.pulsen_posts SET hidden_at = now() WHERE id = p_b;
    GET DIAGNOSTICS n = ROW_COUNT;
  EXCEPTION WHEN others THEN n := 0; END;
  IF n = 0 THEN passes := passes + 1; ELSE fails := fails || 'Leder A kunne skjule B-indlæg'; END IF;
  n := 0;
  BEGIN
    UPDATE public.pulsen_posts SET hidden_at = now() WHERE id = p_house;
    GET DIAGNOSTICS n = ROW_COUNT;
  EXCEPTION WHEN others THEN n := 0; END;
  IF n = 0 THEN passes := passes + 1; ELSE fails := fails || 'Leder A kunne skjule husindlæg'; END IF;
  -- Leder må ikke redigere andres tekst
  ok := false;
  BEGIN
    UPDATE public.pulsen_posts SET body = 'ændret' WHERE id = p_a;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN ok := true; END IF;
  EXCEPTION WHEN others THEN ok := true; END;
  IF ok THEN passes := passes + 1; ELSE fails := fails || 'Leder A kunne redigere andres tekst'; END IF;
  EXECUTE 'RESET ROLE';

  -- Skjult indlæg: A (forfatter) ser det stadig, B gør ikke; kommentarer på skjult følger posten
  -- ===== Ejer =====
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.pulsen_posts WHERE id IN (p_house, p_a, p_b);
  IF n = 3 THEN passes := passes + 1; ELSE fails := fails || format('Ejer ser %s af 3', n); END IF;
  INSERT INTO public.pulsen_posts (author_employee_id, audience, team_id, post_type, body)
    VALUES (e_owner, 'team', two_t1, 'post', 'TEST to1') RETURNING id INTO p_two1;
  INSERT INTO public.pulsen_posts (author_employee_id, audience, team_id, post_type, body)
    VALUES (e_owner, 'team', two_t2, 'post', 'TEST to2') RETURNING id INTO p_two2;
  UPDATE public.pulsen_posts SET hidden_at = now() WHERE id = p_house;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 1 THEN passes := passes + 1; ELSE fails := fails || 'Ejer kunne ikke skjule husindlæg'; END IF;
  UPDATE public.pulsen_posts SET hidden_at = NULL WHERE id = p_house;
  EXECUTE 'RESET ROLE';

  -- ===== Medarbejder i to teams =====
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_two, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.pulsen_posts WHERE id IN (p_two1, p_two2);
  IF n = 2 THEN passes := passes + 1; ELSE fails := fails || format('To-team-medarbejder ser %s af 2', n); END IF;
  EXECUTE 'RESET ROLE';

  -- ===== Bruger uden team =====
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_none, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.pulsen_posts WHERE id = p_house;
  IF n = 1 THEN passes := passes + 1; ELSE fails := fails || 'Uden team ser ikke Huset'; END IF;
  SELECT count(*) INTO n FROM public.pulsen_posts WHERE id IN (p_a, p_b, p_two1, p_two2);
  IF n = 0 THEN passes := passes + 1; ELSE fails := fails || format('Uden team ser %s team-indlæg', n); END IF;
  ok := false;
  BEGIN
    INSERT INTO public.pulsen_posts (author_employee_id, audience, team_id, post_type, body)
      VALUES (e_none, 'team', team_a, 'post', 'TEST forbudt');
  EXCEPTION WHEN others THEN ok := true; END;
  IF ok THEN passes := passes + 1; ELSE fails := fails || 'Uden team kunne poste i et team'; END IF;
  SELECT count(*) INTO old_r_vis FROM public.feed_reactions WHERE target_type IN ('birthday','anniversary','league_round');
  IF old_r_vis = old_r_total THEN passes := passes + 1; ELSE fails := fails || 'Uden team: eksisterende reaktioner ændret'; END IF;
  EXECUTE 'RESET ROLE';

  -- ===== Forfatter: B ser ikke A's skjulte post; A ser den =====
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_emp_a, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.pulsen_posts WHERE id = p_a;
  IF n = 1 THEN passes := passes + 1; ELSE fails := fails || 'Forfatter ser ikke eget skjulte indlæg'; END IF;
  UPDATE public.pulsen_posts SET deleted_at = now() WHERE id = p_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 1 THEN passes := passes + 1; ELSE fails := fails || 'Forfatter kunne ikke slette eget indlæg'; END IF;
  EXECUTE 'RESET ROLE';
  -- Slettet indlæg er usynligt for andre (her: ejer)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.pulsen_posts WHERE id = p_a;
  IF n = 0 THEN passes := passes + 1; ELSE fails := fails || 'Slettet indlæg synligt for andre'; END IF;
  EXECUTE 'RESET ROLE';

  RAISE EXCEPTION 'PULSEN_RLS_TEST (rullet tilbage) pass=% fail=% % | baseline r=% c=%', passes, coalesce(array_length(fails,1),0), fails, old_r_total, old_c_total;
END $$;
