-- 1. Nye permission-nøgler for rollen 'some'
INSERT INTO public.role_page_permissions (role_key, permission_key, parent_key, permission_type, can_view, can_edit, description)
VALUES
  ('some', 'action_manage_company_events', 'menu_home', 'action', true, true, 'Opret/redigér begivenheder'),
  ('some', 'action_manage_candidate_messages', 'menu_messages', 'action', true, true, 'Besvar kandidat-beskeder')
ON CONFLICT (role_key, permission_key) DO UPDATE
  SET can_view = true, can_edit = true;

-- 2. Eksisterende flag for rollen 'some'
UPDATE public.role_page_permissions SET can_view = true
  WHERE role_key = 'some' AND permission_key = 'menu_section_personale';

UPDATE public.role_page_permissions SET can_view = true, visibility = 'all'
  WHERE role_key = 'some' AND permission_key = 'menu_upcoming_starts';

UPDATE public.role_page_permissions SET can_view = true, can_edit = true, visibility = 'all'
  WHERE role_key = 'some' AND permission_key = 'menu_upcoming_hires';

UPDATE public.role_page_permissions SET can_view = true, can_edit = true
  WHERE role_key = 'some' AND permission_key IN ('menu_messages', 'menu_messages_recruitment');

UPDATE public.role_page_permissions SET can_view = true
  WHERE role_key = 'some'
    AND permission_key IN ('tab_messages_all', 'tab_messages_sms', 'tab_messages_email', 'tab_messages_sent');

-- 3. company_events: permission-drevet ud over leder-adgang
DROP POLICY IF EXISTS "Managers can manage events" ON public.company_events;
CREATE POLICY "Managers or permitted roles can manage events"
ON public.company_events
FOR ALL
TO authenticated
USING (
  public.is_manager_or_above(auth.uid())
  OR public.has_edit_permission(auth.uid(), 'action_manage_company_events')
)
WITH CHECK (
  public.is_manager_or_above(auth.uid())
  OR public.has_edit_permission(auth.uid(), 'action_manage_company_events')
);

-- 4. messages: permission-drevet ud over rekruttering/ejer
DROP POLICY IF EXISTS "Rekruttering and owners can manage messages" ON public.messages;
CREATE POLICY "Rekruttering, owners or permitted roles can manage messages"
ON public.messages
FOR ALL
TO authenticated
USING (
  public.is_owner(auth.uid())
  OR public.is_rekruttering(auth.uid())
  OR public.has_edit_permission(auth.uid(), 'action_manage_candidate_messages')
)
WITH CHECK (
  public.is_owner(auth.uid())
  OR public.is_rekruttering(auth.uid())
  OR public.has_edit_permission(auth.uid(), 'action_manage_candidate_messages')
);

-- 5. communication_logs: læsning/opdatering af kandidat-tråde
DROP POLICY IF EXISTS "Context-aware read access" ON public.communication_logs;
CREATE POLICY "Context-aware read access"
ON public.communication_logs
FOR SELECT
USING (
  (context_type = 'candidate' AND (
      public.is_rekruttering(auth.uid())
      OR public.is_owner(auth.uid())
      OR public.has_edit_permission(auth.uid(), 'action_manage_candidate_messages')
  ))
  OR (context_type = 'employee' AND (
      sender_employee_id = public.get_current_employee_id()
      OR target_employee_id = public.get_current_employee_id()
  ))
  OR (context_type IS NULL AND (
      public.is_rekruttering(auth.uid())
      OR public.is_owner(auth.uid())
      OR public.has_edit_permission(auth.uid(), 'action_manage_candidate_messages')
  ))
);

DROP POLICY IF EXISTS "Users can update accessible messages" ON public.communication_logs;
CREATE POLICY "Users can update accessible messages"
ON public.communication_logs
FOR UPDATE
USING (
  (context_type = 'candidate' AND (
      public.is_rekruttering(auth.uid())
      OR public.is_owner(auth.uid())
      OR public.has_edit_permission(auth.uid(), 'action_manage_candidate_messages')
  ))
  OR (context_type = 'employee' AND (
      sender_employee_id = public.get_current_employee_id()
      OR target_employee_id = public.get_current_employee_id()
  ))
  OR (context_type IS NULL AND (
      public.is_rekruttering(auth.uid())
      OR public.is_owner(auth.uid())
      OR public.has_edit_permission(auth.uid(), 'action_manage_candidate_messages')
  ))
);