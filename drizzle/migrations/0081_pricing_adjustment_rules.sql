CREATE TABLE public.pricing_adjustment_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  name text NOT NULL,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  excluded_product_ids uuid[] NOT NULL DEFAULT '{}',
  percent_reduction numeric NOT NULL CHECK (percent_reduction > 0 AND percent_reduction <= 100),
  effective_from date,
  effective_to date,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.pricing_adjustment_rules IS 'Procentjustering der anvendes EFTER valgt prisregel/grundpris (fx TDC Brands = Ja → -70 %). Bruges af _shared/pricingAdjustments.ts.';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_adjustment_rules TO authenticated;
GRANT ALL ON public.pricing_adjustment_rules TO service_role;
ALTER TABLE public.pricing_adjustment_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Indloggede kan laese prisjusteringer" ON public.pricing_adjustment_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Ledere kan styre prisjusteringer" ON public.pricing_adjustment_rules FOR ALL TO authenticated USING (public.is_teamleder_or_above(auth.uid())) WITH CHECK (public.is_teamleder_or_above(auth.uid()));
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS adjustment_rule_id uuid NULL REFERENCES public.pricing_adjustment_rules(id);