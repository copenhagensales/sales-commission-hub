-- Create password_reset_tokens table for secure password resets
CREATE TABLE public.password_reset_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours'),
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster token lookups
CREATE INDEX idx_password_reset_tokens_hash ON public.password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_tokens_email ON public.password_reset_tokens(email);

-- Enable RLS
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can manage tokens (edge functions)
-- No direct user access needed

-- Create function to validate and consume a reset token
CREATE OR REPLACE FUNCTION public.validate_password_reset_token(_token_hash text)
RETURNS TABLE(id uuid, employee_id uuid, email text, expires_at timestamp with time zone, first_name text, last_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    prt.id,
    prt.employee_id,
    prt.email,
    prt.expires_at,
    emd.first_name,
    emd.last_name
  FROM password_reset_tokens prt
  LEFT JOIN employee_master_data emd ON emd.id = prt.employee_id
  WHERE prt.token_hash = _token_hash
    AND prt.used_at IS NULL
    AND prt.expires_at > now()
  LIMIT 1
$$;

-- Create function to mark token as used
CREATE OR REPLACE FUNCTION public.consume_password_reset_token(_token_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE password_reset_tokens
  SET used_at = now()
  WHERE token_hash = _token_hash
    AND used_at IS NULL
    AND expires_at > now();
  
  RETURN FOUND;
END;
$$;