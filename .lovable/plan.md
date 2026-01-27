
# Plan: Giv Lone Mikkelsen ejer-adgang (hardkodet)

## Overblik
Lone Mikkelsen skal have samme adgang som Kasper og Mathias ved at ændre hendes position fra "Backoffice" til "Ejer" og opdatere hendes system-rolle.

## Nuværende status

| Felt | Lone Mikkelsen | Kasper Mikkelsen |
|------|----------------|------------------|
| job_title | Ejer ✓ | Ejer |
| position_name | Backoffice ❌ | Ejer |
| system_role_key | medarbejder ❌ | ejer |
| auth_user_id | e1ac7b84-aedb-400e-88f6-dd24687317e4 | f0fb7ec3-5f00-4fcd-a6ca-2a53669147b9 |
| employee_id | b27dc376-f821-4b66-abc6-a99a906936ae | f6d3dcde-81ef-498f-b4ac-8da218408eee |

---

## Løsning

### Database-ændringer

**1. Opdater Lone's position til "Ejer":**
```sql
UPDATE employee_master_data 
SET position_id = '1ef14dcc-018a-4c0a-91a4-d6a5c4ea5737'  -- Ejer position
WHERE id = 'b27dc376-f821-4b66-abc6-a99a906936ae';         -- Lone Mikkelsen
```

**2. Opdater system_roles til "ejer":**
```sql
UPDATE system_roles 
SET role = 'ejer' 
WHERE user_id = 'e1ac7b84-aedb-400e-88f6-dd24687317e4';    -- Lone's auth_user_id
```

---

## Resultat efter ændringer

| Felt | Lone Mikkelsen (efter) |
|------|------------------------|
| position_name | Ejer ✓ |
| system_role_key | ejer ✓ |
| Løn-adgang | Fuld adgang ✓ |

---

## Bemærkning
Ingen kodeændringer kræves - kun database-opdateringer. 

Lone vil automatisk få fuld ejer-adgang via `useUnifiedPermissions` hook'en, som tjekker `system_roles` tabellen først og derefter `position_id → job_positions.system_role_key`.
