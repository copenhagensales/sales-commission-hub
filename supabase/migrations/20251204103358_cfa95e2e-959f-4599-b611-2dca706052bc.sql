-- Allow all authenticated users to view absences (for the employee list view)
DROP POLICY IF EXISTS "Admin and planners can view all absences" ON public.employee_absence;

CREATE POLICY "Authenticated users can view absences" 
ON public.employee_absence 
FOR SELECT 
TO authenticated
USING (true);