-- Add team_id column to pulse_survey_responses
ALTER TABLE public.pulse_survey_responses 
ADD COLUMN team_id uuid REFERENCES public.teams(id);

-- Create index for team filtering
CREATE INDEX idx_pulse_survey_responses_team_id ON public.pulse_survey_responses(team_id);