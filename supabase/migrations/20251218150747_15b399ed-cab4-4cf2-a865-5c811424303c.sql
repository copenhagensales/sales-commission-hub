-- Make brand_id nullable since we're transitioning to client_id
ALTER TABLE public.booking
ALTER COLUMN brand_id DROP NOT NULL;