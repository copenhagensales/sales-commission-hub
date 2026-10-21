CREATE TABLE public.compliance_approvers (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.compliance_approvers TO authenticated;
GRANT ALL ON public.compliance_approvers TO service_role;
ALTER TABLE public.compliance_approvers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmin laeser godkendere" ON public.compliance_approvers FOR SELECT TO authenticated USING (public.is_superadmin(auth.uid()));

CREATE OR REPLACE FUNCTION public.compliance_is_approver()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT public.is_superadmin(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.compliance_approvers a WHERE lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

CREATE TABLE public.compliance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  render_mode text NOT NULL DEFAULT 'markdown' CHECK (render_mode IN ('markdown','page')),
  href text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  review_interval_months int NOT NULL DEFAULT 12,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.compliance_documents TO authenticated;
GRANT ALL ON public.compliance_documents TO service_role;
ALTER TABLE public.compliance_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmin laeser dokumenter" ON public.compliance_documents FOR SELECT TO authenticated USING (public.is_superadmin(auth.uid()));
CREATE POLICY "Superadmin opretter dokumenter" ON public.compliance_documents FOR INSERT TO authenticated WITH CHECK (public.is_superadmin(auth.uid()));
CREATE POLICY "Superadmin retter dokumenter" ON public.compliance_documents FOR UPDATE TO authenticated USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));

CREATE TABLE public.compliance_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.compliance_documents(id),
  version_major int NOT NULL DEFAULT 1,
  version_minor int NOT NULL DEFAULT 0,
  content_md text,
  change_note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','superseded')),
  approved_by_email text,
  approved_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_major, version_minor)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_document_versions TO authenticated;
GRANT ALL ON public.compliance_document_versions TO service_role;
ALTER TABLE public.compliance_document_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmin laeser versioner" ON public.compliance_document_versions FOR SELECT TO authenticated USING (public.is_superadmin(auth.uid()));
CREATE POLICY "Superadmin opretter versioner" ON public.compliance_document_versions FOR INSERT TO authenticated WITH CHECK (public.is_superadmin(auth.uid()));
CREATE POLICY "Superadmin retter versioner" ON public.compliance_document_versions FOR UPDATE TO authenticated USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));
CREATE POLICY "Superadmin sletter udkast" ON public.compliance_document_versions FOR DELETE TO authenticated USING (public.is_superadmin(auth.uid()) AND status = 'pending');

CREATE OR REPLACE FUNCTION public.compliance_version_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.status := 'pending'; NEW.approved_by_email := NULL; NEW.approved_at := NULL;
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'pending' THEN RAISE EXCEPTION 'Godkendte versioner kan ikke slettes'; END IF;
    RETURN OLD;
  END IF;
  -- UPDATE
  IF OLD.status = 'superseded' THEN RAISE EXCEPTION 'Tidligere versioner kan ikke ændres'; END IF;
  IF OLD.status = 'approved' THEN
    IF NEW.status = 'superseded' AND NEW.content_md IS NOT DISTINCT FROM OLD.content_md
       AND NEW.version_major = OLD.version_major AND NEW.version_minor = OLD.version_minor
       AND NEW.approved_by_email IS NOT DISTINCT FROM OLD.approved_by_email
       AND NEW.approved_at IS NOT DISTINCT FROM OLD.approved_at THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Godkendte versioner kan ikke ændres – opret en ny version';
  END IF;
  -- OLD pending
  IF NEW.status = 'approved' THEN
    IF NOT public.compliance_is_approver() THEN RAISE EXCEPTION 'Kun den udpegede godkender kan godkende'; END IF;
    NEW.approved_by_email := lower(auth.jwt() ->> 'email');
    NEW.approved_at := now();
  ELSIF NEW.status = 'superseded' THEN
    RAISE EXCEPTION 'Ugyldig statusændring';
  ELSE
    NEW.approved_by_email := NULL; NEW.approved_at := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER compliance_version_guard BEFORE INSERT OR UPDATE OR DELETE ON public.compliance_document_versions
  FOR EACH ROW EXECUTE FUNCTION public.compliance_version_guard();

CREATE OR REPLACE FUNCTION public.compliance_version_supersede()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    UPDATE public.compliance_document_versions SET status = 'superseded'
     WHERE document_id = NEW.document_id AND id <> NEW.id AND status = 'approved';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER compliance_version_supersede AFTER UPDATE ON public.compliance_document_versions
  FOR EACH ROW EXECUTE FUNCTION public.compliance_version_supersede();

CREATE TABLE public.compliance_breach_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz,
  discovered_at timestamptz,
  description text,
  client_ids uuid[] NOT NULL DEFAULT '{}',
  data_types text,
  estimated_subjects int,
  measures text,
  risk_assessment text,
  client_notified_at timestamptz,
  closed_on date,
  root_cause text,
  permanent_measures text,
  was_breach boolean,
  was_breach_reason text,
  retain_until date NOT NULL DEFAULT (current_date + interval '5 years')::date,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.compliance_breach_log TO authenticated;
GRANT ALL ON public.compliance_breach_log TO service_role;
ALTER TABLE public.compliance_breach_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmin laeser brud" ON public.compliance_breach_log FOR SELECT TO authenticated USING (public.is_superadmin(auth.uid()));
CREATE POLICY "Superadmin opretter brud" ON public.compliance_breach_log FOR INSERT TO authenticated WITH CHECK (public.is_superadmin(auth.uid()));
CREATE POLICY "Superadmin retter brud" ON public.compliance_breach_log FOR UPDATE TO authenticated USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));
COMMENT ON TABLE public.compliance_breach_log IS 'Databrudslog. Opbevares 5 år (retain_until).';

CREATE TABLE public.compliance_impact_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  assessment_date date NOT NULL DEFAULT current_date,
  subject_type text NOT NULL CHECK (subject_type IN ('system','integration','felt','anvendelse','aendring')),
  subject_description text,
  q1_purpose text, q2_data text, q3_instruction text, q4_minimization text,
  q5_access text, q6_hosting text, q7_risk text, q8_retention text,
  conclusion text,
  requires_client_notice boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved')),
  approved_by_email text,
  approved_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.compliance_impact_assessments TO authenticated;
GRANT ALL ON public.compliance_impact_assessments TO service_role;
ALTER TABLE public.compliance_impact_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmin laeser vurderinger" ON public.compliance_impact_assessments FOR SELECT TO authenticated USING (public.is_superadmin(auth.uid()));
CREATE POLICY "Superadmin opretter vurderinger" ON public.compliance_impact_assessments FOR INSERT TO authenticated WITH CHECK (public.is_superadmin(auth.uid()));
CREATE POLICY "Superadmin retter vurderinger" ON public.compliance_impact_assessments FOR UPDATE TO authenticated USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));

CREATE OR REPLACE FUNCTION public.compliance_assessment_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending'; NEW.approved_by_email := NULL; NEW.approved_at := NULL; RETURN NEW;
  END IF;
  IF OLD.status = 'approved' THEN RAISE EXCEPTION 'Godkendte vurderinger kan ikke ændres'; END IF;
  NEW.updated_at := now();
  IF NEW.status = 'approved' THEN
    IF NOT public.compliance_is_approver() THEN RAISE EXCEPTION 'Kun den udpegede godkender kan godkende'; END IF;
    NEW.approved_by_email := lower(auth.jwt() ->> 'email'); NEW.approved_at := now();
  ELSE
    NEW.approved_by_email := NULL; NEW.approved_at := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER compliance_assessment_guard BEFORE INSERT OR UPDATE ON public.compliance_impact_assessments
  FOR EACH ROW EXECUTE FUNCTION public.compliance_assessment_guard();

CREATE OR REPLACE FUNCTION public.compliance_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER compliance_breach_touch BEFORE UPDATE ON public.compliance_breach_log
  FOR EACH ROW EXECUTE FUNCTION public.compliance_touch_updated_at();