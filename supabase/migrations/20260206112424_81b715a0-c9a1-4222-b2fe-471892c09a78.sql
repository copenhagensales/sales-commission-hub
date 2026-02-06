-- Allow employees to update their own sale_items (for immediate payment)
-- This policy works alongside the existing manager policy (both are PERMISSIVE)
CREATE POLICY "Employees can update own immediate payment"
ON public.sale_items
FOR UPDATE
TO authenticated
USING (can_view_sale_as_employee(sale_id, auth.uid()))
WITH CHECK (can_view_sale_as_employee(sale_id, auth.uid()));