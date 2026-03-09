CREATE POLICY "Some role can view candidates"
ON public.candidates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.system_roles
    WHERE user_id = auth.uid() AND role = 'some'
  )
  OR EXISTS (
    SELECT 1 FROM public.employee_master_data
    WHERE auth_user_id = auth.uid()
      AND is_active = true
      AND LOWER(job_title) = 'some'
  )
);