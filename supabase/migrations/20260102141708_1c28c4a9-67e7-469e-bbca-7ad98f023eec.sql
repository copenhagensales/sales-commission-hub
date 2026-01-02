
-- Allow employees to view agents they are mapped to
CREATE POLICY "Employees can view their mapped agents"
ON public.agents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM employee_agent_mapping eam
    WHERE eam.agent_id = agents.id
    AND eam.employee_id = get_current_employee_id()
  )
);
