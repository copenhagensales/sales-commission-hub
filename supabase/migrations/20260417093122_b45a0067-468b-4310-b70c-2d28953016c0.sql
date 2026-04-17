-- Add quiz_variant column to all 3 CoC tables
ALTER TABLE public.code_of_conduct_completions 
  ADD COLUMN IF NOT EXISTS quiz_variant text NOT NULL DEFAULT 'salgskonsulent';

ALTER TABLE public.code_of_conduct_attempts 
  ADD COLUMN IF NOT EXISTS quiz_variant text NOT NULL DEFAULT 'salgskonsulent';

ALTER TABLE public.code_of_conduct_reminders 
  ADD COLUMN IF NOT EXISTS quiz_variant text NOT NULL DEFAULT 'salgskonsulent';

-- Add CHECK constraints for valid variants
ALTER TABLE public.code_of_conduct_completions 
  DROP CONSTRAINT IF EXISTS coc_completions_variant_check;
ALTER TABLE public.code_of_conduct_completions 
  ADD CONSTRAINT coc_completions_variant_check 
  CHECK (quiz_variant IN ('salgskonsulent', 'fieldmarketing'));

ALTER TABLE public.code_of_conduct_attempts 
  DROP CONSTRAINT IF EXISTS coc_attempts_variant_check;
ALTER TABLE public.code_of_conduct_attempts 
  ADD CONSTRAINT coc_attempts_variant_check 
  CHECK (quiz_variant IN ('salgskonsulent', 'fieldmarketing'));

ALTER TABLE public.code_of_conduct_reminders 
  DROP CONSTRAINT IF EXISTS coc_reminders_variant_check;
ALTER TABLE public.code_of_conduct_reminders 
  ADD CONSTRAINT coc_reminders_variant_check 
  CHECK (quiz_variant IN ('salgskonsulent', 'fieldmarketing'));

-- Drop old unique constraint on completions(employee_id) if it exists, replace with (employee_id, quiz_variant)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.code_of_conduct_completions'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.code_of_conduct_completions DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.code_of_conduct_completions 
  ADD CONSTRAINT coc_completions_employee_variant_unique 
  UNIQUE (employee_id, quiz_variant);

-- Update RPC to accept optional variant parameter
CREATE OR REPLACE FUNCTION public.has_valid_code_of_conduct_completion(
  _user_id uuid DEFAULT auth.uid(),
  _variant text DEFAULT NULL
)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_email text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = _user_id LIMIT 1;

  RETURN EXISTS (
    SELECT 1
    FROM public.code_of_conduct_completions c
    WHERE c.passed_at > now() - interval '60 days'
      AND (_variant IS NULL OR c.quiz_variant = _variant)
      AND c.employee_id IN (
        SELECT id FROM public.employee_master_data WHERE auth_user_id = _user_id
        UNION
        SELECT id FROM public.employee_master_data
        WHERE v_email IS NOT NULL
          AND (lower(private_email) = lower(v_email) OR lower(work_email) = lower(v_email))
      )
  );
END;
$function$;

-- Update auto_acknowledge_coc_reminders trigger to be variant-aware
CREATE OR REPLACE FUNCTION public.auto_acknowledge_coc_reminders()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.code_of_conduct_reminders
  SET acknowledged_at = now()
  WHERE employee_id = NEW.employee_id
    AND quiz_variant = NEW.quiz_variant
    AND acknowledged_at IS NULL;
  RETURN NEW;
END;
$function$;