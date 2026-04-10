
-- Email config singleton
CREATE TABLE public.fm_checklist_email_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_time text NOT NULL DEFAULT '20:00',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.fm_checklist_email_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read email config"
  ON public.fm_checklist_email_config FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can update email config"
  ON public.fm_checklist_email_config FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- Insert default row
INSERT INTO public.fm_checklist_email_config (send_time, is_active) VALUES ('20:00', true);

-- Email recipients
CREATE TABLE public.fm_checklist_email_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (employee_id)
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
