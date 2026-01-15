-- 1. Opret can_manage_permissions() hjælpefunktion
-- Denne funktion sikrer at ejere ALTID har adgang (hardkodet)
-- Andre brugere får adgang hvis de har can_edit på tab_employees_permissions
CREATE OR REPLACE FUNCTION public.can_manage_permissions(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      -- HARDKODET: Ejere har ALTID fuld adgang
      WHEN public.is_owner(_user_id) THEN true
      -- Andre brugere: Tjek om de har can_edit på rettigheds-fanen
      ELSE EXISTS (
        SELECT 1 
        FROM public.role_page_permissions rpp
        JOIN public.system_roles sr ON sr.role::text = rpp.role_key
        WHERE sr.user_id = _user_id
          AND rpp.permission_key = 'tab_employees_permissions'
          AND rpp.can_edit = true
      )
    END
$$;

-- 2. Opdater RLS-politikker på data_visibility_rules
DROP POLICY IF EXISTS "Owners can manage visibility rules" ON public.data_visibility_rules;
DROP POLICY IF EXISTS "Authenticated users can view visibility rules" ON public.data_visibility_rules;
DROP POLICY IF EXISTS "Permission managers can manage visibility rules" ON public.data_visibility_rules;

CREATE POLICY "Anyone can view visibility rules"
ON public.data_visibility_rules FOR SELECT
TO public
USING (true);

CREATE POLICY "Permission managers can manage visibility rules"
ON public.data_visibility_rules FOR ALL
TO authenticated
USING (public.can_manage_permissions(auth.uid()))
WITH CHECK (public.can_manage_permissions(auth.uid()));

-- 3. Opdater RLS-politikker på role_page_permissions
DROP POLICY IF EXISTS "Owners can manage role_page_permissions" ON public.role_page_permissions;
DROP POLICY IF EXISTS "Authenticated users can view role_page_permissions" ON public.role_page_permissions;
DROP POLICY IF EXISTS "Permission managers can manage role_page_permissions" ON public.role_page_permissions;

CREATE POLICY "Anyone can view role_page_permissions"
ON public.role_page_permissions FOR SELECT
TO public
USING (true);

CREATE POLICY "Permission managers can manage role_page_permissions"
ON public.role_page_permissions FOR ALL
TO authenticated
USING (public.can_manage_permissions(auth.uid()))
WITH CHECK (public.can_manage_permissions(auth.uid()));

-- 4. Opdater RLS-politikker på system_role_definitions
DROP POLICY IF EXISTS "Owners can manage role definitions" ON public.system_role_definitions;
DROP POLICY IF EXISTS "Anyone can view system_role_definitions" ON public.system_role_definitions;
DROP POLICY IF EXISTS "Permission managers can manage role definitions" ON public.system_role_definitions;

CREATE POLICY "Anyone can view system_role_definitions"
ON public.system_role_definitions FOR SELECT
TO public
USING (true);

CREATE POLICY "Permission managers can manage role definitions"
ON public.system_role_definitions FOR ALL
TO authenticated
USING (public.can_manage_permissions(auth.uid()))
WITH CHECK (public.can_manage_permissions(auth.uid()));

-- 5. Opret trigger-funktion til at beskytte ejer-rettigheder
CREATE OR REPLACE FUNCTION public.prevent_owner_permission_removal()
RETURNS TRIGGER AS $$
BEGIN
  -- Bloker ændring/sletning af ejer-rettigheder på kritiske permissions
  IF OLD.role_key = 'ejer' AND OLD.permission_key = 'tab_employees_permissions' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Ejer-rettigheder til rettighedsstyring kan ikke slettes';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.can_edit = false THEN
      RAISE EXCEPTION 'Ejer-rettigheder til rettighedsstyring kan ikke deaktiveres';
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Tilføj trigger til role_page_permissions
DROP TRIGGER IF EXISTS protect_owner_permissions ON public.role_page_permissions;

CREATE TRIGGER protect_owner_permissions
BEFORE UPDATE OR DELETE ON public.role_page_permissions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_owner_permission_removal();