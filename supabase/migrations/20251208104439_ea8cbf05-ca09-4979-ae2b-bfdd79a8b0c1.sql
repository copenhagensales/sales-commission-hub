-- Add SELECT policy for weekly_goals table to allow authenticated users to view
CREATE POLICY "Authenticated can view weekly_goals"
ON public.weekly_goals
FOR SELECT
TO authenticated
USING (true);