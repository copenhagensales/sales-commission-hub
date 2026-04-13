
-- FASE 0: Fix trigger (byttet kolonner)
CREATE OR REPLACE FUNCTION public.fn_auto_assign_on_new_team_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO employee_client_assignments (employee_id, client_id)
  SELECT NEW.employee_id, tc.client_id
  FROM team_clients tc
  WHERE tc.team_id = NEW.team_id
  ON CONFLICT (employee_id, client_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- FASE 1a: is_primary
ALTER TABLE public.employee_client_assignments
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_primary_per_employee
  ON public.employee_client_assignments (employee_id)
  WHERE is_primary = true;

-- Backfill single-assignment employees as primary
UPDATE public.employee_client_assignments eca
SET is_primary = true
WHERE eca.employee_id IN (
  SELECT employee_id
  FROM public.employee_client_assignments
  GROUP BY employee_id
  HAVING COUNT(*) = 1
)
AND eca.is_primary = false;

-- FASE 1b: client_id on time_stamps
ALTER TABLE public.time_stamps
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);

CREATE INDEX IF NOT EXISTS idx_time_stamps_client_id ON public.time_stamps(client_id);

-- FASE 1c: change log table
CREATE TABLE IF NOT EXISTS public.employee_client_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  old_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  new_client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES auth.users(id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_change_log_employee ON public.employee_client_change_log(employee_id);
CREATE INDEX IF NOT EXISTS idx_change_log_changed_at ON public.employee_client_change_log(changed_at DESC);

ALTER TABLE public.employee_client_change_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employee_client_change_log' AND policyname = 'Managers can view change logs') THEN
    CREATE POLICY "Managers can view change logs"
      ON public.employee_client_change_log FOR SELECT TO authenticated
      USING (public.is_teamleder_or_above(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employee_client_change_log' AND policyname = 'Managers can insert change logs') THEN
    CREATE POLICY "Managers can insert change logs"
      ON public.employee_client_change_log FOR INSERT TO authenticated
      WITH CHECK (public.is_teamleder_or_above(auth.uid()));
  END IF;
END $$;
