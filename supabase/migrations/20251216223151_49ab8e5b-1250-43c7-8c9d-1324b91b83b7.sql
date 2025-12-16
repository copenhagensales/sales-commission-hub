-- Create job_positions table for managing positions and their permissions
CREATE TABLE public.job_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_positions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view job positions"
ON public.job_positions FOR SELECT
USING (true);

CREATE POLICY "Owners can manage job positions"
ON public.job_positions FOR ALL
USING (is_owner(auth.uid()))
WITH CHECK (is_owner(auth.uid()));

-- Insert default positions
INSERT INTO public.job_positions (name, description, permissions) VALUES
('Ejer', 'Virksomhedsejer med alle rettigheder', '{"can_see_own_revenue": true, "can_see_other_teams_revenue": true, "can_manage_employees": true, "can_manage_teams": true, "can_manage_contracts": true, "can_view_all_data": true}'::jsonb),
('Teamleder', 'Leder af et team', '{"can_see_own_revenue": true, "can_see_other_teams_revenue": false, "can_manage_employees": false, "can_manage_teams": false, "can_manage_contracts": true, "can_view_all_data": false}'::jsonb),
('Assisterende Teamleder', 'Assisterende teamleder', '{"can_see_own_revenue": true, "can_see_other_teams_revenue": false, "can_manage_employees": false, "can_manage_teams": false, "can_manage_contracts": false, "can_view_all_data": false}'::jsonb),
('Rekruttering', 'Rekrutteringsmedarbejder', '{"can_see_own_revenue": false, "can_see_other_teams_revenue": false, "can_manage_employees": true, "can_manage_teams": false, "can_manage_contracts": true, "can_view_all_data": false}'::jsonb),
('Sælger', 'Standard sælger', '{"can_see_own_revenue": true, "can_see_other_teams_revenue": false, "can_manage_employees": false, "can_manage_teams": false, "can_manage_contracts": false, "can_view_all_data": false}'::jsonb),
('SOME', 'Social media medarbejder', '{"can_see_own_revenue": false, "can_see_other_teams_revenue": false, "can_manage_employees": false, "can_manage_teams": false, "can_manage_contracts": false, "can_view_all_data": false}'::jsonb),
('Fieldmarketing', 'Fieldmarketing medarbejder', '{"can_see_own_revenue": true, "can_see_other_teams_revenue": false, "can_manage_employees": false, "can_manage_teams": false, "can_manage_contracts": false, "can_view_all_data": false}'::jsonb);