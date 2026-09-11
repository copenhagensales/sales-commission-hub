CREATE TABLE IF NOT EXISTS public.compliance_alert_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS compliance_alert_recipients_email_key
  ON public.compliance_alert_recipients (lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_alert_recipients TO authenticated;
GRANT ALL ON public.compliance_alert_recipients TO service_role;

ALTER TABLE public.compliance_alert_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alle indloggede kan se compliance-modtagere"
  ON public.compliance_alert_recipients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Kun superadmin kan oprette compliance-modtagere"
  ON public.compliance_alert_recipients FOR INSERT TO authenticated
  WITH CHECK (public.am_i_superadmin());
CREATE POLICY "Kun superadmin kan rette compliance-modtagere"
  ON public.compliance_alert_recipients FOR UPDATE TO authenticated
  USING (public.am_i_superadmin()) WITH CHECK (public.am_i_superadmin());
CREATE POLICY "Kun superadmin kan slette compliance-modtagere"
  ON public.compliance_alert_recipients FOR DELETE TO authenticated
  USING (public.am_i_superadmin());

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS compliance_alert_recipients_updated_at ON public.compliance_alert_recipients;
CREATE TRIGGER compliance_alert_recipients_updated_at
  BEFORE UPDATE ON public.compliance_alert_recipients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- compliance_alerts: læs for alle indloggede, skriv kun superadmin
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_alerts TO authenticated;
GRANT ALL ON public.compliance_alerts TO service_role;
ALTER TABLE public.compliance_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alle indloggede kan se compliance-alarmer"
  ON public.compliance_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Kun superadmin kan oprette compliance-alarmer"
  ON public.compliance_alerts FOR INSERT TO authenticated
  WITH CHECK (public.am_i_superadmin());
CREATE POLICY "Kun superadmin kan rette compliance-alarmer"
  ON public.compliance_alerts FOR UPDATE TO authenticated
  USING (public.am_i_superadmin()) WITH CHECK (public.am_i_superadmin());
CREATE POLICY "Kun superadmin kan slette compliance-alarmer"
  ON public.compliance_alerts FOR DELETE TO authenticated
  USING (public.am_i_superadmin());

-- ingestion_known_fields: læs for alle indloggede, skriv kun superadmin
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingestion_known_fields TO authenticated;
GRANT ALL ON public.ingestion_known_fields TO service_role;
ALTER TABLE public.ingestion_known_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alle indloggede kan se feltregistret"
  ON public.ingestion_known_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "Kun superadmin kan oprette felter"
  ON public.ingestion_known_fields FOR INSERT TO authenticated
  WITH CHECK (public.am_i_superadmin());
CREATE POLICY "Kun superadmin kan rette felter"
  ON public.ingestion_known_fields FOR UPDATE TO authenticated
  USING (public.am_i_superadmin()) WITH CHECK (public.am_i_superadmin());
CREATE POLICY "Kun superadmin kan slette felter"
  ON public.ingestion_known_fields FOR DELETE TO authenticated
  USING (public.am_i_superadmin());

-- compliance_check_runs: læs for alle indloggede, skriv kun superadmin
GRANT SELECT ON public.compliance_check_runs TO authenticated;
GRANT ALL ON public.compliance_check_runs TO service_role;
ALTER TABLE public.compliance_check_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alle indloggede kan se compliance-koersler"
  ON public.compliance_check_runs FOR SELECT TO authenticated USING (true);

INSERT INTO public.compliance_alert_recipients (email, is_active)
SELECT 'km@copenhagensales.dk', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.compliance_alert_recipients WHERE lower(email) = 'km@copenhagensales.dk'
);