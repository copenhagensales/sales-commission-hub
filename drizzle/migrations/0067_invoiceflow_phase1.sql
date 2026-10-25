
-- InvoiceFlow fase 1. Kun nye invoiceflow_* objekter.
CREATE TABLE public.invoiceflow_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scope text NOT NULL CHECK (scope IN ('owner','own_automations','bookkeeping')),
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope)
);
GRANT SELECT ON public.invoiceflow_access TO authenticated;
GRANT ALL ON public.invoiceflow_access TO service_role;
ALTER TABLE public.invoiceflow_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own access rows" ON public.invoiceflow_access FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.invoiceflow_has_access(_scope text DEFAULT 'owner')
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.invoiceflow_access a WHERE a.user_id = auth.uid() AND a.scope = _scope)
$$;
CREATE OR REPLACE FUNCTION public.am_i_invoiceflow_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT public.invoiceflow_has_access('owner')
$$;

CREATE TABLE public.invoiceflow_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cvr text,
  cadence text NOT NULL DEFAULT 'monthly' CHECK (cadence IN ('monthly','quarterly','irregular')),
  expected_day smallint CHECK (expected_day BETWEEN 1 AND 31),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.invoiceflow_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.invoiceflow_suppliers(id) ON DELETE RESTRICT,
  type text NOT NULL CHECK (type IN ('email','api','portal')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_employee_id uuid,
  requires_approval boolean NOT NULL DEFAULT true,
  is_paused boolean NOT NULL DEFAULT false,
  pause_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.invoiceflow_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL UNIQUE REFERENCES public.invoiceflow_sources(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  ciphertext text NOT NULL,
  iv text NOT NULL,
  field_names text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.invoiceflow_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.invoiceflow_sources(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'fetch' CHECK (kind IN ('fetch','catchup','keepalive','manual')),
  period text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'ventende' CHECK (status IN ('ventende','koerer','ok','fejlet','pauset','afventer_kode')),
  attempt smallint NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoiceflow_jobs_status_idx ON public.invoiceflow_jobs (status, next_attempt_at);

CREATE TABLE public.invoiceflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.invoiceflow_jobs(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  result text,
  error_code text,
  error_message text,
  screenshot_path text,
  invoices_found integer NOT NULL DEFAULT 0
);

CREATE TABLE public.invoiceflow_credential_use_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL,
  run_id uuid,
  used_at timestamptz NOT NULL DEFAULT now(),
  result text NOT NULL
);

CREATE TABLE public.invoiceflow_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.invoiceflow_suppliers(id) ON DELETE RESTRICT,
  source_id uuid REFERENCES public.invoiceflow_sources(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.invoiceflow_runs(id) ON DELETE SET NULL,
  invoice_number text,
  invoice_date date,
  amount_incl_vat numeric(14,2),
  amount_excl_vat numeric(14,2),
  currency text NOT NULL DEFAULT 'DKK',
  period text,
  pdf_path text NOT NULL,
  pdf_hash text NOT NULL UNIQUE,
  fetched_by text,
  status text NOT NULL DEFAULT 'afventer_godkendelse' CHECK (status IN ('afventer_godkendelse','klar','sendt','ikke_leveret')),
  retention_until date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX invoiceflow_invoices_supplier_no_uq ON public.invoiceflow_invoices (supplier_id, invoice_number) WHERE invoice_number IS NOT NULL;

CREATE TABLE public.invoiceflow_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoiceflow_invoices(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  sent_at timestamptz,
  status text NOT NULL CHECK (status IN ('sendt','fejlet')),
  attempt smallint NOT NULL DEFAULT 1,
  provider_message_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.invoiceflow_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  bookkeeping_email text,
  sender_email text,
  run_day smallint NOT NULL DEFAULT 2 CHECK (run_day BETWEEN 1 AND 28),
  catchup_day smallint NOT NULL DEFAULT 10 CHECK (catchup_day BETWEEN 1 AND 28),
  expectation_day smallint NOT NULL DEFAULT 15 CHECK (expectation_day BETWEEN 1 AND 28),
  retention_years smallint NOT NULL DEFAULT 5,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.invoiceflow_settings (id) VALUES (true);

CREATE TABLE public.invoiceflow_portal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name text NOT NULL,
  portal_url text,
  note text,
  requested_by uuid,
  status text NOT NULL DEFAULT 'ny' CHECK (status IN ('ny','planlagt','afvist','bygget')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.invoiceflow_suppliers, public.invoiceflow_sources, public.invoiceflow_settings, public.invoiceflow_portal_requests TO authenticated;
GRANT SELECT, UPDATE ON public.invoiceflow_jobs TO authenticated;
GRANT SELECT ON public.invoiceflow_runs, public.invoiceflow_invoices, public.invoiceflow_deliveries, public.invoiceflow_credential_use_log TO authenticated;
-- Credentials: kun metadata-kolonner kan læses; ciphertext/iv aldrig.
GRANT SELECT (id, source_id, owner_user_id, field_names, created_at, last_used_at, updated_at) ON public.invoiceflow_credentials TO authenticated;
GRANT ALL ON public.invoiceflow_suppliers, public.invoiceflow_sources, public.invoiceflow_credentials, public.invoiceflow_jobs, public.invoiceflow_runs, public.invoiceflow_credential_use_log, public.invoiceflow_invoices, public.invoiceflow_deliveries, public.invoiceflow_settings, public.invoiceflow_portal_requests TO service_role;

ALTER TABLE public.invoiceflow_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoiceflow_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoiceflow_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoiceflow_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoiceflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoiceflow_credential_use_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoiceflow_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoiceflow_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoiceflow_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoiceflow_portal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "IF owners read suppliers" ON public.invoiceflow_suppliers FOR SELECT TO authenticated USING (public.invoiceflow_has_access('owner'));
CREATE POLICY "IF owners insert suppliers" ON public.invoiceflow_suppliers FOR INSERT TO authenticated WITH CHECK (public.invoiceflow_has_access('owner'));
CREATE POLICY "IF owners update suppliers" ON public.invoiceflow_suppliers FOR UPDATE TO authenticated USING (public.invoiceflow_has_access('owner')) WITH CHECK (public.invoiceflow_has_access('owner'));

CREATE POLICY "IF owners read sources" ON public.invoiceflow_sources FOR SELECT TO authenticated USING (public.invoiceflow_has_access('owner'));
CREATE POLICY "IF owners insert sources" ON public.invoiceflow_sources FOR INSERT TO authenticated WITH CHECK (public.invoiceflow_has_access('owner'));
CREATE POLICY "IF owners update sources" ON public.invoiceflow_sources FOR UPDATE TO authenticated USING (public.invoiceflow_has_access('owner')) WITH CHECK (public.invoiceflow_has_access('owner'));

CREATE POLICY "IF owners read credential metadata" ON public.invoiceflow_credentials FOR SELECT TO authenticated USING (public.invoiceflow_has_access('owner'));

CREATE POLICY "IF owners read jobs" ON public.invoiceflow_jobs FOR SELECT TO authenticated USING (public.invoiceflow_has_access('owner'));
CREATE POLICY "IF owners update jobs" ON public.invoiceflow_jobs FOR UPDATE TO authenticated USING (public.invoiceflow_has_access('owner')) WITH CHECK (public.invoiceflow_has_access('owner'));
CREATE POLICY "IF owners read runs" ON public.invoiceflow_runs FOR SELECT TO authenticated USING (public.invoiceflow_has_access('owner'));
CREATE POLICY "IF owners read cred log" ON public.invoiceflow_credential_use_log FOR SELECT TO authenticated USING (public.invoiceflow_has_access('owner'));
CREATE POLICY "IF owners read invoices" ON public.invoiceflow_invoices FOR SELECT TO authenticated USING (public.invoiceflow_has_access('owner'));
CREATE POLICY "IF owners read deliveries" ON public.invoiceflow_deliveries FOR SELECT TO authenticated USING (public.invoiceflow_has_access('owner'));

CREATE POLICY "IF owners read settings" ON public.invoiceflow_settings FOR SELECT TO authenticated USING (public.invoiceflow_has_access('owner'));
CREATE POLICY "IF owners update settings" ON public.invoiceflow_settings FOR UPDATE TO authenticated USING (public.invoiceflow_has_access('owner')) WITH CHECK (public.invoiceflow_has_access('owner'));

CREATE POLICY "IF owners read portal requests" ON public.invoiceflow_portal_requests FOR SELECT TO authenticated USING (public.invoiceflow_has_access('owner'));
CREATE POLICY "IF owners add portal requests" ON public.invoiceflow_portal_requests FOR INSERT TO authenticated WITH CHECK (public.invoiceflow_has_access('owner') AND requested_by = auth.uid());
CREATE POLICY "IF owners update portal requests" ON public.invoiceflow_portal_requests FOR UPDATE TO authenticated USING (public.invoiceflow_has_access('owner')) WITH CHECK (public.invoiceflow_has_access('owner'));

-- Nye sources starter altid med godkendelse
CREATE OR REPLACE FUNCTION public.invoiceflow_source_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  NEW.requires_approval := true;
  RETURN NEW;
END $$;
CREATE TRIGGER invoiceflow_source_defaults BEFORE INSERT ON public.invoiceflow_sources
FOR EACH ROW EXECUTE FUNCTION public.invoiceflow_source_defaults();
