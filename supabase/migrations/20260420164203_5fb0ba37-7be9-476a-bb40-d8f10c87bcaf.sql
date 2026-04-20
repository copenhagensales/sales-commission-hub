-- Add click tracking columns to short_links
ALTER TABLE public.short_links
  ADD COLUMN IF NOT EXISTS click_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_clicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_clicked_at TIMESTAMPTZ;

-- Create short_link_clicks table for detailed events
CREATE TABLE IF NOT EXISTS public.short_link_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  short_link_id UUID NOT NULL REFERENCES public.short_links(id) ON DELETE CASCADE,
  candidate_id UUID,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT,
  ip_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_short_link_clicks_short_link_id ON public.short_link_clicks(short_link_id);
CREATE INDEX IF NOT EXISTS idx_short_link_clicks_candidate_id ON public.short_link_clicks(candidate_id);
CREATE INDEX IF NOT EXISTS idx_short_link_clicks_clicked_at ON public.short_link_clicks(clicked_at);

ALTER TABLE public.short_link_clicks ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anon) can insert click events from the redirect endpoint
CREATE POLICY "Anyone can log a click"
  ON public.short_link_clicks
  FOR INSERT
  WITH CHECK (true);

-- Authenticated users can read click events for reporting
CREATE POLICY "Authenticated can read clicks"
  ON public.short_link_clicks
  FOR SELECT
  TO authenticated
  USING (true);
