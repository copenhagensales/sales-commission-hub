
CREATE TABLE public.booking_page_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  greeting_template text NOT NULL DEFAULT 'Hej {{firstName}} 👋',
  description text NOT NULL DEFAULT 'Book en kort snak med **{{recruiterName}}**, vores rekrutteringsansvarlige. På 5–10 minutter tager I en uforpligtende snak om jobbet – og {{recruiterName}} svarer gerne på spørgsmål om løn, arbejdstider og hverdagen i salg.',
  recruiter_name text NOT NULL DEFAULT 'Oscar',
  role_label text NOT NULL DEFAULT 'Sælger',
  unsubscribe_text text NOT NULL DEFAULT 'Ikke interesseret længere? Klik her – det er helt okay',
  step1_label text NOT NULL DEFAULT 'Vælg tid',
  step2_label text NOT NULL DEFAULT '{{recruiterName}} ringer dig',
  step3_label text NOT NULL DEFAULT 'Start dit nye job',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.booking_page_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read booking page config"
  ON public.booking_page_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update booking page config"
  ON public.booking_page_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.booking_page_config (id) VALUES (gen_random_uuid());
