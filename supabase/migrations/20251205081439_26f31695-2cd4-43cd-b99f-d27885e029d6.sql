-- Drop the problematic policies that cause recursion
DROP POLICY IF EXISTS "Anyone can view contracts with pending signature for them" ON public.contracts;
DROP POLICY IF EXISTS "Anyone can sign pending contracts" ON public.contract_signatures;

-- Create a security definer function to check if a contract has pending signatures
CREATE OR REPLACE FUNCTION public.contract_has_pending_signature(contract_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM contract_signatures
    WHERE contract_id = contract_uuid AND signed_at IS NULL
  )
$$;

-- Create simpler policies that use the function instead of direct subquery
CREATE POLICY "Anyone can view contracts with pending signatures"
ON public.contracts
FOR SELECT
USING (public.contract_has_pending_signature(id));

-- Allow viewing contract_signatures for contracts with pending signatures  
CREATE POLICY "Anyone can view pending contract signatures"
ON public.contract_signatures
FOR SELECT
USING (signed_at IS NULL);

-- Allow updating contract_signatures to sign them
CREATE POLICY "Anyone can sign pending contract signatures"
ON public.contract_signatures
FOR UPDATE
USING (signed_at IS NULL);