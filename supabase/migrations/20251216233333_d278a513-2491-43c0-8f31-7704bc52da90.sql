-- Add assistant team leader field to teams
ALTER TABLE public.teams 
ADD COLUMN assistant_team_leader_id uuid REFERENCES public.employee_master_data(id);

-- Add comment for clarity
COMMENT ON COLUMN public.teams.assistant_team_leader_id IS 'Reference to employee serving as assistant team leader';