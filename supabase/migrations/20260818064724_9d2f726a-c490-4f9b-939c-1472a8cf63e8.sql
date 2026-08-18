CREATE TABLE public.user_page_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  permission_key text NOT NULL,
  can_view boolean NOT NULL DEFAULT true,
  can_edit boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'grant',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT user_page_permissions_mode_check CHECK (mode IN ('grant','deny')),
  CONSTRAINT user_page_permissions_unique UNIQUE (user_id, permission_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_page_permissions TO authenticated;
GRANT ALL ON public.user_page_permissions TO service_role;

ALTER TABLE public.user_page_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage user page permissions"
ON public.user_page_permissions
FOR ALL
TO authenticated
USING (public.is_owner(auth.uid()))
WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY "Users can read their own page permissions"
ON public.user_page_permissions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER update_user_page_permissions_updated_at
BEFORE UPDATE ON public.user_page_permissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_user_page_permissions_user ON public.user_page_permissions(user_id);

-- Resolution: personal deny > personal grant > role permission > owner
CREATE OR REPLACE FUNCTION public.has_page_permission(_user_id uuid, _permission_key text, _check_edit boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM user_page_permissions upp
      WHERE upp.user_id = _user_id
        AND upp.permission_key = _permission_key
        AND upp.mode = 'deny'
    ) THEN false
    WHEN EXISTS (
      SELECT 1
      FROM user_page_permissions upp
      JOIN employee_master_data emd ON emd.auth_user_id = _user_id AND emd.is_active = true
      WHERE upp.user_id = _user_id
        AND upp.permission_key = _permission_key
        AND upp.mode = 'grant'
        AND upp.can_view = true
        AND (_check_edit = false OR upp.can_edit = true)
    ) THEN true
    WHEN EXISTS (
      SELECT 1
      FROM role_page_permissions rpp
      JOIN job_positions jp ON jp.system_role_key = rpp.role_key
      JOIN employee_master_data emd ON emd.position_id = jp.id
      WHERE emd.auth_user_id = _user_id
        AND emd.is_active = true
        AND rpp.permission_key = _permission_key
        AND rpp.can_view = true
        AND (_check_edit = false OR rpp.can_edit = true)
    ) THEN true
    ELSE public.is_owner(_user_id)
  END
$function$;

CREATE OR REPLACE FUNCTION public.can_edit_tdc_erhverv_sales(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.has_page_permission(_user_id, 'menu_reports_tdc_edit_sales', false)
$function$;

-- Narrow role-level access: only ejer + salgskonsulent_tdc_support keep it
DELETE FROM public.role_page_permissions
WHERE permission_key = 'menu_reports_tdc_edit_sales'
  AND role_key IN ('teamleder', 'assisterendetm');

-- Personal grants for Rasmus Emil Hansen and Johannes Hedebrink
INSERT INTO public.user_page_permissions (user_id, permission_key, can_view, can_edit, mode)
SELECT emd.auth_user_id, 'menu_reports_tdc_edit_sales', true, true, 'grant'
FROM public.employee_master_data emd
WHERE emd.auth_user_id IS NOT NULL
  AND lower(emd.work_email) IN ('rh@copenhagensales.dk', 'joh@copenhagensales.dk')
ON CONFLICT (user_id, permission_key) DO UPDATE
SET can_view = true, can_edit = true, mode = 'grant';