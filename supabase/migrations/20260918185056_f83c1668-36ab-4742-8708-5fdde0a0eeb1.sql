ALTER TABLE public.lead_closing_statuses
  ADD COLUMN IF NOT EXISTS maps_to_status text;

COMMENT ON COLUMN public.lead_closing_statuses.maps_to_status IS
  'Valgfri: udfaldet tælles som denne kanoniske status i rapporten (fx Enreach Success -> success).';

INSERT INTO public.lead_closing_statuses (status, is_closing, label_da, maps_to_status)
VALUES
  ('Success', true, 'Booket møde', 'success'),
  ('NotInterested', true, 'Ikke interesseret', 'notInterested'),
  ('Unqualified', true, 'Ukvalificeret', 'unqualified'),
  ('InvalidLead', true, 'Ugyldig', 'invalid')
ON CONFLICT (status) DO UPDATE
  SET is_closing = EXCLUDED.is_closing,
      label_da = EXCLUDED.label_da,
      maps_to_status = EXCLUDED.maps_to_status;