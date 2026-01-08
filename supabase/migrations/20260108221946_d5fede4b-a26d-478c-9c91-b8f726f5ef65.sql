-- Add column for per-dashboard rotation intervals (JSON object with slug -> seconds)
ALTER TABLE public.tv_board_access 
ADD COLUMN IF NOT EXISTS rotate_intervals_per_dashboard JSONB;