-- Fix the UPDATE policy on contract_signatures
-- The issue is that the current policy only allows updating rows where signed_at IS NULL
-- but when we SET signed_at to a value, it violates the policy because the check happens on the new row

-- Drop the problematic policy
DROP POLICY IF EXISTS "Anyone can sign pending contract signatures" ON contract_signatures;

-- Create a fixed policy that allows updating unsigned signatures to signed
CREATE POLICY "Employees can sign their pending signatures"
ON contract_signatures
FOR UPDATE
USING (
  -- Can only update unsigned signatures for the current employee
  signed_at IS NULL 
  AND signer_employee_id = get_current_employee_id()
)
WITH CHECK (
  -- Allow setting signed_at to non-null and updating related fields
  signed_at IS NOT NULL
);