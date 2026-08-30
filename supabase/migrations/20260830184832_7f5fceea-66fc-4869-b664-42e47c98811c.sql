-- ============================================================================
-- A2: Fjern teamtilknytninger automatisk ved deaktivering + log
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.team_membership_removal_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employee_master_data(id) ON DELETE SET NULL,
  employee_name text,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  team_name text,
  removal_type text NOT NULL CHECK (removal_type IN ('team_member', 'assistant_leader', 'team_leader')),
  reason text NOT NULL,
  removed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.team_membership_removal_log IS
  'Sporbarhed: hvilke teamtilknytninger der blev fjernet ved deaktivering eller oprydning.';

CREATE INDEX IF NOT EXISTS idx_tmrl_employee ON public.team_membership_removal_log(employee_id);
CREATE INDEX IF NOT EXISTS idx_tmrl_created ON public.team_membership_removal_log(created_at DESC);

GRANT SELECT ON public.team_membership_removal_log TO authenticated;
GRANT ALL ON public.team_membership_removal_log TO service_role;

ALTER TABLE public.team_membership_removal_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teamledere og ledelse kan laese fjernelseslog"
  ON public.team_membership_removal_log
  FOR SELECT
  TO authenticated
  USING (public.is_teamleder_or_above(auth.uid()) OR public.is_owner(auth.uid()));

-- ---------------------------------------------------------------------------
-- Ny version: fjerner teamtilknytninger ved deaktivering.
-- last_team_id bevares automatisk af sync_last_team_id() ved DELETE.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_deactivated_employee_from_teams()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
BEGIN
  IF OLD.is_active = true AND NEW.is_active = false THEN
    v_name := NEW.first_name || ' ' || NEW.last_name;

    -- 1) Historisk ansaettelse (skal laeses FOER teamtilknytningen fjernes)
    INSERT INTO public.historical_employment (
      employee_name, start_date, end_date, team_name
    )
    SELECT
      v_name,
      COALESCE(NEW.employment_start_date, NEW.created_at::date),
      COALESCE(NEW.employment_end_date, CURRENT_DATE),
      t.name
    FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE tm.employee_id = NEW.id
    AND NOT EXISTS (
      SELECT 1 FROM public.historical_employment he
      WHERE he.employee_name = v_name
        AND he.team_name = t.name
        AND he.end_date = COALESCE(NEW.employment_end_date, CURRENT_DATE)
    );

    -- 2) Log + fjern som teammedlem
    INSERT INTO public.team_membership_removal_log
      (employee_id, employee_name, team_id, team_name, removal_type, reason, removed_by)
    SELECT NEW.id, v_name, tm.team_id, t.name, 'team_member', 'deactivation', auth.uid()
    FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE tm.employee_id = NEW.id;

    DELETE FROM public.team_members WHERE employee_id = NEW.id;

    -- 3) Log + fjern som assisterende teamleder
    INSERT INTO public.team_membership_removal_log
      (employee_id, employee_name, team_id, team_name, removal_type, reason, removed_by)
    SELECT NEW.id, v_name, tal.team_id, t.name, 'assistant_leader', 'deactivation', auth.uid()
    FROM public.team_assistant_leaders tal
    JOIN public.teams t ON t.id = tal.team_id
    WHERE tal.employee_id = NEW.id;

    DELETE FROM public.team_assistant_leaders WHERE employee_id = NEW.id;

    -- 4) Log + fjern som teamleder
    INSERT INTO public.team_membership_removal_log
      (employee_id, employee_name, team_id, team_name, removal_type, reason, removed_by)
    SELECT NEW.id, v_name, t.id, t.name, 'team_leader', 'deactivation', auth.uid()
    FROM public.teams t
    WHERE t.team_leader_id = NEW.id;

    UPDATE public.teams SET team_leader_id = NULL WHERE team_leader_id = NEW.id;

    -- 5) Uaendret oevrig oprydning
    UPDATE public.contracts
    SET status = 'cancelled'
    WHERE employee_id = NEW.id AND status = 'pending_employee';

    UPDATE public.league_enrollments
    SET is_active = false
    WHERE employee_id = NEW.id;

    DELETE FROM public.league_qualification_standings
    WHERE employee_id = NEW.id;

    UPDATE public.employee_referrals
    SET status = 'rejected',
        notes = COALESCE(notes || E'\n', '') || 'Automatisk afvist: Medarbejder stoppede før 60 dages ansættelse (' || COALESCE((CURRENT_DATE - hired_date::date)::text, '?') || ' dage).',
        updated_at = now()
    WHERE hired_employee_id = NEW.id
      AND status IN ('hired', 'eligible_for_bonus')
      AND hired_date IS NOT NULL
      AND (CURRENT_DATE - hired_date::date) < 60;
  END IF;

  RETURN NEW;
END;
$function$;