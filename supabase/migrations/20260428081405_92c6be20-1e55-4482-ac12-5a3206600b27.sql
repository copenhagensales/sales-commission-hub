-- Create enum for booking type
DO $$ BEGIN
  CREATE TYPE public.candidate_booking_type AS ENUM ('phone_screening', 'job_interview');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add booking_type column to candidates
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS booking_type public.candidate_booking_type;

-- Backfill: all existing scheduled candidates default to phone_screening
UPDATE public.candidates
SET booking_type = 'phone_screening'
WHERE status = 'interview_scheduled'
  AND interview_date IS NOT NULL
  AND booking_type IS NULL;

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_candidates_booking_type
  ON public.candidates(booking_type)
  WHERE booking_type IS NOT NULL;