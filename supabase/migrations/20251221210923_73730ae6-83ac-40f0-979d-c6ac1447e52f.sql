-- Create table for dashboard KPI configurations
CREATE TABLE public.dashboard_kpis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  kpi_type TEXT NOT NULL DEFAULT 'number', -- number, percentage, currency
  target_value NUMERIC,
  warning_threshold NUMERIC, -- Below this is warning
  critical_threshold NUMERIC, -- Below this is critical/red
  unit TEXT, -- e.g., 'kr', '%', 'stk'
  dashboard_slugs TEXT[] DEFAULT '{}', -- Which dashboards to show this KPI on
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.dashboard_kpis ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view KPIs
CREATE POLICY "Authenticated users can view KPIs"
ON public.dashboard_kpis
FOR SELECT
USING (auth.role() = 'authenticated');

-- Allow authenticated users to manage KPIs (admin check can be added in app layer)
CREATE POLICY "Authenticated users can manage KPIs"
ON public.dashboard_kpis
FOR ALL
USING (auth.role() = 'authenticated');

-- Create trigger for updated_at
CREATE TRIGGER update_dashboard_kpis_updated_at
BEFORE UPDATE ON public.dashboard_kpis
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();