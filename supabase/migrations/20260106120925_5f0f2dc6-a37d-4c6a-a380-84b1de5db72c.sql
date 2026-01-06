-- Create global trusted IP ranges table
CREATE TABLE public.trusted_ip_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ip_range TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trusted_ip_ranges ENABLE ROW LEVEL SECURITY;

-- Only owners can view
CREATE POLICY "Owners can view trusted IP ranges"
ON public.trusted_ip_ranges
FOR SELECT
USING (public.is_owner(auth.uid()));

-- Only owners can insert
CREATE POLICY "Owners can insert trusted IP ranges"
ON public.trusted_ip_ranges
FOR INSERT
WITH CHECK (public.is_owner(auth.uid()));

-- Only owners can update
CREATE POLICY "Owners can update trusted IP ranges"
ON public.trusted_ip_ranges
FOR UPDATE
USING (public.is_owner(auth.uid()));

-- Only owners can delete
CREATE POLICY "Owners can delete trusted IP ranges"
ON public.trusted_ip_ranges
FOR DELETE
USING (public.is_owner(auth.uid()));

-- Add comment
COMMENT ON TABLE public.trusted_ip_ranges IS 'Global trusted IP ranges that bypass MFA for all positions';