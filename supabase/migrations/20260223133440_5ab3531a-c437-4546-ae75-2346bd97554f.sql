CREATE OR REPLACE FUNCTION public.generate_sales_internal_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_ref TEXT;
  v_year_month TEXT;
  v_next_val INTEGER;
BEGIN
  IF NEW.internal_reference IS NOT NULL AND NEW.internal_reference <> '' THEN
    RETURN NEW;
  END IF;

  IF NEW.adversus_external_id IS NOT NULL THEN
    SELECT internal_reference INTO v_existing_ref
    FROM public.sales
    WHERE adversus_external_id = NEW.adversus_external_id
      AND internal_reference IS NOT NULL
    LIMIT 1;

    IF v_existing_ref IS NOT NULL THEN
      NEW.internal_reference := v_existing_ref;
      RETURN NEW;
    END IF;
  END IF;

  v_year_month := to_char(COALESCE(NEW.sale_datetime, now()), 'YYYYMM');

  INSERT INTO public.sales_reference_sequence (year_month, last_number)
  VALUES (v_year_month, 1)
  ON CONFLICT (year_month)
  DO UPDATE SET last_number = sales_reference_sequence.last_number + 1
  RETURNING last_number INTO v_next_val;

  NEW.internal_reference := 'MG-' || v_year_month || '-' || lpad(v_next_val::text, 5, '0');

  RETURN NEW;
END;
$$;