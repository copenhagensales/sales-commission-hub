-- Primero, eliminar duplicados manteniendo solo el más reciente por adversus_external_id
DELETE FROM public.sales
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY adversus_external_id ORDER BY created_at DESC) AS rnum
    FROM public.sales
    WHERE adversus_external_id IS NOT NULL
  ) t
  WHERE t.rnum > 1
);

-- Agregar restricción única para que el upsert funcione correctamente
ALTER TABLE public.sales
ADD CONSTRAINT sales_adversus_external_id_key UNIQUE (adversus_external_id);