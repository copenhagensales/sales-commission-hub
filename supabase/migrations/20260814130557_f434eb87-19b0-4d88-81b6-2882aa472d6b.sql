-- Self-healing sync: create team_members rows for employees whose team was chosen
-- on their onboarding cohort ("Kommende opstarter") but never written to team_members.
-- Guards: only employees with ZERO existing memberships, started within the last 30 days.
CREATE OR REPLACE FUNCTION public.sync_cohort_team_memberships()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int := 0;
BEGIN
  WITH candidates AS (
    SELECT DISTINCT ON (e.id)
      e.id AS employee_id,
      COALESCE(c.team_id, e.team_id) AS team_id
    FROM public.employee_master_data e
    LEFT JOIN public.cohort_members cm ON cm.employee_id = e.id
    LEFT JOIN public.onboarding_cohorts c ON c.id = cm.cohort_id AND c.team_id IS NOT NULL
    WHERE e.is_active = true
      AND e.employment_start_date IS NOT NULL
      AND e.employment_start_date <= CURRENT_DATE
      AND e.employment_start_date >= CURRENT_DATE - INTERVAL '30 days'
      AND COALESCE(c.team_id, e.team_id) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.team_members tm WHERE tm.employee_id = e.id
      )
    ORDER BY e.id, c.start_date DESC NULLS LAST
  ), ins AS (
    INSERT INTO public.team_members (employee_id, team_id)
    SELECT employee_id, team_id FROM candidates
    ON CONFLICT (team_id, employee_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM ins;

  RETURN jsonb_build_object('inserted', v_inserted, 'ran_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.sync_cohort_team_memberships() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_cohort_team_memberships() TO service_role;

-- Propagate a cohort team change to members who have not started yet and are
-- still sitting on the cohort's previous team (never touches manual moves).
CREATE OR REPLACE FUNCTION public.propagate_cohort_team_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.team_id IS DISTINCT FROM OLD.team_id AND NEW.team_id IS NOT NULL THEN
    -- Move future starters off the old team
    DELETE FROM public.team_members tm
    USING public.cohort_members cm, public.employee_master_data e
    WHERE cm.cohort_id = NEW.id
      AND cm.employee_id = tm.employee_id
      AND e.id = tm.employee_id
      AND tm.team_id = OLD.team_id
      AND e.is_active = true
      AND e.employment_start_date > CURRENT_DATE;

    -- Add them to the new team
    INSERT INTO public.team_members (employee_id, team_id)
    SELECT e.id, NEW.team_id
    FROM public.cohort_members cm
    JOIN public.employee_master_data e ON e.id = cm.employee_id
    WHERE cm.cohort_id = NEW.id
      AND e.is_active = true
      AND e.employment_start_date > CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM public.team_members tm2
        WHERE tm2.employee_id = e.id AND tm2.team_id <> COALESCE(OLD.team_id, '00000000-0000-0000-0000-000000000000'::uuid)
      )
    ON CONFLICT (team_id, employee_id) DO NOTHING;

    -- Keep the planned team on the employee row in sync
    UPDATE public.employee_master_data e
    SET team_id = NEW.team_id
    FROM public.cohort_members cm
    WHERE cm.cohort_id = NEW.id
      AND cm.employee_id = e.id
      AND e.is_active = true
      AND e.employment_start_date > CURRENT_DATE
      AND (e.team_id IS NULL OR e.team_id = OLD.team_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_cohort_team_change ON public.onboarding_cohorts;
CREATE TRIGGER trg_propagate_cohort_team_change
AFTER UPDATE OF team_id ON public.onboarding_cohorts
FOR EACH ROW EXECUTE FUNCTION public.propagate_cohort_team_change();