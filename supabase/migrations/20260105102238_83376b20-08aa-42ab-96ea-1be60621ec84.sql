-- Allow anonymous users to view basic employee info by referral code (for public referral form)
CREATE POLICY "Public can view referrer by referral code"
ON public.employee_master_data
FOR SELECT
TO anon
USING (
  referral_code IS NOT NULL 
  AND is_active = true
);