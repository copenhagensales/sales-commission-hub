
-- AMO Compliance Hub: Phase 1 Database Schema

-- Enums
CREATE TYPE public.amo_role_type AS ENUM ('admin', 'ledelsesrepresentant', 'arbejdsleder', 'amr', 'readonly');
CREATE TYPE public.amo_meeting_type AS ENUM ('amo_meeting', 'annual_discussion', 'extraordinary');
CREATE TYPE public.amo_meeting_status AS ENUM ('planned', 'completed', 'overdue', 'cancelled');
CREATE TYPE public.amo_apv_reason AS ENUM ('regular_cycle', 'organisational_change', 'relocation', 'incident', 'other');
CREATE TYPE public.amo_training_type AS ENUM ('mandatory_3day', 'supplementary', 'internal_workshop', 'legal_update');
CREATE TYPE public.amo_task_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.amo_task_status AS ENUM ('open', 'in_progress', 'done', 'overdue');
CREATE TYPE public.amo_rule_type AS ENUM ('lovpligtigt', 'anbefalet', 'intern');

-- 1. Workplaces
CREATE TABLE public.amo_workplaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  employee_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Members
CREATE TABLE public.amo_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workplace_id UUID REFERENCES public.amo_workplaces(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  employee_id UUID REFERENCES public.employee_master_data(id) ON DELETE SET NULL,
  role_type public.amo_role_type NOT NULL,
  start_date DATE,
  end_date DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  training_required BOOLEAN NOT NULL DEFAULT false,
  prior_valid_training BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. AMR Elections
CREATE TABLE public.amo_amr_elections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.amo_members(id) ON DELETE CASCADE,
  elected_date DATE NOT NULL,
  election_period_months INTEGER NOT NULL DEFAULT 24,
  next_election_due DATE NOT NULL,
  election_document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Annual Discussions
CREATE TABLE public.amo_annual_discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_date DATE NOT NULL,
  participants TEXT[],
  previous_year_eval TEXT,
  goals TEXT,
  collab_model TEXT,
  meeting_cadence TEXT,
  minutes_url TEXT,
  follow_up_tasks JSONB DEFAULT '[]'::jsonb,
  approved_by TEXT,
  next_due_date DATE,
  status TEXT NOT NULL DEFAULT 'planned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Meetings
CREATE TABLE public.amo_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_type public.amo_meeting_type NOT NULL DEFAULT 'amo_meeting',
  planned_date DATE NOT NULL,
  actual_date DATE,
  attendees TEXT[],
  agenda TEXT,
  minutes_url TEXT,
  decisions TEXT,
  action_items JSONB DEFAULT '[]'::jsonb,
  next_meeting_date DATE,
  status public.amo_meeting_status NOT NULL DEFAULT 'planned',
  related_documents TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. APV
CREATE TABLE public.amo_apv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  workplace_id UUID REFERENCES public.amo_workplaces(id) ON DELETE SET NULL,
  start_date DATE,
  completed_date DATE,
  next_due_date DATE,
  reason public.amo_apv_reason NOT NULL DEFAULT 'regular_cycle',
  physical_env TEXT,
  psychological_env TEXT,
  sickness_review TEXT,
  findings TEXT,
  risk_level TEXT,
  action_plan TEXT,
  responsible_owner TEXT,
  deadline DATE,
  follow_up_status TEXT DEFAULT 'pending',
  evidence_documents TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Kemi-APV
CREATE TABLE public.amo_kemi_apv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  supplier TEXT,
  product_type TEXT,
  hazard_flag BOOLEAN NOT NULL DEFAULT false,
  sds_url TEXT,
  storage_notes TEXT,
  work_process TEXT,
  exposure_risk TEXT,
  protective_measures TEXT,
  instructions TEXT,
  responsible_owner TEXT,
  review_date DATE,
  next_review_due DATE,
  related_apv_id UUID REFERENCES public.amo_apv(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Training Courses
CREATE TABLE public.amo_training_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.amo_members(id) ON DELETE CASCADE,
  training_type public.amo_training_type NOT NULL,
  requirement_applies BOOLEAN NOT NULL DEFAULT true,
  membership_start DATE,
  deadline_date DATE,
  offered_date DATE,
  completed_date DATE,
  provider TEXT,
  certificate_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Documents
CREATE TABLE public.amo_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT,
  related_module TEXT,
  related_member_id UUID REFERENCES public.amo_members(id) ON DELETE SET NULL,
  related_workplace_id UUID REFERENCES public.amo_workplaces(id) ON DELETE SET NULL,
  upload_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  document_date DATE,
  expiry_date DATE,
  owner TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  tags TEXT[],
  doko_reference TEXT,
  file_url TEXT,
  comments TEXT,
  external_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Tasks
CREATE TABLE public.amo_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  related_module TEXT,
  related_record_id UUID,
  owner_id UUID REFERENCES public.amo_members(id) ON DELETE SET NULL,
  due_date DATE,
  priority public.amo_task_priority NOT NULL DEFAULT 'medium',
  status public.amo_task_status NOT NULL DEFAULT 'open',
  evidence_required BOOLEAN NOT NULL DEFAULT false,
  reminder_schedule JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Compliance Rules
CREATE TABLE public.amo_compliance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  rule_type public.amo_rule_type NOT NULL DEFAULT 'lovpligtigt',
  description TEXT,
  check_logic_key TEXT,
  interval_months INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Audit Log
CREATE TABLE public.amo_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.amo_workplaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amo_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amo_amr_elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amo_annual_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amo_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amo_apv ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amo_kemi_apv ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amo_training_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amo_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amo_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amo_compliance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amo_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies: authenticated users can read, teamleder/ejer can write
-- Read policies (all authenticated)
CREATE POLICY "amo_workplaces_select" ON public.amo_workplaces FOR SELECT TO authenticated USING (true);
CREATE POLICY "amo_members_select" ON public.amo_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "amo_amr_elections_select" ON public.amo_amr_elections FOR SELECT TO authenticated USING (true);
CREATE POLICY "amo_annual_discussions_select" ON public.amo_annual_discussions FOR SELECT TO authenticated USING (true);
CREATE POLICY "amo_meetings_select" ON public.amo_meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "amo_apv_select" ON public.amo_apv FOR SELECT TO authenticated USING (true);
CREATE POLICY "amo_kemi_apv_select" ON public.amo_kemi_apv FOR SELECT TO authenticated USING (true);
CREATE POLICY "amo_training_courses_select" ON public.amo_training_courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "amo_documents_select" ON public.amo_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "amo_tasks_select" ON public.amo_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "amo_compliance_rules_select" ON public.amo_compliance_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "amo_audit_log_select" ON public.amo_audit_log FOR SELECT TO authenticated USING (true);

-- Write policies (teamleder or ejer only)
CREATE POLICY "amo_workplaces_insert" ON public.amo_workplaces FOR INSERT TO authenticated WITH CHECK (public.is_teamleder_or_above(auth.uid()));
CREATE POLICY "amo_workplaces_update" ON public.amo_workplaces FOR UPDATE TO authenticated USING (public.is_teamleder_or_above(auth.uid()));
CREATE POLICY "amo_workplaces_delete" ON public.amo_workplaces FOR DELETE TO authenticated USING (public.is_teamleder_or_above(auth.uid()));

CREATE POLICY "amo_members_insert" ON public.amo_members FOR INSERT TO authenticated WITH CHECK (public.is_teamleder_or_above(auth.uid()));
CREATE POLICY "amo_members_update" ON public.amo_members FOR UPDATE TO authenticated USING (public.is_teamleder_or_above(auth.uid()));
CREATE POLICY "amo_members_delete" ON public.amo_members FOR DELETE TO authenticated USING (public.is_teamleder_or_above(auth.uid()));

CREATE POLICY "amo_amr_elections_insert" ON public.amo_amr_elections FOR INSERT TO authenticated WITH CHECK (public.is_teamleder_or_above(auth.uid()));
CREATE POLICY "amo_amr_elections_update" ON public.amo_amr_elections FOR UPDATE TO authenticated USING (public.is_teamleder_or_above(auth.uid()));
CREATE POLICY "amo_amr_elections_delete" ON public.amo_amr_elections FOR DELETE TO authenticated USING (public.is_teamleder_or_above(auth.uid()));

CREATE POLICY "amo_annual_discussions_insert" ON public.amo_annual_discussions FOR INSERT TO authenticated WITH CHECK (public.is_teamleder_or_above(auth.uid()));
CREATE POLICY "amo_annual_discussions_update" ON public.amo_annual_discussions FOR UPDATE TO authenticated USING (public.is_teamleder_or_above(auth.uid()));
CREATE POLICY "amo_annual_discussions_delete" ON public.amo_annual_discussions FOR DELETE TO authenticated USING (public.is_teamleder_or_above(auth.uid()));

CREATE POLICY "amo_meetings_insert" ON public.amo_meetings FOR INSERT TO authenticated WITH CHECK (public.is_teamleder_or_above(auth.uid()));
CREATE POLICY "amo_meetings_update" ON public.amo_meetings FOR UPDATE TO authenticated USING (public.is_teamleder_or_above(auth.uid()));
CREATE POLICY "amo_meetings_delete" ON public.amo_meetings FOR DELETE TO authenticated USING (public.is_teamleder_or_above(auth.uid()));

CREATE POLICY "amo_apv_insert" ON public.amo_apv FOR INSERT TO authenticated WITH CHECK (public.is_teamleder_or_above(auth.uid()));
CREATE POLICY "amo_apv_update" ON public.amo_apv FOR UPDATE TO authenticated USING (public.is_teamleder_or_above(auth.uid()));
CREATE POLICY "amo_apv_delete" ON public.amo_apv FOR DELETE TO authenticated USING (public.is_teamleder_or_above(auth.uid()));

CREATE POLICY "amo_kemi_apv_insert" ON public.amo_kemi_apv FOR INSERT TO authenticated WITH CHECK (public.is_teamleder_or_above(auth.uid()));
CREATE POLICY "amo_kemi_apv_update" ON public.amo_kemi_apv FOR UPDATE TO authenticated USING (public.is_teamleder_or_above(auth.uid()));
CREATE POLICY "amo_kemi_apv_delete" ON public.amo_kemi_apv FOR DELETE TO authenticated USING (public.is_teamleder_or_above(auth.uid()));

CREATE POLICY "amo_training_courses_insert" ON public.amo_training_courses FOR INSERT TO authenticated WITH CHECK (public.is_teamleder_or_above(auth.uid()));
CREATE POLICY "amo_training_courses_update" ON public.amo_training_courses FOR UPDATE TO authenticated USING (public.is_teamleder_or_above(auth.uid()));
CREATE POLICY "amo_training_courses_delete" ON public.amo_training_courses FOR DELETE TO authenticated USING (public.is_teamleder_or_above(auth.uid()));

CREATE POLICY "amo_documents_insert" ON public.amo_documents FOR INSERT TO authenticated WITH CHECK (public.is_teamleder_or_above(auth.uid()));
CREATE POLICY "amo_documents_update" ON public.amo_documents FOR UPDATE TO authenticated USING (public.is_teamleder_or_above(auth.uid()));
CREATE POLICY "amo_documents_delete" ON public.amo_documents FOR DELETE TO authenticated USING (public.is_teamleder_or_above(auth.uid()));

CREATE POLICY "amo_tasks_insert" ON public.amo_tasks FOR INSERT TO authenticated WITH CHECK (public.is_teamleder_or_above(auth.uid()));
CREATE POLICY "amo_tasks_update" ON public.amo_tasks FOR UPDATE TO authenticated USING (public.is_teamleder_or_above(auth.uid()));
CREATE POLICY "amo_tasks_delete" ON public.amo_tasks FOR DELETE TO authenticated USING (public.is_teamleder_or_above(auth.uid()));

CREATE POLICY "amo_compliance_rules_insert" ON public.amo_compliance_rules FOR INSERT TO authenticated WITH CHECK (public.is_teamleder_or_above(auth.uid()));
CREATE POLICY "amo_compliance_rules_update" ON public.amo_compliance_rules FOR UPDATE TO authenticated USING (public.is_teamleder_or_above(auth.uid()));

CREATE POLICY "amo_audit_log_insert" ON public.amo_audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- Storage bucket for AMO documents
INSERT INTO storage.buckets (id, name, public) VALUES ('amo-documents', 'amo-documents', false);

-- Storage RLS
CREATE POLICY "amo_documents_storage_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'amo-documents');
CREATE POLICY "amo_documents_storage_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'amo-documents' AND public.is_teamleder_or_above(auth.uid()));
CREATE POLICY "amo_documents_storage_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'amo-documents' AND public.is_teamleder_or_above(auth.uid()));
CREATE POLICY "amo_documents_storage_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'amo-documents' AND public.is_teamleder_or_above(auth.uid()));
