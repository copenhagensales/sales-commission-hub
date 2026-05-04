UPDATE public.league_seasons
SET status = 'completed', updated_at = now()
WHERE id = '1413d941-ed9f-4c55-a7ff-d1bc948eb5da'
  AND status = 'active';