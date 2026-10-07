CREATE TABLE public.dpa_client_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  business_label text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dpa_client_fields TO authenticated;
GRANT ALL ON public.dpa_client_fields TO service_role;
ALTER TABLE public.dpa_client_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmins manage dpa_client_fields" ON public.dpa_client_fields FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));
CREATE INDEX ON public.dpa_client_fields(client_id);

ALTER TABLE public.dpa_client_profiles ADD COLUMN data_source text, ADD COLUMN retention_text text;

CREATE TABLE public.dpa_campaign_deviations (
  client_campaign_id uuid PRIMARY KEY REFERENCES public.client_campaigns(id) ON DELETE CASCADE,
  deviates boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dpa_campaign_deviations TO authenticated;
GRANT ALL ON public.dpa_campaign_deviations TO service_role;
ALTER TABLE public.dpa_campaign_deviations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmins manage dpa_campaign_deviations" ON public.dpa_campaign_deviations FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));