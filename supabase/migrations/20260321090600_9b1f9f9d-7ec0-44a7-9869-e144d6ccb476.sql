
-- Table for mapping e-conomic invoice text patterns to internal clients
CREATE TABLE public.economic_client_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_pattern TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint on match_pattern to avoid duplicates
CREATE UNIQUE INDEX idx_economic_client_mapping_pattern ON public.economic_client_mapping (LOWER(match_pattern));

-- Enable RLS
ALTER TABLE public.economic_client_mapping ENABLE ROW LEVEL SECURITY;

-- Only managers+ can read
CREATE POLICY "Managers can view client mappings"
ON public.economic_client_mapping
FOR SELECT
TO authenticated
USING (public.is_teamleder_or_above(auth.uid()));

-- Only managers+ can insert
CREATE POLICY "Managers can create client mappings"
ON public.economic_client_mapping
FOR INSERT
TO authenticated
WITH CHECK (public.is_teamleder_or_above(auth.uid()));

-- Only managers+ can update
CREATE POLICY "Managers can update client mappings"
ON public.economic_client_mapping
FOR UPDATE
TO authenticated
USING (public.is_teamleder_or_above(auth.uid()));

-- Only managers+ can delete
CREATE POLICY "Managers can delete client mappings"
ON public.economic_client_mapping
FOR DELETE
TO authenticated
USING (public.is_teamleder_or_above(auth.uid()));
