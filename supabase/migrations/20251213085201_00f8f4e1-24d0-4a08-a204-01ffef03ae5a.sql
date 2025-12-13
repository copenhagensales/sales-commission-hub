-- Ensure authenticated users can also read teams
DROP POLICY IF EXISTS "Authenticated can read teams" ON public.teams;
CREATE POLICY "Authenticated can read teams"
ON public.teams
FOR SELECT
TO authenticated
USING (true);

-- Ensure authenticated users can also read active surveys
DROP POLICY IF EXISTS "Authenticated can view active surveys" ON public.pulse_surveys;
CREATE POLICY "Authenticated can view active surveys"
ON public.pulse_surveys
FOR SELECT
TO authenticated
USING (is_active = true);