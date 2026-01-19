-- Add columns for dynamic expense calculations
ALTER TABLE public.team_expenses
ADD COLUMN IF NOT EXISTS calculation_formula TEXT,
ADD COLUMN IF NOT EXISTS formula_variables JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_dynamic BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS formula_description TEXT;