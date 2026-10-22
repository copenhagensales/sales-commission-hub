ALTER TABLE public.pulsen_posts ADD COLUMN praised_employee_ids uuid[] NOT NULL DEFAULT '{}';
UPDATE public.pulsen_posts SET praised_employee_ids = ARRAY[praised_employee_id] WHERE praised_employee_id IS NOT NULL;
ALTER TABLE public.pulsen_posts ADD CONSTRAINT pulsen_posts_praised_ids_valid CHECK (
  cardinality(praised_employee_ids) <= 10
  AND (post_type = 'praise') = (cardinality(praised_employee_ids) > 0)
  AND (cardinality(praised_employee_ids) = 0 OR praised_employee_ids[1] = praised_employee_id)
);
CREATE OR REPLACE FUNCTION public.pulsen_posts_lock_praised_ids()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.praised_employee_ids IS DISTINCT FROM OLD.praised_employee_ids THEN
    RAISE EXCEPTION 'Disse felter kan ikke ændres' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER pulsen_posts_lock_praised_ids BEFORE UPDATE ON public.pulsen_posts
  FOR EACH ROW EXECUTE FUNCTION public.pulsen_posts_lock_praised_ids();