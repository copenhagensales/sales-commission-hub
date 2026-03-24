
-- New table for persistent seller name → employee mappings
CREATE TABLE public.cancellation_seller_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  excel_seller_name TEXT NOT NULL,
  employee_id UUID NOT NULL REFERENCES employee_master_data(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_id, excel_seller_name)
);

ALTER TABLE public.cancellation_seller_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage seller mappings"
  ON public.cancellation_seller_mappings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add seller/date/fallback columns to upload configs
ALTER TABLE public.cancellation_upload_configs 
  ADD COLUMN IF NOT EXISTS seller_column TEXT,
  ADD COLUMN IF NOT EXISTS date_column TEXT,
  ADD COLUMN IF NOT EXISTS fallback_product_mappings JSONB DEFAULT '[]';
