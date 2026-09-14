ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS manual_pricing_lock boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sale_items.manual_pricing_lock IS
  'Naar true er provision/omsaetning manuelt rettet og maa ikke overskrives af rematch-pricing-rules.';

CREATE TABLE public.sales_manual_pricing_corrections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  sale_item_id uuid REFERENCES public.sale_items(id) ON DELETE SET NULL,
  product_id uuid,
  product_name text,
  previous_commission numeric,
  new_commission numeric,
  previous_revenue numeric,
  new_revenue numeric,
  previous_condition_value text,
  new_condition_value text,
  condition_key text,
  reason text NOT NULL,
  corrected_by uuid,
  corrected_by_label text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_manual_pricing_corrections_sale_id
  ON public.sales_manual_pricing_corrections (sale_id);

GRANT SELECT, INSERT ON public.sales_manual_pricing_corrections TO authenticated;
GRANT ALL ON public.sales_manual_pricing_corrections TO service_role;

ALTER TABLE public.sales_manual_pricing_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and superadmins can view manual pricing corrections"
  ON public.sales_manual_pricing_corrections
  FOR SELECT
  TO authenticated
  USING (public.effective_is_owner() OR public.effective_is_superadmin());

CREATE POLICY "Owners and superadmins can log manual pricing corrections"
  ON public.sales_manual_pricing_corrections
  FOR INSERT
  TO authenticated
  WITH CHECK (public.effective_is_owner() OR public.effective_is_superadmin());

CREATE OR REPLACE FUNCTION public.block_manual_pricing_correction_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'sales_manual_pricing_corrections er immutable og kan ikke aendres eller slettes';
END;
$$;

CREATE TRIGGER trg_sales_manual_pricing_corrections_immutable
  BEFORE UPDATE OR DELETE ON public.sales_manual_pricing_corrections
  FOR EACH ROW EXECUTE FUNCTION public.block_manual_pricing_correction_changes();