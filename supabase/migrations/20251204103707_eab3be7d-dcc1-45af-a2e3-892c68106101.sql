-- Allow authenticated users to delete absences (for toggling off)
CREATE POLICY "Authenticated users can delete absences" 
ON public.employee_absence 
FOR DELETE 
TO authenticated
USING (true);