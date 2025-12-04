-- Allow authenticated users to update absences (for toggling multi-day absences)
CREATE POLICY "Authenticated users can update absences" 
ON public.employee_absence 
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);