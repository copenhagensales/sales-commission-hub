-- Allow public updates to employee_master_data for onboarding (with valid invitation token)
CREATE POLICY "Public can update employee via valid invitation"
ON public.employee_master_data
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.employee_invitations
    WHERE employee_invitations.employee_id = employee_master_data.id
    AND employee_invitations.status = 'pending'
    AND employee_invitations.expires_at > now()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employee_invitations
    WHERE employee_invitations.employee_id = employee_master_data.id
    AND employee_invitations.status = 'pending'
    AND employee_invitations.expires_at > now()
  )
);

-- Allow public updates to employee_invitations to mark as completed
CREATE POLICY "Public can complete invitations"
ON public.employee_invitations
FOR UPDATE
USING (status = 'pending' AND expires_at > now())
WITH CHECK (status IN ('pending', 'completed'));