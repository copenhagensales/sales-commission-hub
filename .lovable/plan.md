
# Plan: Ejer Fuld Adgang - Med Løn-undtagelse for William

## Oversigt
Sikre at alle Ejere har fuld adgang til ALT undtagen:
1. **Softphone-funktioner** (allerede undtaget via `OWNER_EXCLUDED_PERMISSIONS`)
2. **Løn-adgang for William Hoé Seiding** (hardcoded undtagelse)

## Nuværende Situation

### William Hoé Seiding
- **auth_user_id:** `9ad9b492-8c14-4d0f-96aa-1e867823fe91`
- **job_title:** Ejer
- **Email:** ws@copenhagensales.dk

### Løn-beskyttelse i dag
Løn-menuen er allerede hardcoded i `AppSidebar.tsx`:
```typescript
const SALARY_ALLOWED_USER_IDS = [
  'f0fb7ec3-5f00-4fcd-a6ca-2a53669147b9', // Kasper Mikkelsen
  '71267f4e-fd9e-4c16-8fe9-da0f48ce2598', // Mathias Grubak
  'e1ac7b84-aedb-400e-88f6-dd24687317e4', // Lone Mikkelsen
];
```
William er IKKE i denne liste - så løn-menuen er allerede skjult for ham.

## Løsning

### Fase 1: Tilføj manglende scopeKey
**Fil:** `src/config/permissions.ts` (linje 834-838)

```typescript
{
  key: "menu_reports_daily",
  label: "Dagsrapporter",
  description: "Adgang til daglige rapporter med vagtregistrering",
  hasEditOption: false,
  scopeKey: "scope_reports_daily",  // TILFØJET
},
```

### Fase 2: Opret SALARY_EXCLUDED_OWNER_IDS konstant
**Fil:** `src/hooks/usePositionPermissions.ts`

Tilføj ny konstant til at definere Ejere der IKKE skal have løn-adgang:

```typescript
// Owners excluded from salary access (still get all other permissions)
const SALARY_EXCLUDED_OWNER_IDS = [
  '9ad9b492-8c14-4d0f-96aa-1e867823fe91', // William Hoé Seiding
];

// Permission keys related to salary
const SALARY_PERMISSION_KEYS = [
  'menu_section_salary',
  'menu_payroll',
  'menu_salary_types',
  'scope_payroll',
];
```

### Fase 3: Opdater usePermissions() med owner-override og salary-undtagelse
**Fil:** `src/hooks/usePositionPermissions.ts`

Opdater `hasPermission`, `canView`, `canEdit` og `getDataScope`:

```typescript
export function usePermissions() {
  const { user } = useAuth();
  const { data, isLoading, ... } = usePositionPermissions();
  
  // Check if current user is an owner
  const isOwner = data?.roleKey === 'ejer';
  
  // Check if this owner is excluded from salary access
  const isOwnerExcludedFromSalary = isOwner && 
    user?.id && 
    SALARY_EXCLUDED_OWNER_IDS.includes(user.id);

  const hasPermission = (key: string, type?: "view" | "edit"): boolean => {
    // Owner override: full access EXCEPT salary for excluded owners
    if (isOwner) {
      if (isOwnerExcludedFromSalary && SALARY_PERMISSION_KEYS.includes(key)) {
        return false; // Deny salary access for this owner
      }
      return true; // All other permissions granted
    }
    // ... existing logic for non-owners
  };

  const canView = (key: string): boolean => {
    if (isOwner) {
      if (isOwnerExcludedFromSalary && SALARY_PERMISSION_KEYS.includes(key)) {
        return false;
      }
      return true;
    }
    return hasPermission(key, "view") || hasPermission(key);
  };

  const canEdit = (key: string): boolean => {
    if (isOwner) {
      if (isOwnerExcludedFromSalary && SALARY_PERMISSION_KEYS.includes(key)) {
        return false;
      }
      return true;
    }
    return hasPermission(key, "edit");
  };

  const getDataScope = (key: string): DataScope => {
    if (isOwner) {
      if (isOwnerExcludedFromSalary && key === 'scope_payroll') {
        return "egen"; // Restrict salary data scope
      }
      return "alt"; // Full scope for everything else
    }
    // ... existing logic
  };
  
  // ...
}
```

## Teknisk Arkitektur

```text
┌─────────────────────────────────────────────────────────┐
│              Permission Resolution Flow                 │
├─────────────────────────────────────────────────────────┤
│  1. Er bruger Ejer?                                     │
│     └─ NEJ → Standard permission lookup                 │
│     └─ JA → Fuld adgang MED undtagelser ↓               │
│                                                         │
│  2. Er permission i OWNER_EXCLUDED_PERMISSIONS?         │
│     (softphone_outbound, softphone_inbound, etc.)       │
│     └─ JA → NÆGTET                                      │
│     └─ NEJ → Fortsæt ↓                                  │
│                                                         │
│  3. Er Ejer i SALARY_EXCLUDED_OWNER_IDS?                │
│     └─ NEJ → TILLADT                                    │
│     └─ JA → Er permission løn-relateret? ↓              │
│                                                         │
│  4. Er permission i SALARY_PERMISSION_KEYS?             │
│     └─ JA → NÆGTET (kun løn)                            │
│     └─ NEJ → TILLADT (alt andet)                        │
└─────────────────────────────────────────────────────────┘
```

## Berørte Filer

| Fil | Ændring |
|-----|---------|
| `src/config/permissions.ts` | Tilføj scopeKey til menu_reports_daily |
| `src/hooks/usePositionPermissions.ts` | Tilføj SALARY_EXCLUDED_OWNER_IDS, opdater permission funktioner |

## Resultat
- **Alle Ejere**: Fuld adgang til alt (undtagen softphone)
- **William Hoé Seiding**: Fuld adgang til alt UNDTAGEN løn-menuen og løn-data
- **Andre roller**: Uændret - styres via role_page_permissions

## Bemærkninger
- Løn-menuen i sidebar er allerede beskyttet via `SALARY_ALLOWED_USER_IDS` i AppSidebar.tsx
- Denne ændring sikrer at permission-systemet OGSÅ respekterer undtagelsen
- Ingen database-ændringer nødvendige
