-- Drop existing insert policy and create a more permissive one for admins/planners
DROP POLICY IF EXISTS "Admin and planners can manage absences" ON public.employee_absence;

-- Recreate the ALL policy for admins/planners
CREATE POLICY "Admin and planners can manage absences" 
ON public.employee_absence 
FOR ALL 
TO authenticated
USING (is_vagt_admin_or_planner(auth.uid()))
WITH CHECK (is_vagt_admin_or_planner(auth.uid()));

-- Also allow any authenticated user to insert absence (planners create absences for employees)
CREATE POLICY "Authenticated users can insert absences" 
ON public.employee_absence 
FOR INSERT 
TO authenticated
WITH CHECK (true);