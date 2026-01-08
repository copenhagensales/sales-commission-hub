-- Add column to store which dashboard is the source for celebration data
ALTER TABLE public.tv_board_access 
ADD COLUMN IF NOT EXISTS celebration_source_dashboard TEXT;