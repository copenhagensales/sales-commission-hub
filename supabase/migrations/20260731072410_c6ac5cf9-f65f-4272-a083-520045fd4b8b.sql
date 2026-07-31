GRANT SELECT ON public.powerdag_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.powerdag_events TO authenticated;
GRANT ALL ON public.powerdag_events TO service_role;

GRANT SELECT ON public.powerdag_point_rules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.powerdag_point_rules TO authenticated;
GRANT ALL ON public.powerdag_point_rules TO service_role;

GRANT SELECT ON public.powerdag_scores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.powerdag_scores TO authenticated;
GRANT ALL ON public.powerdag_scores TO service_role;