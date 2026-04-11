ALTER TABLE public.booking_settings
ADD COLUMN IF NOT EXISTS time_windows jsonb DEFAULT '[{"start":"09:00","end":"17:00"}]'::jsonb,
ADD COLUMN IF NOT EXISTS available_weekdays integer[] DEFAULT '{1,2,3,4,5}';