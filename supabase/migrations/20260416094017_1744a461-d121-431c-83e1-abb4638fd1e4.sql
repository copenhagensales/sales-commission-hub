
CREATE TABLE public.booking_page_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text UNIQUE NOT NULL,
  title text NOT NULL,
  body_lines text[] NOT NULL DEFAULT '{}',
  tip_text text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.booking_page_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read booking page content"
  ON public.booking_page_content FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers and owners can update booking page content"
  ON public.booking_page_content FOR UPDATE
  TO authenticated
  USING (public.is_teamleder_or_above(auth.uid()));

INSERT INTO public.booking_page_content (page_key, title, body_lines, tip_text) VALUES
  ('booking_success', 'Din samtale er booket! 🎉', ARRAY[
    'Vi glæder os til at tale med dig.',
    'Oscar ringer dig på det valgte tidspunkt – du behøver ikke gøre andet end at tage telefonen.',
    'Har du spørgsmål inden da? Svar bare på den SMS, du modtog.'
  ], '💡 Tip: Hav gerne dit CV klar – det gør samtalen nemmere.'),
  ('unsubscribe_success', 'Tak for din interesse, {{firstName}}!', ARRAY[
    'Vi har modtaget din afmelding, og du vil ikke modtage flere beskeder fra os.',
    'Vi sætter stor pris på, at du tog dig tid til at søge hos os – det betyder meget.',
    'Du er altid velkommen til at søge igen en anden gang. Vi vil med glæde høre fra dig!'
  ], NULL);
