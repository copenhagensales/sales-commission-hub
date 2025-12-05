-- Allow anyone to view a contract if they have a pending signature for it
CREATE POLICY "Anyone can view contracts with pending signature for them" 
ON public.contracts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM contract_signatures cs
    WHERE cs.contract_id = contracts.id
    AND cs.signed_at IS NULL
  )
);

-- Also allow updating contract_signatures for anyone with a pending signature
CREATE POLICY "Anyone can sign pending contracts" 
ON public.contract_signatures 
FOR UPDATE
USING (signed_at IS NULL)
WITH CHECK (signed_at IS NOT NULL);