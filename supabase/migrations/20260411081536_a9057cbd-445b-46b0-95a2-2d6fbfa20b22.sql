
-- Create booking flow criteria table
CREATE TABLE public.booking_flow_criteria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_flow_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage booking_flow_criteria"
  ON public.booking_flow_criteria FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed default criteria
INSERT INTO public.booking_flow_criteria (name, description, sort_order) VALUES
  ('Relevant erfaring', 'Har kandidaten relevant salgserfaring?', 1),
  ('Tilgængelighed', 'Kan kandidaten starte inden for 2 uger?', 2),
  ('Geografi', 'Bor kandidaten i rimelig afstand af kontoret?', 3),
  ('Motivation', 'Viste kandidaten høj motivation i ansøgningen?', 4),
  ('Sprogkompetencer', 'Taler kandidaten flydende dansk?', 5);

-- Create booking flow enrollments table
CREATE TABLE public.booking_flow_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  tier TEXT NOT NULL CHECK (tier IN ('A', 'B', 'C')),
  criteria_met JSONB DEFAULT '[]',
  current_day INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_flow_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage booking_flow_enrollments"
  ON public.booking_flow_enrollments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_booking_flow_enrollments_candidate ON public.booking_flow_enrollments(candidate_id);
CREATE INDEX idx_booking_flow_enrollments_status ON public.booking_flow_enrollments(status);

-- Create booking flow touchpoints table
CREATE TABLE public.booking_flow_touchpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID NOT NULL REFERENCES public.booking_flow_enrollments(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'call_reminder')),
  template_key TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped', 'cancelled', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_flow_touchpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage booking_flow_touchpoints"
  ON public.booking_flow_touchpoints FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_booking_flow_touchpoints_enrollment ON public.booking_flow_touchpoints(enrollment_id);
CREATE INDEX idx_booking_flow_touchpoints_pending ON public.booking_flow_touchpoints(status, scheduled_at) WHERE status = 'pending';

-- Add tier column to candidates
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS tier TEXT CHECK (tier IN ('A', 'B', 'C'));

-- Add updated_at triggers
CREATE TRIGGER update_booking_flow_criteria_updated_at
  BEFORE UPDATE ON public.booking_flow_criteria
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_booking_flow_enrollments_updated_at
  BEFORE UPDATE ON public.booking_flow_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_booking_flow_touchpoints_updated_at
  BEFORE UPDATE ON public.booking_flow_touchpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
