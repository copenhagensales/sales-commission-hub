
-- Create cancellation_queue table
CREATE TABLE public.cancellation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid REFERENCES public.cancellation_imports(id) ON DELETE CASCADE NOT NULL,
  sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
  upload_type text NOT NULL DEFAULT 'cancellation',
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES public.employee_master_data(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add upload_type to cancellation_imports
ALTER TABLE public.cancellation_imports ADD COLUMN upload_type text DEFAULT 'cancellation';

-- Enable RLS
ALTER TABLE public.cancellation_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for cancellation_queue
CREATE POLICY "Authenticated users can view cancellation_queue"
  ON public.cancellation_queue FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert cancellation_queue"
  ON public.cancellation_queue FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update cancellation_queue"
  ON public.cancellation_queue FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
