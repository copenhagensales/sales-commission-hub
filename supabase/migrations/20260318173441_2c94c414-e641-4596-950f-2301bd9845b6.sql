
-- Create a generic audit log trigger function for AMO tables
CREATE OR REPLACE FUNCTION public.amo_audit_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_old_values jsonb;
  v_new_values jsonb;
  v_record_id text;
BEGIN
  -- Get current user info
  v_user_id := auth.uid();
  
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  IF TG_OP = 'DELETE' THEN
    v_old_values := to_jsonb(OLD);
    v_new_values := NULL;
    v_record_id := OLD.id::text;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
    v_record_id := NEW.id::text;
  ELSIF TG_OP = 'INSERT' THEN
    v_old_values := NULL;
    v_new_values := to_jsonb(NEW);
    v_record_id := NEW.id::text;
  END IF;

  INSERT INTO public.amo_audit_log (
    action, table_name, record_id, user_id, user_email, old_values, new_values
  ) VALUES (
    TG_OP, TG_TABLE_NAME, v_record_id, v_user_id, v_user_email, v_old_values, v_new_values
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach triggers to all AMO tables
CREATE TRIGGER amo_audit_workplaces
  AFTER INSERT OR UPDATE OR DELETE ON public.amo_workplaces
  FOR EACH ROW EXECUTE FUNCTION public.amo_audit_trigger_fn();

CREATE TRIGGER amo_audit_members
  AFTER INSERT OR UPDATE OR DELETE ON public.amo_members
  FOR EACH ROW EXECUTE FUNCTION public.amo_audit_trigger_fn();

CREATE TRIGGER amo_audit_meetings
  AFTER INSERT OR UPDATE OR DELETE ON public.amo_meetings
  FOR EACH ROW EXECUTE FUNCTION public.amo_audit_trigger_fn();

CREATE TRIGGER amo_audit_annual_discussions
  AFTER INSERT OR UPDATE OR DELETE ON public.amo_annual_discussions
  FOR EACH ROW EXECUTE FUNCTION public.amo_audit_trigger_fn();

CREATE TRIGGER amo_audit_apv
  AFTER INSERT OR UPDATE OR DELETE ON public.amo_apv
  FOR EACH ROW EXECUTE FUNCTION public.amo_audit_trigger_fn();

CREATE TRIGGER amo_audit_kemi_apv
  AFTER INSERT OR UPDATE OR DELETE ON public.amo_kemi_apv
  FOR EACH ROW EXECUTE FUNCTION public.amo_audit_trigger_fn();

CREATE TRIGGER amo_audit_training
  AFTER INSERT OR UPDATE OR DELETE ON public.amo_training_courses
  FOR EACH ROW EXECUTE FUNCTION public.amo_audit_trigger_fn();

CREATE TRIGGER amo_audit_documents
  AFTER INSERT OR UPDATE OR DELETE ON public.amo_documents
  FOR EACH ROW EXECUTE FUNCTION public.amo_audit_trigger_fn();

CREATE TRIGGER amo_audit_tasks
  AFTER INSERT OR UPDATE OR DELETE ON public.amo_tasks
  FOR EACH ROW EXECUTE FUNCTION public.amo_audit_trigger_fn();

CREATE TRIGGER amo_audit_amr_elections
  AFTER INSERT OR UPDATE OR DELETE ON public.amo_amr_elections
  FOR EACH ROW EXECUTE FUNCTION public.amo_audit_trigger_fn();

CREATE TRIGGER amo_audit_compliance_rules
  AFTER INSERT OR UPDATE OR DELETE ON public.amo_compliance_rules
  FOR EACH ROW EXECUTE FUNCTION public.amo_audit_trigger_fn();
