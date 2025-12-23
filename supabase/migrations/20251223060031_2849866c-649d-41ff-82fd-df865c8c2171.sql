-- Fix RLS for employee_dashboards to require authenticated users and avoid subqueries

DO $$
BEGIN
  -- Drop old policies if they exist
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='employee_dashboards' AND policyname='Employees can view their own dashboards'
  ) THEN
    EXECUTE 'DROP POLICY "Employees can view their own dashboards" ON public.employee_dashboards';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='employee_dashboards' AND policyname='Employees can create their own dashboards'
  ) THEN
    EXECUTE 'DROP POLICY "Employees can create their own dashboards" ON public.employee_dashboards';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='employee_dashboards' AND policyname='Employees can update their own dashboards'
  ) THEN
    EXECUTE 'DROP POLICY "Employees can update their own dashboards" ON public.employee_dashboards';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='employee_dashboards' AND policyname='Employees can delete their own dashboards'
  ) THEN
    EXECUTE 'DROP POLICY "Employees can delete their own dashboards" ON public.employee_dashboards';
  END IF;
END $$;

-- Read own dashboards
CREATE POLICY "Employees can view their own dashboards"
ON public.employee_dashboards
FOR SELECT
TO authenticated
USING (employee_id = public.get_current_employee_id());

-- Create own dashboards
CREATE POLICY "Employees can create their own dashboards"
ON public.employee_dashboards
FOR INSERT
TO authenticated
WITH CHECK (employee_id = public.get_current_employee_id());

-- Update own dashboards
CREATE POLICY "Employees can update their own dashboards"
ON public.employee_dashboards
FOR UPDATE
TO authenticated
USING (employee_id = public.get_current_employee_id());

-- Delete own dashboards
CREATE POLICY "Employees can delete their own dashboards"
ON public.employee_dashboards
FOR DELETE
TO authenticated
USING (employee_id = public.get_current_employee_id());
