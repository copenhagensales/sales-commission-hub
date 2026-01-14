-- RLS policy for team leaders to view team H2H challenges
CREATE POLICY "Team leaders can view team challenges"
ON public.h2h_challenges FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM team_members tm
    JOIN teams t ON tm.team_id = t.id
    WHERE (
      t.team_leader_id = get_current_employee_id()
      OR t.assistant_team_leader_id = get_current_employee_id()
    )
    AND (
      tm.employee_id = h2h_challenges.challenger_employee_id
      OR tm.employee_id = h2h_challenges.opponent_employee_id
    )
  )
);