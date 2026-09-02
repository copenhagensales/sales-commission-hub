CREATE TABLE public.tryg_sale_reviews (
  sale_item_id uuid PRIMARY KEY REFERENCES public.sale_items(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('approved','rejected')),
  reviewed_by uuid,
  reviewed_by_name text,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tryg_sale_reviews TO authenticated;
GRANT ALL ON public.tryg_sale_reviews TO service_role;

ALTER TABLE public.tryg_sale_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tryg-ansvarlige kan se salgsstatus"
ON public.tryg_sale_reviews FOR SELECT TO authenticated
USING (public.can_edit_report_templates(auth.uid()));

CREATE POLICY "Tryg-ansvarlige kan oprette salgsstatus"
ON public.tryg_sale_reviews FOR INSERT TO authenticated
WITH CHECK (public.can_edit_report_templates(auth.uid()));

CREATE POLICY "Tryg-ansvarlige kan opdatere salgsstatus"
ON public.tryg_sale_reviews FOR UPDATE TO authenticated
USING (public.can_edit_report_templates(auth.uid()))
WITH CHECK (public.can_edit_report_templates(auth.uid()));

CREATE POLICY "Tryg-ansvarlige kan slette salgsstatus"
ON public.tryg_sale_reviews FOR DELETE TO authenticated
USING (public.can_edit_report_templates(auth.uid()));

CREATE TRIGGER update_tryg_sale_reviews_updated_at
BEFORE UPDATE ON public.tryg_sale_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_tryg_sale_reviews_status ON public.tryg_sale_reviews(status);