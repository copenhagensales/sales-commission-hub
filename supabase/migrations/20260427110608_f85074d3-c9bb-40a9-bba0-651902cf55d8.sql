-- Opret R6 (finalerunde) for aktiv sæson
INSERT INTO public.league_rounds (season_id, round_number, start_date, end_date, status)
SELECT id, 6, '2026-04-27 00:00:00+00', '2026-05-04 00:00:00+00', 'active'
FROM public.league_seasons
WHERE status = 'active' AND season_number = 1
AND NOT EXISTS (
  SELECT 1 FROM public.league_rounds r
  WHERE r.season_id = league_seasons.id AND r.round_number = 6
);