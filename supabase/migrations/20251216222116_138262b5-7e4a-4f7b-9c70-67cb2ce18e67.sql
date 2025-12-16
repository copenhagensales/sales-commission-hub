-- Create team_members junction table for assigning employees to teams
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(team_id, employee_id)
);

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view team_members"
  ON public.team_members FOR SELECT
  USING (true);

CREATE POLICY "Owners can manage team_members"
  ON public.team_members FOR ALL
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY "Teamledere can manage their team members"
  ON public.team_members FOR ALL
  USING (public.is_teamleder_or_above(auth.uid()))
  WITH CHECK (public.is_teamleder_or_above(auth.uid()));