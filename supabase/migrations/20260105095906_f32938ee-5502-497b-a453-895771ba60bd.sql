-- Fix function search_path for generate_referral_code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;