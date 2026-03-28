-- AI Governance Roles
CREATE TABLE public.ai_governance_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text NOT NULL,
  responsible_person text NOT NULL,
  appointed_by text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_governance_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view ai_governance_roles"
  ON public.ai_governance_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners can manage ai_governance_roles"
  ON public.ai_governance_roles FOR ALL TO authenticated
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));

-- AI Use Case Registry
CREATE TABLE public.ai_use_case_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  system text NOT NULL,
  owner text NOT NULL,
  user_group text,
  data_types text,
  has_personal_data boolean DEFAULT false,
  risk_level text DEFAULT 'minimal',
  human_control_requirement text,
  approved_date date,
  next_review_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_use_case_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view ai_use_case_registry"
  ON public.ai_use_case_registry FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners can manage ai_use_case_registry"
  ON public.ai_use_case_registry FOR ALL TO authenticated
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));

-- AI Instruction Log
CREATE TABLE public.ai_instruction_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employee_master_data(id) ON DELETE SET NULL,
  employee_name text,
  employee_email text,
  instruction_date timestamptz DEFAULT now(),
  method text NOT NULL DEFAULT 'email',
  acknowledged boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_instruction_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view ai_instruction_log"
  ON public.ai_instruction_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners can manage ai_instruction_log"
  ON public.ai_instruction_log FOR ALL TO authenticated
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));

-- Seed governance roles
INSERT INTO public.ai_governance_roles (role_name, responsible_person, appointed_by, status, notes) VALUES
  ('AI-ansvarlig', 'Kasper Mikkelsen', 'Ledelsen', 'active', 'Overordnet ansvarlig for AI-politik og compliance iht. EU AI Act'),
  ('Systemejer – ChatGPT Business', 'Kasper Mikkelsen', 'AI-ansvarlig', 'active', 'Ansvarlig for korrekt brug, konfiguration og adgangsstyring af ChatGPT Business'),
  ('Systemejer – Lovable', 'Kasper Mikkelsen', 'AI-ansvarlig', 'active', 'Ansvarlig for intern systemudvikling via Lovable og dets AI-funktioner'),
  ('Nærmeste leder', 'Alle ledere', 'AI-ansvarlig', 'active', 'Ansvarlig for at egne medarbejdere er instrueret i AI-brug og overholder politikken');

-- Seed use cases
INSERT INTO public.ai_use_case_registry (name, system, owner, user_group, data_types, has_personal_data, risk_level, human_control_requirement, approved_date, next_review_date, notes) VALUES
  ('Tekstudkast og kommunikation', 'ChatGPT Business', 'Kasper Mikkelsen', 'Alle medarbejdere med licens', 'Intern tekst, skabeloner, opsummeringer', false, 'minimal', 'Medarbejder gennemgår og godkender alt output inden brug', '2025-06-01', '2026-06-01', 'Må IKKE bruges til persondata, CPR, løn eller kundedata. Workspace-data deles ikke med OpenAI.'),
  ('Intern systemudvikling', 'Lovable (AI-assisteret kodning)', 'Kasper Mikkelsen', 'Systemadministratorer', 'Kodebase, forretningslogik, UI-komponenter', false, 'begrænset', 'Alle ændringer reviewes før deploy. Data forbliver i Supabase Cloud.', '2025-06-01', '2026-06-01', 'AI bruges til kodegenerering. Ingen persondata sendes til AI-modellen – kun kodestruktur.');