CREATE POLICY "FM sellers can view own fieldmarketing sales"
ON public.sales
FOR SELECT
TO authenticated
USING (
  source = 'fieldmarketing'
  AND agent_email = (
    SELECT work_email FROM employee_master_data
    WHERE auth_user_id = auth.uid()
    LIMIT 1
  )
);