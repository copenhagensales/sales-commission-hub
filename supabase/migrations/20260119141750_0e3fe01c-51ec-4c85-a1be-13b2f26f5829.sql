-- Add INSERT policy allowing owners and recruiters to create referrals on behalf of others
CREATE POLICY "Owners and recruiters can create referrals" 
ON public.employee_referrals
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_owner(auth.uid())
  OR 
  public.is_rekruttering(auth.uid())
);

-- Sync system_roles for all active employees with job_title = 'Rekruttering' who are missing the role
INSERT INTO public.system_roles (user_id, role)
SELECT e.auth_user_id, 'rekruttering'::system_role
FROM public.employee_master_data e
WHERE e.job_title = 'Rekruttering'
  AND e.auth_user_id IS NOT NULL
  AND e.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.system_roles sr 
    WHERE sr.user_id = e.auth_user_id 
    AND sr.role = 'rekruttering'
  )
ON CONFLICT (user_id, role) DO NOTHING;