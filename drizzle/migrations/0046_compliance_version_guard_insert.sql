CREATE OR REPLACE FUNCTION public.compliance_version_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending'; NEW.approved_by_email := NULL; NEW.approved_at := NULL;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'pending' THEN RAISE EXCEPTION 'Godkendte versioner kan ikke slettes'; END IF;
    RETURN OLD;
  END IF;
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