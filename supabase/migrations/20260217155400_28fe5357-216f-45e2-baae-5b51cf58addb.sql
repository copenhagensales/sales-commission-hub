
-- Remove NOT NULL so generated types make it optional (trigger always sets it)
ALTER TABLE public.sales ALTER COLUMN internal_reference DROP NOT NULL;
