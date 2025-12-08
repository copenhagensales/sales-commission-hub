-- Allow teamledere to update and insert time stamps for their team members
CREATE POLICY "Teamledere can manage team time stamps" 
ON public.time_stamps 
FOR ALL
USING (is_teamleder_or_above(auth.uid()) AND can_view_employee(employee_id, auth.uid()))
WITH CHECK (is_teamleder_or_above(auth.uid()) AND can_view_employee(employee_id, auth.uid()));