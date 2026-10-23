ALTER TABLE public.push_log ADD COLUMN IF NOT EXISTS status_code integer, ADD COLUMN IF NOT EXISTS error_text text;
COMMENT ON COLUMN public.push_log.status_code IS 'HTTP-status fra push-tjenesten (fx 201, 410) for seneste forsøg';
COMMENT ON COLUMN public.push_log.error_text IS 'Kort fejltekst fra push-tjenesten (maks 200 tegn), aldrig persondata';