-- Add effective time tracking columns to time_stamps table
ALTER TABLE public.time_stamps 
ADD COLUMN IF NOT EXISTS effective_clock_in TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS effective_clock_out TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS effective_hours NUMERIC,
ADD COLUMN IF NOT EXISTS break_minutes INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS edited_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster employee lookups
CREATE INDEX IF NOT EXISTS idx_time_stamps_employee_clock_in ON public.time_stamps(employee_id, clock_in);