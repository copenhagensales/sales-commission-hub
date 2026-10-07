CREATE TABLE public.dpa_campaign_retention_texts (
  client_campaign_id uuid PRIMARY KEY REFERENCES public.client_campaigns(id) ON DELETE CASCADE,
  retention_text text NOT NULL CHECK (length(btrim(retention_text)) > 0),
  updated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dpa_campaign_retention_texts TO authenticated;
GRANT ALL ON public.dpa_campaign_retention_texts TO service_role;
ALTER TABLE public.dpa_campaign_retention_texts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmins manage dpa_campaign_retention_texts" ON public.dpa_campaign_retention_texts
  FOR ALL TO authenticated USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));