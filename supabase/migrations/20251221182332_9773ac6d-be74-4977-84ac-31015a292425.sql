-- Add is_primary column to team_standard_shifts
ALTER TABLE public.team_standard_shifts 
ADD COLUMN is_primary BOOLEAN NOT NULL DEFAULT false;