
CREATE TABLE public.booking_notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text,
  notify_on_booking boolean DEFAULT true,
  notify_on_cancel boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.booking_notification_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view recipients"
ON public.booking_notification_recipients FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert recipients"
ON public.booking_notification_recipients FOR INSERT
TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update recipients"
ON public.booking_notification_recipients FOR UPDATE
TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete recipients"
ON public.booking_notification_recipients FOR DELETE
TO authenticated USING (true);

INSERT INTO public.booking_notification_recipients (email, name, notify_on_booking, notify_on_cancel)
VALUES ('oscar@copenhagensales.dk', 'Oscar', true, true);
