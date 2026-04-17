CREATE TABLE public.code_of_conduct_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  snoozed_until TIMESTAMPTZ,
  snooze_count INTEGER NOT NULL DEFAULT 0,
  acknowledged_at TIMESTAMPTZ
);

CREATE INDEX idx_coc_reminders_employee_active 
  ON public.code_of_conduct_reminders(employee_id, acknowledged_at);

ALTER TABLE public.code_of_conduct_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminders"
ON public.code_of_conduct_reminders
FOR SELECT
TO authenticated
USING (employee_id = public.get_current_employee_id());

CREATE POLICY "Users can update own reminders"
ON public.code_of_conduct_reminders
FOR UPDATE
TO authenticated
USING (employee_id = public.get_current_employee_id());

CREATE POLICY "Admins can view all reminders"
ON public.code_of_conduct_reminders
FOR SELECT
TO authenticated
USING (
  public.has_page_permission(auth.uid(), 'menu_coc_admin', false)
  OR public.is_owner(auth.uid())
);

CREATE POLICY "Admins can create reminders"
ON public.code_of_conduct_reminders
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_page_permission(auth.uid(), 'menu_coc_admin', false)
  OR public.is_owner(auth.uid())
);

CREATE POLICY "Admins can delete reminders"
ON public.code_of_conduct_reminders
FOR DELETE
TO authenticated
USING (
  public.has_page_permission(auth.uid(), 'menu_coc_admin', false)
  OR public.is_owner(auth.uid())
);