-- Add column to store hour registration source preference
-- 'timestamp' = use actual clock-in/out times
-- 'shift' = use planned shift times
ALTER TABLE public.team_standard_shifts 
ADD COLUMN hours_source TEXT NOT NULL DEFAULT 'shift' 
CHECK (hours_source IN ('timestamp', 'shift'));