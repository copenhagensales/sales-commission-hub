-- Kaspers rettelse 22/10: ingen ændring af feed_reactions/feed_comments i v1.
-- Ruller 0048's regler og udvidede måltyper tilbage til den oprindelige tilstand.
DROP POLICY pulsen_targets_read ON public.feed_reactions;
DROP POLICY pulsen_targets_insert ON public.feed_reactions;
DROP POLICY pulsen_targets_read ON public.feed_comments;
DROP POLICY pulsen_targets_insert ON public.feed_comments;

ALTER TABLE public.feed_reactions DROP CONSTRAINT feed_reactions_target_type_check;
ALTER TABLE public.feed_reactions ADD CONSTRAINT feed_reactions_target_type_check CHECK
  ((target_type = ANY (ARRAY['birthday'::text, 'anniversary'::text, 'league_round'::text])));
ALTER TABLE public.feed_comments DROP CONSTRAINT feed_comments_target_type_check;
ALTER TABLE public.feed_comments ADD CONSTRAINT feed_comments_target_type_check CHECK
  ((target_type = ANY (ARRAY['birthday'::text, 'anniversary'::text, 'league_round'::text])));

-- Hjælpefunktioner der kun blev brugt af de fjernede regler / invitationsfilter (udgået).
DROP FUNCTION public.pulsen_target_visible(text, text);
DROP FUNCTION public.pulsen_event_visible(uuid);