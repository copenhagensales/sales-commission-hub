-- Create function to insert dialer integration with encrypted credentials
CREATE OR REPLACE FUNCTION public.create_dialer_integration(
  p_name TEXT,
  p_provider TEXT,
  p_credentials TEXT,
  p_encryption_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.dialer_integrations (name, provider, encrypted_credentials)
  VALUES (
    p_name,
    p_provider,
    extensions.pgp_sym_encrypt(p_credentials, p_encryption_key)
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Create function to update dialer credentials
CREATE OR REPLACE FUNCTION public.update_dialer_credentials(
  p_integration_id UUID,
  p_credentials TEXT,
  p_encryption_key TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public.dialer_integrations
  SET encrypted_credentials = extensions.pgp_sym_encrypt(p_credentials, p_encryption_key),
      updated_at = now()
  WHERE id = p_integration_id;
END;
$$;

-- Create function to get decrypted dialer credentials
CREATE OR REPLACE FUNCTION public.get_dialer_credentials(
  p_integration_id UUID,
  p_encryption_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_credentials TEXT;
BEGIN
  SELECT extensions.pgp_sym_decrypt(encrypted_credentials::bytea, p_encryption_key)
  INTO v_credentials
  FROM public.dialer_integrations
  WHERE id = p_integration_id AND is_active = true;
  
  RETURN v_credentials::jsonb;
END;
$$;