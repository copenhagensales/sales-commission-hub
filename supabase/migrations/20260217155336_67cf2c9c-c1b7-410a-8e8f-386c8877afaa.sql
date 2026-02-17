
-- Step 1: Create sequence table
CREATE TABLE public.sales_reference_sequence (
  year_month TEXT PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

-- RLS on sequence table (service role only)
ALTER TABLE public.sales_reference_sequence ENABLE ROW LEVEL SECURITY;

-- Step 2: Add internal_reference column
ALTER TABLE public.sales ADD COLUMN internal_reference TEXT;
CREATE UNIQUE INDEX idx_sales_internal_reference ON public.sales (internal_reference);

-- Step 3: Create trigger function
CREATE OR REPLACE FUNCTION public.generate_sales_internal_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  v_year_month TEXT;
  v_next_number INTEGER;
BEGIN
  -- Derive year_month from sale_datetime, fallback to now()
  v_year_month := to_char(COALESCE(NEW.sale_datetime, now()), 'YYYYMM');

  -- Atomic upsert to get next number
  INSERT INTO public.sales_reference_sequence (year_month, last_number)
  VALUES (v_year_month, 1)
  ON CONFLICT (year_month)
  DO UPDATE SET last_number = sales_reference_sequence.last_number + 1
  RETURNING last_number INTO v_next_number;

  -- Set the internal reference
  NEW.internal_reference := 'MG-' || v_year_month || '-' || lpad(v_next_number::text, 5, '0');

  RETURN NEW;
END;
$$;

-- Step 4: Create trigger (BEFORE INSERT)
CREATE TRIGGER trg_generate_sales_internal_reference
BEFORE INSERT ON public.sales
FOR EACH ROW
WHEN (NEW.internal_reference IS NULL)
EXECUTE FUNCTION public.generate_sales_internal_reference();

-- Step 5: Backfill all existing sales chronologically
DO $$
DECLARE
  v_rec RECORD;
  v_year_month TEXT;
  v_next_number INTEGER;
BEGIN
  FOR v_rec IN
    SELECT id, sale_datetime
    FROM public.sales
    WHERE internal_reference IS NULL
    ORDER BY COALESCE(sale_datetime, created_at) ASC
  LOOP
    v_year_month := to_char(COALESCE(v_rec.sale_datetime, now()), 'YYYYMM');

    INSERT INTO public.sales_reference_sequence (year_month, last_number)
    VALUES (v_year_month, 1)
    ON CONFLICT (year_month)
    DO UPDATE SET last_number = sales_reference_sequence.last_number + 1
    RETURNING last_number INTO v_next_number;

    UPDATE public.sales
    SET internal_reference = 'MG-' || v_year_month || '-' || lpad(v_next_number::text, 5, '0')
    WHERE id = v_rec.id;
  END LOOP;
END;
$$;

-- Step 6: Preserve OPP values in raw_payload before dropping the column
UPDATE public.sales
SET raw_payload = COALESCE(raw_payload, '{}'::jsonb) || jsonb_build_object('legacy_opp_number', adversus_opp_number)
WHERE adversus_opp_number IS NOT NULL AND adversus_opp_number != '';

-- Step 7: Drop the adversus_opp_number column and its index
DROP INDEX IF EXISTS idx_sales_adversus_opp_number;
ALTER TABLE public.sales DROP COLUMN IF EXISTS adversus_opp_number;

-- Step 8: Make internal_reference NOT NULL and add format constraint
ALTER TABLE public.sales ALTER COLUMN internal_reference SET NOT NULL;
ALTER TABLE public.sales ADD CONSTRAINT sales_internal_reference_format_chk
  CHECK (internal_reference ~ '^MG-\d{6}-\d{5}$');
