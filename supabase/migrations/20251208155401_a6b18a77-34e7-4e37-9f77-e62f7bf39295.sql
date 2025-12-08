-- Drop the existing policy and recreate with teamleder access
DROP POLICY IF EXISTS "Admin and planners can manage bookings" ON public.booking;

CREATE POLICY "Admin planners and teamledere can manage bookings"
ON public.booking
FOR ALL
TO authenticated
USING (
  is_vagt_admin_or_planner(auth.uid()) 
  OR is_teamleder_or_above(auth.uid())
)
WITH CHECK (
  is_vagt_admin_or_planner(auth.uid()) 
  OR is_teamleder_or_above(auth.uid())
);