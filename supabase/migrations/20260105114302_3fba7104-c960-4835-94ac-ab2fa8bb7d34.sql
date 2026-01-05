-- Drop the old policy that only works for authenticated users
DROP POLICY IF EXISTS "Anyone can create referrals" ON employee_referrals;

-- Create new policy that explicitly allows both anon and authenticated users to insert
CREATE POLICY "Anyone can create referrals" 
ON employee_referrals 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);