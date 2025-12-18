
-- Drop the existing policy
DROP POLICY IF EXISTS "Employees can view own record by email" ON employee_master_data;

-- Recreate with case-insensitive matching
CREATE POLICY "Employees can view own record by email"
ON employee_master_data
FOR SELECT
TO authenticated
USING (
  LOWER(private_email) = LOWER(auth.jwt() ->> 'email')
  OR LOWER(work_email) = LOWER(auth.jwt() ->> 'email')
);
