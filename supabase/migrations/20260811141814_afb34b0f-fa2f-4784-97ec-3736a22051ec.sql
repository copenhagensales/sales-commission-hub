DROP POLICY IF EXISTS "Authorized users can view cohorts" ON public.onboarding_cohorts;
CREATE POLICY "Authorized users can view cohorts"
ON public.onboarding_cohorts
FOR SELECT
TO authenticated
USING (
  is_teamleder_or_above(auth.uid())
  OR is_rekruttering(auth.uid())
  OR has_page_permission(auth.uid(), 'menu_upcoming_starts')
);

DROP POLICY IF EXISTS "Authorized users can view cohort members" ON public.cohort_members;
CREATE POLICY "Authorized users can view cohort members"
ON public.cohort_members
FOR SELECT
TO authenticated
USING (
  is_teamleder_or_above(auth.uid())
  OR is_rekruttering(auth.uid())
  OR has_page_permission(auth.uid(), 'menu_upcoming_starts')
);