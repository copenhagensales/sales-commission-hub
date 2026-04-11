
CREATE TABLE public.booking_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_start_hour integer NOT NULL DEFAULT 9,
  work_end_hour integer NOT NULL DEFAULT 17,
  slot_duration_minutes integer NOT NULL DEFAULT 15,
  lookahead_days integer NOT NULL DEFAULT 14,
  blocked_dates text[] DEFAULT '{}',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Insert singleton row with defaults
INSERT INTO public.booking_settings (id) VALUES (gen_random_uuid());

ALTER TABLE public.booking_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read booking_settings"
  ON public.booking_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Teamleder+ can update booking_settings"
  ON public.booking_settings FOR UPDATE
  TO authenticated
  USING (public.is_teamleder_or_above(auth.uid()));

CREATE TRIGGER update_booking_settings_updated_at
  BEFORE UPDATE ON public.booking_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
