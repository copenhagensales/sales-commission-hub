CREATE POLICY "FM employees can view own FM sale_items"
ON public.sale_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sales s
    JOIN employee_master_data e 
      ON LOWER(s.agent_email) = LOWER(e.work_email)
    WHERE s.id = sale_items.sale_id
      AND s.source = 'fieldmarketing'
      AND e.auth_user_id = auth.uid()
      AND e.is_active = true
  )
);