-- Backfill: re-aktiver sæson 1 og runde 6 midlertidigt så league-process-round kan generere manglende standings
UPDATE public.league_seasons
SET status = 'active', updated_at = now()
WHERE id = '1413d941-ed9f-4c55-a7ff-d1bc948eb5da'
  AND status = 'completed';

UPDATE public.league_rounds
SET status = 'active'
WHERE id = '09f7c6fd-1906-4c16-8594-c0b97c9bf1c0'
  AND status = 'completed';