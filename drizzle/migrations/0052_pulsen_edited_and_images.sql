-- Pulsen trin 4/5: "Redigeret"-markering og billeder i privat bucket pulsen-images.
ALTER TABLE public.pulsen_posts ADD COLUMN edited_at timestamptz NULL;

CREATE FUNCTION public.pulsen_posts_mark_edited() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.edited_at := NULL;
  ELSIF NEW.body IS DISTINCT FROM OLD.body AND NEW.deleted_at IS NULL THEN
    NEW.edited_at := now();
  ELSE
    NEW.edited_at := OLD.edited_at;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER pulsen_posts_mark_edited BEFORE INSERT OR UPDATE ON public.pulsen_posts
  FOR EACH ROW EXECUTE FUNCTION public.pulsen_posts_mark_edited();

-- Billedsti skal ligge i forfatterens egen mappe: <employee_id>/<post_id>.webp
ALTER TABLE public.pulsen_posts ADD CONSTRAINT pulsen_posts_image_path_format CHECK (
  image_path IS NULL OR image_path = author_employee_id::text || '/' || id::text || '.webp'
);

-- Storage: skriv/slet kun i egen mappe; læs egen mappe eller billede på et indlæg man kan se.
CREATE POLICY pulsen_images_insert_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pulsen-images'
              AND (storage.foldername(name))[1] = public.effective_employee_id()::text);
CREATE POLICY pulsen_images_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pulsen-images'
         AND (storage.foldername(name))[1] = public.effective_employee_id()::text);
CREATE POLICY pulsen_images_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pulsen-images' AND (
    (storage.foldername(name))[1] = public.effective_employee_id()::text
    OR EXISTS (SELECT 1 FROM public.pulsen_posts p
               WHERE p.image_path = storage.objects.name AND p.deleted_at IS NULL)
  ));