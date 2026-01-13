-- Add is_spectator flag to league_enrollments
-- Spectators can see standings but don't appear in them
ALTER TABLE league_enrollments 
ADD COLUMN is_spectator BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN league_enrollments.is_spectator IS 'If true, the user can view standings but will not appear in rankings';