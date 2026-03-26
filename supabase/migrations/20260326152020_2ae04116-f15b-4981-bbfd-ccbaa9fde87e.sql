CREATE TABLE public.cancellation_product_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  column_name text NOT NULL,
  operator text NOT NULL DEFAULT 'any',
  values text[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_product_column UNIQUE (client_id, product_id, column_name)
);

ALTER TABLE public.cancellation_product_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON public.cancellation_product_conditions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);