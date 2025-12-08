-- 1. Habilitar extensión de encriptación
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Crear Enum para tipos de integración CRM
CREATE TYPE crm_type AS ENUM ('hubspot', 'salesforce', 'pipedrive', 'generic_api', 'excel');

-- 3. Tabla de Integraciones de Clientes (CON ENCRIPTACIÓN)
CREATE TABLE public.customer_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  crm_type crm_type NOT NULL,
  api_url TEXT,
  encrypted_credentials TEXT NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT false,
  cron_schedule TEXT DEFAULT '0 * * * *',
  last_run_at TIMESTAMPTZ,
  last_status TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id)
);

-- 4. Función para guardar credenciales encriptadas
CREATE OR REPLACE FUNCTION public.save_integration_secret(
  p_client_id UUID,
  p_crm_type crm_type,
  p_api_url TEXT,
  p_secret_json JSONB,
  p_encryption_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.customer_integrations (client_id, crm_type, api_url, encrypted_credentials)
  VALUES (
    p_client_id, 
    p_crm_type, 
    p_api_url, 
    pgp_sym_encrypt(p_secret_json::text, p_encryption_key)
  )
  ON CONFLICT (client_id) 
  DO UPDATE SET 
    crm_type = EXCLUDED.crm_type,
    api_url = EXCLUDED.api_url,
    encrypted_credentials = pgp_sym_encrypt(p_secret_json::text, p_encryption_key),
    updated_at = now()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- 5. Función para leer credenciales desencriptadas
CREATE OR REPLACE FUNCTION public.get_decrypted_integration(
  p_client_id UUID,
  p_encryption_key TEXT
)
RETURNS TABLE (
  id UUID,
  crm_type crm_type,
  api_url TEXT,
  credentials JSONB,
  config JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ci.id,
    ci.crm_type,
    ci.api_url,
    pgp_sym_decrypt(ci.encrypted_credentials::bytea, p_encryption_key)::jsonb as credentials,
    ci.config
  FROM public.customer_integrations ci
  WHERE ci.client_id = p_client_id AND ci.is_active = true;
END;
$$;

-- RLS
ALTER TABLE public.customer_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solo managers gestionan integraciones" 
ON public.customer_integrations 
FOR ALL 
USING (is_manager_or_above(auth.uid()));