CREATE TABLE public.dpa_campaign_sources (
  client_campaign_id uuid PRIMARY KEY REFERENCES public.client_campaigns(id) ON DELETE CASCADE,
  data_source text NOT NULL,
  updated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dpa_campaign_sources TO authenticated;
GRANT ALL ON public.dpa_campaign_sources TO service_role;
ALTER TABLE public.dpa_campaign_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmins manage dpa_campaign_sources" ON public.dpa_campaign_sources FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));