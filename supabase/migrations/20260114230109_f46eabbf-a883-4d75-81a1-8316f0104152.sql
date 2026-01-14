-- Add dashboard management columns to kpi_definitions
ALTER TABLE public.kpi_definitions 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS dashboard_slugs text[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.kpi_definitions.is_active IS 'Whether this KPI is active and available for use';
COMMENT ON COLUMN public.kpi_definitions.dashboard_slugs IS 'Array of dashboard slugs where this KPI should be displayed';