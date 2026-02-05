-- 1. Create junction table for multiple assistant team leaders per team
CREATE TABLE public.team_assistant_leaders (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (team_id, employee_id)
);

-- 2. Add index for faster lookups by employee
CREATE INDEX idx_team_assistant_leaders_employee ON public.team_assistant_leaders(employee_id);

-- 3. Migrate existing data from assistant_team_leader_id column
INSERT INTO public.team_assistant_leaders (team_id, employee_id)
SELECT id, assistant_team_leader_id
FROM public.teams
WHERE assistant_team_leader_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 4. Enable Row Level Security
ALTER TABLE public.team_assistant_leaders ENABLE ROW LEVEL SECURITY;

-- 5. RLS policy: Authenticated users can read
CREATE POLICY "Authenticated users can read team assistant leaders"
  ON public.team_assistant_leaders
  FOR SELECT
  TO authenticated
  USING (true);

-- 6. RLS policy: Users with edit permission can insert
CREATE POLICY "Users with edit permission can insert team assistant leaders"
  ON public.team_assistant_leaders
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_edit_permission(auth.uid(), 'tab_employees_teams'));

-- 7. RLS policy: Users with edit permission can update
CREATE POLICY "Users with edit permission can update team assistant leaders"
  ON public.team_assistant_leaders
  FOR UPDATE
  TO authenticated
  USING (public.has_edit_permission(auth.uid(), 'tab_employees_teams'));

-- 8. RLS policy: Users with edit permission can delete
CREATE POLICY "Users with edit permission can delete team assistant leaders"
  ON public.team_assistant_leaders
  FOR DELETE
  TO authenticated
  USING (public.has_edit_permission(auth.uid(), 'tab_employees_teams'));