-- Tilføj attrition_risk_score kolonne til pulse_survey_responses
ALTER TABLE pulse_survey_responses 
ADD COLUMN IF NOT EXISTS attrition_risk_score integer;