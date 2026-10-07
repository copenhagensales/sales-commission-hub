CREATE TABLE public.dpa_parties (
  -- Aftalepartens id er altid id'et på den Stork-kunde, den blev oprettet ud fra.
  -- Derved hører eksisterende versioner (dpa_addenda.client_id) uændret til samme aftalepart.
  id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  legal_name text, cvr text, address text,
  original_title text, original_date date,
  approval_form text CHECK (approval_form IN ('general','specific')),
  notice_days int CHECK (notice_days IS NULL OR notice_days >= 0),
  subprocessor_ids uuid[] NOT NULL DEFAULT '{}',
  other_changes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.dpa_parties TO authenticated;
GRANT ALL ON public.dpa_parties TO service_role;
ALTER TABLE public.dpa_parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmins manage dpa_parties" ON public.dpa_parties FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));
CREATE TRIGGER dpa_parties_touch BEFORE UPDATE ON public.dpa_parties FOR EACH ROW EXECUTE FUNCTION public.dpa_touch_updated_at();

-- Migrering: hver eksisterende kunde bliver sin egen aftalepart med sine nuværende værdier.
INSERT INTO public.dpa_parties (id, is_active, legal_name, cvr, address, original_title, original_date, approval_form, notice_days, subprocessor_ids, other_changes, updated_by, created_at)
SELECT client_id, is_active, legal_name, cvr, address, original_title, original_date, approval_form, notice_days, subprocessor_ids, other_changes, updated_by, created_at
FROM public.dpa_client_profiles;

ALTER TABLE public.dpa_client_profiles
  ADD COLUMN party_id uuid REFERENCES public.dpa_parties(id) ON DELETE RESTRICT,
  ADD COLUMN display_name text;
UPDATE public.dpa_client_profiles SET party_id = client_id;
CREATE INDEX ON public.dpa_client_profiles(party_id);

COMMENT ON COLUMN public.dpa_client_profiles.legal_name IS 'Forældet: partsoplysninger ligger nu på dpa_parties. Bevaret uændret.';