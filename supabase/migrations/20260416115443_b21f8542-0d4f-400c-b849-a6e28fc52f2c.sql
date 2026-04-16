DROP TRIGGER IF EXISTS trg_auto_enroll_application ON public.applications;
DROP FUNCTION IF EXISTS public.auto_enroll_new_application();

CREATE OR REPLACE FUNCTION public.auto_enroll_new_candidate()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.booking_flow_enrollments (
    candidate_id, tier, status, approval_status
  ) VALUES (
    NEW.id, 'A', 'pending_approval', 'pending'
  ) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE TRIGGER trg_auto_enroll_candidate
AFTER INSERT ON public.candidates
FOR EACH ROW EXECUTE FUNCTION public.auto_enroll_new_candidate();