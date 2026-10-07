ALTER TABLE public.dpa_parties ADD COLUMN agreements jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE public.dpa_parties
SET agreements = jsonb_build_array(jsonb_build_object('title', original_title, 'date', original_date, 'brand', null))
WHERE original_title IS NOT NULL OR original_date IS NOT NULL;