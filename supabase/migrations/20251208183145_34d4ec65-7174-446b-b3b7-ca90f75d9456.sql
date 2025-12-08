-- Add status column to sales table for CRM validation tracking
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS status text DEFAULT NULL;

-- Add index for faster filtering on status
CREATE INDEX IF NOT EXISTS idx_sales_status ON public.sales(status);

COMMENT ON COLUMN public.sales.status IS 'CRM validation status: null/pending_validation = needs validation, validated = confirmed in CRM, rejected = not found in CRM';