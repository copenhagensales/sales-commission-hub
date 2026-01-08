-- Add celebration_metric column to tv_board_access
ALTER TABLE public.tv_board_access 
ADD COLUMN celebration_metric text DEFAULT 'sales_today';