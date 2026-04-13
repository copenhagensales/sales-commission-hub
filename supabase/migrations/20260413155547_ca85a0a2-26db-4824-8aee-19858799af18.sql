
-- ============================================================
-- 1. Feature flags tabel
-- ============================================================
CREATE TABLE public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read feature flags"
  ON public.feature_flags FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO public.feature_flags (key, enabled) VALUES ('employee_client_assignments', false);

-- ============================================================
-- 2. Clock type enum
-- ============================================================
CREATE TYPE public.clock_type AS ENUM ('override', 'documentation', 'revenue');

-- ============================================================
-- 3. Employee-client assignments
-- ============================================================
CREATE TABLE public.employee_client_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, client_id)
);

CREATE INDEX idx_eca_employee ON public.employee_client_assignments(employee_id);
CREATE INDEX idx_eca_client ON public.employee_client_assignments(client_id);

ALTER TABLE public.employee_client_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read assignments"
  ON public.employee_client_assignments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert assignments"
  ON public.employee_client_assignments FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update assignments"
  ON public.employee_client_assignments FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete assignments"
  ON public.employee_client_assignments FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 4. Employee time clocks
-- ============================================================
CREATE TABLE public.employee_time_clocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  clock_type public.clock_type NOT NULL,
  hourly_rate numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(employee_id, client_id, clock_type)
);

CREATE INDEX idx_etc_employee ON public.employee_time_clocks(employee_id);
CREATE INDEX idx_etc_client ON public.employee_time_clocks(client_id);
CREATE INDEX idx_etc_active ON public.employee_time_clocks(is_active) WHERE is_active = true;

ALTER TABLE public.employee_time_clocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read time clocks"
  ON public.employee_time_clocks FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert time clocks"
  ON public.employee_time_clocks FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update time clocks"
  ON public.employee_time_clocks FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete time clocks"
  ON public.employee_time_clocks FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 5. Unique client per team constraint
-- ============================================================
ALTER TABLE public.team_clients ADD CONSTRAINT unique_client_per_team UNIQUE (client_id);

-- ============================================================
-- 6. Backfill: existing team_members × team_clients
-- ============================================================
INSERT INTO public.employee_client_assignments (employee_id, client_id)
SELECT DISTINCT tm.employee_id, tc.client_id
FROM public.team_members tm
JOIN public.team_clients tc ON tc.team_id = tm.team_id
ON CONFLICT (employee_id, client_id) DO NOTHING;

-- Also assign all clients to staff employees
INSERT INTO public.employee_client_assignments (employee_id, client_id)
SELECT DISTINCT e.id, c.id
FROM public.employee_master_data e
CROSS JOIN public.clients c
WHERE e.is_staff_employee = true AND e.is_active = true
ON CONFLICT (employee_id, client_id) DO NOTHING;

-- ============================================================
-- 7. Trigger: New team_client → assign all team members + staff
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_auto_assign_on_new_team_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Assign all members of the team
  INSERT INTO employee_client_assignments (employee_id, client_id)
  SELECT tm.employee_id, NEW.client_id
  FROM team_members tm
  WHERE tm.team_id = NEW.team_id
  ON CONFLICT (employee_id, client_id) DO NOTHING;

  -- Assign all staff employees
  INSERT INTO employee_client_assignments (employee_id, client_id)
  SELECT e.id, NEW.client_id
  FROM employee_master_data e
  WHERE e.is_staff_employee = true AND e.is_active = true
  ON CONFLICT (employee_id, client_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_assign_on_new_team_client
  AFTER INSERT ON public.team_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_assign_on_new_team_client();

-- ============================================================
-- 8. Trigger: New team_member → assign all team's clients
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_auto_assign_on_new_team_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO employee_client_assignments (employee_id, client_id)
  SELECT tc.client_id, NEW.employee_id
  FROM team_clients tc
  WHERE tc.team_id = NEW.team_id
  ON CONFLICT (employee_id, client_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_assign_on_new_team_member
  AFTER INSERT ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_assign_on_new_team_member();

-- ============================================================
-- 9. Trigger: Employee becomes staff → assign all clients
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_auto_assign_staff_all_clients()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_staff_employee = true AND (OLD.is_staff_employee IS DISTINCT FROM true) THEN
    INSERT INTO employee_client_assignments (employee_id, client_id)
    SELECT NEW.id, c.id
    FROM clients c
    ON CONFLICT (employee_id, client_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_assign_staff_all_clients
  AFTER UPDATE OF is_staff_employee ON public.employee_master_data
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_assign_staff_all_clients();

-- ============================================================
-- 10. Trigger: team_member removed → remove assignments for that team's clients
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_remove_assignments_on_team_member_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only remove assignments for clients belonging to the team being left
  -- Keep cross-team assignments and staff assignments
  DELETE FROM employee_client_assignments eca
  WHERE eca.employee_id = OLD.employee_id
    AND eca.client_id IN (
      SELECT tc.client_id FROM team_clients tc WHERE tc.team_id = OLD.team_id
    )
    -- Don't remove if employee is staff (they keep all clients)
    AND NOT EXISTS (
      SELECT 1 FROM employee_master_data e
      WHERE e.id = OLD.employee_id AND e.is_staff_employee = true
    )
    -- Don't remove if employee is in another team that also has this client
    AND NOT EXISTS (
      SELECT 1 FROM team_members tm
      JOIN team_clients tc ON tc.team_id = tm.team_id
      WHERE tm.employee_id = OLD.employee_id
        AND tc.client_id = eca.client_id
        AND tm.team_id != OLD.team_id
    );

  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_remove_assignments_on_team_member_delete
  AFTER DELETE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_remove_assignments_on_team_member_delete();

-- ============================================================
-- 11. Trigger: team_client removed → remove related assignments
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_remove_assignments_on_team_client_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove assignments for this client for members of this team
  -- Keep staff assignments and cross-team assignments
  DELETE FROM employee_client_assignments eca
  WHERE eca.client_id = OLD.client_id
    AND eca.employee_id IN (
      SELECT tm.employee_id FROM team_members tm WHERE tm.team_id = OLD.team_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM employee_master_data e
      WHERE e.id = eca.employee_id AND e.is_staff_employee = true
    );

  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_remove_assignments_on_team_client_delete
  AFTER DELETE ON public.team_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_remove_assignments_on_team_client_delete();
