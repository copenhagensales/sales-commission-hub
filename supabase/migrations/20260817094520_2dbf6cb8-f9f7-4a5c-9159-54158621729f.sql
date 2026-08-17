ALTER TABLE public.it_area_edges
  ADD COLUMN IF NOT EXISTS seats_per_row integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS row_gap_after integer[] NOT NULL DEFAULT '{}'::integer[];

ALTER TABLE public.it_area_edges
  ADD CONSTRAINT it_area_edges_seats_per_row_check CHECK (seats_per_row BETWEEN 1 AND 12);