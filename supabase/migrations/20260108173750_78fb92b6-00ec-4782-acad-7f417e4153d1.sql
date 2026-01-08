-- Allow employees to view their own sales via agent mapping
CREATE POLICY "Employees can view own sales" ON sales
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM employee_agent_mapping eam
    JOIN agents a ON eam.agent_id = a.id
    JOIN employee_master_data e ON eam.employee_id = e.id
    WHERE e.auth_user_id = auth.uid()
    AND (
      LOWER(sales.agent_email) = LOWER(a.email)
      OR sales.agent_external_id = a.external_dialer_id
    )
  )
);

-- Also allow employees to view sale_items for their own sales
CREATE POLICY "Employees can view own sale_items" ON sale_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM sales s
    JOIN employee_agent_mapping eam ON (
      LOWER(s.agent_email) = LOWER((SELECT email FROM agents WHERE id = eam.agent_id))
      OR s.agent_external_id = (SELECT external_dialer_id FROM agents WHERE id = eam.agent_id)
    )
    JOIN employee_master_data e ON eam.employee_id = e.id
    WHERE e.auth_user_id = auth.uid()
    AND sale_items.sale_id = s.id
  )
);