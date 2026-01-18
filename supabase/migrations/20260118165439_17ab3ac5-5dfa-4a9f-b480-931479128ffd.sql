-- Drop existing policies that use invalid auth.users subquery
DROP POLICY IF EXISTS "Only admins can view personnel salaries" ON public.personnel_salaries;
DROP POLICY IF EXISTS "Only admins can insert personnel salaries" ON public.personnel_salaries;
DROP POLICY IF EXISTS "Only admins can update personnel salaries" ON public.personnel_salaries;
DROP POLICY IF EXISTS "Only admins can delete personnel salaries" ON public.personnel_salaries;

-- Recreate policies using is_owner() function
CREATE POLICY "Only admins can view personnel salaries"
  ON public.personnel_salaries FOR SELECT
  TO authenticated
  USING (public.is_owner(auth.uid()));

CREATE POLICY "Only admins can insert personnel salaries"
  ON public.personnel_salaries FOR INSERT
  TO authenticated
  WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY "Only admins can update personnel salaries"
  ON public.personnel_salaries FOR UPDATE
  TO authenticated
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY "Only admins can delete personnel salaries"
  ON public.personnel_salaries FOR DELETE
  TO authenticated
  USING (public.is_owner(auth.uid()));