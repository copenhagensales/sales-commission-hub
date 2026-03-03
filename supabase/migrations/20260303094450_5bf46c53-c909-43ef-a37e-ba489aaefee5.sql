CREATE POLICY "Authenticated users can delete own confirmations"
ON public.vehicle_return_confirmation
FOR DELETE
TO authenticated
USING (employee_id = get_current_employee_id());