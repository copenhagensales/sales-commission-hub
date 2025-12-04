-- Create security definer function to check vagt_flow role without RLS recursion
CREATE OR REPLACE FUNCTION public.is_vagt_admin_or_planner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employee
    WHERE id = _user_id AND role IN ('admin', 'planner')
  )
$$;

-- Drop existing problematic policies on employee
DROP POLICY IF EXISTS "Admin and planners can manage employees" ON public.employee;
DROP POLICY IF EXISTS "All employees can view other employees" ON public.employee;
DROP POLICY IF EXISTS "Employees can view themselves" ON public.employee;

-- Recreate policies using security definer function
CREATE POLICY "All authenticated can view employees"
ON public.employee
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin and planners can manage employees"
ON public.employee
FOR ALL
TO authenticated
USING (public.is_vagt_admin_or_planner(auth.uid()))
WITH CHECK (public.is_vagt_admin_or_planner(auth.uid()));

-- Fix similar issues on other tables that reference employee role
DROP POLICY IF EXISTS "Admin and planners can manage bookings" ON public.booking;
DROP POLICY IF EXISTS "Employees can view all bookings" ON public.booking;

CREATE POLICY "All authenticated can view bookings"
ON public.booking
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin and planners can manage bookings"
ON public.booking
FOR ALL
TO authenticated
USING (public.is_vagt_admin_or_planner(auth.uid()))
WITH CHECK (public.is_vagt_admin_or_planner(auth.uid()));

-- Fix location policies
DROP POLICY IF EXISTS "Admin and planners can manage locations" ON public.location;
DROP POLICY IF EXISTS "Employees can view locations" ON public.location;

CREATE POLICY "All authenticated can view locations"
ON public.location
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin and planners can manage locations"
ON public.location
FOR ALL
TO authenticated
USING (public.is_vagt_admin_or_planner(auth.uid()))
WITH CHECK (public.is_vagt_admin_or_planner(auth.uid()));

-- Fix booking_assignment policies
DROP POLICY IF EXISTS "Admin and planners can manage assignments" ON public.booking_assignment;
DROP POLICY IF EXISTS "Employees can view all assignments" ON public.booking_assignment;
DROP POLICY IF EXISTS "Employees can update their on_my_way status" ON public.booking_assignment;

CREATE POLICY "All authenticated can view assignments"
ON public.booking_assignment
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin and planners can manage assignments"
ON public.booking_assignment
FOR ALL
TO authenticated
USING (public.is_vagt_admin_or_planner(auth.uid()))
WITH CHECK (public.is_vagt_admin_or_planner(auth.uid()));

CREATE POLICY "Employees can update their own assignment status"
ON public.booking_assignment
FOR UPDATE
TO authenticated
USING (employee_id = auth.uid());

-- Fix employee_absence policies
DROP POLICY IF EXISTS "Admin and planners can manage absences" ON public.employee_absence;
DROP POLICY IF EXISTS "Employees can view their absences" ON public.employee_absence;

CREATE POLICY "Admin and planners can view all absences"
ON public.employee_absence
FOR SELECT
TO authenticated
USING (public.is_vagt_admin_or_planner(auth.uid()) OR employee_id = auth.uid());

CREATE POLICY "Admin and planners can manage absences"
ON public.employee_absence
FOR ALL
TO authenticated
USING (public.is_vagt_admin_or_planner(auth.uid()))
WITH CHECK (public.is_vagt_admin_or_planner(auth.uid()));

-- Fix brand policies
DROP POLICY IF EXISTS "Admins can manage brands" ON public.brand;
DROP POLICY IF EXISTS "Everyone can view brands" ON public.brand;

CREATE POLICY "All authenticated can view brands"
ON public.brand
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin and planners can manage brands"
ON public.brand
FOR ALL
TO authenticated
USING (public.is_vagt_admin_or_planner(auth.uid()))
WITH CHECK (public.is_vagt_admin_or_planner(auth.uid()));

-- Fix vehicle policies
DROP POLICY IF EXISTS "Admins can manage vehicles" ON public.vehicle;
DROP POLICY IF EXISTS "Everyone can view vehicles" ON public.vehicle;

CREATE POLICY "All authenticated can view vehicles"
ON public.vehicle
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin and planners can manage vehicles"
ON public.vehicle
FOR ALL
TO authenticated
USING (public.is_vagt_admin_or_planner(auth.uid()))
WITH CHECK (public.is_vagt_admin_or_planner(auth.uid()));