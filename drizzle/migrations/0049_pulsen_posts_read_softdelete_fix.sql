-- Forfatterens bløde sletning skal kunne gennemføres (Postgres kræver, at den opdaterede række
-- stadig kan læses af forfatteren). Slettede indlæg er fortsat usynlige for alle andre;
-- appen filtrerer deleted_at IS NULL i feedet.
DROP POLICY pulsen_posts_read ON public.pulsen_posts;
CREATE POLICY pulsen_posts_read ON public.pulsen_posts FOR SELECT TO authenticated USING (
  (deleted_at IS NULL OR author_employee_id = public.effective_employee_id())
  AND (audience = 'house' OR team_id = ANY (public.pulsen_visible_team_ids()))
  AND (hidden_at IS NULL
       OR author_employee_id = public.effective_employee_id()
       OR public.pulsen_can_moderate(audience, team_id))
);