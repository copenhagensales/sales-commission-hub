
-- ============ ENUM-lignende check-typer holdes som text med CHECK ============

CREATE TABLE public.quality_controllers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL UNIQUE REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  daily_goal integer,
  granted_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.quality_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  daily_goal integer NOT NULL DEFAULT 40,
  min_reviews_for_percentage integer NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quality_settings_singleton_true CHECK (singleton = true)
);

CREATE TABLE public.quality_error_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('obligatorisk','kvalitet')),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.quality_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_campaign_id uuid REFERENCES public.client_campaigns(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Standardtjekliste',
  version integer NOT NULL DEFAULT 1,
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX quality_checklists_campaign_version_idx
  ON public.quality_checklists (COALESCE(client_campaign_id, '00000000-0000-0000-0000-000000000000'::uuid), version);

CREATE TABLE public.quality_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.quality_checklists(id) ON DELETE CASCADE,
  label text NOT NULL,
  guidance text,
  item_type text NOT NULL CHECK (item_type IN ('obligatorisk','kvalitet')),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quality_checklist_items_checklist_idx ON public.quality_checklist_items(checklist_id);

CREATE TABLE public.quality_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL,
  sale_datetime timestamptz,
  sale_date date,
  client_campaign_id uuid,
  employee_id uuid,
  seller_name text,
  team_id uuid,
  team_name text,
  team_leader_id uuid,
  assistant_team_leader_id uuid,
  reviewer_employee_id uuid NOT NULL,
  checklist_id uuid NOT NULL REFERENCES public.quality_checklists(id),
  checklist_version integer NOT NULL,
  result text NOT NULL CHECK (result IN ('godkendt','godkendt_med_bemaerkning','afvist')),
  comment text,
  search_key text,
  started_at timestamptz,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quality_reviews_comment_len CHECK (comment IS NULL OR char_length(comment) <= 500)
);
CREATE INDEX quality_reviews_sale_idx ON public.quality_reviews(sale_id);
CREATE INDEX quality_reviews_date_idx ON public.quality_reviews(sale_date);
CREATE INDEX quality_reviews_team_idx ON public.quality_reviews(team_id);
CREATE INDEX quality_reviews_employee_idx ON public.quality_reviews(employee_id);
CREATE INDEX quality_reviews_reviewer_idx ON public.quality_reviews(reviewer_employee_id, completed_at);

CREATE TABLE public.quality_review_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.quality_reviews(id) ON DELETE RESTRICT,
  checklist_item_id uuid NOT NULL REFERENCES public.quality_checklist_items(id),
  item_type text NOT NULL CHECK (item_type IN ('obligatorisk','kvalitet')),
  state text NOT NULL CHECK (state IN ('ok','mangler','ikke_relevant')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quality_review_items_review_idx ON public.quality_review_items(review_id);

CREATE TABLE public.quality_review_error_codes (
  review_id uuid NOT NULL REFERENCES public.quality_reviews(id) ON DELETE RESTRICT,
  error_code_id uuid NOT NULL REFERENCES public.quality_error_codes(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, error_code_id)
);

CREATE TABLE public.quality_uncontrolled_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL UNIQUE,
  sale_date date NOT NULL,
  client_campaign_id uuid,
  employee_id uuid,
  team_id uuid,
  marked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quality_uncontrolled_sales_date_idx ON public.quality_uncontrolled_sales(sale_date);

CREATE TABLE public.quality_daily_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  completion_date date NOT NULL UNIQUE,
  reviewer_employee_id uuid,
  reviewed_count integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.quality_mail_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mail_type text NOT NULL,
  review_id uuid,
  sale_id uuid,
  team_id uuid,
  recipient_email text NOT NULL,
  recipient_name text,
  subject text,
  status text NOT NULL DEFAULT 'queued',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quality_mail_log_created_idx ON public.quality_mail_log(created_at);

-- ============ GRANTS ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_controllers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_error_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_checklists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_checklist_items TO authenticated;
GRANT SELECT, INSERT ON public.quality_reviews TO authenticated;
GRANT SELECT, INSERT ON public.quality_review_items TO authenticated;
GRANT SELECT, INSERT ON public.quality_review_error_codes TO authenticated;
GRANT SELECT ON public.quality_uncontrolled_sales TO authenticated;
GRANT SELECT, INSERT ON public.quality_daily_completions TO authenticated;
GRANT SELECT ON public.quality_mail_log TO authenticated;
GRANT ALL ON public.quality_controllers TO service_role;
GRANT ALL ON public.quality_settings TO service_role;
GRANT ALL ON public.quality_error_codes TO service_role;
GRANT ALL ON public.quality_checklists TO service_role;
GRANT ALL ON public.quality_checklist_items TO service_role;
GRANT ALL ON public.quality_reviews TO service_role;
GRANT ALL ON public.quality_review_items TO service_role;
GRANT ALL ON public.quality_review_error_codes TO service_role;
GRANT ALL ON public.quality_uncontrolled_sales TO service_role;
GRANT ALL ON public.quality_daily_completions TO service_role;
GRANT ALL ON public.quality_mail_log TO service_role;

-- ============ HJÆLPEFUNKTIONER ============

CREATE OR REPLACE FUNCTION public.is_quality_controller(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.quality_controllers qc
    JOIN public.employee_master_data emd ON emd.id = qc.employee_id
    WHERE qc.is_active = true
      AND (
        emd.auth_user_id = _user_id
        OR lower(COALESCE(emd.work_email,'')) = (SELECT lower(email) FROM auth.users WHERE id = _user_id)
        OR lower(COALESCE(emd.private_email,'')) = (SELECT lower(email) FROM auth.users WHERE id = _user_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.quality_can_view_all(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_superadmin(_user_id) OR public.is_quality_controller(_user_id);
$$;

CREATE OR REPLACE FUNCTION public.quality_my_leader_team_ids(_user_id uuid DEFAULT auth.uid())
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  WITH me AS (
    SELECT emd.id
    FROM public.employee_master_data emd
    WHERE emd.auth_user_id = _user_id
       OR lower(COALESCE(emd.work_email,'')) = (SELECT lower(email) FROM auth.users WHERE id = _user_id)
       OR lower(COALESCE(emd.private_email,'')) = (SELECT lower(email) FROM auth.users WHERE id = _user_id)
  )
  SELECT t.id FROM public.teams t WHERE t.team_leader_id IN (SELECT id FROM me)
  UNION
  SELECT t.id FROM public.teams t WHERE t.assistant_team_leader_id IN (SELECT id FROM me)
  UNION
  SELECT tal.team_id FROM public.team_assistant_leaders tal WHERE tal.employee_id IN (SELECT id FROM me);
$$;

CREATE OR REPLACE FUNCTION public.quality_has_module_access(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.quality_can_view_all(_user_id)
      OR EXISTS (SELECT 1 FROM public.quality_my_leader_team_ids(_user_id));
$$;

-- Kontroller er uforanderlige
CREATE OR REPLACE FUNCTION public.quality_block_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Kvalitetskontroller kan ikke ændres eller slettes';
END;
$$;

CREATE TRIGGER quality_reviews_immutable
  BEFORE UPDATE OR DELETE ON public.quality_reviews
  FOR EACH ROW EXECUTE FUNCTION public.quality_block_mutation();
CREATE TRIGGER quality_review_items_immutable
  BEFORE UPDATE OR DELETE ON public.quality_review_items
  FOR EACH ROW EXECUTE FUNCTION public.quality_block_mutation();
CREATE TRIGGER quality_review_error_codes_immutable
  BEFORE UPDATE OR DELETE ON public.quality_review_error_codes
  FOR EACH ROW EXECUTE FUNCTION public.quality_block_mutation();

CREATE OR REPLACE FUNCTION public.quality_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER quality_controllers_touch BEFORE UPDATE ON public.quality_controllers FOR EACH ROW EXECUTE FUNCTION public.quality_touch_updated_at();
CREATE TRIGGER quality_settings_touch BEFORE UPDATE ON public.quality_settings FOR EACH ROW EXECUTE FUNCTION public.quality_touch_updated_at();
CREATE TRIGGER quality_error_codes_touch BEFORE UPDATE ON public.quality_error_codes FOR EACH ROW EXECUTE FUNCTION public.quality_touch_updated_at();
CREATE TRIGGER quality_checklists_touch BEFORE UPDATE ON public.quality_checklists FOR EACH ROW EXECUTE FUNCTION public.quality_touch_updated_at();
CREATE TRIGGER quality_checklist_items_touch BEFORE UPDATE ON public.quality_checklist_items FOR EACH ROW EXECUTE FUNCTION public.quality_touch_updated_at();

-- ============ RLS ============
ALTER TABLE public.quality_controllers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_error_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_review_error_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_uncontrolled_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_daily_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_mail_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quality_controllers_read" ON public.quality_controllers FOR SELECT TO authenticated
  USING (public.quality_can_view_all());
CREATE POLICY "quality_controllers_manage" ON public.quality_controllers FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "quality_settings_read" ON public.quality_settings FOR SELECT TO authenticated
  USING (public.quality_has_module_access());
CREATE POLICY "quality_settings_manage" ON public.quality_settings FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "quality_error_codes_read" ON public.quality_error_codes FOR SELECT TO authenticated
  USING (public.quality_has_module_access());
CREATE POLICY "quality_error_codes_manage" ON public.quality_error_codes FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "quality_checklists_read" ON public.quality_checklists FOR SELECT TO authenticated
  USING (public.quality_has_module_access());
CREATE POLICY "quality_checklists_manage" ON public.quality_checklists FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "quality_checklist_items_read" ON public.quality_checklist_items FOR SELECT TO authenticated
  USING (public.quality_has_module_access());
CREATE POLICY "quality_checklist_items_manage" ON public.quality_checklist_items FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "quality_reviews_read" ON public.quality_reviews FOR SELECT TO authenticated
  USING (
    public.quality_can_view_all()
    OR (team_id IS NOT NULL AND team_id IN (SELECT public.quality_my_leader_team_ids()))
  );
CREATE POLICY "quality_reviews_insert" ON public.quality_reviews FOR INSERT TO authenticated
  WITH CHECK (public.quality_can_view_all());

CREATE POLICY "quality_review_items_read" ON public.quality_review_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quality_reviews r WHERE r.id = review_id));
CREATE POLICY "quality_review_items_insert" ON public.quality_review_items FOR INSERT TO authenticated
  WITH CHECK (public.quality_can_view_all());

CREATE POLICY "quality_review_error_codes_read" ON public.quality_review_error_codes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quality_reviews r WHERE r.id = review_id));
CREATE POLICY "quality_review_error_codes_insert" ON public.quality_review_error_codes FOR INSERT TO authenticated
  WITH CHECK (public.quality_can_view_all());

CREATE POLICY "quality_uncontrolled_read" ON public.quality_uncontrolled_sales FOR SELECT TO authenticated
  USING (
    public.quality_can_view_all()
    OR (team_id IS NOT NULL AND team_id IN (SELECT public.quality_my_leader_team_ids()))
  );

CREATE POLICY "quality_daily_completions_read" ON public.quality_daily_completions FOR SELECT TO authenticated
  USING (public.quality_has_module_access());
CREATE POLICY "quality_daily_completions_insert" ON public.quality_daily_completions FOR INSERT TO authenticated
  WITH CHECK (public.quality_can_view_all());

CREATE POLICY "quality_mail_log_read" ON public.quality_mail_log FOR SELECT TO authenticated
  USING (public.quality_can_view_all());

-- ============ SEED ============
INSERT INTO public.quality_settings (singleton) VALUES (true) ON CONFLICT DO NOTHING;

INSERT INTO public.quality_error_codes (code, label, item_type, sort_order) VALUES
  ('OA_MANGLER', 'OA ikke gennemgået', 'obligatorisk', 1),
  ('OPSUM_MANGLER', 'Opsummering ikke foretaget', 'obligatorisk', 2),
  ('PRIS_MANGLER', 'Kunden ikke indforstået med pris', 'obligatorisk', 3),
  ('BINDING_MANGLER', 'Kunden ikke indforstået med bindingsperiode', 'obligatorisk', 4),
  ('FORTRYD_MANGLER', 'Kunden ikke indforstået med fortrydelsesret', 'obligatorisk', 5),
  ('PRODUKT_FEJL', 'Forkert produkt registreret', 'obligatorisk', 6),
  ('TONE', 'Uprofessionel tone', 'kvalitet', 7),
  ('INDVENDING', 'Indvendinger ikke håndteret korrekt', 'kvalitet', 8),
  ('PRES', 'Unødvendigt pres', 'kvalitet', 9)
ON CONFLICT (code) DO NOTHING;

-- Standardtjekliste (version 1) for alle aktive kampagner
INSERT INTO public.quality_checklists (client_campaign_id, name, version, valid_from)
SELECT cc.id, 'Standardtjekliste', 1, CURRENT_DATE
FROM public.client_campaigns cc
ON CONFLICT DO NOTHING;

-- Global fallback-tjekliste
INSERT INTO public.quality_checklists (client_campaign_id, name, version, valid_from)
VALUES (NULL, 'Standardtjekliste (generel)', 1, CURRENT_DATE)
ON CONFLICT DO NOTHING;

INSERT INTO public.quality_checklist_items (checklist_id, label, guidance, item_type, sort_order)
SELECT c.id, v.label, v.guidance, v.item_type, v.sort_order
FROM public.quality_checklists c
CROSS JOIN (VALUES
  ('OA gennemgået', 'Er oplysningsarket gennemgået tydeligt med kunden?', 'obligatorisk', 1),
  ('Opsummering foretaget', 'Er aftalen opsummeret, så kunden kunne bekræfte den?', 'obligatorisk', 2),
  ('Kunden indforstået med pris', 'Er prisen nævnt tydeligt og bekræftet af kunden?', 'obligatorisk', 3),
  ('Kunden indforstået med bindingsperiode', 'Er bindingsperioden nævnt og bekræftet?', 'obligatorisk', 4),
  ('Kunden indforstået med fortrydelsesret', 'Er fortrydelsesretten oplyst?', 'obligatorisk', 5),
  ('Korrekt produkt registreret', 'Passer det registrerede produkt med det aftalte?', 'obligatorisk', 6),
  ('Professionel tone', 'Var tonen venlig, rolig og professionel hele vejen?', 'kvalitet', 7),
  ('Indvendinger håndteret korrekt', 'Blev kundens indvendinger besvaret sagligt?', 'kvalitet', 8),
  ('Ingen unødvendigt pres', 'Fik kunden ro til at beslutte sig?', 'kvalitet', 9)
) AS v(label, guidance, item_type, sort_order)
WHERE c.version = 1
  AND NOT EXISTS (SELECT 1 FROM public.quality_checklist_items i WHERE i.checklist_id = c.id);
