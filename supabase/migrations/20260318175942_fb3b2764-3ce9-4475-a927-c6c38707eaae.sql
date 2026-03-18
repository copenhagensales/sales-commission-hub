
CREATE OR REPLACE FUNCTION public.amo_audit_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_record_id uuid;
  v_user_id uuid;
  v_user_email text;
  v_old_values jsonb;
  v_new_values jsonb;
BEGIN
  v_user_id := auth.uid();
  v_user_email := (SELECT email FROM auth.users WHERE id = v_user_id);

  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id;
    v_old_values := to_jsonb(OLD);
    v_new_values := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_record_id := NEW.id;
    v_old_values := NULL;
    v_new_values := to_jsonb(NEW);
  ELSE
    v_record_id := NEW.id;
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
  END IF;

  INSERT INTO public.amo_audit_log (
    action, table_name, record_id, user_id, user_email, old_values, new_values
  ) VALUES (
    TG_OP, TG_TABLE_NAME, v_record_id::uuid, v_user_id, v_user_email, v_old_values, v_new_values
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
