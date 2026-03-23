
-- Create cancellation_upload_configs table
CREATE TABLE public.cancellation_upload_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone_column TEXT,
  company_column TEXT,
  opp_column TEXT,
  product_columns TEXT[] DEFAULT '{}',
  revenue_column TEXT,
  commission_column TEXT,
  product_match_mode TEXT NOT NULL DEFAULT 'exact',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.cancellation_upload_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read configs" ON public.cancellation_upload_configs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert configs" ON public.cancellation_upload_configs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update configs" ON public.cancellation_upload_configs
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete configs" ON public.cancellation_upload_configs
  FOR DELETE TO authenticated USING (true);

-- Add config_id to cancellation_imports
ALTER TABLE public.cancellation_imports ADD COLUMN config_id UUID REFERENCES public.cancellation_upload_configs(id) ON DELETE SET NULL;
