
CREATE TABLE public.campaign_retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_campaign_id uuid NOT NULL UNIQUE REFERENCES public.client_campaigns(id) ON DELETE CASCADE,
  retention_days integer,
  is_active boolean NOT NULL DEFAULT false,
  cleanup_mode text NOT NULL DEFAULT 'anonymize_customer' CHECK (cleanup_mode IN ('anonymize_customer', 'delete_all')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage retention policies"
  ON public.campaign_retention_policies
  FOR ALL
  TO authenticated
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY "Managers can view retention policies"
  ON public.campaign_retention_policies
  FOR SELECT
  TO authenticated
  USING (public.is_manager_or_above(auth.uid()));
