-- Allow league admins to view all H2H challenges for admin dashboard
CREATE POLICY "League admins can view all challenges"
ON h2h_challenges FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM employee_master_data emd
    JOIN job_positions jp ON LOWER(emd.job_title) = LOWER(jp.name)
    WHERE emd.auth_user_id = auth.uid()
      AND emd.is_active = true
      AND (jp.permissions->>'menu_league_admin')::boolean = true
  )
  OR
  -- Fallback: Ejer position always has access
  EXISTS (
    SELECT 1 
    FROM employee_master_data emd
    WHERE emd.auth_user_id = auth.uid()
      AND emd.is_active = true
      AND emd.job_title = 'Ejer'
  )
);