-- Add winback_contact_date column to candidates table
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS winback_contact_date DATE;