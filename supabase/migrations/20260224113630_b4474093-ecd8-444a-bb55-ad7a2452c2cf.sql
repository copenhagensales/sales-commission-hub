
-- Table: supplier_discount_rules
CREATE TABLE public.supplier_discount_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_type text NOT NULL,
  min_placements integer NOT NULL,
  discount_percent numeric NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_discount_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active discount rules"
  ON public.supplier_discount_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owners and managers can manage discount rules"
  ON public.supplier_discount_rules FOR ALL
  TO authenticated
  USING (public.is_teamleder_or_above(auth.uid()))
  WITH CHECK (public.is_teamleder_or_above(auth.uid()));

-- Seed data for Danske Shoppingcentre
INSERT INTO public.supplier_discount_rules (location_type, min_placements, discount_percent, description)
VALUES
  ('Danske Shoppingcentre', 11, 10, 'Rabat ved 11+ unikke placeringer pr. måned'),
  ('Danske Shoppingcentre', 20, 15, 'Rabat ved 20+ unikke placeringer pr. måned');

-- Table: supplier_invoice_reports
CREATE TABLE public.supplier_invoice_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_type text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  final_amount numeric NOT NULL DEFAULT 0,
  unique_locations integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  report_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_invoice_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view reports"
  ON public.supplier_invoice_reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owners and managers can insert reports"
  ON public.supplier_invoice_reports FOR INSERT
  TO authenticated
  WITH CHECK (public.is_teamleder_or_above(auth.uid()));

CREATE POLICY "Owners and managers can update draft reports"
  ON public.supplier_invoice_reports FOR UPDATE
  TO authenticated
  USING (public.is_teamleder_or_above(auth.uid()) AND status = 'draft')
  WITH CHECK (public.is_teamleder_or_above(auth.uid()));

-- Trigger for updated_at on discount rules
CREATE TRIGGER update_supplier_discount_rules_updated_at
  BEFORE UPDATE ON public.supplier_discount_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
