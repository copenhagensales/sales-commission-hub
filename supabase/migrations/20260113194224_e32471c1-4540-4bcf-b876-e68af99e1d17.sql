-- Create table for scheduled team changes
CREATE TABLE public.scheduled_team_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  from_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  to_team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  effective_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  executed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'cancelled'))
);

-- Enable RLS
ALTER TABLE public.scheduled_team_changes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view scheduled changes"
  ON public.scheduled_team_changes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert scheduled changes"
  ON public.scheduled_team_changes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update scheduled changes"
  ON public.scheduled_team_changes FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete scheduled changes"
  ON public.scheduled_team_changes FOR DELETE TO authenticated USING (true);

-- Index for efficient querying
CREATE INDEX idx_scheduled_team_changes_status_date 
  ON public.scheduled_team_changes(status, effective_date) 
  WHERE status = 'pending';