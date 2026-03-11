
CREATE TABLE public.candidate_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.candidate_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read" ON public.candidate_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert" ON public.candidate_sources FOR INSERT TO authenticated WITH CHECK (true);

ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS heard_about_us text;
