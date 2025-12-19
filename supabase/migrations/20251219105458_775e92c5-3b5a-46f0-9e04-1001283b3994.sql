-- Drop the overly permissive policy that allows anyone to view pending signatures
DROP POLICY IF EXISTS "Anyone can view pending contract signatures" ON public.contract_signatures;

-- Create a new, more restrictive policy for viewing pending signatures
-- Only allows the specific signer (by email match) to view their own pending signature
CREATE POLICY "Signers can view their own pending signatures"
ON public.contract_signatures
FOR SELECT
USING (
  signed_at IS NULL 
  AND (
    -- Match by employee ID if authenticated
    signer_employee_id = get_current_employee_id()
    -- Or match by email from JWT
    OR lower(signer_email) = lower((auth.jwt() ->> 'email'::text))
  )
);