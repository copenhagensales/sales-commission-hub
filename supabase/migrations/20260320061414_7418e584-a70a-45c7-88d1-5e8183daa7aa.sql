
ALTER TABLE public.candidates ADD COLUMN application_count integer NOT NULL DEFAULT 1;
ALTER TABLE public.candidates ADD COLUMN is_returning_applicant boolean NOT NULL DEFAULT false;
