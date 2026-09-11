ALTER TABLE public.feed_reactions DROP CONSTRAINT feed_reactions_emoji_check;

UPDATE public.feed_reactions SET emoji = CASE emoji
  WHEN 'clap' THEN '👏'
  WHEN 'party' THEN '🎉'
  WHEN 'fire' THEN '🔥'
  ELSE emoji END
WHERE emoji IN ('clap','party','fire');

ALTER TABLE public.feed_reactions
  ADD CONSTRAINT feed_reactions_emoji_check
  CHECK (char_length(emoji) BETWEEN 1 AND 8);