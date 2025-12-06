-- Create teams table for organizing employees under team leaders
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  team_leader_id uuid REFERENCES public.employee_master_data(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Add team_id to employee_master_data
ALTER TABLE public.employee_master_data ADD COLUMN team_id uuid REFERENCES public.teams(id);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- RLS policies for teams
CREATE POLICY "Teamledere og ejere kan oprette teams"
ON public.teams
FOR INSERT
WITH CHECK (is_teamleder_or_above(auth.uid()));

CREATE POLICY "Teamledere og ejere kan se teams"
ON public.teams
FOR SELECT
USING (is_teamleder_or_above(auth.uid()) OR is_rekruttering(auth.uid()));

CREATE POLICY "Teamledere kan opdatere egne teams"
ON public.teams
FOR UPDATE
USING (
  is_owner(auth.uid()) OR 
  team_leader_id = get_current_employee_id()
);

CREATE POLICY "Ejere kan slette teams"
ON public.teams
FOR DELETE
USING (is_owner(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();