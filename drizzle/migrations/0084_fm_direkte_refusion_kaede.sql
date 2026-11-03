ALTER TABLE public.location ADD COLUMN IF NOT EXISTS chain text NULL;
ALTER TABLE public.location ADD CONSTRAINT location_chain_check CHECK (chain IS NULL OR chain IN ('Kvickly','SuperBrugsen'));
COMMENT ON COLUMN public.location.chain IS 'Kæde for direkte afregnede lokationer (type <> Coop butik). Kun til refusion i Coop-rapporten; påvirker ikke DB.';
ALTER TABLE public.supplier_invoice_reports ADD COLUMN IF NOT EXISTS direct_refund_amount numeric NULL;
ALTER TABLE public.supplier_invoice_reports ADD COLUMN IF NOT EXISTS direct_refund_data jsonb NULL;
COMMENT ON COLUMN public.supplier_invoice_reports.direct_refund_amount IS 'Refusion fra direkte afregnede kæde-lokationer. Indgår ikke i total/base/final/rabat.';