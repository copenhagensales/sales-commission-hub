CREATE OR REPLACE FUNCTION public.can_manage_event_gallery(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_owner(_user_id)
      OR public.is_superadmin(_user_id)
      OR public.get_user_role(_user_id) = 'teamleder'::public.system_role
      OR public.has_page_permission(_user_id, 'action_manage_event_gallery', false);
$function$;

INSERT INTO public.role_page_permissions (role_key, permission_key, can_view, can_edit, parent_key)
VALUES ('some', 'action_manage_event_gallery', true, true, 'menu_home');