-- Rename is_primary column to is_active in team_standard_shifts table
ALTER TABLE team_standard_shifts 
RENAME COLUMN is_primary TO is_active;