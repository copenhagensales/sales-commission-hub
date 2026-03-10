
-- 1. Add is_confidential column
ALTER TABLE public.contracts ADD COLUMN is_confidential BOOLEAN DEFAULT false;

-- 2. Create security definer function to check confidential access
CREATE OR REPLACE FUNCTION public.can_access_confidential_contract(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id
      AND LOWER(email) IN ('km@copenhagensales.dk', 'mg@copenhagensales.dk')
  )
$$;

-- 3. Drop and recreate RLS policies with confidentiality filter

-- Owners: can manage all EXCEPT confidential (unless authorized)
DROP POLICY IF EXISTS "Owners can manage all contracts" ON public.contracts;
CREATE POLICY "Owners can manage all contracts"
  ON public.contracts FOR ALL
  TO authenticated
  USING (
    is_owner(auth.uid()) 
    AND (NOT is_confidential OR can_access_confidential_contract(auth.uid()))
  )
  WITH CHECK (
    is_owner(auth.uid()) 
    AND (NOT is_confidential OR can_access_confidential_contract(auth.uid()))
  );

-- Teamledere: can view team contracts EXCEPT confidential
DROP POLICY IF EXISTS "Teamledere can view team contracts" ON public.contracts;
CREATE POLICY "Teamledere can view team contracts"
  ON public.contracts FOR SELECT
  TO authenticated
  USING (
    is_teamleder_or_above(auth.uid()) 
    AND can_view_employee(employee_id, auth.uid())
    AND (NOT is_confidential OR can_access_confidential_contract(auth.uid()))
  );

-- Rekruttering: can view all contracts EXCEPT confidential
DROP POLICY IF EXISTS "Rekruttering can view all contracts" ON public.contracts;
CREATE POLICY "Rekruttering can view all contracts"
  ON public.contracts FOR SELECT
  TO authenticated
  USING (
    is_rekruttering(auth.uid())
    AND (NOT is_confidential OR can_access_confidential_contract(auth.uid()))
  );

-- Rekruttering: can send contracts (INSERT) - also filter confidential on WITH CHECK
DROP POLICY IF EXISTS "Rekruttering can send contracts" ON public.contracts;
CREATE POLICY "Rekruttering can send contracts"
  ON public.contracts FOR INSERT
  TO authenticated
  WITH CHECK (
    is_rekruttering(auth.uid())
    AND (NOT is_confidential OR can_access_confidential_contract(auth.uid()))
  );

-- Employees can ALWAYS view their own contracts (no confidential filter)
-- These policies remain unchanged
