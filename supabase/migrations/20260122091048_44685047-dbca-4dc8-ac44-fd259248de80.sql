-- Create table for e-conomic invoices (booked/sent)
CREATE TABLE IF NOT EXISTS public.economic_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  economic_invoice_id TEXT NOT NULL,
  invoice_number TEXT NULL,
  date DATE NOT NULL,
  due_date DATE NULL,
  currency TEXT NULL,
  net_amount NUMERIC NULL,
  gross_amount NUMERIC NULL,
  vat_amount NUMERIC NULL,
  customer_number TEXT NULL,
  customer_name TEXT NULL,
  status TEXT NOT NULL DEFAULT 'booked',
  pdf_url TEXT NULL,
  raw JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT economic_invoices_economic_invoice_id_key UNIQUE (economic_invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_economic_invoices_date ON public.economic_invoices(date);
CREATE INDEX IF NOT EXISTS idx_economic_invoices_invoice_number ON public.economic_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_economic_invoices_customer_number ON public.economic_invoices(customer_number);

-- Enable Row Level Security (no policies in MVP; only backend/service role writes)
ALTER TABLE public.economic_invoices ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_economic_invoices_updated_at'
  ) THEN
    CREATE TRIGGER update_economic_invoices_updated_at
    BEFORE UPDATE ON public.economic_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;