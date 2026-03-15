ALTER TABLE public.pulse_survey_responses
  ADD COLUMN IF NOT EXISTS product_competitiveness_score integer,
  ADD COLUMN IF NOT EXISTS market_fit_score integer,
  ADD COLUMN IF NOT EXISTS interest_creation_score integer,
  ADD COLUMN IF NOT EXISTS campaign_attractiveness_score integer,
  ADD COLUMN IF NOT EXISTS campaign_improvement_suggestions text;