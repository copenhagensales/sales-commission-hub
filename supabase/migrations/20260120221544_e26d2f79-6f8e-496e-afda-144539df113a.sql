-- Add formatting columns to dashboard_kpis table
ALTER TABLE dashboard_kpis 
ADD COLUMN IF NOT EXISTS decimal_places integer DEFAULT 2,
ADD COLUMN IF NOT EXISTS multiplier numeric DEFAULT 1,
ADD COLUMN IF NOT EXISTS symbol text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS symbol_position text DEFAULT 'after';