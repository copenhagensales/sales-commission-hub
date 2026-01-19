-- Add send_time column to closing_shifts for configurable reminder time
ALTER TABLE public.closing_shifts 
ADD COLUMN IF NOT EXISTS send_time TIME DEFAULT '16:00:00';

-- Set default value for existing rows
UPDATE public.closing_shifts SET send_time = '16:00:00' WHERE send_time IS NULL;