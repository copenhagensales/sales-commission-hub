-- Table: economic_imports (import log)
CREATE TABLE public.economic_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  storage_path TEXT NOT NULL,
  file_name TEXT,
  file_size_bytes INTEGER,
  checksum TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'error')),
  error_message TEXT,
  detected_start_date DATE,
  detected_end_date DATE,
  rows_postering INTEGER DEFAULT 0,
  rows_konto INTEGER DEFAULT 0,
  rows_faktura INTEGER DEFAULT 0,
  rows_fakturalinjer INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  files_found TEXT[]
);

-- Table: economic_kontoplan (account plan)
CREATE TABLE public.economic_kontoplan (
  konto_nr INTEGER PRIMARY KEY,
  navn TEXT NOT NULL,
  type INTEGER,
  sum_fra INTEGER,
  momskode TEXT,
  debet_kredit TEXT,
  modkonto INTEGER,
  overfoer_primo_til INTEGER,
  noegletalskode TEXT,
  note TEXT,
  adgang INTEGER,
  raw_json JSONB,
  updated_at TIMESTAMPTZ DEFAULT now(),
  import_id UUID REFERENCES public.economic_imports(id)
);

-- Table: economic_posteringer (transactions)
CREATE TABLE public.economic_posteringer (
  loebe_nr INTEGER PRIMARY KEY,
  posterings_type TEXT,
  dato DATE NOT NULL,
  konto_nr INTEGER REFERENCES public.economic_kontoplan(konto_nr),
  bilags_nr INTEGER,
  tekst TEXT,
  beloeb_dkk NUMERIC(15,2),
  valuta TEXT DEFAULT 'DKK',
  beloeb NUMERIC(15,2),
  projekt_nr INTEGER,
  aktivitets_nr INTEGER,
  kunde_nr INTEGER,
  leverandoer_nr INTEGER,
  faktura_nr INTEGER,
  leverandoer_faktura_nr TEXT,
  forfalds_dato DATE,
  momskode TEXT,
  enhed1_nr INTEGER,
  enhed2_nr INTEGER,
  antal NUMERIC(15,4),
  antal2 NUMERIC(15,4),
  raw_json JSONB,
  updated_at TIMESTAMPTZ DEFAULT now(),
  import_id UUID REFERENCES public.economic_imports(id)
);

-- Indexes for fast lookups
CREATE INDEX idx_posteringer_dato ON public.economic_posteringer(dato);
CREATE INDEX idx_posteringer_konto ON public.economic_posteringer(konto_nr);
CREATE INDEX idx_posteringer_import ON public.economic_posteringer(import_id);
CREATE INDEX idx_kontoplan_import ON public.economic_kontoplan(import_id);

-- Enable RLS
ALTER TABLE public.economic_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economic_kontoplan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economic_posteringer ENABLE ROW LEVEL SECURITY;

-- RLS Policies for economic_imports (only owners can manage)
CREATE POLICY "Owners can view imports" ON public.economic_imports
  FOR SELECT USING (public.is_owner(auth.uid()));

CREATE POLICY "Owners can insert imports" ON public.economic_imports
  FOR INSERT WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY "Owners can update imports" ON public.economic_imports
  FOR UPDATE USING (public.is_owner(auth.uid()));

-- RLS Policies for kontoplan (authenticated can read)
CREATE POLICY "Authenticated can read kontoplan" ON public.economic_kontoplan
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- RLS Policies for posteringer (authenticated can read)
CREATE POLICY "Authenticated can read posteringer" ON public.economic_posteringer
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Storage bucket for economic imports
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'economic-imports',
  'economic-imports',
  false,
  52428800, -- 50MB limit
  ARRAY['application/zip', 'application/x-zip-compressed']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Owners can upload economic files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'economic-imports' 
    AND public.is_owner(auth.uid())
  );

CREATE POLICY "Owners can read economic files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'economic-imports' 
    AND public.is_owner(auth.uid())
  );

CREATE POLICY "Owners can delete economic files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'economic-imports' 
    AND public.is_owner(auth.uid())
  );