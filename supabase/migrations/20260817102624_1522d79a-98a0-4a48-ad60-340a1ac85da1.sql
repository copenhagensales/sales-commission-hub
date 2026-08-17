ALTER TABLE public.it_area_edges
ADD COLUMN IF NOT EXISTS row_sizes integer[] NOT NULL DEFAULT '{}'::integer[];