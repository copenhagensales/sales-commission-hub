CREATE TABLE public.employee_perks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_name text NOT NULL,
  description text,
  redemption_type text NOT NULL DEFAULT 'online',
  discount_code text,
  link_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_perks_redemption_type_check CHECK (redemption_type IN ('online','fysisk','begge'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_perks TO authenticated;
GRANT ALL ON public.employee_perks TO service_role;

CREATE OR REPLACE FUNCTION public.can_manage_employee_perks(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(public.is_owner(_user_id), false)
    OR EXISTS (
      SELECT 1
      FROM public.superadmins s
      JOIN auth.users u ON lower(u.email) = lower(s.email)
      WHERE u.id = _user_id AND s.is_active = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.employee_master_data e
      JOIN public.team_members tm ON tm.employee_id = e.id
      JOIN public.teams t ON t.id = tm.team_id
      WHERE e.auth_user_id = _user_id
        AND e.is_active = true
        AND lower(t.name) = 'stab'
    );
$function$;

ALTER TABLE public.employee_perks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alle kan se aktive fordele"
ON public.employee_perks FOR SELECT TO authenticated
USING (is_active = true OR public.can_manage_employee_perks(auth.uid()));

CREATE POLICY "Forvaltere kan oprette fordele"
ON public.employee_perks FOR INSERT TO authenticated
WITH CHECK (public.can_manage_employee_perks(auth.uid()));

CREATE POLICY "Forvaltere kan rette fordele"
ON public.employee_perks FOR UPDATE TO authenticated
USING (public.can_manage_employee_perks(auth.uid()))
WITH CHECK (public.can_manage_employee_perks(auth.uid()));

CREATE POLICY "Forvaltere kan slette fordele"
ON public.employee_perks FOR DELETE TO authenticated
USING (public.can_manage_employee_perks(auth.uid()));

CREATE TRIGGER update_employee_perks_updated_at
BEFORE UPDATE ON public.employee_perks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();