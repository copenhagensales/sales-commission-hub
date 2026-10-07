CREATE TABLE public.dpa_subprocessors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  registration text, processing text, location text, transfer_basis text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dpa_client_profiles (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  legal_name text, cvr text, address text,
  original_title text, original_date date,
  approval_form text CHECK (approval_form IN ('general','specific')),
  notice_days int CHECK (notice_days IS NULL OR notice_days >= 0),
  subprocessor_ids uuid[] NOT NULL DEFAULT '{}',
  other_changes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dpa_campaign_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_campaign_id uuid NOT NULL REFERENCES public.client_campaigns(id) ON DELETE CASCADE,
  business_label text NOT NULL CHECK (length(trim(business_label)) > 0),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_campaign_id, business_label)
);
CREATE TABLE public.dpa_addenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  version int NOT NULL CHECK (version > 0),
  content jsonb NOT NULL,
  pdf_path text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','approved','rejected')),
  sent_at date, approved_at date, approved_contact text, rejected_at date,
  signed_pdf_path text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, version)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dpa_subprocessors, public.dpa_client_profiles, public.dpa_campaign_fields TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.dpa_addenda TO authenticated;
GRANT ALL ON public.dpa_subprocessors, public.dpa_client_profiles, public.dpa_campaign_fields, public.dpa_addenda TO service_role;

ALTER TABLE public.dpa_subprocessors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dpa_client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dpa_campaign_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dpa_addenda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins manage dpa_subprocessors" ON public.dpa_subprocessors FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));
CREATE POLICY "Superadmins manage dpa_client_profiles" ON public.dpa_client_profiles FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));
CREATE POLICY "Superadmins manage dpa_campaign_fields" ON public.dpa_campaign_fields FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));
CREATE POLICY "Superadmins read dpa_addenda" ON public.dpa_addenda FOR SELECT TO authenticated USING (public.is_superadmin(auth.uid()));
CREATE POLICY "Superadmins create dpa_addenda" ON public.dpa_addenda FOR INSERT TO authenticated WITH CHECK (public.is_superadmin(auth.uid()));
CREATE POLICY "Superadmins update dpa_addenda status" ON public.dpa_addenda FOR UPDATE TO authenticated
  USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));

CREATE OR REPLACE FUNCTION public.dpa_addenda_lock() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Versioner af tillæg kan ikke slettes'; END IF;
  IF NEW.client_id <> OLD.client_id OR NEW.version <> OLD.version OR NEW.content <> OLD.content
     OR NEW.pdf_path <> OLD.pdf_path OR NEW.created_at <> OLD.created_at
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Et låst tillæg kan ikke ændres — generér en ny version';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER dpa_addenda_lock BEFORE UPDATE OR DELETE ON public.dpa_addenda FOR EACH ROW EXECUTE FUNCTION public.dpa_addenda_lock();

CREATE OR REPLACE FUNCTION public.dpa_touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER dpa_subprocessors_touch BEFORE UPDATE ON public.dpa_subprocessors FOR EACH ROW EXECUTE FUNCTION public.dpa_touch_updated_at();
CREATE TRIGGER dpa_client_profiles_touch BEFORE UPDATE ON public.dpa_client_profiles FOR EACH ROW EXECUTE FUNCTION public.dpa_touch_updated_at();

INSERT INTO public.dpa_subprocessors (name, sort_order) VALUES
 ('Supabase',1),('Microsoft',2),('Adversus',3),('Enreach',4),('Lovable',5);

CREATE POLICY "Superadmins read dpa-addenda files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dpa-addenda' AND public.is_superadmin(auth.uid()));
CREATE POLICY "Superadmins upload dpa-addenda files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dpa-addenda' AND public.is_superadmin(auth.uid()));