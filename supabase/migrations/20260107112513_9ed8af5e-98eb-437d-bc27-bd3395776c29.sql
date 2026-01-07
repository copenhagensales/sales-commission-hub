-- Add team_id column to candidates table
ALTER TABLE candidates 
ADD COLUMN team_id uuid REFERENCES teams(id) ON DELETE SET NULL;