-- Add columns to track contract reminders
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;

-- Reset the existing pending contract so the user gets a fresh start with max 3 reminders
UPDATE public.contracts 
SET reminder_count = 0, last_reminder_at = NULL 
WHERE status = 'pending_employee';