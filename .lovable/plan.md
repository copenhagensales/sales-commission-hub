

# Giv SOME-rollen adgang til Booking Flow — dynamisk via permissions

## Problem
RLS på `booking_flow_steps` bruger kun `is_teamleder_or_above()`, som ikke inkluderer SOME-rollen. Laura har `can_edit: true` på `menu_booking_flow` i permission-systemet, men databasen blokerer hende alligevel.

## Løsning
Opretter en generisk DB-funktion der tjekker `role_page_permissions` dynamisk, så RLS følger permission-systemet i stedet for at hardcode roller.

### 1. Migration — ny funktion + opdaterede RLS policies

**Ny funktion** `has_page_permission(user_id, permission_key, check_edit)`:
```sql
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
      AND rpp.permission_key = _permission_key
      AND rpp.can_view = true
      AND (_check_edit = false OR rpp.can_edit = true)
  )
$$;
```

**Erstat de 4 hardcodede policies** med dynamiske:
```sql
-- Drop gamle
DROP POLICY "Teamledere can view flow steps" ON booking_flow_steps;
DROP POLICY "Teamledere can insert flow steps" ON booking_flow_steps;
DROP POLICY "Teamledere can update flow steps" ON booking_flow_steps;
DROP POLICY "Teamledere can delete flow steps" ON booking_flow_steps;

-- Nye dynamiske policies
CREATE POLICY "Can view flow steps" ON booking_flow_steps
  FOR SELECT USING (has_page_permission(auth.uid(), 'menu_booking_flow'));

CREATE POLICY "Can insert flow steps" ON booking_flow_steps
  FOR INSERT WITH CHECK (has_page_permission(auth.uid(), 'menu_booking_flow', true));

CREATE POLICY "Can update flow steps" ON booking_flow_steps
  FOR UPDATE USING (has_page_permission(auth.uid(), 'menu_booking_flow', true));

CREATE POLICY "Can delete flow steps" ON booking_flow_steps
  FOR DELETE USING (has_page_permission(auth.uid(), 'menu_booking_flow', true));
```

### Resultat
- Laura (SOME) får øjeblikkeligt adgang fordi hun allerede har `can_edit: true` i permission-systemet
- Fremover styres adgangen 100% fra PermissionMap UI — ingen nye migrationer nødvendige
- Owners bevarer adgang via `is_owner` fallback i permission-systemet (de har altid `can_view/can_edit`)
- Ingen kodeændringer nødvendige — kun én migration

