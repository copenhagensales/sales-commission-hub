-- Drop og genskab politikken med WITH CHECK for at tillade teamledere at oprette fravær
DROP POLICY IF EXISTS "Teamledere can manage team absence requests" ON absence_request_v2;

CREATE POLICY "Teamledere can manage team absence requests"
ON absence_request_v2
FOR ALL
TO public
USING (
  is_teamleder_or_above(auth.uid()) 
  AND can_view_employee(employee_id, auth.uid())
)
WITH CHECK (
  is_teamleder_or_above(auth.uid()) 
  AND can_view_employee(employee_id, auth.uid())
);