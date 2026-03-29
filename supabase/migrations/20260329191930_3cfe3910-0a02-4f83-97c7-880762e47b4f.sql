CREATE TABLE public.product_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_item_id uuid NOT NULL REFERENCES public.sale_items(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL,
  cancellation_queue_id uuid REFERENCES public.cancellation_queue(id),
  old_product_id uuid,
  new_product_id uuid,
  old_product_name text,
  new_product_name text,
  old_commission numeric,
  new_commission numeric,
  old_revenue numeric,
  new_revenue numeric,
  changed_by uuid,
  change_reason text DEFAULT 'basket_difference_approval',
  rolled_back_at timestamptz,
  rolled_back_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.product_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read change log"
  ON public.product_change_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert change log"
  ON public.product_change_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update change log"
  ON public.product_change_log FOR UPDATE TO authenticated USING (true);