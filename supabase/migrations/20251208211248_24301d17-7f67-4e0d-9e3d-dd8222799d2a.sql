-- Create table for Excel CRM imports
CREATE TABLE public.crm_excel_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  column_mapping JSONB DEFAULT '{}',
  validation_status TEXT DEFAULT 'pending',
  matched_count INTEGER DEFAULT 0,
  cancelled_count INTEGER DEFAULT 0,
  validated_at TIMESTAMP WITH TIME ZONE,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  uploaded_by UUID REFERENCES auth.users(id)
);

-- Create table for Excel import rows
CREATE TABLE public.crm_excel_import_rows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_id UUID NOT NULL REFERENCES public.crm_excel_imports(id) ON DELETE CASCADE,
  ordre_id TEXT,
  opp_number TEXT,
  status TEXT,
  customer_name TEXT,
  raw_data JSONB,
  matched_sale_id UUID REFERENCES public.sales(id),
  is_matched BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_excel_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_excel_import_rows ENABLE ROW LEVEL SECURITY;

-- RLS policies for crm_excel_imports
CREATE POLICY "Managers can manage excel imports" ON public.crm_excel_imports
  FOR ALL USING (is_manager_or_above(auth.uid()));

-- RLS policies for crm_excel_import_rows  
CREATE POLICY "Managers can manage import rows" ON public.crm_excel_import_rows
  FOR ALL USING (is_manager_or_above(auth.uid()));

-- Create indexes
CREATE INDEX idx_crm_excel_imports_client ON public.crm_excel_imports(client_id);
CREATE INDEX idx_crm_excel_import_rows_import ON public.crm_excel_import_rows(import_id);
CREATE INDEX idx_crm_excel_import_rows_ordre ON public.crm_excel_import_rows(ordre_id);
CREATE INDEX idx_crm_excel_import_rows_opp ON public.crm_excel_import_rows(opp_number);