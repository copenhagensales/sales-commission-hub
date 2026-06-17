ALTER TABLE public.communication_logs
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS delivery_error_code text,
  ADD COLUMN IF NOT EXISTS delivery_error_message text,
  ADD COLUMN IF NOT EXISTS delivery_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_communication_logs_twilio_sid ON public.communication_logs(twilio_sid);