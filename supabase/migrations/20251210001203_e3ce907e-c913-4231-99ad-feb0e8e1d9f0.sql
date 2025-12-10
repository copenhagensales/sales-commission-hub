-- Add integration_type column to distinguish the integration system used
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS integration_type text;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_sales_integration_type ON public.sales(integration_type);

-- Update existing data:
-- Records with source='adversus' should have integration_type='adversus' and source='Lovablecph'
UPDATE public.sales 
SET integration_type = 'adversus', source = 'Lovablecph'
WHERE source = 'adversus';

-- Records with source='tryg' or 'try enreach' came from enreach integration
UPDATE public.sales 
SET integration_type = 'enreach'
WHERE source IN ('tryg', 'try enreach');

-- Add comment for documentation
COMMENT ON COLUMN public.sales.source IS 'Name of the dialer account (e.g., Lovablecph, tryg)';
COMMENT ON COLUMN public.sales.integration_type IS 'Type of integration used (adversus, enreach)';