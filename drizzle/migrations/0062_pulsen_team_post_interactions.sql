-- Kaspers beslutning (22/10-2026): team-indlæg får reaktioner/kommentarer. Synlighed følger RLS på pulsen_posts (invoker),
-- så kun brugere, der kan se team-indlægget, kan læse/skrive. Team-milepæle forbliver uden reaktioner. Gamle typer uændrede.
CREATE OR REPLACE FUNCTION public.pulsen_house_target_ok(_target_type text, _target_key text) RETURNS boolean
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
    RETURN EXISTS (SELECT 1 FROM public.pulsen_posts p
                   WHERE p.id = v_id AND p.deleted_at IS NULL AND p.hidden_at IS NULL);
  ELSIF _target_type = 'milestone' THEN
    RETURN EXISTS (SELECT 1 FROM public.pulsen_milestones m WHERE m.id = v_id AND m.shown_in_house);
  END IF;
  RETURN false;
END $$;