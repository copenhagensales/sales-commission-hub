ALTER TABLE public.it_workstations
  ADD COLUMN IF NOT EXISTS is_occupied boolean NOT NULL DEFAULT true;