-- RPC: Check if current authenticated user has completed a specific pulse survey
-- Uses get_current_employee_id() to ensure consistency with RLS and edge function logic
CREATE OR REPLACE FUNCTION public.has_completed_pulse_survey(_survey_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id uuid;
BEGIN
  v_employee_id := public.get_current_employee_id();

  IF v_employee_id IS NULL OR _survey_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.pulse_survey_completions
    WHERE survey_id = _survey_id
      AND employee_id = v_employee_id
  );
END;
$$;

-- RPC: Get current employee's draft for a survey (consistency with RLS)
CREATE OR REPLACE FUNCTION public.get_pulse_survey_draft(_survey_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id uuid;
  v_draft jsonb;
BEGIN
  v_employee_id := public.get_current_employee_id();
  IF v_employee_id IS NULL OR _survey_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT draft_data INTO v_draft
  FROM public.pulse_survey_drafts
  WHERE survey_id = _survey_id AND employee_id = v_employee_id
  LIMIT 1;

  RETURN v_draft;
END;
$$;

-- RPC: Check dismissal state for current user
CREATE OR REPLACE FUNCTION public.get_pulse_survey_dismissal(_survey_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id uuid;
  v_is_staff boolean := false;
  v_dismissed_until timestamptz;
  v_dismissal_count integer := 0;
BEGIN
  v_employee_id := public.get_current_employee_id();
  IF v_employee_id IS NULL OR _survey_id IS NULL THEN
    RETURN jsonb_build_object('isDismissed', false, 'isStaff', false, 'employeeId', NULL, 'dismissalCount', 0);
  END IF;

  SELECT is_staff_employee INTO v_is_staff
  FROM public.employee_master_data
  WHERE id = v_employee_id;

  SELECT dismissed_until, dismissal_count
  INTO v_dismissed_until, v_dismissal_count
  FROM public.pulse_survey_dismissals
  WHERE survey_id = _survey_id AND employee_id = v_employee_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'isDismissed', COALESCE(v_dismissed_until > now(), false),
    'isStaff', COALESCE(v_is_staff, false),
    'employeeId', v_employee_id,
    'dismissalCount', COALESCE(v_dismissal_count, 0),
    'dismissedUntil', v_dismissed_until
  );
END;
$$;