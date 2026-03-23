
CREATE TABLE public.client_monthly_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  period_start date NOT NULL,
  target_sales integer NOT NULL,
  note text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, period_start)
);

ALTER TABLE public.client_monthly_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage targets"
  ON public.client_monthly_targets FOR ALL TO authenticated USING (true) WITH CHECK (true);
