
DROP POLICY IF EXISTS "FM sellers can view own fieldmarketing sales" ON sales;

CREATE POLICY "FM sellers can view all fieldmarketing sales"
ON sales FOR SELECT
USING (
  source = 'fieldmarketing'
  AND EXISTS (
    SELECT 1 FROM employee_master_data
    WHERE auth_user_id = auth.uid()
    AND is_active = true
  )
);
