-- Make all score columns nullable to allow partial survey submissions
ALTER TABLE pulse_survey_responses ALTER COLUMN development_score DROP NOT NULL;
ALTER TABLE pulse_survey_responses ALTER COLUMN leadership_score DROP NOT NULL;
ALTER TABLE pulse_survey_responses ALTER COLUMN recognition_score DROP NOT NULL;
ALTER TABLE pulse_survey_responses ALTER COLUMN energy_score DROP NOT NULL;
ALTER TABLE pulse_survey_responses ALTER COLUMN seriousness_score DROP NOT NULL;
ALTER TABLE pulse_survey_responses ALTER COLUMN leader_availability_score DROP NOT NULL;
ALTER TABLE pulse_survey_responses ALTER COLUMN wellbeing_score DROP NOT NULL;
ALTER TABLE pulse_survey_responses ALTER COLUMN psychological_safety_score DROP NOT NULL;