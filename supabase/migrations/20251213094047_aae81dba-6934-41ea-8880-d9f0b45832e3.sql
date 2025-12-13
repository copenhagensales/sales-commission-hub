-- Update tenure check constraint to allow more formats
ALTER TABLE pulse_survey_responses DROP CONSTRAINT pulse_survey_responses_tenure_check;

ALTER TABLE pulse_survey_responses ADD CONSTRAINT pulse_survey_responses_tenure_check 
CHECK (tenure = ANY (ARRAY['under_1_month', '1_3_months', '3_6_months', 'over_6_months', 'under_1_year', '1_2_years', '2_5_years', 'over_5_years', 'Under 1 måned', '1–3 måneder', '3–6 måneder', 'Over 6 måneder', '1-2 år']::text[]));