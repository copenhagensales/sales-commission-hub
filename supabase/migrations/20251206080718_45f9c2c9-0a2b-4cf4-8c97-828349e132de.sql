
-- Create helper function to check if user is rekruttering
CREATE OR REPLACE FUNCTION public.is_rekruttering(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.system_roles
    WHERE user_id = _user_id AND role = 'rekruttering'
  )
$$;

-- Update employee_master_data policies to allow rekruttering to view and insert
CREATE POLICY "Rekruttering can view all employee data"
ON public.employee_master_data
FOR SELECT
USING (is_rekruttering(auth.uid()));

CREATE POLICY "Rekruttering can insert employees"
ON public.employee_master_data
FOR INSERT
WITH CHECK (is_rekruttering(auth.uid()));

-- Update contracts policies to allow rekruttering to view and send (insert) but not update content
CREATE POLICY "Rekruttering can view all contracts"
ON public.contracts
FOR SELECT
USING (is_rekruttering(auth.uid()));

CREATE POLICY "Rekruttering can send contracts"
ON public.contracts
FOR INSERT
WITH CHECK (is_rekruttering(auth.uid()));

-- Allow rekruttering to view contract templates
CREATE POLICY "Rekruttering can view contract templates"
ON public.contract_templates
FOR SELECT
USING (is_rekruttering(auth.uid()));

-- Allow rekruttering to manage contract signatures (for sending)
CREATE POLICY "Rekruttering can manage signatures"
ON public.contract_signatures
FOR ALL
USING (is_rekruttering(auth.uid()))
WITH CHECK (is_rekruttering(auth.uid()));
