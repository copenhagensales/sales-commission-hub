CREATE TABLE public.compliance_area_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_key text NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_by_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_compliance_area_reviews_area ON public.compliance_area_reviews(area_key, reviewed_at DESC);

GRANT SELECT, INSERT ON public.compliance_area_reviews TO authenticated;
GRANT ALL ON public.compliance_area_reviews TO service_role;

ALTER TABLE public.compliance_area_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Compliance admins can view reviews"
ON public.compliance_area_reviews FOR SELECT TO authenticated
USING (public.has_page_permission(auth.uid(), 'menu_compliance_admin'));

CREATE POLICY "Owners and superadmins can confirm reviews"
ON public.compliance_area_reviews FOR INSERT TO authenticated
WITH CHECK (public.can_manage_dpa_documents(auth.uid()) AND reviewed_by = auth.uid());