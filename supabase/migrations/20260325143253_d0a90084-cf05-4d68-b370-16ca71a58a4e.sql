CREATE TABLE public.cancellation_product_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  excel_product_name TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, excel_product_name)
);

ALTER TABLE public.cancellation_product_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage cancellation product mappings"
ON public.cancellation_product_mappings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);