
-- Drop the old unique constraint that only uses adversus_external_id
ALTER TABLE public.adversus_product_mappings DROP CONSTRAINT IF EXISTS adversus_product_mappings_adversus_external_id_key;
