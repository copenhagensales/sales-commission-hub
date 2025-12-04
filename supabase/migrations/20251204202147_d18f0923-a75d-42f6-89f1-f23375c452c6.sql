-- Add OPP number from Adversus to sales for search
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS adversus_opp_number text;

-- Index to make OPP lookups fast
CREATE INDEX IF NOT EXISTS idx_sales_adversus_opp_number
  ON public.sales (adversus_opp_number);

-- Backfill OPP numbers from stored Adversus event payloads
UPDATE public.sales AS s
SET adversus_opp_number = e.payload->'payload'->'lead'->>'id'
FROM public.adversus_events AS e
WHERE s.adversus_event_id = e.id
  AND (s.adversus_opp_number IS NULL OR s.adversus_opp_number = '');