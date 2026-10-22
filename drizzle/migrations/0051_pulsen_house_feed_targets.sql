-- Kaspers beslutning B (22/10-2026): snæver, additiv regel kun for nye Huset-måltyper.
-- birthday/anniversary/league_round passerer uændret igennem (restrictive OR på type).
CREATE FUNCTION public.pulsen_house_target_ok(_target_type text, _target_key text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_raw text := split_part(_target_key, ':', 2);
  v_id uuid;
BEGIN
  IF split_part(_target_key, ':', 1) <> _target_type
     OR split_part(_target_key, ':', 3) <> ''
     OR v_raw !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  v_id := v_raw::uuid;
  IF _target_type = 'pulsen_post' THEN
    -- RLS på pulsen_posts gælder (invoker): brugeren skal kunne se indlægget.
    RETURN EXISTS (SELECT 1 FROM public.pulsen_posts p
                   WHERE p.id = v_id AND p.audience = 'house'
                     AND p.deleted_at IS NULL AND p.hidden_at IS NULL);
  ELSIF _target_type = 'milestone' THEN
    RETURN EXISTS (SELECT 1 FROM public.pulsen_milestones m WHERE m.id = v_id AND m.shown_in_house);
  END IF;
  RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.pulsen_house_target_ok(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pulsen_house_target_ok(text, text) TO authenticated, service_role;

ALTER TABLE public.feed_reactions DROP CONSTRAINT feed_reactions_target_type_check;
ALTER TABLE public.feed_reactions ADD CONSTRAINT feed_reactions_target_type_check CHECK
  ((target_type = ANY (ARRAY['birthday'::text, 'anniversary'::text, 'league_round'::text, 'pulsen_post'::text, 'milestone'::text])));
ALTER TABLE public.feed_comments DROP CONSTRAINT feed_comments_target_type_check;
ALTER TABLE public.feed_comments ADD CONSTRAINT feed_comments_target_type_check CHECK
  ((target_type = ANY (ARRAY['birthday'::text, 'anniversary'::text, 'league_round'::text, 'pulsen_post'::text, 'milestone'::text])));

CREATE POLICY pulsen_house_targets_read ON public.feed_reactions AS RESTRICTIVE FOR SELECT TO authenticated
  USING (target_type IN ('birthday','anniversary','league_round') OR public.pulsen_house_target_ok(target_type, target_key));
CREATE POLICY pulsen_house_targets_insert ON public.feed_reactions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (target_type IN ('birthday','anniversary','league_round') OR public.pulsen_house_target_ok(target_type, target_key));
CREATE POLICY pulsen_house_targets_read ON public.feed_comments AS RESTRICTIVE FOR SELECT TO authenticated
  USING (target_type IN ('birthday','anniversary','league_round') OR public.pulsen_house_target_ok(target_type, target_key));
CREATE POLICY pulsen_house_targets_insert ON public.feed_comments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (target_type IN ('birthday','anniversary','league_round') OR public.pulsen_house_target_ok(target_type, target_key));