ALTER TABLE public.lead_closing_statuses
  ADD COLUMN IF NOT EXISTS counts_in_hitrate boolean NOT NULL DEFAULT true;

UPDATE public.lead_closing_statuses
SET counts_in_hitrate = false
WHERE status IN ('invalid', 'unqualified');