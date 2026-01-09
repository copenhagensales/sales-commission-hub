-- Add start_fullscreen column to tv_board_access table
ALTER TABLE public.tv_board_access 
ADD COLUMN start_fullscreen boolean NOT NULL DEFAULT true;