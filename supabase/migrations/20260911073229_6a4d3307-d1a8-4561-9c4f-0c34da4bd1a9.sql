CREATE TABLE public.feed_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_type text NOT NULL CHECK (target_type IN ('birthday','anniversary','league_round')),
  target_key text NOT NULL,
  user_id uuid NOT NULL,
  emoji text NOT NULL CHECK (emoji IN ('clap','party','fire')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX feed_reactions_unique ON public.feed_reactions (target_type, target_key, user_id, emoji);
CREATE INDEX idx_feed_reactions_target ON public.feed_reactions (target_type, target_key);

GRANT SELECT, INSERT, DELETE ON public.feed_reactions TO authenticated;
GRANT ALL ON public.feed_reactions TO service_role;

ALTER TABLE public.feed_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view feed reactions"
  ON public.feed_reactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can add own feed reactions"
  ON public.feed_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own feed reactions"
  ON public.feed_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.feed_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_type text NOT NULL CHECK (target_type IN ('birthday','anniversary','league_round')),
  target_key text NOT NULL,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_feed_comments_target ON public.feed_comments (target_type, target_key, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.feed_comments TO authenticated;
GRANT ALL ON public.feed_comments TO service_role;

ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view feed comments"
  ON public.feed_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can add own feed comments"
  ON public.feed_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own feed comments"
  ON public.feed_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.validate_feed_comment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.body := btrim(NEW.body);
  IF NEW.body = '' THEN
    RAISE EXCEPTION 'Beskeden må ikke være tom';
  END IF;
  IF length(NEW.body) > 200 THEN
    RAISE EXCEPTION 'Beskeden må højst være 200 tegn';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_feed_comment_before_insert
  BEFORE INSERT ON public.feed_comments
  FOR EACH ROW EXECUTE FUNCTION public.validate_feed_comment();