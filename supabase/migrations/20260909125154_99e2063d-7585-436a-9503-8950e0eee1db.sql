CREATE TABLE public.event_gallery_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  storage_path text NOT NULL,
  title text,
  event_date date,
  sort_order integer NOT NULL DEFAULT 0,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_gallery_photos_order ON public.event_gallery_photos (sort_order, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_gallery_photos TO authenticated;
GRANT ALL ON public.event_gallery_photos TO service_role;

ALTER TABLE public.event_gallery_photos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_event_gallery(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_owner(_user_id)
      OR public.is_superadmin(_user_id)
      OR public.get_user_role(_user_id) = 'teamleder'::public.system_role;
$$;

CREATE POLICY "Authenticated can view gallery photos"
  ON public.event_gallery_photos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Leaders can insert gallery photos"
  ON public.event_gallery_photos FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_event_gallery(auth.uid()));

CREATE POLICY "Leaders can update gallery photos"
  ON public.event_gallery_photos FOR UPDATE TO authenticated
  USING (public.can_manage_event_gallery(auth.uid()))
  WITH CHECK (public.can_manage_event_gallery(auth.uid()));

CREATE POLICY "Leaders can delete gallery photos"
  ON public.event_gallery_photos FOR DELETE TO authenticated
  USING (public.can_manage_event_gallery(auth.uid()));

CREATE POLICY "Authenticated can read event photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'event-photos');

CREATE POLICY "Leaders can upload event photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'event-photos' AND public.can_manage_event_gallery(auth.uid()));

CREATE POLICY "Leaders can update event photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'event-photos' AND public.can_manage_event_gallery(auth.uid()));

CREATE POLICY "Leaders can delete event photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'event-photos' AND public.can_manage_event_gallery(auth.uid()));