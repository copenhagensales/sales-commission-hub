ALTER TABLE public.event_invitation_views
  DROP CONSTRAINT event_invitation_views_employee_id_fkey;

ALTER TABLE public.event_invitation_views
  ADD CONSTRAINT event_invitation_views_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.employee_master_data(id) ON DELETE CASCADE;