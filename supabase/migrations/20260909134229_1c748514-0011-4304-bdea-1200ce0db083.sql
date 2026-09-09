CREATE TABLE public.event_gallery_photo_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES public.event_gallery_photos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (photo_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.event_gallery_photo_likes TO authenticated;
GRANT ALL ON public.event_gallery_photo_likes TO service_role;

ALTER TABLE public.event_gallery_photo_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view photo likes"
ON public.event_gallery_photo_likes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can like photos"
ON public.event_gallery_photo_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own like"
ON public.event_gallery_photo_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_event_gallery_photo_likes_photo ON public.event_gallery_photo_likes(photo_id);