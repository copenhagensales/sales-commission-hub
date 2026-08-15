CREATE TABLE public.eesy_fm_powerbi_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sheet_type TEXT NOT NULL CHECK (sheet_type IN ('gaden_coop','marked')),
  file_name TEXT NOT NULL,
  storage_path TEXT,
  row_count INTEGER NOT NULL DEFAULT 0,
  period_from DATE,
  period_to DATE,
  uploaded_by UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX eesy_fm_powerbi_imports_active_sheet_idx
  ON public.eesy_fm_powerbi_imports (sheet_type)
  WHERE is_active;

CREATE TABLE public.eesy_fm_powerbi_rows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_id UUID NOT NULL REFERENCES public.eesy_fm_powerbi_imports(id) ON DELETE CASCADE,
  sale_date DATE,
  seller_name TEXT,
  phone_raw TEXT,
  phone_normalized TEXT,
  subscription_name TEXT,
  campaign_name TEXT,
  operator TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX eesy_fm_powerbi_rows_import_idx ON public.eesy_fm_powerbi_rows (import_id);
CREATE INDEX eesy_fm_powerbi_rows_phone_idx ON public.eesy_fm_powerbi_rows (phone_normalized);
CREATE INDEX eesy_fm_powerbi_rows_date_idx ON public.eesy_fm_powerbi_rows (sale_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.eesy_fm_powerbi_imports TO authenticated;
GRANT ALL ON public.eesy_fm_powerbi_imports TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eesy_fm_powerbi_rows TO authenticated;
GRANT ALL ON public.eesy_fm_powerbi_rows TO service_role;

ALTER TABLE public.eesy_fm_powerbi_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eesy_fm_powerbi_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view powerbi imports"
  ON public.eesy_fm_powerbi_imports FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage powerbi imports"
  ON public.eesy_fm_powerbi_imports FOR ALL TO authenticated
  USING (public.is_manager_or_above(auth.uid()))
  WITH CHECK (public.is_manager_or_above(auth.uid()));

CREATE POLICY "Authenticated can view powerbi rows"
  ON public.eesy_fm_powerbi_rows FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage powerbi rows"
  ON public.eesy_fm_powerbi_rows FOR ALL TO authenticated
  USING (public.is_manager_or_above(auth.uid()))
  WITH CHECK (public.is_manager_or_above(auth.uid()));

CREATE TRIGGER update_eesy_fm_powerbi_imports_updated_at
  BEFORE UPDATE ON public.eesy_fm_powerbi_imports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();