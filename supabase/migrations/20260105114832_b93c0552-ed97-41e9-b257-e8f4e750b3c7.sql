-- Allow anon users to select their just-inserted referral (needed for insert().select().single())
CREATE POLICY "Anon can view referrals they just created"
ON employee_referrals
FOR SELECT
TO anon
USING (true);