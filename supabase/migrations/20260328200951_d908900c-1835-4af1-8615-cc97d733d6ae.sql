
CREATE TABLE public.billing_manual_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month text NOT NULL,
  category text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  note text,
  updated_by uuid,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(year_month, category)
);

ALTER TABLE public.billing_manual_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read expenses"
  ON public.billing_manual_expenses FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert expenses"
  ON public.billing_manual_expenses FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update expenses"
  ON public.billing_manual_expenses FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
