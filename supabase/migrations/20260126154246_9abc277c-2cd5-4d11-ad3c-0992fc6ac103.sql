-- Create kpi_watermarks table for tracking incremental processing
CREATE TABLE public.kpi_watermarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_type TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id UUID,
  last_processed_at TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01 00:00:00+00',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT kpi_watermarks_unique UNIQUE (period_type, scope_type, scope_id)
);

-- Enable RLS
ALTER TABLE public.kpi_watermarks ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (edge functions use service role)
CREATE POLICY "Service role full access" ON public.kpi_watermarks
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create indexes for efficient incremental fetching
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_fieldmarketing_sales_created_at ON public.fieldmarketing_sales(created_at);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_kpi_watermarks_updated_at
  BEFORE UPDATE ON public.kpi_watermarks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE public.kpi_watermarks IS 'Tracks last processed timestamps for incremental KPI calculations';