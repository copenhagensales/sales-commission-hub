
-- Drop old table and recreate with email field
DROP TABLE IF EXISTS public.fm_checklist_email_recipients;

CREATE TABLE public.fm_checklist_email_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (email)
);

ALTER TABLE public.fm_checklist_email_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read email recipients"
  ON public.fm_checklist_email_recipients FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert email recipients"
  ON public.fm_checklist_email_recipients FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete email recipients"
  ON public.fm_checklist_email_recipients FOR DELETE
  TO authenticated USING (true);
