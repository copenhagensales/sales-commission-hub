-- Create RPC functions for customer_integrations encryption (replicating dialer pattern)

-- Function to create a new customer integration with encrypted credentials
CREATE OR REPLACE FUNCTION public.create_customer_integration(
  p_client_id uuid,
  p_crm_type crm_type,
  p_api_url text,
  p_credentials text,
  p_config jsonb,
  p_cron_schedule text,
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
  INSERT INTO public.customer_integrations (
    client_id, 
    crm_type, 
    api_url, 
    encrypted_credentials,
    config,
    cron_schedule,
    is_active
  )
  VALUES (
    p_client_id,
    p_crm_type,
    p_api_url,
    extensions.pgp_sym_encrypt(p_credentials, p_encryption_key),
    p_config,
    p_cron_schedule,
    false
  )
  ON CONFLICT (client_id) 
  DO UPDATE SET 
    crm_type = EXCLUDED.crm_type,
    api_url = EXCLUDED.api_url,
    encrypted_credentials = extensions.pgp_sym_encrypt(p_credentials, p_encryption_key),
    config = EXCLUDED.config,
    cron_schedule = EXCLUDED.cron_schedule,
    updated_at = now()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$function$;

-- Function to update customer integration credentials
CREATE OR REPLACE FUNCTION public.update_customer_credentials(
  p_client_id uuid,
  p_credentials text,
  p_encryption_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  UPDATE public.customer_integrations
  SET encrypted_credentials = extensions.pgp_sym_encrypt(p_credentials, p_encryption_key),
      updated_at = now()
  WHERE client_id = p_client_id;
END;
$function$;

-- Function to get decrypted customer credentials
CREATE OR REPLACE FUNCTION public.get_customer_credentials(
  p_client_id uuid,
  p_encryption_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_credentials TEXT;
BEGIN
  SELECT extensions.pgp_sym_decrypt(encrypted_credentials::bytea, p_encryption_key)
  INTO v_credentials
  FROM public.customer_integrations
  WHERE client_id = p_client_id AND is_active = true;
  
  RETURN v_credentials::jsonb;
END;
$function$;

-- Function to get full customer integration with decrypted credentials
CREATE OR REPLACE FUNCTION public.get_customer_integration_decrypted(
  p_client_id uuid,
  p_encryption_key text
)
RETURNS TABLE(
  id uuid,
  client_id uuid,
  crm_type crm_type,
  api_url text,
  credentials jsonb,
  config jsonb,
  cron_schedule text,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    ci.id,
    ci.client_id,
    ci.crm_type,
    ci.api_url,
    extensions.pgp_sym_decrypt(ci.encrypted_credentials::bytea, p_encryption_key)::jsonb as credentials,
    ci.config,
    ci.cron_schedule,
    ci.is_active
  FROM public.customer_integrations ci
  WHERE ci.client_id = p_client_id;
END;
$function$;