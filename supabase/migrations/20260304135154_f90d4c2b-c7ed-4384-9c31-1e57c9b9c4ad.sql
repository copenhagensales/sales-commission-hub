
ALTER TABLE public.team_monthly_goals
  ADD COLUMN bonus_tier1_amount integer NOT NULL DEFAULT 500,
  ADD COLUMN bonus_tier1_description text DEFAULT 'Spisning på Retour Steak',
  ADD COLUMN bonus_tier2_amount integer NOT NULL DEFAULT 750,
  ADD COLUMN bonus_tier2_description text,
  ADD COLUMN bonus_tier3_amount integer NOT NULL DEFAULT 1000,
  ADD COLUMN bonus_tier3_description text DEFAULT 'Valgfrit';
