-- ============ ENUMS ============
CREATE TYPE public.it_computer_status AS ENUM ('working', 'not_working', 'needs_investigation');
CREATE TYPE public.it_update_status AS ENUM ('updated', 'update_required', 'update_in_progress', 'update_failed', 'unknown');
CREATE TYPE public.it_equipment_kind AS ENUM ('computer', 'monitor_1', 'monitor_2', 'headset', 'mouse', 'keyboard');
CREATE TYPE public.it_equipment_status AS ENUM ('ok', 'missing', 'broken', 'unknown');
CREATE TYPE public.it_campaign_ws_status AS ENUM ('pending', 'completed', 'failed');

-- ============ ACCESS HELPER ============
CREATE OR REPLACE FUNCTION public.has_it_access(_user_id uuid, _require_edit boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_owner(_user_id)
    OR (
      EXISTS (
        SELECT 1 FROM public.employee_master_data emd
        WHERE emd.auth_user_id = _user_id
          AND emd.is_active = true
          AND emd.is_staff_employee = true
      )
      AND public.has_page_permission(_user_id, 'menu_it_workstations', _require_edit)
    )
$$;

-- ============ SHARED updated_at ============
CREATE OR REPLACE FUNCTION public.it_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ WORKSTATIONS ============
CREATE TABLE public.it_workstations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  area_code text NOT NULL,
  area_label text NOT NULL,
  seat_order integer NOT NULL DEFAULT 0,
  computer_name text,
  asset_id text,
  serial_number text,
  computer_status public.it_computer_status NOT NULL DEFAULT 'working',
  update_status public.it_update_status NOT NULL DEFAULT 'unknown',
  last_checked_at timestamptz,
  last_updated_at timestamptz,
  updated_by_name text,
  updated_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.it_workstations TO authenticated;
GRANT ALL ON public.it_workstations TO service_role;
ALTER TABLE public.it_workstations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "IT staff can view workstations" ON public.it_workstations
  FOR SELECT TO authenticated USING (public.has_it_access(auth.uid()));
CREATE POLICY "IT staff can update workstations" ON public.it_workstations
  FOR UPDATE TO authenticated USING (public.has_it_access(auth.uid(), true)) WITH CHECK (public.has_it_access(auth.uid(), true));
CREATE POLICY "IT staff can insert workstations" ON public.it_workstations
  FOR INSERT TO authenticated WITH CHECK (public.has_it_access(auth.uid(), true));
CREATE POLICY "Owners can delete workstations" ON public.it_workstations
  FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

CREATE TRIGGER trg_it_workstations_updated_at BEFORE UPDATE ON public.it_workstations
  FOR EACH ROW EXECUTE FUNCTION public.it_set_updated_at();

CREATE INDEX idx_it_workstations_area ON public.it_workstations(area_code, seat_order);

-- ============ EQUIPMENT ============
CREATE TABLE public.it_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workstation_id uuid NOT NULL REFERENCES public.it_workstations(id) ON DELETE CASCADE,
  kind public.it_equipment_kind NOT NULL,
  status public.it_equipment_status NOT NULL DEFAULT 'unknown',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workstation_id, kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.it_equipment TO authenticated;
GRANT ALL ON public.it_equipment TO service_role;
ALTER TABLE public.it_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "IT staff can view equipment" ON public.it_equipment
  FOR SELECT TO authenticated USING (public.has_it_access(auth.uid()));
CREATE POLICY "IT staff can insert equipment" ON public.it_equipment
  FOR INSERT TO authenticated WITH CHECK (public.has_it_access(auth.uid(), true));
CREATE POLICY "IT staff can update equipment" ON public.it_equipment
  FOR UPDATE TO authenticated USING (public.has_it_access(auth.uid(), true)) WITH CHECK (public.has_it_access(auth.uid(), true));
CREATE POLICY "Owners can delete equipment" ON public.it_equipment
  FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

CREATE TRIGGER trg_it_equipment_updated_at BEFORE UPDATE ON public.it_equipment
  FOR EACH ROW EXECUTE FUNCTION public.it_set_updated_at();

CREATE INDEX idx_it_equipment_ws ON public.it_equipment(workstation_id);

-- ============ CAMPAIGNS ============
CREATE TABLE public.it_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.it_campaigns TO authenticated;
GRANT ALL ON public.it_campaigns TO service_role;
ALTER TABLE public.it_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "IT staff can view campaigns" ON public.it_campaigns
  FOR SELECT TO authenticated USING (public.has_it_access(auth.uid()));
CREATE POLICY "IT staff can insert campaigns" ON public.it_campaigns
  FOR INSERT TO authenticated WITH CHECK (public.has_it_access(auth.uid(), true));
CREATE POLICY "IT staff can update campaigns" ON public.it_campaigns
  FOR UPDATE TO authenticated USING (public.has_it_access(auth.uid(), true)) WITH CHECK (public.has_it_access(auth.uid(), true));
CREATE POLICY "Owners can delete campaigns" ON public.it_campaigns
  FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

CREATE TRIGGER trg_it_campaigns_updated_at BEFORE UPDATE ON public.it_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.it_set_updated_at();

-- ============ CAMPAIGN WORKSTATIONS ============
CREATE TABLE public.it_campaign_workstations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.it_campaigns(id) ON DELETE CASCADE,
  workstation_id uuid NOT NULL REFERENCES public.it_workstations(id) ON DELETE CASCADE,
  status public.it_campaign_ws_status NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  completed_by uuid,
  completed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, workstation_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.it_campaign_workstations TO authenticated;
GRANT ALL ON public.it_campaign_workstations TO service_role;
ALTER TABLE public.it_campaign_workstations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "IT staff can view campaign workstations" ON public.it_campaign_workstations
  FOR SELECT TO authenticated USING (public.has_it_access(auth.uid()));
CREATE POLICY "IT staff can insert campaign workstations" ON public.it_campaign_workstations
  FOR INSERT TO authenticated WITH CHECK (public.has_it_access(auth.uid(), true));
CREATE POLICY "IT staff can update campaign workstations" ON public.it_campaign_workstations
  FOR UPDATE TO authenticated USING (public.has_it_access(auth.uid(), true)) WITH CHECK (public.has_it_access(auth.uid(), true));
CREATE POLICY "Owners can delete campaign workstations" ON public.it_campaign_workstations
  FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

CREATE TRIGGER trg_it_campaign_ws_updated_at BEFORE UPDATE ON public.it_campaign_workstations
  FOR EACH ROW EXECUTE FUNCTION public.it_set_updated_at();

CREATE INDEX idx_it_campaign_ws_campaign ON public.it_campaign_workstations(campaign_id);

-- ============ ACTIVITY LOG (append only) ============
CREATE TABLE public.it_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workstation_id uuid REFERENCES public.it_workstations(id) ON DELETE SET NULL,
  workstation_code text,
  user_id uuid,
  user_name text,
  action text NOT NULL,
  field text,
  previous_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.it_activity_logs TO authenticated;
GRANT ALL ON public.it_activity_logs TO service_role;
ALTER TABLE public.it_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "IT staff can view activity log" ON public.it_activity_logs
  FOR SELECT TO authenticated USING (public.has_it_access(auth.uid()));
CREATE POLICY "IT staff can append activity log" ON public.it_activity_logs
  FOR INSERT TO authenticated WITH CHECK (public.has_it_access(auth.uid(), true));

CREATE INDEX idx_it_activity_created ON public.it_activity_logs(created_at DESC);

-- ============ REALTIME ============
ALTER TABLE public.it_workstations REPLICA IDENTITY FULL;
ALTER TABLE public.it_equipment REPLICA IDENTITY FULL;
ALTER TABLE public.it_campaign_workstations REPLICA IDENTITY FULL;
ALTER TABLE public.it_activity_logs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.it_workstations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.it_equipment;
ALTER PUBLICATION supabase_realtime ADD TABLE public.it_campaign_workstations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.it_activity_logs;