-- Fix NPS score constraint to allow 0-10 instead of 1-10
ALTER TABLE public.pulse_survey_responses
DROP CONSTRAINT pulse_survey_responses_nps_score_check;

ALTER TABLE public.pulse_survey_responses
ADD CONSTRAINT pulse_survey_responses_nps_score_check
CHECK ((nps_score >= 0) AND (nps_score <= 10));