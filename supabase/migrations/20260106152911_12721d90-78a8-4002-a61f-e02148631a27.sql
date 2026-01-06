-- Add phone_number column to communication_logs for tracking SMS sender/recipient
ALTER TABLE public.communication_logs 
ADD COLUMN IF NOT EXISTS phone_number text;

-- Add unique constraint on twilio_sid for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_communication_logs_twilio_sid 
ON public.communication_logs (twilio_sid) 
WHERE twilio_sid IS NOT NULL;

-- Add index on phone_number for fast lookups
CREATE INDEX IF NOT EXISTS idx_communication_logs_phone_number 
ON public.communication_logs (phone_number);

-- Add index on type + direction for filtering
CREATE INDEX IF NOT EXISTS idx_communication_logs_type_direction 
ON public.communication_logs (type, direction);