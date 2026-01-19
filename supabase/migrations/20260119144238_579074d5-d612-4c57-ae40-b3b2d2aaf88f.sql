-- Allow location deletion by setting related fieldmarketing_sales location_id to NULL
ALTER TABLE public.fieldmarketing_sales
DROP CONSTRAINT IF EXISTS fieldmarketing_sales_location_id_fkey;

ALTER TABLE public.fieldmarketing_sales
ADD CONSTRAINT fieldmarketing_sales_location_id_fkey
FOREIGN KEY (location_id) REFERENCES public.location(id) ON DELETE SET NULL;