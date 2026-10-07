CREATE TABLE public.dpa_campaign_exclusions (
  client_campaign_id uuid PRIMARY KEY REFERENCES public.client_campaigns(id) ON DELETE CASCADE,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.dpa_campaign_exclusions TO authenticated;
GRANT ALL ON public.dpa_campaign_exclusions TO service_role;
ALTER TABLE public.dpa_campaign_exclusions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmins manage dpa_campaign_exclusions" ON public.dpa_campaign_exclusions FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));