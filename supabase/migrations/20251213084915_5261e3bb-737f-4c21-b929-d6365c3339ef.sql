-- Drop existing overly broad insert policies
DROP POLICY IF EXISTS "Allow anonymous survey submissions" ON public.pulse_survey_responses;
DROP POLICY IF EXISTS "Anyone can insert responses" ON public.pulse_survey_responses;

-- Create policy specifically for anon role to insert
CREATE POLICY "Anon can submit survey responses"
ON public.pulse_survey_responses
FOR INSERT
TO anon
WITH CHECK (true);

-- Also allow authenticated users to insert (in case they happen to be logged in)
CREATE POLICY "Authenticated can submit survey responses"
ON public.pulse_survey_responses
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Make sure anon can read teams for the dropdown
DROP POLICY IF EXISTS "Anyone can view teams" ON public.teams;
CREATE POLICY "Anon can read teams"
ON public.teams
FOR SELECT
TO anon
USING (true);

-- Also allow anon to read active pulse surveys
DROP POLICY IF EXISTS "Anon can view active surveys" ON public.pulse_surveys;
CREATE POLICY "Anon can view active surveys"
ON public.pulse_surveys
FOR SELECT
TO anon
USING (is_active = true);