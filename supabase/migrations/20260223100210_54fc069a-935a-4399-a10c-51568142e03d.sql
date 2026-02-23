-- Lag 1: Idempotent trigger-funktion for sales internal_reference
CREATE OR REPLACE FUNCTION public.generate_sales_internal_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  v_existing_ref TEXT;
  v_year_month TEXT;
  v_next_val INTEGER;
BEGIN
  -- a) Hvis internal_reference allerede er sat og ikke blank: bevar den
  IF NEW.internal_reference IS NOT NULL AND NEW.internal_reference <> '' THEN
    RETURN NEW;
  END IF;

  -- b) Hvis adversus_external_id findes, slå eksisterende reference op
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

  -- c) Generér nyt MG-YYYYMM-NNNNN nummer via sekvens
  v_year_month := to_char(COALESCE(NEW.sale_datetime, now()), 'YYYYMM');

  INSERT INTO public.sales_reference_sequence (year_month, last_value)
  VALUES (v_year_month, 1)
  ON CONFLICT (year_month)
  DO UPDATE SET last_value = sales_reference_sequence.last_value + 1
  RETURNING last_value INTO v_next_val;

  NEW.internal_reference := 'MG-' || v_year_month || '-' || lpad(v_next_val::text, 5, '0');

  RETURN NEW;
END;
$$;