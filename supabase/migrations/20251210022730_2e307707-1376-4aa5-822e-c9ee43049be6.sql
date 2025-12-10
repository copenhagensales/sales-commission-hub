-- Add new columns to crm_excel_import_rows for extended matching
ALTER TABLE public.crm_excel_import_rows
ADD COLUMN IF NOT EXISTS external_id text,
ADD COLUMN IF NOT EXISTS phone_number text,
ADD COLUMN IF NOT EXISTS date text,
ADD COLUMN IF NOT EXISTS action_type text,
ADD COLUMN IF NOT EXISTS amount_deduct text;

-- Add index for phone number matching
CREATE INDEX IF NOT EXISTS idx_crm_import_rows_phone ON public.crm_excel_import_rows(phone_number);
CREATE INDEX IF NOT EXISTS idx_crm_import_rows_external_id ON public.crm_excel_import_rows(external_id);