
-- Create dynamic permission check function
CREATE OR REPLACE FUNCTION public.has_page_permission(
  _user_id uuid, _permission_key text, _check_edit boolean DEFAULT false
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM role_page_permissions rpp
    JOIN job_positions jp ON jp.system_role_key = rpp.role_key
    JOIN employee_master_data emd ON emd.position_id = jp.id
    WHERE emd.auth_user_id = _user_id
      AND emd.is_active = true
      AND rpp.permission_key = _permission_key
      AND rpp.can_view = true
      AND (_check_edit = false OR rpp.can_edit = true)
  )
  OR public.is_owner(_user_id)
$$;

-- Drop old hardcoded policies
DROP POLICY IF EXISTS "Teamledere can view flow steps" ON booking_flow_steps;
DROP POLICY IF EXISTS "Teamledere can insert flow steps" ON booking_flow_steps;
DROP POLICY IF EXISTS "Teamledere can update flow steps" ON booking_flow_steps;
DROP POLICY IF EXISTS "Teamledere can delete flow steps" ON booking_flow_steps;

-- Create dynamic policies
CREATE POLICY "Can view flow steps" ON booking_flow_steps
  FOR SELECT USING (has_page_permission(auth.uid(), 'menu_booking_flow'));

CREATE POLICY "Can insert flow steps" ON booking_flow_steps
  FOR INSERT WITH CHECK (has_page_permission(auth.uid(), 'menu_booking_flow', true));

CREATE POLICY "Can update flow steps" ON booking_flow_steps
  FOR UPDATE USING (has_page_permission(auth.uid(), 'menu_booking_flow', true));

CREATE POLICY "Can delete flow steps" ON booking_flow_steps
  FOR DELETE USING (has_page_permission(auth.uid(), 'menu_booking_flow', true));
