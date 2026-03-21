
CREATE TABLE public.sales_validation_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_id UUID REFERENCES public.clients(id),
  period_month TEXT NOT NULL,
  file_name TEXT NOT NULL,
  total_billable INTEGER DEFAULT 0,
  total_cancelled INTEGER DEFAULT 0,
  matched_cancellations INTEGER DEFAULT 0,
  unmatched_cancellations INTEGER DEFAULT 0,
  unverified_sales INTEGER DEFAULT 0,
  uploaded_by UUID REFERENCES public.employee_master_data(id),
  status TEXT NOT NULL DEFAULT 'completed',
  results_json JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.sales_validation_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view uploads"
  ON public.sales_validation_uploads FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert uploads"
  ON public.sales_validation_uploads FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update uploads"
  ON public.sales_validation_uploads FOR UPDATE TO authenticated USING (true);
