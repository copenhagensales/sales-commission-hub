-- Add connected_at column to track when calls are actually answered
ALTER TABLE public.call_records
ADD COLUMN IF NOT EXISTS connected_at TIMESTAMP WITH TIME ZONE;