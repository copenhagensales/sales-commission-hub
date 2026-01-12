-- Add new_start_time column to lateness_record table
ALTER TABLE public.lateness_record 
ADD COLUMN new_start_time TIME;