-- Create employee_referrals table for the referral program
CREATE TABLE public.employee_referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  candidate_first_name TEXT NOT NULL,
  candidate_last_name TEXT NOT NULL,
  candidate_email TEXT NOT NULL,
  candidate_phone TEXT,
  referrer_name_provided TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'hired', 'eligible_for_bonus', 'bonus_paid', 'rejected')),
  hired_date TIMESTAMP WITH TIME ZONE,
  bonus_eligible_date TIMESTAMP WITH TIME ZONE,
  bonus_paid_date TIMESTAMP WITH TIME ZONE,
  bonus_amount NUMERIC DEFAULT 3000,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create trigger for updated_at on employee_referrals
CREATE TRIGGER update_employee_referrals_updated_at
  BEFORE UPDATE ON public.employee_referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on employee_referrals
ALTER TABLE public.employee_referrals ENABLE ROW LEVEL SECURITY;

-- Policy: Employees can view their own referrals
CREATE POLICY "Employees can view their own referrals"
  ON public.employee_referrals
  FOR SELECT
  USING (
    referrer_employee_id IN (
      SELECT id FROM public.employee_master_data WHERE auth_user_id = auth.uid()
    )
  );

-- Policy: Anyone can insert referrals (public form)
CREATE POLICY "Anyone can create referrals"
  ON public.employee_referrals
  FOR INSERT
  WITH CHECK (true);

-- Policy: Owners and recruiters can view all referrals
CREATE POLICY "Owners and recruiters can view all referrals"
  ON public.employee_referrals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.system_roles sr
      WHERE sr.user_id = auth.uid()
      AND sr.role IN ('ejer', 'rekruttering')
    )
  );

-- Policy: Owners and recruiters can update referrals
CREATE POLICY "Owners and recruiters can update referrals"
  ON public.employee_referrals
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.system_roles sr
      WHERE sr.user_id = auth.uid()
      AND sr.role IN ('ejer', 'rekruttering')
    )
  );

-- Policy: Owners can delete referrals
CREATE POLICY "Owners can delete referrals"
  ON public.employee_referrals
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.system_roles sr
      WHERE sr.user_id = auth.uid()
      AND sr.role = 'ejer'
    )
  );

-- Add index for faster lookups
CREATE INDEX idx_employee_referrals_referrer ON public.employee_referrals(referrer_employee_id);
CREATE INDEX idx_employee_referrals_status ON public.employee_referrals(status);
CREATE INDEX idx_employee_referrals_code ON public.employee_referrals(referral_code);

-- Add referral_code column to employee_master_data if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employee_master_data' 
    AND column_name = 'referral_code'
  ) THEN
    ALTER TABLE public.employee_master_data ADD COLUMN referral_code TEXT UNIQUE;
  END IF;
END $$;

-- Create function to generate unique referral codes
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  IF NEW.referral_code IS NULL THEN
    LOOP
      new_code := UPPER(
        SUBSTRING(COALESCE(NEW.first_name, 'REF'), 1, 3) || 
        SUBSTRING(md5(random()::text), 1, 5)
      );
      
      SELECT EXISTS(SELECT 1 FROM public.employee_master_data WHERE referral_code = new_code) INTO code_exists;
      
      IF NOT code_exists THEN
        NEW.referral_code := new_code;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS set_referral_code ON public.employee_master_data;

-- Create trigger to auto-generate referral code for new employees
CREATE TRIGGER set_referral_code
  BEFORE INSERT ON public.employee_master_data
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_referral_code();

-- Generate referral codes for existing employees without one
UPDATE public.employee_master_data
SET referral_code = UPPER(
  SUBSTRING(COALESCE(first_name, 'REF'), 1, 3) || 
  SUBSTRING(md5(id::text || random()::text), 1, 5)
)
WHERE referral_code IS NULL;

-- Add index for referral code lookups
CREATE INDEX IF NOT EXISTS idx_employee_master_data_referral_code ON public.employee_master_data(referral_code);