ALTER TABLE public.ramp_settings ADD COLUMN IF NOT EXISTS cc_recipient_emails text[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN public.ramp_settings.cc_recipient_emails IS 'Faste kopimodtagere på alle Opstart-mails (feedback, ekstra støtte-alarm, ugentlig påmindelse).';
UPDATE public.ramp_settings SET cc_recipient_emails = ARRAY['kk@cph-relatel.dk'];