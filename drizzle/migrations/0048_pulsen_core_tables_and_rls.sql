-- Pulsen trin 3: indlæg, milepæle (tom, fyldes i trin 6), konfiguration, sidst set.
-- Kun SECURITY INVOKER-funktioner. Ingen anon-adgang. Eksisterende feed-typer uændrede.

-- 1) Tabeller
CREATE TABLE public.pulsen_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_employee_id uuid NOT NULL REFERENCES public.employee_master_data(id),
  audience text NOT NULL CHECK (audience IN ('house','team')),
  team_id uuid NULL,
  post_type text NOT NULL CHECK (post_type IN ('post','praise','question','image','event')),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 2000),
  praised_employee_id uuid NULL REFERENCES public.employee_master_data(id),
  event_id uuid NULL REFERENCES public.company_events(id) ON DELETE CASCADE,
  image_path text NULL,
  best_answer_comment_id uuid NULL REFERENCES public.feed_comments(id) ON DELETE SET NULL,
  hidden_at timestamptz NULL,
  hidden_by uuid NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pulsen_posts_audience_team CHECK ((audience = 'team') = (team_id IS NOT NULL)),
  CONSTRAINT pulsen_posts_praise_target CHECK (post_type <> 'praise' OR praised_employee_id IS NOT NULL),
  CONSTRAINT pulsen_posts_event_target CHECK (post_type <> 'event' OR event_id IS NOT NULL)
);
CREATE INDEX pulsen_posts_feed_idx ON public.pulsen_posts (audience, team_id, created_at DESC);

CREATE TABLE public.pulsen_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_type text NOT NULL CHECK (milestone_type IN
    ('first_sale','record_day','record_week','record_pay_period','club','team_day_sales','streak','house_record')),
  employee_id uuid NULL,
  team_id uuid NULL,
  period_key text NOT NULL,
  level integer NOT NULL DEFAULT 0,
  value numeric NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  rarity integer NOT NULL DEFAULT 0,
  shown_in_house boolean NOT NULL DEFAULT false,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pulsen_milestones_subject CHECK (employee_id IS NOT NULL OR team_id IS NOT NULL OR milestone_type = 'house_record')
);
CREATE UNIQUE INDEX pulsen_milestones_unique_idx ON public.pulsen_milestones
  (milestone_type, coalesce(employee_id, team_id, '00000000-0000-0000-0000-000000000000'::uuid), period_key, level);
CREATE INDEX pulsen_milestones_feed_idx ON public.pulsen_milestones (occurred_at DESC);

CREATE TABLE public.pulsen_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

CREATE TABLE public.pulsen_last_seen (
  employee_id uuid PRIMARY KEY REFERENCES public.employee_master_data(id),
  last_seen_house timestamptz NULL,
  last_seen_team jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Grants (ingen anon)
GRANT SELECT, INSERT, UPDATE ON public.pulsen_posts TO authenticated;
GRANT ALL ON public.pulsen_posts TO service_role;
GRANT SELECT ON public.pulsen_milestones TO authenticated;
GRANT ALL ON public.pulsen_milestones TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.pulsen_config TO authenticated;
GRANT ALL ON public.pulsen_config TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.pulsen_last_seen TO authenticated;
GRANT ALL ON public.pulsen_last_seen TO service_role;

ALTER TABLE public.pulsen_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulsen_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulsen_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulsen_last_seen ENABLE ROW LEVEL SECURITY;

-- 3) Hjælpefunktioner (SECURITY INVOKER, fast search_path)
CREATE FUNCTION public.pulsen_member_team_ids() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce(array_agg(DISTINCT tm.team_id), '{}'::uuid[])
  FROM public.team_members tm WHERE tm.employee_id = public.effective_employee_id()
$$;

CREATE FUNCTION public.pulsen_led_team_ids() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce(array_agg(DISTINCT x.team_id), '{}'::uuid[]) FROM (
    SELECT t.id AS team_id FROM public.teams t WHERE t.team_leader_id = public.effective_employee_id()
    UNION
    SELECT tal.team_id FROM public.team_assistant_leaders tal WHERE tal.employee_id = public.effective_employee_id()
  ) x
$$;

CREATE FUNCTION public.pulsen_visible_team_ids() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT CASE WHEN public.effective_is_owner()
    THEN (SELECT coalesce(array_agg(t.id), '{}'::uuid[]) FROM public.teams t)
    ELSE (SELECT coalesce(array_agg(DISTINCT u), '{}'::uuid[])
          FROM unnest(public.pulsen_member_team_ids() || public.pulsen_led_team_ids()) u)
  END
$$;

CREATE FUNCTION public.pulsen_can_moderate(_audience text, _team_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT public.effective_is_owner()
    OR (_audience = 'team'
        AND public.has_edit_permission(public.effective_auth_user_id(), 'action_pulsen_moderate')
        AND _team_id = ANY (public.pulsen_led_team_ids()))
$$;

CREATE FUNCTION public.pulsen_event_visible(_event_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.company_events e WHERE e.id = _event_id)
    AND (
      NOT EXISTS (SELECT 1 FROM public.event_team_invitations i WHERE i.event_id = _event_id)
      OR public.effective_is_owner()
      OR EXISTS (SELECT 1 FROM public.company_events e
                 WHERE e.id = _event_id AND e.created_by = public.effective_auth_user_id())
      OR EXISTS (SELECT 1 FROM public.event_team_invitations i
                 WHERE i.event_id = _event_id AND i.team_id = ANY (public.pulsen_visible_team_ids()))
    )
$$;

-- Målnøgler: '<type>:<uuid>'. RLS på pulsen-tabellerne gælder, da funktionen er invoker.
CREATE FUNCTION public.pulsen_target_visible(_target_type text, _target_key text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_raw text := split_part(_target_key, ':', 2);
  v_id uuid;
BEGIN
  IF split_part(_target_key, ':', 1) <> _target_type
     OR v_raw !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR split_part(_target_key, ':', 3) <> '' THEN
    RETURN false;
  END IF;
  v_id := v_raw::uuid;
  IF _target_type = 'pulsen_post' THEN
    RETURN EXISTS (SELECT 1 FROM public.pulsen_posts p WHERE p.id = v_id);
  ELSIF _target_type = 'milestone' THEN
    RETURN EXISTS (SELECT 1 FROM public.pulsen_milestones m WHERE m.id = v_id);
  ELSIF _target_type = 'event' THEN
    RETURN public.pulsen_event_visible(v_id);
  END IF;
  RETURN false;
END $$;

-- 4) Politikker
CREATE POLICY pulsen_posts_read ON public.pulsen_posts FOR SELECT TO authenticated USING (
  deleted_at IS NULL
  AND (audience = 'house' OR team_id = ANY (public.pulsen_visible_team_ids()))
  AND (hidden_at IS NULL
       OR author_employee_id = public.effective_employee_id()
       OR public.pulsen_can_moderate(audience, team_id))
);
CREATE POLICY pulsen_posts_insert ON public.pulsen_posts FOR INSERT TO authenticated WITH CHECK (
  author_employee_id = public.effective_employee_id()
  AND (
    (audience = 'house' AND public.has_edit_permission(public.effective_auth_user_id(), 'action_pulsen_post_house'))
    OR (audience = 'team' AND team_id = ANY (public.pulsen_visible_team_ids()))
  )
  AND (post_type <> 'event' OR public.has_edit_permission(public.effective_auth_user_id(), 'action_manage_company_events'))
);
CREATE POLICY pulsen_posts_update_own ON public.pulsen_posts FOR UPDATE TO authenticated
  USING (author_employee_id = public.effective_employee_id())
  WITH CHECK (author_employee_id = public.effective_employee_id());
CREATE POLICY pulsen_posts_moderate ON public.pulsen_posts FOR UPDATE TO authenticated
  USING (public.pulsen_can_moderate(audience, team_id))
  WITH CHECK (public.pulsen_can_moderate(audience, team_id));
-- Ingen DELETE-politik: sletning = deleted_at (historik bevares).

CREATE POLICY pulsen_milestones_read ON public.pulsen_milestones FOR SELECT TO authenticated USING (
  shown_in_house OR team_id = ANY (public.pulsen_visible_team_ids()) OR public.effective_is_owner()
);

CREATE POLICY pulsen_config_read ON public.pulsen_config FOR SELECT TO authenticated USING (true);
CREATE POLICY pulsen_config_owner_insert ON public.pulsen_config FOR INSERT TO authenticated
  WITH CHECK (public.effective_is_owner());
CREATE POLICY pulsen_config_owner_update ON public.pulsen_config FOR UPDATE TO authenticated
  USING (public.effective_is_owner()) WITH CHECK (public.effective_is_owner());

CREATE POLICY pulsen_last_seen_own_read ON public.pulsen_last_seen FOR SELECT TO authenticated
  USING (employee_id = public.effective_employee_id());
CREATE POLICY pulsen_last_seen_own_insert ON public.pulsen_last_seen FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.effective_employee_id());
CREATE POLICY pulsen_last_seen_own_update ON public.pulsen_last_seen FOR UPDATE TO authenticated
  USING (employee_id = public.effective_employee_id()) WITH CHECK (employee_id = public.effective_employee_id());

-- 5) Valideringstrigger på indlæg (kun for indloggede brugere; service_role springes over)
CREATE FUNCTION public.pulsen_posts_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
  v_me uuid;
  v_author_fields_changed boolean;
  v_hidden_changed boolean;
BEGIN
  IF v_role <> 'authenticated' THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  v_me := public.effective_employee_id();

  IF TG_OP = 'INSERT' THEN
    IF btrim(NEW.body) = '' AND NEW.image_path IS NULL AND NEW.post_type <> 'event' THEN
      RAISE EXCEPTION 'Indlægget er tomt' USING ERRCODE = 'P0001';
    END IF;
    NEW.created_at := now();
    NEW.updated_at := now();
    NEW.hidden_at := NULL; NEW.hidden_by := NULL; NEW.deleted_at := NULL;
    NEW.best_answer_comment_id := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.id <> OLD.id OR NEW.author_employee_id <> OLD.author_employee_id
     OR NEW.audience <> OLD.audience OR NEW.team_id IS DISTINCT FROM OLD.team_id
     OR NEW.post_type <> OLD.post_type OR NEW.created_at <> OLD.created_at
     OR NEW.event_id IS DISTINCT FROM OLD.event_id
     OR NEW.praised_employee_id IS DISTINCT FROM OLD.praised_employee_id THEN
    RAISE EXCEPTION 'Disse felter kan ikke ændres' USING ERRCODE = 'P0001';
  END IF;

  v_author_fields_changed := NEW.body IS DISTINCT FROM OLD.body
    OR NEW.image_path IS DISTINCT FROM OLD.image_path
    OR NEW.best_answer_comment_id IS DISTINCT FROM OLD.best_answer_comment_id
    OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at;
  v_hidden_changed := NEW.hidden_at IS DISTINCT FROM OLD.hidden_at
    OR NEW.hidden_by IS DISTINCT FROM OLD.hidden_by;

  IF v_author_fields_changed AND OLD.author_employee_id IS DISTINCT FROM v_me THEN
    RAISE EXCEPTION 'Kun forfatteren kan redigere indlægget' USING ERRCODE = 'P0001';
  END IF;
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    RAISE EXCEPTION 'Et slettet indlæg kan ikke gendannes' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.best_answer_comment_id IS DISTINCT FROM OLD.best_answer_comment_id
     AND NEW.best_answer_comment_id IS NOT NULL THEN
    IF OLD.post_type <> 'question' OR NOT EXISTS (
      SELECT 1 FROM public.feed_comments c
      WHERE c.id = NEW.best_answer_comment_id
        AND c.target_type = 'pulsen_post' AND c.target_key = 'pulsen_post:' || OLD.id::text) THEN
      RAISE EXCEPTION 'Bedste svar skal være en kommentar på spørgsmålet' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF v_hidden_changed THEN
    IF NOT public.pulsen_can_moderate(OLD.audience, OLD.team_id) THEN
      RAISE EXCEPTION 'Du må ikke moderere dette indlæg' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.hidden_at IS NOT NULL THEN NEW.hidden_by := v_me; ELSE NEW.hidden_by := NULL; END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER pulsen_posts_guard BEFORE INSERT OR UPDATE ON public.pulsen_posts
  FOR EACH ROW EXECUTE FUNCTION public.pulsen_posts_guard();

-- 6) Reaktioner/kommentarer: nye måltyper tilladt, kun hvis målet er synligt.
--    Eksisterende typer (birthday/anniversary/league_round) påvirkes ikke.
ALTER TABLE public.feed_reactions DROP CONSTRAINT feed_reactions_target_type_check;
ALTER TABLE public.feed_reactions ADD CONSTRAINT feed_reactions_target_type_check CHECK
  (target_type = ANY (ARRAY['birthday','anniversary','league_round','pulsen_post','milestone','event']));
ALTER TABLE public.feed_comments DROP CONSTRAINT feed_comments_target_type_check;
ALTER TABLE public.feed_comments ADD CONSTRAINT feed_comments_target_type_check CHECK
  (target_type = ANY (ARRAY['birthday','anniversary','league_round','pulsen_post','milestone','event']));

CREATE POLICY pulsen_targets_read ON public.feed_reactions AS RESTRICTIVE FOR SELECT TO authenticated
  USING (target_type IN ('birthday','anniversary','league_round') OR public.pulsen_target_visible(target_type, target_key));
CREATE POLICY pulsen_targets_insert ON public.feed_reactions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (target_type IN ('birthday','anniversary','league_round') OR public.pulsen_target_visible(target_type, target_key));
CREATE POLICY pulsen_targets_read ON public.feed_comments AS RESTRICTIVE FOR SELECT TO authenticated
  USING (target_type IN ('birthday','anniversary','league_round') OR public.pulsen_target_visible(target_type, target_key));
CREATE POLICY pulsen_targets_insert ON public.feed_comments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (target_type IN ('birthday','anniversary','league_round') OR public.pulsen_target_visible(target_type, target_key));