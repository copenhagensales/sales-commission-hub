-- Allow rekruttering role to update employee_master_data
CREATE POLICY "Rekruttering can update employees"
ON public.employee_master_data
FOR UPDATE
USING (is_rekruttering(auth.uid()))
WITH CHECK (is_rekruttering(auth.uid()));