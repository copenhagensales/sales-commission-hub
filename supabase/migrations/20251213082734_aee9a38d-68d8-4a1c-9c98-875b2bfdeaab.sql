-- Allow anonymous pulse survey submissions
-- Add team_id column to pulse_survey_responses for anonymous submissions
ALTER TABLE public.pulse_survey_responses 
ADD COLUMN IF NOT EXISTS submitted_team_id UUID REFERENCES public.teams(id);

-- Create RLS policy for anonymous inserts to pulse_survey_responses
DROP POLICY IF EXISTS "Allow anonymous survey submissions" ON public.pulse_survey_responses;
CREATE POLICY "Allow anonymous survey submissions" 
ON public.pulse_survey_responses 
FOR INSERT 
WITH CHECK (true);

-- Allow anonymous reads of active surveys
DROP POLICY IF EXISTS "Allow anonymous read of active surveys" ON public.pulse_surveys;
CREATE POLICY "Allow anonymous read of active surveys"
ON public.pulse_surveys
FOR SELECT
USING (is_active = true);

-- Allow anonymous to read teams for selection
DROP POLICY IF EXISTS "Allow anonymous read teams" ON public.teams;
CREATE POLICY "Allow anonymous read teams"
ON public.teams
FOR SELECT
USING (true);