ALTER TABLE public.location ADD COLUMN IF NOT EXISTS chain text NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'location_chain_check') THEN
    ALTER TABLE public.location ADD CONSTRAINT location_chain_check CHECK (chain IS NULL OR chain IN ('Kvickly','SuperBrugsen'));
  END IF;
END $$;
COMMENT ON COLUMN public.location.chain IS 'DEPRECATED: ubrugt; kæde for "Coop direkte" afledes af navnet mod location_rate_surcharges.';
ALTER TABLE public.supplier_invoice_reports ADD COLUMN IF NOT EXISTS direct_refund_amount numeric NULL;
ALTER TABLE public.supplier_invoice_reports ADD COLUMN IF NOT EXISTS direct_refund_data jsonb NULL;
COMMENT ON COLUMN public.supplier_invoice_reports.direct_refund_amount IS 'Refusion fra "Coop direkte"-lokationer. Indgår ikke i total/base/final/rabat.';
COMMENT ON COLUMN public.location.gross_daily_rate IS 'DEPRECATED: ubrugt i UI.';
COMMENT ON COLUMN public.location.refund_daily_rate IS 'DEPRECATED: ubrugt i UI; refusion kommer fra kædereglen.';
COMMENT ON COLUMN public.location.refund_client_id IS 'DEPRECATED: ubrugt i UI; refunderende kunde kommer fra kædereglen.';