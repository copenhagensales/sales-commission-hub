CREATE TABLE public.invoiceflow_portal_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name text NOT NULL,
  slug text NOT NULL UNIQUE,
  portal_url text NOT NULL,
  status text NOT NULL DEFAULT 'ikke_understoettet' CHECK (status IN ('understoettet','ikke_understoettet','kraever_kode')),
  flow_version integer NOT NULL DEFAULT 1,
  login_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.invoiceflow_portal_catalog TO authenticated;
GRANT ALL ON public.invoiceflow_portal_catalog TO service_role;
ALTER TABLE public.invoiceflow_portal_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "IF owners read portal catalog" ON public.invoiceflow_portal_catalog
  FOR SELECT TO authenticated USING (public.invoiceflow_has_access('owner'));
INSERT INTO public.invoiceflow_portal_catalog (supplier_name, slug, portal_url, status, flow_version, login_fields)
VALUES ('Hiper', 'hiper', 'https://www.hiper.dk/mit-hiper/login', 'understoettet', 1, '["email","password"]'::jsonb);

ALTER TABLE public.invoiceflow_credentials ADD COLUMN browser_context_id text;
COMMENT ON COLUMN public.invoiceflow_credentials.browser_context_id IS 'Browserbase persistent context pr. login; kun server.';