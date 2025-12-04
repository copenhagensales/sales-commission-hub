ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS adversus_external_id text;

CREATE INDEX IF NOT EXISTS idx_sales_adversus_external_id
ON public.sales(adversus_external_id);