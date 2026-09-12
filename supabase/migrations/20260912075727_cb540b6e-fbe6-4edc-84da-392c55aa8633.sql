-- 1) Flag-tabel
CREATE TABLE public.ramp_risk_flag (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  client_campaign_id uuid NOT NULL REFERENCES public.client_campaigns(id),
  day_no int NOT NULL CHECK (day_no IN (10, 15)),
  cum_sales numeric NOT NULL,
  threshold_value numeric NOT NULL,
  curve_version int NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by uuid REFERENCES public.employee_master_data(id),
  CONSTRAINT ramp_risk_flag_unique_point UNIQUE (employee_id, day_no)
);
CREATE INDEX idx_ramp_risk_flag_status ON public.ramp_risk_flag (status, client_campaign_id);

GRANT SELECT, INSERT, UPDATE ON public.ramp_risk_flag TO authenticated;
GRANT ALL ON public.ramp_risk_flag TO service_role;
ALTER TABLE public.ramp_risk_flag ENABLE ROW LEVEL SECURITY;

-- Hjaelper: maa denne bruger arbejde med fareflag?
CREATE OR REPLACE FUNCTION public.can_view_ramp_risk_flags()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_teamleder_or_above(auth.uid())
      OR public.is_owner(auth.uid())
      OR public.am_i_superadmin()
$$;

-- Saelgeren maa ALDRIG se sit eget flag: employee_id maa ikke vaere den, der kigger.
CREATE POLICY "Leaders can read ramp risk flags"
ON public.ramp_risk_flag FOR SELECT TO authenticated
USING (
  public.can_view_ramp_risk_flags()
  AND employee_id IS DISTINCT FROM public.get_employee_id_for_user(auth.uid())
);

CREATE POLICY "Leaders can close ramp risk flags"
ON public.ramp_risk_flag FOR UPDATE TO authenticated
USING (
  public.can_view_ramp_risk_flags()
  AND employee_id IS DISTINCT FROM public.get_employee_id_for_user(auth.uid())
)
WITH CHECK (
  public.can_view_ramp_risk_flags()
  AND employee_id IS DISTINCT FROM public.get_employee_id_for_user(auth.uid())
);

-- 2) Handlinger paa flag (fast liste, ingen fritekst)
CREATE TABLE public.ramp_flag_action (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id uuid NOT NULL REFERENCES public.ramp_risk_flag(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN (
    '1-1 samtale', 'medlyt med feedback', 'ny leadbatch', 'samtale med salgschef', 'ingen handling'
  )),
  performed_by uuid NOT NULL REFERENCES public.employee_master_data(id),
  performed_at timestamptz NOT NULL DEFAULT now(),
  coaching_feedback_id uuid REFERENCES public.coaching_feedback(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ramp_flag_action_flag ON public.ramp_flag_action (flag_id);
CREATE INDEX idx_ramp_flag_action_performer ON public.ramp_flag_action (performed_by);

GRANT SELECT, INSERT ON public.ramp_flag_action TO authenticated;
GRANT ALL ON public.ramp_flag_action TO service_role;
ALTER TABLE public.ramp_flag_action ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaders can read ramp flag actions"
ON public.ramp_flag_action FOR SELECT TO authenticated
USING (
  public.can_view_ramp_risk_flags()
  AND EXISTS (
    SELECT 1 FROM public.ramp_risk_flag f
    WHERE f.id = ramp_flag_action.flag_id
      AND f.employee_id IS DISTINCT FROM public.get_employee_id_for_user(auth.uid())
  )
);

-- performed_by skal altid vaere lederen selv, saa feltet altid er udfyldt og retvisende.
CREATE POLICY "Leaders can log ramp flag actions"
ON public.ramp_flag_action FOR INSERT TO authenticated
WITH CHECK (
  public.can_view_ramp_risk_flags()
  AND performed_by = public.get_employee_id_for_user(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.ramp_risk_flag f
    WHERE f.id = ramp_flag_action.flag_id
      AND f.employee_id IS DISTINCT FROM public.get_employee_id_for_user(auth.uid())
  )
);

-- 3) Indstillinger (risikofaktor + datagrundlag) i data, ikke i frontend
CREATE TABLE public.ramp_risk_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_factor numeric NOT NULL DEFAULT 3,
  basis_sellers int NOT NULL DEFAULT 34,
  basis_leavers int NOT NULL DEFAULT 11,
  basis_campaign_label text NOT NULL DEFAULT 'Eesy TM',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ramp_risk_settings TO authenticated;
GRANT ALL ON public.ramp_risk_settings TO service_role;
ALTER TABLE public.ramp_risk_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read ramp risk settings"
ON public.ramp_risk_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners can manage ramp risk settings"
ON public.ramp_risk_settings FOR ALL TO authenticated
USING (public.is_owner(auth.uid()) OR public.am_i_superadmin())
WITH CHECK (public.is_owner(auth.uid()) OR public.am_i_superadmin());

CREATE TRIGGER update_ramp_risk_settings_updated_at
BEFORE UPDATE ON public.ramp_risk_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ramp_risk_settings (risk_factor, basis_sellers, basis_leavers, basis_campaign_label)
VALUES (3, 34, 11, 'Eesy TM');