-- Add calls_org_codes column to dialer_integrations for multi org code support
ALTER TABLE public.dialer_integrations 
ADD COLUMN IF NOT EXISTS calls_org_codes text[] DEFAULT ARRAY[]::text[];

-- Add comment explaining the column
COMMENT ON COLUMN public.dialer_integrations.calls_org_codes IS 'Array of org codes to fetch calls from (for Enreach). Calls are deduplicated across org codes.';