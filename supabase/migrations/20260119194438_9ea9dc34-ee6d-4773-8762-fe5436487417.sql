-- Add is_recurring column to team_expenses table
ALTER TABLE team_expenses 
ADD COLUMN is_recurring BOOLEAN DEFAULT false;