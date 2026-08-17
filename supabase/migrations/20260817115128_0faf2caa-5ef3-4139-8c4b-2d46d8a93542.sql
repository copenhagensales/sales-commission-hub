INSERT INTO public.it_equipment (workstation_id, kind, status)
SELECT w.id, 'desk'::public.it_equipment_kind, 'ok'::public.it_equipment_status
FROM public.it_workstations w
WHERE NOT EXISTS (
  SELECT 1 FROM public.it_equipment e WHERE e.workstation_id = w.id AND e.kind = 'desk'
);