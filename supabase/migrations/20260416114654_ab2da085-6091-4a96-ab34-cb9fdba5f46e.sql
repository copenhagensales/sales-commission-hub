CREATE OR REPLACE FUNCTION public.auto_enroll_new_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Auto-enroll every new application into the booking flow as pending approval
  INSERT INTO public.booking_flow_enrollments (
    candidate_id,
    application_id,
    tier,
    status,
    approval_status
  ) VALUES (
    NEW.candidate_id,
    NEW.id,
    'A',
    'pending_approval',
    'pending'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_enroll_application
AFTER INSERT ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.auto_enroll_new_application();
