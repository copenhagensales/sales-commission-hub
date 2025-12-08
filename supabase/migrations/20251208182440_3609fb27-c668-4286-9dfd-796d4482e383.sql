-- Update the save_integration_secret function to use extensions schema for pgcrypto
CREATE OR REPLACE FUNCTION public.save_integration_secret(
  p_client_id uuid, 
  p_crm_type crm_type, 
  p_api_url text, 
  p_secret_json jsonb, 
  p_encryption_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.customer_integrations (client_id, crm_type, api_url, encrypted_credentials)
  VALUES (
    p_client_id, 
    p_crm_type, 
    p_api_url, 
    extensions.pgp_sym_encrypt(p_secret_json::text, p_encryption_key)
  )
  ON CONFLICT (client_id) 
  DO UPDATE SET 
    crm_type = EXCLUDED.crm_type,
    api_url = EXCLUDED.api_url,
    encrypted_credentials = extensions.pgp_sym_encrypt(p_secret_json::text, p_encryption_key),
    updated_at = now()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$function$;

-- Also update the get_decrypted_integration function
CREATE OR REPLACE FUNCTION public.get_decrypted_integration(p_client_id uuid, p_encryption_key text)
RETURNS TABLE(id uuid, crm_type crm_type, api_url text, credentials jsonb, config jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    ci.id,
    ci.crm_type,
    ci.api_url,
    extensions.pgp_sym_decrypt(ci.encrypted_credentials::bytea, p_encryption_key)::jsonb as credentials,
    ci.config
  FROM public.customer_integrations ci
  WHERE ci.client_id = p_client_id AND ci.is_active = true;
END;
$function$;