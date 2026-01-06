-- 1. Drop den eksisterende funktion først (pga. ændret return type)
DROP FUNCTION IF EXISTS public.get_invitation_by_token_v2(text);

-- 2. Opret den nye sikre version der IKKE returnerer sensitive data
CREATE OR REPLACE FUNCTION public.get_invitation_by_token_v2(_token text)
RETURNS TABLE (
  id uuid,
  employee_id uuid,
  email text,
  status text,
  expires_at timestamptz,
  first_name text,
  last_name text,
  password_set_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.employee_id,
    i.email,
    i.status,
    i.expires_at,
    e.first_name,
    e.last_name,
    i.password_set_at
  FROM employee_invitations i
  JOIN employee_master_data e ON e.id = i.employee_id
  WHERE i.token = _token;
END;
$$;

-- 3. Drop complete_onboarding funktionen da vi ikke længere bruger den
DROP FUNCTION IF EXISTS public.complete_onboarding(text, text, text, text, text, text, text, text, text);

-- 4. Tilføj kolonne til at tracke om onboarding data er udfyldt (if not exists)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employee_master_data' AND column_name = 'onboarding_data_complete') THEN
    ALTER TABLE public.employee_master_data ADD COLUMN onboarding_data_complete boolean DEFAULT false;
  END IF;
END $$;

-- 5. Tilføj RLS policy så brugere kan opdatere deres egne sensitive data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'employee_master_data' 
    AND policyname = 'Users can update own sensitive data'
  ) THEN
    CREATE POLICY "Users can update own sensitive data"
    ON public.employee_master_data
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = auth_user_id)
    WITH CHECK (auth.uid() = auth_user_id);
  END IF;
END $$;