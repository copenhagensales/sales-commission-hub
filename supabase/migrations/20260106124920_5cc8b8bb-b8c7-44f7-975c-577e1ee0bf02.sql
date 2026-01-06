-- ===========================================
-- SECURITY FIX: Employee Referrals RLS (1.2)
-- ===========================================

-- Drop the insecure anonymous policies
DROP POLICY IF EXISTS "Anyone can create referrals" ON employee_referrals;
DROP POLICY IF EXISTS "Anon can view referrals they just created" ON employee_referrals;

-- Create secure policies for authenticated users
CREATE POLICY "Authenticated employees can view own referrals"
  ON employee_referrals
  FOR SELECT
  TO authenticated
  USING (
    referrer_employee_id IN (
      SELECT id FROM employee_master_data 
      WHERE auth_user_id = auth.uid()
    )
    OR 
    is_rekruttering(auth.uid()) OR is_teamleder_or_above(auth.uid())
  );

CREATE POLICY "Authenticated employees can create own referrals"
  ON employee_referrals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    referrer_employee_id IN (
      SELECT id FROM employee_master_data 
      WHERE auth_user_id = auth.uid()
    )
  );

-- ===========================================
-- SECURITY FIX: Single-use Invitation Tokens (2.1)
-- ===========================================

-- Add used_at column to track when token was used
ALTER TABLE employee_invitations 
ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

-- Update RLS policy to prevent reuse of tokens
DROP POLICY IF EXISTS "Public can complete invitations" ON employee_invitations;

CREATE POLICY "Public can complete unused invitations"
  ON employee_invitations
  FOR UPDATE
  TO anon
  USING (
    status = 'pending' 
    AND expires_at > now() 
    AND used_at IS NULL
  )
  WITH CHECK (
    status IN ('pending', 'completed')
  );

-- ===========================================
-- SECURITY FIX: Shorter Token Expiry (2.2)
-- ===========================================

-- Update default expiry to 48 hours instead of 7 days
ALTER TABLE employee_invitations 
ALTER COLUMN expires_at SET DEFAULT (now() + interval '48 hours');