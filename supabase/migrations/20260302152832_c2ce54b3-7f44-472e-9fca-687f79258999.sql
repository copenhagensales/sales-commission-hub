
CREATE POLICY "Teamledere can update their team employees"
ON public.employee_master_data
FOR UPDATE
TO authenticated
USING (
  is_teamleder_or_above(auth.uid())
  AND can_view_employee(id, auth.uid())
)
WITH CHECK (
  is_teamleder_or_above(auth.uid())
  AND can_view_employee(id, auth.uid())
);
