
# Plan: Løs Dashboard-Rettighedsproblemer

## Identificerede Problemer

### Problem 1: Manglende Dashboard-Nøgler i Databasen
Auto-seeding funktionen i `PermissionEditor.tsx` (linje 432) kører kun når en rolle har **0 rettigheder**. Da "medarbejder" og andre roller allerede har mange rettigheder, seedes de nyligt tilføjede nøgler (`menu_tv_board_admin`, `menu_dashboard_settings`) aldrig.

**Hvad mangler i databasen:**
- `menu_tv_board_admin` - defineret i permissionKeys.ts men mangler for alle roller
- `menu_dashboard_settings` - defineret i permissionKeys.ts men mangler for alle roller

### Problem 2: "Alle"-kolonnen er kun et Label
Kolonnerne "Alle", "Team", "Kun egen" i tabelhovedet er kun tekst-labels uden onClick-funktionalitet. De viser hvilken synlighed (visibility) der er valgt, men brugeren forventer måske en bulk-handling.

## Løsning

### Trin 1: Database-migration - Seed Manglende Dashboard-Nøgler
Indsæt de manglende permission-nøgler for alle eksisterende roller.

```sql
-- Seed menu_tv_board_admin for alle roller
INSERT INTO role_page_permissions (role_key, permission_key, parent_key, permission_type, can_view, can_edit, visibility)
SELECT DISTINCT 
  rpp.role_key,
  'menu_tv_board_admin',
  'menu_section_dashboards',
  'page',
  CASE WHEN rpp.role_key = 'ejer' THEN true ELSE false END,
  CASE WHEN rpp.role_key = 'ejer' THEN true ELSE false END,
  CASE WHEN rpp.role_key = 'ejer' THEN 'all' ELSE 'self' END
FROM role_page_permissions rpp
WHERE NOT EXISTS (
  SELECT 1 FROM role_page_permissions 
  WHERE role_key = rpp.role_key AND permission_key = 'menu_tv_board_admin'
)
GROUP BY rpp.role_key
ON CONFLICT (role_key, permission_key) DO NOTHING;

-- Seed menu_dashboard_settings for alle roller
INSERT INTO role_page_permissions (role_key, permission_key, parent_key, permission_type, can_view, can_edit, visibility)
SELECT DISTINCT 
  rpp.role_key,
  'menu_dashboard_settings',
  'menu_section_dashboards',
  'page',
  CASE WHEN rpp.role_key = 'ejer' THEN true ELSE false END,
  CASE WHEN rpp.role_key = 'ejer' THEN true ELSE false END,
  CASE WHEN rpp.role_key = 'ejer' THEN 'all' ELSE 'self' END
FROM role_page_permissions rpp
WHERE NOT EXISTS (
  SELECT 1 FROM role_page_permissions 
  WHERE role_key = rpp.role_key AND permission_key = 'menu_dashboard_settings'
)
GROUP BY rpp.role_key
ON CONFLICT (role_key, permission_key) DO NOTHING;
```

### Trin 2: Forbedre Auto-seeding Logik
Opdater `PermissionEditor.tsx` så den synkroniserer manglende nøgler - ikke kun seeder når rollen har 0 rettigheder.

**Ændring i useEffect (linje 429-436):**
```typescript
useEffect(() => {
  if (selectedRole && !permissionsLoading) {
    const existingKeys = permissionsByRole[selectedRole]?.map(p => p.permission_key) || [];
    const missingKeys = ALL_PERMISSION_KEYS.filter(key => !existingKeys.includes(key));
    
    // Seed manglende nøgler - ikke kun når rolePermissionCount === 0
    if (missingKeys.length > 0) {
      seedPermissionsForRole(selectedRole);
    }
  }
}, [selectedRole, permissionsLoading]);
```

### Trin 3: (Valgfrit) Tilføj "Sæt alle"-knap til Tabellens Header
Tilføj klikbare kolonne-headers der kan bulk-opdatere:

| Fil | Ændring |
|-----|---------|
| `src/components/employees/permissions/PermissionEditor.tsx` | Gør "Alle"/"Team"/"Kun egen" headers klikbare for bulk-opdatering |

## Forventet Resultat
1. **Alle 4 dashboard-rettigheder** (`menu_dashboards`, `menu_dashboard_admin`, `menu_tv_board_admin`, `menu_dashboard_settings`) vil vises i Permission Editor
2. **Auto-synkronisering** vil sikre at nye nøgler automatisk tilføjes når roller vælges
3. **(Valgfrit)** Bulk-handlinger vil være tilgængelige via kolonne-headers

## Tekniske Detaljer

### Filer der ændres:

| Fil | Ændring |
|-----|---------|
| `supabase/migrations/` | Ny migration for at seede manglende permission-nøgler |
| `src/components/employees/permissions/PermissionEditor.tsx` | Forbedre auto-seeding logik (linje 429-436) |
