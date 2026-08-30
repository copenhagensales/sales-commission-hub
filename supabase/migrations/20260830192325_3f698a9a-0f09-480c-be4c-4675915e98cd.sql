DROP POLICY IF EXISTS "Salary details are readable by authorised users" ON public.employee_salary_details;

CREATE POLICY "Salary details are readable by authorised users"
ON public.employee_salary_details
FOR SELECT
TO authenticated
USING (
  public.is_superadmin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.employee_master_data e
    WHERE e.id = employee_salary_details.employee_id
      AND e.auth_user_id = auth.uid()
  )
  OR (
    NOT public.is_protected_salary_employee(employee_id)
    AND percentage_rate IS NULL
    AND minimum_salary IS NULL
    AND (
      public.is_owner(auth.uid())
      OR public.is_rekruttering(auth.uid())
      OR public.is_fieldmarketing_leder(auth.uid())
      OR (public.is_teamleder_or_above(auth.uid()) AND public.can_view_employee(employee_id, auth.uid()))
    )
  )
);

DROP POLICY IF EXISTS "Salary details insert" ON public.employee_salary_details;

CREATE POLICY "Salary details insert"
ON public.employee_salary_details
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_superadmin(auth.uid())
  OR (
    NOT public.is_protected_salary_employee(employee_id)
    AND percentage_rate IS NULL
    AND minimum_salary IS NULL
    AND (
      public.is_owner(auth.uid())
      OR public.is_rekruttering(auth.uid())
      OR (public.is_teamleder_or_above(auth.uid()) AND public.can_view_employee(employee_id, auth.uid()))
    )
  )
);

DROP POLICY IF EXISTS "Salary details update" ON public.employee_salary_details;

CREATE POLICY "Salary details update"
ON public.employee_salary_details
FOR UPDATE
TO authenticated
USING (
  public.is_superadmin(auth.uid())
  OR (
    NOT public.is_protected_salary_employee(employee_id)
    AND percentage_rate IS NULL
    AND minimum_salary IS NULL
    AND (
      public.is_owner(auth.uid())
      OR public.is_rekruttering(auth.uid())
      OR (public.is_teamleder_or_above(auth.uid()) AND public.can_view_employee(employee_id, auth.uid()))
    )
  )
)
WITH CHECK (
  public.is_superadmin(auth.uid())
  OR (
    NOT public.is_protected_salary_employee(employee_id)
    AND percentage_rate IS NULL
    AND minimum_salary IS NULL
    AND (
      public.is_owner(auth.uid())
      OR public.is_rekruttering(auth.uid())
      OR (public.is_teamleder_or_above(auth.uid()) AND public.can_view_employee(employee_id, auth.uid()))
    )
  )
);