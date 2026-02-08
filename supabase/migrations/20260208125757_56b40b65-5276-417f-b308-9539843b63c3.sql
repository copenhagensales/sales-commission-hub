-- Create cancellation_imports table for tracking upload history
CREATE TABLE public.cancellation_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  uploaded_by UUID NOT NULL REFERENCES public.employee_master_data(id),
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  rows_processed INTEGER DEFAULT 0,
  rows_matched INTEGER DEFAULT 0,
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.cancellation_imports ENABLE ROW LEVEL SECURITY;

-- RLS policies - allow authenticated users to view and insert
CREATE POLICY "Authenticated users can view cancellation imports"
ON public.cancellation_imports
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert cancellation imports"
ON public.cancellation_imports
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update cancellation imports"
ON public.cancellation_imports
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Add permission for menu_cancellations to ejer role (permission_type = 'page')
INSERT INTO public.role_page_permissions (role_key, permission_key, can_view, can_edit, visibility, parent_key, permission_type)
VALUES ('ejer', 'menu_cancellations', true, true, 'all', 'section_salary', 'page')
ON CONFLICT (role_key, permission_key) DO NOTHING;