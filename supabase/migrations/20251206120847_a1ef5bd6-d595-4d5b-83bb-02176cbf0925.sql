-- Create gdpr_consents table for tracking employee data processing consent
CREATE TABLE public.gdpr_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  consent_type text NOT NULL, -- 'data_processing', 'marketing', etc.
  consented_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create gdpr_data_requests table for tracking export and deletion requests
CREATE TABLE public.gdpr_data_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('export', 'deletion')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  processed_by uuid,
  notes text,
  export_data jsonb, -- Stores the exported data for export requests
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gdpr_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gdpr_data_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for gdpr_consents
CREATE POLICY "Employees can view own consents"
  ON public.gdpr_consents FOR SELECT
  USING (employee_id = get_current_employee_id());

CREATE POLICY "Employees can insert own consents"
  ON public.gdpr_consents FOR INSERT
  WITH CHECK (employee_id = get_current_employee_id());

CREATE POLICY "Managers can view all consents"
  ON public.gdpr_consents FOR SELECT
  USING (is_manager_or_above(auth.uid()));

CREATE POLICY "Managers can manage consents"
  ON public.gdpr_consents FOR ALL
  USING (is_manager_or_above(auth.uid()));

-- RLS policies for gdpr_data_requests
CREATE POLICY "Employees can view own requests"
  ON public.gdpr_data_requests FOR SELECT
  USING (employee_id = get_current_employee_id());

CREATE POLICY "Employees can create own requests"
  ON public.gdpr_data_requests FOR INSERT
  WITH CHECK (employee_id = get_current_employee_id());

CREATE POLICY "Managers can view all requests"
  ON public.gdpr_data_requests FOR SELECT
  USING (is_manager_or_above(auth.uid()));

CREATE POLICY "Managers can manage requests"
  ON public.gdpr_data_requests FOR ALL
  USING (is_manager_or_above(auth.uid()));

-- Create indexes
CREATE INDEX idx_gdpr_consents_employee ON public.gdpr_consents(employee_id);
CREATE INDEX idx_gdpr_data_requests_employee ON public.gdpr_data_requests(employee_id);
CREATE INDEX idx_gdpr_data_requests_status ON public.gdpr_data_requests(status);