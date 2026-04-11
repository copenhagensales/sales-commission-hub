CREATE TABLE public.short_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  target_url TEXT NOT NULL,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
  link_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_short_links_code ON public.short_links(code);

ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for redirects"
ON public.short_links FOR SELECT
USING (true);