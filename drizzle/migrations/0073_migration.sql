INSERT INTO public.weekly_lead_closure_locks (week_start, run_id)
SELECT w, '43be161f-e56e-4800-8259-671e7c343829'::uuid FROM (
  SELECT week_start w FROM public.weekly_lead_closure_stats WHERE week_start <= '2026-10-19'
  UNION SELECT week_start FROM public.weekly_lead_call_stats WHERE week_start <= '2026-10-19'
) s
ON CONFLICT (week_start) DO NOTHING;