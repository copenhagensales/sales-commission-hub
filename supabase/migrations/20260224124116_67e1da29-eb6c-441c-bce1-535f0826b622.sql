
-- Create supplier_contacts table
CREATE TABLE public.supplier_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_type TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supplier_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Authenticated users can read supplier_contacts"
  ON public.supplier_contacts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert supplier_contacts"
  ON public.supplier_contacts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update supplier_contacts"
  ON public.supplier_contacts FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete supplier_contacts"
  ON public.supplier_contacts FOR DELETE TO authenticated USING (true);

-- Add sent_at and sent_to columns to supplier_invoice_reports
ALTER TABLE public.supplier_invoice_reports
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_to TEXT[];
