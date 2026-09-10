CREATE TABLE public.location_rate_surcharges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_type text NOT NULL,
  chain_match text NOT NULL,
  surcharge_per_day numeric NOT NULL,
  funded_by_client_id uuid NULL REFERENCES public.clients(id),
  valid_from date NOT NULL,
  valid_to date NULL,
  is_active boolean NOT NULL DEFAULT true,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.location_rate_surcharges TO authenticated;
GRANT ALL ON public.location_rate_surcharges TO service_role;

ALTER TABLE public.location_rate_surcharges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active surcharges"
ON public.location_rate_surcharges
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Owners and managers can manage surcharges"
ON public.location_rate_surcharges
FOR ALL
TO authenticated
USING (is_teamleder_or_above(auth.uid()))
WITH CHECK (is_teamleder_or_above(auth.uid()));

CREATE INDEX idx_location_rate_surcharges_type_active
ON public.location_rate_surcharges (location_type, is_active);

CREATE TRIGGER update_location_rate_surcharges_updated_at
BEFORE UPDATE ON public.location_rate_surcharges
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.location_rate_surcharges
  (location_type, chain_match, surcharge_per_day, funded_by_client_id, valid_from, valid_to, note)
VALUES
  ('Coop butik', 'Kvickly', 750, '9a92ea4c-6404-4b58-be08-065e7552d552', '2026-09-01', NULL, 'Coop-prisstigning 1750 fra 1000, afholdes af Eesy FM'),
  ('Coop butik', 'SuperBrugsen', 250, '9a92ea4c-6404-4b58-be08-065e7552d552', '2026-09-01', NULL, 'Coop-prisstigning 1250 fra 1000, afholdes af Eesy FM');

ALTER TABLE public.supplier_invoice_reports
  ADD COLUMN IF NOT EXISTS base_amount numeric NULL,
  ADD COLUMN IF NOT EXISTS surcharge_amount numeric NULL,
  ADD COLUMN IF NOT EXISTS surcharge_refundable_amount numeric NULL;