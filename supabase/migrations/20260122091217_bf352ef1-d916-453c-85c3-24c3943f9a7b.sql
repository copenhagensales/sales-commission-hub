-- RLS policies for economic_invoices (restrict to managers/owners)
DO $$
BEGIN
  -- SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'economic_invoices' AND policyname = 'Managers can view economic invoices'
  ) THEN
    CREATE POLICY "Managers can view economic invoices"
    ON public.economic_invoices
    FOR SELECT
    USING (public.is_manager_or_above(auth.uid()));
  END IF;

  -- INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'economic_invoices' AND policyname = 'Managers can insert economic invoices'
  ) THEN
    CREATE POLICY "Managers can insert economic invoices"
    ON public.economic_invoices
    FOR INSERT
    WITH CHECK (public.is_manager_or_above(auth.uid()));
  END IF;

  -- UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'economic_invoices' AND policyname = 'Managers can update economic invoices'
  ) THEN
    CREATE POLICY "Managers can update economic invoices"
    ON public.economic_invoices
    FOR UPDATE
    USING (public.is_manager_or_above(auth.uid()))
    WITH CHECK (public.is_manager_or_above(auth.uid()));
  END IF;

  -- DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'economic_invoices' AND policyname = 'Managers can delete economic invoices'
  ) THEN
    CREATE POLICY "Managers can delete economic invoices"
    ON public.economic_invoices
    FOR DELETE
    USING (public.is_manager_or_above(auth.uid()));
  END IF;
END $$;